import AppearanceSettings from '../../components/auth/AppearanceSettings';
import ProfileHelp from '../../components/profile/ProfileHelp';
import React, { useEffect, useState } from 'react';
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
  ChevronRight
} from 'lucide-react';
import PageShell from '../../components/layout/PageShell';

import { NumberTicker } from '../../components/ui/calamansi/number-ticker';
import SignOutButton from '../../components/auth/SignOutButton';
import { getMyFoodClaims } from '../../services/food';
import { updateOwnProfile } from '../../services/auth';
import { profileFields, verifiedPortions } from '../../lib/profile-inputs';
import { friendlyError } from '../../services/request';
import { useSharedRefresh } from '../../lib/shared-refresh';

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
  useSharedRefresh(() => getMyFoodClaims().then(setClaims).catch(() => {}));
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
  return (
    <PageShell>
      <div className="h-full w-full overflow-y-auto flex flex-col font-['DM_Sans',sans-serif] pb-28 relative">

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        
        {/* Profile Card Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#2a382e]/10 shadow-sm mb-8 flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {userProfile?.avatar_url ? (
              <img
                src={userProfile.avatar_url}
                alt="Avatar"
                className="size-20 rounded-3xl object-cover ring-4 ring-[#2c8a38]/20 shadow-sm"
              />
            ) : (
              <div className="size-20 rounded-3xl bg-emerald-100 text-[#0c6b20] font-extrabold text-2xl flex items-center justify-center shadow-xs border border-emerald-300">
                {(userProfile?.full_name || 'U')[0].toUpperCase()}
              </div>
            )}
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

        <form onSubmit={saveProfile} className="bg-white rounded-3xl p-6 border border-[#2a382e]/10 mb-8 space-y-4">
          <h3 className="font-bold">Edit profile</h3>
          <label className="block text-sm">Full name
            <input required minLength={2} maxLength={100} value={fullName} onChange={e => setFullName(e.target.value)} className="block w-full border rounded-xl p-3 mt-1" />
          </label>
          <label className="block text-sm">Phone (optional, international format)
            <input type="tel" maxLength={16} placeholder="+639171234567" value={phone} onChange={e => setPhone(e.target.value)} className="block w-full border rounded-xl p-3 mt-1" />
          </label>
          {profileError && <p role="alert" className="text-rose-700">{profileError}</p>}
          {profileMessage && <p role="status">{profileMessage}</p>}
          <button disabled={saving} className="rounded-xl bg-emerald-800 text-white px-4 py-3 disabled:opacity-50">{saving ? 'Saving…' : 'Save profile'}</button>
        </form>
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
