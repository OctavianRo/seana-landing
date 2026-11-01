window.SeanaPortalCanonicalOrigin="https://portal.seana.ie";
// The deployment sets SeanaPortalCanonicalOrigin only after the new host passes
// DNS, TLS and sign-in checks. Never derive a redirect origin from URL inputs.
(function () {
  const productionHosts=['seana.ie','www.seana.ie','portal.seana.ie'];
  const canonical=window.SeanaPortalCanonicalOrigin==='https://portal.seana.ie'
    ? 'https://portal.seana.ie' : 'https://www.seana.ie';
  const isPortal=/^\/portal(?:\/|$)/.test(location.pathname);
  const migrate=isPortal&&canonical==='https://portal.seana.ie'&&['seana.ie','www.seana.ie'].includes(location.hostname);
  const upgrade=location.protocol==='http:'&&productionHosts.includes(location.hostname);
  window.SeanaPortalRedirecting=migrate||upgrade;
  if(window.SeanaPortalRedirecting){
    const origin=location.hostname==='portal.seana.ie'?'https://portal.seana.ie':isPortal?canonical:'https://www.seana.ie';
    location.replace(origin+location.pathname+location.search+location.hash);
  }
})();
