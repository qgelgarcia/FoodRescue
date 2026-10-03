import React, { useState } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import { logout } from '../../services/auth';

const ADMIN_NAV = [
  { path: '/admin/dashboard', label: 'Dashboard' },
  { path: '/admin/users', label: 'User Management' },
  { path: '/admin/posts', label: 'Post Moderation' },
  { path: '/admin/reports', label: 'Reports Queue' },
  { path: '/admin/broadcast', label: 'Broadcast' },
  { path: '/admin/logs', label: 'Activity Logs' },
];

const DEMO_USERS = [
  { name: 'Alex Student', email: 'student@campus.edu', role: 'student', status: 'active' },
  { name: 'Campus Dining (Provider)', email: 'donor@campus.edu', role: 'provider', status: 'active' },
  { name: 'Campus Administrator', email: 'admin@campus.edu', role: 'admin', status: 'active' },
];

const DEMO_POSTS = [
  { title: 'Assorted Cafe Sandwiches', category: 'Meals', status: 'active', quantity: '4 / 10' },
  { title: 'Fresh Organic Fruit Bowls', category: 'Produce', status: 'active', quantity: '12 / 15' },
  { title: 'Warm Artisan Croissants & Danishes', category: 'Bakery', status: 'active', quantity: '6 / 18' },
];

const DEMO_LOGS = [
  { action: 'Admin dashboard opened', actor: 'Campus Administrator', time: 'Today' },
  { action: 'Role enforcement checked', actor: 'System', time: 'Today' },
];

export default function AdminDashboard({ userProfile }) {
  const history = useHistory();
  const location = useLocation();
  const [broadcast, setBroadcast] = useState('');
  const [broadcastNotice, setBroadcastNotice] = useState('');
  const activeSection = location.pathname.split('/').pop() || 'dashboard';

  async function handleLogout() {
    await logout();
    history.push('/login');
  }

  function handleBroadcast(event) {
    event.preventDefault();
    const message = broadcast.trim();
    if (!message) return;

    setBroadcastNotice('Broadcast prepared for the next notification service step.');
    setBroadcast('');
  }

  function renderDashboard() {
    return (
      <>
        <div className="page-header">
          <h2>Admin Overview</h2>
          <p>Moderation and activity summary across campus</p>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <span className="label">Active Food Posts</span>
            <strong className="value">14</strong>
            <small className="trend positive">3 new today</small>
          </div>
          <div className="metric-card">
            <span className="label">Food Meals Saved</span>
            <strong className="value">342</strong>
            <small className="trend positive">98% claim rate</small>
          </div>
          <div className="metric-card">
            <span className="label">Active Campus Users</span>
            <strong className="value">820</strong>
            <small className="trend">Students and organizations</small>
          </div>
          <div className="metric-card">
            <span className="label">Open Reports</span>
            <strong className="value">1</strong>
            <small className="trend warning">Pending review</small>
          </div>
        </div>

        <section className="admin-status-box">
          <h3>Security and Role Enforcement</h3>
          <p>
            This screen is protected by <code>RoleGuard</code>. Non-admin users are redirected
            to the user feed, while database Row Level Security protects Supabase data.
          </p>
        </section>
      </>
    );
  }

  function renderUsers() {
    return (
      <AdminSection title="User Management" description="Review the roles and account status used by the demo environment.">
        <AdminTable headers={['Name', 'Email', 'Role', 'Status']}>
          {DEMO_USERS.map((user) => (
            <tr key={user.email}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td><span className="admin-status-pill">{user.role}</span></td>
              <td>{user.status}</td>
            </tr>
          ))}
        </AdminTable>
      </AdminSection>
    );
  }

  function renderPosts() {
    return (
      <AdminSection title="Post Moderation" description="Review active food listings and their remaining portions.">
        <AdminTable headers={['Food listing', 'Category', 'Status', 'Quantity']}>
          {DEMO_POSTS.map((post) => (
            <tr key={post.title}>
              <td>{post.title}</td>
              <td>{post.category}</td>
              <td><span className="admin-status-pill">{post.status}</span></td>
              <td>{post.quantity}</td>
            </tr>
          ))}
        </AdminTable>
      </AdminSection>
    );
  }

  function renderReports() {
    return (
      <AdminSection title="Reports Queue" description="Reports will appear here when users submit moderation concerns.">
        <div className="admin-empty-state">
          <strong>No open reports</strong>
          <span>The queue is currently clear.</span>
        </div>
      </AdminSection>
    );
  }

  function renderBroadcast() {
    return (
      <AdminSection title="Broadcast" description="Prepare a campus announcement for the notification service.">
        {broadcastNotice && <p className="admin-feedback" role="status">{broadcastNotice}</p>}
        <form className="admin-broadcast-form" onSubmit={handleBroadcast}>
          <label htmlFor="broadcast-message">Announcement message</label>
          <textarea
            id="broadcast-message"
            value={broadcast}
            onChange={(event) => setBroadcast(event.target.value)}
            placeholder="Example: The Student Union pantry has fresh produce available."
            rows="5"
            required
          />
          <button type="submit" className="btn-primary admin-action-button">Prepare Broadcast</button>
        </form>
      </AdminSection>
    );
  }

  function renderLogs() {
    return (
      <AdminSection title="Activity Logs" description="Review the actions recorded by the admin interface.">
        <AdminTable headers={['Action', 'Actor', 'Time']}>
          {DEMO_LOGS.map((log) => (
            <tr key={`${log.action}-${log.time}`}>
              <td>{log.action}</td>
              <td>{log.actor}</td>
              <td>{log.time}</td>
            </tr>
          ))}
        </AdminTable>
      </AdminSection>
    );
  }

  const sectionContent = {
    dashboard: renderDashboard,
    users: renderUsers,
    posts: renderPosts,
    reports: renderReports,
    broadcast: renderBroadcast,
    logs: renderLogs,
  }[activeSection] || renderDashboard;

  return (
    <div className="admin-frame">
      <header className="admin-header">
        <div className="admin-brand">
          Food<span>Rescue</span> <span className="badge">Admin Portal</span>
        </div>
        <div className="admin-user-info">
          <span>{userProfile?.full_name || 'Admin'} ({userProfile?.role || 'admin'})</span>
          <button type="button" onClick={handleLogout} className="btn-outline-sm">Sign Out</button>
        </div>
      </header>

      <div className="admin-body">
        <aside className="admin-sidebar">
          <nav aria-label="Admin navigation">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={activeSection === item.path.split('/').pop() ? 'active' : ''}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="admin-content">{sectionContent()}</main>
      </div>
    </div>
  );
}

function AdminSection({ title, description, children }) {
  return (
    <section>
      <div className="page-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="admin-panel">{children}</div>
    </section>
  );
}

function AdminTable({ headers, children }) {
  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
