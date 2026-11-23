import { supabase, requireSupabase } from '../lib/supabase';

export async function getSession() {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser() {
  const sb = requireSupabase();
  const { data: { user }, error } = await sb.auth.getUser();
  if (error) throw error;
  return user;
}

export async function signInWithPassword({ email, password }) {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp({ email, password, fullName }) {
  const sb = requireSupabase();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const sb = requireSupabase();
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChange(callback) {
  if (!supabase) return { data: { subscription: { unsubscribe() {} } } };
  return supabase.auth.onAuthStateChange(callback);
}
