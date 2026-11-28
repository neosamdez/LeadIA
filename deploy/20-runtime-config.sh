#!/bin/sh
set -eu
: "${APP_MODE:=demo}"
: "${PUBLIC_SUPABASE_URL:=}"
: "${PUBLIC_SUPABASE_ANON_KEY:=}"
case "$APP_MODE" in demo|real) ;; *) echo 'Invalid APP_MODE' >&2; exit 1 ;; esac
case "$PUBLIC_SUPABASE_URL" in *[!a-zA-Z0-9_./:~-]*) echo 'Invalid public API URL' >&2; exit 1 ;; esac
case "$PUBLIC_SUPABASE_ANON_KEY" in *[!a-zA-Z0-9_.-]*) echo 'Invalid public anon key' >&2; exit 1 ;; esac
if [ "$APP_MODE" = real ] && [ -z "$PUBLIC_SUPABASE_ANON_KEY" ]; then
  echo 'Real mode requires PUBLIC_SUPABASE_ANON_KEY' >&2
  exit 1
fi
printf 'window.__LEADIA_CONFIG__ = {"appMode":"%s","supabaseUrl":"%s","supabaseAnonKey":"%s"};\n' \
  "$APP_MODE" "$PUBLIC_SUPABASE_URL" "$PUBLIC_SUPABASE_ANON_KEY" > /usr/share/nginx/html/config.js
