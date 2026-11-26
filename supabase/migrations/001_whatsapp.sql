-- O token do worker é assinado com o segredo JWT da dev e só autoriza as RPCs do canal.
begin;
select pg_advisory_xact_lock(74038202);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'leadia_whatsapp') then
    create role leadia_whatsapp nologin;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant leadia_whatsapp to authenticator;
  end if;
end;
$$;

create schema if not exists whatsapp_private;
revoke all on schema whatsapp_private from public;
grant usage on schema public to leadia_whatsapp;

alter table public.leads add column if not exists whatsapp_paused boolean not null default false;
alter table public.leads add column if not exists whatsapp_paused_at timestamptz;
create unique index if not exists leads_whatsapp_contact_idx
  on public.leads (org_id, external_id) where external_id like 'whatsapp:%';

create table if not exists whatsapp_private.channels (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]+$'),
  recipients text[] not null check (cardinality(recipients) > 0),
  enabled boolean not null default false
);

create table if not exists whatsapp_private.jobs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references whatsapp_private.channels(id),
  inbound_id uuid not null unique references public.messages(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  recipient text not null,
  received_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  state text not null default 'pending'
    check (state in ('pending','processing','sending','accepted','uncertain','failed','skipped')),
  lease_id uuid,
  lease_until timestamptz,
  reply text,
  outbound_id text,
  delivery text
);
create index if not exists whatsapp_jobs_order_idx
  on whatsapp_private.jobs(channel_id, lead_id, created_at, id)
  where state in ('pending', 'processing', 'sending');
create index if not exists whatsapp_jobs_outbound_idx
  on whatsapp_private.jobs(channel_id, outbound_id) where outbound_id is not null;

create or replace function whatsapp_private.channel_id() returns uuid
language sql stable set search_path = '' as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'channel_id', '')::uuid;
$$;

create or replace function public.whatsapp_ingest(
  p_phone_id text, p_from text, p_name text, p_message_id text, p_content text, p_received_at timestamptz
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  channel whatsapp_private.channels;
  contact_id text := 'whatsapp:' || p_from;
  contact_lead uuid;
  conversation uuid;
  inbound uuid;
  paused boolean;
begin
  select * into channel from whatsapp_private.channels
  where id = whatsapp_private.channel_id() and enabled and phone_number_id = p_phone_id
    and p_from = any(recipients);
  if not found then return 'ignored'; end if;
  if p_from !~ '^[1-9][0-9]{6,14}$' or coalesce(length(p_message_id), 0) not between 1 and 512
    or coalesce(length(btrim(p_content)), 0) not between 1 and 10000 or p_received_at is null then
    return 'ignored';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(channel.org_id::text || ':' || p_message_id, 0));
  if exists (select 1 from public.messages
    where org_id = channel.org_id and provider_message_id = p_message_id) then
    return 'duplicate';
  end if;

  select id into contact_lead from public.leads
    where org_id = channel.org_id and external_id = contact_id for update;
  if not found then
    insert into public.leads(org_id, name, channel, phone_e164, external_id)
    values(channel.org_id, coalesce(nullif(btrim(left(p_name, 160)), ''), 'Contato WhatsApp'),
      'WhatsApp', '+' || p_from, contact_id)
    on conflict (org_id, phone_e164) where phone_e164 is not null do update
      set external_id = excluded.external_id, channel = excluded.channel
      where leads.external_id is null or leads.external_id = excluded.external_id
    returning id into contact_lead;
    if not found then raise exception 'Contato WhatsApp em conflito'; end if;
  end if;
  insert into public.conversations(org_id, lead_id) values(channel.org_id, contact_lead)
  on conflict (lead_id) do update set updated_at = now() returning id into conversation;

  insert into public.messages(org_id, conversation_id, lead_id, sender, content, provider_message_id, meta)
  values(channel.org_id, conversation, contact_lead, 'client', p_content, p_message_id,
    jsonb_build_object('channel','whatsapp','received_at',p_received_at))
  returning id into inbound;
  update public.leads set last_message = p_content where id = contact_lead and org_id = channel.org_id
    returning whatsapp_paused into paused;

  insert into whatsapp_private.jobs(channel_id, inbound_id, lead_id, recipient, received_at, state)
  values(channel.id, inbound, contact_lead, p_from, p_received_at,
    case when paused or p_received_at < now() - interval '23 hours 55 minutes' or p_received_at > now() + interval '5 minutes'
      then 'skipped' else 'pending' end);
  return 'stored';
end;
$$;

