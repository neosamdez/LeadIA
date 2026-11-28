begin;
select set_config('request.jwt.claims','{}',true);
insert into auth.users(id,email) values
 ('80000000-0000-4000-8000-000000000001','wa-agent-owner@example.test'),
 ('80000000-0000-4000-8000-000000000002','wa-agent-other@example.test');
insert into public.organizations(id,created_by,name) values
 ('80000000-0000-4000-8000-000000000010','80000000-0000-4000-8000-000000000001','Empresa de teste');
insert into public.memberships(org_id,user_id,role) values
 ('80000000-0000-4000-8000-000000000010','80000000-0000-4000-8000-000000000001','owner');
insert into public.org_settings(org_id,company_name) values
 ('80000000-0000-4000-8000-000000000010','Empresa de teste');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001"}',true);
select set_config('test.wa_org','80000000-0000-4000-8000-000000000010',true);
select set_config('test.wa_instance',public.whatsapp_channel_ensure(current_setting('test.wa_org')::uuid)->>'instance',true);
select public.whatsapp_channel_set_webhook_secret(current_setting('test.wa_org')::uuid,repeat('x',43));
select public.whatsapp_channel_set_connected(current_setting('test.wa_org')::uuid,true,'open');
do $$
begin
  if public.whatsapp_set_automation(current_setting('test.wa_org')::uuid,true)->>'error' is distinct from 'agent_not_published' then
    raise exception 'Activation must require a published agent';
  end if;
  if has_function_privilege('authenticated','public.whatsapp_claim_agent()','execute')
    or has_function_privilege('authenticated','public.whatsapp_ingest_evolution(text,text,text,text,text,text,timestamptz)','execute') then
    raise exception 'Worker RPC leaked to authenticated';
  end if;
end $$;
insert into public.agents(org_id,id,draft) values
 (current_setting('test.wa_org')::uuid,'80000000-0000-4000-8000-000000000020','{"purpose":"Publicado","allowedActions":["reply"]}');
select public.publish_agent('80000000-0000-4000-8000-000000000020');
update public.agents set draft = '{"purpose":"Rascunho privado"}' where id = '80000000-0000-4000-8000-000000000020';

set local role service_role;
select public.whatsapp_ingest_evolution(current_setting('test.wa_instance'),repeat('x',43),'5586990000011',null,'pre-activation','Oi',now());
do $$
begin
  if public.whatsapp_claim_agent() is not null then raise exception 'Inactive channel queued a reply'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000002"}',true);
do $$
begin
  begin
    perform public.whatsapp_set_automation(current_setting('test.wa_org')::uuid,true);
    raise exception 'Cross-tenant activation accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('request.jwt.claims','{"sub":"80000000-0000-4000-8000-000000000001"}',true);
select public.whatsapp_set_automation(current_setting('test.wa_org')::uuid,true);
set local role service_role;
do $$
declare task jsonb; instance text := current_setting('test.wa_instance'); received timestamptz := clock_timestamp();
begin
  if public.whatsapp_ingest_evolution(instance,repeat('x',43),'5586990000011',null,'new-1','Pergunta',received) <> 'stored'
    or public.whatsapp_ingest_evolution(instance,repeat('x',43),'5586990000011',null,'new-1','Pergunta',received) <> 'duplicate' then
    raise exception 'Ingestion failed to deduplicate';
  end if;
  task := public.whatsapp_claim_agent();
  if task->'config'->>'purpose' is distinct from 'Publicado' or task->'context'->>'company_name' is distinct from 'Empresa de teste'
    or task->>'content' is distinct from 'Pergunta' then
    raise exception 'Claim missing published revision or relevant context: %', task;
  end if;
  if public.whatsapp_claim_agent() is not null then raise exception 'Message claimed twice'; end if;
  if not public.whatsapp_prepare_agent((task->>'id')::uuid,(task->>'lease_id')::uuid,'Resposta do agente',false) then
    raise exception 'Prepare failed';
  end if;
  if not public.whatsapp_finish_agent((task->>'id')::uuid,(task->>'lease_id')::uuid,'accepted','agent-reply-1') then
    raise exception 'Finish failed';
  end if;
  perform public.whatsapp_ingest_evolution(instance,repeat('x',43),'5586990000011',null,'new-2','Posso falar com alguém?',received);
  task := public.whatsapp_claim_agent();
  if not public.whatsapp_prepare_agent((task->>'id')::uuid,(task->>'lease_id')::uuid,'Vou chamar a equipe.',true) then
    raise exception 'Handoff failed';
  end if;
  perform public.whatsapp_finish_agent((task->>'id')::uuid,(task->>'lease_id')::uuid,'accepted','agent-reply-2');
  perform public.whatsapp_ingest_evolution(instance,repeat('x',43),'5586990000011',null,'new-3','Ainda aí?',received);
  if public.whatsapp_claim_agent() is not null then raise exception 'Handoff did not pause conversation'; end if;
  perform public.whatsapp_ingest_evolution(instance,repeat('x',43),'5586990000012',null,'new-4','Olá',received);
  task := public.whatsapp_claim_agent();
  if task is null then raise exception 'Handoff blocked another contact'; end if;
  perform set_config('test.wa_pending',task::text,true);
end $$;

set local role authenticated;
select public.whatsapp_set_automation(current_setting('test.wa_org')::uuid,false);
set local role service_role;
do $$
declare task jsonb := current_setting('test.wa_pending')::jsonb;
begin
  if public.whatsapp_prepare_agent((task->>'id')::uuid,(task->>'lease_id')::uuid,'Resposta atrasada',false)
    or public.whatsapp_claim_agent() is not null then raise exception 'Deactivation did not cancel pending replies'; end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.messages where provider_message_id = 'agent-reply-1'
    and sender = 'ia' and content = 'Resposta do agente') then raise exception 'Reply missing from CRM'; end if;
end $$;
rollback;
