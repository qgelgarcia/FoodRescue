import { supabase, isSupabaseConfigured } from './supabase';

async function reportRpc(name, params) {
  if (!isSupabaseConfigured()) throw new Error('Connect the app to Supabase to submit or view reports.');
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

export const getMyReports = () => reportRpc('get_my_reports');

export const submitReport = (targetType, targetId, reason) => reportRpc('submit_report', {
  p_target_type: targetType,
  p_target_id: targetId,
  p_reason: reason,
});
