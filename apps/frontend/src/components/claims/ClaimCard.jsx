import React, { useState } from 'react';
import { CalendarClock, MapPin, PackageCheck, UserRound } from 'lucide-react';
import ClaimStatusBadge from './ClaimStatusBadge';
import PickupPass from './PickupPass';
import ReasonForm from './ReasonForm';
import ClaimantJourneyControls from './ClaimantJourneyControls';
import JourneyLocationMap from './JourneyLocationMap';
import PickupLocationMap from './PickupLocationMap';

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function CardFrame({ claim, children }) {
  return (
    <article className={`rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${claim.is_sample ? 'border-amber-300' : 'border-[#dce4d7]'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-['Space_Grotesk'] text-lg font-bold leading-tight text-[#182019]">{claim.post_title || 'Food claim'}</h2>
            <ClaimStatusBadge status={claim.status} />
            {claim.is_sample && <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-900">Preview</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#536054]">
            {claim.claimant_name && <span className="inline-flex items-center gap-1.5"><UserRound size={13} className="text-[#2c8a38]" />{claim.claimant_name}</span>}
            {claim.donor_name && <span className="inline-flex items-center gap-1.5"><UserRound size={13} className="text-[#2c8a38]" />Donor: {claim.donor_name}</span>}
            {(claim.location || claim.pickup_address) && <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-[#2c8a38]" />{claim.location || claim.pickup_address}</span>}
            {claim.quantity != null && <span className="inline-flex items-center gap-1.5"><PackageCheck size={13} className="text-[#2c8a38]" />{claim.quantity} portion{Number(claim.quantity) === 1 ? '' : 's'}</span>}
            {claim.claimed_at && <span className="inline-flex items-center gap-1.5"><CalendarClock size={13} className="text-[#2c8a38]" />Requested {formatDate(claim.claimed_at)}</span>}
          </div>
          {claim.expires_at && <p className="mt-1 text-[11px] text-[#687066]">Pickup deadline: {formatDate(claim.expires_at)}</p>}
        </div>
      </div>
      {children}
    </article>
  );
}

function CancellationHistory({ claim, audience }) {
  const state = claim.cancellation_status;
  if (!state || state === 'none') return null;
  const isPending = state === 'pending';
  const isApproved = state === 'approved';
  const tone = isPending ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-[#dce4d7] bg-[#f5faee] text-[#354438]';

  return (
    <div className={`mt-3 rounded-xl border p-3 text-xs ${tone}`}>
      <p className="font-bold">
        {isPending
          ? 'Cancellation request awaiting the donor’s decision.'
          : isApproved
            ? 'Cancellation request approved.'
          : state === 'denied'
            ? 'Cancellation request denied.'
            : 'Cancellation request closed.'}
      </p>
      {isPending && <p className="mt-1">The reserved portions stay held until the donor decides.</p>}
      {claim.cancellation_reason && <p className="mt-1"><span className="font-semibold">{audience === 'donor' ? 'Claimant’s reason:' : 'Your reason:'}</span> {claim.cancellation_reason}</p>}
      {!isPending && claim.cancellation_decision_reason && <p className="mt-1"><span className="font-semibold">{state === 'obsolete' ? 'Status note:' : 'Donor’s note:'}</span> {claim.cancellation_decision_reason}</p>}
    </div>
  );
}

export function MyClaimCard({ claim, busyAction, onRequestCancellation, onOnMyWay }) {
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [reason, setReason] = useState('');
  const canCancel = ['pending', 'accepted'].includes(claim.status);
  const requestPending = claim.cancellation_status === 'pending';
  const actionKey = `cancel-request:${claim.id}`;
  const isBusy = busyAction === actionKey;

  async function submitCancellation() {
    const succeeded = await onRequestCancellation(claim.id, reason.trim());
    if (succeeded) {
      setShowCancelForm(false);
      setReason('');
    }
  }

  return (
    <CardFrame claim={claim}>
      {claim.is_sample && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Preview only. This example is read-only and has no live pickup pass.</p>}
      <CancellationHistory claim={claim} audience="claimant" />
      {!claim.is_sample && ['pending', 'accepted'].includes(claim.status) && <PickupLocationMap claim={claim} />}
      {!claim.is_sample && claim.status === 'pending' && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">Your portions are reserved while the donor reviews this claim. Pickup becomes available after acceptance.</p>}
      {!claim.is_sample && claim.status === 'accepted' && <PickupPass claim={claim} />}
      {!claim.is_sample && claim.status === 'accepted' && <ClaimantJourneyControls claim={claim} busyAction={busyAction} onOnMyWay={onOnMyWay} />}
      {!claim.is_sample && canCancel && requestPending && <p className="mt-3 text-xs font-semibold text-[#687066]">You can request another cancellation only after this request is decided.</p>}
      {!claim.is_sample && canCancel && !requestPending && !showCancelForm && (
        <div className="mt-3">
          <button type="button" disabled={Boolean(busyAction)} onClick={() => setShowCancelForm(true)} className="rounded-xl border border-[#cbd8c5] bg-white px-3.5 py-2 text-xs font-bold text-[#354438] hover:bg-[#f5faee] disabled:opacity-55">
            Request cancellation
          </button>
        </div>
      )}
      {!claim.is_sample && showCancelForm && (
        <ReasonForm
          id={`cancel-reason-${claim.id}`}
          value={reason}
          onChange={setReason}
          onSubmit={submitCancellation}
          onCancel={() => { setShowCancelForm(false); setReason(''); }}
          busy={isBusy}
          locked={Boolean(busyAction) && !isBusy}
          minLength={10}
          submitLabel="Send cancellation request"
          cancelLabel="Keep claim"
        />
      )}
    </CardFrame>
  );
}

export function DonorClaimCard({ claim, busyAction, onDecideClaim, onDecideCancellation }) {
  const [reasonForm, setReasonForm] = useState('');
  const [reason, setReason] = useState('');
  const cancellationPending = claim.cancellation_status === 'pending' && claim.cancellation_request_id;
  const claimAction = (accept) => `claim-decision:${claim.id}:${accept ? 'accept' : 'reject'}`;
  const cancellationAction = (approve) => `cancellation-decision:${claim.cancellation_request_id}:${approve ? 'approve' : 'deny'}`;
  const actionBusy = busyAction === claimAction(true) || busyAction === claimAction(false)
    || busyAction === cancellationAction(true) || busyAction === cancellationAction(false);
  const actionLocked = Boolean(busyAction) && !actionBusy;

  async function submitClaimDecision(accept) {
    const succeeded = await onDecideClaim(claim.id, accept, reason.trim());
    if (succeeded) {
      setReasonForm('');
      setReason('');
    }
  }

  async function submitCancellationDecision(approve) {
    const succeeded = await onDecideCancellation(claim.cancellation_request_id, approve, reason.trim());
    if (succeeded) {
      setReasonForm('');
      setReason('');
    }
  }

  return (
    <CardFrame claim={claim}>
      {claim.is_sample && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">Preview only. Example request; no donor actions are available.</p>}
      {!claim.is_sample && <CancellationHistory claim={claim} audience="donor" />}
      {!claim.is_sample && claim.status === 'accepted' && claim.on_my_way_at && <>
        <p className="mt-3 text-xs text-[#536054]">Claimant marked on the way at {formatDate(claim.on_my_way_at)}.</p>
        <JourneyLocationMap journey={claim.journey} unavailable={claim.journey_unavailable} title={claim.post_title} />
      </>}
      {cancellationPending && !claim.is_sample && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => { setReason(''); setReasonForm('approve-cancellation'); }}
            className="rounded-xl bg-[#2c8a38] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#23702d] disabled:opacity-55"
            >{busyAction === cancellationAction(true) ? 'Approving…' : 'Approve cancellation'}</button>
          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => { setReason(''); setReasonForm('deny-cancellation'); }}
            className="rounded-xl border border-[#cbd8c5] bg-white px-3.5 py-2 text-xs font-bold text-[#354438] hover:bg-[#f5faee] disabled:opacity-55"
          >{busyAction === cancellationAction(false) ? 'Denying…' : 'Deny cancellation'}</button>
        </div>
      )}
      {!claim.is_sample && claim.status === 'pending' && !cancellationPending && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => { setReason(''); onDecideClaim(claim.id, true, ''); }}
            className="rounded-xl bg-[#2c8a38] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#23702d] disabled:opacity-55"
          >{busyAction === claimAction(true) ? 'Accepting…' : 'Accept claim'}</button>
          {reasonForm !== 'reject-claim' && <button
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => { setReason(''); setReasonForm('reject-claim'); }}
            className="rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-800 hover:bg-rose-50 disabled:opacity-55"
          >Reject claim</button>}
        </div>
      )}
      {reasonForm === 'reject-claim' && (
        <ReasonForm
          id={`reject-reason-${claim.id}`}
          value={reason}
          onChange={setReason}
          onSubmit={() => submitClaimDecision(false)}
          onCancel={() => { setReasonForm(''); setReason(''); }}
          busy={busyAction === claimAction(false)}
          locked={actionLocked}
          submitLabel="Reject claim"
          cancelLabel="Keep claim pending"
          helpText="Optional note to the claimant."
        />
      )}
      {(reasonForm === 'approve-cancellation' || reasonForm === 'deny-cancellation') && (
        <ReasonForm
          id={`cancellation-decision-${claim.cancellation_request_id}`}
          value={reason}
          onChange={setReason}
          onSubmit={() => submitCancellationDecision(reasonForm === 'approve-cancellation')}
          onCancel={() => { setReasonForm(''); setReason(''); }}
          busy={busyAction === cancellationAction(reasonForm === 'approve-cancellation')}
          locked={actionLocked}
          submitLabel={reasonForm === 'approve-cancellation' ? 'Approve cancellation' : 'Deny cancellation'}
          cancelLabel="Leave request pending"
          helpText="Optional note for the claimant."
        />
      )}
      {!claim.is_sample && claim.status === 'accepted' && !cancellationPending && (
        <p className="mt-3 text-xs text-[#536054]">Pickup is confirmed when you scan the claimant’s QR or enter their printed code in the verification panel.</p>
      )}
    </CardFrame>
  );
}
