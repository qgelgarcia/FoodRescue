import { DEFAULT_POSTS } from './sample-food';
import { supabase, isSupabaseConfigured } from './supabase';
import { readStoredArray, validateClaimQuantity, validateFoodPostDraft } from '../lib/validation';


const LOCAL_STORAGE_CLAIMS_KEY = 'foodrescue_claims_v1';
const LOCAL_STORAGE_POSTS_KEY = 'foodrescue_local_posts_v1';
const LOCAL_STORAGE_INVENTORY_KEY = 'foodrescue_inventory_v1';

function validatePostInput(input) {
  const totalMinutes = Math.round(Number(input.expiresHours ?? 3) * 60);
  const result = validateFoodPostDraft({
    ...input,
    duration: { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 },
  });
  if (!result.isValid) throw new Error(Object.values(result.errors)[0]);
  return result.values;
}

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
      .gt('quantity_remaining', 0)
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
  }).filter(post => post.status === 'active'
    && Number(post.quantity_remaining) > 0
    && Date.parse(post.expires_at) > Date.now());
}

/**
 * Create a new surplus food listing
 */
export async function uploadFoodPhoto(file) {
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!file || !extensions[file.type] || file.size > 5 * 1024 * 1024) {
    throw new Error('Choose one JPEG, PNG, or WebP image no larger than 5 MB.');
  }
  if (!isSupabaseConfigured()) throw new Error('Photo uploads require a configured Supabase connection.');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Please sign in before uploading a food photo.');
  const path = `${session.user.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const { error } = await supabase.storage.from('food-photos').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return { path, url: supabase.storage.from('food-photos').getPublicUrl(path).data.publicUrl };
}

export async function removeFoodPhoto(path) {
  if (!path || !isSupabaseConfigured()) return;
  const { error } = await supabase.storage.from('food-photos').remove([path]);
  if (error) throw new Error(`Could not remove the uploaded photo: ${error.message}`);
}

function announcePostsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('foodrescue:posts_updated'));
}

export async function createFoodPost({ foodName, description, category, quantity, pickupAddress, pickupLat, pickupLng, expiresHours = 3, photoUrl }) {
  const values = validatePostInput({ foodName, description, category, quantity, pickupAddress, pickupLat, pickupLng, expiresHours });
  const parsedQuantity = values.quantity;

  const expiresAt = new Date(Date.now() + (values.duration.hours * 60 + values.duration.minutes) * 60000).toISOString();

  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('Please sign in before publishing a food listing.');
    }

    const { data, error } = await supabase
      .from('food_posts')
      .insert({
        donor_id: session.user.id,
        food_name: values.foodName,
        description: values.description,
        category: values.category,
        quantity_total: parsedQuantity,
        quantity_remaining: parsedQuantity,
        pickup_address: values.pickupAddress,
        pickup_lat: values.pickupLat,
        pickup_lng: values.pickupLng,
        photo_url: photoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
        expires_at: expiresAt,
        status: 'active'
      })
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) {
      announcePostsChanged();
      return { post: data, error: null };
    }
    throw new Error('The food listing was not returned by the database.');
  }

  const localPost = {
    id: 'custom-' + Date.now(),
    food_name: values.foodName,
    description: values.description,
    category: values.category,
    quantity_total: parsedQuantity,
    quantity_remaining: parsedQuantity,
    pickup_address: values.pickupAddress,
    pickup_lat: values.pickupLat,
    pickup_lng: values.pickupLng,
    photo_url: photoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    expires_at: expiresAt,
    status: 'active',
    donor: { full_name: 'Campus Member' }
  };

  const existing = readStoredArray(LOCAL_STORAGE_POSTS_KEY);
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify([localPost, ...existing]));
  announcePostsChanged();
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
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('bad response');
    return data;
  }

  const inventory = readStoredObject(LOCAL_STORAGE_INVENTORY_KEY);
  return readStoredArray(LOCAL_STORAGE_POSTS_KEY)
    .map((post) => ({
      ...post,
      quantity_remaining: typeof inventory[post.id] === 'number' ? inventory[post.id] : post.quantity_remaining,
    }));
}

export async function updateFoodPost(postId, { foodName, description, category, quantity, pickupAddress, pickupLat, pickupLng, photoUrl, expiresHours }) {
  const values = validatePostInput({ foodName, description, category, quantity, pickupAddress, pickupLat, pickupLng, expiresHours });
  const expiresAt = new Date(Date.now() + (values.duration.hours * 60 + values.duration.minutes) * 60000).toISOString();
  const updates = {
    food_name: values.foodName,
    description: values.description,
    category: values.category,
    quantity_total: values.quantity,
    quantity_remaining: values.quantity,
    pickup_address: values.pickupAddress,
    pickup_lat: values.pickupLat,
    pickup_lng: values.pickupLng,
    photo_url: photoUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
    expires_at: expiresAt,
  };

  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in to edit your food listing.');
    const { data: current, error: currentError } = await supabase
      .from('food_posts')
      .select('quantity_total')
      .eq('id', postId)
      .eq('donor_id', session.user.id)
      .single();
    if (currentError || !current) throw new Error('This listing could not be found.');

    const { data, error } = await supabase
      .from('food_posts')
      .update(updates)
      .eq('id', postId)
      .eq('donor_id', session.user.id)
      .eq('status', 'active')
      .eq('quantity_remaining', current.quantity_total)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This listing could not be found or is no longer active.');
    announcePostsChanged();
    return data;
  }

  const posts = readStoredArray(LOCAL_STORAGE_POSTS_KEY);
  const index = posts.findIndex((post) => post.id === postId && post.status === 'active');
  if (index < 0) throw new Error('This listing could not be found or is no longer active.');
  if (posts[index].quantity_remaining < posts[index].quantity_total) throw new Error('This listing is locked after its first claim.');

  posts[index] = { ...posts[index], ...updates };
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  announcePostsChanged();
  return posts[index];
}

export async function archiveFoodPost(postId, explanation) {
  const reason = String(explanation || '').trim();
  if (reason.length < 5 || reason.length > 500) throw new Error('Explain the cancellation in 5 to 500 characters.');
  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in to archive your food listing.');

    const { data, error } = await supabase
      .from('food_posts')
      .update({ status: 'removed_by_donor', donor_cancel_reason: reason })
      .eq('id', postId)
      .eq('donor_id', session.user.id)
      .eq('status', 'active')
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('This listing could not be found or is no longer active.');
    announcePostsChanged();
    return data.id;
  }

  const posts = readStoredArray(LOCAL_STORAGE_POSTS_KEY);
  const index = posts.findIndex((post) => post.id === postId && post.status === 'active');
  if (index < 0) throw new Error('This listing could not be found or is no longer active.');

  posts[index] = { ...posts[index], status: 'removed_by_donor', donor_cancel_reason: reason };
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  announcePostsChanged();
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

    const { data, error } = await supabase.rpc('claim_food', {
      post_id: post.id,
      claimant_id: session.user.id,
      qty: portionCount,
    });

    if (error) throw new Error(error.message);

    const created = Array.isArray(data) ? data[0] : data;
    if (!created?.claim_id || !created?.claim_code) throw new Error('The pickup pass was not returned by the server.');

    const claimRecord = {
      id: created.claim_id,
      claim_code: created.claim_code,
      post_id: post.id,
      post_title: post.food_name,
      category: post.category,
      quantity: portionCount,
      location: post.pickup_address,
      donor_name: post.donor?.full_name || 'Campus Dining',
      claimed_at: new Date().toISOString(),
      expires_at: post.expires_at,
      status: 'ready_for_pickup',
      image: post.photo_url,
    };
    window.dispatchEvent(new CustomEvent('foodrescue:claim_updated', { detail: claimRecord }));
    announcePostsChanged();
    return claimRecord;
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
    is_sample: true,
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
  announcePostsChanged();
  return claimRecord;
}

/**
 * Get active claims for current user
 */
export async function getMyFoodClaims() {
  const sampleClaims = readStoredArray(LOCAL_STORAGE_CLAIMS_KEY).filter((claim) => claim.is_sample);
  if (!isSupabaseConfigured()) return sampleClaims;

  const { data, error } = await supabase.rpc('get_my_food_claims');
  if (error) throw error;
  return [...(Array.isArray(data) ? data.map((claim) => ({ ...claim, is_sample: false })) : []), ...sampleClaims]
    .sort((a, b) => new Date(b.claimed_at) - new Date(a.claimed_at));
}

/**
 * Mark a claim as completed / picked up
 */
export async function completeClaim(claim) {
  if (isSupabaseConfigured() && !claim.is_sample) {
    const { error } = await supabase.rpc('complete_food_claim', {
      p_claim_id: claim.id,
      p_pickup_code: claim.claim_code,
    });
    if (error) throw error;
    window.dispatchEvent(new CustomEvent('foodrescue:claim_updated', { detail: { id: claim.id, status: 'picked_up' } }));
    return;
  }

  const claims = readStoredArray(LOCAL_STORAGE_CLAIMS_KEY);
  const updated = claims.map((c) => (c.id === claim.id ? { ...c, status: 'picked_up' } : c));
  localStorage.setItem(LOCAL_STORAGE_CLAIMS_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('foodrescue:claim_updated', { detail: { id: claim.id, status: 'picked_up' } }));
}
