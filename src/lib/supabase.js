import { createClient } from '@supabase/supabase-js';
import { supabaseConfig, isSupabaseConfigured } from './config';

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  return supabase;
}
