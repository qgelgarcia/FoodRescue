import { supabase, isSupabaseConfigured } from './supabase';
import { claimId, claimRequestError, ClaimWorkflowError } from '../lib/claim-inputs';

async function journeyRpc(name, params = {}, refreshClaims = false) {
  if (!isSupabaseConfigured()) {
    throw new ClaimWorkflowError('Connect to Supabase and sign in to share a pickup journey.');
  }
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw claimRequestError(error);
  if (refreshClaims) window.dispatchEvent(new CustomEvent('foodrescue:claim_updated'));
  return data;
}

export const notifyDonorOnMyWay = (id) => journeyRpc('claim_on_my_way', {
  p_claim_id: claimId(id),
}, true);

export const startJourneySharing = (id) => journeyRpc('start_claim_journey_sharing', {
  p_claim_id: claimId(id),
}, true);

export const publishJourneyLocation = (id, token, sequence, { lat, lng }) => journeyRpc('publish_claim_journey_location', {
  p_claim_id: claimId(id),
  p_share_token: claimId(token),
  p_sequence: sequence,
  p_lat: lat,
  p_lng: lng,
});

export const stopJourneySharing = (id, token = null) => journeyRpc('stop_claim_journey_sharing', {
  p_claim_id: claimId(id),
  p_share_token: token ? claimId(token) : null,
}, true);

export const isJourneySharingActive = (id) => journeyRpc('my_claim_journey_sharing_active', {
  p_claim_id: claimId(id),
});

export async function getDonorJourneyLocations(ids) {
  if (!isSupabaseConfigured()) return [];
  const claimIds = [...new Set((ids || []).filter(Boolean))];
  if (!claimIds.length) return [];

  const { data, error } = await supabase
    .from('claim_journeys')
    .select('claim_id, lat, lng, updated_at')
    .in('claim_id', claimIds);
  if (error) throw claimRequestError(error);
  return data || [];
}
