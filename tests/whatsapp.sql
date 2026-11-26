\set ON_ERROR_STOP on
begin;

insert into auth.users (id,email) values
 ('00000000-0000-4000-8000-000000000011','wa-a@example.test'),
 ('00000000-0000-4000-8000-000000000012','wa-b@example.test');
insert into public.organizations (id,created_by,name) values
 ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000011','WA A'),
 ('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000012','WA B');
insert into public.memberships (org_id,user_id,role) values
 ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000011','owner'),
 ('00000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000012','owner');
insert into whatsapp_private.channels (id,org_id,phone_number_id,recipients,enabled) values
 ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000021','101',array['15550000101'],true),
 ('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000022','102',array['15550000101'],true);

set local role leadia_whatsapp;
select set_config('request.jwt.claims','{"channel_id":"00000000-0000-4000-8000-000000000031"}',true);
do $$
declare
  task record;
  second_task record;
  item text;
begin
  if has_table_privilege(current_user,'public.leads','select') then raise exception 'Worker can read CRM tables'; end if;
  if public.whatsapp_ingest('102','15550000101','QA','other-channel','Oi',now()) <> 'ignored'
    or public.whatsapp_ingest('101','15550000102','QA','other-contact','Oi',now()) <> 'ignored'
    then raise exception 'Unexpected channel or recipient accepted'; end if;
  if public.whatsapp_ingest('101','15550000101','QA','incoming-1','Oi, tenho interesse',now()) <> 'stored'
    or public.whatsapp_ingest('101','15550000101','QA','incoming-1','Oi, tenho interesse',now()) <> 'duplicate'
    then raise exception 'Ingest not idempotent'; end if;
  select * into strict task from public.whatsapp_claim();
  if task.status <> 'Novo' or task.content <> 'Oi, tenho interesse' then raise exception 'Missing first message'; end if;
  if not public.whatsapp_prepare(task.id,task.lease_id,'Olá!', 'interest',null,'rules') then raise exception 'Prepare failed'; end if;
  if not public.whatsapp_finish(task.id,'uncertain',null,task.lease_id)
    or exists (select 1 from public.whatsapp_claim()) then raise exception 'Uncertain job requeued'; end if;
  perform set_config('request.jwt.claims','{"channel_id":"00000000-0000-4000-8000-000000000032"}',true);
  if public.whatsapp_finish(task.id,'delivered','outgoing-1') then raise exception 'Another channel can finish the job'; end if;
  perform set_config('request.jwt.claims','{"channel_id":"00000000-0000-4000-8000-000000000031"}',true);
  if not public.whatsapp_finish(task.id,'delivered','outgoing-1')
    or not public.whatsapp_finish(task.id,'sent','outgoing-1')
    or not public.whatsapp_finish(null,'read','outgoing-1') then raise exception 'Could not reconcile provider delivery'; end if;

  perform public.whatsapp_ingest('101','15550000101','QA','incoming-2','Preciso viajar até sexta, para três pessoas',now());
  perform public.whatsapp_ingest('101','15550000101','QA','incoming-3','Pode mandar uma proposta?',now());
  select * into strict task from public.whatsapp_claim();
  if task.status <> 'Em atendimento' or exists (select 1 from public.whatsapp_claim()) then raise exception 'Jobs not serialized'; end if;
  if not public.whatsapp_prepare(task.id,task.lease_id,'Anotei.', 'qualify','Viagem · sexta','claude','qualify') then raise exception 'Qualification failed'; end if;
  perform public.whatsapp_finish(task.id,'accepted','outgoing-2',task.lease_id);
  select * into strict second_task from public.whatsapp_claim();
  if second_task.status <> 'Qualificado' then raise exception 'Qualification not persisted'; end if;
  perform public.whatsapp_prepare(second_task.id,second_task.lease_id,'Registrei o pedido.', 'proposal',null,'rules');
  perform public.whatsapp_finish(second_task.id,'accepted','outgoing-3',second_task.lease_id);

  for step in 4..5 loop
    item := step::text;
    perform public.whatsapp_ingest('101','15550000101','QA','incoming-'||item,'Está caro, pode me chamar amanhã?',now());
    select * into strict task from public.whatsapp_claim();
    perform public.whatsapp_prepare(task.id,task.lease_id,'A equipe retoma amanhã.', 'follow_up',null,'claude_fallback');
    perform public.whatsapp_finish(task.id,'accepted','outgoing-'||item,task.lease_id);
  end loop;

  perform public.whatsapp_ingest('101','15550000101','QA','incoming-6','Quero falar com uma pessoa',now());
  select * into strict task from public.whatsapp_claim();
  perform public.whatsapp_prepare(task.id,task.lease_id,'Vou encaminhar.', 'human',null,'rules');
  perform public.whatsapp_finish(task.id,'accepted','outgoing-6',task.lease_id);
  perform public.whatsapp_ingest('101','15550000101','QA','incoming-7','Ainda está aí?',now());
  if exists (select 1 from public.whatsapp_claim()) then raise exception 'Paused chat responded'; end if;
