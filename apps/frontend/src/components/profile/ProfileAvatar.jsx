import React, { useEffect, useState } from 'react';
import { createOwnProfileAvatarSignedUrl } from '../../services/profile-avatars.js';
import {
  isProfileAvatarReference,
  PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS,
} from '../../lib/profile-avatar.js';

const RENEW_MARGIN_SECONDS = 60;
const RETRY_SECONDS = 30;

export default function ProfileAvatar({
  avatarUrl,
  fullName,
  className = 'size-10 rounded-full',
  imageClassName = 'size-full rounded-[inherit] object-cover',
  fallbackClassName = 'flex size-full items-center justify-center rounded-[inherit] bg-[#e8efe2] text-[#1c6428] font-bold',
  alt = 'Profile photo',
}) {
  const [resolvedUrl, setResolvedUrl] = useState(null);

  useEffect(() => {
    let active = true;
    let timer;

    if (!avatarUrl) {
      setResolvedUrl(null);
      return () => { active = false; };
    }
    if (!isProfileAvatarReference(avatarUrl)) {
      setResolvedUrl(avatarUrl);
      return () => { active = false; };
    }

    setResolvedUrl(null);
    async function refreshSignedUrl() {
      try {
        const url = await createOwnProfileAvatarSignedUrl(avatarUrl);
        if (!active) return;
        setResolvedUrl(url);
        timer = window.setTimeout(
          refreshSignedUrl,
          (PROFILE_AVATAR_SIGNED_URL_TTL_SECONDS - RENEW_MARGIN_SECONDS) * 1000,
        );
      } catch {
        if (!active) return;
        timer = window.setTimeout(refreshSignedUrl, RETRY_SECONDS * 1000);
      }
    }
    refreshSignedUrl();

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [avatarUrl]);

  const initials = (fullName || 'U').trim().slice(0, 1).toUpperCase() || 'U';
  return (
    <span className={`inline-flex ${className}`} aria-hidden="true">
      {resolvedUrl ? (
        <img src={resolvedUrl} alt={alt} className={imageClassName} onError={() => setResolvedUrl(null)} />
      ) : (
        <span className={fallbackClassName}>{initials}</span>
      )}
    </span>
  );
}
