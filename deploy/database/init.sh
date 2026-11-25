#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=auth_password="$AUTH_DB_PASSWORD" --set=rest_password="$REST_DB_PASSWORD" <<'SQL'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD :'rest_password';
GRANT anon, authenticated, service_role TO authenticator;
CREATE ROLE supabase_auth_admin NOINHERIT LOGIN PASSWORD :'auth_password';
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path = auth, public;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
