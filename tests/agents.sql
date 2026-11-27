\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_agent(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Falha: %', label; end if;
end;
$$;

-- Executa um comando que deve ser recusado por RLS, permissão ou validação.
create function pg_temp.expect_agent_denied(statement text, label text) returns void language plpgsql as $$
declare changed integer;
begin
  begin
    execute statement;
    get diagnostics changed = row_count;
  exception when insufficient_privilege or foreign_key_violation or check_violation or unique_violation then return;
  end;
  if changed > 0 then raise exception 'Aceito indevidamente: %', label; end if;
end;
$$;

insert into auth.users(id,email) values
  ('60000000-0000-0000-0000-000000000001','ag-owner@example.test'),
  ('60000000-0000-0000-0000-000000000002','ag-member@example.test'),
  ('60000000-0000-0000-0000-000000000003','ag-viewer@example.test'),
  ('60000000-0000-0000-0000-000000000004','ag-other@example.test');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60000000-0000-0000-0000-000000000004"}',true);
select (public.get_or_create_org()).id as org_b \gset
select set_config('request.jwt.claims','{"sub":"60000000-0000-0000-0000-000000000001"}',true);
select (public.get_or_create_org()).id as org_a \gset

reset role;
insert into public.memberships(org_id,user_id,role) values
  (:'org_a','60000000-0000-0000-0000-000000000002','member'),
  (:'org_a','60000000-0000-0000-0000-000000000003','viewer');

-- Owner cria o rascunho; a autoria vem da sessão.
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"60000000-0000-0000-0000-000000000001"}',true);
insert into public.agents(org_id,draft,updated_by) values (:'org_a','{"purpose":"Atender v1"}','60000000-0000-0000-0000-000000000004')
returning id as agent_a \gset
select pg_temp.assert_agent((select updated_by = '60000000-0000-0000-0000-000000000001' from public.agents where id = :'agent_a'),'autoria do rascunho não é forjada');
select pg_temp.expect_agent_denied(format($q$insert into public.agents(org_id) values (%L)$q$, :'org_a'),'segundo agente de atendimento');
select pg_temp.expect_agent_denied(format($q$insert into public.agents(org_id,kind) values (%L,'vendas')$q$, :'org_a'),'tipo fora da lista');

-- Publicar cria a revisão 1 com o contexto da organização.
update public.org_settings set value_proposition = 'Resposta em 1h' where org_id = :'org_a';
select (public.publish_agent(:'agent_a')).id as rev1 \gset
select pg_temp.assert_agent((select number = 1 and config->>'purpose' = 'Atender v1' and context->>'value_proposition' = 'Resposta em 1h'
  and created_by = '60000000-0000-0000-0000-000000000001' from public.agent_revisions where id = :'rev1'),'revisão 1 guarda configuração e contexto');
select pg_temp.assert_agent((select published_revision_id = :'rev1'::uuid from public.agents where id = :'agent_a'),'revisão 1 publicada');

update public.agents set draft = '{"purpose":"Atender v2"}' where id = :'agent_a';
select (public.publish_agent(:'agent_a')).id as rev2 \gset
select pg_temp.assert_agent((select number = 2 from public.agent_revisions where id = :'rev2'),'revisão 2 numerada');

-- Revisões são imutáveis e a publicada não muda por update direto.
select pg_temp.expect_agent_denied(format($q$update public.agent_revisions set config = '{}' where id = %L$q$, :'rev1'),'alterar revisão');
select pg_temp.expect_agent_denied(format($q$delete from public.agent_revisions where id = %L$q$, :'rev1'),'apagar revisão');
select pg_temp.expect_agent_denied(format($q$insert into public.agent_revisions(org_id,agent_id,number,config) values (%L,%L,9,'{}')$q$, :'org_a', :'agent_a'),'inserir revisão direto');
select pg_temp.expect_agent_denied(format($q$update public.agents set published_revision_id = %L where id = %L$q$, :'rev1', :'agent_a'),'trocar publicada sem publicar');

-- Restaurar cria a revisão 3 com a configuração da 1 e mantém o histórico.
select (public.restore_agent_revision(:'rev1')).id as rev3 \gset
select pg_temp.assert_agent((select number = 3 and restored_from = :'rev1'::uuid and config->>'purpose' = 'Atender v1'
  from public.agent_revisions where id = :'rev3'),'restauração vira revisão nova');
select pg_temp.assert_agent((select published_revision_id = :'rev3'::uuid and draft->>'purpose' = 'Atender v1' from public.agents where id = :'agent_a'),'restauração atualiza publicada e rascunho');
select pg_temp.assert_agent((select count(*) = 3 from public.agent_revisions where agent_id = :'agent_a'),'histórico preservado');

-- Membro e viewer leem, mas não editam nem publicam.
select set_config('request.jwt.claims','{"sub":"60000000-0000-0000-0000-000000000002"}',true);
select pg_temp.assert_agent((select count(*) = 3 from public.agent_revisions where agent_id = :'agent_a'),'membro lê revisões');
select pg_temp.expect_agent_denied(format($q$update public.agents set draft = '{"purpose":"membro"}' where id = %L$q$, :'agent_a'),'membro edita rascunho');
select pg_temp.expect_agent_denied(format($q$select public.publish_agent(%L)$q$, :'agent_a'),'membro publica');
select set_config('request.jwt.claims','{"sub":"60000000-0000-0000-0000-000000000003"}',true);
select pg_temp.expect_agent_denied(format($q$update public.agents set draft = '{"purpose":"viewer"}' where id = %L$q$, :'agent_a'),'viewer edita rascunho');
select pg_temp.expect_agent_denied(format($q$select public.restore_agent_revision(%L)$q$, :'rev1'),'viewer restaura');

-- Organização B não lê, não edita, não publica nem restaura A.
select set_config('request.jwt.claims','{"sub":"60000000-0000-0000-0000-000000000004"}',true);
select pg_temp.assert_agent((select count(*) = 0 from public.agents where org_id = :'org_a'),'B não lê agentes de A');
select pg_temp.assert_agent((select count(*) = 0 from public.agent_revisions where org_id = :'org_a'),'B não lê revisões de A');
select pg_temp.expect_agent_denied(format($q$update public.agents set draft = '{}' where id = %L$q$, :'agent_a'),'B edita A');
select pg_temp.expect_agent_denied(format($q$select public.publish_agent(%L)$q$, :'agent_a'),'B publica A');
select pg_temp.expect_agent_denied(format($q$select public.restore_agent_revision(%L)$q$, :'rev1'),'B restaura A');
select pg_temp.expect_agent_denied(format($q$insert into public.agents(org_id) values (%L)$q$, :'org_a'),'B cria agente em A');

-- Apagar o agente leva as revisões junto.
select set_config('request.jwt.claims','{"sub":"60000000-0000-0000-0000-000000000001"}',true);
delete from public.agents where id = :'agent_a';
reset role;
select pg_temp.assert_agent((select count(*) = 0 from public.agent_revisions where agent_id = :'agent_a'),'revisões apagadas com o agente');

rollback;
do $$
begin
 if has_function_privilege('anon', 'public.publish_agent(uuid)', 'EXECUTE')
    or has_function_privilege('anon', 'public.get_or_create_org()', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.insert_agent_revision(public.agents,jsonb,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.publish_agent(uuid)', 'EXECUTE') then
  raise exception 'Permissões de execução das funções do agente estão incorretas';
 end if;
end;
$$;
