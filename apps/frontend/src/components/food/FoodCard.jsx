import { createPortal } from 'react-dom';
import { friendlyError } from '../../services/request';
import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { Clock, MapPin, Check, Plus, Minus, ChevronRight, ChevronLeft, X, Info } from 'lucide-react';
import { NumberTicker } from '../ui/calamansi/number-ticker';
import { claimFoodPost } from '../../services/food';
import { validateClaimQuantity } from '../../lib/validation';
import { motion, AnimatePresence } from 'motion/react';

export default function CalamansiFoodCard({ post, userProfile, onClaimSuccess, previewOpen = false, onPreviewClose }) {
  const history = useHistory();
  const [portion, setPortion] = useState(1);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedNotice, setClaimedNotice] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [localModalOpen, setLocalModalOpen] = useState(false);
  const isModalOpen = previewOpen || localModalOpen;
  function setIsModalOpen(open) {
    setLocalModalOpen(open);
    if (!open) onPreviewClose?.();
  }
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!isModalOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === 'Escape') setIsModalOpen(false);
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll('button:not(:disabled), [href], input, select, textarea, [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [isModalOpen]);

  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoDirection, setPhotoDirection] = useState(1);
  const canClaim = userProfile?.status === 'active';

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  function reportTarget(type, id, label) {
    setIsModalOpen(false);
    history.push('/app/reports', { reportTarget: { type, id, label } });
  }

  // Generate some extra mock photos for the carousel effect
  const photos = [
    post.photo_url,
    'https://images.unsplash.com/photo-1543362906-acfc16c67564?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1628191010210-a59de33e5941?auto=format&fit=crop&w=600&q=80'
  ];

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    setPhotoDirection(1);
    setPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    setPhotoDirection(-1);
    setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };
  // Time remaining calculation
  const expiresAt = new Date(post.expires_at).getTime();
  const diffMinutes = Math.max(0, Math.floor((expiresAt - now) / (60 * 1000)));
  const hoursLeft = Math.floor(diffMinutes / 60);
  const minsLeft = diffMinutes % 60;

  const isUrgent = diffMinutes < 45;
  const isModerate = diffMinutes < 120;

  async function handleClaim(e) {
    e.stopPropagation();
    const validationError = validateClaimQuantity(post, portion);
    if (validationError) {
      setClaimError(validationError);
      return;
    }

    setIsClaiming(true);
    setClaimError('');
    try {
      const claim = await claimFoodPost(post, portion);
      setClaimedNotice(true);
      if (onClaimSuccess) onClaimSuccess(claim);
      setTimeout(() => {
        setClaimedNotice(false);
        setIsModalOpen(false);
      }, 3000);
    } catch (error) {
      setClaimError(friendlyError(error));
    } finally {
      setIsClaiming(false);
    }
  }

  const badgeComponent = (
    <div className="listing-card-meta">
      <span className="listing-category">{post.category || 'Surplus'}</span>
      <span className={`listing-expiry ${isUrgent ? 'is-urgent' : isModerate ? 'is-soon' : ''}`}>
        <Clock size={14} aria-hidden="true" />
        {hoursLeft > 0 ? `${hoursLeft}h ` : ''}{minsLeft}m left
      </span>
    </div>
  );

  return (
    <>
      <div className="relative group">
        <article className="listing-card">
          {badgeComponent}
          {/* Cover Photo */}
          <div className="listing-card-photo" role="button" tabIndex={0} aria-label={`View details for ${post.food_name}`} onClick={() => setIsModalOpen(true)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setIsModalOpen(true); } }}>
            <img
              src={post.photo_url}
              alt={post.food_name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div className="pr-2">
                <p className="text-xs font-bold text-emerald-300 flex items-center gap-1 mb-1 shadow-sm">
                  <MapPin size={12} /> {post.pickup_address}
                </p>
                <h3 className="font-['Space_Grotesk'] text-xl font-extrabold text-white drop-shadow-md leading-tight">
                  {post.food_name}{post.is_sample ? ' (Sample)' : ''}
                </h3>
              </div>
              <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl text-right border border-white/40 shadow-lg">
                <span className="text-[10px] text-[#687066] block uppercase font-mono font-bold tracking-wider">Remaining</span>
                <span className="text-base font-extrabold text-[#182019] font-mono">
                  {post.quantity_remaining} <small className="text-[#687066] font-normal">/ {post.quantity_total}</small>
                </span>
              </div>
            </div>
          </div>

          {/* Description & Donor Details */}
          <div className="listing-card-body">
            <p className="text-sm text-[#4c5b4f] line-clamp-2 mb-4 leading-relaxed font-medium">
              {post.description}
            </p>

            {/* Dietary chips */}
            {post.dietary && (
              <div className="flex flex-wrap gap-2 mb-5">
                {post.dietary.map((tag) => (
                  <span key={tag} className="text-xs bg-[#f0f6ed] px-2.5 py-1 rounded-lg text-[#2c8a38] font-bold border border-[#2a382e]/10 shadow-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Portion Bar */}
            <div className="mb-5">
              <div className="w-full bg-[#e8efe2] h-2.5 rounded-full overflow-hidden shadow-inner">
                <div
                  className="bg-[#2c8a38] h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(10, (post.quantity_remaining / post.quantity_total) * 100))}%`
                  }}
                />
              </div>
            </div>

            {/* Claim Bar & Calamansi NumberTicker Stepper */}
            <div className="listing-card-actions">
              
              {/* Stepper with NumberTicker */}
              <div className="flex items-center gap-2 bg-[#f0f6ed] p-1.5 rounded-2xl border border-[#2a382e]/10 shadow-sm">
                <button
                  type="button"
                  aria-label={`Decrease portions for ${post.food_name}`}
                  onClick={(e) => { e.stopPropagation(); setPortion(Math.max(1, portion - 1)); }}
                  className="size-8 rounded-xl bg-white hover:bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#182019] shadow-sm transition-colors"
                >
                  <Minus size={14} />
                </button>

                <div className="px-2 flex items-center justify-center w-8">
                  <NumberTicker
                    value={portion}
                    size="sm"
                    variant="transparent"
                    className="bg-transparent p-0 text-base font-extrabold text-[#182019]"
                  />
                </div>

                <button
                  type="button"
                  aria-label={`Increase portions for ${post.food_name}`}
                  onClick={(e) => { e.stopPropagation(); setPortion(Math.min(post.quantity_remaining || 5, portion + 1)); }}
                  className="size-8 rounded-xl bg-white hover:bg-emerald-100 flex items-center justify-center text-sm font-bold text-[#182019] shadow-sm transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Claim Action Button */}
              <button
                type="button"
                onClick={handleClaim}
                disabled={isClaiming || post.quantity_remaining <= 0 || !canClaim}
                className={`listing-claim-button flex-1 py-3.5 px-6 rounded-2xl font-extrabold text-[15px] transition-all shadow-md flex items-center justify-center gap-2 ${
                  claimedNotice
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gradient-to-b from-[#2c8a38] to-[#1c6428] hover:from-[#23702d] hover:to-[#164d1f] text-white hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isClaiming ? (
                  <span>Rescuing...</span>
                ) : claimedNotice ? (
                  <>
                    <Check size={16} />
                    <span>Pass Issued!</span>
                  </>
                ) : (
                  <>
                    <span>Rescue Meal</span>
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
            {!canClaim && <p className="mt-3 text-xs font-semibold text-amber-800">Your account cannot start a new pickup. You can still finish existing pickups and submit reports.</p>}
            {claimError && <p className="mt-3 text-xs font-semibold text-rose-700" role="alert">{claimError}</p>}
          </div>
        </article>
      </div>

      {/* Expanded Details Modal */}
      {createPortal(<AnimatePresence>
        {isModalOpen && (
          <div className="food-modal-overlay">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-[#182019]/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              ref={dialogRef}
              role="dialog" aria-modal="true" aria-label={post.food_name} tabIndex={-1}
              className="food-modal-panel relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col z-10 border border-[#2a382e]/10"
            >
              <div className="relative h-56 shrink-0 bg-neutral-100 overflow-hidden group">
                <AnimatePresence custom={photoDirection} initial={false}>
                  <motion.img
                    key={photoIndex}
                    src={photos[photoIndex]}
                    alt={post.food_name}
                    custom={photoDirection}
                    initial={(d) => ({ opacity: 0, x: d > 0 ? 100 : -100 })}
                    animate={{ opacity: 1, x: 0, zIndex: 1 }}
                    exit={(d) => ({ opacity: 0, x: d > 0 ? -100 : 100, zIndex: 0 })}
                    transition={{ type: "tween", ease: "easeInOut", duration: 0.3 }}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </AnimatePresence>
                
                {/* Liquid Glass Navigation Buttons */}
                 <button
                   type="button"
                   aria-label={`Previous photo of ${post.food_name}`}
                   onClick={handlePrevPhoto}
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/15 backdrop-blur-xl border border-white/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] text-white flex items-center justify-center hover:bg-white/25 hover:scale-105 transition-all z-10"
                >
                  <ChevronLeft size={20} />
                </button>
                 <button
                   type="button"
                   aria-label={`Next photo of ${post.food_name}`}
                   onClick={handleNextPhoto}
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/15 backdrop-blur-xl border border-white/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] text-white flex items-center justify-center hover:bg-white/25 hover:scale-105 transition-all z-10"
                >
                  <ChevronRight size={20} />
                </button>

                 <button
                   type="button"
                   aria-label={`Close details for ${post.food_name}`}
                   onClick={() => setIsModalOpen(false)}
                  className="absolute top-4 right-4 size-8 rounded-full bg-white/15 backdrop-blur-xl border border-white/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] text-white flex items-center justify-center hover:bg-white/25 hover:scale-105 transition-all z-10"
                >
                  <X size={16} />
                </button>

                {/* Photo Indicators */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
                  {photos.map((_, i) => (
                    <span 
                      key={i} 
                      className={`h-1.5 rounded-full transition-all duration-300 ${i === photoIndex ? 'w-4 bg-white shadow-sm' : 'w-1.5 bg-white/50'}`} 
                    />
                  ))}
                </div>
              </div>
              
              <div className="p-6 flex flex-col items-start text-left">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#e8efe2] text-[#1c6428] shadow-sm">
                    {post.category || 'Surplus'}
                  </span>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1.5 shadow-sm">
                    <Clock size={12} /> {hoursLeft > 0 ? `${hoursLeft}h ` : ''}{minsLeft}m left
                  </span>
                </div>
                
                <h2 className="font-['Space_Grotesk'] text-2xl font-extrabold text-[#182019] mb-1">
                  {post.food_name}{post.is_sample ? ' (Sample)' : ''}
                </h2>
                <p className="text-sm font-bold text-[#2c8a38] flex items-center gap-1 mb-4">
                  <MapPin size={14} /> {post.pickup_address}
                </p>
                
                <p className="text-sm text-[#4c5b4f] leading-relaxed mb-6">
                  {post.description}
                </p>
                
                <div className="bg-[#f5faee] rounded-2xl p-4 flex items-center gap-4 border border-[#2a382e]/10 self-stretch">
                  <div className="size-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <Info size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[#182019] text-sm">Pickup Instructions</h4>
                    <p className="text-xs text-[#4c5b4f] mt-0.5">{post.is_sample ? 'This is a sample listing. No real pickup is available.' : 'Show your claim pass at the counter to collect your rescue.'}</p>
                  </div>
                </div>

                {!post.is_sample && post.donor_id !== userProfile?.id && <div className="flex flex-wrap gap-3 self-stretch text-xs">
                  <button type="button" className="member-report-link" onClick={() => reportTarget('post', post.id, post.food_name)}>Report this listing</button>
                  {post.donor_id && <button type="button" className="member-report-link" onClick={() => reportTarget('user', post.donor_id, post.donor?.full_name || 'Campus member')}>Report donor</button>}
                </div>}
                
                <div className="mt-6 pt-5 border-t border-[#2a382e]/10 flex items-center gap-4 self-stretch">
                  <div className="flex-1">
                    <p className="text-xs font-bold text-[#687066] uppercase tracking-wider mb-1">Available</p>
                    <p className="text-xl font-extrabold text-[#182019]">{post.quantity_remaining} <span className="text-base text-[#687066] font-normal">/ {post.quantity_total}</span></p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      // Trigger claim flow on the card
                      handleClaim({ stopPropagation: () => {} });
                    }}
                    disabled={isClaiming || post.quantity_remaining <= 0 || !canClaim}
                    className="py-3.5 px-8 bg-gradient-to-b from-[#2c8a38] to-[#1c6428] hover:from-[#23702d] hover:to-[#164d1f] text-white rounded-2xl font-extrabold text-[15px] transition-all shadow-lg hover:scale-[1.02]"
                  >
                    Claim {portion} Portion{portion > 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>, document.body)}
    </>
  );
}
