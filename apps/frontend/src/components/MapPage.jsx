import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Utensils, Apple, Croissant, Bell } from 'lucide-react';
import CustomerHeader from './CustomerHeader';
import DynamicIsland from './ui/calamansi/dynamic-island';

export default function MapPage({ userProfile }) {
  const updates = [
    { title: "Main Library Cafe", desc: "4 artisan sandwich boxes ready for pickup", color: "text-emerald-500" },
    { title: "Student Union", desc: "12 organic fruit bowls remaining", color: "text-amber-500" },
    { title: "Campus Bakery", desc: "Fresh croissants expiring in 1h", color: "text-emerald-500" },
    { title: "Zero Waste", desc: "142 kg CO₂ prevented this week!", color: "text-emerald-800" },
  ];
  const [updateIdx, setUpdateIdx] = useState(0);

  useEffect(() => {
    const int = setInterval(() => {
      setUpdateIdx(i => (i + 1) % updates.length);
    }, 4000);
    return () => clearInterval(int);
  }, []);

  const currentUpdate = updates[updateIdx];

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f5faee] flex flex-col font-['DM_Sans',sans-serif] pb-24 relative">
      <CustomerHeader active="map" userProfile={userProfile} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#0c6b20] text-xs font-bold mb-2.5 border border-emerald-200">
              <MapPin size={13} />
              <span>CAMPUS RESCUE MAP</span>
            </div>
            <h1 className="font-['Space_Grotesk'] text-3xl font-extrabold text-[#182019]">
              Live Pickup Map
            </h1>
            <p className="text-xs text-[#4c5b4f] mt-1 mb-4">
              Find campus food pickup points and pantry hubs near your current location.
            </p>
            
            {/* Live Updates Widget */}
            <div className="relative z-20">
              <DynamicIsland
                defaultState="compact"
                pulse={true}
                leading={<Bell size={14} className={currentUpdate.color} />}
                title={currentUpdate.title + "..."}
                expandedContent={
                  <div className="flex flex-col h-full text-[#182019]">
                    <div className="flex items-center gap-2 border-b border-[#2a382e]/10 pb-3 mb-3">
                      <Bell size={16} className={currentUpdate.color} />
                      <span className="font-bold text-sm">Live Campus Updates</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-2">
                       <p className="font-bold text-xl leading-tight">{currentUpdate.title}</p>
                       <p className="text-base text-[#4c5b4f]">{currentUpdate.desc}</p>
                    </div>
                  </div>
                }
              />
            </div>
          </div>

          <button className="px-4 py-2 bg-white border border-[#2a382e]/20 text-[#182019] rounded-2xl text-xs font-bold hover:bg-black/5 shadow-2xs transition-colors self-start sm:self-auto flex items-center gap-1.5">
            <Navigation size={13} className="text-[#2c8a38]" />
            <span>Center on Campus</span>
          </button>
        </div>

        {/* Map Canvas with Calamansi Squircles */}
        <div className="relative w-full h-[500px] rounded-3xl overflow-hidden border border-[#2a382e]/15 shadow-sm bg-[#e8eee3]">
          
          {/* Stylized Campus Roads & Landscape */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#2c8a38_1px,transparent_1px)] [background-size:24px_24px]"></div>
          
          <div className="absolute top-1/4 left-0 right-0 h-10 bg-white/70 -rotate-3 border-y border-white"></div>
          <div className="absolute top-0 bottom-0 left-1/3 w-12 bg-white/70 rotate-6 border-x border-white"></div>
          <div className="absolute top-1/2 left-0 right-0 h-14 bg-white/70 rotate-1 border-y border-white"></div>

          {/* Quad Green Park */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 size-56 rounded-full bg-[#8fa37d]/20 border border-[#8fa37d]/30 flex items-center justify-center text-xs font-bold text-[#39564a]/70">
            Campus Science Quad
          </div>

          {/* Interactive Pickup Pins */}
          
          {/* Pin 1: Main Library */}
          <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <div className="size-11 rounded-2xl bg-[#2c8a38] text-white flex items-center justify-center font-bold text-sm shadow-lg ring-4 ring-emerald-200 animate-bounce">
              <Utensils size={18} />
            </div>
            <div className="mt-2 bg-white px-3 py-1.5 rounded-xl shadow-md border border-[#2a382e]/15 text-left w-48 pointer-events-none group-hover:scale-105 transition-transform">
              <p className="font-bold text-xs text-[#182019]">Main Library Cafe</p>
              <p className="text-[10px] text-emerald-700 font-semibold">4 sandwiches available</p>
            </div>
          </div>

          {/* Pin 2: Student Union */}
          <div className="absolute top-1/2 right-1/4 -translate-x-1/2 -translate-y-1/2 group cursor-pointer">
            <div className="size-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-lg ring-4 ring-amber-200">
              <Apple size={18} />
            </div>
            <div className="mt-2 bg-white px-3 py-1.5 rounded-xl shadow-md border border-[#2a382e]/15 text-left w-48 pointer-events-none group-hover:scale-105 transition-transform">
              <p className="font-bold text-xs text-[#182019]">Student Union Pantry</p>
              <p className="text-[10px] text-amber-700 font-semibold">12 fruit bowls available</p>
            </div>
          </div>

          {/* Pin 3: Campus Bakery */}
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 group cursor-pointer">
            <div className="size-11 rounded-2xl bg-[#5c7a67] text-white flex items-center justify-center font-bold text-sm shadow-lg ring-4 ring-emerald-200">
              <Croissant size={18} />
            </div>
            <div className="mt-2 bg-white px-3 py-1.5 rounded-xl shadow-md border border-[#2a382e]/15 text-left w-48 pointer-events-none group-hover:scale-105 transition-transform">
              <p className="font-bold text-xs text-[#182019]">Campus Bakery</p>
              <p className="text-[10px] text-emerald-800 font-semibold">6 pastries expiring soon</p>
            </div>
          </div>

          {/* Bottom Floating Legend */}
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-[#2a382e]/15 shadow-md flex items-center gap-4 text-xs font-semibold text-[#182019]">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-[#2c8a38]"></span> Meals
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-amber-500"></span> Produce
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-[#5c7a67]"></span> Bakery
            </span>
          </div>

        </div>

      </main>

      
    </div>
  );
}
