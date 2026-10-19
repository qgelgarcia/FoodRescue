export class ClaimWorkflowError extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function pickupCode(value) {
  const code = String(value || '').trim().toLowerCase();
  if (!UUID.test(code)) throw new ClaimWorkflowError('Enter the full pickup code shown below the claimant’s QR code.');
  return code;
}

export function claimId(value) {
  if (!UUID.test(String(value || ''))) throw new ClaimWorkflowError('This action requires a real shared claim. Sample claims are previews only.');
  return value;
}

export function cancellationReason(value) {
  const reason = String(value || '').trim();
  if (reason.length < 10 || reason.length > 2000) throw new ClaimWorkflowError('Explain the cancellation in 10 to 2,000 characters.');
  return reason;
}

// Fixed user-facing messages only; never expose arbitrary database errors.
export function claimRequestError(error) {
  if (error instanceof ClaimWorkflowError) return error;
  const message = String(error?.message || '').toLowerCase();
  if (['PGRST202', '42883'].includes(error?.code)) return new ClaimWorkflowError('The claim workflow needs its database update. Please contact the project administrator.');
  const messages = [
    [/invalid.*code|invalid.*pass|invalid.*token|pass.*invalid|code.*invalid|token.*invalid|already.*used|authorization|pass does not match/, 'This pickup code is invalid or has already been used. Refresh the claim and try again.'],
    [/deadline|expired|pickup window/, 'The pickup deadline has passed. Refresh your claims to see the latest status.'],
    [/own post|own listing|self.claim/, 'You cannot claim your own food listing.'],
    [/already.*claim|repeat.*claim|one.*claim|existing.*claim|active pickup|claim again/, 'You already have an active or completed claim for this listing.'],
    [/cancellation.*pending|pending.*cancellation|cancellation.*await/, 'The donor must decide the pending cancellation request before this pickup can continue.'],
    [/accepted|accept.*first/, 'The donor must accept this claim before pickup.'],
    [/donor|owner/, 'Only this listing’s donor can perform that action.'],
    [/not.*pending|only pending|no longer|state.*changed|already.*decided|not.*active/, 'This request has changed or is already closed. Refresh before trying again.'],
    [/locked after the first claim|claim history/, 'This listing has claim history. Its details are locked, and it cannot be archived directly.'],
    [/not enough|quantity|portions|inventory/, 'Those portions are no longer available. Refresh the feed and choose another quantity.'],
    [/explanation|reason/, 'Please provide an explanation between 10 and 2,000 characters.'],
    [/active account|active member|suspend/, 'Your account cannot start new claims. You can still manage existing arrangements.'],
    [/sign in|authenticated|signed.in/, 'Please sign in again to continue.'],
    [/not found|not authorized|permission/, 'This request is unavailable or you do not have permission to change it.'],
  ];
  const match = messages.find(([pattern]) => pattern.test(message));
  return match ? new ClaimWorkflowError(match[1]) : error;
}
