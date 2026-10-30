import React, { useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { MapPin, Navigation, Square } from 'lucide-react';
import {
  isJourneySharingActive,
  publishJourneyLocation,
  startJourneySharing,
  stopJourneySharing,
} from '../../services/journey';

const PUBLISH_INTERVAL_MS = 10000;
const LOCATION_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 };

function currentPosition() {
  if (Capacitor.isNativePlatform()) return Geolocation.getCurrentPosition(LOCATION_OPTIONS);
  if (!navigator.geolocation) return Promise.reject(new Error('Location services are not available on this device.'));
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    resolve,
    reject,
    LOCATION_OPTIONS,
  ));
}

function coordinates(position) {
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

function stopMessage(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (error?.code === 1 || /denied|permission/.test(message)) {
    return 'Location permission was denied. The donor has already been notified, and you can still complete pickup.';
  }
  if (/unavailable|not available|disabled/.test(message)) {
    return 'Location is unavailable right now. The donor has already been notified, and you can still complete pickup.';
  }
  if (/timeout|timed out/.test(message)) {
    return 'Finding your location took too long. The donor has already been notified; try sharing again when GPS is available.';
  }
  return 'We could not share your location. The donor has already been notified, and pickup is still available.';
}

export default function ClaimantJourneyControls({ claim, busyAction, onOnMyWay }) {
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sharingStatusLoaded, setSharingStatusLoaded] = useState(false);
  const [sharingActive, setSharingActive] = useState(false);
  const [watching, setWatching] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const sequence = useRef(0);
  const lastPublishedAt = useRef(0);
  const watcher = useRef(null);
  const watcherActive = useRef(false);
  const mounted = useRef(false);
  const foreground = useRef(false);
  const operationGeneration = useRef(0);
  const actionBusy = Boolean(busyAction) || busy;

  function isCurrentOperation(generation) {
    return mounted.current && foreground.current && operationGeneration.current === generation;
  }

  useEffect(() => {
    let active = true;
    isJourneySharingActive(claim.id)
      .then((isActive) => { if (active) setSharingActive(Boolean(isActive)); })
      .catch(() => { if (active) setError('Could not check your current sharing status. Refresh your claims and try again.'); })
      .finally(() => { if (active) setSharingStatusLoaded(true); });
    return () => { active = false; };
  }, [claim.id]);

  async function stopWatcher(updateUi = true) {
    watcherActive.current = false;
    const current = watcher.current;
    watcher.current = null;
    if (updateUi && mounted.current) setWatching(false);
    if (!current) return;
    try {
      if (current.native) await Geolocation.clearWatch({ id: current.id });
      else navigator.geolocation.clearWatch(current.id);
    } catch {
      // The operating system may already have removed a native watcher.
    }
  }

  useEffect(() => {
    let disposed = false;
    let appStateListener;
    mounted.current = true;
    foreground.current = document.visibilityState === 'visible';
    const pauseWhenHidden = () => {
      foreground.current = document.visibilityState === 'visible';
      if (!foreground.current) {
        operationGeneration.current += 1;
        stopWatcher();
      }
    };

    document.addEventListener('visibilitychange', pauseWhenHidden);
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', ({ isActive }) => {
        foreground.current = isActive && document.visibilityState === 'visible';
        if (!foreground.current) {
          operationGeneration.current += 1;
          stopWatcher();
        }
      }).then((listener) => {
        if (disposed) listener.remove();
        else appStateListener = listener;
      }).catch(() => {});
      App.getState().then(({ isActive }) => {
        if (!disposed) {
          foreground.current = isActive && document.visibilityState === 'visible';
          if (!foreground.current) {
            operationGeneration.current += 1;
            stopWatcher();
          }
        }
      }).catch(() => {});
    }

    return () => {
      disposed = true;
      mounted.current = false;
      foreground.current = false;
      operationGeneration.current += 1;
      document.removeEventListener('visibilitychange', pauseWhenHidden);
      appStateListener?.remove();
      stopWatcher(false);
    };
  }, []);

  function handleLocationUpdate(position, token, generation) {
    if (!position || !watcherActive.current || !isCurrentOperation(generation)) return;
    const now = Date.now();
    if (now - lastPublishedAt.current < PUBLISH_INTERVAL_MS) return;
    lastPublishedAt.current = now;
    const nextSequence = ++sequence.current;
    publishJourneyLocation(claim.id, token, nextSequence, coordinates(position))
      .then((published) => {
        if (!isCurrentOperation(generation)) return;
        if (!published && watcherActive.current) {
          stopWatcher();
          setSharingActive(false);
          setMessage('Location sharing ended because this pickup is no longer open.');
        }
      })
      .catch(() => {
        if (isCurrentOperation(generation)) setError('A location update could not reach the server. The donor can still see your last successful update.');
      });
  }

  async function startWatcher(token, generation) {
    if (!isCurrentOperation(generation)) return false;
    watcherActive.current = true;
    if (mounted.current) setWatching(true);
    setError('');
    const callback = (position, watchError) => {
      if (!isCurrentOperation(generation)) return;
      if (watchError) {
        setError('GPS stopped returning updates. The donor can still see your last successful location.');
        return;
      }
      handleLocationUpdate(position, token, generation);
    };

    if (Capacitor.isNativePlatform()) {
      const id = await Geolocation.watchPosition({ ...LOCATION_OPTIONS, interval: PUBLISH_INTERVAL_MS }, callback);
      if (watcherActive.current && isCurrentOperation(generation)) watcher.current = { id, native: true };
      else await Geolocation.clearWatch({ id });
      return watcherActive.current && isCurrentOperation(generation);
    }

    if (!navigator.geolocation) throw new Error('Location services are not available on this device.');
    const id = navigator.geolocation.watchPosition(callback, (watchError) => {
      if (isCurrentOperation(generation)) setError(stopMessage(watchError));
    }, LOCATION_OPTIONS);
    if (watcherActive.current && isCurrentOperation(generation)) watcher.current = { id, native: false };
    else navigator.geolocation.clearWatch(id);
    return watcherActive.current && isCurrentOperation(generation);
  }

  async function beginSharing() {
    if (!consent && !sharingActive) return;
    if (!mounted.current || !foreground.current) {
      setError('Open the app to start foreground location sharing.');
      return;
    }
    const generation = ++operationGeneration.current;
    setBusy(true);
    setError('');
    setMessage('');
    let position;
    try {
      position = await currentPosition();
    } catch (cause) {
      if (mounted.current) setError(stopMessage(cause));
      if (mounted.current) setBusy(false);
      return;
    }
    if (!isCurrentOperation(generation)) {
      if (mounted.current) setBusy(false);
      return;
    }

    let token;
    try {
      token = await startJourneySharing(claim.id);
      if (!isCurrentOperation(generation)) {
        await stopJourneySharing(claim.id, token).catch(() => {});
        if (mounted.current) setBusy(false);
        return;
      }
      sequence.current = 0;
      lastPublishedAt.current = 0;
      const published = await publishJourneyLocation(claim.id, token, 1, coordinates(position));
      if (!isCurrentOperation(generation)) {
        try {
          await stopJourneySharing(claim.id, token);
          if (mounted.current) setSharingActive(false);
        } catch {
          if (mounted.current) {
            setSharingActive(true);
            setError('Starting sharing was interrupted. Stop sharing while online to delete any saved point.');
          }
        }
        if (mounted.current) setBusy(false);
        return;
      }
      if (!published) {
        setSharingActive(false);
        setError('This claim is no longer eligible for location sharing. Refresh your claims.');
      } else {
        sequence.current = 1;
        lastPublishedAt.current = Date.now();
        setSharingActive(true);
        setConsent(false);
        const started = await startWatcher(token, generation);
        if (started && isCurrentOperation(generation)) {
          setMessage('Your latest location is shared with this listing’s donor while the app is open.');
        }
      }
    } catch {
      await stopWatcher();
      if (mounted.current && isCurrentOperation(generation)) setError('Location sharing could not start. Refresh your claims and try again.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function stopSharing() {
    operationGeneration.current += 1;
    setBusy(true);
    setError('');
    setMessage('');
    await stopWatcher();
    try {
      await stopJourneySharing(claim.id);
      sequence.current = 0;
      if (mounted.current) {
        setSharingActive(false);
        setConsent(false);
        setMessage('Location sharing stopped. Your coordinates were deleted.');
      }
    } catch {
      if (mounted.current) setError('We could not stop sharing on the server. Try again while you are online.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  const onMyWayAt = claim.on_my_way_at;

  return (
    <section className="mt-3 rounded-2xl border border-[#dce4d7] bg-[#f8fbf5] p-3" aria-label="Departure and journey sharing">
      {!onMyWayAt ? (
        <>
          <p className="text-xs leading-relaxed text-[#536054]">Let the donor know you are heading to the pickup. This does not confirm pickup or share your location.</p>
          <button
            type="button"
            onClick={() => onOnMyWay(claim.id)}
            disabled={actionBusy}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#2c8a38] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#23702d] disabled:opacity-55"
          >
            <Navigation size={14} />{busyAction === `on-my-way:${claim.id}` ? 'Notifying donor…' : 'On my way'}
          </button>
        </>
      ) : (
        <>
          <p className="flex items-start gap-2 text-xs leading-relaxed text-[#354438]">
            <Navigation size={14} className="mt-0.5 shrink-0 text-[#2c8a38]" />
            The donor was notified that you are on your way. Optional location sharing is separate and only runs while this app is open.
          </p>
          {sharingActive ? (
            <>
              <p className="mt-2 text-xs text-[#536054]">
                {watching
                  ? 'Location updates are sharing with the donor.'
                  : 'Location updates are paused. Your last shared point may be stale until you resume.'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {!watching && <button type="button" onClick={beginSharing} disabled={actionBusy} className="rounded-xl bg-[#2c8a38] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#23702d] disabled:opacity-55"><MapPin size={13} className="mr-1 inline" />Resume sharing</button>}
                <button type="button" onClick={stopSharing} disabled={actionBusy} className="rounded-xl border border-[#cbd8c5] bg-white px-3.5 py-2 text-xs font-bold text-[#354438] hover:bg-[#f5faee] disabled:opacity-55"><Square size={12} className="mr-1 inline" />Stop sharing</button>
              </div>
            </>
          ) : (
            <>
              {!sharingStatusLoaded ? <p className="mt-2 text-xs text-[#536054]" role="status">Checking location sharing…</p> : <>
                <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-[#536054]">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} disabled={actionBusy} className="mt-0.5 accent-[#2c8a38]" />
                  <span>I agree to share my latest location with this listing’s donor while the app is open. I can stop at any time.</span>
                </label>
                <button type="button" onClick={beginSharing} disabled={!consent || actionBusy} className="mt-2 rounded-xl bg-[#2c8a38] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#23702d] disabled:opacity-55">
                  {busy ? 'Starting location sharing…' : 'Share my location'}
                </button>
              </>}
            </>
          )}
        </>
      )}
      {error && <p className="mt-2 text-xs text-rose-800" role="alert">{error}</p>}
      {message && <p className="mt-2 text-xs text-[#536054]" role="status">{message}</p>}
    </section>
  );
}
