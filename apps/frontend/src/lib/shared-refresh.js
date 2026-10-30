import { useEffect, useRef } from 'react';

// Cross-account changes arrive on polling; local actions and returning tabs refresh immediately.
export function useSharedRefresh(refresh, interval = 15000) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    const update = () => { if (!document.hidden) callback.current(); };
    const timer = setInterval(update, interval);
    window.addEventListener('focus', update);
    window.addEventListener('foodrescue:claim_updated', update);
    window.addEventListener('foodrescue:post_updated', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
      window.removeEventListener('foodrescue:claim_updated', update);
      window.removeEventListener('foodrescue:post_updated', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [interval]);
}
