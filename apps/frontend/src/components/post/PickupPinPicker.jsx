import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [14.5995, 120.9842];

export default function PickupPinPicker({ value, onChange, disabled = false }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);
  const [tileError, setTileError] = useState(false);

  onChangeRef.current = onChange;
  disabledRef.current = disabled;

  useEffect(() => {
    if (!container.current) return undefined;

    const initialCenter = value ? [value.lat, value.lng] : DEFAULT_CENTER;
    const map = L.map(container.current, { scrollWheelZoom: false }).setView(initialCenter, value ? 16 : 13);
    mapRef.current = map;
    const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    let failedTile = false;
    tiles.on('tileerror', () => { failedTile = true; setTileError(true); });
    tiles.on('load', () => setTileError(failedTile));
    tiles.addTo(map);

    function placePin(latitude, longitude) {
      const coordinates = { lat: Number(latitude.toFixed(6)), lng: Number(longitude.toFixed(6)) };
      if (markerRef.current) markerRef.current.setLatLng([coordinates.lat, coordinates.lng]);
      else markerRef.current = createSelectedMarker(map, coordinates, disabledRef.current, onChangeRef);
      onChangeRef.current(coordinates);
    }

    if (value) markerRef.current = createSelectedMarker(map, value, disabledRef.current, onChangeRef);

    map.on('click', (event) => {
      if (!disabledRef.current) placePin(event.latlng.lat, event.latlng.lng);
    });
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current && mapRef.current) {
      markerRef.current = createSelectedMarker(mapRef.current, value, disabled, onChangeRef);
      mapRef.current.setView([value.lat, value.lng], Math.max(mapRef.current.getZoom(), 16), { animate: false });
      return;
    }
    const marker = markerRef.current;
    if (!marker) return;
    marker.setLatLng([value.lat, value.lng]);
    marker.dragging?.[disabled ? 'disable' : 'enable']();
    mapRef.current?.setView([value.lat, value.lng], Math.max(mapRef.current.getZoom(), 16), { animate: false });
  }, [value?.lat, value?.lng, disabled]);

  return (
    <div>
      <div
        ref={container}
        className="w-full h-64 rounded-2xl border border-[#2a382e]/20 bg-[#e8eee3] overflow-hidden"
        aria-label="Interactive pickup map. Click the map or drag the pin to set the pickup location."
      />
      <p className="mt-2 text-xs text-[#687066]" role="status">
        {value ? 'Pickup pin selected. Drag it or click the map to adjust.' : 'Click the map to place the pickup pin. You do not need to share your current location.'}
      </p>
      {value && <p className="text-[11px] text-[#687066]">Selected coordinates: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>}
      {tileError && <p className="mt-1 text-xs text-amber-800" role="status">Map tiles could not load. Check your connection; a pickup pin can still be placed on the map.</p>}
    </div>
  );
}

function createSelectedMarker(map, value, disabled, onChangeRef) {
  const marker = L.marker([value.lat, value.lng], {
    title: 'Selected pickup location',
    alt: 'Selected pickup location',
    draggable: !disabled,
    icon: selectedPinIcon(),
  }).addTo(map);
  marker.on('dragend', (event) => {
    const position = event.target.getLatLng();
    onChangeRef.current({ lat: Number(position.lat.toFixed(6)), lng: Number(position.lng.toFixed(6)) });
  });
  return marker;
}

function selectedPinIcon() {
  return L.divIcon({
    className: 'pickup-pin-div-icon',
    html: '<span class="pickup-pin-marker" aria-hidden="true"></span>',
    iconSize: [30, 38],
    iconAnchor: [15, 36],
  });
}
