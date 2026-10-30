import { friendlyError } from './request';
import { profileFields } from '../lib/profile-inputs';
import { supabase, isSupabaseConfigured } from './supabase';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { createRecoverySessionTracker, passwordRecoveryRedirect, requestPasswordRecovery as requestRecovery, saveRecoveredPassword } from '../lib/password-recovery.js';

const recoverySession = createRecoverySessionTracker();
let nativeRecoveryExchangePending = false;

function trackRecoverySession(event, session) {
  recoverySession.observe(event, session, nativeRecoveryExchangePending);
}

// Track Supabase's explicit recovery event before a recovery screen checks the session.
if (isSupabaseConfigured()) supabase.auth.onAuthStateChange(trackRecoverySession);

const DEMO_USERS = {
  'admin@campus.edu': {
    id: 'demo-admin-uuid',
    email: 'admin@campus.edu',
    full_name: 'Campus Administrator',
    phone: '555-0100',
    role: 'admin',
    status: 'active'
  },
  'student@campus.edu': {
    id: 'demo-student-uuid',
    email: 'student@campus.edu',
    full_name: 'Alex Student',
    phone: '555-0101',
    role: 'student',
    status: 'active'
  },
  'donor@campus.edu': {
    id: 'demo-donor-uuid',
    email: 'donor@campus.edu',
    full_name: 'Campus Dining (Provider)',
    phone: '555-0102',
    role: 'provider',
    status: 'active'
  }
};

/**
 * Sign in using existing email & password
 */
export async function login(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!isSupabaseConfigured()) {
    const user = DEMO_USERS[cleanEmail] || {
      id: 'demo-user-uuid',
      email: cleanEmail,
      full_name: cleanEmail.split('@')[0],
      role: 'student',
      status: 'active'
    };
    localStorage.setItem('foodrescue_demo_user', JSON.stringify(user));
    return { user, profile: user, error: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password
  });

  if (error) {
    let friendlyMessage = friendlyError(error);
    if (error.message.toLowerCase().includes('invalid login credentials')) {
      friendlyMessage = 'Invalid email or password. Please verify your credentials.';
    } else if (error.message.toLowerCase().includes('email not confirmed')) {
      friendlyMessage = 'Email address not yet confirmed. Please check your inbox for the confirmation link.';
    }
    return { user: null, profile: null, error: friendlyMessage };
  }

  // Fetch or upsert profile in public.profiles table
  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile) {
    const fallbackProfile = {
      id: data.user.id,
      full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || cleanEmail.split('@')[0],
      role: data.user.user_metadata?.role || 'student',
      status: 'active'
    };

    const { data: createdProfile } = await supabase
      .from('profiles')
      .upsert(fallbackProfile)
      .select()
      .maybeSingle();

    profile = createdProfile || fallbackProfile;
  }

  return {
    user: data.user,
    profile: profile || { role: data.user.user_metadata?.role || 'student' },
    error: null
  };
}

/**
 * Register a new user account with Supabase Auth & provision profile
 */
export async function register({ email, password, fullName, phone, role = 'student' }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (fullName || '').trim();
  const safeRole = ['student', 'org', 'provider'].includes(role) ? role : 'student';
  const cleanPhone = (phone || '').trim();

  if (!isSupabaseConfigured()) {
    const user = {
      id: 'demo-' + Date.now(),
      email: cleanEmail,
      full_name: cleanName,
      phone: cleanPhone,
      role: safeRole,
      status: 'active'
    };
    localStorage.setItem('foodrescue_demo_user', JSON.stringify(user));
    return { user, profile: user, error: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        full_name: cleanName,
        phone: cleanPhone,
        role: safeRole
      }
    }
  });

  if (error) {
    let friendlyMessage = friendlyError(error);
    if (error.message.toLowerCase().includes('already registered')) {
      friendlyMessage = 'An account with this email already exists. Please sign in instead.';
    }
    return { user: null, profile: null, error: friendlyMessage };
  }

  // Check if session was created or if email verification is required
  const requiresConfirmation = !data.session;

  const profile = {
    id: data.user?.id,
    full_name: cleanName,
    phone: cleanPhone,
    role: safeRole,
    status: 'active'
  };

  return {
    user: data.user,
    profile,
    requiresConfirmation,
    error: null
  };
}