create or replace function public.whatsapp_claim()
returns table (id uuid, lease_id uuid, content text, recipient text, status text)
language plpgsql security definer set search_path = '' as $$
begin
  update whatsapp_private.jobs j set state = 'uncertain'
  where j.channel_id = whatsapp_private.channel_id() and j.state = 'sending' and j.lease_until < now();

  update whatsapp_private.jobs j set state = 'skipped'
  from whatsapp_private.channels c, public.leads l
  where c.id = whatsapp_private.channel_id() and j.channel_id = c.id and l.id = j.lead_id
    and j.state in ('pending','processing')
    and (not c.enabled or not (j.recipient = any(c.recipients)) or l.whatsapp_paused
      or j.created_at <= l.whatsapp_paused_at or l.status in ('Convertido','Perdido') or j.received_at < now() - interval '23 hours 55 minutes');

  return query
  with next_job as (
    select j.id from whatsapp_private.jobs j
    join whatsapp_private.channels c on c.id = j.channel_id and c.enabled
    where j.channel_id = whatsapp_private.channel_id()
      and (j.state = 'pending' or (j.state = 'processing' and j.lease_until < now()))
      and not exists (
        select 1 from whatsapp_private.jobs older where older.channel_id = j.channel_id
          and older.lead_id = j.lead_id and older.state in ('pending','processing','sending')
          and (older.created_at, older.id) < (j.created_at, j.id)
      )
    order by j.created_at, j.id limit 1 for update of j skip locked
  )
  update whatsapp_private.jobs j
  set state = 'processing', lease_id = gen_random_uuid(), lease_until = now() + interval '60 seconds'
  from next_job, public.messages m, public.leads l
  where j.id = next_job.id and m.id = j.inbound_id and l.id = j.lead_id
  returning j.id, j.lease_id, m.content, j.recipient, l.status;
end;
$$;

