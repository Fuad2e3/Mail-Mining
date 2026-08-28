// ============================================================================
// verify.js — single address verification page
//
// Checks that can honestly be made in the browser: syntax, domain shape,
// disposable/free/role lists, and how person-like the local part is.
// Mailbox-level checks (MX, SMTP, catch-all) need a mail server and are
// reported as "not checked" instead of being invented.
// ============================================================================

'use strict';

// How person-like does the local part look? Feeds the confidence score the
// same way a known pattern does on the finder page.
function inferLocalPartWeight(local) {
  const value = (local || '').toLowerCase();
  if (!value) return 1;

  const roles = (window.EF_DATA && EF_DATA.roleAddresses) || [];
  if (roles.includes(value)) return 4;

  const twoParts = /^[a-z]{2,}[._-][a-z]{2,}$/;          // john.smith
  const initialDotLast = /^[a-z][._-][a-z]{2,}$/;        // j.smith
  const initialLast = /^[a-z][a-z]{3,}$/;                // jsmith / johnsmith

  if (twoParts.test(value)) return 10;
  if (initialDotLast.test(value)) return 8;
  if (/\d/.test(value)) return 5;
  if (initialLast.test(value)) return 7;
  if (value.length <= 2) return 3;
  return 6;
}

function initVerificationPage() {
  const form = document.getElementById('verify-form');
  if (!form) return;

  const resultDiv = document.getElementById('verify-result');
  const input = form.querySelector('#verify-email-input');
  const btn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = (input.value || '').trim();
    if (!email) { EF.Toast.show('Please enter an email address', 'error'); return; }

    btn.disabled = true;
    const spend = await EF.spendCredits(1, 'verification');
    if (!spend.ok) {
      btn.disabled = false;
      EF.Toast.show(spend.message, 'error', 5000);
      return;
    }

    resultDiv.hidden = true;
    const originalLabel = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Checking…';
    EF.icons(btn);

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
      EF.icons(btn);

      const local = email.toLowerCase().split('@')[0];
      const v = scoreEmail(email, inferLocalPartWeight(local));
      renderVerifyResult(email, v, resultDiv);

      resultDiv.hidden = false;
      resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 900);
  });
}

function renderVerifyResult(email, v, container) {
  const checksHTML = buildSignalRows(v).map(c => `
    <div class="verify-check">
      <span class="check-label">${c.label}</span>
      <span class="check-val ${c.checked ? (c.ok ? 'check--ok' : 'check--fail') : 'text-muted'}">
        ${c.checked ? `<i data-lucide="${c.ok ? 'check-circle' : 'x-circle'}"></i>` : '<i data-lucide="minus-circle"></i>'}
        ${c.val}
      </span>
    </div>`).join('');

  container.innerHTML = `
    <div class="card verify-result-card" style="padding:1.5rem;">
      <div class="verify-email-display">${EF.escapeHtml(email)}</div>
      <div class="verify-status-row">
        <span class="badge badge--lg ${EF.statusClass(v.status)}">${EF.statusLabel(v.status)}</span>
        <span class="conf-pill ${EF.confidenceClass(v.confidence)}">
          Confidence: ${v.confidence}% — ${EF.confidenceLabel(v.confidence)}
        </span>
      </div>
      <div class="conf-bar-wrap conf-bar--lg" style="height:12px;">
        <div class="conf-bar" style="width:${v.confidence}%"></div>
      </div>
      <div class="verify-checks">${checksHTML}</div>
      <p class="text-xs text-muted" style="margin-top:1rem;">
        Confidence reflects address structure and domain reputation signals only.
        Mailbox existence is not probed, so a high score is a strong guess, not a delivery guarantee.
      </p>
    </div>`;

  EF.icons(container);
}

document.addEventListener('DOMContentLoaded', initVerificationPage);
