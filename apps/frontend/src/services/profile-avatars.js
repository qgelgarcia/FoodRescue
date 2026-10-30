import { supabase, isSupabaseConfigured } from './supabase.js';
import { friendlyError } from './request.js';
import {
  PROFILE_AVATAR_BUCKET,
  PROFILE_AVATAR_REFERENCE_PREFIX,
  PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS,
  createProfileAvatarReference,
  parseProfileAvatarReference,
  validateProfileAvatarFile,
} from '../lib/profile-avatar.js';

function profileUpdateEvent(profile) {
  window.dispatchEvent(new CustomEvent('foodrescue:profile_updated', { detail: profile }));
}

async function currentUserId() {
  if (!isSupabaseConfigured()) throw new Error('Connect to the shared service to manage your profile photo.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(friendlyError(error));
  if (!data.session?.user?.id) throw new Error('Sign in to manage your profile photo.');
  return data.session.user.id;
}

export async function uploadOwnProfileAvatar(file) {
  const validationError = validateProfileAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const ownerId = await currentUserId();
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
  const path = `${ownerId}/${crypto.randomUUID()}.${extension}`;
  let error;
  try {
    ({ error } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).upload(path, file, {
      cacheControl: String(PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS),
      contentType: file.type,
      upsert: false,
    }));
  } catch {
    throw new Error('Photo upload failed. Your current profile photo is unchanged. Check your connection and try again.');
  }
  if (error) throw new Error('Photo upload failed. Your current profile photo is unchanged. Check your connection and try again.');
  return createProfileAvatarReference(ownerId, path.split('/')[1]);
}

export async function createOwnProfileAvatarSignedUrl(reference) {
  const parsed = parseProfileAvatarReference(reference);
  if (!parsed) throw new Error('The saved profile photo reference is invalid.');
  const ownerId = await currentUserId();
  if (parsed.ownerId !== ownerId) throw new Error('This profile photo is private to another account.');

  const { data, error } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .createSignedUrl(parsed.path, PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(friendlyError(error || 'Photo unavailable'));
  return data.signedUrl;
}

export async function readOwnProfileAvatar() {
  const ownerId = await currentUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, avatar_url, full_name, phone')
    .eq('id', ownerId)
    .maybeSingle();
  if (error) throw new Error(friendlyError(error));
  return data;
}

export async function saveOwnProfileAvatarReference(reference) {
  const ownerId = await currentUserId();
  if (reference !== null) {
    const parsed = parseProfileAvatarReference(reference);
    if (!parsed || parsed.ownerId !== ownerId || !reference.startsWith(PROFILE_AVATAR_REFERENCE_PREFIX)) {
      throw new Error('Only your own uploaded profile photo can be saved here.');
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: reference })
    .eq('id', ownerId)
    .select('id, avatar_url, full_name, phone')
    .single();
  if (error) throw new Error(friendlyError(error));
  profileUpdateEvent(data);
  return data;
}

export function publishReconciledProfileUpdate(profile) {
  if (profile) profileUpdateEvent(profile);
}

export async function removeUnreferencedOwnProfileAvatar(reference) {
  const parsed = parseProfileAvatarReference(reference);
  if (!parsed) return false;

  const ownerId = await currentUserId();
  if (parsed.ownerId !== ownerId) return false;
  const profile = await readOwnProfileAvatar();
  if (!profile || profile.avatar_url === reference) return false;

  const { error } = await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([parsed.path]);
  if (error) throw new Error('The photo was saved, but its previous private file could not be removed.');
  return true;
}
