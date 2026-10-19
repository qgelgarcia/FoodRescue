import { DEFAULT_POSTS } from './sample-food';
import { supabase, isSupabaseConfigured } from './supabase';
import { readStoredArray, validateClaimQuantity } from '../lib/validation';
import { ClaimWorkflowError, claimRequestError } from '../lib/claim-inputs';


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
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('bad response');
    return data;
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

  if (!isSupabaseConfigured() || post.is_sample) {
    throw new ClaimWorkflowError('Sample listings are previews only. Sign in and choose a real listing to request food.');
  }

  if (isSupabaseConfigured() && !post.is_sample) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in before claiming food.');

    const { data, error } = await supabase.rpc('claim_food', {
      post_id: post.id,
      claimant_id: session.user.id,
      qty: portionCount,
    });

    if (error) throw claimRequestError(error);

    const created = Array.isArray(data) ? data[0] : data;
    if (!created?.claim_id) throw new Error('The claim was not returned by the server.');

    const claimRecord = {
      id: created.claim_id,
      claim_code: null,
      post_id: post.id,
      post_title: post.food_name,
      category: post.category,
      quantity: portionCount,
      location: post.pickup_address,
      donor_name: post.donor?.full_name || 'Campus Dining',
      claimed_at: new Date().toISOString(),
      expires_at: post.expires_at,
      status: 'pending',
      image: post.photo_url,
    };
    window.dispatchEvent(new CustomEvent('foodrescue:claim_updated', { detail: claimRecord }));
    return claimRecord;
  }

}

/**
 * Get active claims for current user
 */
export async function getMyFoodClaims() {
  const sampleClaims = readStoredArray(LOCAL_STORAGE_CLAIMS_KEY).filter((claim) => claim.is_sample);
  if (!isSupabaseConfigured()) return sampleClaims;

  const { data, error } = await supabase.rpc('get_my_food_claims');
  if (error) throw claimRequestError(error);
  return [...(Array.isArray(data) ? data.map((claim) => ({ ...claim, is_sample: false })) : []), ...sampleClaims]
    .sort((a, b) => new Date(b.claimed_at) - new Date(a.claimed_at));
}

/**
 * Mark a claim as completed / picked up
 */
export async function completeClaim(claim) {
  throw new ClaimWorkflowError('Only the donor can confirm pickup. Present your accepted claim’s QR code or manual code to the donor.');
}
