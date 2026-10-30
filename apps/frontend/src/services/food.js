import { DEFAULT_POSTS } from './sample-food';
import { supabase, isSupabaseConfigured } from './supabase';
import { readStoredArray, validateClaimQuantity } from '../lib/validation';
import { cancellationReason, ClaimWorkflowError, claimRequestError } from '../lib/claim-inputs';
import { FoodPhotoError } from '../lib/food-photo';
import { foodPhotoPathFromUrl, removeFoodPhoto, uploadFoodPhoto } from './food-photos';


const LOCAL_STORAGE_CLAIMS_KEY = 'foodrescue_claims_v1';
const LOCAL_STORAGE_POSTS_KEY = 'foodrescue_local_posts_v1';
const LOCAL_STORAGE_INVENTORY_KEY = 'foodrescue_inventory_v1';
const DEFAULT_FOOD_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80';

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
export async function createFoodPost({ foodName, description, category, quantity, pickupAddress, pickupPin, expiresHours = 3, photoFile }) {
  const parsedQuantity = Number(quantity);
  if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 100) {
    throw new Error('Portions must be a whole number from 1 to 100.');
  }
  if (!Number.isFinite(pickupPin?.lat) || pickupPin.lat < -90 || pickupPin.lat > 90
    || !Number.isFinite(pickupPin?.lng) || pickupPin.lng < -180 || pickupPin.lng > 180) {
    throw new Error('Select the pickup location on the map.');
  }

  const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000).toISOString();

  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      throw new Error('Please sign in before publishing a food listing.');
    }

    const postId = crypto.randomUUID();
    let uploadedPhoto = null;
    try {
      if (photoFile) uploadedPhoto = await uploadFoodPhoto(photoFile, session.user.id, postId);
      const { data, error } = await supabase
        .from('food_posts')
        .insert({
          id: postId,
          donor_id: session.user.id,
          food_name: foodName,
          description,
          category: category || 'Meals',
          quantity_total: parsedQuantity,
          quantity_remaining: parsedQuantity,
          pickup_address: pickupAddress,
          pickup_lat: pickupPin.lat,
          pickup_lng: pickupPin.lng,
          photo_url: uploadedPhoto?.url || DEFAULT_FOOD_IMAGE,
          expires_at: expiresAt,
          status: 'active'
        })
        .select()
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (data) {
        window.dispatchEvent(new CustomEvent('foodrescue:post_updated', { detail: { postId } }));
        return { post: data, error: null };
      }
      throw new Error('The food listing was not returned by the database.');
    } catch (error) {
      if (uploadedPhoto) {
        const { data: savedPost, error: lookupError } = await supabase
          .from('food_posts').select('id').eq('id', postId).maybeSingle();
        if (!lookupError && !savedPost) await removeFoodPhoto(uploadedPhoto.path).catch(() => {});
      }
      throw error;
    }
  }

  if (photoFile) throw new FoodPhotoError('Photo uploads require a connected Supabase account. Remove the photo or try again later.');

  const localPost = {
    id: 'custom-' + Date.now(),
    food_name: foodName,
    description,
    category: category || 'Meals',
    quantity_total: parsedQuantity,
    quantity_remaining: parsedQuantity,
    pickup_address: pickupAddress,
    pickup_lat: pickupPin.lat,
    pickup_lng: pickupPin.lng,
    photo_url: DEFAULT_FOOD_IMAGE,
    expires_at: expiresAt,
    status: 'active',
    donor: { full_name: 'Campus Member' }
  };

  const existing = readStoredArray(LOCAL_STORAGE_POSTS_KEY);
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify([localPost, ...existing]));
  window.dispatchEvent(new CustomEvent('foodrescue:post_updated', { detail: { postId: localPost.id } }));
  return { post: localPost, error: null };
}

export async function getOwnFoodPosts() {
  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in to manage your food listings.');

    const [{ data, error }, { data: claims, error: claimsError }] = await Promise.all([
      supabase
        .from('food_posts')
        .select('*')
        .eq('donor_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabase.rpc('get_donor_food_claims'),
    ]);
    if (error) throw error;
    if (claimsError) throw claimsError;
    if (!Array.isArray(data)) throw new Error('bad response');
    const claimedPostIds = new Set((Array.isArray(claims) ? claims : []).map((claim) => claim.post_id));
    return data.map((post) => ({ ...post, has_claim_history: claimedPostIds.has(post.id) }));
  }

  const inventory = readStoredObject(LOCAL_STORAGE_INVENTORY_KEY);
  return readStoredArray(LOCAL_STORAGE_POSTS_KEY)
    .map((post) => ({
      ...post,
      quantity_remaining: typeof inventory[post.id] === 'number' ? inventory[post.id] : post.quantity_remaining,
    }));
}

