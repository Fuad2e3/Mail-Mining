// ============================================================================
// engine.js — email pattern generation + confidence scoring
//
// Everything here runs in the browser: no address list is uploaded anywhere.
// Scoring uses signals that can genuinely be checked client-side (syntax,
// domain shape, disposable/free/role lists, pattern frequency). Mailbox-level
// signals (MX, SMTP, catch-all) need a mail server and are reported as
// "not checked" rather than guessed.
// ============================================================================

'use strict';

// ── Normalise a name part into the local-part alphabet ──────────────────────
function normalizeName(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/['\u2018\u2019`]/g, '')                    // apostrophes
    .replace(/[-\s]+/g, '')                            // hyphens / spaces
    .replace(/[^a-z0-9]/g, '');                        // anything left over
}

function cleanDomain(domain) {
  return (domain || '')
    .toLowerCase().trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.\-]/g, '');
}

// ── Candidate patterns, ordered by how common they are in business mail ─────
function generateEmailCandidates(firstName, lastName, domain) {
  const f = normalizeName(firstName);
  const l = normalizeName(lastName);
  const fi = f.charAt(0);
  const li = l.charAt(0);
  const d = cleanDomain(domain);

  if (!f || !l || !d) return [];

  const patterns = [
    { email: `${f}.${l}@${d}`,   pattern: 'firstname.lastname',       weight: 10 },
    { email: `${f}${l}@${d}`,    pattern: 'firstnamelastname',        weight: 9 },
    { email: `${fi}${l}@${d}`,   pattern: 'firstinitiallastname',     weight: 8 },
    { email: `${fi}.${l}@${d}`,  pattern: 'firstinitial.lastname',    weight: 7 },
    { email: `${f}@${d}`,        pattern: 'firstname',                weight: 6 },
    { email: `${l}@${d}`,        pattern: 'lastname',                 weight: 5 },
    { email: `${l}.${f}@${d}`,   pattern: 'lastname.firstname',       weight: 4 },
    { email: `${l}${f}@${d}`,    pattern: 'lastnamefirstname',        weight: 3 },
    { email: `${f}.${li}@${d}`,  pattern: 'firstname.lastinitial',    weight: 3 },
    { email: `${f}_${l}@${d}`,   pattern: 'firstname_lastname',       weight: 2 },
    { email: `${f}${li}@${d}`,   pattern: 'firstnamelastinitial',     weight: 2 },
    { email: `${fi}${li}@${d}`,  pattern: 'firstinitialslastinitial', weight: 1 }
  ];

  const seen = new Set();
  const out = [];
  for (const p of patterns) {
    if (seen.has(p.email)) continue;
    seen.add(p.email);
    out.push(p);
  }
  return out;
}

// ── Confidence scoring ──────────────────────────────────────────────────────
// Returns the signals that were actually checked plus a 1–99 confidence score.
// `checked: false` signals are the ones that need a mail server.
function scoreEmail(email, weight) {
  const value = (email || '').toLowerCase().trim();
  const [local, domain] = value.split('@');

  const syntaxOk = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(value);
  if (!syntaxOk) {
    return {
      status: 'invalid', confidence: 0,
      syntax: false, domainShape: false, disposable: false, role: false, freeProvider: false,
      mailboxChecked: false
    };
  }

  const data = window.EF_DATA || {};
  const disposable = (data.disposableDomains || []).includes(domain);
  const role = (data.roleAddresses || []).includes(local);
  const freeProvider = (data.freeEmailDomains || []).includes(domain);

  // Pattern frequency is the base signal (weight 10 → ~95).
  let score = weight ? Math.round(weight * 9.5) : 50;

  if (freeProvider) score = Math.max(score - 25, 10);  // personal mailbox, not a company pattern
  // A role address usually exists but is a shared inbox, not the person you
  // asked for — so it is held down to "unknown", never marked invalid.
  if (role) score = Math.min(Math.max(score - 15, 35), 55);
  if (disposable) score = 3;                           // throwaway domain

  // Very short local parts are guessy even on a good pattern.
  if (local.length <= 2) score = Math.max(score - 10, 5);

  // Without a mailbox-level check nothing can honestly claim near-certainty.
  const confidence = Math.min(95, Math.max(1, score));

  let status;
  if (disposable) status = 'invalid';
  else if (role) status = 'unknown';
  else if (confidence < 25) status = 'invalid';
  else if (confidence < 60) status = 'unknown';
  else status = 'valid';

  return {
    status, confidence,
    syntax: true, domainShape: true,
    disposable, role, freeProvider,
    mailboxChecked: false
  };
}

