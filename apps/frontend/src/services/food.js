import { supabase, isSupabaseConfigured } from './supabase';

const DEFAULT_POSTS = [
  {
    id: 'post-1',
    food_name: 'Assorted Cafe Sandwiches',
    description: 'Freshly prepared artisan turkey & pesto, mozzarella tomato, and roast beef ciabatta sandwiches from lunch catering.',
    category: 'Meals',
    quantity_total: 10,
    quantity_remaining: 4,
    pickup_address: 'Main Library Cafe, Ground Floor',
    pickup_lat: 37.7749,
    pickup_lng: -122.4194,
    photo_url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80',
    expires_at: new Date(Date.now() + 2 * 3600 * 1000 + 45 * 60 * 1000).toISOString(),
    status: 'active',
    dietary: ['Vegetarian Option', 'Halal'],
    donor: { full_name: 'Campus Dining Services' }
  },
  {
    id: 'post-2',
    food_name: 'Fresh Organic Fruit Bowls',
    description: 'Crisp sliced melons, berries, pineapples and whole apples packed in compostable sealed containers.',
    category: 'Produce',
    quantity_total: 15,
    quantity_remaining: 12,
    pickup_address: 'Student Union Pantry, Room 104',
    pickup_lat: 37.7752,
    pickup_lng: -122.4182,
    photo_url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=800&q=80',
    expires_at: new Date(Date.now() + 4 * 3600 * 1000 + 15 * 60 * 1000).toISOString(),
    status: 'active',
    dietary: ['Vegan', 'Gluten-Free'],
    donor: { full_name: 'Green Earth Pantry' }
  },
  {
    id: 'post-3',
    food_name: 'Warm Artisan Croissants & Danishes',
    description: 'Freshly baked butter croissants, chocolate pain au chocolat, and almond pastries from morning service.',
    category: 'Bakery',
    quantity_total: 18,
    quantity_remaining: 6,
    pickup_address: 'North Quad Espresso Bar',
    pickup_lat: 37.7760,
    pickup_lng: -122.4170,
    photo_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80',
    expires_at: new Date(Date.now() + 1 * 3600 * 1000 + 10 * 60 * 1000).toISOString(),
    status: 'active',
    dietary: ['Vegetarian'],
    donor: { full_name: 'Campus Bakery' }
  },
  {
    id: 'post-4',
    food_name: 'Hearty Vegan Grain Bowls',
    description: 'Quinoa, roasted sweet potatoes, kale, chickpeas and creamy tahini dressing. High protein and ready to eat.',
    category: 'Meals',
    quantity_total: 8,
    quantity_remaining: 3,
    pickup_address: 'Athletic Center Fuel Station',
    pickup_lat: 37.7738,
    pickup_lng: -122.4210,
    photo_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
    expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
    status: 'active',
    dietary: ['Vegan', 'Gluten-Free', 'High-Protein'],
    donor: { full_name: 'Athletics Nutrition' }
  }
];

const LOCAL_STORAGE_CLAIMS_KEY = 'foodrescue_claims_v1';
const LOCAL_STORAGE_POSTS_KEY = 'foodrescue_local_posts_v1';

/**
 * Fetch available surplus food posts
 */
export async function getFoodPosts() {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('food_posts')
        .select('*, donor:donor_id(full_name, phone)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch {
      // fallback to mock posts
    }
  }

  // Load any locally created posts merged with defaults
  const customPosts = JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
  return [...customPosts, ...DEFAULT_POSTS];
}

/**
 * Create a new surplus food listing
 */
export async function createFoodPost({ foodName, description, category, quantity, pickupAddress, expiresHours = 3, photoUrl }) {
  const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000).toISOString();
  
  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      try {
        const { data, error } = await supabase
          .from('food_posts')
          .insert({
            donor_id: session.user.id,
            food_name: foodName,
            description,
            category: category || 'Meals',
            quantity_total: parseInt(quantity, 10),
            quantity_remaining: parseInt(quantity, 10),
            pickup_address: pickupAddress,
            pickup_lat: 37.7749,
            pickup_lng: -122.4194,
            photo_url: photoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
            expires_at: expiresAt,
            status: 'active'
          })
          .select()
          .maybeSingle();

        if (!error && data) return { post: data, error: null };
      } catch (err) {
        // fallback to local storage
      }
    }
  }

  const localPost = {
    id: 'custom-' + Date.now(),
    food_name: foodName,
    description,
    category: category || 'Meals',
    quantity_total: parseInt(quantity, 10),
    quantity_remaining: parseInt(quantity, 10),
    pickup_address: pickupAddress,
    photo_url: photoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    expires_at: expiresAt,
    status: 'active',
    donor: { full_name: 'Campus Member' }
  };

  const existing = JSON.parse(localStorage.getItem(LOCAL_STORAGE_POSTS_KEY) || '[]');
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify([localPost, ...existing]));
  return { post: localPost, error: null };
}

/**
 * Claim portions of a food post
 */
export async function claimFoodPost(post, portionCount = 1) {
  const claimRecord = {
    id: 'claim-' + Date.now().toString(36),
    claim_code: `FR-${Math.floor(1000 + Math.random() * 9000)}`,
    post_id: post.id,
    post_title: post.food_name,
    category: post.category,
    quantity: portionCount,
    location: post.pickup_address,
    donor_name: post.donor?.full_name || 'Campus Dining',
    claimed_at: new Date().toISOString(),
    expires_at: post.expires_at,
    status: 'ready_for_pickup', // ready_for_pickup -> picked_up -> completed
    image: post.photo_url
  };

  // Persist locally
  const claims = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CLAIMS_KEY) || '[]');
  claims.unshift(claimRecord);
  localStorage.setItem(LOCAL_STORAGE_CLAIMS_KEY, JSON.stringify(claims));

  // If Supabase configured, attempt remote insert
  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('claims').insert({
          post_id: post.id,
          claimer_id: session.user.id,
          quantity_claimed: portionCount,
          status: 'claimed'
        });
      }
    } catch {
      // offline fallback handled
    }
  }

  // Dispatch event for UI reactivity
  window.dispatchEvent(new CustomEvent('foodrescue:claim_updated', { detail: claimRecord }));
  return claimRecord;
}

/**
 * Get active claims for current user
 */
export function getActiveClaims() {
  const claims = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CLAIMS_KEY) || '[]');
  return claims;
}

/**
 * Mark a claim as completed / picked up
 */
export function completeClaim(claimId) {
  const claims = JSON.parse(localStorage.getItem(LOCAL_STORAGE_CLAIMS_KEY) || '[]');
  const updated = claims.map((c) => (c.id === claimId ? { ...c, status: 'picked_up' } : c));
  localStorage.setItem(LOCAL_STORAGE_CLAIMS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('foodrescue:claim_updated', { detail: { id: claimId, status: 'picked_up' } }));
  return updated;
}
