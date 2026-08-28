// ============================================================================
// bulk.js — CSV upload, in-browser batch processing, CSV export
//
// The uploaded file never leaves the browser: it is parsed and processed
// locally, then the results can be downloaded again as CSV.
// ============================================================================

'use strict';

const BULK_MAX_ROWS = 5000;
let _bulkResults = [];

function initBulkFinderPage() {
  const dropzone = document.getElementById('csv-dropzone');
  const fileInput = document.getElementById('csv-file-input');
  const sampleBtn = document.getElementById('paste-sample-btn');
  if (!dropzone && !fileInput) return;

  if (dropzone) {
    dropzone.addEventListener('click', e => {
      if (e.target.closest('button')) return;   // the inner buttons handle themselves
      fileInput && fileInput.click();
    });
    dropzone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput && fileInput.click(); }
    });
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) handleCSVFile(file);
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleCSVFile(fileInput.files[0]);
      fileInput.value = '';   // allow re-picking the same file
    });
  }

  if (sampleBtn) {
    sampleBtn.addEventListener('click', () => startBulk(EF.parseCSV(EF_DATA.sampleCSV)));
  }

  document.addEventListener('click', e => {
    if (e.target.closest('#bulk-export-btn')) exportBulkResults();
  });
}

function handleCSVFile(file) {
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    EF.Toast.show('Please upload a .csv file', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    const rows = EF.parseCSV(ev.target.result);
    if (!rows.length) { EF.Toast.show('That CSV appears to be empty', 'warning'); return; }

    const columns = Object.keys(rows[0]);
    const missing = ['first_name', 'last_name'].filter(k => !columns.includes(k));
    if (missing.length) {
      EF.Toast.show(`CSV is missing required column(s): ${missing.join(', ')}`, 'error', 5000);
      return;
    }
    startBulk(rows);
  };
  reader.onerror = () => EF.Toast.show('Could not read that file', 'error');
  reader.readAsText(file);
}

async function startBulk(rows) {
  if (rows.length > BULK_MAX_ROWS) {
    EF.Toast.show(`Only the first ${BULK_MAX_ROWS.toLocaleString()} rows will be processed`, 'warning', 5000);
    rows = rows.slice(0, BULK_MAX_ROWS);
  }

  const spend = await EF.spendCredits(rows.length, 'bulk run');
  if (!spend.ok) { EF.Toast.show(spend.message, 'error', 6000); return; }

  processBulk(rows);
}

function processBulk(rows) {
  const procArea = document.getElementById('bulk-processing');
  const resultArea = document.getElementById('bulk-results');
  if (!procArea) return;

  _bulkResults = [];
  procArea.hidden = false;
  resultArea.hidden = true;

  const total = rows.length;
  const progBar = procArea.querySelector('#bulk-prog-bar');
  const progTxt = procArea.querySelector('#bulk-prog-txt');
  const progPct = procArea.querySelector('#bulk-prog-pct');

  let processed = 0;
  const CHUNK = 25;

  function processChunk() {
    const end = Math.min(processed + CHUNK, total);

    for (let i = processed; i < end; i++) {
      const row = rows[i];
      const f = row.first_name || row.firstname || '';
      const l = row.last_name || row.lastname || '';
      const d = row.domain || row.website || '';
      const c = row.company || '';

      if (!f || !l || !d) {
        _bulkResults.push({
          first_name: f, last_name: l, company: c, domain: d,
          email: '—', status: 'invalid', confidence: 0, pattern: '—'
        });
        continue;
      }

      const candidates = generateEmailCandidates(f, l, d);
      if (!candidates.length) {
        _bulkResults.push({
          first_name: f, last_name: l, company: c, domain: d,
          email: '—', status: 'unknown', confidence: 0, pattern: '—'
        });
        continue;
      }

      candidates.forEach(cd => { cd._ver = scoreEmail(cd.email, cd.weight); });
      const best = candidates.reduce((b, cd) => cd._ver.confidence > b._ver.confidence ? cd : b, candidates[0]);

      _bulkResults.push({
        first_name: f, last_name: l, company: c, domain: d,
        email: best.email, status: best._ver.status,
        confidence: best._ver.confidence, pattern: best.pattern
      });
    }

    processed = end;
    const pct = Math.round((processed / total) * 100);
    if (progBar) progBar.style.width = pct + '%';
    if (progTxt) progTxt.textContent = `${processed.toLocaleString()} / ${total.toLocaleString()}`;
    if (progPct) progPct.textContent = pct + '%';

    if (processed < total) {
      setTimeout(processChunk, 15);
    } else {
      renderBulkResults(_bulkResults);
      resultArea.hidden = false;
      resultArea.scrollIntoView({ behavior: 'smooth' });
      EF.Toast.show(`Processed ${total.toLocaleString()} record${total === 1 ? '' : 's'}`, 'success');
    }
  }

  setTimeout(processChunk, 80);
}

function renderBulkResults(results) {
  const resultArea = document.getElementById('bulk-results');
  if (!resultArea) return;

  const matches = results.filter(r => r.status !== 'invalid' && r.email !== '—').length;
  const noMatch = results.length - matches;

  const rows = results.map(r => `
    <tr>
      <td data-label="First name">${EF.escapeHtml(r.first_name)}</td>
      <td data-label="Last name">${EF.escapeHtml(r.last_name)}</td>
      <td data-label="Company">${EF.escapeHtml(r.company) || '—'}</td>
      <td data-label="Email"><span class="email-cell">${EF.escapeHtml(r.email)}</span></td>
      <td data-label="Status"><span class="badge ${EF.statusClass(r.status)}">${EF.statusLabel(r.status)}</span></td>
      <td data-label="Confidence">${r.confidence > 0 ? r.confidence + '%' : '—'}</td>
    </tr>`).join('');

  resultArea.innerHTML = `
    <div class="card">
      <div class="bulk-result-header">
        <h3 style="font-size:1.05rem;">Results</h3>
        <button id="bulk-export-btn" class="btn btn--primary btn--sm">
          <i data-lucide="download"></i> Download CSV
        </button>
      </div>
      <div class="bulk-summary">
        <div class="stat-mini"><span class="stat-mini__val">${results.length.toLocaleString()}</span><span class="stat-mini__lbl">Records</span></div>
        <div class="stat-mini stat-mini--green"><span class="stat-mini__val">${matches.toLocaleString()}</span><span class="stat-mini__lbl">Matches</span></div>
        <div class="stat-mini stat-mini--red"><span class="stat-mini__val">${noMatch.toLocaleString()}</span><span class="stat-mini__lbl">No match</span></div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>First name</th><th>Last name</th><th>Company</th>
              <th>Email</th><th>Status</th><th>Confidence</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;

  EF.icons(resultArea);
}

function exportBulkResults() {
  if (!_bulkResults.length) { EF.Toast.show('No results to export', 'warning'); return; }
  EF.exportCSV(_bulkResults, 'emailfinder-bulk-results.csv');
}

document.addEventListener('DOMContentLoaded', initBulkFinderPage);
