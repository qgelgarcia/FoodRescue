import { PASSWORD_REQUIREMENTS, phoneCountry } from './account-inputs.js';
const FOOD_CATEGORIES = new Set(['Meals', 'Produce', 'Bakery', 'Snacks']);

export function validateFoodPostDraft({
  foodName,
  description,
  category,
  quantity,
  pickupAddress,
  duration,
  photos,
} = {}) {
  const errors = {};
  const cleanFoodName = String(foodName || '').trim();
  const cleanDescription = String(description || '').trim();
  const cleanAddress = String(pickupAddress || '').trim();
  const numericQuantity = Number(quantity);
  const hours = Number(duration?.hours || 0);
  const minutes = Number(duration?.minutes || 0);
  const totalMinutes = hours * 60 + minutes;

  if (!cleanFoodName) {
    errors.foodName = 'Enter a name for the food listing.';
  } else if (cleanFoodName.length < 3 || cleanFoodName.length > 120) {
    errors.foodName = 'Food name must be between 3 and 120 characters.';
  }

  if (!cleanDescription) {
    errors.description = 'Add a description and dietary or allergen notes.';
  } else if (cleanDescription.length > 1000) {
    errors.description = 'Description must be 1,000 characters or fewer.';
  }

  if (!FOOD_CATEGORIES.has(category)) {
    errors.category = 'Choose a valid food category.';
  }

  if (!Number.isInteger(numericQuantity) || numericQuantity < 1 || numericQuantity > 100) {
    errors.quantity = 'Portions must be a whole number from 1 to 100.';
  }

  if (!cleanAddress) {
    errors.pickupAddress = 'Enter the pickup location and instructions.';
  } else if (cleanAddress.length > 240) {
    errors.pickupAddress = 'Pickup instructions must be 240 characters or fewer.';
  }

  if (!Number.isInteger(hours) || hours < 0 || hours > 24 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    errors.duration = 'Choose a valid duration.';
  } else if (totalMinutes < 15 || totalMinutes > 24 * 60) {
    errors.duration = 'Pickup duration must be between 15 minutes and 24 hours.';
  }

  if (!Array.isArray(photos) || photos.length === 0) {
    errors.photos = 'Upload at least one display photo.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    values: {
      foodName: cleanFoodName,
      description: cleanDescription,
      category,
      quantity: numericQuantity,
      pickupAddress: cleanAddress,
      duration: { hours, minutes },
    },
  };
}

export function validateClaimQuantity(post, portion) {
  const numericPortion = Number(portion);
  const remaining = Number(post?.quantity_remaining);

  if (!Number.isInteger(numericPortion) || numericPortion < 1) {
    return 'Choose at least one portion.';
  }

  if (!Number.isInteger(remaining) || remaining < numericPortion) {
    return 'That many portions are no longer available.';
  }

  return null;
}

export function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function validateAccount({ email = '', password = '', fullName = '', phone = '', confirmPassword = '', role = 'student', phoneCountry: countryId = 'PH' }, signup = false) {
  const errors = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 254) errors.email = 'Enter a valid email address.';
  if (password.length < (signup ? 8 : 1) || password.length > 128) errors.password = signup ? 'Use 8 to 128 characters for your password.' : 'Enter your password (up to 128 characters).';
  if (signup) {
    if (PASSWORD_REQUIREMENTS.some(rule => !rule.regex.test(password))) errors.password = 'Please meet all the password requirements below.';
    if (fullName.trim().length < 2 || fullName.trim().length > 80) errors.fullName = 'Enter your name using 2 to 80 characters.';
    if (password !== confirmPassword || !confirmPassword) errors.confirmPassword = 'Enter the same password again.';
    const country = phoneCountry(countryId);
    if (!country || (phone.trim() && !country.pattern.test(phone))) errors.phone = country ? `Enter a valid ${country.digits}-digit mobile number, or leave it blank.` : 'Choose a phone country.';
    if (!['student', 'provider', 'org'].includes(role)) errors.role = 'Choose a campus role.';
  }
  return errors;
}
