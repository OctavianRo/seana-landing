// Clerk's supported Frontend API loader. No secrets or roles are stored here.
// https://clerk.com/docs/js-frontend/getting-started/quickstart
(function () {
  'use strict';
  let pending;
  const appearance = { variables: { colorPrimary: '#C8785A', colorBackground: '#1A1D23', colorText: '#F0ECE6', colorTextSecondary: '#b8b2ac', colorInputBackground: '#0F1114', colorInputText: '#F0ECE6', borderRadius: '4px' } };
  function domainFromKey(key) {
    if (!/^pk_(test|live)_[A-Za-z0-9+/=]+$/.test(key || '')) throw new Error('Secure sign-in is not configured. Please contact hello@seana.ie.');
    const domain = atob(key.slice(8)).replace(/\$$/, '');
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) throw new Error('Invalid sign-in configuration. Please contact hello@seana.ie.');
    return domain;
  }
  function script(url, key) {
    return new Promise((resolve, reject) => {
      const element = document.createElement('script');
      const timer = setTimeout(() => { element.remove(); reject(new Error('Secure sign-in took too long to load. Please try again.')); }, 15000);
      element.async = true; element.crossOrigin = 'anonymous'; element.src = url;
      if (key) element.setAttribute('data-clerk-publishable-key', key);
      element.onload = () => { clearTimeout(timer); resolve(); };
      element.onerror = () => { clearTimeout(timer); element.remove(); reject(new Error('Secure sign-in could not load. Please try again.')); };
      document.head.append(element);
    });
  }
  async function initialise(key) {
    const host = domainFromKey(key);
    await script(`https://${host}/npm/@clerk/ui@1/dist/ui.browser.js`);
    await script(`https://${host}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, key);
    if (!window.Clerk || !window.__internal_ClerkUICtor) throw new Error('Secure sign-in is unavailable. Please try again.');
    let timer;
    try { await Promise.race([window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor }, appearance }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Secure sign-in took too long to start. Please try again.')), 15000); })]); }
    finally { clearTimeout(timer); }
    return window.Clerk;
  }
  window.SeanaAuth = { load(key) { if (!pending) pending = initialise(key).catch(error => { pending = null; throw error; }); return pending; } };
})();
