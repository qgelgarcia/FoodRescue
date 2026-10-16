export function friendlyError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  if (globalThis.navigator?.onLine === false || /fetch|network|connection/.test(message)) return 'You appear to be offline. Check your connection and try again.';
  if (/timeout|timed out|abort/.test(message)) return 'This is taking longer than expected. Please try again in a moment.';
  if (/invalid login credentials/.test(message)) return 'The email or password does not match. Please try again.';
  if (/email not confirmed/.test(message)) return 'Please confirm your email using the link in your inbox.';
  if (/already registered/.test(message)) return 'An account with this email already exists. Please sign in.';
  return 'We could not complete that request. Please try again in a moment.';
}

// Abort the actual request so a timed-out form cannot quietly keep submitting.
export async function fetchWithTimeout(input, options = {}, timeoutMs = 15000) {
  if (globalThis.navigator?.onLine === false) throw new Error('network');
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
