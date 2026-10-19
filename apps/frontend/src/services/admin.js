import { supabase, isSupabaseConfigured } from './supabase';

async function adminRpc(name, params = {}) {
  if (!isSupabaseConfigured()) throw new Error('Connect the app to Supabase to use live admin tools.');
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

export const getAdminDashboardStats = () => adminRpc('admin_dashboard_stats');
export const getAdminMembers = () => adminRpc('admin_list_members');
export const getAdminPosts = () => adminRpc('admin_list_posts');
export const getAdminClaims = () => adminRpc('admin_list_claims');
export const getAdminReports = () => adminRpc('admin_list_reports');
export const getAdminAuditLogs = () => adminRpc('admin_list_audit_logs');

export const setMemberStatus = (userId, status, reason) => adminRpc('admin_set_member_status', {
  p_user_id: userId,
  p_status: status,
  p_reason: reason,
});

export const removeFoodPost = (postId, reason) => adminRpc('admin_remove_food_post', {
  p_post_id: postId,
  p_reason: reason,
});

export const updateReport = (reportId, status, explanation) => adminRpc('admin_update_report', {
  p_report_id: reportId,
  p_next_status: status,
  p_resolution_explanation: explanation || null,
});
