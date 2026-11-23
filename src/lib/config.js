export const APP_MODE = import.meta.env.VITE_APP_MODE || 'demo';

export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};

export const isSupabaseConfigured = () =>
  Boolean(supabaseConfig.url && supabaseConfig.anonKey);

export const isRealMode = () => APP_MODE === 'real' && isSupabaseConfigured();
