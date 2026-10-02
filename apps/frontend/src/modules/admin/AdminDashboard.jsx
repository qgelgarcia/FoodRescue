import React from 'react';
import { useHistory } from 'react-router-dom';
import { logout } from '../../services/auth';

export default function AdminDashboard({ userProfile }) {
  const history = useHistory();

  async function handleLogout() {
    await logout();
    history.push('/login');
  }

  return (
    <div className="admin-frame">
      <header className="admin-header">
        <div className="admin-brand">
          Food<span>Rescue</span> <span className="badge">Admin Portal</span>
        </div>
        <div className="admin-user-info">
          <span>👤 {userProfile?.full_name || 'Admin'} ({userProfile?.role})</span>
          <button onClick={handleLogout} className="btn-outline-sm">Sign Out</button>
        </div>
      </header>

      <div className="admin-body">
        <aside className="admin-sidebar">
          <nav>
            <a className="active" href="/admin/dashboard">📊 Dashboard</a>
            <a href="#users" onClick={(e) => { e.preventDefault(); alert('User Management unlocked in Phase 5'); }}>👥 User Management</a>
            <a href="#posts" onClick={(e) => { e.preventDefault(); alert('Post Moderation unlocked in Phase 5'); }}>🍱 Post Moderation</a>
            <a href="#reports" onClick={(e) => { e.preventDefault(); alert('Reports Queue unlocked in Phase 5'); }}>🚩 Reports Queue</a>
            <a href="#broadcast" onClick={(e) => { e.preventDefault(); alert('Broadcast unlocked in Phase 5'); }}>📢 Broadcast</a>
            <a href="#logs" onClick={(e) => { e.preventDefault(); alert('Activity Logs unlocked in Phase 5'); }}>📜 Activity Logs</a>
          </nav>
        </aside>

        <main className="admin-content">
          <div className="page-header">
            <h2>Admin Overview</h2>
            <p>Moderation and activity summary across campus</p>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <span className="label">Active Food Posts</span>
              <strong className="value">14</strong>
              <small className="trend positive">↑ 3 new today</small>
            </div>
            <div className="metric-card">
              <span className="label">Food Meals Saved</span>
              <strong className="value">342</strong>
              <small className="trend positive">98% claim rate</small>
            </div>
            <div className="metric-card">
              <span className="label">Active Campus Users</span>
              <strong className="value">820</strong>
              <small className="trend">Students & Orgs</small>
            </div>
            <div className="metric-card">
              <span className="label">Open Reports</span>
              <strong className="value">1</strong>
              <small className="trend warning">Pending review</small>
            </div>
          </div>

          <section className="admin-status-box">
            <h3>🛡️ Security & Role Enforcement</h3>
            <p>You are viewing this screen because your profile role is strictly <code>admin</code>. Non-admin users are prevented by <code>RoleGuard</code> on the client and Row Level Security on the database.</p>
          </section>
        </main>
      </div>
    </div>
  );
}
