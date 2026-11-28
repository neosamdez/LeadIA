-- Reuse leads.owner_id. Keep historical rows readable while checking new assignments.
begin;
select pg_advisory_xact_lock(74038201);

drop policy if exists profiles_teammates_read on public.profiles;
create policy profiles_teammates_read on public.profiles for select to authenticated
using (exists (
  select 1 from public.memberships team
  where team.user_id = profiles.id and public.is_org_member(team.org_id)
));

create or replace function public.list_lead_assignees(p_org_id uuid)
returns table(user_id uuid, role text, full_name text)
language sql stable security invoker set search_path = '' as $$
  select team.user_id, team.role, profiles.full_name
  from public.memberships team left join public.profiles profiles on profiles.id = team.user_id
  where team.org_id = p_org_id and public.is_org_member(p_org_id)
  order by team.created_at, team.user_id;
$$;
revoke all on function public.list_lead_assignees(uuid) from public,anon;
grant execute on function public.list_lead_assignees(uuid) to authenticated;

create index if not exists leads_org_owner_idx on public.leads(org_id,owner_id)
where owner_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leads'::regclass and conname = 'leads_owner_membership_fk'
  ) then
    alter table public.leads add constraint leads_owner_membership_fk
      foreign key (org_id,owner_id) references public.memberships(org_id,user_id)
      on delete set null (owner_id) not valid;
  end if;
end;
$$;

create or replace function public.validate_lead_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from public.memberships team
    where team.org_id = new.org_id and team.user_id = new.owner_id
      and team.role in ('owner','admin','member')
  ) then
    raise exception 'O responsável precisa ser um membro com acesso de edição à organização.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.audit_lead_owner() returns trigger
language plpgsql set search_path = '' as $$
begin
  insert into public.lead_events(org_id,lead_id,type,text,meta,created_by)
  values(new.org_id,new.id,'assignment',
    case when new.owner_id is null then 'Responsável removido' else 'Responsável atualizado' end,
    jsonb_build_object('previous_owner',old.owner_id,'owner',new.owner_id), auth.uid());
  return new;
end;
$$;

revoke all on function public.validate_lead_owner(), public.audit_lead_owner() from public,anon,authenticated;

drop trigger if exists lead_owner_validate on public.leads;
create trigger lead_owner_validate before insert or update of owner_id on public.leads
for each row execute function public.validate_lead_owner();

drop trigger if exists lead_owner_audit on public.leads;
create trigger lead_owner_audit after update of owner_id on public.leads
for each row when (old.owner_id is distinct from new.owner_id)
execute function public.audit_lead_owner();

notify pgrst, 'reload schema';
commit;