/**
 * Sign in / Sign up via Google OAuth
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured()) {
    const demoGoogleUser = {
      id: 'demo-google-uuid',
      email: 'student.google@campus.edu',
      full_name: 'Campus Google Member',
      role: 'student',
      status: 'active'
    };
    localStorage.setItem('foodrescue_demo_user', JSON.stringify(demoGoogleUser));
    return { user: demoGoogleUser, profile: demoGoogleUser, error: null };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: Capacitor.isNativePlatform() ? 'org.foodrescue.campus://auth/callback' : `${window.location.origin}/login`,
      skipBrowserRedirect: Capacitor.isNativePlatform(),
    }
  });

  if (error) {
    return { data: null, error: friendlyError(error) };
  }

  if (Capacitor.isNativePlatform() && data?.url) {
    try { await Browser.open({ url: data.url }); }
    catch { return { data: null, error: 'Could not open Google sign-in. Please use email sign-in or try again.' }; }
  }
  return { data, error: null };
}

/**
 * Sign out
 */
export async function logout({ localOnly = false } = {}) {
  localStorage.removeItem('foodrescue_demo_user');
  clearPasswordRecoveryContext();
  if (isSupabaseConfigured()) {
    try {
      if (localOnly) await supabase.auth.signOut({ scope: 'local' });
      else await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
}

/**
 * Get current authenticated user profile
 */
export async function getCurrentProfile() {
  if (!isSupabaseConfigured()) {
    const stored = localStorage.getItem('foodrescue_demo_user');
    return stored ? JSON.parse(stored) : null;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();

  if (profile) return profile;

  // Auto-provision or update if missing (e.g. Google OAuth new user)
  const defaultProfile = {
    id: session.user.id,
    full_name: session.user.user_metadata?.full_name || 
               session.user.user_metadata?.name || 
               session.user.email?.split('@')[0] || 
               'Campus Member',
    role: session.user.user_metadata?.role || 'student',
    avatar_url: session.user.user_metadata?.avatar_url || 
                session.user.user_metadata?.picture || 
                null,
    status: 'active'
  };

  try {
    const { data: upserted } = await supabase
      .from('profiles')
      .upsert(defaultProfile)
      .select()
      .maybeSingle();
    return upserted || defaultProfile;
  } catch {
    return defaultProfile;
  }
}

/**
 * Listen to auth state transitions (e.g. OAuth callback completion)
 */
export async function updateOwnProfile(fields) {
  const values = profileFields(fields);
  if (!isSupabaseConfigured()) throw new Error('Connect to the shared service to edit your profile.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Sign in to edit your profile.');
  const { data, error } = await supabase.from('profiles').update(values).eq('id', session.user.id).select().single();
  if (error) throw new Error(friendlyError(error));
  window.dispatchEvent(new CustomEvent('foodrescue:profile_updated', { detail: data }));
  return data;
}

export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured()) return { unsubscribe: () => {} };
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    trackRecoverySession(event, session);
    callback(nativeRecoveryExchangePending && event === 'SIGNED_IN' ? 'PASSWORD_RECOVERY' : event, session);
  });
  return subscription;
}

export async function requestPasswordRecovery(email) {
  if (!isSupabaseConfigured()) {
    return { error: 'Password recovery is unavailable until the shared service is connected.' };
  }
  const redirectTo = passwordRecoveryRedirect({
    native: Capacitor.isNativePlatform(),
    origin: typeof window === 'undefined' ? '' : window.location.origin,
  });
  return requestRecovery({ auth: supabase.auth, email, redirectTo });
}

export async function hasPasswordRecoverySession() {
  if (!isSupabaseConfigured()) return false;
  try {
    // Await URL callback handling before checking the in-memory recovery marker.
    await supabase.auth.initialize();
    const { data: { session } } = await supabase.auth.getSession();
    // Supabase queues PASSWORD_RECOVERY immediately after initialization resolves.
    await new Promise(resolve => setTimeout(resolve, 0));
    return recoverySession.matches(session);
  } catch {
    return false;
  }
}

export function clearPasswordRecoveryContext() {
  recoverySession.clear();
}

/** Exchange the one-time native PKCE recovery code and mark only its resulting session. */
export async function completeNativePasswordRecovery(code) {
  if (!isSupabaseConfigured() || !code) return { error: 'This reset link is invalid or expired.' };
  nativeRecoveryExchangePending = true;
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !recoverySession.set(data?.session)) {
      recoverySession.clear();
      return { error: 'This reset link is invalid, expired, or has already been used.' };
    }
    return { error: null };
  } catch {
    recoverySession.clear();
    return { error: 'This reset link is invalid, expired, or has already been used.' };
  } finally {
    nativeRecoveryExchangePending = false;
  }
}

export async function updatePasswordFromRecovery(password, confirmation) {
  if (!isSupabaseConfigured()) return { error: 'Password recovery is unavailable until the shared service is connected.' };
  const result = await saveRecoveredPassword({
    auth: supabase.auth,
    password,
    confirmation,
    hasRecoverySession: hasPasswordRecoverySession,
  });
  if (!result.error) clearPasswordRecoveryContext();
  return result;
}
