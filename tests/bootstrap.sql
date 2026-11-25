-- Somente banco de teste vazio: substitui a tabela criada pelas migrações do GoTrue.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
