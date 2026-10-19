import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import SignOutButton from '../../components/auth/SignOutButton';
import {
  getAdminAuditLogs,
  getAdminClaims,
  getAdminDashboardStats,
  getAdminMembers,
  getAdminPosts,
  getAdminReports,
  removeFoodPost,
  setMemberStatus,
  updateReport,
} from '../../services/admin';

const ADMIN_NAV = [
  { path: '/admin/dashboard', label: 'Dashboard' },
  { path: '/admin/users', label: 'User Management' },
  { path: '/admin/posts', label: 'Post Moderation' },
  { path: '/admin/claims', label: 'Claims' },
  { path: '/admin/reports', label: 'Reports Queue' },
  { path: '/admin/logs', label: 'Audit Log' },
];

const LOADERS = {
  dashboard: getAdminDashboardStats,
  users: getAdminMembers,
  posts: getAdminPosts,
  claims: getAdminClaims,
  reports: getAdminReports,
  logs: getAdminAuditLogs,
};

export default function AdminDashboard({ userProfile }) {
  const location = useLocation();
  const section = location.pathname.split('/').pop() || 'dashboard';
  const [data, setData] = useState(null);
  const [loadedSection, setLoadedSection] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reportStatus, setReportStatus] = useState('all');
  const [reportTargetType, setReportTargetType] = useState('all');
  const [reportSearch, setReportSearch] = useState('');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportSort, setReportSort] = useState('priority');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [postFilter, setPostFilter] = useState('all');
  const [postSearch, setPostSearch] = useState('');
  const requestId = useRef(0);

  async function refresh() {
    const currentRequest = ++requestId.current;
    const currentSection = section;
    setLoading(true);
    setError('');
    try {
      const result = await (LOADERS[currentSection] || LOADERS.dashboard)();
      if (currentRequest !== requestId.current) return;
      setData(result);
      setLoadedSection(currentSection);
    } catch (cause) {
      if (currentRequest !== requestId.current) return;
      setData(null);
      setLoadedSection(currentSection);
      setError(cause.message || 'Could not load admin data.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    return () => { requestId.current += 1; };
  }, [section]);
  useEffect(() => {
    if (section === 'posts') setPostFilter(new URLSearchParams(location.search).get('filter') || 'all');
  }, [section, location.search]);

  const filteredReports = useMemo(() => {
    const reports = Array.isArray(data) ? data : [];
    const query = reportSearch.trim().toLowerCase();
    const start = reportFrom ? new Date(`${reportFrom}T00:00:00`) : null;
    const end = reportTo ? new Date(`${reportTo}T23:59:59.999`) : null;
    const rows = reports.filter((report) => {
      const created = new Date(report.created_at);
      return (reportStatus === 'all' || report.status === reportStatus)
      && (reportTargetType === 'all' || report.target_type === reportTargetType)
      && (!start || created >= start)
      && (!end || created <= end)
      && (!query || [report.reporter_name, report.target_type, report.target_label, report.reason]
        .some((value) => String(value || '').toLowerCase().includes(query)));
    });
    return rows.sort((left, right) => {
      if (reportSort === 'priority') {
        const priority = { open: 0, reviewed: 1, resolved: 2 };
        const statusOrder = (priority[left.status] ?? 3) - (priority[right.status] ?? 3);
        if (statusOrder) return statusOrder;
      }
      return new Date(left.created_at) - new Date(right.created_at);
    });
  }, [data, reportSearch, reportStatus, reportTargetType, reportFrom, reportTo, reportSort]);

  const filteredAuditLogs = useMemo(() => (Array.isArray(data) ? data : []).filter((log) => {
    const timestamp = new Date(log.created_at);
    const start = auditFrom ? new Date(`${auditFrom}T00:00:00`) : null;
    const end = auditTo ? new Date(`${auditTo}T23:59:59.999`) : null;
    const query = auditSearch.trim().toLowerCase();
    const searchable = [log.action, log.actor_name, log.target_type, log.target_id, JSON.stringify(log.details || {})]
      .join(' ').toLowerCase();
    return (!query || searchable.includes(query))
      && (!start || timestamp >= start)
      && (!end || timestamp <= end);
  }), [data, auditSearch, auditFrom, auditTo]);

  const filteredPosts = useMemo(() => (Array.isArray(data) ? data : []).filter((post) => {
    const query = postSearch.trim().toLowerCase();
    const descriptionMissing = !post.description?.trim();
    const expired = post.status === 'active' && Date.parse(post.expires_at) <= Date.now();
    const expiringSoon = post.status === 'active' && Date.parse(post.expires_at) > Date.now()
      && Date.parse(post.expires_at) <= Date.now() + 24 * 60 * 60 * 1000;
    const filterMatches = postFilter === 'all'
      || (postFilter === 'attention' && (descriptionMissing || expired || expiringSoon))
      || (postFilter === 'expiring' && expiringSoon)
      || (postFilter === 'expired' && expired)
      || (postFilter === 'details' && descriptionMissing);
    return filterMatches && (!query || [post.food_name, post.donor_name, post.category, post.description]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }), [data, postFilter, postSearch]);

  async function perform(key, action, success) {
    setBusy(key);
    setError('');
    setFeedback('');
    try {
      await action();
      setFeedback(success);
      await refresh();
    } catch (cause) {
      setError(cause.message || 'The admin action could not be completed.');
    } finally {
      setBusy('');
    }
  }

  function handleMemberStatus(event, member) {
    event.preventDefault();
    const reason = new FormData(event.currentTarget).get('reason');
    const nextStatus = member.status === 'active' ? 'suspended' : 'active';
    perform(member.id, () => setMemberStatus(member.id, nextStatus, reason),
      `${member.full_name} was ${nextStatus === 'active' ? 'reactivated' : 'suspended'}.`);
  }

  function handlePostRemoval(event, post) {
    event.preventDefault();
    const reason = new FormData(event.currentTarget).get('reason');
    perform(post.id, () => removeFoodPost(post.id, reason), `${post.food_name} was removed and affected pickup passes were invalidated.`);
  }

  function handleReportUpdate(event, report, nextStatus) {
    event.preventDefault();
    const explanation = new FormData(event.currentTarget).get('explanation') || '';
    perform(report.id, () => updateReport(report.id, nextStatus, explanation),
      `Report moved to ${nextStatus}.`);
  }

  const content = () => {
    if (loading || loadedSection !== section) return <div className="admin-empty-state" role="status">Loading live admin data…</div>;
    if (error && data === null) return <section className="admin-load-error" role="alert">
      <h2>{ADMIN_NAV.find((item) => item.path.endsWith(`/${section}`))?.label || 'Admin page'}</h2>
      <p className="admin-error-message">Could not load this page: {error}</p>
      <p>Confirm the Supabase migrations are applied and this account has an active admin role, then try again.</p>
      <button type="button" className="admin-action-button" onClick={refresh}>Try again</button>
    </section>;

    if (section === 'dashboard') {
      const stats = data || {};
      return <>
        <div className="page-header"><h2>Admin Overview</h2><p>Live moderation and service totals</p></div>
        <div className="metrics-grid">
          <Metric label="Active Food Posts" value={stats.active_posts} />
          <Metric label="Completed Pickups" value={stats.completed_pickups} />
          <Metric label="Active Members" value={stats.active_members} />
          <Metric label="Open Reports" value={stats.open_reports} />
        </div>
        <section className="admin-attention-box" aria-labelledby="admin-attention-title">
          <h3 id="admin-attention-title">Needs attention</h3>
          <div className="admin-attention-list">
            <Link to="/admin/reports">Unresolved reports <strong>{stats.unresolved_reports ?? stats.open_reports ?? 0}</strong></Link>
            <Link to="/admin/posts?filter=expiring">Listings expiring within 24 hours <strong>{stats.expiring_soon_posts ?? 0}</strong></Link>
            <Link to="/admin/posts?filter=expired">Active listings past expiry <strong>{stats.expired_active_posts ?? 0}</strong></Link>
            <Link to="/admin/posts?filter=details">Listings missing a description <strong>{stats.posts_missing_description ?? 0}</strong></Link>
          </div>
          <small>Expiry and missing-description checks are review prompts, not food-safety certification.</small>
        </section>
        <section className="admin-status-box">
          <h3>Privacy and audit controls</h3>
          <p>Admin listings show only the profile fields needed for moderation. Pickup coordinates and pickup passes are never included. Every status change, removal, and report transition is recorded with its actor, target, reason, and time.</p>
        </section>
      </>;
    }

    if (section === 'users') return <AdminSection title="User Management" description="Suspend or reactivate accounts. Suspended members can report concerns and finish existing pickups, but cannot start new posts or claims.">
      <AdminTable headers={['Member', 'Role', 'Status', 'Joined', 'Moderation']}>
        {(data || []).map((member) => <tr key={member.id}>
          <td>{member.full_name}</td><td><span className="admin-status-pill">{member.role}</span></td><td>{member.status}</td>
          <td>{new Date(member.created_at).toLocaleDateString()}</td>
          <td>{member.role === 'admin' ? 'Admin account' : <ReasonActionForm
            key={member.status}
            label={member.status === 'active' ? 'Suspend' : 'Reactivate'}
            busy={busy === member.id}
            onSubmit={(event) => handleMemberStatus(event, member)}
          />}</td>
        </tr>)}
      </AdminTable>
    </AdminSection>;

    if (section === 'posts') return <AdminSection title="Post Moderation" description="Review food listings. Expiry and description flags help prioritize checks; they do not certify food safety. Removal closes active claims, clears pickup coordinates, and invalidates active passes.">
      <div className="admin-filter-controls">
        <label>Show <select value={postFilter} onChange={(event) => setPostFilter(event.target.value)}>
          <option value="all">All listings</option><option value="attention">Needs attention</option>
          <option value="expiring">Expiring within 24 hours</option><option value="expired">Past expiry</option>
          <option value="details">Missing description</option>
        </select></label>
        <label>Search <input value={postSearch} onChange={(event) => setPostSearch(event.target.value)} placeholder="Food, donor, or details" /></label>
        <span>{filteredPosts.length} of {(data || []).length} listings</span>
      </div>
      <AdminTable headers={['Food listing', 'Donor', 'Status', 'Quantity', 'Expiry / details', 'Action']} emptyMessage="No listings match these filters.">
        {filteredPosts.map((post) => {
          const expiry = Date.parse(post.expires_at);
          const expired = post.status === 'active' && expiry <= Date.now();
          const expiringSoon = post.status === 'active' && expiry > Date.now() && expiry <= Date.now() + 24 * 60 * 60 * 1000;
          const missingDescription = !post.description?.trim();
          return <tr key={post.id}>
          <td>{post.food_name}<small className="admin-subtext">{post.category}</small></td>
          <td>{post.donor_name}</td><td>{post.status}</td>
          <td>{post.quantity_remaining} / {post.quantity_total}<small className="admin-subtext">Created {new Date(post.created_at).toLocaleDateString()}</small></td>
          <td>{Number.isFinite(expiry) ? new Date(expiry).toLocaleString() : '—'}
            {expired && <small className="admin-warning-tag">Past expiry</small>}
            {expiringSoon && <small className="admin-warning-tag">Expires within 24 hours</small>}
            {missingDescription && <small className="admin-warning-tag">Description missing</small>}
            {!missingDescription && <details className="admin-context"><summary>View description</summary><p>{post.description}</p></details>}
          </td>
          <td>{post.status === 'removed_by_admin' ? 'Removed' : <ReasonActionForm
            key={post.id}
            label="Remove listing"
            busy={busy === post.id}
            onSubmit={(event) => handlePostRemoval(event, post)}
          />}</td>
        </tr>;})}
      </AdminTable>
    </AdminSection>;

    if (section === 'claims') return <AdminSection title="Pickup Claims" description="Operational claim status only. Pickup authorization codes and journey coordinates are not displayed to admins.">
      <AdminTable headers={['Food listing', 'Claimant', 'Quantity', 'Status', 'Claimed']}>
        {(data || []).map((claim) => <tr key={claim.id}>
          <td>{claim.post_title || 'Removed listing'}</td><td>{claim.claimant_name}</td>
          <td>{claim.quantity_claimed}</td><td>{claim.status}</td>
          <td>{new Date(claim.claimed_at).toLocaleString()}</td>
        </tr>)}
      </AdminTable>
    </AdminSection>;

    if (section === 'reports') return <AdminSection title="Reports Queue" description="Filter and review reports. The context below omits private pickup coordinates and authorization codes.">
      <div className="admin-filter-controls">
        <label>Status <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value)}>
          <option value="all">All statuses</option><option value="open">Open</option>
          <option value="reviewed">Reviewed</option><option value="resolved">Resolved</option>
        </select></label>
        <label>Target <select value={reportTargetType} onChange={(event) => setReportTargetType(event.target.value)}>
          <option value="all">All targets</option><option value="post">Listings</option><option value="user">Members</option>
        </select></label>
        <label>Search <input value={reportSearch} onChange={(event) => setReportSearch(event.target.value)} placeholder="Reporter, target, or explanation" /></label>
        <label>From <input type="date" value={reportFrom} onChange={(event) => setReportFrom(event.target.value)} /></label>
        <label>To <input type="date" value={reportTo} onChange={(event) => setReportTo(event.target.value)} /></label>
        <label>Order <select value={reportSort} onChange={(event) => setReportSort(event.target.value)}>
          <option value="priority">Open first, oldest first</option><option value="oldest">Oldest first</option>
        </select></label>
        <span>{filteredReports.length} of {(data || []).length} reports</span>
      </div>
      <AdminTable headers={['Reporter', 'Target / context', 'Explanation', 'Status', 'Action']} emptyMessage="No reports match these filters.">
        {filteredReports.map((report) => <tr key={report.id}>
          <td>{report.reporter_name}<small className="admin-subtext">{new Date(report.created_at).toLocaleString()}</small></td>
          <td>{report.target_type}: {report.target_label || 'Unavailable'}
            <details className="admin-context"><summary>View context</summary>
              {report.target_type === 'post' ? <div>
                <p><strong>Status:</strong> {report.target_context?.status || 'Unavailable'} · <strong>Category:</strong> {report.target_context?.category || '—'}</p>
                <p><strong>Expires:</strong> {report.target_context?.expires_at ? new Date(report.target_context.expires_at).toLocaleString() : 'Unavailable'}</p>
                <p><strong>Description:</strong> {report.target_context?.description || 'No description provided.'}</p>
              </div> : <div>
                <p><strong>Role:</strong> {report.target_context?.role || 'Unavailable'} · <strong>Status:</strong> {report.target_context?.status || 'Unavailable'}</p>
                <p><strong>Joined:</strong> {report.target_context?.joined_at ? new Date(report.target_context.joined_at).toLocaleDateString() : 'Unavailable'}</p>
              </div>}
            </details>
          </td>
          <td className="admin-long-text">{report.reason}</td>
          <td>{report.status}{report.resolution_explanation && <small className="admin-subtext">Resolution: {report.resolution_explanation}</small>}</td>
          <td>{report.status === 'open' ? <button type="button" className="admin-action-button" disabled={busy === report.id} onClick={() => perform(report.id, () => updateReport(report.id, 'reviewed'), 'Report marked reviewed.')}>Mark reviewed</button>
            : report.status === 'reviewed' ? <ReasonActionForm
              key={`${report.id}-${report.status}`}
              label="Resolve"
              fieldName="explanation"
              placeholder="Resolution explanation (10+ characters)"
              busy={busy === report.id}
              onSubmit={(event) => handleReportUpdate(event, report, 'resolved')}
            /> : 'Complete'}</td>
        </tr>)}
      </AdminTable>
    </AdminSection>;

    return <AdminSection title="Audit Log" description="Search and export the latest 200 immutable moderation records.">
      <div className="admin-filter-controls admin-audit-controls">
        <div className="admin-audit-filters">
          <label>Search <input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} placeholder="Action, admin, target, or details" /></label>
          <label>From <input type="date" value={auditFrom} onChange={(event) => setAuditFrom(event.target.value)} /></label>
          <label>To <input type="date" value={auditTo} onChange={(event) => setAuditTo(event.target.value)} /></label>
        </div>
        <div className="admin-audit-toolbar">
          <span className="admin-audit-count">{filteredAuditLogs.length} of {(data || []).length} entries</span>
          <div className="admin-audit-actions">
            <button type="button" className="admin-action-button" disabled={loading} onClick={refresh}>{loading ? 'Refreshing…' : 'Refresh'}</button>
            <button type="button" className="admin-action-button" disabled={!filteredAuditLogs.length} onClick={() => downloadAuditCsv(filteredAuditLogs)}>Export visible rows as CSV</button>
          </div>
        </div>
      </div>
      <AdminTable
        headers={['Action', 'Actor', 'Target', 'Details', 'Time']}
        emptyMessage={data?.length
          ? 'No audit entries match these filters.'
          : 'No audited actions yet. Entries appear after an admin suspends or reactivates a member, removes a listing, or reviews a report.'}
      >
        {filteredAuditLogs.map((log) => <tr key={log.id}>
          <td>{log.action}</td><td>{log.actor_name || 'Former admin'}</td>
          <td>{log.target_type || '—'}{log.target_id ? ` · ${log.target_id}` : ''}</td>
          <td className="admin-long-text">{JSON.stringify(log.details || {})}</td>
          <td>{new Date(log.created_at).toLocaleString()}</td>
        </tr>)}
      </AdminTable>
    </AdminSection>;
  };

  return <div className="admin-frame">
    <header className="admin-header">
      <div className="admin-brand">Food<span>Rescue</span> <span className="badge">Admin Portal</span></div>
      <div className="admin-user-info"><span>{userProfile?.full_name || 'Admin'} ({userProfile?.role || 'admin'})</span><SignOutButton className="btn-outline-sm" /></div>
    </header>
    <div className="admin-body">
      <aside className="admin-sidebar"><nav aria-label="Admin navigation">
        {ADMIN_NAV.map((item) => <Link key={item.path} to={item.path} className={section === item.path.split('/').pop() ? 'active' : ''}>{item.label}</Link>)}
      </nav></aside>
      <main className="admin-content">
        {feedback && <p className="admin-feedback" role="status">{feedback}</p>}
        {error && data && <p className="admin-feedback" role="alert">{error}</p>}
        {content()}
      </main>
    </div>
  </div>;
}

