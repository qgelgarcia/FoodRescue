import { fetchWithTimeout } from './request.js';
import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
    global: { fetch: fetchWithTimeout },
    auth: { flowType: Capacitor.isNativePlatform() ? 'pkce' : 'implicit' },
  })
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key');
