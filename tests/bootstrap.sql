-- Somente banco de teste vazio: substitui a tabela criada pelas migrações do GoTrue.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
-- Replica os grants padrão do Supabase gerenciado para funções da API.
alter default privileges in schema public grant execute on functions to anon, authenticated;
