import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function PickupLocationMap({ claim }) {
  const container = useRef(null);
  const [tileError, setTileError] = useState(false);
  const lat = claim.pickup_lat;
  const lng = claim.pickup_lng;
  const valid = Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180;
  useEffect(() => {
    if (!valid || !container.current) return;
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
  }, [valid, lat, lng]);
  return <details className="mt-3 rounded-xl border border-[#dce4d7] p-3" onToggle={() => window.dispatchEvent(new Event('resize'))}>
    <summary className="cursor-pointer text-xs font-bold">View pickup location</summary>
    <p className="mt-2 text-xs">{claim.location}</p>
    {valid ? <>
      <div ref={container} className="mt-2 h-48 rounded-xl overflow-hidden" aria-label="Saved donor pickup pin" />
      <p className="mt-1 text-xs">Pickup: {lat.toFixed(6)}, {lng.toFixed(6)}. GPS permission is not required.</p>
      {tileError && <p role="status" className="text-xs text-amber-900">Map tiles could not load. Use the pickup address and coordinates above.</p>}
    </> : <p className="mt-1 text-xs">This listing has no saved map pin. Follow the donor’s pickup instructions.</p>}
  </details>;
}
