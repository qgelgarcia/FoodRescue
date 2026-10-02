import React, { useEffect, useState } from 'react';
import { Route, Redirect } from 'react-router-dom';
import { getCurrentProfile } from '../services/auth';

export default function RoleGuard({ component: Component, allowedRole = 'admin', ...rest }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    getCurrentProfile().then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Verifying permissions...</div>;
  }

  if (!profile) {
    return <Redirect to="/login" />;
  }

  return (
    <Route
      {...rest}
      render={(props) =>
        profile.role === allowedRole ? (
          <Component {...props} userProfile={profile} />
        ) : (
          <Redirect to="/app/home-feed" />
        )
      }
    />
  );
}
