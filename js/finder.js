// ============================================================
// finder.js — Email candidate generation + mock verification
// ============================================================

'use strict';

// ── Normalise name part ────────────────────────────────────
function normalizeName(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')   // strip diacritics
    .replace(/[''`]/g,'')                               // apostrophes
    .replace(/[-\s]+/g,'')                              // hyphens/spaces
    .replace(/[^a-z0-9]/g,'');                          // everything else
}

// ── Generate candidates ────────────────────────────────────
function generateEmailCandidates(firstName, lastName, domain) {
  const f  = normalizeName(firstName);
  const l  = normalizeName(lastName);
  const fi = f.charAt(0);
  const li = l.charAt(0);
  const d  = (domain || '').toLowerCase().trim().replace(/^https?:\/\//,'').replace(/\/.*$/,'');

  if (!f || !l) return [];

  const patterns = [
    { email:`${f}.${l}@${d}`,     pattern:'firstname.lastname',       weight:10 },
    { email:`${f}${l}@${d}`,      pattern:'firstnamelastname',        weight:9  },
    { email:`${fi}${l}@${d}`,     pattern:'firstinitiallastname',     weight:8  },
    { email:`${fi}.${l}@${d}`,    pattern:'firstinitial.lastname',    weight:7  },
    { email:`${f}@${d}`,          pattern:'firstname',                weight:6  },
    { email:`${l}@${d}`,          pattern:'lastname',                 weight:5  },
    { email:`${l}.${f}@${d}`,     pattern:'lastname.firstname',       weight:4  },
    { email:`${l}${f}@${d}`,      pattern:'lastnamefirstname',        weight:3  },
    { email:`${f}.${li}@${d}`,    pattern:'firstname.lastinitial',    weight:3  },
    { email:`${f}_${l}@${d}`,     pattern:'firstname_lastname',       weight:2  },
    { email:`${f}${li}@${d}`,     pattern:'firstnamelastinitial',     weight:2  },
    { email:`${fi}${li}@${d}`,    pattern:'firstinitialslastinitial', weight:1  },
  ];

  // Deduplicate by email address
  const seen = new Set();
  const out  = [];
  for (const p of patterns) {
    if (!p.email.includes('@') || !d) continue;
    if (seen.has(p.email)) continue;
    seen.add(p.email);
    out.push(p);
  }
  return out;
}

// ── Mock verification engine ───────────────────────────────
function simulateVerification(email, weight) {
  // All results are simulated — never represent as real verification
  const emailLower = (email || '').toLowerCase().trim();
  const [local, domain] = emailLower.split('@');

  // Syntax check
  const syntaxOk = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(emailLower);
  if (!syntaxOk) {
    return { status:'invalid', confidence:0, syntax:false, domain:false,
             mx:false, smtp:'skipped', catchAll:false, disposable:false,
             role:false, pattern:'none' };
  }

  const disposable = (MOCK_DATA.disposableDomains || []).includes(domain);
  const role       = (MOCK_DATA.roleAddresses || []).some(r => local === r);
  const isFree     = (MOCK_DATA.freeEmailDomains || []).includes(domain);

  // Deterministic seed based on email chars → repeatable results
  let seed = 0;
  for (let i = 0; i < emailLower.length; i++) seed += emailLower.charCodeAt(i);
  const pseudoRand = (max) => ((seed * 1103515245 + 12345) & 0x7fffffff) % max;

  const domainOk  = !disposable;
  const mxOk      = domainOk && !isFree;
  const catchAll   = mxOk && (seed % 7 === 0);
  const smtpResult = mxOk ? 'simulated' : 'blocked';

  let base = weight ? Math.round(weight * 9.5) : 50;
  if (!mxOk)     base = Math.max(base - 30, 5);
  if (catchAll)  base = Math.min(base, 70);
  if (role)      base = Math.max(base - 15, 5);
  if (disposable) base = 3;

  // Jitter ±5 based on seed so results look realistic
  const jitter = (seed % 11) - 5;
  const confidence = Math.min(99, Math.max(1, base + jitter));

  let status;
  if (disposable)          status = 'invalid';
  else if (catchAll)       status = 'accept_all';
  else if (confidence < 20) status = 'invalid';
  else if (confidence < 55) status = 'unknown';
  else                      status = 'valid';

  return { status, confidence, syntax:true, domain:domainOk,
           mx:mxOk, smtp:smtpResult, catchAll, disposable, role };
}

// ── Processing steps animation ─────────────────────────────
const STEPS = [
  'Generating email patterns',
  'Checking domain',
  'Checking MX records',
  'Analyzing candidates',
  'Calculating confidence',
];

function runProcessingAnimation(container, onDone) {
  container.innerHTML = STEPS.map((s, i) =>
    `<div class="proc-step" id="proc-step-${i}" aria-live="polite">
       <span class="proc-dot"></span>
       <span class="proc-label">${s}…</span>
     </div>`
  ).join('');

  let i = 0;
  function next() {
    if (i >= STEPS.length) { setTimeout(onDone, 300); return; }
    const el  = document.getElementById(`proc-step-${i}`);
    const dot = el.querySelector('.proc-dot');
    el.classList.add('active');
    dot.classList.add('spinning');
    setTimeout(() => {
      dot.classList.remove('spinning');
      dot.classList.add('done');
      el.querySelector('.proc-label').textContent = STEPS[i] + ' ✓';
      el.classList.remove('active');
      el.classList.add('complete');
      i++; next();
    }, 420 + i * 80);
  }
  next();
}

// ── Build results HTML ─────────────────────────────────────
function buildResultsHTML(candidates, bestIdx) {
  const best = candidates[bestIdx];
  const verBest = best._ver;

  const bestCard = `
    <div class="best-match-card">
      <div class="best-match-header">
        <span class="best-badge"><i data-lucide="star"></i> BEST MATCH</span>
        <span class="demo-pill">DEMO MODE</span>
      </div>
      <div class="best-email">${best.email}</div>
      <div class="best-meta">
        <span class="badge ${statusClass(verBest.status)}">${statusLabel(verBest.status)}</span>
        <span class="conf-pill ${confidenceClass(verBest.confidence)}">${verBest.confidence}% — ${confidenceLabel(verBest.confidence)}</span>
        <span class="pattern-tag"><i data-lucide="tag"></i> ${best.pattern}</span>
      </div>
      <div class="best-actions">
        <button class="btn btn--primary" onclick="copyToClipboard('${best.email}')">
          <i data-lucide="copy"></i> Copy Email
        </button>
        <button class="btn btn--outline" onclick="openDetailModal('${best.email}')">
          <i data-lucide="info"></i> View Details
        </button>
      </div>
    </div>`;

  const tableRows = candidates.map((c, idx) => {
    const v = c._ver;
    return `<tr${idx === bestIdx ? ' class="row--best"' : ''}>
      <td data-label="Email"><span class="email-cell">${c.email}</span></td>
      <td data-label="Pattern"><code>${c.pattern}</code></td>
      <td data-label="Status"><span class="badge ${statusClass(v.status)}">${statusLabel(v.status)}</span></td>
      <td data-label="Confidence">
        <div class="conf-cell">
          <div class="conf-bar-wrap">
            <div class="conf-bar" style="width:${v.confidence}%"></div>
          </div>
          <span class="conf-val ${confidenceClass(v.confidence)}">${v.confidence}%</span>
        </div>
      </td>
      <td data-label="Action">
        <button class="btn btn--sm btn--ghost" onclick="copyToClipboard('${c.email}')"><i data-lucide="copy"></i></button>
        <button class="btn btn--sm btn--ghost" onclick="openDetailModal('${c.email}')"><i data-lucide="eye"></i></button>
      </td>
    </tr>`;
  }).join('');

  return { bestCard, tableRows };
}

// ── Detail modal data store ────────────────────────────────
let _modalData = {};

function openDetailModal(email) {
  const data = _modalData[email];
  if (!data) return;
  const v = data.ver;
  const el = document.getElementById('detail-modal');
  if (!el) return;

  el.querySelector('#dm-email').textContent      = email;
  el.querySelector('#dm-syntax').textContent     = v.syntax    ? 'Valid'      : 'Invalid';
  el.querySelector('#dm-domain').textContent     = v.domain    ? 'Valid'      : 'Invalid';
  el.querySelector('#dm-mx').textContent         = v.mx        ? 'Found'      : 'Not Found';
  el.querySelector('#dm-smtp').textContent       = v.smtp      === 'simulated' ? 'Simulated' : 'Blocked';
  el.querySelector('#dm-catchall').textContent   = v.catchAll  ? 'Detected'   : 'Not Detected';
  el.querySelector('#dm-disposable').textContent = v.disposable? 'Yes'        : 'No';
  el.querySelector('#dm-role').textContent       = v.role      ? 'Yes'        : 'No';
  el.querySelector('#dm-pattern').textContent    = data.pattern;
  el.querySelector('#dm-confidence').textContent = `${v.confidence}% — ${confidenceLabel(v.confidence)}`;
  el.querySelector('#dm-status').innerHTML       = `<span class="badge ${statusClass(v.status)}">${statusLabel(v.status)}</span>`;

  Modal.open('detail-modal');
  if (window.lucide) lucide.createIcons({ nodes: [el] });
}

// ── Main finder init ───────────────────────────────────────
function initFinderPage() {
  const form         = document.getElementById('finder-form');
  const resultArea   = document.getElementById('finder-results');
  const procArea     = document.getElementById('finder-processing');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const firstName = form.querySelector('#inp-first').value.trim();
    const lastName  = form.querySelector('#inp-last').value.trim();
    const domain    = form.querySelector('#inp-domain').value.trim();
    const company   = form.querySelector('#inp-company').value.trim();
    const jobTitle  = form.querySelector('#inp-job').value.trim();

    if (!firstName) { Toast.show('First name is required', 'error'); return; }
    if (!lastName)  { Toast.show('Last name is required',  'error'); return; }

    if (!domain) Toast.show('Adding a domain improves results significantly', 'info', 4000);

    resultArea.hidden = true;
    procArea.hidden   = false;

    runProcessingAnimation(procArea.querySelector('.card') || procArea, () => {
      const candidates = generateEmailCandidates(firstName, lastName, domain || 'example.com');
      if (!candidates.length) {
        procArea.innerHTML = `<p class="error-msg">Could not generate candidates. Please check the inputs.</p>`;
        return;
      }

      // Simulate verification for each
      candidates.forEach(c => {
        c._ver = simulateVerification(c.email, c.weight);
        _modalData[c.email] = { ver: c._ver, pattern: c.pattern };
      });

      // Best = highest confidence
      const bestIdx = candidates.reduce((bi, c, i, arr) =>
        c._ver.confidence > arr[bi]._ver.confidence ? i : bi, 0);

      const { bestCard, tableRows } = buildResultsHTML(candidates, bestIdx);

      resultArea.querySelector('#best-match-container').innerHTML = bestCard;
      resultArea.querySelector('#candidates-tbody').innerHTML     = tableRows;

      procArea.hidden   = true;
      resultArea.hidden = false;
      if (window.lucide) lucide.createIcons();

      // Save to history
      const best = candidates[bestIdx];
      History.add({
        firstName, lastName, company, domain,
        email: best.email, status: best._ver.status,
        confidence: best._ver.confidence, jobTitle
      });

      resultArea.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });
}

document.addEventListener('DOMContentLoaded', initFinderPage);
