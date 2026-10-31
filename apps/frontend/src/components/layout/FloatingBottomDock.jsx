import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Home, Compass, Plus, Bookmark, User } from 'lucide-react';
import { Dock, DockItem } from '../ui/calamansi/dock';
import { getMyFoodClaims } from '../../services/food';
import { useSharedRefresh } from '../../lib/shared-refresh';

const TAB_ORDER = { home: 0, map: 1, post: 2, history: 3, profile: 4, chat: 5 };

export default function FloatingBottomDock({ active }) {
  const history = useHistory();
  const [pendingCount, setPendingCount] = useState(0);
  useSharedRefresh(() => getMyFoodClaims().then(claims => setPendingCount(claims.filter(claim => !claim.is_sample && ['pending', 'accepted'].includes(claim.status) && new Date(claim.expires_at).getTime() > Date.now()).length)).catch(() => {}));

  useEffect(() => {
    let mounted = true;
    const load = () => getMyFoodClaims().then((claims) => {
      if (mounted) setPendingCount(claims.filter((claim) => !claim.is_sample && ['pending', 'accepted'].includes(claim.status) && new Date(claim.expires_at).getTime() > Date.now()).length);
    }).catch(() => {});
    load();
    window.addEventListener('foodrescue:claim_updated', load);
    return () => {
      mounted = false;
      window.removeEventListener('foodrescue:claim_updated', load);
    };
  }, []);

  const handleNav = (tab, path) => {
    const currentIdx = TAB_ORDER[active];
    const nextIdx = TAB_ORDER[tab];
    // If we're already on the tab, don't do anything
    if (history.location.pathname === path) return;
    
    // Direction: 1 for right, -1 for left
    const direction = nextIdx > currentIdx ? 1 : -1;
    history.push({ pathname: path, state: { direction } });
  };

  return (
    <div style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }} className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none px-4">
      <div className="pointer-events-auto filter drop-shadow-2xl">
        <Dock reach={110} size={42} magnify={54}>
          <DockItem
            active={active === 'home'}
            ariaLabel="Home feed"
            onClick={() => handleNav('home', '/app/home-feed')}
          >
            <Home size={22} strokeWidth={active === 'home' ? 2.5 : 2} />
          </DockItem>

          <DockItem
            active={active === 'map'}
            ariaLabel="Pickup map"
            onClick={() => handleNav('map', '/app/map')}
          >
            <Compass size={22} strokeWidth={active === 'map' ? 2.5 : 2} />
          </DockItem>

          <DockItem
            active={active === 'post'}
            ariaLabel="Post surplus food"
            onClick={() => handleNav('post', '/app/post')}
          >
            <Plus size={22} strokeWidth={active === 'post' ? 2.5 : 2} />
          </DockItem>

          <DockItem
            active={active === 'history'}
            ariaLabel="Claim history"
            onClick={() => handleNav('history', '/app/history')}
          >
            <div className="relative flex items-center justify-center">
              <Bookmark size={22} strokeWidth={active === 'history' ? 2.5 : 2} />
              {pendingCount > 0 && (
                <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-rose-500 border-[2px] border-white ring-1 ring-black/5" />
              )}
            </div>
          </DockItem>

          <DockItem
            active={active === 'profile'}
            ariaLabel="Profile"
            onClick={() => handleNav('profile', '/app/profile')}
          >
            <div className="relative flex items-center justify-center">
              <User size={22} strokeWidth={active === 'profile' ? 2.5 : 2} />
              <span className="absolute -bottom-1 -right-1 size-2.5 rounded-full bg-rose-500 border-[2px] border-white ring-1 ring-black/5" />
            </div>
          </DockItem>
        </Dock>
      </div>
    </div>
  );
}
