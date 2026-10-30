import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_AVATAR_REFERENCE_PREFIX,
  createProfileAvatarReference,
  isProfileAvatarReference,
  parseProfileAvatarReference,
  validateProfileAvatarFile,
} from './profile-avatar.js';

const ownerId = '2f424182-1c77-4dd3-920e-bc90fa8955ad';
const photoId = '52d81f3c-3136-42e0-8a96-987a9f359edb';

test('profile avatar references contain an owner-scoped randomized image path', () => {
  const reference = createProfileAvatarReference(ownerId, `${photoId}.webp`);
  assert.equal(reference, `${PROFILE_AVATAR_REFERENCE_PREFIX}${ownerId}/${photoId}.webp`);
  assert.deepEqual(parseProfileAvatarReference(reference), {
    path: `${ownerId}/${photoId}.webp`,
    ownerId,
  });
  assert.equal(isProfileAvatarReference(reference), true);
  assert.equal(parseProfileAvatarReference('https://lh3.googleusercontent.com/avatar'), null);
  assert.equal(isProfileAvatarReference('https://lh3.googleusercontent.com/avatar'), false);
});

test('profile avatar references reject malformed and traversal paths', () => {
  for (const path of ['other-user/photo.png', `${ownerId}/photo.png`, `${ownerId}/../${photoId}.png`]) {
    assert.equal(parseProfileAvatarReference(`${PROFILE_AVATAR_REFERENCE_PREFIX}${path}`), null);
  }
});

test('profile avatar validation accepts JPEG, PNG, and WebP through 5 MB', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(validateProfileAvatarFile({ type, size: PROFILE_AVATAR_MAX_BYTES }), null);
  }
  assert.match(validateProfileAvatarFile({ type: 'image/gif', size: 10 }), /JPEG, PNG, or WebP/);
  assert.match(validateProfileAvatarFile({ type: 'image/jpeg', size: PROFILE_AVATAR_MAX_BYTES + 1 }), /5 MB/);
});
