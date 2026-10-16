import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHistory } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { logout } from '../../services/auth';

export default function SignOutButton({ className, children = 'Sign Out' }) {
  const dialog = useRef(null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const history = useHistory();

  function close() {
    if (!pending.current) dialog.current?.close();
  }

  async function confirm() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await logout();
      dialog.current?.close();
      history.push('/login');
    } catch {
      setError('We could not sign you out. Please try again.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <>
    <button type="button" className={className} onClick={() => { setError(''); dialog.current.showModal(); }}>
      {children}
    </button>
    {createPortal(
      <dialog ref={dialog} className="signout-dialog" aria-labelledby="signout-title" aria-describedby="signout-description"
        onCancel={event => { if (pending.current) event.preventDefault(); }}
        onClick={event => {
          if (event.target !== dialog.current) return;
          const bounds = dialog.current.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
        }}>
        <div className="signout-icon"><LogOut size={24} aria-hidden="true" /></div>
        <h2 id="signout-title">Sign out of FoodRescue?</h2>
        <p id="signout-description">You can sign back in anytime to continue sharing and rescuing food.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="signout-actions" aria-busy={busy}>
          <button type="button" className="signout-cancel" autoFocus disabled={busy} onClick={close}>Stay signed in</button>
          <button type="button" className="signout-confirm" disabled={busy} onClick={confirm}>{busy ? 'Signing out…' : 'Yes, sign out'}</button>
        </div>
        <span className="sr-only" role="status">{busy ? 'Signing out. Please wait.' : ''}</span>
      </dialog>, document.body
    )}
  </>;
}
