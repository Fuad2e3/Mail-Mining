// ============================================================================
// history.js — search history page (stored per browser, never uploaded)
// ============================================================================

'use strict';

function initHistoryPage() {
  const container = document.getElementById('history-container');
  if (!container) return;

  const searchEl = document.getElementById('history-search');
  const filterEl = document.getElementById('history-filter');
  const clearBtn = document.getElementById('clear-history-btn');
  const exportBtn = document.getElementById('export-history-btn');

  let allHistory = EF.History.load();

  function visible() {
    let data = [...allHistory];
    const q = (searchEl && searchEl.value || '').toLowerCase().trim();
    const f = (filterEl && filterEl.value) || '';
    if (q) {
      data = data.filter(e =>
        `${e.firstName || ''} ${e.lastName || ''} ${e.email || ''} ${e.company || ''} ${e.domain || ''}`
          .toLowerCase().includes(q));
    }
    if (f) data = data.filter(e => (e.status || '').toLowerCase() === f);
    return data;
  }

  function render(data) {
    if (!data.length) {
      const empty = allHistory.length === 0;
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="inbox" class="empty-state__icon"></i>
          <h3>${empty ? 'No searches yet' : 'No matching searches'}</h3>
          <p>${empty ? 'Every search you run is saved here in this browser.' : 'Try a different search term or filter.'}</p>
          ${empty ? '<a href="finder.html" class="btn btn--primary"><i data-lucide="search"></i> Find an email</a>' : ''}
        </div>`;
      EF.icons(container);
      return;
    }

    const rows = data.map(entry => `
      <tr>
        <td data-label="Name">${EF.escapeHtml(`${entry.firstName || ''} ${entry.lastName || ''}`.trim()) || '—'}</td>
        <td data-label="Company">${EF.escapeHtml(entry.company) || '—'}</td>
        <td data-label="Domain">${EF.escapeHtml(entry.domain) || '—'}</td>
        <td data-label="Best email"><span class="email-cell">${EF.escapeHtml(entry.email) || '—'}</span></td>
        <td data-label="Status"><span class="badge ${EF.statusClass(entry.status)}">${EF.statusLabel(entry.status)}</span></td>
        <td data-label="Confidence">${entry.confidence ? entry.confidence + '%' : '—'}</td>
        <td data-label="Date">${entry.date ? new Date(entry.date).toLocaleDateString() : '—'}</td>
        <td data-label="Action">
          <button class="btn btn--sm btn--ghost" data-copy="${EF.escapeHtml(entry.email)}" aria-label="Copy email">
            <i data-lucide="copy"></i>
          </button>
        </td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Company</th><th>Domain</th><th>Best email</th>
              <th>Status</th><th>Confidence</th><th>Date</th><th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    EF.icons(container);
  }

  container.addEventListener('click', e => {
    const btn = e.target.closest('[data-copy]');
    if (btn) EF.copyToClipboard(btn.dataset.copy);
  });

  if (searchEl) searchEl.addEventListener('input', () => render(visible()));
  if (filterEl) filterEl.addEventListener('change', () => render(visible()));

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (!allHistory.length) { EF.Toast.show('History is already empty', 'info'); return; }
      if (!confirm('Clear all search history? This cannot be undone.')) return;
      EF.History.clear();
      allHistory = [];
      render([]);
      EF.Toast.show('History cleared', 'info');
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = visible().map(e => ({
        first_name: e.firstName, last_name: e.lastName,
        company: e.company, domain: e.domain,
        email: e.email, status: e.status,
        confidence: e.confidence, date: e.date
      }));
      EF.exportCSV(data, 'emailfinder-history.csv');
    });
  }

  render(visible());
}

document.addEventListener('DOMContentLoaded', initHistoryPage);
