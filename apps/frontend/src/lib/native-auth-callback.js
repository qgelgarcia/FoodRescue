import { recoveryLinkError } from './password-recovery.js';

export function nativeAuthCallback(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'org.foodrescue.campus:' || url.hostname !== 'auth') return null;

  let kind;
  if (url.pathname === '/callback') kind = 'login';
  else if (url.pathname === '/recovery') kind = 'recovery';
  else return null;

  const error = recoveryLinkError(url);
  const code = url.searchParams.get('code');
  return { kind, code, failed: Boolean(error || !code), error: error || (url.searchParams.has('error') ? 'invalid' : null) };
}

// Kept as a narrow helper for callers/tests that only handle Google OAuth callbacks.
export function nativeAuthCode(value) {
  const callback = nativeAuthCallback(value);
  if (!callback || callback.kind !== 'login') return null;
  return { code: callback.code, failed: callback.failed };
}

export function nativeAuthDestination(callback, succeeded) {
  if (!callback) return null;
  if (callback.kind === 'recovery') {
    if (succeeded) return '/reset-password';
    const state = callback.error === 'expired' ? 'expired' : 'invalid';
    return `/reset-password?recovery_error=${state}`;
  }
  return succeeded ? '/login' : '/login?auth_error=1';
}
