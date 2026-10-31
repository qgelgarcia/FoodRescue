import LoadingState from '../../components/feedback/LoadingState';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useHistory, useLocation } from 'react-router-dom';
import PageShell from '../../components/layout/PageShell';
import { getFoodPosts } from '../../services/food';
import { getMyReports, submitReport } from '../../services/reports';
import './report-page.css';

export default function ReportsPage({ userProfile }) {
  const history = useHistory();
  const location = useLocation();
  const notificationReportId = location.state?.notificationReportId || null;
  const focusedReport = useRef(null);
  const preset = location.state?.reportTarget;
  const [targetType, setTargetType] = useState(preset?.type || 'post');
  const [targetId, setTargetId] = useState(preset?.id || '');
  const [reason, setReason] = useState('');
  const [posts, setPosts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [foodPosts, ownReports] = await Promise.all([getFoodPosts(), getMyReports()]);
      setPosts(foodPosts.filter((post) => !post.is_sample));
      setReports(ownReports || []);
    } catch (cause) {
      setError(cause.message || 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (loading || !notificationReportId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      focusedReport.current?.focus({ preventScroll: true });
      focusedReport.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, reports, notificationReportId]);

  const postTargets = useMemo(() => posts
    .filter((post) => post.donor_id !== userProfile?.id)
    .map((post) => ({ id: post.id, label: post.food_name })), [posts, userProfile?.id]);

  const memberTargets = useMemo(() => [...new Map(posts
    .filter((post) => post.donor_id && post.donor_id !== userProfile?.id)
    .map((post) => [post.donor_id, { id: post.donor_id, label: post.donor?.full_name || 'Campus member' }])).values()], [posts, userProfile?.id]);

  const targets = targetType === 'post' ? postTargets : memberTargets;
  const visibleTargets = preset?.type === targetType && preset?.id && !targets.some((target) => target.id === preset.id)
    ? [{ id: preset.id, label: preset.label || 'Selected item' }, ...targets]
    : targets;

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving || reason.trim().length < 10 || !targetId) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await submitReport(targetType, targetId, reason.trim());
      setReason('');
      setNotice('Your report was submitted. You can track its status below.');
      setReports(await getMyReports());
      history.replace(location.pathname, {});
    } catch (cause) {
      setError(cause.message || 'Could not submit the report.');
    } finally {
      setSaving(false);
    }
  }

  return <PageShell>
    <div className="reports-page h-full w-full overflow-y-auto flex flex-col font-['DM_Sans',sans-serif] pb-28 relative">
      <main className="reports-main flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        <div className="page-header"><h1>Reports &amp; Support</h1><p>Send a concern to the campus admin team and track only your own reports here.</p></div>
        <section className="admin-panel member-report-panel">
          {error && <p className="admin-feedback" role="alert">{error}</p>}
          {notice && <p className="admin-feedback" role="status">{notice}</p>}
          <form className="member-report-form" onSubmit={handleSubmit}>
            <label htmlFor="report-target-type">What are you reporting?</label>
            <select id="report-target-type" value={targetType} onChange={(event) => { setTargetType(event.target.value); setTargetId(''); }}>
              <option value="post">A food listing</option>
              <option value="user">A member / donor</option>
            </select>
            <label htmlFor="report-target">Select the {targetType === 'post' ? 'listing' : 'member'}</label>
            <select id="report-target" required value={targetId} onChange={(event) => setTargetId(event.target.value)}>
              <option value="">Choose…</option>
              {visibleTargets.map((target) => <option key={target.id} value={target.id}>{target.label}</option>)}
            </select>
            {!visibleTargets.length && <small>No reportable {targetType === 'post' ? 'listings' : 'members'} found in active food listings.</small>}
            <label htmlFor="report-reason">Explain your concern</label>
            <textarea id="report-reason" required minLength={10} maxLength={2000} rows={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Describe what happened. Please include enough detail for the admin team to review it." />
            <small>10–2,000 characters. Suspended members may still submit reports.</small>
            <button type="submit" className="btn-primary admin-action-button" disabled={saving || !targetId || reason.trim().length < 10}>{saving ? 'Submitting…' : 'Submit Report'}</button>
          </form>
        </section>

        <section className="member-reports-list">
          <div className="page-header"><h2>My Reports</h2><p>Report contents remain available to you after resolution.</p></div>
          {!loading && !error && notificationReportId && !reports.some(report => report.id === notificationReportId) && <p role="status" className="admin-feedback">This report is unavailable or does not belong to your account.</p>}
          {loading ? <LoadingState label="Loading your reports" onRetry={load} />
            : error && !reports.length ? <LoadingState error={error} onRetry={load} /> : reports.length ? <div className="admin-table-wrapper"><table className="admin-table"><thead><tr><th>Target</th><th>Your explanation</th><th>Status</th><th>Submitted</th></tr></thead><tbody>
              {reports.map((report) => <tr key={report.id} ref={report.id === notificationReportId ? focusedReport : undefined} tabIndex={report.id === notificationReportId ? -1 : undefined} className={report.id === notificationReportId ? 'notification-focused-report' : undefined}>
                <td>{report.target_type}: {report.target_label || 'Unavailable'}</td><td className="admin-long-text">{report.reason}</td>
                <td><span className="report-status">{report.status}</span>{report.resolution_explanation && <small className="admin-subtext">{report.resolution_explanation}</small>}</td>
                <td>{new Date(report.created_at).toLocaleString()}</td>
              </tr>)}
            </tbody></table></div>
            : <div className="admin-empty-state">You have not submitted any reports yet.</div>}
        </section>
        <p className="member-report-back"><Link to="/app/profile">Back to profile</Link></p>
      </main>
    </div>
  </PageShell>;
}
