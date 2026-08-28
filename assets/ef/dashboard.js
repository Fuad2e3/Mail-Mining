// ============================================================================
// dashboard.js — overview built from this browser's real search history
// ============================================================================

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('recent-activity-body');
  if (!grid && !document.getElementById('stat-found')) return;

  const history = EF.History.load();
  const total = history.length;
  const valid = history.filter(h => (h.status || '').toLowerCase() === 'valid').length;
  const risky = history.filter(h => ['invalid', 'unknown'].includes((h.status || '').toLowerCase())).length;
  const rate = total ? Math.round((valid / total) * 1000) / 10 : 0;

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  set('stat-found', total.toLocaleString());
  set('stat-valid', valid.toLocaleString());
  set('stat-risky', risky.toLocaleString());
  set('stat-rate', total ? `${rate}%` : '—');

  // Account-driven pieces land once the credit sync resolves, so refresh twice.
  function renderAccountBits() {
    const greeting = document.getElementById('ef-greeting');
    if (greeting) greeting.textContent = `Welcome back, ${EF.account.name || 'there'}`;

    const chip = document.getElementById('ef-plan-chip');
    if (chip) chip.textContent = `${(EF.account.package || 'free').toUpperCase()} — ${EF.account.dailyCredits.toLocaleString()} / day`;

    const bar = document.getElementById('ef-credit-fill-lg');
    if (bar) {
      const totalCredits = Math.max(1, EF.account.dailyCredits || 50);
      const left = Math.max(0, EF.account.remainingCredits || 0);
      bar.style.width = `${Math.min(100, Math.round((left / totalCredits) * 100))}%`;
    }
  }
  renderAccountBits();
  document.addEventListener('ef:account', renderAccountBits);

  if (!grid) return;

  const recent = history.slice(0, 8);
  if (!recent.length) {
    grid.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state" style="padding:2.5rem 1rem;">
            <i data-lucide="search" class="empty-state__icon"></i>
            <h3>Nothing here yet</h3>
            <p>Run your first search and it will show up here.</p>
            <a href="finder.html" class="btn btn--primary btn--sm"><i data-lucide="search"></i> Find an email</a>
          </div>
        </td>
      </tr>`;
    EF.icons(grid);
    return;
  }

  grid.innerHTML = recent.map(a => `
    <tr>
      <td data-label="Name">${EF.escapeHtml(`${a.firstName || ''} ${a.lastName || ''}`.trim()) || '—'}</td>
      <td data-label="Company">${EF.escapeHtml(a.company || a.domain) || '—'}</td>
      <td data-label="Email"><span class="email-cell">${EF.escapeHtml(a.email) || '—'}</span></td>
      <td data-label="Confidence"><span class="${EF.confidenceClass(a.confidence || 0)}">${a.confidence ? a.confidence + '%' : '—'}</span></td>
      <td data-label="Status"><span class="badge ${EF.statusClass(a.status)}">${EF.statusLabel(a.status)}</span></td>
    </tr>`).join('');
  EF.icons(grid);
});
