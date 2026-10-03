import React, { useState, useEffect, useRef } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { login, register, signInWithGoogle, getCurrentProfile, onAuthStateChange } from '../../services/auth';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 30;
const LOCKOUT_KEY = 'fr_login_lockout_until';
const ATTEMPTS_KEY = 'fr_login_failed_attempts';

export default function Login() {
  const history = useHistory();
  const location = useLocation();

  // Mode: 'signin' or 'signup'
  const [mode, setMode] = useState('signin');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('student');
  const [phone, setPhone] = useState('');

  // UI & Security Guardrail States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [activeDemoRole, setActiveDemoRole] = useState('');

  // Rate Limiting / Lockout Guardrail
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const timerRef = useRef(null);

  // Check rate limiting on mount & start timer if locked out
  useEffect(() => {
    checkLockoutState();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function checkLockoutState() {
    const lockoutUntil = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0', 10);
    const now = Date.now();
    if (lockoutUntil > now) {
      const remaining = Math.ceil((lockoutUntil - now) / 1000);
      setLockoutSeconds(remaining);
      startLockoutCountdown(remaining);
    }
  }

  function startLockoutCountdown(initialSeconds) {
    if (timerRef.current) clearInterval(timerRef.current);
    setLockoutSeconds(initialSeconds);

    timerRef.current = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          localStorage.removeItem(LOCKOUT_KEY);
          localStorage.setItem(ATTEMPTS_KEY, '0');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function recordFailedAttempt() {
    const currentAttempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10) + 1;
    localStorage.setItem(ATTEMPTS_KEY, currentAttempts.toString());

    if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockoutUntil = Date.now() + (LOCKOUT_DURATION_SECONDS * 1000);
      localStorage.setItem(LOCKOUT_KEY, lockoutUntil.toString());
      startLockoutCountdown(LOCKOUT_DURATION_SECONDS);
      setError(`Too many failed attempts. Login is temporarily locked for ${LOCKOUT_DURATION_SECONDS} seconds for your security.`);
    }
  }

  function clearFailedAttempts() {
    localStorage.removeItem(ATTEMPTS_KEY);
    localStorage.removeItem(LOCKOUT_KEY);
    setLockoutSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  // Guardrail: Check active session on mount & handle OAuth callback redirects
  useEffect(() => {
    // 1. Check for OAuth hash errors (e.g. user cancelled or provider disabled)
    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const errorDesc = hashParams.get('error_description');
      if (errorDesc) {
        setError(`OAuth Error: ${decodeURIComponent(errorDesc)}`);
        // Clean URL hash without refreshing
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    // 2. Check if user is already authenticated
    getCurrentProfile().then((profile) => {
      if (profile) {
        navigateUser(profile);
      }
    });

    // 3. Listen to auth state transitions (fires when Google OAuth completes)
    const subscription = onAuthStateChange(async (event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        const profile = await getCurrentProfile();
        if (profile) {
          clearFailedAttempts();
          navigateUser(profile);
        }
      }
    });

    return () => {
      if (subscription?.unsubscribe) subscription.unsubscribe();
    };
  }, []);

  function navigateUser(profile) {
    if (profile?.role === 'admin') {
      history.push('/admin/dashboard');
    } else {
      history.push('/app/home-feed');
    }
  }

  // Guardrail: Client-side Input Validation & Sanitization
  function validateInputs() {
    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return false;
    }
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address (e.g., student@campus.edu).');
      return false;
    }
    const demoMode = !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!password && (mode === 'signup' || !demoMode)) {
      setError('Please enter your password.');
      return false;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return false;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return false;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify both fields.');
        return false;
      }
    }

    return true;
  }

  // Password Strength Calculator Guardrail
  function getPasswordStrength(pwd) {
    if (!pwd) return { score: 0, text: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score: 1, text: 'Weak', color: '#ef4444' };
    if (score <= 4) return { score: 2, text: 'Medium', color: '#f59e0b' };
    return { score: 3, text: 'Strong', color: '#22c55e' };
  }

  // Handle Form Submission (Sign In or Sign Up)
  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Lockout Guardrail Check
    if (lockoutSeconds > 0) {
      setError(`Login is locked. Please wait ${lockoutSeconds}s before retrying.`);
      return;
    }

    // Input Validation Guardrail
    if (!validateInputs()) return;

    setLoading(true);

    try {
      if (mode === 'signin') {
        const { profile, error: err } = await login(email, password);
        if (err) {
          recordFailedAttempt();
          setError(err);
        } else if (profile) {
          clearFailedAttempts();
          navigateUser(profile);
        }
      } else {
        // Account Creation
        const { user, profile, requiresConfirmation, error: err } = await register({
          email,
          password,
          fullName,
          phone,
          role
        });

        if (err) {
          setError(err);
        } else if (requiresConfirmation) {
          setSuccessMsg('Account created successfully! Please check your email to confirm your account, then sign in.');
          setMode('signin');
          setPassword('');
          setConfirmPassword('');
        } else if (profile || user) {
          clearFailedAttempts();
          setSuccessMsg('Account created successfully! Redirecting...');
          setTimeout(() => {
            navigateUser(profile || { role });
          }, 1000);
        }
      }
    } catch (ex) {
      setError(ex.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Google OAuth Handler
  async function handleGoogleAuth() {
    setError('');
    setSuccessMsg('');
    setOauthLoading(true);

    try {
      const { error: err } = await signInWithGoogle();
      if (err) {
        if (err.includes('provider is not enabled')) {
          setError('Google Sign-In is not enabled yet in this Supabase project. You can enable it in the Supabase Dashboard under Authentication > Providers.');
        } else {
          setError(err);
        }
      }
    } catch (ex) {
      setError(ex.message || 'Failed to initialize Google authentication.');
    } finally {
      setOauthLoading(false);
    }
  }

  // Quick fill helper for demo accounts
  function fillDemo(demoEmail, demoRole, label) {
    setEmail(demoEmail);
    setPassword('');
    setActiveDemoRole(label);
    setMode('signin');
    setError('');
    setSuccessMsg('Demo email filled. Local demo mode accepts the sign-in without a password.');
  }

  const pwdStrength = mode === 'signup' ? getPasswordStrength(password) : null;

  return (
    <div className="auth-container">
      <div className="auth-card modern-auth-box">
        
        {/* Brand Header */}
        <div className="auth-header">
          <div className="brand-logo-badge">🌱</div>
          <h2>Food<span>Rescue</span></h2>
          <p>Campus surplus food sharing & rescue platform</p>
        </div>

        {/* Mode Selector Tabs (Sign In vs Create Account) */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
          >
            Create Account
          </button>
        </div>

        {/* Feedback / Alert Banners */}
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

        {/* Rate Limiting Lockout Banner */}
        {lockoutSeconds > 0 && (
          <div className="auth-alert warning">
            <span className="alert-symbol">⏳</span>
            <span>Security lockout active. Please wait <b>{lockoutSeconds}s</b> before retrying.</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading || oauthLoading || lockoutSeconds > 0}
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
          <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
        </button>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} noValidate>
          
          {/* Sign Up Fields: Full Name & Role */}
          {mode === 'signup' && (
            <>
              <label>
                Full Name <span className="req">*</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Smith"
                  value={fullName}
                  disabled={loading || lockoutSeconds > 0}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </label>

              <label>
                Campus Role <span className="req">*</span>
                <select
                  value={role}
                  disabled={loading || lockoutSeconds > 0}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="student">🎓 Student (Browse & Claim Food)</option>
                  <option value="provider">🥗 Food Provider / Dining Hall (Donate Surplus)</option>
                  <option value="org">🏛️ Student Organization</option>
                </select>
              </label>

              <label>
                Phone Number (Optional)
                <input
                  type="tel"
                  placeholder="e.g. 555-0123"
                  value={phone}
                  disabled={loading || lockoutSeconds > 0}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </label>
            </>
          )}

          {/* Email Address */}
          <label>
            Email Address <span className="req">*</span>
            <input
              type="email"
              required
              placeholder="e.g. user@campus.edu"
              value={email}
              disabled={loading || lockoutSeconds > 0}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>

          {/* Password Field with Show/Hide Toggle */}
          <label>
            <div className="label-header">
              <span>Password <span className="req">*</span></span>
              <button
                type="button"
                className="btn-toggle-eye"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={mode === 'signup' ? 8 : 1}
              placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
              value={password}
              disabled={loading || lockoutSeconds > 0}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </label>

          {/* Real-time Password Strength Meter on Sign Up */}
          {mode === 'signup' && password.length > 0 && (
            <div className="pwd-meter-box">
              <div className="pwd-bars">
                <div className={`bar ${pwdStrength.score >= 1 ? 'active' : ''}`} style={{ backgroundColor: pwdStrength.score >= 1 ? pwdStrength.color : '' }}></div>
                <div className={`bar ${pwdStrength.score >= 2 ? 'active' : ''}`} style={{ backgroundColor: pwdStrength.score >= 2 ? pwdStrength.color : '' }}></div>
                <div className={`bar ${pwdStrength.score >= 3 ? 'active' : ''}`} style={{ backgroundColor: pwdStrength.score >= 3 ? pwdStrength.color : '' }}></div>
              </div>
              <small style={{ color: pwdStrength.color }}>Strength: {pwdStrength.text}</small>
            </div>
          )}

          {/* Confirm Password Field on Sign Up */}
          {mode === 'signup' && (
            <label>
              <div className="label-header">
                <span>Confirm Password <span className="req">*</span></span>
                <button
                  type="button"
                  className="btn-toggle-eye"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex="-1"
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                placeholder="Repeat password"
                value={confirmPassword}
                disabled={loading || lockoutSeconds > 0}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
          )}

          {/* Primary Submit Button with Double-Submit Prevention */}
          <button
            type="submit"
            disabled={loading || oauthLoading || lockoutSeconds > 0}
            className="btn-primary"
          >
            {loading ? (
              <span className="btn-spinner-content">
                <span className="spinner-sm"></span>
                <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
              </span>
            ) : (
              <span>{mode === 'signin' ? 'Sign In' : 'Create Campus Account'}</span>
            )}
          </button>
        </form>

        {/* Demo Account Shortcuts (for quick evaluation & testing) */}
        {mode === 'signin' && (
          <div className="demo-shortcuts">
            <div className="demo-shortcuts-header">
              <small>⚡ Quick Fill Demo Accounts:</small>
              {activeDemoRole && <span className="active-demo-pill">{activeDemoRole}</span>}
            </div>
            <div className="chips">
              <button 
                type="button" 
                onClick={() => fillDemo('admin@campus.edu', 'admin', 'Admin')}
              >
                Admin
              </button>
              <button 
                type="button" 
                onClick={() => fillDemo('student@campus.edu', 'student', 'Student')}
              >
                Student
              </button>
              <button 
                type="button" 
                onClick={() => fillDemo('donor@campus.edu', 'provider', 'Provider')}
              >
                Provider
              </button>
            </div>
          </div>
        )}

        {/* Footer Toggle */}
        <div className="auth-footer">
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => { setMode('signup'); setError(''); setSuccessMsg(''); }}
              >
                Create one now
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => { setMode('signin'); setError(''); setSuccessMsg(''); }}
              >
                Sign in here
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
