begin;
select pg_advisory_xact_lock(74038202);
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $$
begin
  if to_regprocedure('extensions.digest(bytea,text)') is null and to_regprocedure('public.digest(bytea,text)') is not null then
    execute 'create function extensions.digest(bytea,text) returns bytea language sql immutable strict set search_path = pg_catalog as ''select public.digest($1,$2)''';
  end if;
end;
$$;

alter table whatsapp_private.channels
  add column if not exists accept_all_recipients boolean not null default false,
  add column if not exists auto_reply_enabled boolean not null default true,
  add column if not exists connection_status text not null default 'disconnected',
  add column if not exists webhook_secret_hash text;
alter table whatsapp_private.channels drop constraint if exists channels_recipients_check;
alter table whatsapp_private.channels add constraint channels_recipients_check
  check (cardinality(recipients) > 0 or (provider = 'evolution' and accept_all_recipients));
alter table whatsapp_private.channels drop constraint if exists channels_connection_status_check;
alter table whatsapp_private.channels add constraint channels_connection_status_check
  check (connection_status in ('disconnected','connecting','open','close'));

create or replace function public.whatsapp_channel_get(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  select jsonb_build_object('instance', evolution_instance, 'status', connection_status, 'enabled', enabled)
    into result from whatsapp_private.channels where org_id = p_org_id and provider = 'evolution' order by id limit 1;
  return result;
end;
$$;

create or replace function public.whatsapp_channel_ensure(p_org_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare instance_name text;
begin
  if not public.can_write_org(p_org_id, true) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('whatsapp-evolution:' || p_org_id::text, 0));
  select evolution_instance into instance_name from whatsapp_private.channels
    where org_id = p_org_id and provider = 'evolution' order by id limit 1;
  if not found then
    insert into whatsapp_private.channels(org_id, phone_number_id, recipients, enabled, provider,
      evolution_instance, accept_all_recipients, auto_reply_enabled, connection_status)
    values(p_org_id, null, array[]::text[], false, 'evolution',
      'leadia-' || replace(gen_random_uuid()::text, '-', ''), true, false, 'disconnected')
    returning evolution_instance into instance_name;
  end if;
  return jsonb_build_object('instance', instance_name);
end;
$$;

create or replace function public.whatsapp_channel_set_webhook_secret(p_org_id uuid, p_secret text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare channel_id uuid;
begin
  if not public.can_write_org(p_org_id, true) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_secret !~ '^[A-Za-z0-9_-]{32,128}$' then return false; end if;
  select id into channel_id from whatsapp_private.channels where org_id = p_org_id and provider = 'evolution' order by id limit 1;
  if not found then return false; end if;
  update whatsapp_private.channels set webhook_secret_hash = encode(extensions.digest(convert_to(p_secret, 'UTF8'), 'sha256'), 'hex')
    where id = channel_id;
  return found;
end;
$$;

create or replace function public.whatsapp_channel_set_connected(p_org_id uuid, p_connected boolean, p_state text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare channel_id uuid;
begin
  if not public.can_write_org(p_org_id, true) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_state not in ('open','connecting','close','disconnected') or p_connected is null then return false; end if;
  select id into channel_id from whatsapp_private.channels where org_id = p_org_id and provider = 'evolution' order by id limit 1;
  if not found then return false; end if;
  update whatsapp_private.channels set enabled = p_connected,
    connection_status = case when p_connected then 'open' else p_state end,
    webhook_secret_hash = case when p_state = 'disconnected' then null else webhook_secret_hash end
    where id = channel_id;
  return found;
end;
$$;

-- RPC chamada exclusivamente pelo serviço de webhook com a chave service_role guardada no servidor.
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
      and (c.accept_all_recipients or p_from = any(c.recipients));
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
    values(channel.id,inbound,contact_lead,p_from,p_received_at,'skipped');
  return 'stored';
end;
$$;

revoke all on function public.whatsapp_channel_get(uuid), public.whatsapp_channel_ensure(uuid),
  public.whatsapp_channel_set_webhook_secret(uuid,text), public.whatsapp_channel_set_connected(uuid,boolean,text),
  public.whatsapp_ingest_evolution(text,text,text,text,text,text,timestamptz)
  from public, anon, service_role;
grant execute on function public.whatsapp_channel_get(uuid), public.whatsapp_channel_ensure(uuid),
  public.whatsapp_channel_set_webhook_secret(uuid,text), public.whatsapp_channel_set_connected(uuid,boolean,text)
  to authenticated;
grant execute on function public.whatsapp_ingest_evolution(text,text,text,text,text,text,timestamptz) to service_role;

notify pgrst, 'reload schema';
commit;
