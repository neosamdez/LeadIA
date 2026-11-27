-- Integrações de anúncios e rastreamento por organização (Meta, Google, TikTok).
-- Guarda só identificadores públicos e preferências. Tokens e segredos nunca ficam aqui:
-- a conexão OAuth roda no servidor e só ele marca uma integração como conectada.
begin;
select pg_advisory_xact_lock(74038204);

create table if not exists public.ad_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  external_id text not null,
  display_name text,
  status text not null default 'aguardando_credenciais',
  settings jsonb not null default '{}'::jsonb,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_integrations_provider_check check (provider in ('meta_ads','meta_pixel','google_ads','ga4','gtm','tiktok_ads','tiktok_pixel')),
  constraint ad_integrations_status_check check (status in ('aguardando_credenciais','conectado','erro','desconectado')),
  constraint ad_integrations_name_check check (display_name is null or char_length(display_name) <= 120),
  constraint ad_integrations_settings_check check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) <= 8192),
  -- Formatos dos identificadores públicos de cada plataforma.
  constraint ad_integrations_external_id_check check (case provider
    when 'meta_ads' then external_id ~ '^act_[0-9]{5,20}$'
    when 'meta_pixel' then external_id ~ '^[0-9]{10,20}$'
    when 'google_ads' then external_id ~ '^[0-9]{3}-[0-9]{3}-[0-9]{4}$'
    when 'ga4' then external_id ~ '^G-[A-Z0-9]{6,12}$'
    when 'gtm' then external_id ~ '^GTM-[A-Z0-9]{5,10}$'
    when 'tiktok_ads' then external_id ~ '^[0-9]{10,20}$'
    when 'tiktok_pixel' then external_id ~ '^[A-Z0-9]{15,25}$'
  end),
  constraint ad_integrations_unique unique (org_id, provider, external_id)
);

-- Pelo cliente só se cadastra (aguardando credenciais) ou desliga. Conectar e registrar erro é do servidor.
create or replace function public.guard_ad_integration() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := auth.uid(); end if;
  if tg_op = 'UPDATE' and (new.org_id is distinct from old.org_id or new.provider is distinct from old.provider
     or new.external_id is distinct from old.external_id) then
    raise exception 'Plataforma e identificador não mudam; cadastre outra integração.' using errcode = '42501';
  end if;
  if current_user = 'authenticated' then
    if new.status not in ('aguardando_credenciais', 'desconectado')
       and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      raise exception 'Somente o servidor marca a integração como conectada.' using errcode = '42501';
    end if;
    -- A mensagem de erro vem só do servidor.
    new.last_error := case when tg_op = 'UPDATE' then old.last_error end;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_ad_integration() from public;
drop trigger if exists ad_integrations_guard on public.ad_integrations;
create trigger ad_integrations_guard before insert or update on public.ad_integrations
for each row execute function public.guard_ad_integration();

alter table public.ad_integrations enable row level security;
revoke all on public.ad_integrations from anon, authenticated;
grant all on public.ad_integrations to service_role;
grant select, insert, update, delete on public.ad_integrations to authenticated;

drop policy if exists ad_integrations_read on public.ad_integrations;
drop policy if exists ad_integrations_insert on public.ad_integrations;
drop policy if exists ad_integrations_update on public.ad_integrations;
drop policy if exists ad_integrations_delete on public.ad_integrations;
create policy ad_integrations_read on public.ad_integrations for select to authenticated using (public.is_org_member(org_id));
create policy ad_integrations_insert on public.ad_integrations for insert to authenticated with check (public.can_write_org(org_id, true));
create policy ad_integrations_update on public.ad_integrations for update to authenticated
  using (public.can_write_org(org_id, true)) with check (public.can_write_org(org_id, true));
create policy ad_integrations_delete on public.ad_integrations for delete to authenticated using (public.can_write_org(org_id, true));

notify pgrst, 'reload schema';
commit;
