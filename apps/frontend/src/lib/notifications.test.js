import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNotificationsForUser,
  getNotificationPageForUser,
  getNotificationRefreshForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  NOTIFICATIONS_UPDATED_EVENT,
  subscribeToNotificationsForUser,
} from '../services/notifications.js';
import {
  applyReadSnapshot,
  isCurrentNotificationAction,
  isCurrentNotificationRequest,
  mergeNotificationPages,
  replaceNotificationRange,
} from './notification-state.js';

function memoryClient(rows, { afterSelect } = {}) {
  const calls = [];

  return {
    calls,
    from(table) {
      assert.equal(table, 'notifications');
      const query = { filters: [], action: 'select' };
      const builder = {
        select(columns, options) { query.columns = columns; query.selectOptions = options; return builder; },
        update(values) { query.action = 'update'; query.values = values; return builder; },
        eq(column, value) { query.filters.push(['eq', column, value]); return builder; },
        gt(column, value) { query.filters.push(['gt', column, value]); return builder; },
        in(column, values) { query.filters.push(['in', column, values]); return builder; },
        or(expression) {
          const match = expression.match(/^created_at\.(lt|gt)\.([^,]+),and\(created_at\.eq\.([^,]+),id\.(lt|gt)\.([^)]+)\)$/);
          assert.ok(match, `unexpected cursor filter: ${expression}`);
          query.cursor = { created_at: match[2], id: match[5], comparison: match[1] };
          query.or = expression;
          return builder;
        },
        order(column, options) { (query.orders ||= []).push([column, options]); return builder; },
        limit(value) { query.limit = value; return builder; },
        range(start, end) { query.range = [start, end]; return builder; },
        then(resolve, reject) {
          calls.push(query);
          try {
            const matches = (row) => query.filters.every(([kind, column, value]) => {
              if (kind === 'eq') return row[column] === value;
              if (kind === 'gt') return row[column] > value;
              return value.includes(row[column]);
            }) && (!query.cursor || (query.cursor.comparison === 'lt'
              ? row.created_at < query.cursor.created_at || (row.created_at === query.cursor.created_at && row.id < query.cursor.id)
              : row.created_at > query.cursor.created_at || (row.created_at === query.cursor.created_at && row.id > query.cursor.id)));
            if (query.action === 'update') {
              const changed = rows.filter(matches);
              changed.forEach((row) => Object.assign(row, query.values));
              return Promise.resolve({
                data: query.returning ? changed.map(({ id }) => ({ id })) : null,
                error: null,
              }).then(resolve, reject);
            }

            const matching = rows.filter(matches);
            if (query.selectOptions?.head) return Promise.resolve({ data: null, count: matching.length, error: null }).then(resolve, reject);
            let result = matching;
            if (query.orders?.length) {
              result = [...result].sort((a, b) => {
                for (const [column, { ascending }] of query.orders) {
                  const compared = String(a[column]).localeCompare(String(b[column]));
                  if (compared) return compared * (ascending ? 1 : -1);
                }
                return 0;
              });
            }
            if (query.range) result = result.slice(query.range[0], query.range[1] + 1);
            if (query.limit !== undefined) result = result.slice(0, query.limit);
            const data = result.map((row) => ({ ...row }));
            afterSelect?.(query, rows);
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };
      const originalSelect = builder.select;
      builder.select = (columns, options) => {
        if (query.action === 'update') query.returning = true;
        return originalSelect(columns, options);
      };
      return builder;
    },
  };
}

function realtimeClient() {
  const channels = new Map();
  const removed = [];
  return {
    channels,
    removed,
    channel(topic) {
      if (channels.has(topic)) return channels.get(topic);
      const channel = {
        subscribed: false,
        listeners: [],
        on(type, filter, callback) {
          assert.equal(channel.subscribed, false, 'callbacks must be registered before subscribe');
          channel.listeners.push({ type, filter, callback });
          return channel;
        },
        subscribe() {
          channel.subscribed = true;
          return channel;
        },
      };
      channels.set(topic, channel);
      return channel;
    },
    removeChannel(channel) { removed.push(channel); },
  };
}

function unreadRows(count, userId = 'member-1') {
  return Array.from({ length: count }, (_, index) => ({
    id: `notice-${String(index + 1).padStart(3, '0')}`,
    user_id: userId,
    message: `Notice ${index + 1}`,
    type: 'moderation_update',
    is_read: false,
    created_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  }));
}

test('notification service shows the latest 20 while counting every unread row', async () => {
  const rows = unreadRows(26);
  const client = memoryClient(rows);

  const state = await getNotificationsForUser(client, 'member-1');

  assert.equal(state.notifications.length, 20);
  assert.equal(state.unreadCount, 26);
  const listQuery = client.calls.find((call) => call.limit === 20);
  assert.deepEqual(listQuery.filters, [['eq', 'user_id', 'member-1']]);
  const countQuery = client.calls.find((call) => call.selectOptions?.head);
  assert.deepEqual(countQuery.selectOptions, { count: 'exact', head: true });
  assert.deepEqual(countQuery.filters, [['eq', 'user_id', 'member-1'], ['eq', 'is_read', false]]);
});

test('notification pages use a stable composite cursor and exclude new arrivals from older pages', async () => {
  const createdAt = new Date(Date.UTC(2026, 0, 1)).toISOString();
  const rows = Array.from({ length: 47 }, (_, index) => ({
    id: `notice-${String(index + 1).padStart(3, '0')}`,
    user_id: 'member-1',
    message: `Notice ${index + 1}`,
    type: 'moderation_update',
    is_read: false,
    created_at: createdAt,
    related_post_id: null,
  }));
  const client = memoryClient(rows);
  const expected = [...rows].sort((a, b) => b.id.localeCompare(a.id)).map(({ id }) => id);
  const first = await getNotificationPageForUser(client, 'member-1', { pageSize: 20 });
  assert.equal(first.notifications.length, 20);
  assert.equal(first.hasMore, true);

  rows.push({ ...unreadRows(1)[0], id: 'notice-new-arrival', created_at: '2026-01-02T00:00:00.000Z' });
  const pagedIds = first.notifications.map(({ id }) => id);
  let page = first;
  while (page.hasMore) {
    const last = page.notifications.at(-1);
    page = await getNotificationPageForUser(client, 'member-1', {
      pageSize: 20,
      cursor: { created_at: last.created_at, id: last.id },
    });
    pagedIds.push(...page.notifications.map(({ id }) => id));
  }

  assert.deepEqual(pagedIds, expected);
  assert.equal(new Set(pagedIds).size, pagedIds.length, 'pages contain no duplicate notification IDs');
  assert.ok(client.calls.some((call) => call.or === `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.notice-028)`));
});

test('background refresh updates the loaded range and catches every newer arrival without fetching older pages', async () => {
  const rows = unreadRows(50);
  const client = memoryClient(rows);
  const first = await getNotificationPageForUser(client, 'member-1');
  const second = await getNotificationPageForUser(client, 'member-1', {
    cursor: { created_at: first.notifications.at(-1).created_at, id: first.notifications.at(-1).id },
  });
  const loaded = [...first.notifications, ...second.notifications];
  const existingIds = loaded.map(({ id }) => id);
  const anchor = { created_at: first.notifications[0].created_at, id: first.notifications[0].id };
  const loadedTail = { created_at: second.notifications.at(-1).created_at, id: second.notifications.at(-1).id };
  rows.find(({ id }) => id === 'notice-015').is_read = true;
  rows.push(
    { ...unreadRows(1)[0], id: 'arrived-031', created_at: '2026-03-01T00:00:00.000Z' },
    { ...unreadRows(1)[0], id: 'arrived-032', created_at: '2026-03-02T00:00:00.000Z' },
  );

  const refreshed = await getNotificationRefreshForUser(client, 'member-1', {
    filter: 'all',
    existingIds,
    anchor,
  });
  const merged = mergeNotificationPages(loaded, refreshed.notifications);

  assert.equal(merged.length, 42, 'both loaded pages stay present while new arrivals are merged');
  assert.equal(merged.find(({ id }) => id === 'notice-015').is_read, true, 'loaded row updates are refreshed');
  assert.ok(merged.some(({ id }) => id === 'arrived-031'));
  assert.ok(merged.some(({ id }) => id === 'arrived-032'));
  assert.ok(!merged.some(({ id }) => id === 'notice-010'), 'older unloaded rows are left for Load more');
  assert.deepEqual(
    { created_at: merged.at(-1).created_at, id: merged.at(-1).id },
    loadedTail,
    'the loaded history tail cursor does not move when new items arrive',
  );
  assert.equal(refreshed.unreadCount, 51);
  assert.deepEqual(client.calls.find((call) => call.filters.some(([, column]) => column === 'id'))?.filters, [
    ['eq', 'user_id', 'member-1'],
    ['in', 'id', existingIds],
  ]);
  assert.ok(client.calls.some((call) => call.or === `created_at.gt.${anchor.created_at},and(created_at.eq.${anchor.created_at},id.gt.${anchor.id})`));
});

test('unread pages and unread totals remain scoped to the requested recipient', async () => {
  const rows = [
    { ...unreadRows(1)[0], id: 'own-unread' },
    { ...unreadRows(1)[0], id: 'own-read', is_read: true },
    { ...unreadRows(1, 'member-2')[0], id: 'other-unread' },
  ];
  const client = memoryClient(rows);
  const page = await getNotificationPageForUser(client, 'member-1', { filter: 'unread' });

  assert.deepEqual(page.notifications.map(({ id }) => id), ['own-unread']);
  assert.equal(page.unreadCount, 1);
  const listQuery = client.calls.find((call) => call.columns.includes('related_post_id'));
  assert.deepEqual(listQuery.filters, [['eq', 'user_id', 'member-1'], ['eq', 'is_read', false]]);
});

test('merging refreshed notification pages replaces duplicate rows without duplicating them', () => {
  const old = { id: 'notice-1', created_at: '2026-01-02', is_read: false };
  const next = { id: 'notice-1', created_at: '2026-01-02', is_read: true };
  const newer = { id: 'notice-2', created_at: '2026-01-03', is_read: false };
  const merged = mergeNotificationPages([old], [next, newer]);

  assert.deepEqual(merged, [newer, next]);
  assert.equal(merged.filter(({ id }) => id === 'notice-1').length, 1);
});

test('refresh replaces queried rows authoritatively and preserves rows loaded during the request', () => {
  const current = [
    { id: 'requested-unread', created_at: '2026-01-03', is_read: false },
    { id: 'requested-now-read', created_at: '2026-01-02', is_read: false },
    { id: 'requested-deleted', created_at: '2026-01-01', is_read: false },
    { id: 'concurrent-load-more', created_at: '2025-12-31', is_read: false },
  ];
  const refreshed = [
    { id: 'requested-unread', created_at: '2026-01-03', is_read: false },
    { id: 'new-arrival', created_at: '2026-01-04', is_read: false },
  ];

  const unread = replaceNotificationRange(
    current,
    ['requested-unread', 'requested-now-read', 'requested-deleted'],
    refreshed,
  );

  assert.deepEqual(unread.map(({ id }) => id), ['new-arrival', 'requested-unread', 'concurrent-load-more']);
  assert.ok(!unread.some(({ id }) => id === 'requested-now-read'), 'read rows disappear from Unread');
  assert.ok(!unread.some(({ id }) => id === 'requested-deleted'), 'missing rows disappear from the refreshed range');
});

test('stale page and refresh responses are rejected after a newer request or view change', () => {
  assert.equal(isCurrentNotificationRequest(2, 3, 4, 4), false);
  assert.equal(isCurrentNotificationRequest(3, 3, 4, 5), false);
  assert.equal(isCurrentNotificationRequest(3, 3, 4, 4), true);
  assert.equal(isCurrentNotificationAction(4, 'all', 5, 'unread'), false);
  assert.equal(isCurrentNotificationAction(4, 'all', 4, 'unread'), false);
  assert.equal(isCurrentNotificationAction(4, 'all', 4, 'all'), true);
});

test('read changes emit a shared refresh event only when an unread row changes', async () => {
  const originalWindow = globalThis.window;
  const events = [];
  globalThis.window = { dispatchEvent: (event) => events.push(event.type) };
  try {
    const rows = unreadRows(1);
    const client = memoryClient(rows);

    assert.equal(await markNotificationReadForUser(client, 'member-1', rows[0].id), true);
    assert.equal(await markNotificationReadForUser(client, 'member-1', rows[0].id), false);
    assert.deepEqual(events, [NOTIFICATIONS_UPDATED_EVENT]);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('header and notification center can subscribe simultaneously on distinct Realtime channels', () => {
  const client = realtimeClient();
  const changes = [];
  const unsubscribeHeader = subscribeToNotificationsForUser(client, 'member-1', () => changes.push('header'));
  const unsubscribeCenter = subscribeToNotificationsForUser(client, 'member-1', () => changes.push('center'));

  assert.equal(client.channels.size, 2);
  assert.notEqual(...client.channels.keys());
  for (const channel of client.channels.values()) {
    channel.listeners[0].callback();
    assert.deepEqual(channel.listeners[0].filter, {
      event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.member-1',
    });
  }
  assert.deepEqual(changes, ['header', 'center']);
  unsubscribeHeader();
  unsubscribeCenter();
  assert.equal(client.removed.length, 2);
});

test('read all updates only the unread ID snapshot, leaving arrivals during the update unread', async () => {
  const rows = unreadRows(26);
  let inserted = false;
  let snapshotIds = [];
  const client = memoryClient(rows, {
    afterSelect: (query, currentRows) => {
      if (!inserted && query.columns === 'id') {
        inserted = true;
        snapshotIds = currentRows.map((row) => row.id);
        currentRows.push({ ...unreadRows(1)[0], id: 'arrived-during-read-all' });
      }
    },
  });

  const readIds = await markAllNotificationsReadForUser(client, 'member-1');

  assert.equal(readIds.length, 26);
  assert.deepEqual(readIds, snapshotIds);
  assert.equal(rows.filter((row) => !row.is_read).length, 1);
  assert.equal(rows.find((row) => row.id === 'arrived-during-read-all').is_read, false);
  const update = client.calls.find((call) => call.action === 'update');
  assert.deepEqual(update.filters, [
    ['eq', 'user_id', 'member-1'],
    ['eq', 'is_read', false],
    ['in', 'id', snapshotIds],
  ]);

  const optimistic = applyReadSnapshot({
    notifications: rows.slice(0, 20).map((row) => ({ ...row, is_read: false })),
    unreadCount: 26,
  }, readIds);
  assert.equal(optimistic.unreadCount, 0, 'the helper still applies a successful read snapshot');
  assert.equal(optimistic.notifications.every((row) => row.is_read), true);

  const refreshed = await getNotificationsForUser(client, 'member-1');
  assert.equal(refreshed.unreadCount, 1, 'the arrival remains unread after refresh');
});

test('individual mark-read is recipient-scoped and only changes unread rows', async () => {
  const rows = [...unreadRows(2), { ...unreadRows(1, 'member-2')[0], id: 'other-members-notification' }];
  const client = memoryClient(rows);

  assert.equal(await markNotificationReadForUser(client, 'member-1', rows[0].id), true);
  assert.equal(rows[0].is_read, true);
  assert.equal(rows[1].is_read, false);
  assert.equal(await markNotificationReadForUser(client, 'member-1', 'other-members-notification'), false);
  assert.equal(rows[2].is_read, false, 'a member cannot mark another member’s notification read');
  assert.deepEqual(client.calls[0].filters, [
    ['eq', 'id', rows[0].id],
    ['eq', 'user_id', 'member-1'],
    ['eq', 'is_read', false],
  ]);
  assert.deepEqual(client.calls[1].filters, [
    ['eq', 'id', 'other-members-notification'],
    ['eq', 'user_id', 'member-1'],
    ['eq', 'is_read', false],
  ]);
});