create or replace function public.whatsapp_prepare(
  p_job uuid, p_lease uuid, p_reply text, p_intent text, p_need text, p_source text, p_model_intent text default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  job whatsapp_private.jobs;
  lead public.leads;
  label text;
begin
  select j.* into job from whatsapp_private.jobs j
  join whatsapp_private.channels c on c.id = j.channel_id and c.enabled and j.recipient = any(c.recipients)
  where j.channel_id = whatsapp_private.channel_id() and j.id = p_job and j.lease_id = p_lease
    and j.lease_until > now() and j.state = 'processing' for update of j;
  if not found then return false; end if;

  select * into lead from public.leads where id = job.lead_id for update;
  if lead.whatsapp_paused or job.created_at <= lead.whatsapp_paused_at or lead.status in ('Convertido','Perdido')
    or job.received_at < now() - interval '23 hours 55 minutes' then
    update whatsapp_private.jobs set state = 'skipped' where id = job.id;
    return false;
  end if;

  if p_intent is null or p_intent not in ('interest','qualify','proposal','objection','follow_up','human')
    or p_source is null or p_source not in ('claude','rules','claude_fallback')
    or coalesce(length(btrim(p_reply)), 0) not between 1 and 1000 then
    raise exception 'Classificação WhatsApp inválida';
  end if;

  label := case p_intent
    when 'qualify' then 'Qualificação'
    when 'proposal' then 'Pedido de proposta'
    when 'objection' then 'Objeção'
    when 'follow_up' then case when exists (select 1 from public.messages m where m.id = job.inbound_id
      and m.content ~* '\m(car[oa]|desconto)\M') then 'Objeção · Retorno solicitado' else 'Retorno solicitado' end
    when 'human' then 'Atendimento humano solicitado'
    else 'Interesse'
  end;
  insert into public.lead_events(org_id,lead_id,type,text,meta)
  values (lead.org_id,lead.id,'whatsapp',label ||
    case p_source when 'claude' then ' · Claude' when 'claude_fallback' then ' · Claude indisponível, resposta por regra' else ' · Regra' end,
    jsonb_build_object('message_id',job.inbound_id,'intent',p_intent,'source',p_source,'model_intent',p_model_intent));

  if p_intent = 'qualify' and lead.status = 'Em atendimento' then
    update public.leads set status = 'Qualificado', interest = coalesce(nullif(btrim(left(p_need,180)), ''), interest)
      where id = lead.id;
  elsif p_intent = 'proposal' then
    update public.leads set next_action = 'Revisar pedido e preparar proposta' where id = lead.id;
  elsif p_intent = 'follow_up' then
    if not exists (select 1 from public.follow_ups
      where org_id = lead.org_id and lead_id = lead.id and status = 'open' and title = 'Retorno solicitado pelo WhatsApp') then
      insert into public.follow_ups(org_id,lead_id,title,note,due_at,when_label)
      values (lead.org_id,lead.id,'Retorno solicitado pelo WhatsApp','Retomar a conversa manualmente.',
        (date_trunc('day',now() at time zone 'America/Fortaleza') + interval '1 day 9 hours') at time zone 'America/Fortaleza',
        'Amanhã, às 9h');
    end if;
  elsif p_intent = 'human' then
    update public.leads set whatsapp_paused = true, whatsapp_paused_at = clock_timestamp(), next_action = 'Assumir atendimento no WhatsApp' where id = lead.id;
  end if;

  update whatsapp_private.jobs set state = 'sending', reply = btrim(p_reply), lease_until = now() + interval '60 seconds'
  where id = job.id;
  return true;
end;
$$;

create or replace function public.whatsapp_finish(
  p_job uuid, p_delivery text, p_outbound_id text default null, p_lease uuid default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  job whatsapp_private.jobs;
  inbound public.messages;
  channel whatsapp_private.channels;
begin
  select * into channel from whatsapp_private.channels where id = whatsapp_private.channel_id();
  if not found then return false; end if;
  select * into job from whatsapp_private.jobs
  where channel_id = channel.id
    and (id = p_job or (p_job is null and outbound_id = p_outbound_id)) and state in ('sending','uncertain','accepted','failed')
    and (p_lease is null or lease_id = p_lease) for update;
  if not found then return false; end if;

  if p_delivery not in ('accepted','sent','delivered','read','failed','uncertain') or p_delivery is null then
    return false;
  end if;
  if p_delivery in ('uncertain','accepted') and job.delivery is not null and job.delivery not in ('accepted','uncertain') then
    return true;
  end if;
  if job.delivery = 'read' or (job.delivery = 'delivered' and p_delivery <> 'read')
    or (job.delivery = 'sent' and p_delivery = 'accepted') then
    return true;
  end if;
  if job.outbound_id is not null and p_outbound_id is not null and job.outbound_id <> p_outbound_id then
    return false;
  end if;
  if p_delivery in ('accepted','sent','delivered','read') and coalesce(length(p_outbound_id),0) not between 1 and 512 then
    return false;
  end if;

  update whatsapp_private.jobs
  set state = case when p_delivery in ('failed','uncertain') then p_delivery else 'accepted' end,
    delivery = p_delivery, outbound_id = coalesce(p_outbound_id,outbound_id)
  where id = job.id;

  select * into inbound from public.messages where id = job.inbound_id;
  if p_delivery in ('accepted','sent','delivered','read') then
    insert into public.messages(org_id,conversation_id,lead_id,sender,content,provider_message_id,meta)
    values (inbound.org_id,inbound.conversation_id,inbound.lead_id,'ia',job.reply,p_outbound_id,
      jsonb_build_object('channel','whatsapp','delivery',p_delivery))
    on conflict (org_id,provider_message_id) where provider_message_id is not null do update
      set meta = excluded.meta where messages.sender = 'ia' and messages.conversation_id = inbound.conversation_id;
    if job.state <> 'accepted' then
      update public.leads set status = case when status = 'Novo' then 'Em atendimento' else status end,
        last_message = case when last_message = inbound.content then job.reply else last_message end
        where id = job.lead_id and org_id = channel.org_id;
      update public.conversations set updated_at = now() where id = inbound.conversation_id;
    end if;
  elsif p_delivery is distinct from job.delivery then
    update public.messages set meta = meta || jsonb_build_object('delivery',p_delivery)
    where org_id = channel.org_id and conversation_id = inbound.conversation_id
      and sender = 'ia' and provider_message_id = coalesce(p_outbound_id,job.outbound_id);
    insert into public.lead_events(org_id,lead_id,type,text,meta)
    values(inbound.org_id,inbound.lead_id,'whatsapp',
      case when p_delivery = 'failed' then 'Envio pelo WhatsApp falhou' else 'Envio WhatsApp a confirmar, sem reenvio automático' end,
      jsonb_build_object('message_id',job.inbound_id));
  end if;
  return true;
end;
$$;

create or replace function public.set_whatsapp_pause(p_lead uuid, p_pause boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  lead public.leads;
begin
  select * into lead from public.leads where id = p_lead and external_id like 'whatsapp:%'
    and public.can_write_org(org_id) for update;
  if not found or p_pause is null then raise exception 'Lead WhatsApp indisponível' using errcode = '42501'; end if;
  if lead.whatsapp_paused is distinct from p_pause then
    update public.leads set whatsapp_paused = p_pause,
      whatsapp_paused_at = case when p_pause then clock_timestamp() else whatsapp_paused_at end
    where id = p_lead;
    insert into public.lead_events(org_id,lead_id,type,text,created_by)
    values(lead.org_id,lead.id,'handoff',
      case when p_pause then 'Automação WhatsApp pausada pelo operador' else 'Automação WhatsApp retomada pelo operador' end,auth.uid());
  end if;
  return p_pause;
end;
$$;

revoke all on function public.whatsapp_ingest(text,text,text,text,text,timestamptz),
  public.whatsapp_claim(), public.whatsapp_prepare(uuid,uuid,text,text,text,text,text),
  public.whatsapp_finish(uuid,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.whatsapp_ingest(text,text,text,text,text,timestamptz),
  public.whatsapp_claim(), public.whatsapp_prepare(uuid,uuid,text,text,text,text,text),
  public.whatsapp_finish(uuid,text,text,uuid) to leadia_whatsapp;
revoke all on function public.set_whatsapp_pause(uuid,boolean) from public,anon,service_role;
grant execute on function public.set_whatsapp_pause(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
