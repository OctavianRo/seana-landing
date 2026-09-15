(function () {
  'use strict';
  let signingOut;
  async function request(url, options, clerk, onUnauthorized) {
    const session = clerk?.session;
    const sessionId = session?.id;
    const current = () => {
      if (clerk?.session?.id !== sessionId) throw Object.assign(new Error('Your account changed. Please reload this page.'), {code:'session_changed'});
    };
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await session?.getToken(attempt ? { skipCache: true } : undefined);
      current();
      response = await fetch(url, { ...options, headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      current();
      if (response.status !== 401 || !session || clerk.session?.id !== sessionId) break;
    }
    // A late response from a previous identity must never clear the new user's workspace.
    if (response.status === 401 && clerk?.session?.id === sessionId) onUnauthorized?.();
    // Body parsing can yield too: validate identity again before returning data.
    if (response.json) {
      const json=response.json.bind(response);
      response.json=async()=>{const value=await json();current();return value;};
    }
    return response;
  }
  function signOut(clerk, clearWorkspace, returnUrl) {
    if (signingOut) return signingOut;
    signingOut = (async () => {
      const destination = new URL(returnUrl, location.origin);
      if (destination.origin !== location.origin) throw new Error('Invalid sign-in return page.');
      if (!clerk?.signOut) throw new Error('Secure sign-out is unavailable. Please reload and try again.');
      const sessionId = clerk.session?.id;
      clearWorkspace();
      await clerk.signOut(sessionId ? { sessionId } : undefined);
      location.replace(destination.href);
    })().finally(() => { signingOut = null; });
    return signingOut;
  }
  window.SeanaSession = { request, signOut };
})();
