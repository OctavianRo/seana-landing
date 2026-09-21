'use strict';
/**
 * Owner onboarding, drawn inside the dashboard.
 *
 * Claiming an existing listing and adding a new location used to live on
 * /portal/onboard.html. An owner signed in on the dashboard and was then sent
 * off it to finish setting up, which is why the flow felt like two products.
 * These are the same two flows as a dashboard page, so the whole journey — sign
 * in, claim or add, wait for review, work the checklist, launch — happens in
 * one place.
 *
 * This file only draws forms. Ownership is still decided by the API from our own
 * database, and a submitted location stays unpublished until a reviewer
 * approves it.
 */
function createOwnerOnboardingPanel({ api, source = 'website', onChanged, onPicker }) {
  const el = (tag, text, cls) => { const node = document.createElement(tag); if (text) node.textContent = text; if (cls) node.className = cls; return node; };
  const panel = el('section', '', 'panel owner-onboarding');

  const feedback = el('p', '', 'notice hidden');
  feedback.setAttribute('role', 'status');
  const say = (text, error = false) => { feedback.textContent = text || ''; feedback.className = 'notice' + (error ? ' error' : '') + (text ? '' : ' hidden'); };

  async function busy(button, fn) {
    if (button.disabled) return;
    button.disabled = true; say('');
    try { await fn(); }
    catch (error) { say(error.message || 'Something went wrong. Please try again.', true); }
    finally { button.disabled = false; }
  }

  async function call(path, body) {
    const response = await api(path, body ? { method: 'POST', body: JSON.stringify(body) } : {});
    if (!response.ok) throw new Error(response.body?.error || 'Please try again.');
    return response.body;
  }

  // ── Pending ownership requests ──────────────────────────────────────────────
  const claims = el('div', '', 'onboarding-claims');

  async function refresh() {
    const state = await call('/api/onboarding/state');
    claims.replaceChildren();
    for (const claim of state.claims || []) {
      const card = el('div', '', 'card section');
      card.append(el('h3', 'Ownership request'), el('p', `${claim.sauna_id}: ${String(claim.status).replaceAll('_', ' ')}`, 'muted'));
      card.append(el('p', claim.status === 'rejected'
        ? 'Please contact hello@seana.ie before submitting again.'
        : 'We’re checking that you’re authorised to manage this sauna. You’ll get an email when it’s reviewed.', 'muted small'));
      claims.append(card);
    }
  }

  // ── 1. Claim an existing listing ────────────────────────────────────────────
  const results = el('div', '', 'onboarding-results');
  const claimArea = el('div', '', 'onboarding-claim');

  const searchCard = el('div', '', 'card section');
  searchCard.append(el('h3', 'Already listed on seána?'), el('p', 'Search and request access to your existing listing instead of adding it again.', 'muted'));
  const searchForm = document.createElement('form');
  const searchLabel = el('label', 'Sauna name');
  const searchInput = document.createElement('input');
  searchInput.required = true; searchInput.minLength = 3; searchInput.maxLength = 160;
  searchInput.placeholder = 'Search your sauna name';
  searchLabel.append(searchInput);
  const searchButton = el('button', 'Search directory');
  searchForm.append(searchLabel, searchButton);
  searchCard.append(searchForm, results, claimArea);

  searchForm.addEventListener('submit', event => {
    event.preventDefault();
    return busy(searchButton, async () => {
      const matches = await call('/api/business/find-sauna', { name: searchInput.value });
      results.replaceChildren(); claimArea.replaceChildren();
      if (!matches.length) { results.append(el('p', 'No matches. Try another part of the name, or add your location below.', 'muted')); return; }
      for (const sauna of matches) {
        const row = el('div', '', 'result');
        const pick = el('button', 'This is my sauna', 'secondary'); pick.type = 'button';
        pick.addEventListener('click', () => busy(pick, () => claimOptions(sauna)));
        row.append(el('span', `${sauna.name} · ${sauna.county || sauna.location || ''}`), pick);
        results.append(row);
      }
    });
  });

  async function claimOptions(sauna) {
    const data = await call(`/api/onboarding/claim-options/${encodeURIComponent(sauna.id)}`);
    claimArea.replaceChildren(el('h3', `Verify ${sauna.name}`));
    for (const option of data.options) {
      const form = document.createElement('form');
      form.append(el('p', option.label, 'muted'));
      const label = el('label', 'How can we confirm you represent this sauna?');
      const explanation = document.createElement('textarea');
      // No client-side minimum: the 30-character rule belongs to the server, so
      // the owner sees the same reason a reviewer's API would give.
      explanation.required = true; explanation.maxLength = 500;
      explanation.placeholder = 'Your role and a public business reference. Do not include passwords, banking details or identity documents.';
      label.append(explanation);
      const submit = el('button', 'Request ownership review');
      form.append(label, submit);
      form.addEventListener('submit', event => {
        event.preventDefault();
        return busy(submit, async () => {
          await call('/api/onboarding/claim', { saunaId: sauna.id, source, method: option.method, evidence: { explanation: explanation.value } });
          results.replaceChildren(); claimArea.replaceChildren();
          await refresh();
          const done = 'Your ownership request is saved for review. We’ll email you when it’s been checked.';
          if (onChanged) await onChanged(null, done); else say(done);
        });
      });
      claimArea.append(form);
    }
  }

  // ── 2. Add a location that is not listed yet ────────────────────────────────
  const addDetails = document.createElement('details');
  addDetails.className = 'onboarding-new-location';
  addDetails.open = true;
  addDetails.append(el('summary', 'Add a new location'));
  addDetails.append(el('p', 'Three short steps. Your listing stays private while we review it. Connect payments after approval.', 'muted'));

  const addForm = document.createElement('form');
  addForm.noValidate = true;
  const stepNames = ['Your sauna', 'Sessions & policies', 'Review & submit'];
  const stepStatus = el('p', '', 'onboarding-step-status'); stepStatus.setAttribute('aria-live', 'polite');
  const steps = stepNames.map(name => { const section = el('section', '', 'onboarding-step'); section.append(el('h3', name)); return section; });
  const grid = el('div', '', 'form-grid');
  const field = (labelText, name, attrs = {}, tag = 'input') => {
    const label = el('label', labelText);
    const input = document.createElement(tag);
    input.name = name;
    for (const [key, value] of Object.entries(attrs)) input[key] = value;
    label.append(input);
    return label;
  };
  grid.append(
    field('Sauna name', 'name', { required: true, minLength: 2, maxLength: 160, autocomplete: 'organization' }),
    field('County', 'county', { required: true, maxLength: 80 }),
    field('Address / directions', 'location', { required: true, maxLength: 300, autocomplete: 'street-address' }),
    field('Phone (optional)', 'phone', { type: 'tel', maxLength: 50, autocomplete: 'tel' }),
    field('Website (optional)', 'website', { type: 'url', maxLength: 2000, placeholder: 'https://' }),
  );
  const sessions = el('div', '', 'form-grid');
  sessions.append(
    field('Opening hours', 'opening_hours', { required: true, maxLength: 2000, placeholder: 'e.g. Mon–Sun 09:00–18:00' }),
    field('Session price (€)', 'session_price', { type: 'number', min: '0.5', max: '10000', step: '0.01', required: true }),
    field('People per session', 'max_capacity', { type: 'number', min: '1', max: '500', step: '1', required: true }),
  );
  steps[0].append(grid);

  let picker;
  if (window.createSaunaLocationPicker) {
    picker = createSaunaLocationPicker({ getAddress: () => ['name', 'location', 'county'].map(key => addForm.elements.namedItem(key)?.value || '').filter(Boolean).join(', ') });
    const pinDetails = el('details', '', 'onboarding-pin');
    pinDetails.append(el('summary', 'Set your entrance pin (you can do this after approval)'), picker);
    steps[0].append(pinDetails);
    onPicker?.(picker);
  }

  steps[0].append(
    field('What makes your sauna special?', 'description', { required: true, maxLength: 5000, placeholder: 'Describe the setting, facilities and what guests should bring.' }, 'textarea'),
  );
  steps[1].append(sessions, el('p', 'Tell guests what to expect. You can set individual session types and bookable times after approval.', 'muted'),
    field('Sauna rules', 'sauna_rules', { required: true, maxLength: 10000, placeholder: 'For example: what to bring, age limits and arrival time.' }, 'textarea'),
    field('Booking and cancellation terms', 'terms_conditions', { required: true, maxLength: 20000, placeholder: 'Explain your cancellation, refund and rescheduling policy.' }, 'textarea'),
  );

  const consent = el('label', '', 'small');
  const consentBox = document.createElement('input');
  consentBox.type = 'checkbox'; consentBox.required = true;
  consent.append(consentBox, document.createTextNode(' I’m authorised to represent this sauna and these details are accurate.'));
  const addButton = el('button', 'Submit location for review'); addButton.type = 'submit';
  const summary = el('dl', '', 'onboarding-review');
  steps[2].append(summary, consent, el('p', 'We use your verified account email to manage your submission. Submitting a listing does not subscribe you to marketing.', 'muted small'), addButton);

  let currentStep = 0;
  const back = el('button', 'Back', 'secondary'); back.type = 'button';
  const next = el('button', 'Continue'); next.type = 'button';
  const controls = el('div', '', 'onboarding-controls'); controls.append(back, next);
  function showStep(index, focus = false) {
    currentStep = index;
    steps.forEach((step, i) => { step.hidden = i !== index; });
    stepStatus.textContent = `Step ${index + 1} of 3 · ${stepNames[index]}`;
    back.hidden = index === 0; next.hidden = index === 2;
    next.textContent = index === 1 ? 'Review my sauna' : 'Continue';
    if (index === 2) {
      summary.replaceChildren();
      for (const [key, label] of [['name','Sauna'],['location','Address'],['county','County'],['opening_hours','Opening hours'],['session_price','Price per person (€)'],['max_capacity','People per session'],['description','About your sauna'],['sauna_rules','Sauna rules'],['terms_conditions','Booking terms']]) {
        summary.append(el('dt', label), el('dd', addForm.elements.namedItem(key)?.value || '—'));
      }
    }
    if (focus) { steps[index].setAttribute('tabindex', '-1'); steps[index].focus(); }
  }
  function validateStep(index) {
    for (const input of steps[index].querySelectorAll('input, textarea, select')) {
      if (!input.checkValidity()) { input.reportValidity(); return false; }
    }
    if (index === 0) { try { picker?.validate(); } catch (error) { say(error.message, true); return false; } }
    return true;
  }
  next.addEventListener('click', () => { if (validateStep(currentStep)) { say(''); showStep(currentStep + 1, true); } });
  back.addEventListener('click', () => { say(''); showStep(Math.max(0, currentStep - 1), true); });
  addForm.append(stepStatus, ...steps, controls);
  showStep(0);

  addForm.addEventListener('submit', event => {
    event.preventDefault();
    if (currentStep < 2) { if (validateStep(currentStep)) showStep(currentStep + 1, true); return; }
    for (let i = 0; i < steps.length; i++) {
      showStep(i);
      if (!validateStep(i)) return;
    }
    return busy(addButton, async () => {
      picker?.validate();
      const body = Object.fromEntries(new FormData(addForm));
      for (const key of ['lat', 'lng', 'session_price', 'max_capacity']) {
        if (body[key] === '' || body[key] === undefined) delete body[key];
        else body[key] = Number(body[key]);
      }
      const created = await call('/api/onboarding/new-location', { ...body, source });
      addForm.reset(); picker?.resetPin(); showStep(0); addDetails.open = false;
      await refresh();
      const done = 'Your sauna is submitted for review. It stays private until we’ve checked it.';
      if (onChanged) await onChanged(created.saunaId, done); else say(done);
    });
  });

  addDetails.append(addForm);

  const existing = el('details', '', 'onboarding-existing');
  existing.append(el('summary', 'My sauna is already listed'), searchCard);

  panel.append(
    el('p', 'YOUR SAUNA ON SEÁNA', 'eyebrow'),
    el('h2', 'Add your sauna'),
    el('p', 'Start with your sauna’s details. We’ll guide you through review, payments and your first bookable sessions.', 'muted'),
    feedback, claims, addDetails, existing,
  );

  panel.refresh = refresh;
  panel.dispose = () => picker?.dispose?.();
  return panel;
}
