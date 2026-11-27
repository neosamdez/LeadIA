-- Contexto aprovado da organização e prioridade comercial verificável.
-- Idempotente: pode ser reaplicada pelo serviço migrate a cada deploy.
begin;
select pg_advisory_xact_lock(74038202);

alter table public.org_settings
  add column if not exists value_proposition text,
  add column if not exists audience text,
  add column if not exists offers text,
  add column if not exists language text not null default 'pt-BR',
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists business_hours text,
  add column if not exists service_restrictions text,
  add column if not exists handoff_owner_id uuid,
  add column if not exists priority text,
  add column if not exists context_updated_at timestamptz,
  add column if not exists context_updated_by uuid references auth.users(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.org_settings'::regclass and conname = 'org_settings_context_lengths') then
    alter table public.org_settings add constraint org_settings_context_lengths check (
      coalesce(length(value_proposition),0) <= 600 and coalesce(length(audience),0) <= 600
      and coalesce(length(offers),0) <= 1500 and coalesce(length(business_hours),0) <= 300
      and coalesce(length(service_restrictions),0) <= 1000);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.org_settings'::regclass and conname = 'org_settings_language_check') then
    alter table public.org_settings add constraint org_settings_language_check check (language in ('pt-BR','en','es'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.org_settings'::regclass and conname = 'org_settings_priority_check') then
    alter table public.org_settings add constraint org_settings_priority_check
      check (priority is null or priority in ('clear_overdue_followups','follow_up_new_leads'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.org_settings'::regclass and conname = 'org_settings_handoff_membership_fk') then
    alter table public.org_settings add constraint org_settings_handoff_membership_fk
      foreign key (org_id,handoff_owner_id) references public.memberships(org_id,user_id)
      on delete set null (handoff_owner_id) not valid;
  end if;
end;
$$;

-- Valida fuso e responsável e registra quem alterou o contexto.
create or replace function public.validate_org_context() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Fuso horário inválido: %', new.timezone using errcode = '22023';
  end if;
  if new.handoff_owner_id is not null and not exists (
    select 1 from public.memberships team
    where team.org_id = new.org_id and team.user_id = new.handoff_owner_id
      and team.role in ('owner','admin','member')
  ) then
    raise exception 'Quem assume conversas precisa ser membro com acesso de edição.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' or (new.value_proposition, new.audience, new.offers, new.language, new.timezone,
      new.business_hours, new.service_restrictions, new.handoff_owner_id, new.priority)
    is distinct from (old.value_proposition, old.audience, old.offers, old.language, old.timezone,
      old.business_hours, old.service_restrictions, old.handoff_owner_id, old.priority) then
    new.context_updated_at := now();
    new.context_updated_by := auth.uid();
  else
    new.context_updated_at := old.context_updated_at;
    new.context_updated_by := old.context_updated_by;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_org_context() from public;

drop trigger if exists org_context_validate on public.org_settings;
create trigger org_context_validate before insert or update on public.org_settings
for each row execute function public.validate_org_context();

notify pgrst, 'reload schema';
commit;
