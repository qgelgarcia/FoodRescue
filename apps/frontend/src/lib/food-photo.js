export const MAX_FOOD_PHOTO_BYTES = 5 * 1024 * 1024;
export const FOOD_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class FoodPhotoError extends Error {}

export function validateFoodPhotoFile(file) {
  if (!file) return null;
  if (!FOOD_PHOTO_MIME_TYPES.has(file.type)) return 'Choose a JPEG, PNG, or WebP photo.';
  if (file.size <= 0 || file.size > MAX_FOOD_PHOTO_BYTES) return 'Choose a photo no larger than 5 MB.';
  return null;
}
