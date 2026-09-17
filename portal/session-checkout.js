'use strict';
const $ = id => document.getElementById(id);
const root = $('session');
const { saunaId, date, slotId, sessionTypeId } = root.dataset;
const checkoutAPI = root.dataset.webCheckout && !['localhost','127.0.0.1'].includes(location.hostname) ? 'https://saunaapp-production.up.railway.app' : '';
const publicQuery = new URLSearchParams({ ...(root.dataset.webCheckout?{saunaId}:{}), date, slotId, ...(sessionTypeId ? { sessionTypeId } : {}) });
const publicUrl = location.origin + location.pathname + '?' + publicQuery;
// Remove Stripe return parameters before any sharing or other resource requests.
history.replaceState(null, '', publicUrl);
const storagePrefix = 'seana-checkout:' + saunaId + ':' + publicQuery;
let storageKey=storagePrefix;
const money = cents => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
let customerClerk = null;
let attempt = null, stripe, elements, preparing = false, checking = false, confirmed = false;
function message(text) { $('message').textContent = text; }
function store() { sessionStorage.setItem(storageKey, JSON.stringify(attempt)); }
function readAttempt() {
  try {
    const value = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (value && /^[0-9a-f-]{36}$/i.test(value.requestId) && (!value.bookingId || /^bk_[0-9a-f-]{36}$/i.test(value.bookingId))) attempt = value;
  } catch { /* Checkout explicitly checks storage before it reserves anything. */ }
}
async function api(path, body) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
    const caller=customerClerk?.user?.id||null;
    const token = await customerClerk?.session?.getToken();
    const response = await fetch(checkoutAPI + path, { method: body ? 'POST' : 'GET', cache: 'no-store', headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
    let data; try { data = await response.json(); } catch { throw new Error('Booking is temporarily unavailable. Please try again.'); }
    if (!response.ok) throw new Error(data.error || 'Please try again.');
    if(caller!==(customerClerk?.user?.id||null))throw new Error('Your account changed. Please reload this session before continuing.');
    return data;
  } finally { clearTimeout(timer); }
}
function errorText(error) { return error.name === 'AbortError' ? 'The connection timed out. Retry with the same details; do not start another payment.' : error.message || 'Something went wrong. Please try again.'; }
async function availability() {
  $('reload').disabled = true;
  try {
    const data = await api(`/api/sauna/${encodeURIComponent(saunaId)}/slots?date=${encodeURIComponent(date)}`);
    const slot = (sessionTypeId ? data.sessionSlots || [] : data.slots || []).find(item => item.id === slotId && (!sessionTypeId || item.sessionTypeId === sessionTypeId));
    if (!slot || !slot.available) { $('availability').textContent = 'This session is sold out, has ended, or is no longer available.'; $('guest-form').hidden = !attempt; return; }
    $('availability').textContent = `${slot.startTime}–${slot.endTime} · ${money(slot.price)} per person · ${slot.spotsLeft ?? Math.max(0, slot.capacity - (slot.bookedCount || 0))} places left`;
    if (!confirmed && !elements) $('guest-form').hidden = false;
  } catch (error) { $('availability').textContent = errorText(error); }
  finally { $('reload').disabled = false; }
}
let stripeScript;
function loadStripe() {
  if (window.Stripe) return Promise.resolve();
  if (!stripeScript) stripeScript = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://js.stripe.com/v3/';
    const timer = setTimeout(() => { script.remove(); reject(new Error('Payment could not load. Please retry, or open this link in Safari or Chrome.')); }, 15000);
    script.onload = () => { clearTimeout(timer); window.Stripe ? resolve() : reject(new Error('Payment could not load. Please retry.')); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Payment could not load. Please retry.')); };
    document.head.append(script);
  }).catch(error => { stripeScript = null; throw error; });
  return stripeScript;
}
function showAttempt() { $('check').hidden = !attempt?.bookingId; $('cancel').hidden = !attempt?.bookingId || confirmed; }
async function checkStatus() {
  if (!attempt?.bookingId || checking) return;
  checking = true; $('check').disabled = true;
  try {
    const result = await api(`/api/booking/${encodeURIComponent(attempt.bookingId)}/status`);
    if (result.saunaId !== saunaId || result.date !== date || result.slotId !== slotId) throw new Error('This booking does not match the shared session. Contact support.');
    if (result.status === 'confirmed') {
      confirmed = true; $('guest-form').hidden = true; $('payment-form').hidden = true; $('cancel').hidden = true; $('check').hidden = true;
      $('confirmation').hidden = false; $('confirmation').textContent = `You’re booked in! ${result.startTime}–${result.endTime} on ${date}. Reference: ${result.bookingId}`;
      message('Your place is confirmed. Find it in My bookings on the website or app.');
    } else if (result.status === 'cancelled') {
      elements?.getElement('payment')?.destroy(); elements = null; stripe = null;
      attempt = null; sessionStorage.removeItem(storageKey); $('payment-form').hidden = true; showAttempt();
      message('This checkout is closed. Check availability before starting a new booking.'); await availability();
    } else { message('Your booking is not confirmed yet. Check payment status again before starting another payment.'); showAttempt(); }
  } catch (error) { message(errorText(error)); }
  finally { checking = false; $('check').disabled = false; }
}
$('guest-form').addEventListener('submit', async event => {
  event.preventDefault(); if (preparing || confirmed) return;
  preparing = true; $('prepare').disabled = true; message('Preparing your secure checkout…');
  try {
    const email = customerClerk?.user?.primaryEmailAddress;
    if (!customerClerk?.session || email?.verification?.status !== 'verified') throw new Error('Sign in and verify your email before paying.');
    $('guest-email').value = email.emailAddress;
    await loadStripe();
    if (!attempt) attempt = { requestId: crypto.randomUUID() };
    try { store(); } catch { throw new Error('Your browser cannot keep this checkout safe across reloads. Open the link in Safari or Chrome and allow site storage before paying.'); }
    const data = await api(`/api/sauna/${encodeURIComponent(saunaId)}/payment-sheet`, { requestId: attempt.requestId, date, slotId, ...(sessionTypeId ? { sessionTypeId } : {}), customerName: $('guest-name').value.trim(), customerEmail: $('guest-email').value.trim().toLowerCase() });
    attempt.bookingId = data.bookingId; store(); showAttempt();
    if (!Number.isInteger(data.amount) || data.amount <= 0 || data.currency !== 'eur' || !/^acct_/.test(data.connectedAccountId || '') || !data.paymentIntentClientSecret) throw new Error('Payment details are unavailable. Please check your booking status or cancel this checkout.');
    stripe = window.Stripe(data.publishableKey, { stripeAccount: data.connectedAccountId });
    elements = stripe.elements({ clientSecret: data.paymentIntentClientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#C8785A', colorBackground: '#1A1D23', colorText: '#F0ECE6', borderRadius: '4px' } } });
    const payment = elements.create('payment', { defaultValues: { billingDetails: { name: $('guest-name').value.trim(), email: $('guest-email').value.trim() } } });
    $('guest-form').hidden = true; $('payment-form').hidden = false;
    payment.on('ready', () => { $('pay').disabled = false; $('pay').textContent = `Pay ${money(data.amount)} · one place`; });
    payment.on('loaderror', () => { message('The payment form could not load. Check payment status or cancel this checkout before trying again.'); });
    payment.mount('#payment-element'); message('Confirm your payment below. Card details go directly to Stripe.');
  } catch (error) { message(errorText(error)); }
  finally { preparing = false; $('prepare').disabled = false; }
});
$('payment-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!stripe || !elements || $('pay').disabled) return;
  $('pay').disabled = true; $('cancel').disabled = true; message('Confirming payment…');
  try {
    const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: publicUrl }, redirect: 'if_required' });
    if (result.error) throw new Error(result.error.message || 'Payment could not complete.');
    await checkStatus();
  } catch (error) { message(errorText(error)); }
  finally { $('pay').disabled = false; $('cancel').disabled = false; }
});
$('cancel').addEventListener('click', async () => {
  if (!attempt?.bookingId || $('cancel').disabled) return;
  $('cancel').disabled = true;
  try { await api(`/api/booking/${encodeURIComponent(attempt.bookingId)}/cancel-payment`, { requestId: attempt.requestId }); await checkStatus(); }
  catch (error) { message(errorText(error)); }
  finally { $('cancel').disabled = false; }
});
$('check').addEventListener('click', checkStatus);
$('reload').addEventListener('click', availability);
$('share').addEventListener('click', async () => {
  // Always share public session coordinates, never a payment token or booking reference.
  const name=$('venue-name')?.textContent||'this sauna';
  const text = `Join me at ${name} on ${date}! Open this session in seána and book your own place, subject to availability.`;
  try {if(navigator.share)await navigator.share({title:'Join my sauna session',text,url:publicUrl});else {await navigator.clipboard.writeText(text+' '+publicUrl);message('Invitation copied. Send it to your friends on WhatsApp or Messages.');}}catch(error){if(error.name!=='AbortError')message('Could not share this session. Please try again.');}
});
showAttempt();
availability();