export async function updateFoodPost(postId, { foodName, description, category, pickupAddress, pickupPin, photoUrl, previousPhotoUrl, photoFile, expiresHours }) {
  if (!Number.isFinite(pickupPin?.lat) || pickupPin.lat < -90 || pickupPin.lat > 90
    || !Number.isFinite(pickupPin?.lng) || pickupPin.lng < -180 || pickupPin.lng > 180) {
    throw new Error('Select the pickup location on the map.');
  }
  const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000).toISOString();
  const updates = {
    food_name: foodName,
    description,
    category,
    pickup_address: pickupAddress,
    pickup_lat: pickupPin.lat,
    pickup_lng: pickupPin.lng,
    photo_url: photoUrl || DEFAULT_FOOD_IMAGE,
    expires_at: expiresAt,
  };

  if (isSupabaseConfigured()) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('Please sign in to edit your food listing.');

    let uploadedPhoto = null;
    try {
      if (photoFile) uploadedPhoto = await uploadFoodPhoto(photoFile, session.user.id, postId);
      const { data, error } = await supabase
        .from('food_posts')
        .update({ ...updates, photo_url: uploadedPhoto?.url || updates.photo_url })
        .eq('id', postId)
        .eq('donor_id', session.user.id)
        .eq('status', 'active')
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('This listing could not be found or is no longer active.');
      if (previousPhotoUrl && data.photo_url !== previousPhotoUrl) await removeFoodPhotoIfUnreferenced(previousPhotoUrl);
      window.dispatchEvent(new CustomEvent('foodrescue:post_updated', { detail: { postId } }));
      return data;
    } catch (error) {
      if (uploadedPhoto) {
        const { data: savedPost, error: lookupError } = await supabase
          .from('food_posts').select('photo_url').eq('id', postId).maybeSingle();
        if (!lookupError && savedPost?.photo_url !== uploadedPhoto.url) {
          await removeFoodPhoto(uploadedPhoto.path).catch(() => {});
        }
      }
      throw error;
    }
  }

  if (photoFile) throw new FoodPhotoError('Photo uploads require a connected Supabase account. Remove the photo or try again later.');

  const posts = readStoredArray(LOCAL_STORAGE_POSTS_KEY);
  const index = posts.findIndex((post) => post.id === postId && post.status === 'active');
  if (index < 0) throw new Error('This listing could not be found or is no longer active.');

  posts[index] = { ...posts[index], ...updates };
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('foodrescue:post_updated', { detail: { postId } }));
  return posts[index];
}

async function removeFoodPhotoIfUnreferenced(photoUrl) {
  const path = foodPhotoPathFromUrl(photoUrl);
  if (!path) return;
  const { count, error } = await supabase
    .from('food_posts')
    .select('id', { count: 'exact', head: true })
    .eq('photo_url', photoUrl);
  if (error || count !== 0) return;
  await removeFoodPhoto(path).catch(() => {});
}

export async function cancelFoodPost(postId, reason) {
  const cleanReason = cancellationReason(reason);
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.rpc('cancel_food_post', {
      p_post_id: postId,
      p_reason: cleanReason,
    });
    if (error) throw claimRequestError(error);
    window.dispatchEvent(new CustomEvent('foodrescue:post_updated', { detail: { postId } }));
    return data;
  }

  const posts = readStoredArray(LOCAL_STORAGE_POSTS_KEY);
  const index = posts.findIndex((post) => post.id === postId && post.status === 'active');
  if (index < 0) throw new Error('This listing could not be found or is no longer active.');

  posts[index] = { ...posts[index], status: 'removed_by_donor', cancellation_reason: cleanReason };
  localStorage.setItem(LOCAL_STORAGE_POSTS_KEY, JSON.stringify(posts));
  window.dispatchEvent(new CustomEvent('foodrescue:post_updated', { detail: { postId } }));
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
