import LoadingState from '../../components/feedback/LoadingState';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, ClipboardList, RefreshCw, Ticket } from 'lucide-react';
import PageShell from '../../components/layout/PageShell';
import { DonorClaimCard, MyClaimCard } from '../../components/claims/ClaimCard';
import PickupVerificationPanel from '../../components/claims/PickupVerificationPanel';
import { decideCancellation, decideClaim, getDonorClaims, getMyClaims, requestCancellation, verifyPickup } from '../../services/claims';
import { getDonorJourneyLocations, notifyDonorOnMyWay } from '../../services/journey';
import { friendlyError } from '../../services/request';
import { matchesNotificationClaim } from '../../lib/notification-destination';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'motion/react';
import './HistoryPage.css';

const REFRESH_MS = 15000;

function AnimatedClaimsPanel({ children, reduceMotion, onReady }) {
  const isPresent = useIsPresent();
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  useEffect(() => { if (isPresent) readyRef.current?.(); }, [isPresent]);
  return <motion.div aria-hidden={!isPresent} inert={isPresent ? undefined : ''} style={{ pointerEvents: isPresent ? 'auto' : 'none' }}
    initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
    exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }} transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}>
    {children}
  </motion.div>;
}

export default function HistoryPage({ userProfile }) {
  const location = useLocation();
  const notificationPostId = location.state?.notificationPostId || null;
  const notificationClaimId = location.state?.notificationClaimId || null;
  const [tab, setTab] = useState('mine');
  const [myClaims, setMyClaims] = useState([]);
  const [donorClaims, setDonorClaims] = useState([]);
  const [loadingByTab, setLoadingByTab] = useState({ mine: true, donor: true });
  const [loadedByTab, setLoadedByTab] = useState({ mine: false, donor: false });
  const [readErrors, setReadErrors] = useState({ mine: '', donor: '' });
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verificationNeedsRefresh, setVerificationNeedsRefresh] = useState(false);
  const [focusedPostId, setFocusedPostId] = useState(null);
  const [notificationFocusState, setNotificationFocusState] = useState('none');
  const tabRef = useRef(tab);
  const requestSequence = useRef({ mine: 0, donor: 0 });
  const actionInProgress = useRef(false);
  const ownerRef = useRef(userProfile?.id);
  const mountedRef = useRef(false);
  const resolvedNotification = useRef(null);
  const reduceMotion = useReducedMotion();

  tabRef.current = tab;
  ownerRef.current = userProfile?.id;

  async function loadTab(which, { showLoading = false } = {}) {
    const sequence = ++requestSequence.current[which];
    const owner = ownerRef.current;
    const isCurrent = () => mountedRef.current && owner === ownerRef.current && sequence === requestSequence.current[which];
    if (showLoading) setLoadingByTab((current) => ({ ...current, [which]: true }));

    try {
      const data = which === 'mine' ? await getMyClaims() : await getDonorClaims();
      if (!isCurrent()) return false;
      if (!Array.isArray(data)) throw new Error('Invalid claim response');
      let rows = data;
      if (which === 'donor' && rows.length) {
        try {
          const journeys = await getDonorJourneyLocations(rows.map((claim) => claim.id));
          const byClaim = new Map(journeys.map((journey) => [journey.claim_id, journey]));
          rows = rows.map((claim) => ({ ...claim, journey: byClaim.get(claim.id) || null }));
        } catch {
          rows = rows.map((claim) => ({ ...claim, journey: null, journey_unavailable: true }));
        }
      }
      if (!isCurrent()) return false;
      if (which === 'mine') setMyClaims(rows);
      else setDonorClaims(rows);
      setLoadedByTab((current) => ({ ...current, [which]: true }));
      setReadErrors((current) => ({ ...current, [which]: '' }));
      if (tabRef.current === which) setError('');
      if (which === 'donor') setVerificationNeedsRefresh(false);
      return true;
    } catch (cause) {
      if (isCurrent()) setReadErrors((current) => ({ ...current, [which]: friendlyError(cause) }));
      return false;
    } finally {
      if (isCurrent()) {
        setLoadingByTab((current) => ({ ...current, [which]: false }));
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    setMyClaims([]);
    setDonorClaims([]);
    setLoadedByTab({ mine: false, donor: false });
    setReadErrors({ mine: '', donor: '' });
    setError('');
    setNotice('');
    resolvedNotification.current = null;
    loadTab('mine', { showLoading: true });
    loadTab('donor', { showLoading: true });
    return () => {
      mountedRef.current = false;
      requestSequence.current.mine += 1;
      requestSequence.current.donor += 1;
    };
  }, [userProfile?.id]);

  useEffect(() => {
    if (!notificationPostId && !notificationClaimId) {
      setFocusedPostId(null);
      setNotificationFocusState('none');
      resolvedNotification.current = null;
      return undefined;
    }
    const target = `${userProfile?.id}:${notificationClaimId || notificationPostId}`;
    if (resolvedNotification.current === target) return undefined;
    setFocusedPostId(notificationPostId);
    setNotificationFocusState('loading');
    const match = (claim) => matchesNotificationClaim(claim, notificationClaimId, notificationPostId);
    if (myClaims.some(match) || donorClaims.some(match)) {
      setTab(myClaims.some(match) ? 'mine' : 'donor');
      setNotificationFocusState('found');
      resolvedNotification.current = target;
    } else if (loadedByTab.mine && loadedByTab.donor) {
      setNotificationFocusState('unavailable');
      resolvedNotification.current = target;
    } else if (readErrors.mine || readErrors.donor) setNotificationFocusState('error');
  }, [notificationPostId, notificationClaimId, userProfile?.id, myClaims, donorClaims, loadedByTab, readErrors]);

  const focusedRows = tab === 'mine' ? myClaims : donorClaims;
  const focusedRowIndex = focusedRows.findIndex((claim) => matchesNotificationClaim(claim, notificationClaimId, focusedPostId));

  function focusNotification() {
    if (notificationFocusState !== 'found' || focusedRowIndex < 0) return;
    const target = document.getElementById('notification-focused-claim');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }

  useEffect(() => {
    if (notificationFocusState !== 'found' || focusedRowIndex < 0) return;
    const frame = window.requestAnimationFrame(focusNotification);
    return () => window.cancelAnimationFrame(frame);
  }, [notificationFocusState, tab, focusedRowIndex, reduceMotion]);

  useEffect(() => {
    const refreshVisibleTab = () => {
      if (document.visibilityState === 'visible') { loadTab('mine'); loadTab('donor'); }
    };
    const handleClaimUpdate = () => { loadTab('mine'); loadTab('donor'); };
    const timer = window.setInterval(refreshVisibleTab, REFRESH_MS);
    window.addEventListener('focus', refreshVisibleTab);
    window.addEventListener('foodrescue:claim_updated', handleClaimUpdate);
    document.addEventListener('visibilitychange', refreshVisibleTab);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisibleTab);
      window.removeEventListener('foodrescue:claim_updated', handleClaimUpdate);
      document.removeEventListener('visibilitychange', refreshVisibleTab);
    };
  }, []);

  async function runAction(key, successText, operation, optimisticUpdate) {
    if (actionInProgress.current) return false;
    actionInProgress.current = true;
    setBusyAction(key);
    setError('');
    setNotice('');
    try {
      const result = await operation();
      optimisticUpdate?.(result);
      setNotice(successText);
      if (key === 'verify-pickup') setVerificationNeedsRefresh(true);
      const refreshed = await loadTab(tabRef.current);
      if (!refreshed) {
        setNotice(`${successText} The list could not refresh, so it may take a moment to show the latest status.`);
        if (key === 'verify-pickup') setVerificationNeedsRefresh(true);
      }
      return true;
    } catch (cause) {
      setError(friendlyError(cause));
      return false;
    } finally {
      actionInProgress.current = false;
      setBusyAction('');
    }
  }

  function onRequestCancellation(claimId, reason) {
    return runAction(`cancel-request:${claimId}`, 'Cancellation request sent to the donor.',
      () => requestCancellation(claimId, reason),
      () => setMyClaims((rows) => rows.map((claim) => claim.id === claimId
        ? { ...claim, cancellation_status: 'pending', cancellation_reason: reason }
        : claim)));
  }

  function onOnMyWay(claimId) {
    return runAction(`on-my-way:${claimId}`, 'The donor was notified that you are on your way.',
      () => notifyDonorOnMyWay(claimId));
  }

  function onDecideClaim(claimId, accept, reason) {
    const key = `claim-decision:${claimId}:${accept ? 'accept' : 'reject'}`;
    return runAction(key, accept ? 'Claim accepted.' : 'Claim rejected.',
      () => decideClaim(claimId, accept, reason),
      () => setDonorClaims((rows) => rows.map((claim) => claim.id === claimId
        ? { ...claim, status: accept ? 'accepted' : 'rejected' }
        : claim)));
  }

  function onDecideCancellation(requestId, approve, reason) {
    const key = `cancellation-decision:${requestId}:${approve ? 'approve' : 'deny'}`;
    return runAction(key, approve ? 'Cancellation approved. The claim is closed.' : 'Cancellation denied. The claim stays active.',
      () => decideCancellation(requestId, approve, reason),
      () => setDonorClaims((rows) => rows.map((claim) => claim.cancellation_request_id === requestId
        ? {
            ...claim,
            status: approve ? 'cancelled' : claim.status,
            cancellation_status: approve ? 'approved' : 'denied',
            cancellation_decision_reason: reason,
          }
        : claim)));
  }

  function onVerifyPickup(code) {
    return runAction('verify-pickup', 'Pickup confirmed.', () => verifyPickup(code), (result) => {
      const claimId = result?.claim_id || result?.claimId || result?.id;
      if (claimId) setDonorClaims((rows) => rows.map((claim) => claim.id === claimId ? { ...claim, status: 'picked_up' } : claim));
    });
  }

  const currentLoading = loadingByTab[tab];
  const selectedRows = tab === 'mine' ? myClaims : donorClaims;
  const liveAcceptedClaims = donorClaims.filter((claim) => !claim.is_sample && claim.status === 'accepted');
  const hasPendingAcceptedCancellation = liveAcceptedClaims.some((claim) => claim.cancellation_status === 'pending');

  return (
    <PageShell>
      <div className="relative flex h-full w-full flex-col overflow-y-auto pb-28 font-['DM_Sans',sans-serif]">

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:py-9">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold text-[#0c6b20]">
                <Ticket size={13} /><span>CLAIMS &amp; PICKUPS</span>
              </div>
              <h1 className="font-['Space_Grotesk'] text-3xl font-extrabold text-[#182019]">Claims</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#536054]">Track your food requests and handle pickup requests for your listings.</p>
            </div>
            <button type="button" onClick={() => { loadTab('mine', { showLoading: true }); loadTab('donor', { showLoading: true }); }} disabled={currentLoading} className="inline-flex items-center gap-2 rounded-xl border border-[#cbd8c5] bg-white px-3.5 py-2.5 text-xs font-bold text-[#354438] shadow-sm hover:bg-[#f5faee] disabled:opacity-55">
              <RefreshCw size={14} className={currentLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {notificationFocusState === 'loading' && <p className="mb-4 rounded-2xl border border-[#dce4d7] bg-white px-4 py-3 text-sm text-[#536054]" role="status">Opening the pickup linked to your notification…</p>}
          {notificationFocusState === 'unavailable' && <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="status">This pickup is unavailable or no longer appears in your claim history.</p>}

          <div role="tablist" aria-label="Claim sections" className="claims-tabs" onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 'mine' : event.key === 'End' ? 'donor' : tab === 'mine' ? 'donor' : 'mine';
            setTab(next);
            document.getElementById(next === 'mine' ? 'my-claims-tab' : 'donor-requests-tab')?.focus();
          }}>
            <button id="my-claims-tab" type="button" role="tab" aria-selected={tab === 'mine'} aria-controls="my-claims-panel" onClick={() => setTab('mine')} className={`rounded-xl px-3 py-3 text-sm font-bold transition-colors ${tab === 'mine' ? 'bg-[#2c8a38] text-white shadow-sm' : 'text-[#536054] hover:bg-[#f5faee]'}`}>
              My Claims <span className="ml-1 text-xs opacity-80">({loadedByTab.mine ? myClaims.length : '…'})</span>
            </button>
            <button id="donor-requests-tab" type="button" role="tab" aria-selected={tab === 'donor'} aria-controls="donor-requests-panel" onClick={() => setTab('donor')} className={`rounded-xl px-3 py-3 text-sm font-bold transition-colors ${tab === 'donor' ? 'bg-[#2c8a38] text-white shadow-sm' : 'text-[#536054] hover:bg-[#f5faee]'}`}>
              Donor Requests <span className="ml-1 text-xs opacity-80">({loadedByTab.donor ? donorClaims.length : '…'})</span>
            </button>
          </div>

          {(error || readErrors[tab]) && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">{error || readErrors[tab]}</div>}
          {notice && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{notice}</div>}

          <AnimatePresence initial={false} mode="wait">
          <AnimatedClaimsPanel key={tab} reduceMotion={reduceMotion} onReady={focusNotification}>
          {!loadedByTab[tab] && readErrors[tab] ? <LoadingState error={readErrors[tab]} onRetry={() => loadTab(tab, { showLoading: true })} /> : tab === 'mine' ? <section id="my-claims-panel" role="tabpanel" aria-labelledby="my-claims-tab" aria-busy={currentLoading}>
            {currentLoading && !selectedRows.length ? <LoadingState label="Loading your claims" onRetry={() => loadTab(tab, { showLoading: true })} />
              : selectedRows.length ? <div className="space-y-4">
                {myClaims.map((claim, index) => <div key={claim.id} id={index === focusedRowIndex ? 'notification-focused-claim' : undefined} tabIndex={index === focusedRowIndex ? -1 : undefined} role={index === focusedRowIndex ? 'region' : undefined} aria-label={index === focusedRowIndex ? 'Pickup linked to your notification' : undefined} className={index === focusedRowIndex ? 'notification-focused-claim' : undefined}><MyClaimCard claim={claim} busyAction={busyAction} onRequestCancellation={onRequestCancellation} onOnMyWay={onOnMyWay} /></div>)}
              </div>
                : <div className="rounded-3xl border border-[#dce4d7] bg-white p-10 text-center shadow-sm">
                  <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-[#0c6b20]"><Ticket size={23} /></span>
                  <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#182019]">No claims yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-[#687066]">Browse available surplus food and submit a request. Pending claims reserve portions while the donor reviews them.</p>
                  <a href="/app/home-feed" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2c8a38] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#23702d]"><span>Browse surplus food</span><ArrowRight size={14} /></a>
                </div>}
          </section> : <section id="donor-requests-panel" role="tabpanel" aria-labelledby="donor-requests-tab" aria-busy={currentLoading}>
            <div className="mb-4 rounded-2xl border border-[#dce4d7] bg-white p-4 text-xs leading-relaxed text-[#536054]">
              <div className="flex items-start gap-2.5"><ClipboardList size={17} className="mt-0.5 shrink-0 text-[#2c8a38]" /><p>Accept a request to authorize pickup. Claimants show their QR or printed code; pickup is recorded only after you verify it here.</p></div>
            </div>
            {currentLoading && !selectedRows.length ? <LoadingState label="Loading donor requests" onRetry={() => loadTab(tab, { showLoading: true })} />
              : donorClaims.length ? <div className="space-y-4">
                {liveAcceptedClaims.length > 0 && <>
                  {hasPendingAcceptedCancellation && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950" role="status">An accepted claim with a pending cancellation request cannot be picked up yet. Decide that request on its claim card first; other accepted claims may still be verified.</p>}
                  <PickupVerificationPanel onVerify={onVerifyPickup} busy={busyAction === 'verify-pickup'} locked={Boolean(busyAction) && busyAction !== 'verify-pickup'} blocked={verificationNeedsRefresh} />
                </>}
                {verificationNeedsRefresh && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Pickup verification succeeded, but the latest claim list could not be loaded. Refresh to unlock another verification.</p>}
                {donorClaims.map((claim, index) => <div key={claim.id} id={index === focusedRowIndex ? 'notification-focused-claim' : undefined} tabIndex={index === focusedRowIndex ? -1 : undefined} role={index === focusedRowIndex ? 'region' : undefined} aria-label={index === focusedRowIndex ? 'Pickup linked to your notification' : undefined} className={index === focusedRowIndex ? 'notification-focused-claim' : undefined}><DonorClaimCard claim={claim} busyAction={busyAction} onDecideClaim={onDecideClaim} onDecideCancellation={onDecideCancellation} /></div>)}
              </div>
                : <div className="rounded-3xl border border-[#dce4d7] bg-white p-10 text-center shadow-sm">
                  <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-[#0c6b20]"><ClipboardList size={23} /></span>
                  <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#182019]">No donor requests yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-[#687066]">Requests for your listings will appear here, along with their pickup and cancellation status.</p>
                </div>}
          </section>}
          </AnimatedClaimsPanel>
          </AnimatePresence>
        </main>
      </div>
    </PageShell>
  );
}
