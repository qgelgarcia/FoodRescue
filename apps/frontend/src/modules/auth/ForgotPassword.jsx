import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { requestPasswordRecovery } from '../../services/auth';

export default function ForgotPassword() {
  const history = useHistory();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitted(false);
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
      setError('Enter a valid email address.');
      return;
    }

    setLoading(true);
    const result = await requestPasswordRecovery(cleanEmail);
    if (result.error) setError(result.error);
    else setSubmitted(true);
    setLoading(false);
  }

  return <div className="auth-container">
    <section className="auth-card modern-auth-box" aria-labelledby="forgot-password-title">
      <div className="auth-header">
        <div className="brand-logo-badge" aria-hidden="true">🌱</div>
        <h2>Food<span>Rescue</span></h2>
        <p>Reset your campus account password</p>
      </div>
      <h3 id="forgot-password-title">Forgot password?</h3>
      <p>Enter the email address for your account and we’ll provide recovery instructions if an account matches.</p>

      {error && <div className="auth-alert error" role="alert">{error}</div>}
      {submitted && <div className="auth-alert success" role="status">
        If an account exists for this email, recovery instructions will arrive shortly. Check your inbox and spam folder.
      </div>}

      <form onSubmit={handleSubmit} noValidate aria-busy={loading}>
        <label htmlFor="recovery-email">Email Address <span className="req">*</span></label>
        <input id="recovery-email" type="email" value={email} onChange={event => setEmail(event.target.value)}
          autoComplete="email" maxLength={254} required disabled={loading} placeholder="e.g. user@campus.edu" />
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Requesting recovery…' : 'Send recovery instructions'}
        </button>
      </form>
      <div className="auth-footer">
        <button type="button" className="link-btn" onClick={() => history.replace('/login')}>Back to sign in</button>
      </div>
    </section>
  </div>;
}
