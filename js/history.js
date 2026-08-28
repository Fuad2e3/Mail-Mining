// ============================================================
// history.js — Search history page (localStorage)
// ============================================================

'use strict';

function initHistoryPage() {
  const container = document.getElementById('history-container');
  const searchEl  = document.getElementById('history-search');
  const filterEl  = document.getElementById('history-filter');
  const clearBtn  = document.getElementById('clear-history-btn');
  const exportBtn = document.getElementById('export-history-btn');
  if (!container) return;

  let allHistory = History.load();

  function render(data) {
    if (!data.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="inbox" class="empty-state__icon"></i>
          <h3>No searches yet</h3>
          <p>Your recent searches will appear here.</p>
          <a href="./finder.html" class="btn btn--primary"><i data-lucide="search"></i> Find an Email</a>
        </div>`;
      if (window.lucide) lucide.createIcons({ nodes: [container] });
      return;
    }

    const rows = data.map(entry => `
      <tr>
        <td data-label="Name">${entry.firstName || ''} ${entry.lastName || ''}</td>
        <td data-label="Company">${entry.company || '—'}</td>
        <td data-label="Domain">${entry.domain || '—'}</td>
        <td data-label="Best Email"><span class="email-cell">${entry.email || '—'}</span></td>
        <td data-label="Status"><span class="badge ${statusClass(entry.status)}">${statusLabel(entry.status)}</span></td>
        <td data-label="Confidence">${entry.confidence ? entry.confidence + '%' : '—'}</td>
        <td data-label="Date">${entry.date ? new Date(entry.date).toLocaleDateString() : '—'}</td>
        <td data-label="Action">
          <button class="btn btn--sm btn--ghost copy-hist-btn" data-email="${entry.email}" aria-label="Copy email">
            <i data-lucide="copy"></i>
          </button>
        </td>
      </tr>`).join('');

    container.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Company</th><th>Domain</th>
              <th>Best Email</th><th>Status</th><th>Confidence</th>
              <th>Date</th><th>Action</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    // Copy buttons
    container.querySelectorAll('.copy-hist-btn').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.email));
    });
    if (window.lucide) lucide.createIcons({ nodes: [container] });
  }

  function filtered() {
    let data = [...allHistory];
    const q = (searchEl?.value || '').toLowerCase();
    const f = filterEl?.value || '';
    if (q) data = data.filter(e =>
      `${e.firstName} ${e.lastName} ${e.email} ${e.company}`.toLowerCase().includes(q));
    if (f) data = data.filter(e => (e.status||'').toLowerCase() === f);
    return data;
  }

  render(filtered());

  searchEl?.addEventListener('input', () => render(filtered()));
  filterEl?.addEventListener('change', () => render(filtered()));

  clearBtn?.addEventListener('click', () => {
    if (!confirm('Clear all search history? This cannot be undone.')) return;
    History.clear();
    allHistory = [];
    render([]);
    Toast.show('History cleared', 'info');
  });

  exportBtn?.addEventListener('click', () => {
    const data = filtered().map(e => ({
      first_name: e.firstName, last_name: e.lastName,
      company: e.company, domain: e.domain,
      email: e.email, status: e.status,
      confidence: e.confidence, date: e.date
    }));
    exportCSV(data, 'emailfinder-history.csv');
  });
}

document.addEventListener('DOMContentLoaded', initHistoryPage);
