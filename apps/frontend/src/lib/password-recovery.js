import { PASSWORD_REQUIREMENTS } from './account-inputs.js';

export const NATIVE_RECOVERY_REDIRECT = 'org.foodrescue.campus://auth/recovery';

function recoverySessionIdentity(session) {
  const userId = session?.user?.id;
  const encodedClaims = session?.access_token?.split('.')?.[1];
  if (!userId || !encodedClaims) return null;
  try {
    const base64 = encodedClaims.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    return claims.sub === userId && claims.session_id ? `${userId}:${claims.session_id}` : null;
  } catch {
    return null;
  }
}

export function createRecoverySessionTracker() {
  let recoveryIdentity = null;
  return {
    observe(event, session, nativeRecoveryPending = false) {
      const identity = recoverySessionIdentity(session);
      if (event === 'PASSWORD_RECOVERY' || (nativeRecoveryPending && event === 'SIGNED_IN')) {
        recoveryIdentity = identity;
      } else if (event === 'SIGNED_OUT') {
        recoveryIdentity = null;
      } else if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')
        && recoveryIdentity && identity !== recoveryIdentity) {
        recoveryIdentity = null;
      }
    },
    matches(session) {
      return Boolean(recoveryIdentity && recoverySessionIdentity(session) === recoveryIdentity);
    },
    set(session) {
      recoveryIdentity = recoverySessionIdentity(session);
      return Boolean(recoveryIdentity);
    },
    clear() {
      recoveryIdentity = null;
    },
  };
}

export function passwordRecoveryRedirect({ native = false, origin = '' } = {}) {
  return native ? NATIVE_RECOVERY_REDIRECT : `${origin.replace(/\/$/, '')}/reset-password`;
}

export function validateRecoveredPassword(password, confirmation) {
  if (!password) return 'Please enter a new password.';
  if (password.length > 128) return 'Password must be 128 characters or fewer.';
  if (PASSWORD_REQUIREMENTS.some(rule => !rule.regex.test(password))) {
    return 'Please meet all the password requirements below.';
  }
  if (password !== confirmation) return 'Passwords do not match. Please verify both fields.';
  return null;
}

export function recoveryLinkError(value) {
  let url;
  try { url = value instanceof URL ? value : new URL(value); } catch { return null; }
  const params = new URLSearchParams(`${url.search.slice(1)}&${url.hash.slice(1)}`);
  const directError = params.get('recovery_error');
  if (directError) return directError === 'expired' ? 'expired' : 'invalid';
  if (!params.has('error') && !params.has('error_code') && !params.has('error_description')) return null;
  const detail = `${params.get('error_code') || ''} ${params.get('error_description') || ''}`.toLowerCase();
  return /expired|already been used|already used|otp_expired|token_expired/.test(detail) ? 'expired' : 'invalid';
}

export function isPasswordRecoveryRedirect(value) {
  let url;
  try { url = value instanceof URL ? value : new URL(value); } catch { return false; }
  const params = new URLSearchParams(`${url.search.slice(1)}&${url.hash.slice(1)}`);
  return params.get('type') === 'recovery';
}

function requestError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (error?.status === 429 || error?.code === 'over_email_send_rate_limit' || /rate limit|too many requests|security purposes.*request this after/.test(message)) {
    return 'Too many recovery requests. Please wait a while before trying again.';
  }
  if (isNetworkError(error)) return "We couldn't reach the recovery service. Check your connection and try again.";
  return "We couldn't process the recovery request right now. Please try again later.";
}

function isNetworkError(error) {
  return error?.name === 'AbortError' || /failed to fetch|network|timed out|timeout|fetch failed/.test(String(error?.message || '').toLowerCase());
}

function isInvalidRecoveryError(error) {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return /expired|already been used|already used|replay|invalid.*(token|session|jwt)|refresh token.*(not found|invalid)|session missing|jwt expired/.test(message)
    || /otp_expired|token_not_found|session_not_found|bad_jwt|refresh_token_not_found|flow_state_not_found/.test(code);
}

function updateError(error) {
  if (isInvalidRecoveryError(error)) return 'This reset link is invalid, expired, or has already been used. Request a new link to continue.';
  const message = String(error?.message || '').toLowerCase();
  if (error?.status === 429 || error?.code === 'over_email_send_rate_limit' || /rate limit|too many requests/.test(message)) {
    return 'Too many attempts. Please wait a while, then try again.';
  }
  if (isNetworkError(error)) return "We couldn't reach the recovery service. Check your connection and try again.";
  return 'We could not update this password. Try another password or request a new reset link.';
}

export async function requestPasswordRecovery({ auth, email, redirectTo }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  try {
    const { error } = await auth.resetPasswordForEmail(cleanEmail, { redirectTo });
    return error ? { error: requestError(error) } : { error: null };
  } catch (error) {
    return { error: requestError(error) };
  }
}

export async function saveRecoveredPassword({ auth, password, confirmation, hasRecoverySession }) {
  try {
    if (!await hasRecoverySession()) {
      return { error: 'This reset link is invalid or expired. Request a new link to continue.', reason: 'invalid_link' };
    }
    const validationError = validateRecoveredPassword(password, confirmation);
    if (validationError) return { error: validationError, reason: 'invalid_input' };
    const { error } = await auth.updateUser({ password });
    return error ? { error: updateError(error), reason: isInvalidRecoveryError(error) ? 'invalid_link' : 'update_failed' } : { error: null };
  } catch (error) {
    return { error: updateError(error), reason: isInvalidRecoveryError(error) ? 'invalid_link' : 'update_failed' };
  }
}
