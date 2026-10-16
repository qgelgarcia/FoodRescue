import PasswordInput from '../../components/auth/PasswordInput';
import PhoneInput from '../../components/auth/PhoneInput';
import { phoneCountry as getPhoneCountry } from '../../lib/account-inputs';
import { useAccountFields } from './useAccountFields';
import { friendlyError } from '../../services/request';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { register, signInWithGoogle } from '../../services/auth';

export default function Register() {
  const history = useHistory();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('PH');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  const { field, message, valid } = useAccountFields({ email, password, fullName, phone, phoneCountry, confirmPassword, role }, true);



  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (loading || oauthLoading || !valid) return;
    const cleanEmail = email.trim();
    const cleanName = fullName.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      setError('Please provide a name between 2 and 80 characters.');
      return;
    }

    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify both fields.');
      return;
    }


    setLoading(true);

    try {
      const { user, profile, requiresConfirmation, error: err } = await register({
        fullName: cleanName,
        email: cleanEmail,
        password,
        phone: phone ? `${getPhoneCountry(phoneCountry).code}${phone}` : '',
        role
      });

      if (err) {
        setError(err);
      } else if (requiresConfirmation) {
        setSuccessMsg('Registration successful! Please check your email to confirm your account.');
        setTimeout(() => history.push('/login'), 3000);
      } else {
        setSuccessMsg('Account created successfully! Redirecting...');
        setTimeout(() => {
          if (profile?.role === 'admin') {
            history.push('/admin/dashboard');
          } else {
            history.push('/app/home-feed');
          }
        }, 1000);
      }
    } catch (ex) {
      setError(friendlyError(ex));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setError('');
    if (loading || oauthLoading) return;
    setOauthLoading(true);
    try {
      const { error: err } = await signInWithGoogle();
      if (err) {
        setError(err);
      }
    } catch (ex) {
      setError(friendlyError(ex));
    } finally {
      setOauthLoading(false);
    }
  }


  return (
    <div className="auth-container">
      <div className="auth-card modern-auth-box">
        <div className="auth-header">
          <div className="brand-logo-badge">🌱</div>
          <h2>Create Account</h2>
          <p>Join FoodRescue to share or claim surplus campus food</p>
        </div>

        {error && (
          <div className="auth-alert error" role="alert">
            <span className="alert-symbol">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="auth-alert success" role="alert">
            <span className="alert-symbol">✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading || oauthLoading}
          className="btn-google"
        >
          {oauthLoading ? (
            <span className="spinner-sm"></span>
          ) : (
            <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          )}
          <span>Sign up with Google</span>
        </button>

        <p role="status" aria-live="polite">{oauthLoading ? 'Connecting to Google…' : loading ? 'Please wait while we complete your request…' : ''}</p>
        <div className="auth-divider">
          <span>or sign up with email</span>
        </div>

        <form onSubmit={handleRegister} noValidate aria-busy={loading}>
          <label>
            Full Name <span className="req">*</span>
            <input {...field('fullName')}
              type="text"
              required
              placeholder="e.g. Jordan Smith"
              value={fullName}
              disabled={loading}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
              {message('fullName')}
          </label>

          <label>
            Email Address <span className="req">*</span>
            <input {...field('email')}
              type="email"
              required
              placeholder="e.g. jsmith@campus.edu"
              value={email}
              disabled={loading}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
              {message('email')}
          </label>

          <PasswordInput value={password} onChange={event => setPassword(event.target.value)} signup={true}
            inputProps={field('password')} error={message('password')} disabled={loading || oauthLoading} />

          <label>
            Confirm Password <span className="req">*</span>
            <input {...field('confirmPassword')}
              type="password"
              required
              placeholder="Repeat password"
              value={confirmPassword}
              disabled={loading}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
              {message('confirmPassword')}
          </label>

          <PhoneInput value={phone} onChange={setPhone} countryId={phoneCountry} onCountryChange={setPhoneCountry}
                inputProps={field('phone')} error={message('phone')} disabled={loading || oauthLoading} />

          <label>
            Campus Role <span className="req">*</span>
            <select value={role} disabled={loading} onChange={(e) => setRole(e.target.value)}>
              <option value="student">🎓 Student (Browse & Claim Food)</option>
              <option value="provider">🥗 Food Provider / Dining Hall (Donate Surplus)</option>
              <option value="org">🏛️ Student Organization</option>
            </select>
          </label>

          <button type="submit" disabled={!valid || loading || oauthLoading} className="btn-primary">
            {loading ? (
              <span className="btn-spinner-content">
                <span className="spinner-sm"></span> Creating Account...
              </span>
            ) : (
              'Create Campus Account'
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already registered? <button type="button" className="link-btn" onClick={() => history.push('/login')}>Sign in here</button>
        </div>
      </div>
    </div>
  );
}
