begin;
select pg_advisory_xact_lock(74038202);

alter table whatsapp_private.channels add column if not exists auto_reply_since timestamptz;
alter table whatsapp_private.jobs add column if not exists agent_revision_id uuid;
create index if not exists whatsapp_agent_queue_idx on whatsapp_private.jobs(created_at, id)
  where state in ('pending', 'processing', 'sending');

create or replace function public.whatsapp_channel_get(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_org_member(p_org_id) then raise exception 'Acesso negado' using errcode = '42501'; end if;
  return (select jsonb_build_object('instance', c.evolution_instance, 'status', c.connection_status,
    'enabled', c.enabled, 'automationEnabled', c.auto_reply_enabled and c.auto_reply_since is not null)
    from whatsapp_private.channels c where c.org_id = p_org_id and c.provider = 'evolution' order by c.id limit 1);
end;
$$;

create or replace function public.whatsapp_set_automation(p_org_id uuid, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare channel whatsapp_private.channels;
begin
  if not public.can_write_org(p_org_id, true) then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if p_enabled is null then return jsonb_build_object('error', 'invalid_request'); end if;
  select * into channel from whatsapp_private.channels where org_id = p_org_id and provider = 'evolution'
    order by id limit 1 for update;
  if not found or (p_enabled and (not channel.enabled or channel.webhook_secret_hash is null)) then
    return jsonb_build_object('error', 'whatsapp_not_connected');
  end if;
  if p_enabled and not exists (
    select 1 from public.agents a join public.agent_revisions r
      on r.id = a.published_revision_id and r.agent_id = a.id and r.org_id = a.org_id
    where a.org_id = p_org_id and a.kind = 'atendimento'
      and length(btrim(coalesce(r.config->>'purpose', ''))) > 0
      and (r.config->'allowedActions') ? 'reply'
  ) then return jsonb_build_object('error', 'agent_not_published'); end if;

  update whatsapp_private.channels set auto_reply_enabled = p_enabled,
    auto_reply_since = case when p_enabled then coalesce(channel.auto_reply_since, clock_timestamp()) end
    where id = channel.id;
  if not p_enabled and channel.auto_reply_since is not null then
    update whatsapp_private.jobs set state = 'skipped'
      where channel_id = channel.id and state in ('pending', 'processing');
  end if;
  return jsonb_build_object('automationEnabled', p_enabled);
end;
$$;

-- A desconexão invalida a autorização para responder e a credencial da instância.
create or replace function whatsapp_private.stop_automation_on_logout()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.connection_status = 'disconnected' and old.connection_status is distinct from new.connection_status then
    new.auto_reply_since := null;
    update whatsapp_private.jobs set state = 'skipped'
      where channel_id = old.id and state in ('pending', 'processing');
  end if;
  return new;
end;
$$;
drop trigger if exists stop_automation_on_logout on whatsapp_private.channels;
create trigger stop_automation_on_logout before update of connection_status on whatsapp_private.channels
for each row execute function whatsapp_private.stop_automation_on_logout();

create or replace function public.whatsapp_ingest_evolution(
  p_instance text, p_webhook_token text, p_from text, p_name text,
  p_message_id text, p_content text, p_received_at timestamptz
) returns text language plpgsql security definer set search_path = '' as $$
declare
  channel whatsapp_private.channels;
  contact_id text := 'whatsapp:' || p_from;
  contact_lead uuid;
  conversation uuid;
  inbound uuid;
begin
  if coalesce(length(p_webhook_token),0) not between 32 and 128 then return 'ignored'; end if;
  select * into channel from whatsapp_private.channels c
    where c.provider = 'evolution' and c.evolution_instance = p_instance and c.enabled
      and c.webhook_secret_hash = encode(extensions.digest(convert_to(p_webhook_token, 'UTF8'), 'sha256'), 'hex')
      and (c.accept_all_recipients or p_from = any(c.recipients)) for share;
  if not found then return 'ignored'; end if;
  if p_from !~ '^[1-9][0-9]{6,14}$' or coalesce(length(p_message_id),0) not between 1 and 512
    or coalesce(length(btrim(p_content)),0) not between 1 and 10000 or p_received_at is null then return 'ignored'; end if;
  perform pg_advisory_xact_lock(hashtextextended(channel.org_id::text || ':' || p_message_id, 0));
  if exists (select 1 from public.messages m where m.org_id = channel.org_id and m.provider_message_id = p_message_id) then return 'duplicate'; end if;
  select id into contact_lead from public.leads where org_id = channel.org_id and external_id = contact_id for update;
  if not found then
    insert into public.leads(org_id,name,channel,phone_e164,external_id)
    values(channel.org_id,coalesce(nullif(btrim(left(p_name,160)),''),'Contato WhatsApp'),'WhatsApp','+' || p_from,contact_id)
    on conflict (org_id,phone_e164) where phone_e164 is not null do update
      set external_id = excluded.external_id, channel = excluded.channel
      where leads.external_id is null or leads.external_id = excluded.external_id
    returning id into contact_lead;
    if not found then raise exception 'Contato WhatsApp em conflito'; end if;
  end if;
  insert into public.conversations(org_id,lead_id) values(channel.org_id,contact_lead)
    on conflict (lead_id) do update set updated_at = now() returning id into conversation;
  insert into public.messages(org_id,conversation_id,lead_id,sender,content,provider_message_id,meta)
    values(channel.org_id,conversation,contact_lead,'client',p_content,p_message_id,
      jsonb_build_object('channel','whatsapp','provider','evolution','received_at',p_received_at)) returning id into inbound;
  update public.leads set last_message = p_content where id = contact_lead and org_id = channel.org_id;
  insert into whatsapp_private.jobs(channel_id,inbound_id,lead_id,recipient,received_at,state)
    values(channel.id,inbound,contact_lead,p_from,p_received_at,
      case when channel.auto_reply_enabled and channel.auto_reply_since is not null
        and p_received_at >= date_trunc('second', channel.auto_reply_since)
        and p_received_at between now() - interval '15 minutes' and now() + interval '5 minutes'
        and exists (select 1 from public.leads l where l.id = contact_lead and not l.whatsapp_paused)
      then 'pending' else 'skipped' end);
  return 'stored';
end;
$$;

-- Configuração e contexto vêm da mesma revisão publicada. A fila respeita a ordem por conversa.
create or replace function public.whatsapp_claim_agent()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare task jsonb;
begin
  update whatsapp_private.jobs j set state = 'uncertain', delivery = 'uncertain'
    from whatsapp_private.channels c where j.channel_id = c.id and c.provider = 'evolution'
      and j.agent_revision_id is not null and j.state = 'sending' and j.lease_until < now();

  update whatsapp_private.jobs j set state = 'skipped'
    from whatsapp_private.channels c, public.leads l
    where j.channel_id = c.id and j.lead_id = l.id and c.provider = 'evolution'
      and c.auto_reply_since is not null and j.state in ('pending', 'processing')
      and (j.received_at < now() - interval '15 minutes' or l.whatsapp_paused or j.created_at <= l.whatsapp_paused_at);

  with next_job as (
    select j.id, r.id as revision_id, r.config, r.context, c.evolution_instance
    from whatsapp_private.jobs j
    join whatsapp_private.channels c on c.id = j.channel_id
    join public.agents a on a.org_id = c.org_id and a.kind = 'atendimento'
    join public.agent_revisions r on r.id = a.published_revision_id and r.agent_id = a.id and r.org_id = c.org_id
    where c.provider = 'evolution' and c.enabled and c.auto_reply_enabled and c.auto_reply_since is not null
      and c.webhook_secret_hash is not null and (r.config->'allowedActions') ? 'reply'
      and (j.state = 'pending' or (j.state = 'processing' and j.lease_until < now()))
      and not exists (
        select 1 from whatsapp_private.jobs older where older.channel_id = j.channel_id
          and older.lead_id = j.lead_id and older.state in ('pending','processing','sending')
          and (older.created_at, older.id) < (j.created_at, j.id)
      )
    order by j.created_at, j.id limit 1 for update of j skip locked
  ), claimed as (
    update whatsapp_private.jobs j set state = 'processing', lease_id = gen_random_uuid(),
      lease_until = now() + interval '60 seconds', agent_revision_id = n.revision_id
    from next_job n where j.id = n.id
    returning j.*, n.config, n.context, n.evolution_instance
  )
  select jsonb_build_object('id', j.id, 'lease_id', j.lease_id, 'recipient', j.recipient, 'provider', 'evolution',
    'evolution_instance', j.evolution_instance, 'config', j.config, 'context', j.context,
    'received_at', j.received_at, 'content', m.content, 'sent_last_hour', (
      select count(*) from whatsapp_private.jobs recent
      where recent.channel_id = j.channel_id and recent.lead_id = j.lead_id and recent.state in ('sending','accepted','uncertain')
        and recent.created_at >= now() - interval '1 hour'
    ), 'history', (
      select coalesce(jsonb_agg(jsonb_build_object('sender', h.sender, 'content', h.content)
        order by h.created_at, h.id), '[]'::jsonb)
      from (select prior.id, prior.created_at, prior.sender, left(prior.content, 1000) as content
        from public.messages prior where prior.conversation_id = m.conversation_id and prior.org_id = m.org_id
          and (prior.created_at, prior.id) < (m.created_at, m.id)
        order by prior.created_at desc, prior.id desc limit 10) h
    )) into task from claimed j join public.messages m on m.id = j.inbound_id;
  return task;
end;
$$;

-- Confere novamente ativação, pausa e revisão depois de gerar a resposta.
create or replace function public.whatsapp_prepare_agent(p_job uuid, p_lease uuid, p_reply text, p_handoff boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare channel whatsapp_private.channels; job whatsapp_private.jobs; lead public.leads;
begin
  select c.* into channel from whatsapp_private.channels c join whatsapp_private.jobs j on j.channel_id = c.id
    where j.id = p_job and c.provider = 'evolution' for share of c;
  if not found then return false; end if;
  select l.* into lead from public.leads l join whatsapp_private.jobs j on j.lead_id = l.id
    where j.id = p_job and l.org_id = channel.org_id for update of l;
  select * into job from whatsapp_private.jobs where id = p_job and lease_id = p_lease
    and lease_until > now() and state = 'processing' and agent_revision_id is not null for update;
  if not found then return false; end if;
  if not channel.enabled or not channel.auto_reply_enabled or channel.auto_reply_since is null
    or lead.whatsapp_paused or job.created_at <= lead.whatsapp_paused_at
    or job.received_at < now() - interval '15 minutes'
    or coalesce(length(btrim(p_reply)), 0) not between 1 and 1000 then
    update whatsapp_private.jobs set state = 'skipped' where id = p_job;
    return false;
  end if;
  if not exists (select 1 from public.agents a where a.org_id = channel.org_id and a.kind = 'atendimento'
    and a.published_revision_id = job.agent_revision_id) then
    update whatsapp_private.jobs set state = 'pending', lease_id = null, lease_until = null where id = p_job;
    return false;
  end if;
  if p_handoff then
    update public.leads set whatsapp_paused = true, whatsapp_paused_at = clock_timestamp(),
      next_action = 'Assumir atendimento no WhatsApp' where id = lead.id;
    insert into public.lead_events(org_id,lead_id,type,text,meta) values
      (lead.org_id,lead.id,'whatsapp','Atendimento humano solicitado',jsonb_build_object('message_id',job.inbound_id));
  end if;
  update whatsapp_private.jobs set state = 'sending', reply = btrim(p_reply),
    lease_until = now() + interval '60 seconds' where id = p_job;
  return true;
end;
$$;

-- Reutiliza o registro de envio com escopo do canal. A sessão do worker não muda de papel.
create or replace function public.whatsapp_finish_agent(p_job uuid, p_lease uuid, p_delivery text, p_outbound_id text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare channel uuid; claims text; saved boolean;
begin
  select j.channel_id into channel from whatsapp_private.jobs j join whatsapp_private.channels c on c.id = j.channel_id
    where j.id = p_job and j.lease_id = p_lease and j.agent_revision_id is not null and c.provider = 'evolution';
  if not found then return false; end if;
  claims := current_setting('request.jwt.claims', true);
  perform set_config('request.jwt.claims', jsonb_build_object('channel_id', channel)::text, true);
  saved := public.whatsapp_finish(p_job, p_delivery, p_outbound_id, p_lease);
  perform set_config('request.jwt.claims', coalesce(claims, ''), true);
  return saved;
end;
$$;

revoke all on function public.whatsapp_set_automation(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.whatsapp_set_automation(uuid,boolean) to authenticated;
revoke all on function public.whatsapp_claim_agent(),public.whatsapp_prepare_agent(uuid,uuid,text,boolean),
  public.whatsapp_finish_agent(uuid,uuid,text,text),public.whatsapp_ingest_evolution(text,text,text,text,text,text,timestamptz)
  from public,anon,authenticated,service_role;
grant execute on function public.whatsapp_claim_agent(),public.whatsapp_prepare_agent(uuid,uuid,text,boolean),
  public.whatsapp_finish_agent(uuid,uuid,text,text),public.whatsapp_ingest_evolution(text,text,text,text,text,text,timestamptz)
  to service_role;

notify pgrst, 'reload schema';
commit;
