import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import PasswordInput from '../../components/auth/PasswordInput';
import { clearPasswordRecoveryContext, hasPasswordRecoverySession, logout, onAuthStateChange, updatePasswordFromRecovery } from '../../services/auth';
import { recoveryLinkError } from '../../lib/password-recovery.js';

const LINK_MESSAGES = {
  expired: 'This password reset link has expired or has already been used. Request a new link to continue.',
  invalid: 'This password reset link is invalid, expired, or has already been used. Open the latest link or request a new one.',
};

export default function ResetPassword() {
  const history = useHistory();
  const [linkState, setLinkState] = useState('checking');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const redirectError = recoveryLinkError(window.location.href);
    const subscription = onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' && session?.user) setLinkState('ready');
      if (event === 'SIGNED_OUT') setLinkState('invalid');
    });

    async function checkLink() {
      if (redirectError) {
        window.history.replaceState(null, '', window.location.pathname);
        if (active) setLinkState(redirectError);
        return;
      }
      const valid = await hasPasswordRecoverySession();
      // Supabase has now initialized and consumed the web callback, or the native handler supplied a clean route.
      window.history.replaceState(null, '', window.location.pathname);
      if (active) setLinkState(valid ? 'ready' : 'invalid');
    }
    checkLink().catch(() => {
      window.history.replaceState(null, '', window.location.pathname);
      if (active) setLinkState('invalid');
    });

    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    if (linkState !== 'ready' || loading) return;
    setError('');
    setLoading(true);
    const result = await updatePasswordFromRecovery(password, confirmation);
    if (result.error) {
      if (result.reason === 'invalid_link') {
        setError('');
        setLinkState('invalid');
      } else setError(result.error);
      setLoading(false);
      return;
    }
    setPassword('');
    setConfirmation('');
    clearPasswordRecoveryContext();
    await logout({ localOnly: true });
    history.replace('/login?password_reset=1');
  }

  return <div className="auth-container">
    <section className="auth-card modern-auth-box" aria-labelledby="reset-password-title">
      <div className="auth-header">
        <div className="brand-logo-badge" aria-hidden="true">🌱</div>
        <h2>Food<span>Rescue</span></h2>
        <p>Choose a new password for your account</p>
      </div>
      <h3 id="reset-password-title">Reset password</h3>

      {linkState === 'checking' && <p role="status">Checking your password reset link…</p>}
      {LINK_MESSAGES[linkState] && <div className="auth-alert error" role="alert">
        <span>{LINK_MESSAGES[linkState]}</span>{' '}
        <button type="button" className="link-btn" onClick={() => history.replace('/forgot-password')}>Request a new link</button>
      </div>}
      {error && <div className="auth-alert error" role="alert">{error}</div>}

      {linkState === 'ready' && <form onSubmit={handleSubmit} noValidate aria-busy={loading}>
        <PasswordInput value={password} onChange={event => setPassword(event.target.value)} signup
          inputProps={{ id: 'recovery-password', maxLength: 128, autoComplete: 'new-password' }} disabled={loading} />
        <label htmlFor="recovery-password-confirm">Confirm new password <span className="req">*</span></label>
        <input id="recovery-password-confirm" type="password" value={confirmation} required maxLength={128}
          autoComplete="new-password" disabled={loading} onChange={event => setConfirmation(event.target.value)} />
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Updating password…' : 'Set new password'}
        </button>
      </form>}

      {linkState !== 'ready' && <div className="auth-footer">
        <button type="button" className="link-btn" onClick={() => history.replace('/login')}>Back to sign in</button>
      </div>}
    </section>
  </div>;
}
