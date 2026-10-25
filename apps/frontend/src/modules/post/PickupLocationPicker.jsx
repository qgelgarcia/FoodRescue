import { useEffect, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, MapPin } from 'lucide-react';

const DEFAULT_CENTER = [14.6256536, 121.061989];
const PICKUP_PIN_ICON = L.divIcon({
  className: 'pickup-map-marker',
  html: renderToStaticMarkup(<MapPin size={21} aria-hidden="true" />),
  iconSize: [44, 44],
  iconAnchor: [22, 42],
});

export default function PickupLocationPicker({ latitude, longitude, onChange }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const onChangeRef = useRef(onChange);
  const [locationError, setLocationError] = useState('');

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!container.current) return undefined;
    const initial = Number.isFinite(latitude) && Number.isFinite(longitude) ? [latitude, longitude] : DEFAULT_CENTER;
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView(initial, 15);
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    instance.on('click', event => {
      const point = { latitude: event.latlng.lat, longitude: event.latlng.lng };
      if (!marker.current) marker.current = L.marker(event.latlng, { draggable: true, icon: PICKUP_PIN_ICON }).addTo(instance);
      else marker.current.setLatLng(event.latlng);
      marker.current.off('dragend').on('dragend', event => {
        const position = event.target.getLatLng();
        onChangeRef.current(position.lat, position.lng);
      });
      onChangeRef.current(point.latitude, point.longitude);
    });
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      marker.current = L.marker(initial, { draggable: true, icon: PICKUP_PIN_ICON }).addTo(instance);
      marker.current.on('dragend', event => {
        const position = event.target.getLatLng();
        onChangeRef.current(position.lat, position.lng);
      });
    }
    const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; marker.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const point = [latitude, longitude];
    if (!marker.current) marker.current = L.marker(point, { draggable: true, icon: PICKUP_PIN_ICON }).addTo(map.current);
    else marker.current.setLatLng(point);
    marker.current.off('dragend').on('dragend', event => {
      const position = event.target.getLatLng();
      onChangeRef.current(position.lat, position.lng);
    });
  }, [latitude, longitude]);

  function locateMe() {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Location is unavailable. Click or drag a pin to choose the pickup point.');
      return;
    }
    navigator.geolocation.getCurrentPosition(position => {
      const point = [position.coords.latitude, position.coords.longitude];
      map.current?.setView(point, 17);
    }, () => setLocationError('Location access was denied or unavailable. Click or drag a pin to choose the pickup point.'), { timeout: 12000, maximumAge: 60000 });
  }

  return <div>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4c5b4f]"><MapPin size={14} />Click the map to place or move the pickup pin.</span>
      <button type="button" className="pickup-map-action" onClick={locateMe}><LocateFixed size={15} /> Center on me</button>
    </div>
    <div className="pickup-map-frame"><div ref={container} className="pickup-map-canvas" aria-label="Select the food pickup point" /></div>
    {latitude == null || longitude == null
      ? <p className="mt-1 text-xs text-rose-700" role="status">Choose a pin. You can do this without sharing your current location.</p>
      : <p className="mt-1 text-xs text-[#687066]" role="status">Pickup pin selected: {Number(latitude).toFixed(5)}, {Number(longitude).toFixed(5)}</p>}
    {locationError && <p className="mt-1 text-xs text-amber-800" role="status">{locationError}</p>}
  </div>;
}