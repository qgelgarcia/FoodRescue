import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const STALE_AFTER_MS = 2 * 60 * 1000;

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'an unknown time' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function JourneyLocationMap({ journey, title, unavailable }) {
  const container = useRef(null);
  const lat = Number(journey?.lat);
  const lng = Number(journey?.lng);
  const hasPoint = journey?.lat != null && journey?.lng != null
    && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lng) && lng >= -180 && lng <= 180
    && Boolean(journey?.updated_at);
  const updatedAt = journey?.updated_at ? new Date(journey.updated_at) : null;
  const stale = updatedAt && Date.now() - updatedAt.getTime() > STALE_AFTER_MS;

  useEffect(() => {
    if (!hasPoint || !container.current) return undefined;
    const map = L.map(container.current, { scrollWheelZoom: false, zoomControl: false })
      .setView([lat, lng], 16);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    L.circleMarker([lat, lng], {
      radius: 9,
      color: '#17361c',
      fillColor: '#51ad5b',
      fillOpacity: 1,
      weight: 3,
    }).addTo(map).bindTooltip('Latest shared location', { direction: 'top', offset: [0, -8] });
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [hasPoint, lat, lng]);

  return (
    <section className="mt-3 rounded-2xl border border-[#dce4d7] bg-[#f8fbf5] p-3" aria-label={`Journey location for ${title}`}>
      <h3 className="text-xs font-bold text-[#354438]">Claimant journey</h3>
      {unavailable ? (
        <p className="mt-1 text-xs text-[#536054]">The shared location could not be loaded. Refresh donor requests to try again.</p>
      ) : !journey ? (
        <p className="mt-1 text-xs text-[#536054]">No current point is available. The claimant may not be sharing or may have stopped sharing.</p>
      ) : !hasPoint ? (
        <p className="mt-1 text-xs text-[#536054]">Waiting for the claimant’s first location update. Location sharing is optional.</p>
      ) : (
        <>
          <div className="mt-2 h-36 overflow-hidden rounded-xl border border-[#dce4d7]" ref={container} role="img" aria-label="Map of the claimant’s latest shared location" />
          <p className={`mt-2 text-xs ${stale ? 'font-semibold text-amber-900' : 'text-[#536054]'}`}>
            {stale ? 'Stale location' : 'Last shared location'} · Updated {formatDate(journey.updated_at)}
          </p>
        </>
      )}
    </section>
  );
}