end $$;
reset role;

do $$
declare
  org constant uuid := '00000000-0000-4000-8000-000000000021';
  lead public.leads;
begin
  select * into strict lead from public.leads where org_id = org and external_id = 'whatsapp:15550000101';
  if lead.status <> 'Qualificado' or not lead.whatsapp_paused or lead.interest <> 'Viagem · sexta'
    then raise exception 'Lead state incorrect'; end if;
  if (select count(*) from public.messages where lead_id = lead.id) <> 13
    or (select count(*) from public.conversations where lead_id = lead.id) <> 1
    or (select count(*) from public.follow_ups where lead_id = lead.id and due_at is not null) <> 1
    or not exists (select 1 from public.lead_events where lead_id = lead.id and meta->>'model_intent' = 'qualify')
    or not exists (select 1 from public.messages where provider_message_id = 'outgoing-1' and meta->>'delivery' = 'read')
    then raise exception 'Incorrect CRM persistence or missing delivery receipt'; end if;
  if has_function_privilege('anon','public.whatsapp_claim()','execute')
    or has_function_privilege('authenticated','public.whatsapp_claim()','execute')
    or has_function_privilege('authenticated','public.whatsapp_ingest(text,text,text,text,text,timestamptz)','execute')
    or has_function_privilege('leadia_whatsapp','public.set_whatsapp_pause(uuid,boolean)','execute')
    then raise exception 'Unexpected function grants'; end if;
end $$;

select id as test_lead from public.leads
where org_id = '00000000-0000-4000-8000-000000000021' and external_id = 'whatsapp:15550000101' \gset
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000012"}',true);
select set_config('test.whatsapp_lead', :'test_lead', true);
do $$
begin
  perform public.set_whatsapp_pause(current_setting('test.whatsapp_lead')::uuid,false);
  raise exception 'Other tenant could resume automation';
exception when insufficient_privilege then null;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000011"}',true);
select public.set_whatsapp_pause(:'test_lead', false);
reset role;

set local role leadia_whatsapp;
select set_config('request.jwt.claims','{"channel_id":"00000000-0000-4000-8000-000000000031"}',true);
do $$
begin
  if exists (select 1 from public.whatsapp_claim()) then raise exception 'Resuming sent old messages'; end if;
  perform public.whatsapp_ingest('101','15550000101','QA','expired','Mensagem antiga',now() - interval '25 hours');
  if exists (select 1 from public.whatsapp_claim()) then raise exception 'Expired message queued'; end if;
  perform public.whatsapp_ingest('101','15550000101','QA','resumed','Oi, voltei',now());
  if not exists (select 1 from public.whatsapp_claim() where content = 'Oi, voltei') then raise exception 'Resume failed'; end if;
end $$;
rollback;
