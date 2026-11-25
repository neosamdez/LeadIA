-- LeadIA: migração transacional/reaplicável; Auth cria auth.users antes.
begin;
select pg_advisory_xact_lock(74038201);
create extension if not exists pgcrypto;
create or replace function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid;
$$;
grant usage on schema auth, public to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end;
$$;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, full_name text, avatar_url text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null, slug text unique,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.memberships (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('owner','admin','member','viewer')),
 created_at timestamptz not null default now(), unique(org_id,user_id)
);
create index if not exists memberships_user_id_idx on public.memberships(user_id);
create table if not exists public.leads (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 owner_id uuid references auth.users(id), name text not null check(length(trim(name))>0),
 company text, channel text, phone_e164 text, external_id text,
 status text not null default 'Novo', score integer not null default 0 check(score between 0 and 100),
 value numeric(12,2) not null default 0 check(value>=0), interest text, last_message text, avatar text,
 next_action text, loss_reason text, tags text[] not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(org_id,id)
);
create index if not exists leads_org_status_idx on public.leads(org_id,status);
create index if not exists leads_updated_at_idx on public.leads(org_id,updated_at desc);
create unique index if not exists leads_phone_idx on public.leads(org_id,phone_e164) where phone_e164 is not null;
create table if not exists public.conversations (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 lead_id uuid not null unique, status text not null default 'open',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(org_id,id,lead_id),
 foreign key(org_id,lead_id) references public.leads(org_id,id) on delete cascade
);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 conversation_id uuid not null, lead_id uuid not null,
 sender text not null check(sender in ('client','ia','consultor','system')),
 content text not null check(length(trim(content)) between 1 and 10000), provider_message_id text,
 meta jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
 foreign key(org_id,conversation_id,lead_id) references public.conversations(org_id,id,lead_id) on delete cascade
);
create index if not exists messages_conversation_id_idx on public.messages(conversation_id,created_at);
create unique index if not exists messages_provider_id_idx on public.messages(org_id,provider_message_id) where provider_message_id is not null;
create table if not exists public.lead_events (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 lead_id uuid not null, type text not null, text text not null, meta jsonb not null default '{}'::jsonb,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 foreign key(org_id,lead_id) references public.leads(org_id,id) on delete cascade
);
create index if not exists lead_events_lead_id_idx on public.lead_events(lead_id,created_at desc);
create table if not exists public.follow_ups (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 lead_id uuid not null, title text not null, note text, due_at timestamptz, when_label text,
 status text not null default 'open' check(status in ('open','done','canceled')), created_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(org_id,lead_id) references public.leads(org_id,id) on delete cascade
);
create index if not exists follow_ups_org_id_idx on public.follow_ups(org_id,status);
create table if not exists public.goals (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations(id) on delete cascade,
 period text not null default 'monthly', target_leads integer not null default 0,
 target_conversion numeric(5,2) not null default 0, target_response_minutes integer not null default 0,
 target_revenue numeric(12,2) not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(org_id,period)
);
create table if not exists public.org_settings (
 org_id uuid primary key references public.organizations(id) on delete cascade, company_name text, segment text, tone text,
 auto_reply boolean not null default false, follow_up boolean not null default true,
 ai_enabled boolean not null default false, use_nvidia_api boolean not null default false,
 nvidia_model text, nvidia_proxy_url text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.is_org_member(target_org uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.memberships where org_id=target_org and user_id=auth.uid());
$$;
create or replace function public.can_write_org(target_org uuid, admin_only boolean default false) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.memberships where org_id=target_org and user_id=auth.uid()
 and role=any(case when admin_only then array['owner','admin'] else array['owner','admin','member'] end));
$$;
revoke all on function public.is_org_member(uuid),public.can_write_org(uuid,boolean) from public;
grant execute on function public.is_org_member(uuid),public.can_write_org(uuid,boolean) to authenticated,service_role;
-- Bootstrap atômico: não permite se adicionar a organizações de outras pessoas.
create or replace function public.get_or_create_org() returns public.organizations
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); org public.organizations; company text;
begin
 if uid is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 select o.* into org from public.organizations o join public.memberships m on m.org_id=o.id
 where m.user_id=uid order by m.created_at,m.id limit 1;
 if found then return org; end if;
 select coalesce(nullif(raw_user_meta_data->>'company',''),split_part(email,'@',1),'Minha Empresa') into company from auth.users where id=uid;
 insert into public.organizations(name,created_by) values(company,uid) returning * into org;
 insert into public.memberships(org_id,user_id,role) values(org.id,uid,'owner');
 insert into public.org_settings(org_id,company_name) values(org.id,company);
 insert into public.goals(org_id) values(org.id);
 return org;
