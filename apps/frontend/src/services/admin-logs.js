import { supabase, isSupabaseConfigured } from './supabase';

const DEMO_LOGS_KEY = 'foodrescue_admin_logs_v1';
const LOG_LIMIT = 100;

function readDemoLogs() {
  try {
    const logs = JSON.parse(localStorage.getItem(DEMO_LOGS_KEY) || '[]');
    return Array.isArray(logs) ? logs : [];
  } catch {
    return [];
  }
}

export async function recordAdminActivity(admin, action, targetId = null) {
  if (!admin?.id || !action?.trim()) throw new Error('An admin and action are required to record activity.');

  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('admin_logs').insert({
      admin_id: admin.id,
      action: action.trim(),
      target_id: targetId,
    });
    if (error) throw error;
    return;
  }

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    admin_id: admin.id,
    actor: admin.full_name || 'Admin',
    action: action.trim(),
    target_id: targetId,
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(DEMO_LOGS_KEY, JSON.stringify([entry, ...readDemoLogs()].slice(0, LOG_LIMIT)));
}

export async function getAdminActivityLogs() {
  if (!isSupabaseConfigured()) return readDemoLogs();

  const { data, error } = await supabase
    .from('admin_logs')
    .select('id, admin_id, action, target_id, created_at')
    .order('created_at', { ascending: false })
    .limit(LOG_LIMIT);
  if (error) throw error;

  const adminIds = [...new Set(data.map((log) => log.admin_id).filter(Boolean))];
  if (!adminIds.length) return data.map((log) => ({ ...log, actor: 'Former admin' }));

  const { data: admins, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', adminIds);
  if (profileError) throw profileError;

  const names = new Map(admins.map((admin) => [admin.id, admin.full_name]));
  return data.map((log) => ({ ...log, actor: names.get(log.admin_id) || 'Former admin' }));
}
