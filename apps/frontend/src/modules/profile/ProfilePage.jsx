import AppearanceSettings from '../../components/auth/AppearanceSettings';
import ProfileHelp from '../../components/profile/ProfileHelp';
import React, { useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { 
  UtensilsCrossed, 
  LogOut,
  Award, 
  CheckCircle2, 
  Sparkles,
  Settings,
  HelpCircle,
  Info,
  FileText,
  Shield,
  MessageCircle,
  ChevronRight,
  Camera,
  ImagePlus,
  Trash2,
  Check,
  X
} from 'lucide-react';
import PageShell from '../../components/layout/PageShell';

import { NumberTicker } from '../../components/ui/calamansi/number-ticker';
import SignOutButton from '../../components/auth/SignOutButton';
import ProfileAvatar from '../../components/profile/ProfileAvatar';
import { getMyFoodClaims } from '../../services/food';
import { updateOwnProfile } from '../../services/auth';
import { profileFields, verifiedPortions } from '../../lib/profile-inputs';
import { validateProfileAvatarFile } from '../../lib/profile-avatar';
import {
  publishReconciledProfileUpdate,
  readOwnProfileAvatar,
  removeUnreferencedOwnProfileAvatar,
  saveOwnProfileAvatarReference,
  uploadOwnProfileAvatar,
} from '../../services/profile-avatars';
import { friendlyError } from '../../services/request';
import { useSharedRefresh } from '../../lib/shared-refresh';
import './ProfilePage.css';

export default function ProfilePage({ userProfile }) {
  const history = useHistory();
  const [claims, setClaims] = useState([]);
  useEffect(() => {
    getMyFoodClaims().then(setClaims).catch(() => {});
  }, []);
  const [fullName, setFullName] = useState(userProfile?.full_name || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [savedAvatarUrl, setSavedAvatarUrl] = useState(userProfile?.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const avatarInput = useRef(null);
  const cameraInput = useRef(null);
  const photoActions = useRef(null);
  useSharedRefresh(() => getMyFoodClaims().then(setClaims).catch(() => {}));
  useEffect(() => setSavedAvatarUrl(userProfile?.avatar_url || null), [userProfile?.avatar_url]);
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);
  const rescuedMeals = verifiedPortions(claims);
  const completedClaims = claims.filter(c => !c.is_sample && c.status === 'picked_up');
  async function saveProfile(event) {
    event.preventDefault();
    setSaving(true); setProfileError(''); setProfileMessage('');
    try {
      try { profileFields({ fullName, phone }); }
      catch (error) { setProfileError(error.message); return; }
      await updateOwnProfile({ fullName, phone });
      setProfileMessage('Profile saved.');
    } catch (error) { setProfileError(friendlyError(error)); }
    finally { setSaving(false); }
  }

  function chooseAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validationError = validateProfileAvatarFile(file);
    if (validationError) {
      setAvatarError(validationError);
      setAvatarMessage('');
      return;
    }
    setAvatarFile(file);
    setAvatarError('');
    setAvatarMessage('');
  }

  async function saveAvatar() {
    if (!avatarFile || avatarSaving) return;
    const previousReference = savedAvatarUrl;
    setAvatarSaving(true);
    setAvatarError('');
    setAvatarMessage('');
    try {
      const nextReference = await uploadOwnProfileAvatar(avatarFile);
      let profile;
      try {
        profile = await saveOwnProfileAvatarReference(nextReference);
      } catch (writeError) {
        let reconciled;
        try {
          reconciled = await readOwnProfileAvatar();
        } catch {
          throw new Error('We could not confirm whether the photo was saved. Your previous photo has not been removed; refresh your profile to check.');
        }
        if (!reconciled) {
          throw new Error('We could not confirm whether the photo was saved. Your previous photo has not been removed; refresh your profile to check.');
        }
        publishReconciledProfileUpdate(reconciled);
        if (reconciled.avatar_url !== nextReference) {
          try { await removeUnreferencedOwnProfileAvatar(nextReference); } catch { /* Keep the existing profile photo if cleanup is unavailable. */ }
          setSavedAvatarUrl(reconciled.avatar_url || null);
          if (reconciled.avatar_url === previousReference) {
            throw new Error('Photo was not saved. Your previous photo is still in place.');
          }
          throw new Error('Your profile photo changed before this save finished. The current saved photo is shown.');
        }
        profile = reconciled;
      }

      setSavedAvatarUrl(profile.avatar_url || nextReference);
      setAvatarFile(null);
      let cleanupMessage = '';
      if (previousReference && previousReference !== nextReference) {
        try {
          await removeUnreferencedOwnProfileAvatar(previousReference);
        } catch {
          cleanupMessage = 'Photo saved. The previous private file could not be removed yet.';
        }
      }
      setAvatarMessage(cleanupMessage || 'Profile photo saved.');
      if (photoActions.current) photoActions.current.open = false;
    } catch (error) {
      setAvatarError(error.message || friendlyError(error));
      setAvatarFile(null);
    } finally {
      setAvatarSaving(false);
    }
  }

  async function removeAvatar() {
    if (!savedAvatarUrl || avatarSaving) return;
    const previousReference = savedAvatarUrl;
    setAvatarSaving(true);
    setAvatarError('');
    setAvatarMessage('');
    try {
      let profile;
      try {
        profile = await saveOwnProfileAvatarReference(null);
      } catch {
        try {
          profile = await readOwnProfileAvatar();
        } catch {
          throw new Error('We could not confirm whether the photo was removed. Your previous photo has not been deleted; refresh your profile to check.');
        }
        if (!profile) {
          throw new Error('We could not confirm whether the photo was removed. Your previous photo has not been deleted; refresh your profile to check.');
        }
        publishReconciledProfileUpdate(profile);
        if (profile.avatar_url !== null) {
          setSavedAvatarUrl(profile.avatar_url || null);
          throw new Error(profile.avatar_url === previousReference
            ? 'Photo was not removed. Your previous photo is still in place.'
            : 'Your profile photo changed before removal finished. The current saved photo is shown.');
        }
      }

      setSavedAvatarUrl(null);
      setAvatarFile(null);
      let cleanupMessage = '';
      try {
        await removeUnreferencedOwnProfileAvatar(previousReference);
      } catch {
        cleanupMessage = 'Photo removed from your profile. Its previous private file could not be deleted yet.';
      }
      setAvatarMessage(cleanupMessage || 'Profile photo removed.');
      if (photoActions.current) photoActions.current.open = false;
    } catch (error) {
      setAvatarError(error.message || friendlyError(error));
    } finally {
      setAvatarSaving(false);
    }
  }

  function cancelAvatarPreview() {
    setAvatarFile(null);
    setAvatarError('');
    setAvatarMessage('');
  }

  return (
    <PageShell>
      <div className="h-full w-full overflow-y-auto flex flex-col font-['DM_Sans',sans-serif] pb-28 relative">

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        
        {/* Profile Card Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#2a382e]/10 shadow-sm mb-8 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="profile-avatar-editor">
            <ProfileAvatar
              avatarUrl={avatarPreviewUrl || savedAvatarUrl}
              fullName={userProfile?.full_name}
              className="size-20 shrink-0 overflow-hidden rounded-3xl ring-4 ring-[#2c8a38]/20 shadow-sm"
              imageClassName="size-full rounded-[inherit] object-cover"
              fallbackClassName="flex size-full items-center justify-center rounded-[inherit] border border-emerald-300 bg-emerald-100 text-2xl font-extrabold text-[#0c6b20]"
            />
            <details ref={photoActions} className="profile-photo-actions" onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.currentTarget.open = false;
                event.currentTarget.querySelector('summary')?.focus();
              }
            }}>
              <summary aria-label="Edit profile photo" title="Edit profile photo"><Camera size={18} aria-hidden="true" /></summary>
              <div className="profile-photo-options">
                <input ref={avatarInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} aria-label="Choose profile photo" />
                <input ref={cameraInput} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={chooseAvatar} aria-label="Take profile photo" />
                <button type="button" disabled={avatarSaving} onClick={() => avatarInput.current?.click()}><ImagePlus size={17} aria-hidden="true" />Choose photo</button>
                <button type="button" disabled={avatarSaving} onClick={() => cameraInput.current?.click()}><Camera size={17} aria-hidden="true" />Take photo</button>
                {avatarFile ? <>
                  <button type="button" disabled={avatarSaving} onClick={saveAvatar}><Check size={17} aria-hidden="true" />{avatarSaving ? 'Saving…' : 'Save photo'}</button>
                  <button type="button" disabled={avatarSaving} onClick={cancelAvatarPreview}><X size={17} aria-hidden="true" />Cancel</button>
                </> : savedAvatarUrl && <button type="button" disabled={avatarSaving} onClick={removeAvatar} className="profile-photo-remove"><Trash2 size={17} aria-hidden="true" />{avatarSaving ? 'Removing…' : 'Remove photo'}</button>}
              </div>
            </details>
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h1 className="font-['Space_Grotesk'] text-2xl sm:text-3xl font-extrabold text-[#182019] tracking-tight drop-shadow-sm">
                  {userProfile?.full_name || 'Campus Member'}
                </h1>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-100 to-emerald-50 text-[#0c6b20] border border-emerald-200/60 shadow-sm flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-emerald-500" /> Campus Member
                </span>
              </div>
              {userProfile?.email && <p className="text-sm font-medium text-[#687066] mt-1">{userProfile.email}</p>}
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-3">
                <span className="text-[11px] font-bold text-[#182019] bg-white px-3 py-1.5 rounded-full capitalize border border-[#2a382e]/10 shadow-sm flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-slate-400"></span> Role: {userProfile?.role || 'student'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
          <button type="button" onClick={() => history.push('/app/reports')} className="member-report-link">My Reports</button>
          <SignOutButton
            className="text-rose-600 hover:text-rose-800 text-sm font-bold transition-colors flex items-center gap-1.5 px-2 py-1"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </SignOutButton>
          </div>
        </div>

        {avatarError && <p role="alert" className="profile-photo-feedback is-error">{avatarError}</p>}
        {avatarMessage && <p role="status" className="profile-photo-feedback">{avatarMessage}</p>}

        <form onSubmit={saveProfile} className="profile-edit-form" aria-labelledby="edit-profile-heading">
          <h2 id="edit-profile-heading">Edit profile</h2>
          <div className="profile-edit-fields">
            <label htmlFor="profile-name">Full name
              <input id="profile-name" name="name" autoComplete="name" required minLength={2} maxLength={100} value={fullName} onChange={e => { setFullName(e.target.value); setProfileMessage(''); }} />
            </label>
            <label htmlFor="profile-phone">Phone <span>(optional)</span>
              <input id="profile-phone" name="tel" type="tel" autoComplete="tel" maxLength={16} placeholder="+639171234567" value={phone} onChange={e => { setPhone(e.target.value); setProfileMessage(''); }} />
            </label>
            <button type="submit" disabled={saving} className="profile-save-button">{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
          {profileError && <p role="alert" className="profile-form-feedback is-error">{profileError}</p>}
          {profileMessage && <p role="status" className="profile-form-feedback">{profileMessage}</p>}
        </form>

        {/* Live Odometer Impact Telemetry Section */}
        <section className="mb-8">
          <div className="mb-4">
            <h2 className="font-['Space_Grotesk'] text-xl font-bold text-[#182019]">
              Your Ecological Impact
            </h2>
            <p className="text-xs text-[#4c5b4f]">
              Realtime telemetry calculated from your campus meal rescues and food donations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            
            {/* Stat 1: Total Portions Rescued */}
            <div className="bg-white rounded-3xl p-6 border border-[#2a382e]/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="size-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#0c6b20] flex items-center justify-center mb-3">
                  <UtensilsCrossed size={18} />
                </div>
                <p className="text-xs font-bold text-[#687066] uppercase tracking-wider">Portions Rescued</p>
                <div className="mt-2">
                  <NumberTicker
                    value={rescuedMeals}
                    variant="calamansi"
                    className="text-2xl font-['Space_Grotesk'] font-extrabold"
                  />
                </div>
              </div>
              <small className="text-[11px] text-[#4c5b4f] block mt-3">Diverted from campus compost & waste</small>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-[#2a382e]/10 shadow-sm">
              <p className="text-xs font-bold uppercase">Verified pickups</p>
              <p className="mt-2 text-2xl font-bold">{completedClaims.length}</p>
              <p className="mt-3 text-xs">Only donor-confirmed pickups count toward your totals.</p>
            </div>
          </div>
        </section>
        {/* Recent Activity Log */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#2a382e]/10 shadow-sm mb-8">
          <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#182019] mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-[#2c8a38]" />
            <span>Recent Rescue Milestones</span>
          </h3>
          <div className="divide-y divide-[#2a382e]/10">
            {completedClaims.length === 0 && <p className="text-sm">Your verified pickups will appear here.</p>}
            {completedClaims.slice(0, 5).map(claim => <div key={claim.id} className="py-3">
              <p className="font-bold text-sm">{claim.post_title}</p>
              <p className="text-xs">{claim.quantity} portions · Verified pickup</p>
            </div>)}
          </div>
        </section>

        {/* Settings & Support */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#2a382e]/10 shadow-sm">
          <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#182019] mb-4 flex items-center gap-2">
            <Settings size={16} className="text-[#687066]" />
            <span>Settings & Legal</span>
          </h3>
          <AppearanceSettings />
          <ProfileHelp />
        </section>

      </main>

      
      </div>
    </PageShell>
  );
}