// ── Signal rows shared by the finder modal and the verification page ────────
function buildSignalRows(v) {
  return [
    { label: 'Syntax',           ok: v.syntax,        val: v.syntax ? 'Valid' : 'Invalid',                    checked: true },
    { label: 'Domain format',    ok: v.domainShape,   val: v.domainShape ? 'Valid' : 'Invalid',               checked: true },
    { label: 'Disposable domain',ok: !v.disposable,   val: v.disposable ? 'Yes — flagged' : 'No',             checked: true },
    { label: 'Role address',     ok: !v.role,         val: v.role ? 'Yes — shared inbox' : 'No',              checked: true },
    { label: 'Free provider',    ok: !v.freeProvider, val: v.freeProvider ? 'Yes — personal mailbox' : 'No',  checked: true },
    { label: 'MX records',       ok: null,            val: 'Not checked',                                     checked: false },
    { label: 'SMTP mailbox',     ok: null,            val: 'Not checked',                                     checked: false }
  ];
}

// ── Processing steps animation ──────────────────────────────────────────────
const FINDER_STEPS = [
  'Generating email patterns',
  'Checking address syntax',
  'Screening the domain',
  'Ranking candidates',
  'Calculating confidence'
];

function runProcessingAnimation(container, onDone) {
  container.innerHTML = FINDER_STEPS.map((s, i) =>
    `<div class="proc-step" id="proc-step-${i}" aria-live="polite">
       <span class="proc-dot"></span>
       <span class="proc-label">${s}…</span>
     </div>`
  ).join('');

  let i = 0;
  (function next() {
    if (i >= FINDER_STEPS.length) { setTimeout(onDone, 250); return; }
    const el = document.getElementById(`proc-step-${i}`);
    if (!el) { onDone(); return; }
    const dot = el.querySelector('.proc-dot');
    el.classList.add('active');
    dot.classList.add('spinning');
    setTimeout(() => {
      dot.classList.remove('spinning');
      dot.classList.add('done');
      el.querySelector('.proc-label').textContent = FINDER_STEPS[i] + ' ✓';
      el.classList.remove('active');
      el.classList.add('complete');
      i++; next();
    }, 320 + i * 60);
  })();
}

// ── Finder page ─────────────────────────────────────────────────────────────
let _candidateDetails = {};

function openDetailModal(email) {
  const data = _candidateDetails[email];
  const el = document.getElementById('detail-modal');
  if (!data || !el) return;
  const v = data.ver;

  el.querySelector('#dm-email').textContent = email;
  el.querySelector('#dm-status').innerHTML =
    `<span class="badge ${EF.statusClass(v.status)}">${EF.statusLabel(v.status)}</span>`;
  el.querySelector('#dm-pattern').textContent = data.pattern;
  el.querySelector('#dm-confidence').textContent = `${v.confidence}% — ${EF.confidenceLabel(v.confidence)}`;

  el.querySelector('#dm-signals').innerHTML = buildSignalRows(v).map(r => `
    <div class="detail-row">
      <span class="detail-label">${r.label}</span>
      <span class="check-val ${r.checked ? (r.ok ? 'check--ok' : 'check--fail') : 'text-muted'}">
        ${r.checked ? `<i data-lucide="${r.ok ? 'check-circle' : 'x-circle'}"></i>` : '<i data-lucide="minus-circle"></i>'}
        ${r.val}
      </span>
    </div>`).join('');

  EF.Modal.open('detail-modal');
  EF.icons(el);
}
window.openDetailModal = openDetailModal;