end;
$$;
revoke all on function public.get_or_create_org() from public;
grant execute on function public.get_or_create_org() to authenticated;
create or replace function public.append_message(p_lead_id uuid,p_sender text,p_content text)
returns public.messages language plpgsql security invoker set search_path=public,pg_temp as $$
declare lead public.leads; conv public.conversations; msg public.messages;
begin
 select * into lead from public.leads where id=p_lead_id;
 if not found or not public.can_write_org(lead.org_id) then raise exception 'Lead indisponível' using errcode='42501'; end if;
 insert into public.conversations(org_id,lead_id) values(lead.org_id,lead.id)
 on conflict(lead_id) do update set updated_at=now() returning * into conv;
 insert into public.messages(org_id,conversation_id,lead_id,sender,content)
 values(lead.org_id,conv.id,lead.id,p_sender,p_content) returning * into msg;
 update public.leads set last_message=p_content where id=lead.id;
 return msg;
end;
$$;
revoke all on function public.append_message(uuid,text,text) from public;
grant execute on function public.append_message(uuid,text,text) to authenticated;
create or replace function public.prevent_org_move() returns trigger language plpgsql as $$
begin
 if new.org_id is distinct from old.org_id then raise exception 'Organização imutável' using errcode='42501'; end if;
 return new;
end;
$$;
create or replace function public.lead_audit_event() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if tg_op='INSERT' then
 insert into public.lead_events(org_id,lead_id,type,text,created_by) values(new.org_id,new.id,'lead','Lead criado',auth.uid());
 elsif new.status is distinct from old.status then
 insert into public.lead_events(org_id,lead_id,type,text,created_by) values(new.org_id,new.id,'status','Status alterado: '||old.status||' → '||new.status,auth.uid());
 end if;
 return new;
end;
$$;
drop trigger if exists lead_audit on public.leads;
create trigger lead_audit after insert or update of status on public.leads for each row execute function public.lead_audit_event();
-- Recria as policies apenas das tabelas do aplicativo.
do $$ declare tab text; pol record; admin_only boolean; begin
 foreach tab in array array['profiles','organizations','memberships','leads','conversations','messages','lead_events','follow_ups','goals','org_settings'] loop
 execute format('alter table public.%I enable row level security',tab);
 for pol in select policyname from pg_policies where schemaname='public' and tablename=tab loop
 execute format('drop policy %I on public.%I',pol.policyname,tab);
 end loop;
 execute format('revoke all on public.%I from anon,authenticated',tab);
 execute format('grant all on public.%I to service_role',tab);
 if tab not in ('memberships','messages','lead_events') then
 execute format('drop trigger if exists %I on public.%I',tab||'_updated_at',tab);
 execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',tab||'_updated_at',tab);
 end if;
 if tab not in ('profiles','organizations','memberships') then
 admin_only:=tab='org_settings';
 execute format('grant select,insert,update,delete on public.%I to authenticated',tab);
 execute format('create policy tenant_read on public.%I for select to authenticated using(public.is_org_member(org_id))',tab);
 execute format('create policy tenant_insert on public.%I for insert to authenticated with check(public.can_write_org(org_id,%L))',tab,admin_only);
 execute format('create policy tenant_update on public.%I for update to authenticated using(public.can_write_org(org_id,%L)) with check(public.can_write_org(org_id,%L))',tab,admin_only,admin_only);
 execute format('create policy tenant_delete on public.%I for delete to authenticated using(public.can_write_org(org_id,%L))',tab,admin_only);
 execute format('drop trigger if exists immutable_org on public.%I',tab);
 execute format('create trigger immutable_org before update on public.%I for each row execute function public.prevent_org_move()',tab);
 end if;
 end loop;
end $$;
grant select,insert,update on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated with check(id=auth.uid());
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant select on public.organizations to authenticated;
grant update(name,slug) on public.organizations to authenticated;
create policy organizations_read on public.organizations for select to authenticated using(public.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated using(public.can_write_org(id,true)) with check(public.can_write_org(id,true));
grant select on public.memberships to authenticated;
create policy memberships_read on public.memberships for select to authenticated using(public.is_org_member(org_id));
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email)) on conflict(id) do nothing;
 return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
revoke all on function public.set_updated_at(),public.prevent_org_move(),public.lead_audit_event(),public.handle_new_user() from public;
notify pgrst,'reload schema';
commit;
