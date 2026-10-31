import React, { useEffect, useState } from 'react';
import { Leaf, RefreshCw, WifiOff } from 'lucide-react';
import { LOADING_DELAYS, loadingStage } from '../../lib/loading-state';
import './LoadingState.css';

// Used for reads only: retry must never replay a form submission or payment.
export default function LoadingState({ label = 'Loading your content', error = '', onRetry, fullScreen = false }) {
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  useEffect(() => {
    setElapsed(0);
    const timers = Object.values(LOADING_DELAYS).map(delay => setTimeout(() => setElapsed(delay), delay));
    return () => timers.forEach(clearTimeout);
  }, [label, attempt, error]);
  const stage = loadingStage(elapsed, Boolean(error || retryError));
  const recovery = stage === 'failed' || stage === 'recovery';
  const title = stage === 'failed' ? 'We couldn’t load this section' : stage === 'recovery' ? 'Loading is taking too long' : stage === 'reassurance' ? 'We’re still here' : stage === 'slow' ? 'Taking a little longer' : label;
  const description = stage === 'failed' ? 'You can try again. Refresh reloads this section without repeating your previous actions.' : stage === 'recovery' ? 'The connection may be slow. You can keep waiting or refresh this section to try again.' : stage === 'reassurance' ? 'Your request is still in progress. You don’t need to submit it again.' : stage === 'slow' ? 'We’re waiting for the latest information. Please give it a moment.' : 'Getting things ready for you…';
  async function retry() {
    if (retrying || !onRetry) return;
    setRetrying(true);
    setRetryError('');
    setAttempt(value => value + 1);
    try { await onRetry(); } catch { setRetryError('Please check your connection and try again.'); } finally { setRetrying(false); }
  }
  return (
    <div className={`system-loading${fullScreen ? ' is-fullscreen' : ''}`} data-stage={stage}>
      <div className={`system-loading-symbol${recovery ? ' is-recovery' : ''}`} aria-hidden="true">
        {recovery ? <WifiOff size={25} /> : <Leaf size={27} />}
        {!recovery && <span className="system-loading-orbit" />}
      </div>
      <div role={stage === 'failed' ? 'alert' : 'status'} aria-live="polite" aria-atomic="true">
        <h2>{title}</h2>
        <p>{description}</p>
        {(error || retryError) && <p className="system-loading-detail">{error || retryError}</p>}
      </div>
      {recovery && onRetry && <button type="button" onClick={() => void retry()} disabled={retrying}><RefreshCw size={16} />{retrying ? 'Refreshing…' : 'Refresh'}</button>}
    </div>
  );
}
