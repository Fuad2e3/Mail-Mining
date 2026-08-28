// ============================================================
// verification.js — Single email verification page logic
// ============================================================

'use strict';

function initVerificationPage() {
  const form      = document.getElementById('verify-form');
  const resultDiv = document.getElementById('verify-result');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const emailInput = form.querySelector('#verify-email-input');
    const email = (emailInput.value || '').trim();

    if (!email) { Toast.show('Please enter an email address', 'error'); return; }

    resultDiv.hidden = true;
    resultDiv.innerHTML = '';

    // Quick processing feedback
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Verifying…';
    if (window.lucide) lucide.createIcons({ nodes: [btn] });

    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="search"></i> Verify Email';
      if (window.lucide) lucide.createIcons({ nodes: [btn] });

      const v = simulateVerification(email, 8);
      renderVerifyResult(email, v, resultDiv);
      resultDiv.hidden = false;
      resultDiv.scrollIntoView({ behavior:'smooth', block:'start' });
    }, 1800);
  });
}

function renderVerifyResult(email, v, container) {
  const checks = [
    { label:'Syntax',      ok: v.syntax,    val: v.syntax     ? 'Valid'         : 'Invalid'       },
    { label:'Domain',      ok: v.domain,    val: v.domain     ? 'Valid'         : 'Invalid'       },
    { label:'MX Records',  ok: v.mx,        val: v.mx         ? 'Found'         : 'Not Found'     },
    { label:'SMTP',        ok: v.smtp === 'simulated', val: v.smtp === 'simulated' ? 'Simulated'  : 'Blocked'  },
    { label:'Catch-All',   ok: !v.catchAll, val: v.catchAll   ? 'Detected'      : 'Not Detected'  },
    { label:'Disposable',  ok: !v.disposable,val:v.disposable ? 'Yes (flagged)' : 'No'            },
    { label:'Role Address',ok: !v.role,     val: v.role       ? 'Yes (flagged)' : 'No'            },
  ];

  const checksHTML = checks.map(c => `
    <div class="verify-check">
      <span class="check-label">${c.label}</span>
      <span class="check-val ${c.ok ? 'check--ok' : 'check--fail'}">
        <i data-lucide="${c.ok ? 'check-circle' : 'x-circle'}"></i> ${c.val}
      </span>
    </div>`).join('');

  container.innerHTML = `
    <div class="verify-result-card">
      <div class="verify-demo-banner">
        <i data-lucide="flask-conical"></i>
        DEMO VERIFICATION — Results are simulated and do not represent real mailbox status.
      </div>
      <div class="verify-email-display">${email}</div>
      <div class="verify-status-row">
        <span class="badge badge--lg ${statusClass(v.status)}">${statusLabel(v.status)}</span>
        <span class="conf-pill ${confidenceClass(v.confidence)}">
          Confidence: ${v.confidence}% — ${confidenceLabel(v.confidence)}
        </span>
      </div>
      <div class="conf-bar-wrap">
        <div class="conf-bar conf-bar--lg" style="width:${v.confidence}%"></div>
      </div>
      <div class="verify-checks">${checksHTML}</div>
    </div>`;

  if (window.lucide) lucide.createIcons({ nodes: [container] });
}

document.addEventListener('DOMContentLoaded', initVerificationPage);
