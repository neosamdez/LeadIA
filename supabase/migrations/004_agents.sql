-- Agentes por organização: rascunho editável e revisões publicadas imutáveis.
-- Publicar uma revisão não liga envio em canal; isso continua sendo decisão separada.
begin;
select pg_advisory_xact_lock(74038203);

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null default 'atendimento',
  name text not null default 'Atendimento',
  draft jsonb not null default '{}'::jsonb,
  published_revision_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint agents_kind_check check (kind in ('atendimento')),
  constraint agents_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint agents_draft_check check (jsonb_typeof(draft) = 'object' and pg_column_size(draft) <= 32768),
  constraint agents_org_id_key unique (org_id, id),
  -- Nesta fase, um agente de cada tipo por organização.
  constraint agents_org_kind_key unique (org_id, kind)
);

create table if not exists public.agent_revisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  agent_id uuid not null,
  number integer not null,
  config jsonb not null,
  context jsonb,
  restored_from uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint agent_revisions_agent_fk foreign key (org_id, agent_id)
    references public.agents(org_id, id) on delete cascade,
  constraint agent_revisions_number_key unique (agent_id, number),
  constraint agent_revisions_org_id_key unique (org_id, id),
  constraint agent_revisions_number_check check (number > 0),
  constraint agent_revisions_config_check check (jsonb_typeof(config) = 'object' and pg_column_size(config) <= 32768)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.agents'::regclass and conname = 'agents_published_revision_fk') then
    alter table public.agents add constraint agents_published_revision_fk
      foreign key (org_id, published_revision_id) references public.agent_revisions(org_id, id)
      on delete set null (published_revision_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.agent_revisions'::regclass and conname = 'agent_revisions_restored_fk') then
    alter table public.agent_revisions add constraint agent_revisions_restored_fk
      foreign key (org_id, restored_from) references public.agent_revisions(org_id, id);
  end if;
end;
$$;

create index if not exists agent_revisions_agent_idx on public.agent_revisions(agent_id, number desc);

-- Autoria do rascunho vem da sessão, não do cliente.
create or replace function public.stamp_agent() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then
    if new.org_id is distinct from old.org_id or new.kind is distinct from old.kind then
      raise exception 'Organização e tipo do agente não mudam.' using errcode = '42501';
    end if;
    -- A revisão publicada só muda pelas funções de publicação.
    if new.published_revision_id is distinct from old.published_revision_id
       and current_setting('leadia.agent_publish', true) is distinct from 'on' then
      raise exception 'Use publicar ou restaurar para trocar a revisão publicada.' using errcode = '42501';
    end if;
  elsif new.published_revision_id is not null then
    raise exception 'Um agente novo começa sem revisão publicada.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.stamp_agent() from public,anon,authenticated;
drop trigger if exists agents_stamp on public.agents;
create trigger agents_stamp before insert or update on public.agents
for each row execute function public.stamp_agent();

create or replace function public.agent_context_snapshot(p_org uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'company_name', s.company_name, 'segment', s.segment, 'tone', s.tone,
    'value_proposition', s.value_proposition, 'audience', s.audience, 'offers', s.offers,
    'language', s.language, 'timezone', s.timezone, 'business_hours', s.business_hours,
    'service_restrictions', s.service_restrictions, 'priority', s.priority,
    'context_updated_at', s.context_updated_at)
  from public.org_settings s where s.org_id = p_org;
$$;
revoke all on function public.agent_context_snapshot(uuid) from public,anon,authenticated;

-- Grava uma revisão nova a partir de uma configuração e a torna a publicada.
create or replace function public.insert_agent_revision(p_agent public.agents, p_config jsonb, p_restored uuid)
returns public.agent_revisions
language plpgsql security definer set search_path = '' as $$
declare rev public.agent_revisions;
begin
  if not public.can_write_org(p_agent.org_id, true) then
    raise exception 'Somente owner ou admin publicam agentes.' using errcode = '42501';
  end if;
  insert into public.agent_revisions(org_id, agent_id, number, config, context, restored_from, created_by)
  values (p_agent.org_id, p_agent.id,
    coalesce((select max(number) from public.agent_revisions where agent_id = p_agent.id), 0) + 1,
    p_config, public.agent_context_snapshot(p_agent.org_id), p_restored, auth.uid())
  returning * into rev;
  perform set_config('leadia.agent_publish', 'on', true);
  update public.agents set published_revision_id = rev.id,
    draft = case when p_restored is null then draft else p_config end
  where id = p_agent.id;
  perform set_config('leadia.agent_publish', 'off', true);
  return rev;
end;
$$;
revoke all on function public.insert_agent_revision(public.agents, jsonb, uuid) from public,anon,authenticated;

create or replace function public.publish_agent(p_agent_id uuid) returns public.agent_revisions
language plpgsql security definer set search_path = '' as $$
declare agent public.agents;
begin
  select * into agent from public.agents where id = p_agent_id for update;
  if agent.id is null or not public.is_org_member(agent.org_id) then
    raise exception 'Agente não encontrado.' using errcode = '42501';
  end if;
  return public.insert_agent_revision(agent, agent.draft, null);
end;
$$;

-- Restaurar cria uma revisão nova com a configuração antiga; o histórico fica intacto.
create or replace function public.restore_agent_revision(p_revision_id uuid) returns public.agent_revisions
language plpgsql security definer set search_path = '' as $$
declare old_rev public.agent_revisions; agent public.agents;
begin
  select * into old_rev from public.agent_revisions where id = p_revision_id;
  if old_rev.id is null or not public.is_org_member(old_rev.org_id) then
    raise exception 'Revisão não encontrada.' using errcode = '42501';
  end if;
  select * into agent from public.agents where id = old_rev.agent_id for update;
  return public.insert_agent_revision(agent, old_rev.config, old_rev.id);
end;
$$;
revoke all on function public.publish_agent(uuid), public.restore_agent_revision(uuid) from public,anon;
grant execute on function public.publish_agent(uuid), public.restore_agent_revision(uuid) to authenticated;

alter table public.agents enable row level security;
alter table public.agent_revisions enable row level security;
revoke all on public.agents, public.agent_revisions from anon, authenticated;
grant all on public.agents, public.agent_revisions to service_role;
grant select, insert, update, delete on public.agents to authenticated;
grant select on public.agent_revisions to authenticated;

drop policy if exists agents_read on public.agents;
drop policy if exists agents_insert on public.agents;
drop policy if exists agents_update on public.agents;
drop policy if exists agents_delete on public.agents;
create policy agents_read on public.agents for select to authenticated using (public.is_org_member(org_id));
create policy agents_insert on public.agents for insert to authenticated with check (public.can_write_org(org_id, true));
create policy agents_update on public.agents for update to authenticated
  using (public.can_write_org(org_id, true)) with check (public.can_write_org(org_id, true));
create policy agents_delete on public.agents for delete to authenticated using (public.can_write_org(org_id, true));

-- Revisões: leitura pela organização; escrita apenas pelas funções acima.
drop policy if exists agent_revisions_read on public.agent_revisions;
create policy agent_revisions_read on public.agent_revisions for select to authenticated using (public.is_org_member(org_id));

create or replace function public.prevent_revision_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.agents where id = old.agent_id) then
    return old; -- exclusão em cascata do agente
  end if;
  raise exception 'Revisões publicadas são imutáveis.' using errcode = '42501';
end;
$$;
revoke all on function public.prevent_revision_change() from public,anon,authenticated;
drop trigger if exists agent_revisions_immutable on public.agent_revisions;
create trigger agent_revisions_immutable before update or delete on public.agent_revisions
for each row execute function public.prevent_revision_change();

notify pgrst, 'reload schema';
commit;
