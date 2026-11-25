#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?Use somente um banco descartável terminado em _test}"
case "${TEST_DATABASE_URL%%\?*}" in */*_test) ;; *) echo 'Banco de teste deve terminar em _test' >&2; exit 1 ;; esac
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f tests/bootstrap.sql -f supabase/schema.sql -f supabase/schema.sql -f tests/database.sql
