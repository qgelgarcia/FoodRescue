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

export function mergeNotificationPages(current, incoming) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id))
  );
}

export function replaceNotificationRange(current, requestedIds, refreshed) {
  const requested = new Set(requestedIds);
  return mergeNotificationPages(current.filter((item) => !requested.has(item.id)), refreshed);
}

export function isCurrentNotificationRequest(request, latestRequest, generation, activeGeneration) {
  return request === latestRequest && generation === activeGeneration;
}

export function isCurrentNotificationAction(generation, actionFilter, activeGeneration, activeFilter) {
  return generation === activeGeneration && actionFilter === activeFilter;
}
