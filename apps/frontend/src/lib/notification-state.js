export async function loadNotificationSnapshot(fetchLatest, countUnread) {
  const [notifications, unreadCount] = await Promise.all([fetchLatest(), countUnread()]);
  return { notifications: notifications || [], unreadCount: unreadCount || 0 };
}

export async function markUnreadSnapshot(readUnreadIds, markReadIds) {
  const ids = await readUnreadIds();
  const changed = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    changed.push(...await markReadIds(ids.slice(offset, offset + 500)));
  }
  return changed;
}

export function applyReadSnapshot(state, readIds) {
  const read = new Set(readIds);
  return {
    notifications: state.notifications.map((item) => read.has(item.id) ? { ...item, is_read: true } : item),
    unreadCount: Math.max(0, state.unreadCount - readIds.length),
  };
}
