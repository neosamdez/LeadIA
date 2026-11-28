begin;
select pg_advisory_xact_lock(74038202);

alter table whatsapp_private.channels
  add column if not exists provider text not null default 'meta',
  add column if not exists evolution_instance text;
alter table whatsapp_private.channels alter column phone_number_id drop not null;
alter table whatsapp_private.channels drop constraint if exists channels_phone_number_id_check;
alter table whatsapp_private.channels drop constraint if exists channels_provider_identity_check;
alter table whatsapp_private.channels drop constraint if exists channels_provider_check;
alter table whatsapp_private.channels add constraint channels_provider_identity_check check (
  (provider = 'meta' and phone_number_id is not null and phone_number_id ~ '^[0-9]+$' and evolution_instance is null)
  or (provider = 'evolution' and phone_number_id is null and evolution_instance is not null
    and evolution_instance ~ '^[A-Za-z0-9_-]{1,64}$')
);
alter table whatsapp_private.channels add constraint channels_provider_check check (provider in ('meta','evolution'));
create unique index if not exists whatsapp_channels_evolution_instance_idx
  on whatsapp_private.channels (evolution_instance) where evolution_instance is not null;

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
  where id = whatsapp_private.channel_id() and enabled
    and ((provider = 'meta' and phone_number_id = p_phone_id)
      or (provider = 'evolution' and evolution_instance = p_phone_id))
    and p_from = any(recipients);
  if not found then return 'ignored'; end if;
  if p_from !~ '^[1-9][0-9]{6,14}$' or coalesce(length(p_message_id), 0) not between 1 and 512
    or coalesce(length(btrim(p_content)), 0) not between 1 and 10000 or p_received_at is null then
    return 'ignored';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(channel.org_id::text || ':' || p_message_id, 0));
  if exists (select 1 from public.messages where org_id = channel.org_id and provider_message_id = p_message_id) then
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
    jsonb_build_object('channel','whatsapp','provider',channel.provider,'received_at',p_received_at))
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

create or replace function public.whatsapp_claim_provider(p_provider text)
returns table (
  id uuid, lease_id uuid, content text, recipient text, status text,
  provider text, phone_number_id text, evolution_instance text
)
language plpgsql security definer set search_path = '' as $$
begin
  if p_provider not in ('meta','evolution') or p_provider is null then return; end if;

  update whatsapp_private.jobs j set state = 'uncertain'
  where j.channel_id = whatsapp_private.channel_id() and j.state = 'sending' and j.lease_until < now();

  update whatsapp_private.jobs j set state = 'skipped'
  from whatsapp_private.channels c, public.leads l
  where c.id = whatsapp_private.channel_id() and j.channel_id = c.id and l.id = j.lead_id
    and j.state in ('pending','processing')
    and (not c.enabled or not (j.recipient = any(c.recipients)) or l.whatsapp_paused
      or j.created_at <= l.whatsapp_paused_at or l.status in ('Convertido','Perdido')
      or j.received_at < now() - interval '23 hours 55 minutes');

  return query
  with next_job as (
    select j.id from whatsapp_private.jobs j
    join whatsapp_private.channels c on c.id = j.channel_id and c.enabled and c.provider = p_provider
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
  from next_job, public.messages m, public.leads l, whatsapp_private.channels c
  where j.id = next_job.id and m.id = j.inbound_id and l.id = j.lead_id and c.id = j.channel_id
  returning j.id, j.lease_id, m.content, j.recipient, l.status, c.provider, c.phone_number_id, c.evolution_instance;
end;
$$;

-- Workers antigos continuam podendo reivindicar apenas canais Meta durante o rollout.
create or replace function public.whatsapp_claim()
returns table (id uuid, lease_id uuid, content text, recipient text, status text)
language sql security definer set search_path = '' as $$
  select claim.id, claim.lease_id, claim.content, claim.recipient, claim.status
  from public.whatsapp_claim_provider('meta') as claim;
$$;

revoke all on function public.whatsapp_ingest(text,text,text,text,text,timestamptz),
  public.whatsapp_claim_provider(text) from public,anon,authenticated,service_role;
grant execute on function public.whatsapp_ingest(text,text,text,text,text,timestamptz),
  public.whatsapp_claim_provider(text) to leadia_whatsapp;
notify pgrst,'reload schema';
commit;
