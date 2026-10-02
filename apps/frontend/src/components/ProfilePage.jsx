import React from 'react';
import { useHistory } from 'react-router-dom';
import { 
  UtensilsCrossed, 
  Leaf, 
  Scale, 
  Award, 
  CheckCircle2, 
  LogOut, 
  Calendar,
  Sparkles,
  Settings,
  HelpCircle,
  Info,
  FileText,
  Shield,
  MessageCircle,
  ChevronRight
} from 'lucide-react';
import CustomerHeader from './CustomerHeader';

import { NumberTicker } from '../components/ui/calamansi/number-ticker';
import { logout } from '../services/auth';
import { getActiveClaims } from '../services/food';

export default function ProfilePage({ userProfile }) {
  const history = useHistory();
  const claims = getActiveClaims();
  const completedClaims = claims.filter((c) => c.status === 'picked_up');
  
  // Calculate dynamic metrics based on rescues
  const rescuedMeals = 14 + completedClaims.length;
  const co2Prevented = (rescuedMeals * 0.45).toFixed(1);
  const wasteDiverted = (rescuedMeals * 1.2).toFixed(1);

  async function handleSignOut() {
    await logout();
    history.push('/login');
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f5faee] flex flex-col font-['DM_Sans',sans-serif] pb-28 relative">
      <CustomerHeader active="profile" userProfile={userProfile} />

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
                  <CheckCircle2 size={11} className="text-emerald-500" /> Verified Rescuer
                </span>
              </div>
              <p className="text-sm font-medium text-[#687066] mt-1">{userProfile?.email || 'student@campus.edu'}</p>
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-3">
                <span className="text-[11px] font-bold text-[#182019] bg-white px-3 py-1.5 rounded-full capitalize border border-[#2a382e]/10 shadow-sm flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-slate-400"></span> Role: {userProfile?.role || 'student'}
                </span>
                <span className="text-[11px] font-bold text-[#0c6b20] bg-white px-3 py-1.5 rounded-full border border-emerald-200 shadow-sm flex items-center gap-1.5">
                  <Award size={13} className="text-emerald-500" /> Level 2 Zero-Waste Champion
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="text-rose-600 hover:text-rose-800 text-sm font-bold transition-colors flex items-center gap-1.5 px-2 py-1"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
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
            
            {/* Stat 1: Total Meals Rescued */}
            <div className="bg-white rounded-3xl p-6 border border-[#2a382e]/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="size-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#0c6b20] flex items-center justify-center mb-3">
                  <UtensilsCrossed size={18} />
                </div>
                <p className="text-xs font-bold text-[#687066] uppercase tracking-wider">Meals Rescued</p>
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

            {/* Stat 2: CO2 Saved */}
            <div className="bg-white rounded-3xl p-6 border border-[#2a382e]/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="size-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#0c6b20] flex items-center justify-center mb-3">
                  <Leaf size={18} />
                </div>
                <p className="text-xs font-bold text-[#687066] uppercase tracking-wider">CO₂ Prevented</p>
                <div className="mt-2">
                  <NumberTicker
                    value={parseFloat(co2Prevented)}
                    variant="citrus"
                    suffix=" kg"
                    className="text-2xl font-['Space_Grotesk'] font-extrabold"
                  />
                </div>
              </div>
              <small className="text-[11px] text-[#4c5b4f] block mt-3">Equivalent to charging 1,800 smartphones</small>
            </div>

            {/* Stat 3: Waste Diverted */}
            <div className="bg-white rounded-3xl p-6 border border-[#2a382e]/10 shadow-sm flex flex-col justify-between">
              <div>
                <div className="size-9 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#0c6b20] flex items-center justify-center mb-3">
                  <Scale size={18} />
                </div>
                <p className="text-xs font-bold text-[#687066] uppercase tracking-wider">Food Diverted</p>
                <div className="mt-2">
                  <NumberTicker
                    value={parseFloat(wasteDiverted)}
                    variant="slate"
                    suffix=" lbs"
                    className="text-2xl font-['Space_Grotesk'] font-extrabold"
                  />
                </div>
              </div>
              <small className="text-[11px] text-[#4c5b4f] block mt-3">Certified sustainable surplus weight</small>
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
            <div className="py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-emerald-50 text-[#0c6b20] flex items-center justify-center border border-emerald-200">
                  <Award size={16} />
                </div>
                <div>
                  <p className="font-bold text-xs text-[#182019]">Achieved Zero-Waste Badge</p>
                  <p className="text-[11px] text-[#687066]">Rescued over 10 campus meals this semester</p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-[#687066] flex items-center gap-1">
                <Calendar size={11} /> Yesterday
              </span>
            </div>

            <div className="py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-xl bg-emerald-50 text-[#0c6b20] flex items-center justify-center border border-emerald-200">
                  <UtensilsCrossed size={16} />
                </div>
                <div>
                  <p className="font-bold text-xs text-[#182019]">Main Library Cafe Rescue</p>
                  <p className="text-[11px] text-[#687066]">Claimed artisan ciabatta sandwiches</p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-[#687066] flex items-center gap-1">
                <Calendar size={11} /> Oct 2026
              </span>
            </div>
          </div>
        </section>

        {/* Settings & Support */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-[#2a382e]/10 shadow-sm">
          <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#182019] mb-4 flex items-center gap-2">
            <Settings size={16} className="text-[#687066]" />
            <span>Settings & Legal</span>
          </h3>
          <div className="divide-y divide-[#2a382e]/10">
            {[
              { icon: <HelpCircle size={16} />, label: "FAQ", desc: "Common questions about rescues" },
              { icon: <Info size={16} />, label: "About Us", desc: "Our campus sustainability mission" },
              { icon: <FileText size={16} />, label: "Terms of Service", desc: "Rules and usage guidelines" },
              { icon: <Shield size={16} />, label: "Privacy Policy", desc: "How we protect your data" },
              { icon: <MessageCircle size={16} />, label: "Contact Support", desc: "Get help with your account" }
            ].map((item, idx) => (
              <div key={idx} className="py-3.5 flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-xl bg-[#f0f6ed] text-[#4c5b4f] flex items-center justify-center border border-[#2a382e]/10 group-hover:bg-emerald-50 group-hover:text-[#2c8a38] group-hover:border-emerald-200 transition-colors">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-[#182019]">{item.label}</p>
                    <p className="text-[11px] text-[#687066]">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-[#8fa37d] group-hover:text-[#2c8a38] transition-colors" />
              </div>
            ))}
          </div>
        </section>

      </main>

      
    </div>
  );
}
