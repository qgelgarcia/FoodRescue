import React, { useEffect, useId, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export default function PickupLocationMap({ claim }) {
  const container = useRef(null);
  const [tileError, setTileError] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const disclosureId = `pickup-location-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const prefersReducedMotion = useReducedMotion();
  const lat = claim.pickup_lat;
  const lng = claim.pickup_lng;
  const valid = Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
  useEffect(() => {
    if (!isOpen || !valid || !container.current) return;
    setTileError(false);
    const map = L.map(container.current, { scrollWheelZoom: false }).setView([lat, lng], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).on('tileerror', () => setTileError(true)).addTo(map);
    L.circleMarker([lat, lng], { radius: 9, color: '#14532d', fillColor: '#4ade80', fillOpacity: 1 })
      .addTo(map).bindTooltip('Pickup location');
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [isOpen, valid, lat, lng]);
  return <section className="mt-3 rounded-xl border border-[#dce4d7] p-3">
    <button
      id={`${disclosureId}-toggle`}
      type="button"
      aria-expanded={isOpen}
      aria-controls={disclosureId}
      onClick={() => setIsOpen((open) => !open)}
      className="cursor-pointer border-0 bg-transparent p-0 text-left text-xs font-bold"
    >
      View pickup location
    </button>
    <div id={disclosureId} role="region" aria-labelledby={`${disclosureId}-toggle`} aria-hidden={!isOpen} inert={isOpen ? undefined : ''}>
      <AnimatePresence>
        {isOpen && <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.24, ease: 'easeInOut' }}
          style={{ overflow: 'hidden' }}
          onAnimationComplete={() => {
            if (isOpen) window.dispatchEvent(new Event('resize'));
          }}
        >
          <p className="mt-2 text-xs">{claim.location}</p>
          {valid ? <>
            <div ref={container} className="mt-2 h-48 rounded-xl overflow-hidden" aria-label="Saved donor pickup pin" />
            <p className="mt-1 text-xs">Pickup: {lat.toFixed(6)}, {lng.toFixed(6)}. GPS permission is not required.</p>
            {tileError && <p role="status" className="text-xs text-amber-900">Map tiles could not load. Use the pickup address and coordinates above.</p>}
          </> : <p className="mt-1 text-xs">This listing has no saved map pin. Follow the donor’s pickup instructions.</p>}
        </motion.div>}
      </AnimatePresence>
    </div>
  </section>;
}
