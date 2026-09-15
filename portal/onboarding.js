'use strict';
const APP_ORIGIN = 'https://saunaapp-production.up.railway.app';
const localApp = ['localhost', '127.0.0.1'].includes(location.hostname) && location.port !== '4173';
const API = localApp || location.origin === APP_ORIGIN ? '' : APP_ORIGIN;
const dashboardUrl = '/portal/dashboard.html';
const $ = id => document.getElementById(id);
let clerk, features = {}, sessionEpoch=0, observedSession;
const incomingSource = new URLSearchParams(location.search).get('source');
const source = ['website', 'owner_referral', 'outreach', 'event'].includes(incomingSource) ? incomingSource : 'direct';
function node(tag, text, className) { const el = document.createElement(tag); el.textContent = text; if (className) el.className = className; return el; }
function message(text) { $('message').replaceChildren(...(text ? [node('p', text, 'notice')] : [])); }
async function api(path, body) {
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
  let response; try { response = await window.SeanaSession.request(API + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal }, clerk, showSessionRecovery); } finally { clearTimeout(timeout); }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Owner setup is not available yet. Please contact hello@seana.ie and we’ll help you get started.');
  const result = await response.json(); if(result.code==='mfa_required'){await window.SeanaOwnerSecurity.verify(clerk);await api('/api/onboarding/security');throw Error('Security verified. Please try the action again.');} if (!response.ok) throw new Error(response.status === 401 ? 'Your session could not be verified. Sign out and try again. If it happens again, contact hello@seana.ie.' : result.error || 'Please try again.'); return result;
}
function clearOwnerWorkspace() {
  sessionEpoch++; $('workspace').classList.add('hidden'); $('welcome').classList.remove('hidden');
  for (const id of ['status','results','claim']) $(id).replaceChildren();
  $('new-form').reset?.();
}
function showSessionRecovery() {
  clearOwnerWorkspace();
  $('signin').replaceChildren(); $('signin').classList.add('load-failed');
  $('identity-signout').classList.remove('hidden');
}
async function resetOwnerSession(button) {
  if(button.disabled)return; button.disabled=true;
  try { await window.SeanaSession.signOut(clerk,clearOwnerWorkspace,location.pathname+'?source='+encodeURIComponent(source)+'&auth=signin'); }
  catch { showSessionRecovery(); message('We couldn’t finish signing you out. Check your connection and try again.'); }
  finally { button.disabled=false; }
}
function action(label, fn) { const button = node('button', label); button.type = 'button'; button.addEventListener('click', () => busy(button, fn)); return button; }
async function busy(button, fn) { if(button.disabled)return; button.disabled = true; message(''); try { await fn(); } catch (error) { message(error.name === 'AbortError' ? 'This is taking longer than expected. Please try again.' : error instanceof TypeError ? 'We couldn’t connect to owner setup. Please try again, or contact hello@seana.ie for help.' : error.message || 'Something went wrong. Please try again.'); } finally { button.disabled = false; } }
async function begin(mode = 'signin') {
  $('signin').classList.remove('load-failed');
  message('');
  if (!clerk) {
    const config = await api('/api/public-config'); features = config;
    if (config.ownerOnboardingEnabled !== true) throw new Error('Owner setup is being prepared. Please contact hello@seana.ie and we’ll help you get started.');
    if (!config.clerkPublishableKey) throw new Error('Secure sign-in is unavailable. Please contact hello@seana.ie.');
    clerk = await window.SeanaAuth.load(config.clerkPublishableKey);
    observedSession=sessionKey(clerk.session);clerk.addListener?.(({session})=>{const key=sessionKey(session);if(key===observedSession)return;observedSession=key;clearOwnerWorkspace();openIdentity();});
  }
  if (!clerk.user || clerk.session?.status !== 'active') {
    const returnUrl = location.origin + dashboardUrl;
    clerk.unmountSignIn?.($('signin')); clerk.unmountSignUp?.($('signin'));
    if (mode === 'signup') clerk.mountSignUp($('signin'), { forceRedirectUrl: returnUrl, signInUrl: location.origin + location.pathname + '?source=' + encodeURIComponent(source) + '&auth=signin#setup' });
    else clerk.mountSignIn($('signin'), { forceRedirectUrl: location.origin + dashboardUrl, signUpUrl: location.origin + location.pathname + '?source=' + encodeURIComponent(source) + '&auth=signup#setup' });
    return;
  }
  const epoch=sessionEpoch;
  await api('/api/accounts/register', {accountType:'owner',source:'website'});
  if(epoch!==sessionEpoch)return;
  if(new URLSearchParams(location.search).get('setup')!=='1'){location.replace(dashboardUrl);return;}
  await refresh(); if(epoch!==sessionEpoch)return; $('welcome').classList.add('hidden'); $('workspace').classList.remove('hidden'); message('Signed in. Claim or verify your sauna to unlock its dashboard.');
}
async function refresh() {
  const epoch=sessionEpoch; const state = await api('/api/onboarding/state'); const setup={locations:state.setup||[]}; if(epoch!==sessionEpoch)return;
  const root = $('status'); root.replaceChildren();
  root.append(action('Account security — set up two-factor authentication',async()=>window.SeanaOwnerSecurity.openAccount(clerk)),action('Verify for payments',async()=>{await window.SeanaOwnerSecurity.verify(clerk);await api('/api/onboarding/security');await refresh();}));
  for (const claim of state.claims || []) {
    const panel = node('section', '', 'card section'); panel.append(node('h3', 'Ownership request'), node('p', `${claim.sauna_id}: ${String(claim.status).replaceAll('_', ' ')}`));

    if (claim.status === 'rejected') panel.append(node('p', 'Please contact hello@seana.ie for help before submitting again.'));
    root.append(panel);
  }
  for (const place of setup.locations) {
    const panel = node('section', '', 'card section'); panel.append(node('h3', place.name), node('p', `${place.completed} of ${place.total} setup checks complete`));
    const progress = document.createElement('progress'); progress.max = place.total; progress.value = place.completed; progress.setAttribute('aria-label', 'Location setup progress'); panel.append(progress);
    const list = node('ul', ''); for (const check of place.checks) list.append(node('li', `${check.done ? '✓' : '○'} ${check.label}${check.recommended ? ' (recommended)' : ''}`)); panel.append(list);
    panel.append(node('p', 'Sauna review: ' + place.reviewStatus));
    if (place.reviewFeedback) panel.append(node('p', place.reviewFeedback, 'notice'));
    if (!place.checks.find(c => c.id === 'verification').done) panel.append(node('p', place.reviewStatus === 'rejected' ? 'Please contact hello@seana.ie to correct your submission before another review.' : 'Your sauna is awaiting review and is not visible in the app. The seána team will check that it is real and that you are authorised to manage it. Once approved, you can update its details in your dashboard.'));
    else {
      const link = node('a', 'Edit details in dashboard', 'btn secondary'); link.href = dashboardUrl; panel.append(link);
      if (features.paymentsEnabled && place.role === 'owner' && !place.checks.find(c => c.id === 'payments').done) panel.append(action('Connect Stripe payments', async () => {
        const result = await api('/api/business/stripe-connect/start', { saunaId: place.saunaId });
        const url = new URL(result.url); if (url.protocol !== 'https:' || !(url.hostname === 'stripe.com' || url.hostname.endsWith('.stripe.com'))) throw new Error('Unexpected payment setup link. Contact support.'); message('Your secure Stripe setup link is ready. Complete setup there, then return here and refresh.'); const link = node('a', 'Continue to Stripe', 'btn'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; panel.append(link);
      }));
    }
    if (features.paymentsEnabled && place.ready && place.role === 'owner') panel.append(action('Finish business setup', async () => { await api('/api/onboarding/complete', {saunaId:place.saunaId}); await refresh(); }));
    root.append(panel);
  }
  if (!setup.locations.length && !(state.claims || []).length) root.append(node('p', 'Start by finding your sauna below.'));
}
async function claimOptions(sauna) {
  const data = await api(`/api/onboarding/claim-options/${encodeURIComponent(sauna.id)}`); const root = $('claim'); root.replaceChildren(node('h3', `Verify ${sauna.name}`));
  for (const option of data.options) {
    const form = document.createElement('form'); form.append(node('p', option.label)); let input;
    if (option.method === 'admin_review') { const label = node('label', 'How can we confirm you represent this sauna?'); input = document.createElement('textarea'); input.required = true; input.maxLength = 500; input.placeholder = 'Your role and a public business reference. Do not include passwords, banking details or identity documents.'; label.append(input); form.append(label); }
    const button = node('button', option.instant ? 'Verify with my business email' : option.method === 'listing_email' ? 'Send verification code' : 'Request review'); form.append(button);
    form.addEventListener('submit', e => { e.preventDefault(); busy(button, async () => { const result = await api('/api/onboarding/claim', { saunaId: sauna.id, source, method: option.method, ...(input ? { evidence: { explanation: input.value } } : {}) }); root.replaceChildren(); await refresh(); message('Your latest review status is shown above.'); }); }); root.append(form);
  }
}
document.querySelectorAll('a[href="/portal/dashboard.html"]').forEach(link => { link.href = dashboardUrl; });
function sessionKey(session){return session ? session.id+':'+session.status : 'signed-out';}
let identityOpening = false, identityPending = false;
const identityMode = new URLSearchParams(location.search).get('auth') === 'signin' ? 'signin' : 'signup';
async function openIdentity(mode = identityMode) {
  if (identityOpening) { identityPending=true; return; }
  identityOpening = true;
  const retry = $('identity-retry');
  retry.classList.add('hidden');
  retry.disabled = true;
  try { await begin(mode); }
  catch (error) {
    $('signin').classList.add('load-failed');
    message(error.name === 'AbortError' ? 'Sign-in timed out. Please try again.' : error instanceof TypeError ? 'We couldn’t connect to owner setup. Please try again, or contact hello@seana.ie.' : error.message);
    retry.classList.remove('hidden');
  }
  finally { identityOpening = false; retry.disabled = false; if(identityPending){identityPending=false;await openIdentity();} }
}
$('identity-retry').addEventListener('click', () => openIdentity());
$('identity-signout').addEventListener('click', () => resetOwnerSession($('identity-signout')));
$('refresh').addEventListener('click', () => busy($('refresh'), refresh));
$('signout').addEventListener('click', () => resetOwnerSession($('signout')));
$('search-form').addEventListener('submit', e => { e.preventDefault(); const button = e.currentTarget.querySelector('button'); busy(button, async () => { const results = await api('/api/business/find-sauna', { name: $('search').value }); $('results').replaceChildren(); $('claim').replaceChildren(); if (!results.length) $('results').append(node('p', 'No matches. Try another part of the name, or add your location below.')); for (const sauna of results) { const row = node('div', '', 'result'); row.append(node('span', `${sauna.name} · ${sauna.county || sauna.location || ''}`), action('This is my sauna', () => claimOptions(sauna))); $('results').append(row); } }); });
let newLocationPicker;
if(window.createSaunaLocationPicker){newLocationPicker=createSaunaLocationPicker({getAddress:()=>['name','location','county'].map(key=>$('new-form').elements.namedItem(key)?.value||'').filter(Boolean).join(', ')});$('new-location-map').append(newLocationPicker);}
$('new-form').addEventListener('submit', e => { e.preventDefault(); const form = e.currentTarget, button = form.querySelector('button[type=submit]'); busy(button, async () => { newLocationPicker?.validate(); const body = Object.fromEntries(new FormData(form)); for (const key of ['lat', 'lng', 'session_price', 'max_capacity']) { if (body[key] === '') delete body[key]; else body[key] = Number(body[key]); } const created=await api('/api/onboarding/new-location', { ...body, source }); form.reset(); newLocationPicker?.resetPin(); $('new-location').open = false; await refresh(); message('Your latest review status is shown above.'); }); });
// No form contents or authentication tokens are saved in browser storage.
const identityReady = window.SeanaPortalRedirecting ? Promise.resolve() : openIdentity();

$('share-owner').addEventListener('click', () => busy($('share-owner'), async () => {
  const url = location.origin + location.pathname + '?source=owner_referral';
  try {
    if (navigator.share) await navigator.share({ title: 'Bring your sauna to seána', text: 'A place to help guests discover and book your sauna.', url });
    else { await navigator.clipboard.writeText(url); $('share-message').textContent = 'Owner signup link copied. Share it with another sauna owner.'; }
  } catch (error) { if (error.name !== 'AbortError') $('share-message').textContent = 'Share this owner signup link: ' + url; }
}));
