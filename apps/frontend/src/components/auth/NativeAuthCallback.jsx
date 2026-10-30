import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../../services/supabase';
import { completeNativePasswordRecovery } from '../../services/auth';
import { nativeAuthCallback, nativeAuthDestination } from '../../lib/native-auth-callback';

export default function NativeAuthCallback() {
  const history = useHistory();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let listener;
    const processing = new Set();
    const lastHandledAt = {};
    async function accept({ url }) {
      const callback = nativeAuthCallback(url);
      if (!callback || disposed || processing.has(callback.kind)) return;
      // Android can report its launch URL and appUrlOpen for the same intent.
      if (Date.now() - (lastHandledAt[callback.kind] || 0) < 5000) return;
      processing.add(callback.kind);
      let succeeded = false;
      if (!callback.failed && callback.code) {
        try {
          if (callback.kind === 'recovery') {
            const { error } = await completeNativePasswordRecovery(callback.code);
            succeeded = !error;
          } else {
            const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
            succeeded = !error;
          }
        } catch { succeeded = false; }
      }
      await Browser.close().catch(() => {});
      processing.delete(callback.kind);
      lastHandledAt[callback.kind] = Date.now();
      if (!disposed) history.replace(nativeAuthDestination(callback, succeeded));
    }
    App.addListener('appUrlOpen', accept).then(handle => {
      if (disposed) handle.remove(); else listener = handle;
    });
    App.getLaunchUrl().then(launch => { if (launch) accept(launch); }).catch(() => {});
    return () => { disposed = true; listener?.remove(); };
  }, [history]);
  return null;
}
