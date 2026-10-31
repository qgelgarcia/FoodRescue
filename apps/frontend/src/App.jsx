import BlocksBackground from './components/layout/BlocksBackground';
import React from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import Login from './modules/auth/Login';
import Register from './modules/auth/Register';
import ForgotPassword from './modules/auth/ForgotPassword';
import ResetPassword from './modules/auth/ResetPassword';
import AdminDashboard from './modules/admin/AdminDashboard';
import AuthGuard from './guards/AuthGuard';
import RoleGuard from './guards/RoleGuard';

// Unused legacy components removed to prevent naming conflicts

import HomeFeed from './modules/feed/HomeFeed';
import MapPage from './modules/map/MapPage';
import PostPage from './modules/post/PostPage';
import HistoryPage from './modules/history/HistoryPage';
import ProfilePage from './modules/profile/ProfilePage';
import ReportsPage from './modules/reports/ReportsPage';
import NotificationsPage from './modules/notifications/NotificationsPage';
import ChatPage from './modules/chat/ChatPage';

import { AnimatePresence, motion } from 'motion/react';
import { useHistory, useLocation } from 'react-router-dom';
import FloatingBottomDock from './components/layout/FloatingBottomDock';
import CustomerHeader from './components/layout/CustomerHeader';
import PageErrorBoundary from './components/layout/PageErrorBoundary';

const ADMIN_ROUTES = [
  '/admin/dashboard',
  '/admin/users',
  '/admin/posts',
  '/admin/claims',
  '/admin/reports',
  '/admin/logs',
];

function UserModuleTabs({ userProfile }) {
  const location = useLocation();
  const history = useHistory();

  const activeMap = {
    '/app/home-feed': 'home',
    '/app/map': 'map',
    '/app/post': 'post',
    '/app/history': 'history',
    '/app/profile': 'profile',
    '/app/reports': 'profile',
    '/app/notifications': 'profile',
    '/app/chat': 'chat'
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
    <div className="relative h-screen w-full overflow-hidden flex flex-col" style={activeTab === 'chat' ? { height: '100dvh' } : undefined}>
      <CustomerHeader active={activeTab} userProfile={userProfile} />
      <div className="relative flex-1 min-h-0">
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
          <PageErrorBoundary key={location.pathname} onGoHome={() => history.push('/app/home-feed')}>
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
            <Route exact path="/app/reports">
              <ReportsPage userProfile={userProfile} />
            </Route>
            <Route exact path="/app/notifications">
              <NotificationsPage userProfile={userProfile} />
            </Route>
            <Route exact path="/app/chat">
              <ChatPage userProfile={userProfile} />
            </Route>
            <Route exact path="/app"><Redirect to="/app/home-feed" /></Route>
          </Switch>
          </PageErrorBoundary>
        </motion.div>
      </AnimatePresence>
      </div>
      <FloatingBottomDock active={activeTab} />
    </div>
  );
}

export default function App() {
  return (
    <div className="app-background-shell">
      <BlocksBackground />
      <div className="app-route-content">
    <Switch>
      <Route exact path="/login" component={Login} />
      <Route exact path="/register" component={Register} />
      <Route exact path="/forgot-password" component={ForgotPassword} />
      <Route exact path="/reset-password" component={ResetPassword} />
      {ADMIN_ROUTES.map((path) => (
        <RoleGuard key={path} exact path={path} component={AdminDashboard} allowedRole="admin" />
      ))}
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
      </div>
    </div>
  );
}
