'use strict';
// Retire old owner onboarding URLs, including Clerk hash-routed OAuth returns.
// Keep the callback payload for Clerk, but never allow its return target to send
// an owner back to the retired page or to an external origin.
(() => {
  if (window.SeanaPortalRedirecting) return;
  const destination = new URL('/portal/dashboard.html', location.origin);
  const incoming = new URLSearchParams(location.search);
  const callback = location.hash.startsWith('#/sso-callback');
  destination.searchParams.set('auth', incoming.get('auth') === 'signin' ? 'signin' : 'signup');
  const source = incoming.get('source');
  if (['website', 'owner_referral', 'outreach', 'event'].includes(source)) destination.searchParams.set('source', source);
  if (callback) {
    const split = location.hash.indexOf('?');
    const params = new URLSearchParams(split < 0 ? '' : location.hash.slice(split + 1));
    for (const key of [...params.keys()]) {
      if (/redirect_url$/.test(key)) params.set(key, destination.origin + destination.pathname + '');
    }
    destination.hash = '/sso-callback' + (params.size ? '?' + params.toString() : '');
  }
  location.replace(destination.href);
})();
