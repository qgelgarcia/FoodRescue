import { supabase } from './supabase';
import { FoodPhotoError, validateFoodPhotoFile } from '../lib/food-photo';

const BUCKET = 'food-photos';

export async function uploadFoodPhoto(file, ownerId, postId) {
  const validationError = validateFoodPhotoFile(file);
  if (validationError) throw new FoodPhotoError(validationError);
  if (!ownerId || !postId) throw new Error('Sign in before uploading a listing photo.');

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
  const path = ownerId + '/' + postId + '/' + crypto.randomUUID() + '.' + extension;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new FoodPhotoError('Photo upload failed. Check your connection and sign-in, then try again.');

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

export async function removeFoodPhoto(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

export function foodPhotoPathFromUrl(photoUrl) {
  if (!photoUrl) return null;
  const marker = '/storage/v1/object/public/' + BUCKET + '/';
  const index = photoUrl.indexOf(marker);
  if (index < 0) return null;
  try {
    return decodeURIComponent(photoUrl.slice(index + marker.length));
  } catch {
    return null;
  }
}
