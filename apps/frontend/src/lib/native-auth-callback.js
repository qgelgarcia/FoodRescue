export function nativeAuthCode(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'org.foodrescue.campus:' || url.hostname !== 'auth' || url.pathname !== '/callback') return null;
  return { code: url.searchParams.get('code'), failed: url.searchParams.has('error') };
}
