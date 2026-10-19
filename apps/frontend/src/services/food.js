import { DEFAULT_POSTS } from './sample-food';
import { supabase, isSupabaseConfigured } from './supabase';
import { readStoredArray, validateClaimQuantity } from '../lib/validation';


const LOCAL_STORAGE_CLAIMS_KEY = 'foodrescue_claims_v1';
const LOCAL_STORAGE_POSTS_KEY = 'foodrescue_local_posts_v1';
const LOCAL_STORAGE_INVENTORY_KEY = 'foodrescue_inventory_v1';

function readStoredObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/**
 * Fetch available surplus food posts
 */
export async function getFoodPosts() {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase
      .from('food_posts')
      .select('*, donor:donor_id(full_name, phone)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('bad response');
    if (data.length > 0 || !import.meta.env.DEV) return data;
  }

  // Load any locally created posts merged with defaults
  const customPosts = readStoredArray(LOCAL_STORAGE_POSTS_KEY).filter((post) => post.status === 'active');
  const inventory = readStoredObject(LOCAL_STORAGE_INVENTORY_KEY);

  return [...customPosts, ...DEFAULT_POSTS].map((post) => {
    const remaining = inventory[post.id];
    if (typeof remaining !== 'number') return post;

    return {
      ...post,
      quantity_remaining: remaining,
      status: remaining === 0 ? 'fully_claimed' : post.status,
    };
  });
}

/**
 * Create a new surplus food listing
 */
export async function createFoodPost({ foodName, description, category, quantity, pickupAddress, expiresHours = 3, photoUrl }) {
  const parsedQuantity = Number(quantity);
  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 100) {
    throw new Error('Portions must be a whole number from 1 to 100.');
  }

  const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000).toISOString();

  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('Please sign in before publishing a food listing.');
    }

    const { data, error } = await supabase
      .from('food_posts')
      .insert({
        donor_id: session.user.id,
        food_name: foodName,
        description,
        category: category || 'Meals',
        quantity_total: parsedQuantity,
        quantity_remaining: parsedQuantity,
        pickup_address: pickupAddress,
        pickup_lat: 37.7749,
        pickup_lng: -122.4194,
        photo_url: photoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        expires_at: expiresAt,
        status: 'active'
      })
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return { post: data, error: null };
    throw new Error('The food listing was not returned by the database.');
  }

  const localPost = {
    id: 'custom-' + Date.now(),
    food_name: foodName,
    description,
    category: category || 'Meals',
    quantity_total: parsedQuantity,
    quantity_remaining: parsedQuantity,
    pickup_address: pickupAddress,
    photo_url: photoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    expires_at: expiresAt,
    status: 'active',
    donor: { full_name: 'Campus Member' }
  };

  const existing = readStoredArray(LOCAL_STORAGE_POSTS_KEY);
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify([localPost, ...existing]));
  return { post: localPost, error: null };
}

export async function getOwnFoodPosts() {
  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in to manage your food listings.');

    const { data, error } = await supabase
      .from('food_posts')
      .select('*')
      .eq('donor_id', session.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('bad response');
    return data;
  }

  const inventory = readStoredObject(LOCAL_STORAGE_INVENTORY_KEY);
  return readStoredArray(LOCAL_STORAGE_POSTS_KEY)
    .filter((post) => post.status === 'active')
    .map((post) => ({
      ...post,
      quantity_remaining: typeof inventory[post.id] === 'number' ? inventory[post.id] : post.quantity_remaining,
    }));
}

export async function updateFoodPost(postId, { foodName, description, category, pickupAddress, photoUrl, expiresHours }) {
  const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000).toISOString();
  const updates = {
    food_name: foodName,
    description,
    category,
    pickup_address: pickupAddress,
    photo_url: photoUrl,
    expires_at: expiresAt,
  };

  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in to edit your food listing.');

    const { data, error } = await supabase
      .from('food_posts')
      .update(updates)
      .eq('id', postId)
      .eq('donor_id', session.user.id)
      .eq('status', 'active')
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This listing could not be found or is no longer active.');
    return data;
  }

  const posts = readStoredArray(LOCAL_STORAGE_POSTS_KEY);
  const index = posts.findIndex((post) => post.id === postId && post.status === 'active');
  if (index < 0) throw new Error('This listing could not be found or is no longer active.');

  posts[index] = { ...posts[index], ...updates };
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  return posts[index];
}

export async function archiveFoodPost(postId) {
  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in to archive your food listing.');

    const { data, error } = await supabase
      .from('food_posts')
      .update({ status: 'removed_by_donor' })
      .eq('id', postId)
      .eq('donor_id', session.user.id)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This listing could not be found or is no longer active.');
    return data.id;
  }

  const posts = readStoredArray(LOCAL_STORAGE_POSTS_KEY);
  const index = posts.findIndex((post) => post.id === postId && post.status === 'active');
  if (index < 0) throw new Error('This listing could not be found or is no longer active.');

  posts[index] = { ...posts[index], status: 'removed_by_donor' };
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  return postId;
}

/**
 * Claim portions of a food post
 */
export async function claimFoodPost(post, portionCount = 1) {
  const validationError = validateClaimQuantity(post, portionCount);
  if (validationError) throw new Error(validationError);

  if (isSupabaseConfigured() && !post.is_sample) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in before claiming food.');

    const { error } = await supabase.rpc('claim_food', {
      post_id: post.id,
      claimant_id: session.user.id,
      qty: portionCount,
    });

    if (error) throw new Error(error.message);
  }

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
    is_sample: Boolean(post.is_sample),
    image: post.photo_url
  };

  // Persist locally
  const claims = readStoredArray(LOCAL_STORAGE_CLAIMS_KEY);
  claims.unshift(claimRecord);
  localStorage.setItem(LOCAL_STORAGE_CLAIMS_KEY, JSON.stringify(claims));

  const inventory = readStoredObject(LOCAL_STORAGE_INVENTORY_KEY);
  inventory[post.id] = Number(post.quantity_remaining) - portionCount;
  localStorage.setItem(LOCAL_STORAGE_INVENTORY_KEY, JSON.stringify(inventory));

  // Dispatch event for UI reactivity
  window.dispatchEvent(new CustomEvent('foodrescue:claim_updated', { detail: claimRecord }));
  return claimRecord;
}

/**
 * Get active claims for current user
 */
export function getActiveClaims() {
  return readStoredArray(LOCAL_STORAGE_CLAIMS_KEY);
}

/**
 * Mark a claim as completed / picked up
 */
export function completeClaim(claimId) {
  const claims = readStoredArray(LOCAL_STORAGE_CLAIMS_KEY);
  const updated = claims.map((c) => (c.id === claimId ? { ...c, status: 'picked_up' } : c));
  localStorage.setItem(LOCAL_STORAGE_CLAIMS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('foodrescue:claim_updated', { detail: { id: claimId, status: 'picked_up' } }));
  return updated;
}
