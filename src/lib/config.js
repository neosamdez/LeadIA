const runtime = globalThis.window?.__LEADIA_CONFIG__ || {};
export const APP_MODE = runtime.appMode || import.meta.env.VITE_APP_MODE || 'demo';

export const supabaseConfig = {
  url: runtime.supabaseUrl || (runtime.appMode === 'real' ? window.location.origin : '') || import.meta.env.VITE_SUPABASE_URL || '',
  anonKey: runtime.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
};

export const isSupabaseConfigured = () =>
  Boolean(supabaseConfig.url && supabaseConfig.anonKey);

export const isRealMode = () => APP_MODE === 'real';
