import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, RefreshCw, LocateFixed, UtensilsCrossed, Apple, Croissant, Cookie } from 'lucide-react';
import CustomerHeader from '../../components/layout/CustomerHeader';
import PageShell from '../../components/layout/PageShell';
import { getFoodPosts } from '../../services/food';
import { friendlyError } from '../../services/request';
import { availableMapPosts, hasPickupCoordinates } from '../../lib/map';

const CATEGORY_ICONS = { Meals: UtensilsCrossed, Produce: Apple, Bakery: Croissant, Snacks: Cookie };

export default function MapPage({ userProfile }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef(new Map());
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tilesLoading, setTilesLoading] = useState(true);
  const [tileError, setTileError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [radius, setRadius] = useState(1000);
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current += 1; }, []);
  const available = availableMapPosts(posts);
  const located = available.filter(hasPickupCoordinates);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getFoodPosts().then(data => { if (active) setPosts(data); })
      .catch(reason => { if (active) { setPosts([]); setError(friendlyError(reason)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('foodrescue:posts_updated', refresh);
    return () => window.removeEventListener('foodrescue:posts_updated', refresh);
  }, []);

  useEffect(() => {
    if (loading || !container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false }).setView([14.6256536, 121.061989], 15);
    mapRef.current = map;
    setTilesLoading(true);
    setTileError(false);
    const tiles = L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    let failed = false;
    const timeout = setTimeout(() => { setTilesLoading(false); setTileError(true); }, 15000);
    tiles.on('tileerror', () => { failed = true; setTileError(true); });
    tiles.on('load', () => { clearTimeout(timeout); setTilesLoading(false); setTileError(failed); });
    tiles.addTo(map);
    const markers = new Map();
    availableMapPosts(posts).filter(hasPickupCoordinates).forEach(post => {
      const content = document.createElement('div');
      content.className = 'pickup-popup';
      const title = document.createElement('strong');
      title.textContent = post.food_name;
      const address = document.createElement('p');
      address.textContent = post.pickup_address;
      const portions = document.createElement('p');
      portions.textContent = `${post.quantity_remaining} portions available${post.is_sample ? ' · Sample location' : ''}`;
      content.append(title, address, portions);
      const CategoryIcon = CATEGORY_ICONS[post.category] || MapPin;
      const marker = L.marker([post.pickup_lat, post.pickup_lng], {
        title: post.food_name, alt: `Pickup: ${post.food_name}`, keyboard: true,
        icon: L.divIcon({ className: 'pickup-map-marker', html: renderToStaticMarkup(<CategoryIcon size={21} aria-hidden="true" />), iconSize: [44, 44], iconAnchor: [22, 42], popupAnchor: [0, -38] }),
      }).bindPopup(content).addTo(map);
      marker.on('click', () => setSelectedId(post.id));
      markers.set(post.id, marker);
    });
    markerRefs.current = markers;
    const points = [...markers.values()].map(marker => marker.getLatLng());
    if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16, animate: false });
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container.current);
    return () => { clearTimeout(timeout); observer.disconnect(); map.remove(); mapRef.current = null; markerRefs.current.clear(); };
  }, [loading, posts]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    const position = [userLocation.lat, userLocation.lng];
    const group = L.layerGroup().addTo(map);
    const circle = L.circle(position, { radius, color: '#2c8a38', weight: 2, fillColor: '#8bc47c', fillOpacity: 0.16 }).addTo(group);
    L.circle(position, { radius: userLocation.accuracy, color: '#3780b0', weight: 1, dashArray: '4 5', fillOpacity: 0.04, interactive: false }).addTo(group);
    L.marker(position, { title: 'Your current location', alt: 'Your current location', zIndexOffset: 1000,
      icon: L.divIcon({ className: 'user-location-pin', html: '<span aria-hidden="true"></span>', iconSize: [28, 28], iconAnchor: [14, 14] }),
    }).bindPopup('You are here').addTo(group);
    map.fitBounds(circle.getBounds(), { padding: [24, 24], maxZoom: 17 });
    markerRefs.current.forEach((pin, id) => {
      const post = posts.find(item => item.id === id);
      const inside = L.latLng(position).distanceTo([post.pickup_lat, post.pickup_lng]) <= radius;
      pin.setOpacity(inside ? 1 : 0.4);
    });
    return () => { group.remove(); markerRefs.current.forEach(pin => pin.setOpacity(1)); };
  }, [userLocation, radius, loading, posts]);

  function locateUser() {
    if (!navigator.geolocation) { setLocationError('Your browser does not support location. You can still explore pickup points on the map.'); return; }
    setLocating(true);
    setLocationError('');
    const request = ++locationRequest.current;
    navigator.geolocation.getCurrentPosition(position => {
      if (request !== locationRequest.current) return;
      setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy });
      setLocating(false);
    }, reason => {
      if (request !== locationRequest.current) return;
      setLocating(false);
      setLocationError(reason.code === 1 ? 'Location access was not allowed. Enable it in your browser to see food near you.' : reason.code === 3 ? 'Finding your location took too long. Please try again.' : 'We could not find your location. Please try again.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }
  const nearby = userLocation ? located.filter(post => L.latLng(userLocation.lat, userLocation.lng).distanceTo([post.pickup_lat, post.pickup_lng]) <= radius) : located;
  function distanceLabel(post) {
    const meters = L.latLng(userLocation.lat, userLocation.lng).distanceTo([post.pickup_lat, post.pickup_lng]);
    return meters < 1000 ? `${Math.round(meters)} m away` : `${(meters / 1000).toFixed(1)} km away`;
  }

  function fitPickups() {
    const points = [...markerRefs.current.values()].map(marker => marker.getLatLng());
    if (points.length) mapRef.current?.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
  }
  function selectPickup(post) {
    setSelectedId(post.id);
    mapRef.current?.setView([post.pickup_lat, post.pickup_lng], 17);
    markerRefs.current.get(post.id)?.openPopup();
  }

  return <PageShell>
    <div className="h-full w-full overflow-y-auto flex flex-col pb-28">
      <CustomerHeader active="map" userProfile={userProfile} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <div className="pickup-map-heading">
          <div><span className="preview-eyebrow"><MapPin size={14} /> CAMPUS RESCUE MAP</span><h1>Pickup Map</h1><p>Explore available food and choose a pickup point to see its details.</p></div>
          <div className="pickup-map-tools">
          <button type="button" className="pickup-map-action" onClick={locateUser} disabled={locating || loading}><LocateFixed size={16} />{locating ? 'Finding your location…' : userLocation ? 'Refresh my location' : 'Use my location'}</button>
          <button type="button" className="pickup-map-action" onClick={fitPickups} disabled={!located.length || loading}><Navigation size={16} /> Show all pickups</button>
          </div>
        </div>
        {available.some(post => post.is_sample) && <p className="pickup-map-notice" role="status">Sample pickup points are for testing and do not represent real food locations.</p>}
        {error && <div className="pickup-map-notice" role="alert">{error} <button type="button" onClick={() => setRevision(value => value + 1)}>Try again</button></div>}
        <div className="pickup-radius-controls">
          <label htmlFor="pickup-radius">Search radius</label>
          <select id="pickup-radius" value={radius} onChange={event => setRadius(Number(event.target.value))}>
            <option value={500}>500 m</option><option value={1000}>1 km</option><option value={3000}>3 km</option><option value={5000}>5 km</option>
          </select>
          <span role="status">{userLocation ? `${nearby.length} food listing${nearby.length === 1 ? '' : 's'} within this radius` : 'Use your location to see nearby food.'}</span>
        </div>
        {locationError && <p className="pickup-map-notice" role="alert">{locationError}</p>}
        {userLocation && <p className="pickup-location-help">The green circle shows straight-line distance, not walking routes. Dashed blue circle: location accuracy (about {Math.round(userLocation.accuracy)} m). Faded pins are outside your radius.</p>}
        <div className="pickup-map-frame">
          <div ref={container} className="pickup-map-canvas" aria-label="OpenStreetMap food pickup locations" />
          {(loading || tilesLoading) && !tileError && <span className="pickup-map-loading" role="status">Loading pickup map…</span>}
        </div>
        {tileError && <div className="pickup-map-notice" role="alert">Some map areas could not load. Check your connection and try again. <button type="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} /> Reload map</button></div>}
        {!loading && !error && !located.length && <p className="pickup-map-notice">{available.length ? 'These listings do not have map locations yet.' : 'No food pickup points are available right now.'}</p>}
        {available.length > located.length && <p className="text-sm mt-3 text-[#687066]">{available.length - located.length} listing(s) have address instructions only.</p>}
        {userLocation && !loading && nearby.length === 0 && <p className="pickup-map-notice">No food pickup points are within this radius. Try a wider radius or check back later.</p>}
        <div className="pickup-location-list" aria-label="Available pickup locations">{nearby.map(post => <button key={post.id} type="button" className={selectedId === post.id ? 'is-selected' : ''} onClick={() => selectPickup(post)}>
          <MapPin size={18} /><span><strong>{post.food_name}</strong><span>{post.pickup_address}</span><small>{post.quantity_remaining} portions · {post.category}{post.is_sample ? ' · Sample' : ''}{userLocation ? ` · ${distanceLabel(post)}` : ''}</small></span>
        </button>)}</div>
      </main>
    </div>
  </PageShell>;
}
