import React, { useState, useEffect } from 'react';
import { IonInput } from '@ionic/react';
import { 
  Sparkles, 
  Search, 
  UtensilsCrossed, 
  Apple, 
  Croissant, 
  Cookie, 
  Layers, 
  CheckCircle2,
  X
} from 'lucide-react';
import CustomerHeader from './CustomerHeader';
import FoodCard from './FoodCard';
import PageShell from './PageShell';

import { getFoodPosts } from '../services/food';
import { motion, AnimatePresence } from 'motion/react';

export default function HomeFeed({ userProfile }) {
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claimToast, setClaimToast] = useState(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  async function fetchPosts() {
    setLoading(true);
    setError('');
    try {
      const data = await getFoodPosts();
      setPosts(data);
    } catch {
      setPosts([]);
      setError('We could not load the food feed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleClaimSuccess(claim) {
    setClaimToast(`Claimed ${claim.quantity}x ${claim.post_title}! Check the top capsule for your pickup code.`);
    setTimeout(() => setClaimToast(null), 5000);
  }

  const categories = [
    { label: 'All', icon: <Layers size={13} />, text: 'All Rescues' },
    { label: 'Meals', icon: <UtensilsCrossed size={13} />, text: 'Prepared Meals' },
    { label: 'Produce', icon: <Apple size={13} />, text: 'Fresh Produce' },
    { label: 'Bakery', icon: <Croissant size={13} />, text: 'Bakery' },
    { label: 'Snacks', icon: <Cookie size={13} />, text: 'Snacks' },
  ];

  const filtered = posts.filter((item) => {
    const matchCat = category === 'All' || item.category?.toLowerCase() === category.toLowerCase();
    const matchSearch = !searchQuery || 
      item.food_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.pickup_address?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <PageShell>
      <div className="h-full w-full overflow-y-auto bg-[#f5faee] flex flex-col font-['DM_Sans',sans-serif] pb-24 relative">
      <CustomerHeader active="home" userProfile={userProfile} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        
        {/* Claim Success Floating Alert Banner */}
        {claimToast && (
          <div className="mb-6 p-4 rounded-2xl bg-white border-2 border-emerald-400 text-[#182019] shadow-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-[#2c8a38]" />
              <p className="font-semibold text-xs text-[#182019]">{claimToast}</p>
            </div>
            <button 
              type="button"
              aria-label="Dismiss claim confirmation"
              onClick={() => setClaimToast(null)}
              className="text-xs font-semibold px-2 py-1 hover:bg-neutral-100 rounded-lg text-[#687066]"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Hero Section */}
        <section className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>

            <h1 className="font-['Space_Grotesk'] text-3xl sm:text-4xl font-extrabold text-[#182019] tracking-tight">
              Fresh Rescues Near You
            </h1>
            <p className="text-xs sm:text-sm text-[#4c5b4f] mt-1">
              Prevent food waste on campus. Claim high quality surplus prepared by campus kitchens.
            </p>
          </div>

          {/* Quick Search with clean icon */}
          <div className="relative w-full md:w-72">
             <IonInput
               id="food-search"
               type="text"
               value={searchQuery}
               onIonInput={(e) => setSearchQuery(e.detail.value || '')}
               aria-label="Search food listings"
               placeholder="Search dishes or halls..."
               className="w-full bg-white border border-[#2a382e]/20 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#182019] placeholder:text-[#687066] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#2c8a38]"
            />
            <Search size={14} className="absolute left-3.5 top-3 text-[#687066] pointer-events-none" />
          </div>
        </section>

        <div className="mb-8 relative flex items-center bg-[#e8eee3] p-1.5 rounded-[2rem] w-full shadow-inner border border-[#2a382e]/5">
          {categories.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setCategory(cat.label)}
              aria-pressed={category === cat.label}
              className={`relative flex-1 py-2.5 rounded-full text-[13px] font-bold transition-colors duration-300 whitespace-nowrap flex items-center justify-center z-10 ${
                category === cat.label
                  ? 'text-white'
                  : 'text-[#4c5b4f] hover:text-[#182019]'
              }`}
            >
              {category === cat.label && (
                <motion.div
                  layoutId="active-category"
                  className="absolute inset-0 bg-gradient-to-b from-[#2c8a38] to-[#1c6428] rounded-full z-[-1] shadow-[0_4px_12px_rgba(44,138,56,0.3)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <div className={`flex items-center gap-2 p-1 rounded-full transition-colors ${category === cat.label ? 'bg-white/20' : 'bg-transparent text-[#687066] hover:bg-black/5'}`}>
                {cat.icon}
                <AnimatePresence>
                  {category === cat.label && (
                    <motion.span
                      initial={{ width: 0, opacity: 0, overflow: 'hidden' }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="pr-1"
                    >
                      {cat.text}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </button>
          ))}
        </div>

        {/* Food Postings Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse bg-white rounded-[2rem] p-4 flex flex-col h-[340px] shadow-sm border border-[#2a382e]/10">
                <div className="w-full h-44 bg-neutral-200 rounded-[1.5rem] mb-4"></div>
                <div className="h-5 bg-neutral-200 rounded-md w-3/4 mb-2"></div>
                <div className="h-4 bg-neutral-200 rounded-md w-1/2 mb-auto"></div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-[#2a382e]/5">
                  <div className="h-10 bg-neutral-200 rounded-xl w-24"></div>
                  <div className="h-10 bg-neutral-200 rounded-xl flex-1"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-12 text-center bg-white rounded-3xl border border-rose-200 p-8" role="alert">
            <h3 className="font-bold text-base text-rose-800">Unable to load listings</h3>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
            <button
              type="button"
              onClick={fetchPosts}
              className="mt-4 min-h-11 px-5 py-2 bg-[#2c8a38] text-white rounded-2xl text-xs font-bold shadow-sm hover:bg-[#23702d]"
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-[#2a382e]/20 p-8">
            <UtensilsCrossed size={32} className="mx-auto text-[#687066] mb-2" />
            <h3 className="font-bold text-base text-[#182019]">No surplus food found</h3>
            <p className="text-xs text-[#687066] mt-1">Try changing your search term or category filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((post) => (
              <FoodCard
                key={post.id}
                post={post}
                onClaimSuccess={handleClaimSuccess}
              />
            ))}
          </div>
        )}

      </main>



      {/* Interactive macOS-Style Calamansi Dock in Pristine Light Mode */}
      
      </div>
    </PageShell>
  );
}
