import { supabase, isSupabaseConfigured } from './supabase.js';
import { loadNotificationSnapshot, markUnreadSnapshot } from '../lib/notification-state.js';

const PAGE_SIZE = 1000;

async function currentUserId() {
  if (!isSupabaseConfigured()) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

export async function getMyNotifications() {
  const userId = await currentUserId();
  if (!userId) return { notifications: [], unreadCount: 0 };
  return getNotificationsForUser(supabase, userId);
}

export async function getNotificationsForUser(client, userId) {
  return loadNotificationSnapshot(
    async () => {
      const { data, error } = await client
        .from('notifications')
        .select('id, type, message, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    async () => {
      const { count, error } = await client
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (error) throw error;
      return count || 0;
    }
  );
}

export async function markNotificationRead(id) {
  const userId = await currentUserId();
  if (!userId) throw new Error('Sign in to update notifications.');
  return markNotificationReadForUser(supabase, userId, id);
}

export async function markNotificationReadForUser(client, userId, id) {
  const { data, error } = await client.from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_read', false)
    .select('id');
  if (error) throw error;
  return Boolean(data?.length);
}

export async function markAllNotificationsRead() {
  const userId = await currentUserId();
  if (!userId) throw new Error('Sign in to update notifications.');
  return markAllNotificationsReadForUser(supabase, userId);
}

export async function markAllNotificationsReadForUser(client, userId) {
  return markUnreadSnapshot(
    async () => {
      const ids = [];
      let lastId = null;
      for (;;) {
        let query = client.from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('is_read', false)
          .order('id', { ascending: true })
          .limit(PAGE_SIZE);
        if (lastId) query = query.gt('id', lastId);
        const { data, error } = await query;
        if (error) throw error;
        const rows = data || [];
        ids.push(...rows.map((row) => row.id));
        if (rows.length < PAGE_SIZE) break;
        lastId = rows[rows.length - 1].id;
      }
      return ids;
    },
    async (ids) => {
      const { data, error } = await client.from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .in('id', ids)
        .select('id');
      if (error) throw error;
      return (data || []).map((row) => row.id);
    }
  );
}

export function subscribeToMyNotifications(userId, onChange) {
  if (!userId || !isSupabaseConfigured()) return () => {};
  const channel = supabase.channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
