import { supabase, isSupabaseConfigured } from './supabase';

export async function getMyNotifications() {
  if (!isSupabaseConfigured()) return [];
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, message, is_read, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(id) {
  if (!isSupabaseConfigured()) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Sign in to update notifications.');
  const { error } = await supabase.from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', session.user.id);
  if (error) throw error;
}