function buildResultsHTML(candidates, bestIdx) {
  const showConfidence = EF.Prefs.get('confidence', true) !== false;
  const best = candidates[bestIdx];
  const v = best._ver;

  const bestCard = `
    <div class="best-match-card">
      <div class="best-match-header">
        <span class="best-badge"><i data-lucide="star"></i> Best match</span>
        <span class="conf-pill ${EF.confidenceClass(v.confidence)}">${v.confidence}% — ${EF.confidenceLabel(v.confidence)}</span>
      </div>
      <div class="best-email">${EF.escapeHtml(best.email)}</div>
      <div class="best-meta">
        <span class="badge ${EF.statusClass(v.status)}">${EF.statusLabel(v.status)}</span>
        <span class="pattern-tag"><i data-lucide="tag"></i> ${EF.escapeHtml(best.pattern)}</span>
      </div>
      <div class="best-actions">
        <button class="btn btn--primary" data-copy="${EF.escapeHtml(best.email)}">
          <i data-lucide="copy"></i> Copy email
        </button>
        <button class="btn btn--outline" data-detail="${EF.escapeHtml(best.email)}">
          <i data-lucide="info"></i> View signals
        </button>
      </div>
    </div>`;

  const tableRows = candidates.map((c, idx) => {
    const cv = c._ver;
    return `<tr${idx === bestIdx ? ' class="row--best"' : ''}>
      <td data-label="Email"><span class="email-cell">${EF.escapeHtml(c.email)}</span></td>
      <td data-label="Pattern"><code>${EF.escapeHtml(c.pattern)}</code></td>
      <td data-label="Status"><span class="badge ${EF.statusClass(cv.status)}">${EF.statusLabel(cv.status)}</span></td>
      <td data-label="Confidence">
        ${showConfidence ? `<div class="conf-cell">
          <div class="conf-bar-wrap"><div class="conf-bar" style="width:${cv.confidence}%"></div></div>
          <span class="conf-val ${EF.confidenceClass(cv.confidence)}">${cv.confidence}%</span>
        </div>` : '<span class="text-muted">—</span>'}
      </td>
      <td data-label="Action">
        <button class="btn btn--sm btn--ghost" data-copy="${EF.escapeHtml(c.email)}" aria-label="Copy ${EF.escapeHtml(c.email)}"><i data-lucide="copy"></i></button>
        <button class="btn btn--sm btn--ghost" data-detail="${EF.escapeHtml(c.email)}" aria-label="Signals for ${EF.escapeHtml(c.email)}"><i data-lucide="eye"></i></button>
      </td>
    </tr>`;
  }).join('');

  return { bestCard, tableRows };
}

function initFinderPage() {
  const form = document.getElementById('finder-form');
  if (!form) return;

  const resultArea = document.getElementById('finder-results');
  const procArea = document.getElementById('finder-processing');
  const findBtn = document.getElementById('find-btn');

  // Copy / detail buttons inside generated markup
  document.addEventListener('click', e => {
    const copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) { EF.copyToClipboard(copyBtn.dataset.copy); return; }
    const detailBtn = e.target.closest('[data-detail]');
    if (detailBtn) openDetailModal(detailBtn.dataset.detail);
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const firstName = form.querySelector('#inp-first').value.trim();
    const lastName = form.querySelector('#inp-last').value.trim();
    const domain = form.querySelector('#inp-domain').value.trim();
    const company = form.querySelector('#inp-company').value.trim();
    const jobTitle = form.querySelector('#inp-job').value.trim();

    if (!firstName) { EF.Toast.show('First name is required', 'error'); return; }
    if (!lastName) { EF.Toast.show('Last name is required', 'error'); return; }
    if (!domain) { EF.Toast.show('Company domain is required to build addresses', 'error'); return; }

    const candidates = generateEmailCandidates(firstName, lastName, domain);
    if (!candidates.length) {
      EF.Toast.show('Could not build candidates from those inputs', 'error');
      return;
    }

    findBtn.disabled = true;
    const spend = await EF.spendCredits(1, 'search');
    if (!spend.ok) {
      findBtn.disabled = false;
      EF.Toast.show(spend.message, 'error', 5000);
      return;
    }

    resultArea.hidden = true;
    procArea.hidden = false;

    runProcessingAnimation(procArea.querySelector('.proc-steps'), () => {
      candidates.forEach(c => {
        c._ver = scoreEmail(c.email, c.weight);
        _candidateDetails[c.email] = { ver: c._ver, pattern: c.pattern };
      });

      const bestIdx = candidates.reduce((bi, c, i, arr) =>
        c._ver.confidence > arr[bi]._ver.confidence ? i : bi, 0);

      const { bestCard, tableRows } = buildResultsHTML(candidates, bestIdx);
      resultArea.querySelector('#best-match-container').innerHTML = bestCard;
      resultArea.querySelector('#candidates-tbody').innerHTML = tableRows;

      procArea.hidden = true;
      resultArea.hidden = false;
      findBtn.disabled = false;
      EF.icons();

      const best = candidates[bestIdx];
      EF.History.add({
        firstName, lastName, company, domain, jobTitle,
        email: best.email, status: best._ver.status, confidence: best._ver.confidence
      });

      if (EF.Prefs.get('autocopy', false) === true) EF.copyToClipboard(best.email);

      resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

document.addEventListener('DOMContentLoaded', initFinderPage);