async function loadCustomerSignIn() {
 try {
  const config = await api('/api/public-config');
  customerClerk = await window.SeanaAuth.load(config.clerkPublishableKey);
  const mountAuth=(signup=false)=>{customerClerk.unmountSignIn?.($('clerk-signin'));customerClerk.unmountSignUp?.($('clerk-signin'));const options={forceRedirectUrl:publicUrl,signInForceRedirectUrl:publicUrl,signUpForceRedirectUrl:publicUrl};if(signup)customerClerk.mountSignUp($('clerk-signin'),options);else customerClerk.mountSignIn($('clerk-signin'),{...options,withSignUp:false,transferable:false});};
  if($('checkout-signup'))$('checkout-signup').onclick=()=>mountAuth(true);
  if($('checkout-signin'))$('checkout-signin').onclick=()=>mountAuth(false);
  let registrationSession=null,currentUser=null;
  const update = async ({session}) => {
   const ready = session?.status === 'active';
   const user=ready?customerClerk.user?.id:null;
   if(user!==currentUser){elements?.getElement('payment')?.destroy();elements=null;stripe=null;attempt=null;confirmed=false;registrationSession=null;currentUser=user;$('payment-form').hidden=true;$('confirmation').hidden=true;message('');if(user){storageKey=storagePrefix+':'+user;readAttempt();}showAttempt();}
   $('customer-auth').hidden = ready;
   $('prepare').disabled = !ready;
   $('guest-email').readOnly = true;
   $('guest-email').value = ready ? customerClerk.user?.primaryEmailAddress?.emailAddress || '' : '';
   if (!ready) mountAuth(false);
   else { $('guest-name').value=customerClerk.user?.fullName||customerClerk.user?.firstName||'';if(registrationSession!==session.id){$('prepare').disabled=true;try{await api('/api/accounts/register',{accountType:'customer',source:'website'});if(customerClerk.session?.id!==session.id)return;registrationSession=session.id;$('prepare').disabled=false;}catch(error){message(errorText(error));return;}}if(attempt?.bookingId)void checkStatus(); }
  };
  customerClerk.addListener(update); update({session:customerClerk.session});
 } catch { $('prepare').disabled = true; message('Secure sign-in could not load. Reload this page in Safari or Chrome.'); }
}
$('prepare').disabled = true;
void loadCustomerSignIn();
