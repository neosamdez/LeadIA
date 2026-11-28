#!/bin/sh
set -eu
: "${TEST_DATABASE_URL:?Use somente um banco descartável terminado em _test}"
case "${TEST_DATABASE_URL%%\?*}" in */*_test) ;; *) echo 'Banco de teste deve terminar em _test' >&2; exit 1 ;; esac
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f tests/bootstrap.sql -f supabase/schema.sql -f supabase/schema.sql -f tests/database.sql \
  -f supabase/migrations/001_whatsapp.sql -f supabase/migrations/001_whatsapp.sql \
  -f supabase/migrations/006_evolution_whatsapp.sql -f supabase/migrations/006_evolution_whatsapp.sql \
  -f supabase/migrations/007_whatsapp_connection.sql -f supabase/migrations/007_whatsapp_connection.sql \
  -f tests/whatsapp.sql \
  -f supabase/migrations/002_lead_assignment.sql -f supabase/migrations/002_lead_assignment.sql -f tests/lead_assignment.sql -f tests/analytics.sql \
  -f supabase/migrations/003_org_context.sql -f supabase/migrations/003_org_context.sql -f tests/org_context.sql \
  -f supabase/migrations/004_agents.sql -f supabase/migrations/004_agents.sql -f tests/agents.sql \
  -f supabase/migrations/005_ad_integrations.sql -f supabase/migrations/005_ad_integrations.sql -f tests/ad_integrations.sql
node --test tests/whatsapp.test.mjs tests/analytics-period.test.mjs tests/today-queue.test.mjs tests/agent-sim.test.mjs tests/ad-integrations.test.mjs
