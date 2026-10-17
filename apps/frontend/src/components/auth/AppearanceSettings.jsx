import React, { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Sun, Moon } from 'lucide-react';
import { transitionTheme } from '../../lib/theme';

export default function AppearanceSettings() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const [busy, setBusy] = useState(false);
  const inProgress = useRef(false);
  const iconRef = useRef(null);
  async function toggle() {
    if (inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      await transitionTheme(next, iconRef.current.getBoundingClientRect(), () => flushSync(() => setTheme(next)));
    } finally {
      inProgress.current = false;
      setBusy(false);
    }
  }
  return <div className="appearance-setting">
    <div className="appearance-setting-copy"><h4>Appearance</h4><p>Choose a lighter day or a quieter night.</p></div>
    <button type="button" role="switch" aria-checked={theme === 'dark'} aria-label="Dark mode" disabled={busy}
      onClick={toggle} className="appearance-toggle">
      <span ref={iconRef} className="appearance-icon">{theme === 'dark' ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}</span>
      <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
      <span className="appearance-switch-track" aria-hidden="true"><span /></span>
    </button>
    <span className="sr-only" role="status">{theme === 'dark' ? 'Dark appearance enabled' : 'Light appearance enabled'}</span>
  </div>;
}
