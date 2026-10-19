import React, { useState, useEffect } from 'react';
import { Ticket, MapPin, CheckCircle2, Clock, Utensils, ArrowRight } from 'lucide-react';
import CustomerHeader from '../../components/layout/CustomerHeader';
import PageShell from '../../components/layout/PageShell';

import { getMyFoodClaims, completeClaim } from '../../services/food';

export default function HistoryPage({ userProfile }) {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState('');

  useEffect(() => {
    loadClaims();
    const handleUpdate = () => loadClaims();
    window.addEventListener('foodrescue:claim_updated', handleUpdate);
    return () => window.removeEventListener('foodrescue:claim_updated', handleUpdate);
  }, []);

  async function loadClaims() {
    try {
      setClaims(await getMyFoodClaims());
      setError('');
    } catch (cause) {
      setError(cause.message || 'Could not load your pickups.');
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(claim) {
    setCompleting(claim.id);
    setError('');
    try {
      await completeClaim(claim);
      await loadClaims();
    } catch (cause) {
      setError(cause.message || 'Could not complete this pickup.');
    } finally {
      setCompleting('');
    }
  }

  return (
    <PageShell>
      <div className="h-full w-full overflow-y-auto flex flex-col font-['DM_Sans',sans-serif] pb-28 relative">
      <CustomerHeader active="history" userProfile={userProfile} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#0c6b20] text-xs font-bold mb-2.5 border border-emerald-200">
            <Ticket size={13} />
            <span>DIGITAL PICKUP PASSES & RECEIPTS</span>
          </div>
          <h1 className="font-['Space_Grotesk'] text-3xl font-extrabold text-[#182019]">
            My Food Claims
          </h1>
          <p className="text-xs text-[#4c5b4f] mt-1">
            Present your digital claim pass to dining staff at pickup locations.
          </p>
        </div>

        {error && <p role="alert" className="mb-4 text-sm text-rose-700">{error}</p>}

        {loading ? <div className="bg-white rounded-3xl p-12 text-center border border-[#2a382e]/10 shadow-sm" role="status">Loading your pickups…</div> : claims.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-[#2a382e]/10 shadow-sm">
            <div className="size-12 rounded-2xl bg-emerald-50 text-[#0c6b20] flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              <Ticket size={24} />
            </div>
            <h3 className="font-bold text-base text-[#182019]">No claim passes yet</h3>
            <p className="text-xs text-[#687066] mt-1 mb-4">
              Explore available surplus food drops on campus and rescue your first meal!
            </p>
            <a
              href="/app/home-feed"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2c8a38] text-white rounded-2xl text-xs font-bold shadow-xs hover:bg-[#23702d] transition-colors"
            >
              <span>Browse Surplus Feed</span>
              <ArrowRight size={13} />
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {claims.map((claim) => {
              const isReady = claim.status === 'ready_for_pickup';
              const statusLabel = isReady ? 'Ready for Pickup' : claim.status === 'picked_up' ? 'Picked Up' : claim.status;
              return (
                <div
                  key={claim.id}
                  className={`bg-white rounded-3xl p-6 border shadow-sm transition-all ${
                    isReady ? 'border-emerald-300 ring-2 ring-emerald-500/15' : 'border-[#2a382e]/10 opacity-85'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    
                    <div className="flex items-center gap-4">
                      {claim.image ? (
                        <img
                          src={claim.image}
                          alt={claim.post_title}
                          className="size-16 rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="size-16 rounded-2xl bg-emerald-50 text-[#0c6b20] border border-emerald-200 flex items-center justify-center text-xl">
                          <Utensils size={24} />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-['Space_Grotesk'] font-bold text-base text-[#182019]">
                            {claim.post_title}
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isReady ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-neutral-100 text-neutral-600'
                          }`}>
                            {isReady ? <><Clock size={10} /> {statusLabel}</> : <><CheckCircle2 size={10} /> {statusLabel}</>}
                          </span>
                        </div>
                        <p className="text-xs text-[#4c5b4f] mt-0.5 flex items-center gap-1">
                          <MapPin size={11} className="text-[#2c8a38]" /> {claim.location} · <b>{claim.quantity} portion(s)</b>
                        </p>
                        <p className="text-[11px] text-[#687066] mt-1">
                          Claimed: {new Date(claim.claimed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Claim Pass Code & Action */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#2a382e]/10">
                      {isReady && claim.claim_code ? <div className="bg-emerald-50 text-[#0c6b20] border border-emerald-300 font-mono font-extrabold text-sm px-3 py-1.5 rounded-xl tracking-wider">{claim.claim_code}</div>
                        : isReady ? <span className="text-xs text-rose-700">Pickup pass unavailable</span> : null}
                      {isReady && claim.claim_code && (
                        <button
                          type="button"
                          disabled={completing === claim.id}
                          onClick={() => handleComplete(claim)}
                          className="px-3.5 py-1.5 bg-[#2c8a38] hover:bg-[#23702d] text-white rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1"
                        >
                          <CheckCircle2 size={12} />
                          <span>{completing === claim.id ? 'Saving…' : 'Mark Picked Up'}</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      
      </div>
    </PageShell>
  );
}
