// Upgrade owner sign-in before requesting account configuration or credentials.
// Keep local development on its configured origin and preserve return parameters.
(function () {
  const needsHttps = location.protocol === 'http:' &&
    ['seana.ie', 'www.seana.ie'].includes(location.hostname);
  window.SeanaPortalRedirecting = needsHttps;
  if (needsHttps) location.replace('https://www.seana.ie' + location.pathname + location.search + location.hash);
})();
