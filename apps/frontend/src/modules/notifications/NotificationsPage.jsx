import LoadingState from '../../components/feedback/LoadingState';
import React, { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import PageShell from '../../components/layout/PageShell';
import {
  getMyNotificationPage,
  getMyNotificationRefresh,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_UPDATED_EVENT,
  subscribeToMyNotifications,
} from '../../services/notifications';
import {
  isCurrentNotificationAction,
  isCurrentNotificationRequest,
  mergeNotificationPages,
  replaceNotificationRange,
} from '../../lib/notification-state';
import { friendlyError } from '../../services/request';
import { notificationDestination } from '../../lib/notification-destination';
import './NotificationsPage.css';

function cursorFor(item) {
  return item ? { created_at: item.created_at, id: item.id } : null;
}

export default function NotificationsPage({ userProfile }) {
  const history = useHistory();
  const [filter, setFilter] = useState('all');
  const filterRef = useRef(filter);
  filterRef.current = filter;
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  const refreshSequence = useRef(0);
  const viewGeneration = useRef(0);
  const cursor = useRef(null);
  const anchor = useRef(null);
  const actionInProgress = useRef(false);
  const notificationsRef = useRef(notifications);
  notificationsRef.current = notifications;

  async function loadPage({ reset = false } = {}) {
    const request = ++requestSequence.current;
    const generation = viewGeneration.current;
    const pageCursor = reset ? null : cursor.current;
    if (reset) {
      cursor.current = null;
      anchor.current = null;
      setLoading(true);
      setLoadingMore(false);
      setHasMore(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const page = await getMyNotificationPage(filterRef.current, pageCursor);
      if (!isCurrentNotificationRequest(request, requestSequence.current, generation, viewGeneration.current)) return;
      setNotifications((current) => reset ? page.notifications : mergeNotificationPages(current, page.notifications));
      cursor.current = cursorFor(page.notifications.at(-1)) || pageCursor;
      if (page.notifications.length && !anchor.current) anchor.current = cursorFor(page.notifications[0]);
      setUnreadCount(page.unreadCount);
      setHasMore(page.hasMore);
      setError('');
    } catch (cause) {
      if (isCurrentNotificationRequest(request, requestSequence.current, generation, viewGeneration.current)) setError(friendlyError(cause));
    } finally {
      if (isCurrentNotificationRequest(request, requestSequence.current, generation, viewGeneration.current)) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  async function refreshCurrentRange(expectedGeneration = viewGeneration.current, expectedFilter = filterRef.current) {
    if (!isCurrentNotificationAction(expectedGeneration, expectedFilter, viewGeneration.current, filterRef.current)) return false;
    const currentRows = notificationsRef.current;
    if (!currentRows.length) return loadPage({ reset: true });
    const generation = expectedGeneration;
    const request = ++refreshSequence.current;
    const currentAnchor = anchor.current || cursorFor(currentRows[0]);
    const requestedIds = currentRows.map(({ id }) => id);

    try {
      const refreshed = await getMyNotificationRefresh(expectedFilter, requestedIds, currentAnchor);
      if (!isCurrentNotificationRequest(request, refreshSequence.current, generation, viewGeneration.current)
        || !isCurrentNotificationAction(generation, expectedFilter, viewGeneration.current, filterRef.current)) return false;
      const updates = expectedFilter === 'unread'
        ? refreshed.notifications.filter((item) => !item.is_read)
        : refreshed.notifications;
      const merged = replaceNotificationRange(currentRows, requestedIds, updates);
      setNotifications((current) => replaceNotificationRange(current, requestedIds, updates));
      if (merged.length) anchor.current = cursorFor(merged[0]);
      setUnreadCount(refreshed.unreadCount);
      if (expectedFilter === 'unread' && refreshed.unreadCount === 0) setHasMore(false);
      setError('');
      return true;
    } catch (cause) {
      if (isCurrentNotificationRequest(request, refreshSequence.current, generation, viewGeneration.current)
        && isCurrentNotificationAction(generation, expectedFilter, viewGeneration.current, filterRef.current)) setError(friendlyError(cause));
      return false;
    }
  }

  useEffect(() => {
    viewGeneration.current += 1;
    requestSequence.current += 1;
    refreshSequence.current += 1;
    setNotifications([]);
    setUnreadCount(0);
    loadPage({ reset: true });
    return () => {
      viewGeneration.current += 1;
      requestSequence.current += 1;
      refreshSequence.current += 1;
    };
  }, [filter, userProfile?.id]);

  useEffect(() => {
    if (!userProfile?.id) return undefined;
    let refreshTimer;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => refreshCurrentRange(), 100);
    };
    const unsubscribe = subscribeToMyNotifications(userProfile.id, refresh);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshCurrentRange();
    }, 15000);
    return () => {
      unsubscribe();
      window.clearTimeout(refreshTimer);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, [userProfile?.id, filter]);

  async function refreshAfterAction(actionError, generation, actionFilter) {
    if (!isCurrentNotificationAction(generation, actionFilter, viewGeneration.current, filterRef.current)) return false;
    await refreshCurrentRange(generation, actionFilter);
    if (actionError && isCurrentNotificationAction(generation, actionFilter, viewGeneration.current, filterRef.current)) {
      setError(friendlyError(actionError));
    }
    return isCurrentNotificationAction(generation, actionFilter, viewGeneration.current, filterRef.current);
  }

  async function openNotification(item) {
    if (actionInProgress.current) return;
    const actionGeneration = viewGeneration.current;
    const actionFilter = filterRef.current;
    actionInProgress.current = true;
    setSaving(true);
    let actionError;
    try {
      if (!item.is_read) await markNotificationRead(item.id);
    } catch (cause) {
      actionError = cause;
    }
    try {
      if (!isCurrentNotificationAction(actionGeneration, actionFilter, viewGeneration.current, filterRef.current)) return;
      const stillCurrent = await refreshAfterAction(actionError, actionGeneration, actionFilter);
      if (!stillCurrent || actionError) return;
      const destination = notificationDestination(item);
      if (destination) history.push(destination.pathname, destination.state);
    } finally {
      actionInProgress.current = false;
      setSaving(false);
    }
  }

  async function handleReadAll() {
    if (actionInProgress.current || unreadCount === 0) return;
    const actionGeneration = viewGeneration.current;
    const actionFilter = filterRef.current;
    actionInProgress.current = true;
    setSaving(true);
    let actionError;
    try {
      await markAllNotificationsRead();
    } catch (cause) {
      actionError = cause;
    }
    try {
      if (!isCurrentNotificationAction(actionGeneration, actionFilter, viewGeneration.current, filterRef.current)) return;
      await refreshAfterAction(actionError, actionGeneration, actionFilter);
    } finally {
      actionInProgress.current = false;
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <div className="notification-center-viewport">
        <main className="notification-center">
          <div className="notification-center-heading">
            <div>
              <div className="notification-center-eyebrow"><Bell size={14} /> YOUR ACCOUNT</div>
              <h1>Notifications</h1>
              <p>Updates about your pickups and listings.</p>
            </div>
            <div className="notification-center-toolbar">
              <button type="button" className="notification-center-action" onClick={() => refreshCurrentRange()} disabled={loading}>
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
              <button type="button" className="notification-center-action" onClick={handleReadAll} disabled={saving || unreadCount === 0}>
                <CheckCheck size={15} /> Read all
              </button>
            </div>
          </div>

          <div className="notification-center-filters" role="tablist" aria-label="Notification filter" onKeyDown={(event) => {
            if (saving || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 'all' : event.key === 'End' ? 'unread' : filter === 'all' ? 'unread' : 'all';
            setFilter(next);
            document.getElementById(`notifications-${next}-tab`)?.focus();
          }}>
            {['all', 'unread'].map((value) => (
              <button
                key={value}
                id={`notifications-${value}-tab`}
                type="button"
                role="tab"
                aria-selected={filter === value}
                tabIndex={filter === value ? 0 : -1}
                aria-controls="notification-list"
                disabled={saving}
                onClick={() => setFilter(value)}
              >
                {value === 'all' ? 'All' : `Unread${unreadCount ? ` (${unreadCount})` : ''}`}
              </button>
            ))}
          </div>

          {error && <LoadingState error={error} onRetry={() => loadPage({ reset: true })} />}

          <section id="notification-list" role="tabpanel" aria-labelledby={`notifications-${filter}-tab`} aria-busy={loading || loadingMore}>
            {loading && !notifications.length ? <LoadingState label="Loading notifications" onRetry={() => loadPage({ reset: true })} />
              : notifications.length ? <div className="notification-center-list">
                {notifications.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    disabled={saving}
                    className={`notification-center-item ${item.is_read ? '' : 'is-unread'}`}
                    onClick={() => openNotification(item)}
                    aria-label={`${item.is_read ? '' : 'Unread. '}${item.message}${notificationDestination(item) ? `. ${notificationDestination(item).label}.` : ''}`}
                  >
                    <span className="notification-center-item-copy">
                      <span>{item.message}</span>
                      <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time>
                    </span>
                    {notificationDestination(item) && <span className="notification-center-destination">{notificationDestination(item).label}</span>}
                    {!item.is_read && <span className="notification-center-unread-dot" aria-label="Unread" />}
                  </button>
                ))}
              </div>
                : <p className="notification-center-state">{filter === 'unread' ? 'You’re all caught up.' : 'No notifications yet.'}</p>}

            {hasMore && <button type="button" className="notification-center-load-more" onClick={() => loadPage()} disabled={loadingMore || loading}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>}
          </section>
        </main>
      </div>
    </PageShell>
  );
}
