import { FOOD_PHOTO_MIME_TYPES, MAX_FOOD_PHOTO_BYTES, validateFoodPhotoFile } from './food-photo.js';

export const PROFILE_AVATAR_BUCKET = 'profile-avatars';
export const PROFILE_AVATAR_REFERENCE_PREFIX = 'foodrescue-avatar://profile-avatars/';
export const PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS = 300;
export const PROFILE_AVATAR_MAX_BYTES = MAX_FOOD_PHOTO_BYTES;
export const PROFILE_AVATAR_MIME_TYPES = FOOD_PHOTO_MIME_TYPES;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const AVATAR_PATH = new RegExp(`^(${UUID})/(${UUID})\\.(jpg|png|webp)$`, 'i');

export function validateProfileAvatarFile(file) {
  return validateFoodPhotoFile(file);
}

export function createProfileAvatarReference(ownerId, fileName) {
  return `${PROFILE_AVATAR_REFERENCE_PREFIX}${ownerId}/${fileName}`;
}

export function parseProfileAvatarReference(reference) {
  if (typeof reference !== 'string' || !reference.startsWith(PROFILE_AVATAR_REFERENCE_PREFIX)) return null;
  const path = reference.slice(PROFILE_AVATAR_REFERENCE_PREFIX.length);
  const match = path.match(AVATAR_PATH);
  return match ? { path, ownerId: match[1] } : null;
}

export function isProfileAvatarReference(reference) {
  return typeof reference === 'string' && reference.startsWith(PROFILE_AVATAR_REFERENCE_PREFIX);
}
