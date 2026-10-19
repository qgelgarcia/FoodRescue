import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ClipboardList, RefreshCw, Ticket } from 'lucide-react';
import CustomerHeader from '../../components/layout/CustomerHeader';
import PageShell from '../../components/layout/PageShell';
import { DonorClaimCard, MyClaimCard } from '../../components/claims/ClaimCard';
import PickupVerificationPanel from '../../components/claims/PickupVerificationPanel';
import { decideCancellation, decideClaim, getDonorClaims, getMyClaims, requestCancellation, verifyPickup } from '../../services/claims';
import { friendlyError } from '../../services/request';

const REFRESH_MS = 15000;

export default function HistoryPage({ userProfile }) {
  const [tab, setTab] = useState('mine');
  const [myClaims, setMyClaims] = useState([]);
  const [donorClaims, setDonorClaims] = useState([]);
  const [loadingByTab, setLoadingByTab] = useState({ mine: true, donor: true });
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verificationNeedsRefresh, setVerificationNeedsRefresh] = useState(false);
  const tabRef = useRef(tab);
  const requestSequence = useRef({ mine: 0, donor: 0 });
  const actionInProgress = useRef(false);

  tabRef.current = tab;

  async function loadTab(which, { showLoading = false } = {}) {
    const sequence = ++requestSequence.current[which];
    if (showLoading) setLoadingByTab((current) => ({ ...current, [which]: true }));

    try {
      const data = which === 'mine' ? await getMyClaims() : await getDonorClaims();
      if (sequence !== requestSequence.current[which]) return false;
      const rows = Array.isArray(data) ? data : [];
      if (which === 'mine') setMyClaims(rows);
      else setDonorClaims(rows);
      if (tabRef.current === which) setError('');
      if (which === 'donor') setVerificationNeedsRefresh(false);
      return true;
    } catch (cause) {
      if (sequence === requestSequence.current[which] && tabRef.current === which) setError(friendlyError(cause));
      return false;
    } finally {
      if (sequence === requestSequence.current[which]) {
        setLoadingByTab((current) => ({ ...current, [which]: false }));
      }
    }
  }

  useEffect(() => {
    loadTab(tab, { showLoading: true });
  }, [tab]);

  useEffect(() => {
    const refreshVisibleTab = () => {
      if (document.visibilityState === 'visible') loadTab(tabRef.current);
    };
    const handleClaimUpdate = () => loadTab(tabRef.current);
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
        <CustomerHeader active="history" userProfile={userProfile} />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:py-9">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold text-[#0c6b20]">
                <Ticket size={13} /><span>CLAIMS &amp; PICKUPS</span>
              </div>
              <h1 className="font-['Space_Grotesk'] text-3xl font-extrabold text-[#182019]">Claims</h1>
              <p className="mt-1 max-w-2xl text-sm text-[#536054]">Track your food requests and handle pickup requests for your listings.</p>
            </div>
            <button type="button" onClick={() => loadTab(tab, { showLoading: true })} disabled={currentLoading} className="inline-flex items-center gap-2 rounded-xl border border-[#cbd8c5] bg-white px-3.5 py-2.5 text-xs font-bold text-[#354438] shadow-sm hover:bg-[#f5faee] disabled:opacity-55">
              <RefreshCw size={14} className={currentLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          <div role="tablist" aria-label="Claim sections" className="mb-5 grid grid-cols-2 rounded-2xl border border-[#dce4d7] bg-white p-1 shadow-sm">
            <button id="my-claims-tab" type="button" role="tab" aria-selected={tab === 'mine'} aria-controls="my-claims-panel" onClick={() => setTab('mine')} className={`rounded-xl px-3 py-3 text-sm font-bold transition-colors ${tab === 'mine' ? 'bg-[#2c8a38] text-white shadow-sm' : 'text-[#536054] hover:bg-[#f5faee]'}`}>
              My Claims <span className="ml-1 text-xs opacity-80">({myClaims.length})</span>
            </button>
            <button id="donor-requests-tab" type="button" role="tab" aria-selected={tab === 'donor'} aria-controls="donor-requests-panel" onClick={() => setTab('donor')} className={`rounded-xl px-3 py-3 text-sm font-bold transition-colors ${tab === 'donor' ? 'bg-[#2c8a38] text-white shadow-sm' : 'text-[#536054] hover:bg-[#f5faee]'}`}>
              Donor Requests <span className="ml-1 text-xs opacity-80">({donorClaims.length})</span>
            </button>
          </div>

          {error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900" role="alert">{error}</div>}
          {notice && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{notice}</div>}

          {tab === 'mine' ? <section id="my-claims-panel" role="tabpanel" aria-labelledby="my-claims-tab">
            {currentLoading && !selectedRows.length ? <div className="rounded-3xl border border-[#dce4d7] bg-white p-10 text-center text-sm text-[#536054]" role="status">Loading your claims…</div>
              : selectedRows.length ? <div className="space-y-4">
                {myClaims.map((claim) => <MyClaimCard key={claim.id} claim={claim} busyAction={busyAction} onRequestCancellation={onRequestCancellation} />)}
              </div>
                : <div className="rounded-3xl border border-[#dce4d7] bg-white p-10 text-center shadow-sm">
                  <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-[#0c6b20]"><Ticket size={23} /></span>
                  <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#182019]">No claims yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-[#687066]">Browse available surplus food and submit a request. Pending claims reserve portions while the donor reviews them.</p>
                  <a href="/app/home-feed" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#2c8a38] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#23702d]"><span>Browse surplus food</span><ArrowRight size={14} /></a>
                </div>}
          </section> : <section id="donor-requests-panel" role="tabpanel" aria-labelledby="donor-requests-tab">
            <div className="mb-4 rounded-2xl border border-[#dce4d7] bg-white p-4 text-xs leading-relaxed text-[#536054]">
              <div className="flex items-start gap-2.5"><ClipboardList size={17} className="mt-0.5 shrink-0 text-[#2c8a38]" /><p>Accept a request to authorize pickup. Claimants show their QR or printed code; pickup is recorded only after you verify it here.</p></div>
            </div>
            {currentLoading && !selectedRows.length ? <div className="rounded-3xl border border-[#dce4d7] bg-white p-10 text-center text-sm text-[#536054]" role="status">Loading donor requests…</div>
              : donorClaims.length ? <div className="space-y-4">
                {liveAcceptedClaims.length > 0 && <>
                  {hasPendingAcceptedCancellation && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950" role="status">An accepted claim with a pending cancellation request cannot be picked up yet. Decide that request on its claim card first; other accepted claims may still be verified.</p>}
                  <PickupVerificationPanel onVerify={onVerifyPickup} busy={busyAction === 'verify-pickup'} locked={Boolean(busyAction) && busyAction !== 'verify-pickup'} blocked={verificationNeedsRefresh} />
                </>}
                {verificationNeedsRefresh && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Pickup verification succeeded, but the latest claim list could not be loaded. Refresh to unlock another verification.</p>}
                {donorClaims.map((claim) => <DonorClaimCard key={claim.id} claim={claim} busyAction={busyAction} onDecideClaim={onDecideClaim} onDecideCancellation={onDecideCancellation} />)}
              </div>
                : <div className="rounded-3xl border border-[#dce4d7] bg-white p-10 text-center shadow-sm">
                  <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-[#0c6b20]"><ClipboardList size={23} /></span>
                  <h2 className="font-['Space_Grotesk'] text-lg font-bold text-[#182019]">No donor requests yet</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-[#687066]">Requests for your listings will appear here, along with their pickup and cancellation status.</p>
                </div>}
          </section>}
        </main>
      </div>
    </PageShell>
  );
}
