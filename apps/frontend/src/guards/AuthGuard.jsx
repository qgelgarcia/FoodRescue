import React, { useEffect, useState } from 'react';
import { Route, Redirect } from 'react-router-dom';
import { getCurrentProfile } from '../services/auth';

export default function AuthGuard({ component: Component, ...rest }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const updated = () => getCurrentProfile().then(setProfile);
    window.addEventListener('foodrescue:profile_updated', updated);
    getCurrentProfile().then((p) => {
      setProfile(p);
      setLoading(false);
    });
    return () => window.removeEventListener('foodrescue:profile_updated', updated);
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading session...</div>;
  }

  return (
    <Route
      {...rest}
      render={(props) =>
        profile ? <Component {...props} userProfile={profile} /> : <Redirect to="/login" />
      }
    />
  );
}
