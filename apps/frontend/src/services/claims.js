import { supabase, isSupabaseConfigured } from './supabase';
import { getMyFoodClaims } from './food';
import { ClaimWorkflowError, cancellationReason, claimId, claimRequestError, pickupCode } from '../lib/claim-inputs';

async function claimRpc(name, params = {}, mutation = false) {
  if (!isSupabaseConfigured()) throw new ClaimWorkflowError('Connect to Supabase and sign in to manage shared claims.');
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw claimRequestError(error);
  if (mutation) window.dispatchEvent(new CustomEvent('foodrescue:claim_updated'));
  return data;
}

export const getMyClaims = () => getMyFoodClaims();
export const getDonorClaims = async () => (await claimRpc('get_donor_food_claims')) || [];
export const decideClaim = (id, accept, reason = '') => claimRpc('decide_food_claim', {
  p_claim_id: claimId(id), p_accept: Boolean(accept), p_reason: reason.trim() || null,
}, true);
export const requestCancellation = (id, reason) => claimRpc('request_claim_cancellation', {
  p_claim_id: claimId(id), p_reason: cancellationReason(reason),
}, true);
export const decideCancellation = (id, approve, reason = '') => claimRpc('decide_claim_cancellation', {
  p_request_id: claimId(id), p_approve: Boolean(approve), p_reason: reason.trim() || null,
}, true);
export const verifyPickup = (code) => claimRpc('verify_food_pickup', {
  p_pickup_code: pickupCode(code),
}, true);
