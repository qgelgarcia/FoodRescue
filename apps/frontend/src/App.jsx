import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import Login from './modules/auth/Login';
import Register from './modules/auth/Register';
import AdminDashboard from './modules/admin/AdminDashboard';
import AuthGuard from './guards/AuthGuard';
import RoleGuard from './guards/RoleGuard';

// Unused legacy components removed to prevent naming conflicts

import HomeFeed from './components/HomeFeed';
import MapPage from './components/MapPage';
import PostPage from './components/PostPage';
import HistoryPage from './components/HistoryPage';
import ProfilePage from './components/ProfilePage';

import { AnimatePresence, motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import FloatingBottomDock from './components/FloatingBottomDock';

function UserModuleTabs({ userProfile }) {
  const location = useLocation();

  const activeMap = {
    '/app/home-feed': 'home',
    '/app/map': 'map',
    '/app/post': 'post',
    '/app/history': 'history',
    '/app/profile': 'profile'
  };
  const activeTab = activeMap[location.pathname] || 'home';
  const direction = location.state?.direction || 1;

  const pageVariants = {
    initial: (dir) => ({
      x: dir > 0 ? '15%' : '-15%',
      opacity: 0,
    }),
    in: {
      x: 0,
      opacity: 1,
    },
    out: (dir) => ({
      x: dir > 0 ? '-15%' : '15%',
      opacity: 0,
    })
  };

  const pageTransition = {
    type: "tween",
    ease: "easeInOut",
    duration: 0.25
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#f5faee]">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={location.pathname}
          custom={direction}
          variants={pageVariants}
          initial="initial"
          animate="in"
          exit="out"
          transition={pageTransition}
          className="absolute inset-0 flex flex-col"
        >
          <Switch location={location}>
            <Route exact path="/app/home-feed">
              <HomeFeed userProfile={userProfile} />
            </Route>
            <Route exact path="/app/map">
              <MapPage userProfile={userProfile} />
            </Route>
            <Route exact path="/app/post">
              <PostPage userProfile={userProfile} />
            </Route>
            <Route exact path="/app/history">
              <HistoryPage userProfile={userProfile} />
            </Route>
            <Route exact path="/app/profile">
              <ProfilePage userProfile={userProfile} />
            </Route>
            <Route exact path="/app"><Redirect to="/app/home-feed" /></Route>
          </Switch>
        </motion.div>
      </AnimatePresence>
      <FloatingBottomDock active={activeTab} />
    </div>
  );
}

export default function App() {
  return (
    <Switch>
      <Route exact path="/login" component={Login} />
      <Route exact path="/register" component={Register} />
      <RoleGuard exact path="/admin/dashboard" component={AdminDashboard} allowedRole="admin" />
      <Route exact path="/admin"><Redirect to="/admin/dashboard" /></Route>
      <AuthGuard path="/app" component={UserModuleTabs} />
      <Route exact path="/home"><Redirect to="/app/home-feed" /></Route>
      <Route exact path="/map"><Redirect to="/app/map" /></Route>
      <Route exact path="/post"><Redirect to="/app/post" /></Route>
      <Route exact path="/history"><Redirect to="/app/history" /></Route>
      <Route exact path="/profile"><Redirect to="/app/profile" /></Route>
      <Route exact path="/"><Redirect to="/login" /></Route>
      <Redirect to="/login" />
    </Switch>
  );
}
