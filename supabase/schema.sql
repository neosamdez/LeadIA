-- LeadIA - schema inicial (Supabase/Postgres)
-- Execute no SQL Editor do Supabase. Revise antes de aplicar em produção.

create extension if not exists pgcrypto;

-- Utilitário: updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Perfis (espelha auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- Organizações
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_updated_at before update on public.organizations
for each row execute function public.set_updated_at();

-- Membros da organização
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists memberships_org_id_idx on public.memberships(org_id);
create index if not exists memberships_user_id_idx on public.memberships(user_id);

-- Leads
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references auth.users(id),
  name text not null,
  company text,
  channel text,
  status text not null default 'Novo',
  score integer not null default 0,
  interest text,
  last_message text,
  avatar text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leads_org_id_idx on public.leads(org_id);
create index if not exists leads_status_idx on public.leads(org_id, status);
create index if not exists leads_updated_at_idx on public.leads(org_id, updated_at desc);

create trigger leads_updated_at before update on public.leads
for each row execute function public.set_updated_at();

-- Conversas
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id)
);

create index if not exists conversations_org_id_idx on public.conversations(org_id);
create trigger conversations_updated_at before update on public.conversations
for each row execute function public.set_updated_at();

-- Mensagens
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  sender text not null check (sender in ('client', 'ia', 'consultor', 'system')),
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages(conversation_id, created_at);
create index if not exists messages_org_id_idx on public.messages(org_id);

-- Eventos/timeline do lead
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null,
  text text not null,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists lead_events_lead_id_idx on public.lead_events(lead_id, created_at desc);

-- Follow-ups
create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  title text not null,
  note text,
  due_at timestamptz,
  when_label text,
  status text not null default 'open' check (status in ('open', 'done', 'canceled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists follow_ups_org_id_idx on public.follow_ups(org_id, status);
create trigger follow_ups_updated_at before update on public.follow_ups
for each row execute function public.set_updated_at();

-- Metas
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  period text not null default 'monthly',
  target_leads integer not null default 0,
  target_conversion numeric(5,2) not null default 0,
  target_response_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, period)
);

create trigger goals_updated_at before update on public.goals
for each row execute function public.set_updated_at();

-- Configurações por organização
create table if not exists public.org_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  ai_enabled boolean not null default true,
  nvidia_model text,
  nvidia_proxy_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger org_settings_updated_at before update on public.org_settings
for each row execute function public.set_updated_at();

-- Helper: membership check
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = auth.uid()
  );
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.lead_events enable row level security;
alter table public.follow_ups enable row level security;
alter table public.goals enable row level security;
alter table public.org_settings enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles for select using (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles for insert with check (id = auth.uid());

-- organizations: visível para membros
create policy "orgs_select_member" on public.organizations for select using (public.is_org_member(id));
create policy "orgs_insert_authenticated" on public.organizations for insert with check (auth.uid() is not null);
create policy "orgs_update_owner_admin" on public.organizations for update
using (exists (select 1 from public.memberships m where m.org_id = id and m.user_id = auth.uid() and m.role in ('owner','admin')));

-- memberships
create policy "memberships_select_org_member" on public.memberships for select using (public.is_org_member(org_id));
create policy "memberships_insert_owner_admin" on public.memberships for insert
with check (exists (select 1 from public.memberships m where m.org_id = org_id and m.user_id = auth.uid() and m.role in ('owner','admin')) or user_id = auth.uid());

-- Tabelas com org_id
create policy "leads_org_member" on public.leads for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "conversations_org_member" on public.conversations for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "messages_org_member" on public.messages for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "lead_events_org_member" on public.lead_events for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "follow_ups_org_member" on public.follow_ups for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "goals_org_member" on public.goals for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy "org_settings_org_member" on public.org_settings for all using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- Cria profile automaticamente ao criar usuário
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
