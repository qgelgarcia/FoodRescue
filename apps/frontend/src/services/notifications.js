import { supabase, isSupabaseConfigured } from './supabase.js';
import { loadNotificationSnapshot, markUnreadSnapshot } from '../lib/notification-state.js';

const PAGE_SIZE = 1000;
const NOTIFICATION_COLUMNS = 'id, type, message, is_read, created_at, related_post_id, related_claim_id, related_report_id';
export const NOTIFICATIONS_UPDATED_EVENT = 'foodrescue:notifications_updated';
let notificationSubscriptionSequence = 0;

function notifyReadChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

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
        .select(NOTIFICATION_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
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

export async function getMyNotificationPage(filter = 'all', cursor = null) {
  const userId = await currentUserId();
  if (!userId) return { notifications: [], unreadCount: 0, hasMore: false };
  return getNotificationPageForUser(supabase, userId, { filter, cursor });
}

export async function getNotificationPageForUser(client, userId, { filter = 'all', cursor = null, pageSize = 20 } = {}) {
  if (!['all', 'unread'].includes(filter)) throw new Error('Choose all or unread notifications.');
  if (cursor && (!cursor.created_at || !cursor.id)) throw new Error('The notification page cursor is invalid.');

  const query = client.from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('user_id', userId);
  if (filter === 'unread') query.eq('is_read', false);
  if (cursor) {
    query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  }
  const [pageResult, countResult] = await Promise.all([
    query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(pageSize + 1),
    client.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('is_read', false),
  ]);
  if (pageResult.error) throw pageResult.error;
  if (countResult.error) throw countResult.error;

  const rows = pageResult.data || [];
  return {
    notifications: rows.slice(0, pageSize),
    unreadCount: countResult.count || 0,
    hasMore: rows.length > pageSize,
  };
}

export async function getMyNotificationRefresh(filter, existingIds, anchor) {
  const userId = await currentUserId();
  if (!userId) return { notifications: [], unreadCount: 0 };
  return getNotificationRefreshForUser(supabase, userId, { filter, existingIds, anchor });
}

export async function getNotificationRefreshForUser(client, userId, { filter = 'all', existingIds = [], anchor } = {}) {
  if (!['all', 'unread'].includes(filter)) throw new Error('Choose all or unread notifications.');

  const existing = [];
  for (let offset = 0; offset < existingIds.length; offset += 500) {
    const { data, error } = await client.from('notifications').select(NOTIFICATION_COLUMNS)
      .eq('user_id', userId).in('id', existingIds.slice(offset, offset + 500));
    if (error) throw error;
    existing.push(...(data || []));
  }

  const arrivals = [];
  let cursor = anchor;
  while (cursor) {
    let query = client.from('notifications').select(NOTIFICATION_COLUMNS).eq('user_id', userId);
    if (filter === 'unread') query = query.eq('is_read', false);
    query = query.or(`created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`);
    const { data, error } = await query.order('created_at', { ascending: true })
      .order('id', { ascending: true }).limit(100);
    if (error) throw error;
    const rows = data || [];
    arrivals.push(...rows);
    if (rows.length < 100) break;
    const last = rows[rows.length - 1];
    cursor = { created_at: last.created_at, id: last.id };
  }

  const { count, error } = await client.from('notifications').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('is_read', false);
  if (error) throw error;
  const notifications = filter === 'unread' ? [...existing, ...arrivals].filter((item) => !item.is_read) : [...existing, ...arrivals];
  return { notifications, unreadCount: count || 0 };
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
  const changed = Boolean(data?.length);
  if (changed) notifyReadChange();
  return changed;
}

export async function markAllNotificationsRead() {
  const userId = await currentUserId();
  if (!userId) throw new Error('Sign in to update notifications.');
  return markAllNotificationsReadForUser(supabase, userId);
}

export async function markAllNotificationsReadForUser(client, userId) {
  const readIds = await markUnreadSnapshot(
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
  if (readIds.length) notifyReadChange();
  return readIds;
}

export function subscribeToNotificationsForUser(client, userId, onChange) {
  if (!userId) return () => {};
  const channel = client.channel(`notifications:${userId}:${++notificationSubscriptionSequence}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, onChange)
    .subscribe();
  return () => { client.removeChannel(channel); };
}

export function subscribeToMyNotifications(userId, onChange) {
  if (!userId || !isSupabaseConfigured()) return () => {};
  return subscribeToNotificationsForUser(supabase, userId, onChange);
}
