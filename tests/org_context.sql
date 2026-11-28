\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_context(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Falha: %', label; end if;
end;
$$;

-- Executa um comando que deve ser recusado; aceita recusa por RLS, permissão ou validação.
create function pg_temp.expect_context_denied(statement text, label text) returns void language plpgsql as $$
declare changed integer;
begin
  begin
    execute statement;
    get diagnostics changed = row_count;
  exception when insufficient_privilege or foreign_key_violation or check_violation or invalid_parameter_value then return;
  end;
  if changed > 0 then raise exception 'Aceito indevidamente: %', label; end if;
end;
$$;

insert into auth.users(id,email) values
  ('50000000-0000-0000-0000-000000000001','ctx-owner@example.test'),
  ('50000000-0000-0000-0000-000000000002','ctx-member@example.test'),
  ('50000000-0000-0000-0000-000000000003','ctx-viewer@example.test'),
  ('50000000-0000-0000-0000-000000000004','ctx-other@example.test');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"50000000-0000-0000-0000-000000000004"}',true);
select (public.get_or_create_org()).id as org_b \gset
select set_config('request.jwt.claims','{"sub":"50000000-0000-0000-0000-000000000001"}',true);
select (public.get_or_create_org()).id as org_a \gset

reset role;
insert into public.memberships(org_id,user_id,role) values
  (:'org_a','50000000-0000-0000-0000-000000000002','member'),
  (:'org_a','50000000-0000-0000-0000-000000000003','viewer');

set local role authenticated;
select pg_temp.assert_context((select timezone = 'America/Sao_Paulo' and language = 'pt-BR' from public.org_settings where org_id = :'org_a'),'padrões de idioma e fuso');

update public.org_settings set value_proposition = 'Atendimento em até 1h', priority = 'clear_overdue_followups',
  handoff_owner_id = '50000000-0000-0000-0000-000000000002', timezone = 'America/Fortaleza'
where org_id = :'org_a';
select pg_temp.assert_context((select context_updated_by = '50000000-0000-0000-0000-000000000001' and context_updated_at is not null
  from public.org_settings where org_id = :'org_a'),'autoria do contexto registrada');

select pg_temp.expect_context_denied(format($q$update public.org_settings set timezone = 'Mars/Base' where org_id = %L$q$, :'org_a'),'fuso inválido');
select pg_temp.expect_context_denied(format($q$update public.org_settings set priority = 'vender_mais' where org_id = %L$q$, :'org_a'),'prioridade fora da lista');
select pg_temp.expect_context_denied(format($q$update public.org_settings set handoff_owner_id = '50000000-0000-0000-0000-000000000003' where org_id = %L$q$, :'org_a'),'viewer não assume conversas');
select pg_temp.expect_context_denied(format($q$update public.org_settings set handoff_owner_id = '50000000-0000-0000-0000-000000000004' where org_id = %L$q$, :'org_a'),'pessoa de outra organização');
select pg_temp.expect_context_denied(format($q$update public.org_settings set audience = repeat('x', 601) where org_id = %L$q$, :'org_a'),'texto acima do limite');

-- Membro comum e viewer não alteram configurações; organização B não lê nem altera A.
select set_config('request.jwt.claims','{"sub":"50000000-0000-0000-0000-000000000002"}',true);
select pg_temp.expect_context_denied(format($q$update public.org_settings set audience = 'membro' where org_id = %L$q$, :'org_a'),'membro altera contexto');
select set_config('request.jwt.claims','{"sub":"50000000-0000-0000-0000-000000000003"}',true);
select pg_temp.expect_context_denied(format($q$update public.org_settings set audience = 'viewer' where org_id = %L$q$, :'org_a'),'viewer altera contexto');
select pg_temp.assert_context((select value_proposition = 'Atendimento em até 1h' from public.org_settings where org_id = :'org_a'),'viewer lê o contexto');
select set_config('request.jwt.claims','{"sub":"50000000-0000-0000-0000-000000000004"}',true);
select pg_temp.assert_context((select count(*) = 0 from public.org_settings where org_id = :'org_a'),'organização B não lê A');
select pg_temp.expect_context_denied(format($q$update public.org_settings set audience = 'invasor' where org_id = %L$q$, :'org_a'),'organização B altera A');

-- Alterar só a configuração geral preserva a autoria do contexto.
select set_config('request.jwt.claims','{"sub":"50000000-0000-0000-0000-000000000001"}',true);
select context_updated_at as stamp from public.org_settings where org_id = :'org_a' \gset
update public.org_settings set tone = 'Formal', context_updated_by = '50000000-0000-0000-0000-000000000004',
  context_updated_at = now() + interval '1 day' where org_id = :'org_a';
select pg_temp.assert_context((select context_updated_by = '50000000-0000-0000-0000-000000000001'
  and context_updated_at = :'stamp'::timestamptz from public.org_settings where org_id = :'org_a'),'tom não altera nem forja a autoria do contexto');

-- Remover o responsável da organização limpa quem assume conversas.
reset role;
delete from public.memberships where org_id = :'org_a' and user_id = '50000000-0000-0000-0000-000000000002';
select pg_temp.assert_context((select handoff_owner_id is null from public.org_settings where org_id = :'org_a'),'saída do membro limpa o responsável');

rollback;
