import { LiquidGlassCard } from '../ui/liquid-glass';
import React, { useEffect, useState } from 'react';
import { MapPin, Clock, Leaf, Info, X, Package } from 'lucide-react';

export default function FoodPreviewSlider({ posts, onSelect, paused = false }) {
  const [activeId, setActiveId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [touchStart, setTouchStart] = useState(null);
  const available = posts.filter(post => post.quantity_remaining > 0 && Date.parse(post.expires_at) > Date.now());
  const availableIds = available.map(post => post.id).join('|');
  useEffect(() => {
    if (available.length < 2 || paused) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      setActiveId(current => {
        const currentIndex = Math.max(0, available.findIndex(post => post.id === current));
        return available[(currentIndex + 1) % available.length].id;
      });
    }, 15000);
    return () => clearInterval(timer);
  }, [availableIds, activeId, paused]);
  if (!available.length) return null;
  const index = Math.max(0, available.findIndex(post => post.id === activeId));
  const post = available[index];
  const remaining = Math.max(0, Math.ceil((Date.parse(post.expires_at) - Date.now()) / 60000));
  function move(direction) {
    setActiveId(available[(index + direction + available.length) % available.length].id);
  }
  return <section className="food-preview" aria-label="Available food preview" aria-roledescription="carousel"
    onKeyDown={event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'Escape') setDetailsOpen(false);
    }}>
    <header className="food-preview-heading"><div><span className="preview-eyebrow"><Leaf size={14} aria-hidden="true" /> AVAILABLE NOW</span><h2>A closer look at today's rescues</h2></div>
      <span className="preview-count" aria-live="polite">{index + 1} / {available.length}</span>
    </header>
    <div className="food-preview-stage" data-details={detailsOpen}
      onTouchStart={event => setTouchStart(event.touches[0].clientX)}
      onTouchEnd={event => { if (touchStart !== null) { const distance = event.changedTouches[0].clientX - touchStart; if (Math.abs(distance) > 60) move(distance < 0 ? 1 : -1); } setTouchStart(null); }}>
      <button type="button" className="preview-image-button" aria-label={`View details for ${post.food_name}`} onClick={() => onSelect?.(post)}>
        <img key={post.id} src={post.photo_url} alt={post.food_name} className="food-preview-image preview-slide-enter" />
      </button>
      <div className="food-preview-shade" />
      <LiquidGlassCard as="span" className="preview-category" borderRadius="999px">{post.category}{post.is_sample ? ' · Sample' : ''}</LiquidGlassCard>
      <LiquidGlassCard as="button" borderRadius="16px" type="button" className="preview-glass-button preview-details-toggle" aria-expanded={detailsOpen} aria-controls="preview-product-details"
        aria-label={detailsOpen ? 'Hide preview details' : 'Show preview details'} onClick={() => setDetailsOpen(open => !open)}>
        {detailsOpen ? <X size={18} /> : <Info size={18} />}<span>{detailsOpen ? 'Hide details' : 'Details'}</span>
      </LiquidGlassCard>
      <LiquidGlassCard key={`title-${post.id}`} className="preview-product-title preview-slide-enter" borderRadius="20px" aria-live="polite"><p>{post.donor?.full_name || 'Campus community'}</p><h3>{post.food_name}</h3></LiquidGlassCard>
      {detailsOpen && <LiquidGlassCard key={`details-${post.id}`} as="aside" glowIntensity="sm" shadowIntensity="sm" blurIntensity="sm" borderRadius="24px" id="preview-product-details" className="preview-glass-panel preview-slide-enter" aria-label={`Details for ${post.food_name}`}>
        <span className="preview-panel-label">RESCUE DETAILS</span>
        <h4>{post.food_name}</h4>
        <p className="preview-description">{post.description}</p>
        <dl>
          <div><dt><MapPin size={16} /> Pickup location</dt><dd>{post.pickup_address}</dd></div>
          <div><dt><Package size={16} /> Available portions</dt><dd>{post.quantity_remaining} of {post.quantity_total} remaining</dd></div>
          <div><dt><Clock size={16} /> Pickup window</dt><dd>{remaining >= 60 ? `${Math.floor(remaining / 60)}h ` : ''}{remaining % 60}m left</dd></div>
        </dl>
        {post.dietary?.length > 0 && <div className="preview-dietary">{post.dietary.map(tag => <span key={tag}>{tag}</span>)}</div>}
        <p className="preview-footnote">{post.is_sample ? 'Sample listing for testing. No real pickup.' : 'Choose your portions on the listing card below.'}</p>
      </LiquidGlassCard>}

    </div>
    <div className="preview-thumbnails" aria-label="Choose a food preview">
      {available.map((item, itemIndex) => <button key={item.id} type="button" className={`preview-thumbnail ${index === itemIndex ? 'is-active' : ''}`}
        aria-label={`Preview ${item.food_name}`} aria-current={index === itemIndex ? 'true' : undefined} onClick={() => setActiveId(item.id)}>
        <img src={item.photo_url} alt="" loading="lazy" /><span>{item.food_name}</span>
      </button>)}
    </div>
  </section>;
}
