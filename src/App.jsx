import React, { createContext, useContext, useState } from 'react';
import { Link, Redirect, Route } from 'react-router-dom';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import {
  addCircleOutline,
  arrowBackOutline,
  arrowForwardOutline,
  bagHandleOutline,
  calendarOutline,
  cameraOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  cloudUploadOutline,
  closeOutline,
  homeOutline,
  informationCircleOutline,
  leafOutline,
  locationOutline,
  logOutOutline,
  mapOutline,
  navigateOutline,
  optionsOutline,
  personCircleOutline,
  restaurantOutline,
  searchOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from 'ionicons/icons';

const food = [
  {
    title: 'Assorted Cafe Sandwiches',
    location: 'Main Library Cafe',
    qty: 4,
    total: 10,
    distance: '0.2 miles away',
    distanceValue: 0.2,
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=85',
    kind: 'Meals',
    expiry: '2h 45m',
    donor: 'Campus Dining',
    dietary: ['Vegetarian'],
  },
  {
    title: 'Fresh Fruit Surplus',
    location: 'Student Union Pantry',
    qty: 12,
    total: 15,
    distance: '0.5 miles away',
    distanceValue: 0.5,
    image: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=900&q=85',
    kind: 'Produce',
    expiry: '4h 10m',
    donor: 'Harvest Hall',
    dietary: ['Vegan', 'Gluten-Free'],
  },
  {
    title: 'Lemon Herb Wraps',
    location: 'Wellness Center Cafe',
    qty: 6,
    total: 8,
    distance: '0.8 miles away',
    distanceValue: 0.8,
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85',
    kind: 'Meals',
    expiry: '1h 30m',
    donor: 'Green Table',
    dietary: ['Vegetarian', 'Gluten-Free'],
  },
  {
    title: 'Artisan Sourdough Loaves',
    location: 'Arts Building Kitchen',
    qty: 3,
    total: 5,
    distance: '1.1 miles away',
    distanceValue: 1.1,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=85',
    kind: 'Bakery',
    expiry: '6h 20m',
    donor: 'The Common Room',
    dietary: [],
  },
];

const categoryOptions = ['All', 'Meals', 'Produce', 'Bakery', 'Snacks'];
const dietaryOptions = ['Vegetarian', 'Vegan', 'Gluten-Free'];
const SearchContext = createContext({ query: '', setQuery: () => {} });

function Header({ active }) {
  const { query, setQuery } = useContext(SearchContext);
  const navItems = [
    { label: 'Home', path: '/home', icon: homeOutline, key: 'home' },
    { label: 'Map', path: '/map', icon: mapOutline, key: 'map' },
    { label: 'Post Food', path: '/post', icon: addCircleOutline, key: 'post' },
    { label: 'History', path: '/history', icon: timeOutline, key: 'history' },
  ];

  return (
    <header className="topbar">
      <Link className="brand" to="/home" aria-label="FoodRescue home">
        <span className="brand-mark"><IonIcon icon={leafOutline} /></span>
        <span className="brand-name">Food<span>Rescue</span></span>
      </Link>
      <div className="search-box">
        <IonIcon icon={searchOutline} />
        <input aria-label="Search food and locations" placeholder="Search food, locations..." value={query} onChange={(event) => setQuery(event.target.value)} />
        {query && <button className="clear-search" type="button" aria-label="Clear search" onClick={() => setQuery('')}><IonIcon icon={closeOutline} /></button>}
      </div>
      <nav className="desktop-nav" aria-label="Primary navigation">
        {navItems.map((item) => (
          <Link className={active === item.key ? 'selected' : ''} key={item.key} to={item.path}>
            <IonIcon icon={item.icon} />
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <Link className={`profile-link ${active === 'profile' ? 'selected' : ''}`} to="/profile">
        <span className="profile-avatar">BB</span>
        <span className="profile-name">Brian</span>
        <IonIcon icon={chevronForwardOutline} />
      </Link>
    </header>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-brand"><span className="brand-mark small"><IonIcon icon={leafOutline} /></span><strong>FoodRescue</strong></div>
      <span className="footer-links">Privacy Policy <b>|</b> Terms of Service <b>|</b> Campus Safety <b>|</b> Contact Us</span>
      <span className="footer-copy">© 2026 FoodRescue Campus. Keeping good food in circulation.</span>
    </footer>
  );
}

function Shell({ active, children }) {
  return <div className="app-frame"><Header active={active} /><main>{children}</main><Footer /></div>;
}

function MapPanel() {
  return (
    <section className="map-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">Live nearby</span><h3>Campus around you</h3></div>
        <Link className="icon-button" to="/map" aria-label="Open campus map"><IonIcon icon={arrowForwardOutline} /></Link>
      </div>
      <div className="map-canvas">
        <div className="map-lines" />
        <span className="map-area area-one">Library</span>
        <span className="map-area area-two">Student Union</span>
        <span className="map-area area-three">Arts Quad</span>
        <span className="map-pin pin-a"><IonIcon icon={locationOutline} /></span>
        <span className="map-pin pin-b"><IonIcon icon={locationOutline} /></span>
        <span className="map-pin pin-c"><IonIcon icon={locationOutline} /></span>
        <span className="map-you"><i /> You are here</span>
      </div>
      <div className="map-panel-footer"><span><i className="live-dot" /> 8 fresh rescues nearby</span><Link to="/map">Open full map <IonIcon icon={chevronForwardOutline} /></Link></div>
    </section>
  );
}

function FoodCard({ item }) {
  const [claimed, setClaimed] = useState(false);
  const percent = Math.round((item.qty / item.total) * 100);

  return (
    <article className="food-card">
      <div className="food-image" style={{ backgroundImage: `url(${item.image})` }}>
        <span className="availability"><IonIcon icon={timeOutline} /> Ends in {item.expiry}</span>
        <span className="distance"><IonIcon icon={locationOutline} /> {item.distance}</span>
      </div>
      <div className="food-body">
        <div className="food-heading">
          <div>
            <span className="card-kicker">{item.donor}</span>
            <h3>{item.title}</h3>
            <p><IonIcon icon={locationOutline} /> {item.location}</p>
          </div>
          <span className="tag">{item.kind}</span>
        </div>
        <div className="quantity"><span>Available to rescue</span><b>{item.qty} <em>/ {item.total}</em></b></div>
        <div className="progress" aria-label={`${item.qty} of ${item.total} portions available`}><i style={{ width: `${percent}%` }} /></div>
        <div className="card-bottom">
          <span className="fresh-label"><IonIcon icon={checkmarkCircleOutline} /> Ready for pickup</span>
          <button className={claimed ? 'claimed-button' : ''} disabled={claimed} onClick={() => setClaimed(true)}>
            <IonIcon icon={claimed ? checkmarkCircleOutline : arrowForwardOutline} />
            {claimed ? 'Request sent' : 'Claim now'}
          </button>
        </div>
        {claimed && <p className="inline-success">Your request is with {item.donor}. Check History for updates.</p>}
      </div>
    </article>
  );
}

function Home() {
  const { query, setQuery } = useContext(SearchContext);
  const [category, setCategory] = useState('All');
  const [maxDistance, setMaxDistance] = useState(5);
  const [dietary, setDietary] = useState([]);

  const toggleDietary = (option) => {
    setDietary((current) => current.includes(option) ? current.filter((item) => item !== option) : [...current, option]);
  };

  const resetFilters = () => {
    setCategory('All');
    setMaxDistance(5);
    setDietary([]);
  };

  const visibleFood = food.filter((item) => {
    const categoryMatches = category === 'All' || item.kind === category;
    const distanceMatches = item.distanceValue <= maxDistance;
    const dietaryMatches = dietary.length === 0 || dietary.every((option) => item.dietary.includes(option));
    const searchableText = `${item.title} ${item.location} ${item.kind} ${item.donor}`.toLowerCase();
    const searchMatches = !query.trim() || searchableText.includes(query.trim().toLowerCase());
    return categoryMatches && distanceMatches && dietaryMatches && searchMatches;
  });

  return (
    <Shell active="home">
      <div className="home-page">
        <section className="hero-card">
          <div className="hero-copy">
            <span className="eyebrow light">A better kind of campus meal plan</span>
            <h1>Good food has<br /><em>another life.</em></h1>
            <p>Rescue surplus meals from campus kitchens before they go to waste. Quick pickups, real impact, zero awkwardness.</p>
            <div className="hero-actions">
              <Link className="primary-button" to="/map">Explore nearby <IonIcon icon={arrowForwardOutline} /></Link>
              <span className="hero-stat"><strong>2,480</strong><small>meals kept in circulation</small></span>
            </div>
          </div>
          <div className="hero-visual" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1200&q=85)' }}>
            <div className="hero-photo-caption"><span className="live-dot" /> Fresh drops, every day</div>
            <div className="hero-floating-card"><span className="floating-icon"><IonIcon icon={leafOutline} /></span><span><strong>38.5 kg</strong><small>CO2 saved this week</small></span></div>
          </div>
        </section>

        <div className="section-heading">
          <div><span className="eyebrow">Fresh on campus</span><h2>Available rescues</h2><p>Good food waiting for a second chance.</p></div>
          <div className="results-meta"><span className="live-dot" /> {visibleFood.length} drops within {maxDistance >= 10 ? '10+' : maxDistance} miles</div>
        </div>

        <div className="home-grid">
          <aside className="left-rail">
            <MapPanel />
            <section className="filter-panel">
              <div className="panel-heading"><div><span className="eyebrow">Refine results</span><h3>Filters</h3></div><button className="reset-button" type="button" onClick={resetFilters}>Reset</button></div>
              <div className="filter-block">
                <div className="filter-label"><span>Distance</span><b>{maxDistance >= 10 ? '10+ mi' : `${maxDistance} mi`}</b></div>
                <input className="range-input" type="range" min="0.5" max="10" step="0.5" value={maxDistance} onChange={(event) => setMaxDistance(Number(event.target.value))} aria-label="Maximum distance" />
                <div className="range-labels"><span>0.5 mi</span><span>10+ mi</span></div>
              </div>
              <div className="filter-block"><span className="filter-title">Category</span><div className="chips">{categoryOptions.map((option) => <button className={category === option ? 'active' : ''} key={option} type="button" onClick={() => setCategory(option)}>{option}</button>)}</div></div>
              <div className="filter-block"><span className="filter-title">Dietary needs</span><div className="check-list">{dietaryOptions.map((option) => <label key={option}><input type="checkbox" checked={dietary.includes(option)} onChange={() => toggleDietary(option)} /><span className="custom-check"><IonIcon icon={checkmarkCircleOutline} /></span>{option}</label>)}</div></div>
            </section>
          </aside>
          <section className="feed">
            <div className="feed-toolbar"><span><b>{visibleFood.length}</b> rescues ready now</span><button className="sort-button" type="button"><IonIcon icon={optionsOutline} /> Sort: Newest <IonIcon icon={chevronForwardOutline} /></button></div>
            <div className="food-grid">{visibleFood.map((item) => <FoodCard key={item.title} item={item} />)}</div>
            {visibleFood.length === 0 && <div className="empty-state"><IonIcon icon={leafOutline} /><h3>{query.trim() ? `No rescues found for "${query.trim()}"` : 'No rescues match those filters'}</h3><p>{query.trim() ? 'Try a different food, location, or category.' : 'Try widening your distance or clearing a dietary filter.'}</p><button className="secondary-button" type="button" onClick={() => { resetFilters(); setQuery(''); }}>Clear filters</button></div>}
          </section>
        </div>
      </div>
    </Shell>
  );
}

function MapPage() {
  const [locationEnabled, setLocationEnabled] = useState(false);

  return (
    <Shell active="map">
      <section className="map-view">
        <div className="page-title"><div><span className="eyebrow">Plan your pickup</span><h1>Find food near you</h1><p>Browse nearby rescues and choose a pickup that fits your route.</p></div><button className="secondary-button" type="button" onClick={() => setLocationEnabled(true)}><IonIcon icon={navigateOutline} /> {locationEnabled ? 'Demo location active' : 'Use my location'}</button></div>
        {locationEnabled && <div className="location-banner"><IonIcon icon={checkmarkCircleOutline} /><span><b>Demo location active.</b> Showing rescues closest to North Campus.</span></div>}
        <div className="large-map">
          <div className="map-lines" />
          <div className="map-road road-one" /><div className="map-road road-two" /><div className="map-road road-three" />
          <span className="map-area large-area-one">North Campus</span><span className="map-area large-area-two">Student Union</span><span className="map-area large-area-three">Arts Quad</span>
          <span className="map-pin large-pin-one"><IonIcon icon={locationOutline} /></span><span className="map-pin large-pin-two"><IonIcon icon={locationOutline} /></span><span className="map-pin large-pin-three"><IonIcon icon={locationOutline} /></span>
          <span className="map-you large-you"><i /> Your location</span>
          <div className="map-card"><span className="card-kicker">0.2 miles away</span><b>Main Library Cafe</b><small>4 rescues available</small><Link to="/home">View rescues <IonIcon icon={arrowForwardOutline} /></Link></div>
          <div className="map-legend"><span><i className="legend-pin green" /> Available rescue</span><span><i className="legend-pin orange" /> Your location</span></div>
        </div>
      </section>
    </Shell>
  );
}

function PostPage() {
  const [posted, setPosted] = useState(false);
  const [photoName, setPhotoName] = useState('');

  const submitPost = (event) => {
    event.preventDefault();
    setPosted(true);
    event.currentTarget.reset();
    setPhotoName('');
  };

  return (
    <Shell active="post">
      <section className="post-page">
        <div className="post-main">
          <Link className="back-link" to="/home"><IonIcon icon={arrowBackOutline} /> Back to available food</Link>
          <div className="page-title post-title"><div><span className="eyebrow">Give surplus a second life</span><h1>Share extra food</h1><p>Help reduce waste on campus by posting food that is safe, fresh, and ready for a quick pickup.</p></div></div>
          {posted && <div className="success-banner"><IonIcon icon={checkmarkCircleOutline} /><span><b>Your rescue is live.</b> Nearby students can now see the pickup details.</span></div>}
          <form id="post-food-form" className="post-form-card" onSubmit={submitPost}>
            <div className="form-card-heading"><div><h2>Food details</h2><p>A few clear details help the right rescuer find you.</p></div><span className="required-note">All fields marked * are required</span></div>
            <div className="field-grid"><label>Food name *<input required placeholder="e.g. Assorted bakery pastries" /></label><label>Pickup location *<input required placeholder="Building and room" /></label></div>
            <label>Description *<textarea required placeholder="Tell rescuers what is available, how it was stored, and any allergens..."></textarea></label>
            <label className="photo-drop"> <span className="upload-icon"><IonIcon icon={photoName ? cameraOutline : cloudUploadOutline} /></span><span><b>{photoName || 'Add a clear photo'}</b><small>{photoName ? 'Photo ready to upload' : 'JPG or PNG, up to 10 MB'}</small></span><input type="file" accept="image/png,image/jpeg" onChange={(event) => setPhotoName(event.target.files?.[0]?.name || '')} /></label>
            <div className="form-footer"><span><IonIcon icon={shieldCheckmarkOutline} /> Your post is only visible to the campus community.</span><button className="primary-button" type="submit">Post food now <IonIcon icon={arrowForwardOutline} /></button></div>
          </form>
        </div>
        <aside className="tips">
          <span className="tips-icon"><IonIcon icon={leafOutline} /></span><span className="eyebrow light">Make an impact</span><h2>Small post.<br />Big difference.</h2><p>Clear information helps food move quickly from a campus kitchen to someone who needs it.</p>
          <div className="tip-list"><div><span>01</span><p>Share the exact pickup spot.</p></div><div><span>02</span><p>Mention allergens and dietary details.</p></div><div><span>03</span><p>Use a bright, honest photo.</p></div></div>
          <div className="status-card"><span className="live-dot" /><div><small>POST STATUS</small><b>{posted ? 'Published just now' : 'Ready to publish'}</b></div></div>
          <button className="outline light-outline" type="reset" form="post-food-form" onClick={() => { setPosted(false); setPhotoName(''); }}>Clear form</button>
        </aside>
      </section>
    </Shell>
  );
}

function HistoryPage() {
  const [cancelled, setCancelled] = useState(false);

  return (
    <Shell active="history">
      <section className="history-page">
        <Link className="back-link" to="/history"><IonIcon icon={arrowBackOutline} /> Claim history</Link>
        <div className="page-title"><div><span className="eyebrow">Your current pickup</span><h1>Claim status</h1><p>Claim ID: <b>#FR-4920-XYZ</b></p></div><span className={`status-pill large ${cancelled ? 'cancelled' : ''}`}><i /> {cancelled ? 'Cancelled' : 'Ready for pickup'}</span></div>
        {cancelled && <div className="success-banner muted-banner"><IonIcon icon={informationCircleOutline} /><span>This claim has been cancelled. You can find another rescue on the <Link to="/home">home page</Link>.</span></div>}
        <div className="history-grid">
          <div className="history-main">
            <section className="tracking panel"><div className="panel-heading"><div><span className="eyebrow">Pickup timeline</span><h2>Tracking progress</h2></div><span className="time-chip"><IonIcon icon={timeOutline} /> Expires 5:00 PM</span></div><div className="timeline"><div className="timeline-step done"><span className="step-icon"><IonIcon icon={checkmarkCircleOutline} /></span><div><b>Claim requested</b><small>Oct 24 · 2:15 PM · Request sent to Campus Dining</small></div></div><div className="timeline-step current"><span className="step-icon"><IonIcon icon={bagHandleOutline} /></span><div><b>Ready for pickup <em>Expiring soon</em></b><small>Your claim has been approved. Please pick up the items before 5:00 PM today.</small></div></div><div className="timeline-step"><span className="step-icon"><IonIcon icon={checkmarkCircleOutline} /></span><div><b>Picked up</b><small>Awaiting confirmation from donor.</small></div></div></div></section>
            <section className="claimed panel"><div className="thumb" style={{ backgroundImage: `url(${food[0].image})` }} /><div><span className="card-kicker">Claimed rescue</span><h3>Assorted artisan sandwiches</h3><p><IonIcon icon={locationOutline} /> Main Dining Hall <span className="dot-separator" /> Prepared today</p><p className="muted-copy">Turkey, veggie, and ham varieties left over from the faculty luncheon.</p><span className="tag">Contains: Gluten, Dairy</span></div><Link to="/map">View details <IonIcon icon={chevronForwardOutline} /></Link></section>
          </div>
          <aside className="directions panel"><div className="mini-map"><div className="map-lines" /><span className="map-pin mini-pin"><IonIcon icon={locationOutline} /></span><span className="map-you mini-you"><i /> Pickup</span></div><span className="eyebrow">Pickup destination</span><h3>Main Dining Hall<br />Back Entrance</h3><p>123 College Ave, Campus North</p><div className="notice"><b><IonIcon icon={informationCircleOutline} /> Pickup instructions</b><p>Use the service entrance near the loading dock. Ring the buzzer and present your Claim ID.</p></div><Link className="primary-button full-button" to="/map"><IonIcon icon={navigateOutline} /> Get directions</Link><button className="outline full-button" type="button" onClick={() => setCancelled(true)} disabled={cancelled}>{cancelled ? 'Claim cancelled' : 'Cancel claim'}</button></aside>
        </div>
      </section>
    </Shell>
  );
}

function ProfilePage() {
  return (
    <Shell active="profile">
      <section className="profile-page">
        <aside className="profile-rail"><div className="avatar">BB</div><h3>Brian Baron</h3><p>North Campus <span className="dot-separator" /> Joined 2026</p><span className="tag trusted"><IonIcon icon={shieldCheckmarkOutline} /> Trusted rescuer</span><div className="settings"><b>ACCOUNT SETTINGS</b><button className="active" type="button"><IonIcon icon={personCircleOutline} /> Personal info</button><button type="button"><IonIcon icon={timeOutline} /> Notifications</button><button type="button"><IonIcon icon={shieldCheckmarkOutline} /> Privacy & security</button><button type="button"><IonIcon icon={informationCircleOutline} /> Help & support</button></div><button className="signout" type="button"><IonIcon icon={logOutOutline} /> Sign out</button></aside>
        <section className="impact"><div className="page-title"><div><span className="eyebrow">Your contribution</span><h1>Your impact</h1><p>Every rescue keeps food, money, and resources in motion.</p></div><span className="impact-date"><IonIcon icon={calendarOutline} /> Since Jan 2026</span></div><div className="stats"><div><small><IonIcon icon={restaurantOutline} /></small><span>Total meals shared</span><b>142</b><em>+18 this month</em></div><div className="orange"><small><IonIcon icon={leafOutline} /></small><span>CO2 saved (kg)</span><b>38.5</b><em>+6.2 this month</em></div><div className="gray"><small><IonIcon icon={bagHandleOutline} /></small><span>Waste diverted (lb)</span><b>115</b><em>+24 this month</em></div></div><div className="history-tabs"><button className="active" type="button">Claim history</button><button type="button">Donation history</button></div>{['Assorted bagels', 'Fresh garden salads', 'Catered sandwiches'].map((name, i) => <article className="history-row" key={name}><div className="row-image" style={{ backgroundImage: `url(${food[i % 2].image})` }} /><div><span className="card-kicker">Student Union Cafeteria</span><h3>{name}</h3><p><IonIcon icon={calendarOutline} /> Oct {i + 2}, 2026 <span className="dot-separator" /> Claimed {i + 1} items</p></div><span className={`status-pill ${i === 1 ? 'pending' : ''}`}><i /> {i === 1 ? 'Pending' : 'Completed'}</span><IonIcon className="row-arrow" icon={chevronForwardOutline} /></article>)}<button className="load-more" type="button">Load more history <IonIcon icon={arrowForwardOutline} /></button></section>
      </section>
    </Shell>
  );
}

export default function App() {
  const [query, setQuery] = useState('');

  return <SearchContext.Provider value={{ query, setQuery }}><IonTabs><IonRouterOutlet><Route exact path="/home" component={Home} /><Route exact path="/map" component={MapPage} /><Route exact path="/post" component={PostPage} /><Route exact path="/history" component={HistoryPage} /><Route exact path="/profile" component={ProfilePage} /><Route exact path="/"><Redirect to="/home" /></Route></IonRouterOutlet><IonTabBar slot="bottom"><IonTabButton tab="home" href="/home"><IonIcon icon={homeOutline} /><IonLabel>Home</IonLabel></IonTabButton><IonTabButton tab="map" href="/map"><IonIcon icon={mapOutline} /><IonLabel>Map</IonLabel></IonTabButton><IonTabButton tab="post" href="/post"><IonIcon icon={addCircleOutline} /><IonLabel>Post Food</IonLabel></IonTabButton><IonTabButton tab="history" href="/history"><IonIcon icon={timeOutline} /><IonLabel>History</IonLabel></IonTabButton><IonTabButton tab="profile" href="/profile"><IonIcon icon={personCircleOutline} /><IonLabel>Profile</IonLabel></IonTabButton></IonTabBar></IonTabs></SearchContext.Provider>;
}
