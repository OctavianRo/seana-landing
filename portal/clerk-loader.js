// Clerk's supported Frontend API loader. No secrets or roles are stored here.
// https://clerk.com/docs/js-frontend/getting-started/quickstart
(function () {
  'use strict';
  let pending, pendingKey;
  const appearance = { elements: { formButtonPrimary: { color: '#21140e' }, footerActionLink: { color: '#ffb580' } }, variables: { colorPrimary: '#f59a62', colorBackground: '#1A1D23', colorText: '#fffaf4', colorTextSecondary: '#d0d2d5', colorInputBackground: '#0F1114', colorInputText: '#fffaf4', borderRadius: '4px' } };
  function domainFromKey(key) {
    if (!/^pk_(test|live)_[A-Za-z0-9+/=]+$/.test(key || '')) throw new Error('Secure sign-in is not configured. Please contact hello@seana.ie.');
    const domain = atob(key.slice(8)).replace(/\$$/, '');
    if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) throw new Error('Invalid sign-in configuration. Please contact hello@seana.ie.');
    if (domain.toLowerCase() !== 'clerk.seana.ie' && !(key.startsWith('pk_test_') && domain.endsWith('.clerk.accounts.dev'))) throw new Error('Invalid sign-in host. Please contact hello@seana.ie.');
    return domain;
  }
  function script(url, integrity, key) {
    return new Promise((resolve, reject) => {
      const element = document.createElement('script');
      const timer = setTimeout(() => { element.remove(); reject(new Error('Secure sign-in took too long to load. Please try again.')); }, 15000);
      element.integrity = integrity; element.async = true; element.crossOrigin = 'anonymous'; element.src = url;
      if (key) element.setAttribute('data-clerk-publishable-key', key);
      element.onload = () => { clearTimeout(timer); resolve(); };
      element.onerror = () => { clearTimeout(timer); element.remove(); reject(new Error('Secure sign-in could not load. Please try again.')); };
      document.head.append(element);
    });
  }
  async function initialise(key) {
    const host = domainFromKey(key);
    await script(`https://${host}/npm/@clerk/ui@1.33.0/dist/ui.browser.js`, 'sha384-aA5eqxo8h/ltyVKMw4BKoUCz/b/voztgkZ19r1Hj3IIj0Mnqg+DiIz3KYvSy/sXu');
    await script(`https://${host}/npm/@clerk/clerk-js@6.32.0/dist/clerk.browser.js`, 'sha384-VBzJGwZSkIhWZ1Kvw328nLAQLxpWXrKFyB7Wp1H1CTE7vvxb86GpZDDvzq6YfW0e', key);
    if (!window.Clerk || !window.__internal_ClerkUICtor) throw new Error('Secure sign-in is unavailable. Please try again.');
    let timer;
    try { await Promise.race([window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor }, appearance }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Secure sign-in took too long to start. Please try again.')), 15000); })]); }
    finally { clearTimeout(timer); }
    return window.Clerk;
  }
  window.SeanaAuth = { load(key) { try { domainFromKey(key); if(pending&&pendingKey!==key)throw new Error('Invalid sign-in configuration change. Reload the page.'); } catch(error){return Promise.reject(error);} if (!pending) { pendingKey=key; pending = initialise(key).catch(error => { pending = null; pendingKey=null; throw error; }); } return pending; } };
})();
