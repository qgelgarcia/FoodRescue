import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../../services/supabase';
import { nativeAuthCode } from '../../lib/native-auth-callback';

export default function NativeAuthCallback() {
  const history = useHistory();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let listener;
    const seen = new Set();
    async function accept({ url }) {
      const callback = nativeAuthCode(url);
      if (!callback || disposed || seen.has(url)) return;
      seen.add(url);
      let failed = callback.failed || !callback.code;
      if (!failed) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
          failed = Boolean(error);
        } catch { failed = true; }
      }
      await Browser.close().catch(() => {});
      if (!disposed) history.replace(failed ? '/login?auth_error=1' : '/login');
    }
    App.addListener('appUrlOpen', accept).then(handle => {
      if (disposed) handle.remove(); else listener = handle;
    });
    App.getLaunchUrl().then(launch => { if (launch) accept(launch); }).catch(() => {});
    return () => { disposed = true; listener?.remove(); };
  }, [history]);
  return null;
}
