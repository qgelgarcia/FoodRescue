import LoadingState from '../components/feedback/LoadingState';
import { friendlyError } from '../services/request';
import React, { useEffect, useState } from 'react';
import { Route, Redirect } from 'react-router-dom';
import { getCurrentProfile } from '../services/auth';

export default function RoleGuard({ component: Component, allowedRole = 'admin', ...rest }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getCurrentProfile().then(value => {
      if (active) setProfile(value);
    }).catch(cause => {
      if (active) setError(friendlyError(cause));
    }).finally(() => { if (active) setLoading(false); });
    const updated = () => {
      getCurrentProfile().then(value => { if (active) setProfile(value); }).catch(() => {});
    };
    window.addEventListener('foodrescue:profile_updated', updated);
    return () => { active = false; window.removeEventListener('foodrescue:profile_updated', updated); };
  }, [revision]);

  if (loading || error) {
    return <LoadingState fullScreen label="Loading your session" error={error} onRetry={() => setRevision(value => value + 1)} />;
  }

  if (!profile) {
    return <Redirect to="/login" />;
  }

  return (
    <Route
      {...rest}
      render={(props) =>
        profile.role === allowedRole && profile.status === 'active' ? (
          <Component {...props} userProfile={profile} />
        ) : (
          <Redirect to="/app/home-feed" />
        )
      }
    />
  );
}
