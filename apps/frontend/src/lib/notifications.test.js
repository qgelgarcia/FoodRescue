import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from '../services/notifications.js';
import { applyReadSnapshot } from './notification-state.js';

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
        order(column, options) { query.order = [column, options]; return builder; },
        limit(value) { query.limit = value; return builder; },
        range(start, end) { query.range = [start, end]; return builder; },
        then(resolve, reject) {
          calls.push(query);
          try {
            const matches = (row) => query.filters.every(([kind, column, value]) => {
              if (kind === 'eq') return row[column] === value;
              if (kind === 'gt') return row[column] > value;
              return value.includes(row[column]);
            });
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
            if (query.order) {
              const [column, { ascending }] = query.order;
              result = [...result].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
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
  assert.equal(optimistic.unreadCount, 0, 'successful Read all clears the badge before refresh reconciles');
  assert.equal(optimistic.notifications.every((row) => row.is_read), true);

  const refreshed = await getNotificationsForUser(client, 'member-1');
  assert.equal(refreshed.unreadCount, 1, 'the arrival remains unread after refresh');
});

test('individual mark-read is recipient-scoped and only changes unread rows', async () => {
  const rows = unreadRows(2);
  const client = memoryClient(rows);

  assert.equal(await markNotificationReadForUser(client, 'member-1', rows[0].id), true);
  assert.equal(rows[0].is_read, true);
  assert.equal(rows[1].is_read, false);
  assert.deepEqual(client.calls[0].filters, [
    ['eq', 'id', rows[0].id],
    ['eq', 'user_id', 'member-1'],
    ['eq', 'is_read', false],
  ]);
});