function Metric({ label, value }) {
  return <div className="metric-card"><span className="label">{label}</span><strong className="value">{value ?? '—'}</strong></div>;
}

function AdminSection({ title, description, children }) {
  return <section><div className="page-header"><h2>{title}</h2><p>{description}</p></div><div className="admin-panel">{children}</div></section>;
}

function AdminTable({ headers, children, emptyMessage = 'Nothing to show yet.' }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  if (!rows.length) return <div className="admin-empty-state">{emptyMessage}</div>;
  return <div className="admin-table-wrapper"><table className="admin-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows}</tbody></table></div>;
}

function downloadAuditCsv(logs) {
  const columns = ['created_at', 'action', 'actor_name', 'target_type', 'target_id', 'details'];
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const content = [columns, ...logs.map((log) => columns.map((column) => column === 'details'
    ? JSON.stringify(log.details || {}) : log[column] || ''))].map((row) => row.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `foodrescue-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ReasonActionForm({ label, fieldName = 'reason', placeholder = 'Reason (10+ characters)', busy, onSubmit }) {
  return <form className="admin-inline-form" onSubmit={onSubmit}>
    <input name={fieldName} required minLength={10} maxLength={2000} placeholder={placeholder} aria-label={placeholder} />
    <button type="submit" className="admin-action-button" disabled={busy}>{busy ? 'Saving…' : label}</button>
  </form>;
}
