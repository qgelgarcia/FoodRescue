import React, { useState, useEffect, useRef } from 'react';
import { notificationDestination } from '../../lib/notification-destination';
import { useHistory } from 'react-router-dom';
import { IonHeader } from '@ionic/react';
import { 
  Leaf, 
  Ticket,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowRight,
  Bell,
  MessageCircle,
  X
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

import { getMyFoodClaims } from '../../services/food';
import { getMyNotifications, markAllNotificationsRead, markNotificationRead, NOTIFICATIONS_UPDATED_EVENT, subscribeToMyNotifications } from '../../services/notifications';
import { useSharedRefresh } from '../../lib/shared-refresh';
import ProfileAvatar from '../profile/ProfileAvatar';

export default function CustomerHeader({ active, userProfile }) {
  const history = useHistory();
  const [activeClaims, setActiveClaims] = useState([]);
  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);
  const [pickupError, setPickupError] = useState('');
  const [notificationState, setNotificationState] = useState({ notifications: [], unreadCount: 0 });
  const { notifications, unreadCount } = notificationState;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationPanelPresent, setNotificationPanelPresent] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [notificationSaving, setNotificationSaving] = useState(false);
  const notificationRequest = useRef(0);
  const notificationRefreshTimer = useRef(null);
  const notificationAction = useRef(false);
  const notificationsOpenRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  useSharedRefresh(loadNotifications);

  useEffect(() => {
    setNotificationState({ notifications: [], unreadCount: 0 });
    setNotificationError('');
    if (!userProfile?.id) return undefined;
    loadNotifications();
    const refreshNotifications = () => {
      window.clearTimeout(notificationRefreshTimer.current);
      notificationRefreshTimer.current = window.setTimeout(() => loadNotifications(), 100);
    };
    const unsubscribe = subscribeToMyNotifications(userProfile.id, refreshNotifications);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshNotifications);
    return () => {
      notificationRequest.current += 1;
      window.clearTimeout(notificationRefreshTimer.current);
      unsubscribe();
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshNotifications);
    };
  }, [userProfile?.id]);

  useEffect(() => {
    loadClaims();
    const handleUpdate = () => loadClaims();
    window.addEventListener('foodrescue:claim_updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    const timer = setInterval(() => { if (!document.hidden) loadClaims(); }, 15000);
    return () => {
      window.removeEventListener('foodrescue:claim_updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      clearInterval(timer);
    };
  }, []);

  async function loadNotifications({ clearError = true } = {}) {
    const request = ++notificationRequest.current;
    try {
      const state = await getMyNotifications();
      if (request !== notificationRequest.current) return;
      setNotificationState(state);
      if (clearError) setNotificationError('');
    } catch (error) {
      if (request === notificationRequest.current) {
        setNotificationError(error.message || 'Could not load notifications.');
      }
    }
  }

  async function openNotifications() {
    const open = !notificationsOpen;
    notificationsOpenRef.current = open;
    setNotificationsOpen(open);
    if (open) {
      setNotificationPanelPresent(true);
      await loadNotifications();
    }
  }

  function closeNotifications() {
    notificationsOpenRef.current = false;
    setNotificationsOpen(false);
  }

  async function handleNotificationOpen(notification) {
    if (notificationAction.current) return;
    notificationAction.current = true;
    setNotificationSaving(true);
    let actionError;
    try {
      if (!notification.is_read) await markNotificationRead(notification.id);
    } catch (error) {
      actionError = error;
    } finally {
      await loadNotifications({ clearError: !actionError });
      notificationAction.current = false;
      setNotificationSaving(false);
      if (actionError) setNotificationError(actionError.message || 'Could not update this notification.');
    }
    const destination = notificationDestination(notification);
    if (!actionError && destination) {
      closeNotifications();
      history.push(destination.pathname, destination.state);
    }
  }

  async function handleMarkAllNotificationsRead() {
    if (notificationAction.current || unreadCount === 0) return;
    notificationAction.current = true;
    setNotificationSaving(true);
    let actionError;
    try {
      await markAllNotificationsRead();
    } catch (error) {
      actionError = error;
    } finally {
      await loadNotifications({ clearError: !actionError });
      notificationAction.current = false;
      setNotificationSaving(false);
      if (actionError) setNotificationError(actionError.message || 'Could not update notifications.');
    }
  }

  async function loadClaims() {
    try {
      const claims = await getMyFoodClaims();
      setActiveClaims(claims.filter((c) => !c.is_sample && ['pending', 'accepted'].includes(c.status) && new Date(c.expires_at).getTime() > Date.now()));
      setPickupError('');
    } catch (error) {
      setPickupError(error.message || 'Could not load your active pickup.');
    }
  }

  const latestClaim = activeClaims[0];

  return (
    <>
      <IonHeader className="member-header w-full border-b border-[#2a382e]/10 bg-white/95 backdrop-blur-md sticky top-0">
        


        {/* Main Navigation Bar */}
        <header className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          
          {/* Brand */}
          <button
            type="button"
            aria-label="Go to the FoodRescue home feed"
            className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0 border-0 bg-transparent p-0 text-left"
            onClick={() => history.push('/app/home-feed')}
          >
            <div className="size-9 rounded-2xl bg-[#2c8a38] text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
              <Leaf size={18} />
            </div>
            <div className="font-['Space_Grotesk'] text-xl font-bold tracking-tight text-[#182019]">
              Food<span className="text-[#2c8a38]">Rescue</span>
            </div>
          </button>

          <div className="flex items-center gap-3 sm:gap-4">
            <button type="button" className="member-notification-button member-chat-shortcut" aria-label="Open FoodRescue assistant" title="FoodRescue Assistant" aria-current={active === 'chat' ? 'page' : undefined} onClick={() => history.push('/app/chat')}><MessageCircle size={19} /></button>
            {/* Active Pickup Capsule */}
            {latestClaim && (
              <button 
                onClick={() => setIsPickupModalOpen(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-white border border-[#2a382e]/20 rounded-full shadow-sm hover:bg-neutral-50 transition-colors shrink-0"
              >
                <Ticket size={14} className="text-[#2c8a38] hidden sm:block" />
                <Ticket size={16} className="text-[#2c8a38] sm:hidden" />
                <span className="text-xs font-bold text-[#182019] hidden sm:inline">{latestClaim.status === 'pending' ? 'Awaiting donor' : 'Accepted pickup'}</span>
                <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            )}

            <div className="member-notification-wrap">
              <button type="button" className="member-notification-button" aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'} aria-expanded={notificationsOpen} aria-controls="member-notifications" onClick={openNotifications}>
                <Bell size={19} />
                {unreadCount > 0 && <span className="member-notification-count" aria-live="polite">{unreadCount}</span>}
              </button>
              {notificationPanelPresent && <motion.section
                id="member-notifications"
                className="member-notification-panel"
                aria-label="Your notifications"
                aria-hidden={!notificationsOpen}
                inert={notificationsOpen ? undefined : ''}
                style={{ pointerEvents: notificationsOpen ? 'auto' : 'none' }}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -8 }}
                animate={{ opacity: notificationsOpen ? 1 : 0, y: notificationsOpen || prefersReducedMotion ? 0 : -8 }}
                transition={{ duration: prefersReducedMotion ? 0.01 : 0.18, ease: 'easeOut' }}
                onAnimationComplete={() => {
                  if (!notificationsOpenRef.current) setNotificationPanelPresent(false);
                }}
              >
                <div className="member-notification-heading">
                  <strong>Notifications</strong>
                  <div className="member-notification-actions">
                    <button type="button" disabled={notificationSaving || unreadCount === 0} onClick={handleMarkAllNotificationsRead}>Read all</button>
                    <button type="button" onClick={() => loadNotifications()}>Refresh</button>
                  </div>
                </div>
                {notificationError && <p role="alert" className="member-notification-error">{notificationError}</p>}
                {notifications.length ? notifications.map((item) => <button type="button" key={item.id} disabled={notificationSaving} className={`member-notification-item ${item.is_read ? '' : 'unread'}`} onClick={() => handleNotificationOpen(item)}>
                  <span>{item.message}</span><small>{new Date(item.created_at).toLocaleString()}</small>
                </button>) : <p className="member-notification-empty">No notifications yet.</p>}
                <button type="button" className="member-notification-see-all" onClick={() => { closeNotifications(); history.push('/app/notifications'); }}>See all notifications</button>
              </motion.section>}
            </div>

            {/* Profile Pill */}
            <button
              type="button"
              aria-label="Open profile"
              onClick={() => history.push('/app/profile')}
              className="flex items-center gap-2 pl-2 sm:pl-3 py-1 cursor-pointer border-0 border-l border-[#2a382e]/10 hover:opacity-85 transition-opacity shrink-0 bg-transparent"
            >
              <ProfileAvatar avatarUrl={userProfile?.avatar_url} fullName={userProfile?.full_name} className="size-8 sm:size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-[#2c8a38]/30" imageClassName="size-full rounded-[inherit] object-cover" fallbackClassName="flex size-full items-center justify-center rounded-[inherit] bg-[#e8efe2] text-[#1c6428] text-[13px] font-bold" />
            </button>
          </div>

        </header>
      </IonHeader>

      {/* Centered Modal for Active Pickup */}
      <AnimatePresence>
        {isPickupModalOpen && latestClaim && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPickupModalOpen(false)}
              className="absolute inset-0 bg-[#182019]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 flex flex-col z-10 border border-[#2a382e]/10"
            >
              <button 
                onClick={() => setIsPickupModalOpen(false)}
                className="absolute top-4 right-4 size-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition-colors"
              >
                <X size={14} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-2xl bg-emerald-100 text-[#0c6b20] flex items-center justify-center shadow-sm shrink-0">
                  <Ticket size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#687066] uppercase tracking-wide">Food request</p>
                  <p className="text-sm font-extrabold text-[#182019]">{latestClaim.status === 'pending' ? 'Waiting for donor approval' : 'Accepted by donor'}</p>
                </div>
              </div>

              <div className="bg-[#f5faee] rounded-2xl p-4 border border-[#2a382e]/10 mb-5">
                <h4 className="font-bold text-base text-[#182019] mb-1">{latestClaim.post_title}</h4>
                <p className="text-sm text-[#4c5b4f] flex items-center gap-1.5 font-medium mb-3">
                  <MapPin size={14} className="text-[#2c8a38]" /> {latestClaim.location}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#4c5b4f]">Quantity: <b className="text-[#182019]">{latestClaim.quantity} portion(s)</b></span>
                  <span className="text-[#2c8a38] font-bold flex items-center gap-1">
                    <Clock size={14} /> {latestClaim.status === 'pending' ? 'Pending' : 'Accepted'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5">
                {pickupError && <p className="text-xs text-rose-700" role="alert">{pickupError}</p>}
                <button
                  type="button"
                  onClick={() => {
                    setIsPickupModalOpen(false);
                    history.push('/app/history');
                  }}
                  className="py-2.5 px-4 bg-[#e8efe2] text-[#182019] rounded-2xl text-sm font-bold hover:bg-[#dce6d5] transition-colors shadow-sm flex items-center justify-center"
                >
                  Details <ArrowRight size={14} className="ml-1" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
