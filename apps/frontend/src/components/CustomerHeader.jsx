import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { IonHeader } from '@ionic/react';
import { 
  Leaf, 
  Ticket,
  MapPin,
  Clock,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  X
} from 'lucide-react';
import { Marquee } from './ui/calamansi/marquee';
import { motion, AnimatePresence } from 'motion/react';

import { getActiveClaims, completeClaim } from '../services/food';

export default function CustomerHeader({ active, userProfile }) {
  const history = useHistory();
  const [activeClaims, setActiveClaims] = useState([]);
  const [isPickupModalOpen, setIsPickupModalOpen] = useState(false);

  useEffect(() => {
    loadClaims();
    const handleUpdate = () => loadClaims();
    window.addEventListener('foodrescue:claim_updated', handleUpdate);
    return () => window.removeEventListener('foodrescue:claim_updated', handleUpdate);
  }, []);

  function loadClaims() {
    const claims = getActiveClaims();
    const pending = claims.filter((c) => c.status === 'ready_for_pickup');
    setActiveClaims(pending);
  }

  const latestClaim = activeClaims[0];

  function handleMarkPickedUp(e, claimId) {
    e.stopPropagation();
    completeClaim(claimId);
    setIsPickupModalOpen(false);
    loadClaims();
  }

  return (
    <>
      <IonHeader className="w-full border-b border-[#2a382e]/10 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        


        {/* Main Navigation Bar */}
        <header className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          
          {/* Brand */}
          <button
            type="button"
            aria-label="Go to the FoodRescue home feed"
            className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0 border-0 bg-transparent p-0 text-left"
            onClick={() => history.push('/app/home-feed')}
          >
            <div className="size-9 rounded-2xl bg-[#2c8a38] text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition-transform">
              <Leaf size={18} />
            </div>
            <div className="font-['Space_Grotesk'] text-xl font-bold tracking-tight text-[#182019]">
              Food<span className="text-[#2c8a38]">Rescue</span>
            </div>
          </button>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Active Pickup Capsule */}
            {latestClaim && (
              <button 
                onClick={() => setIsPickupModalOpen(true)}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-white border border-[#2a382e]/20 rounded-full shadow-sm hover:bg-neutral-50 transition-colors shrink-0"
              >
                <Ticket size={14} className="text-[#2c8a38] hidden sm:block" />
                <Ticket size={16} className="text-[#2c8a38] sm:hidden" />
                <span className="text-xs font-bold text-[#182019] hidden sm:inline">Active Pickup: {latestClaim.claim_code}</span>
                <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </button>
            )}

            {/* Profile Pill */}
            <button
              type="button"
              aria-label="Open profile"
              onClick={() => history.push('/app/profile')}
              className="flex items-center gap-2 pl-2 sm:pl-3 py-1 cursor-pointer border-0 border-l border-[#2a382e]/10 hover:opacity-85 transition-opacity shrink-0 bg-transparent"
            >
              {userProfile?.avatar_url ? (
                <img 
                  src={userProfile.avatar_url} 
                  alt="Avatar" 
                  className="size-8 sm:size-9 rounded-full object-cover ring-2 ring-[#2c8a38]/30" 
                />
              ) : (
                <div className="size-8 sm:size-9 rounded-full bg-[#e8efe2] text-[#1c6428] font-bold text-[13px] flex items-center justify-center ring-1 ring-[#2c8a38]/20 shadow-sm">
                  {(userProfile?.full_name || 'U')[0].toUpperCase()}
                </div>
              )}
            </button>
          </div>

        </header>
      </IonHeader>

      {/* Centered Modal for Active Pickup */}
      <AnimatePresence>
        {isPickupModalOpen && latestClaim && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPickupModalOpen(false)}
              className="absolute inset-0 bg-[#182019]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl p-5 flex flex-col z-10 border border-[#2a382e]/10"
            >
              <button 
                onClick={() => setIsPickupModalOpen(false)}
                className="absolute top-4 right-4 size-7 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition-colors"
              >
                <X size={14} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-2xl bg-emerald-100 text-[#0c6b20] flex items-center justify-center shadow-sm shrink-0">
                  <Ticket size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#687066] uppercase tracking-wide">Active Pass</p>
                  <p className="text-sm font-extrabold text-[#182019] font-mono">{latestClaim.claim_code}</p>
                </div>
              </div>

              <div className="bg-[#f5faee] rounded-2xl p-4 border border-[#2a382e]/10 mb-5">
                <h4 className="font-bold text-base text-[#182019] mb-1">{latestClaim.post_title}</h4>
                <p className="text-sm text-[#4c5b4f] flex items-center gap-1.5 font-medium mb-3">
                  <MapPin size={14} className="text-[#2c8a38]" /> {latestClaim.location}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#4c5b4f]">Quantity: <b className="text-[#182019]">{latestClaim.quantity} portion(s)</b></span>
                  <span className="text-[#2c8a38] font-bold flex items-center gap-1">
                    <Clock size={14} /> Ready
                  </span>
                </div>
              </div>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={(e) => handleMarkPickedUp(e, latestClaim.id)}
                  className="flex-1 py-2.5 px-4 bg-[#2c8a38] text-white rounded-2xl font-extrabold text-sm hover:bg-[#23702d] transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Mark Picked Up
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPickupModalOpen(false);
                    history.push('/app/history');
                  }}
                  className="py-2.5 px-4 bg-[#e8efe2] text-[#182019] rounded-2xl text-sm font-bold hover:bg-[#dce6d5] transition-colors shadow-sm flex items-center justify-center"
                >
                  Details <ArrowRight size={14} className="ml-1" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
