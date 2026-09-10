'use strict';
const APP_ORIGIN = 'https://saunaapp-production.up.railway.app';
const localApp = ['localhost', '127.0.0.1'].includes(location.hostname) && location.port !== '4173';
const API = localApp || location.origin === APP_ORIGIN ? '' : APP_ORIGIN;
const dashboardUrl = API + '/portal/dashboard.html';
const $ = id => document.getElementById(id);
let clerk;
const incomingSource = new URLSearchParams(location.search).get('source');
const source = ['website', 'owner_referral', 'outreach', 'event'].includes(incomingSource) ? incomingSource : 'direct';
function node(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
function message(text) { $('message').replaceChildren(...(text ? [node('p', text, 'notice')] : [])); }
async function api(path, body) {
  const token = await clerk?.session?.getToken();
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
  let response; try { response = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal }); } finally { clearTimeout(timeout); }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Owner setup is not available yet. Please contact hello@seana.ie and we’ll help you get started.');
  const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Please try again.'); return result;
}
function action(label, fn) { const button = node('button', label); button.type = 'button'; button.addEventListener('click', () => busy(button, fn)); return button; }
async function busy(button, fn) { button.disabled = true; message(''); try { await fn(); } catch (error) { message(error.name === 'AbortError' ? 'This is taking longer than expected. Please try again.' : error instanceof TypeError ? 'We couldn’t connect to owner setup. Please try again, or contact hello@seana.ie for help.' : error.message || 'Something went wrong. Please try again.'); } finally { button.disabled = false; } }
async function begin(mode = 'signin') {
  message('Opening secure owner sign-in…');
  if (!clerk) {
    let config;
    try { config = await api('/api/public-config'); }
    catch (error) {
      // Account creation remains available while the owner API is unavailable.
      // This grants no sauna permissions and uses only our fixed Clerk origin.
      message('Owner setup is temporarily unavailable. Opening your secure account page. Return here later to finish your sauna setup.');
      location.assign(mode === 'signup' ? 'https://accounts.seana.ie/sign-up' : 'https://accounts.seana.ie/sign-in');
      return;
    }
    if (config.ownerOnboardingEnabled !== true) throw new Error('Owner setup is being prepared. Please contact hello@seana.ie and we’ll help you get started.');
    if (!config.clerkPublishableKey) throw new Error('Secure sign-in is unavailable. Please contact hello@seana.ie.');
    clerk = await window.SeanaAuth.load(config.clerkPublishableKey);
  }
  if (!clerk.user) {
    const returnUrl = location.origin + location.pathname + '?source=' + encodeURIComponent(source) + '#setup';
    clerk.unmountSignIn?.($('signin')); clerk.unmountSignUp?.($('signin'));
    if (mode === 'signup') clerk.mountSignUp($('signin'), { forceRedirectUrl: returnUrl, signInUrl: location.origin + location.pathname + '?source=' + encodeURIComponent(source) + '&auth=signin#setup' });
    else clerk.mountSignIn($('signin'), { forceRedirectUrl: returnUrl, signUpUrl: location.origin + location.pathname + '?source=' + encodeURIComponent(source) + '&auth=signup#setup' });
    message('Verify your email to continue. Dashboard access requires verified ownership of each sauna.');
    $('signin').scrollIntoView?.({ block: 'nearest' }); return;
  }
  await refresh(); $('welcome').classList.add('hidden'); $('workspace').classList.remove('hidden'); message('Signed in. Claim or verify your sauna to unlock its dashboard.');
}
async function refresh() {
  const [state, setup] = await Promise.all([api('/api/onboarding/state'), api('/api/onboarding/readiness')]);
  const root = $('status'); root.replaceChildren();
  for (const claim of state.claims || []) {
    const panel = node('section', '', 'card section'); panel.append(node('h3', 'Ownership request'), node('p', `${claim.sauna_id}: ${String(claim.status).replaceAll('_', ' ')}`));
    if (claim.status === 'code_sent') panel.append(codeForm(claim.id));
    if (claim.status === 'rejected') panel.append(node('p', 'Please contact hello@seana.ie for help before submitting again.'));
    root.append(panel);
  }
  for (const place of setup.locations) {
    const panel = node('section', '', 'card section'); panel.append(node('h3', place.name), node('p', `${place.completed} of ${place.total} setup checks complete`));
    const progress = document.createElement('progress'); progress.max = place.total; progress.value = place.completed; progress.setAttribute('aria-label', 'Location setup progress'); panel.append(progress);
    const list = node('ul', ''); for (const check of place.checks) list.append(node('li', `${check.done ? '✓' : '○'} ${check.label}${check.recommended ? ' (recommended)' : ''}`)); panel.append(list);
    panel.append(node('p', 'Listing review: ' + place.reviewStatus));
    if (place.reviewFeedback) panel.append(node('p', place.reviewFeedback, 'notice'));
    if (!place.checks.find(c => c.id === 'verification').done) panel.append(node('p', place.reviewStatus === 'rejected' ? 'Please contact hello@seana.ie to correct your submission before another review.' : 'Your location is awaiting review. Access stays restricted until ownership is verified.'));
    else {
      const link = node('a', 'Edit details in dashboard', 'btn secondary'); link.href = dashboardUrl; panel.append(link);
      if (place.role === 'owner' && !place.checks.find(c => c.id === 'payments').done) panel.append(action('Connect Stripe payments', async () => {
        const result = await api('/api/business/stripe-connect/start', { saunaId: place.saunaId });
        const url = new URL(result.url); if (url.protocol !== 'https:' || !(url.hostname === 'stripe.com' || url.hostname.endsWith('.stripe.com'))) throw new Error('Unexpected payment setup link. Contact support.'); message('Your secure Stripe setup link is ready. Complete setup there, then return here and refresh.'); const link = node('a', 'Continue to Stripe', 'btn'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; panel.append(link);
      }));
    }
    if (place.ready && place.role === 'owner') panel.append(action('Finish business setup', async () => { await api('/api/onboarding/complete', {}); message('Business setup completed. Open your dashboard to manage bookings.'); }));
    root.append(panel);
  }
  if (!setup.locations.length && !(state.claims || []).length) root.append(node('p', 'Start by finding your sauna below.'));
}
function codeForm(claimId) {
  const form = document.createElement('form'), label = node('label', 'Verification code'), input = document.createElement('input'); input.required = true; input.pattern = '[0-9]{6}'; input.inputMode = 'numeric'; input.autocomplete = 'one-time-code'; input.maxLength = 6; label.append(input); const button = node('button', 'Verify ownership'); form.append(label, button);
  form.addEventListener('submit', e => { e.preventDefault(); busy(button, async () => { await api(`/api/onboarding/claim/${encodeURIComponent(claimId)}/verify`, { code: input.value }); await refresh(); $('claim').replaceChildren(); message('Ownership verified. Continue your setup checklist above.'); }); }); return form;
}
async function claimOptions(sauna) {
  const data = await api(`/api/onboarding/claim-options/${encodeURIComponent(sauna.id)}`); const root = $('claim'); root.replaceChildren(node('h3', `Verify ${sauna.name}`));
  for (const option of data.options) {
    const form = document.createElement('form'); form.append(node('p', option.label)); let input;
    if (option.method === 'admin_review') { const label = node('label', 'How can we confirm you represent this sauna?'); input = document.createElement('textarea'); input.required = true; input.maxLength = 500; input.placeholder = 'Your role and a public business reference. Do not include passwords, banking details or identity documents.'; label.append(input); form.append(label); }
    const button = node('button', option.instant ? 'Verify with my business email' : option.method === 'listing_email' ? 'Send verification code' : 'Request review'); form.append(button);
    form.addEventListener('submit', e => { e.preventDefault(); busy(button, async () => { const result = await api('/api/onboarding/claim', { saunaId: sauna.id, source, method: option.method, ...(input ? { evidence: { explanation: input.value } } : {}) }); root.replaceChildren(); await refresh(); message(result.status === 'approved' ? 'Ownership verified. Continue setup above.' : result.status === 'code_sent' ? `Code sent to ${result.sentTo}. Enter it above.` : 'Your ownership request is saved for review. Check back here for updates.'); }); }); root.append(form);
  }
}
document.querySelectorAll('a[href="/portal/dashboard.html"]').forEach(link => { link.href = dashboardUrl; });
async function openIdentity(mode) {
  const buttons = [$('begin'), $('register')];
  if (buttons.some(button => button.disabled)) return;
  buttons.forEach(button => { button.disabled = true; button.setAttribute('aria-busy', 'true'); });
  try { await begin(mode); } catch (error) { message(error.name === 'AbortError' ? 'Sign-in timed out. Please try again.' : error instanceof TypeError ? 'We couldn’t connect to owner setup. Please try again, or contact hello@seana.ie.' : error.message); }
  finally { buttons.forEach(button => { button.disabled = false; button.setAttribute('aria-busy', 'false'); }); }
}
$('begin').addEventListener('click', () => openIdentity('signin'));
$('register').addEventListener('click', () => openIdentity('signup'));
$('refresh').addEventListener('click', () => busy($('refresh'), refresh));
$('signout').addEventListener('click', () => busy($('signout'), async () => { await clerk.signOut(); location.reload(); }));
$('search-form').addEventListener('submit', e => { e.preventDefault(); const button = e.currentTarget.querySelector('button'); busy(button, async () => { const results = await api('/api/business/find-sauna', { name: $('search').value }); $('results').replaceChildren(); $('claim').replaceChildren(); if (!results.length) $('results').append(node('p', 'No matches. Try another part of the name, or add your location below.')); for (const sauna of results) { const row = node('div', '', 'result'); row.append(node('span', `${sauna.name} · ${sauna.county || sauna.location || ''}`), action('This is my sauna', () => claimOptions(sauna))); $('results').append(row); } }); });
$('new-form').addEventListener('submit', e => { e.preventDefault(); const form = e.currentTarget, button = form.querySelector('button'); busy(button, async () => { const body = Object.fromEntries(new FormData(form)); for (const key of ['lat', 'lng', 'session_price', 'max_capacity']) { if (body[key] === '') delete body[key]; else body[key] = Number(body[key]); } await api('/api/onboarding/new-location', { ...body, source }); form.reset(); $('new-location').open = false; await refresh(); message('Your location has been submitted for review. Your setup checklist is saved above.'); }); });
// No form contents or authentication tokens are saved in browser storage.
if (location.hash === '#setup') openIdentity(new URLSearchParams(location.search).get('auth') === 'signup' ? 'signup' : 'signin');

$('share-owner').addEventListener('click', () => busy($('share-owner'), async () => {
  const url = location.origin + location.pathname + '?source=owner_referral';
  try {
    if (navigator.share) await navigator.share({ title: 'Bring your sauna to seána', text: 'A place to help guests discover and book your sauna.', url });
    else { await navigator.clipboard.writeText(url); $('share-message').textContent = 'Owner signup link copied. Share it with another sauna owner.'; }
  } catch (error) { if (error.name !== 'AbortError') $('share-message').textContent = 'Share this owner signup link: ' + url; }
}));
