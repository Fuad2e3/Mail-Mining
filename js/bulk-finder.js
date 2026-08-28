// ============================================================
// bulk-finder.js — CSV upload, local processing, export
// ============================================================

'use strict';

function initBulkFinderPage() {
  const dropzone  = document.getElementById('csv-dropzone');
  const fileInput = document.getElementById('csv-file-input');
  const pasteBtn  = document.getElementById('paste-sample-btn');
  const procArea  = document.getElementById('bulk-processing');
  const resultArea= document.getElementById('bulk-results');
  if (!dropzone && !fileInput) return;

  // ── Drag & drop ──────────────────────────────────────────
  if (dropzone) {
    dropzone.addEventListener('click', () => fileInput && fileInput.click());
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
    });
  }

  // ── Paste sample ────────────────────────────────────────
  if (pasteBtn) {
    pasteBtn.addEventListener('click', () => {
      const sample = `first_name,last_name,company,domain\nAlice,Chen,CloudBase,cloudbase.io\nBob,Nguyen,FinStack,finstack.com\nCarol,Murphy,DevSpark,devspark.co\nDan,Park,Nexify,nexify.com\nEmma,Shah,Rapidworks,rapidworks.io`;
      processBulk(parseCSV(sample));
    });
  }

  // ── Export button ───────────────────────────────────────
  document.addEventListener('click', e => {
    if (e.target.closest('#bulk-export-btn')) exportBulkResults();
  });
}

function handleCSVFile(file) {
  if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
    Toast.show('Please upload a valid CSV file', 'error'); return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    const rows = parseCSV(ev.target.result);
    if (!rows.length) { Toast.show('CSV appears empty', 'warning'); return; }
    const required = ['first_name','last_name'];
    const missing  = required.filter(k => !Object.keys(rows[0]).includes(k));
    if (missing.length) {
      Toast.show(`CSV missing columns: ${missing.join(', ')}`, 'error'); return;
    }
    processBulk(rows);
  };
  reader.readAsText(file);
}

let _bulkResults = [];

function processBulk(rows) {
  const procArea   = document.getElementById('bulk-processing');
  const resultArea = document.getElementById('bulk-results');
  if (!procArea) return;

  _bulkResults = [];
  procArea.hidden  = false;
  resultArea.hidden= true;

  const total   = rows.length;
  const progBar = procArea.querySelector('#bulk-prog-bar');
  const progTxt = procArea.querySelector('#bulk-prog-txt');
  const progPct = procArea.querySelector('#bulk-prog-pct');

  let processed = 0;
  const CHUNK   = 5;

  function processChunk() {
    const end = Math.min(processed + CHUNK, total);
    for (let i = processed; i < end; i++) {
      const row = rows[i];
      const f = row.first_name || row.firstName || '';
      const l = row.last_name  || row.lastName  || '';
      const d = row.domain || '';
      const c = row.company || '';

      if (!f || !l) {
        _bulkResults.push({ first_name:f, last_name:l, company:c, domain:d,
          email:'—', status:'invalid', confidence:0, pattern:'—' });
        continue;
      }

      const candidates = generateEmailCandidates(f, l, d || 'example.com');
      if (!candidates.length) {
        _bulkResults.push({ first_name:f, last_name:l, company:c, domain:d,
          email:'—', status:'unknown', confidence:0, pattern:'—' });
        continue;
      }
      candidates.forEach(cd => { cd._ver = simulateVerification(cd.email, cd.weight); });
      const best = candidates.reduce((b, cd) =>
        cd._ver.confidence > b._ver.confidence ? cd : b, candidates[0]);

      _bulkResults.push({
        first_name: f, last_name: l, company: c, domain: d,
        email: best.email, status: best._ver.status,
        confidence: best._ver.confidence, pattern: best.pattern
      });
    }
    processed = end;

    const pct = Math.round((processed / total) * 100);
    if (progBar) progBar.style.width = pct + '%';
    if (progTxt) progTxt.textContent = `${processed} / ${total}`;
    if (progPct) progPct.textContent = pct + '%';

    if (processed < total) {
      setTimeout(processChunk, 20);
    } else {
      renderBulkResults(_bulkResults);
      procArea.hidden  = false;
      resultArea.hidden= false;
      resultArea.scrollIntoView({ behavior:'smooth' });
      Toast.show(`Processed ${total} records`, 'success');
    }
  }
  setTimeout(processChunk, 100);
}

function renderBulkResults(results) {
  const resultArea = document.getElementById('bulk-results');
  if (!resultArea) return;

  const matches  = results.filter(r => r.status !== 'invalid' && r.email !== '—').length;
  const noMatch  = results.length - matches;

  const summaryHTML = `
    <div class="bulk-summary">
      <div class="stat-mini"><span class="stat-mini__val">${results.length.toLocaleString()}</span><span class="stat-mini__lbl">Records</span></div>
      <div class="stat-mini stat-mini--green"><span class="stat-mini__val">${matches.toLocaleString()}</span><span class="stat-mini__lbl">Matches</span></div>
      <div class="stat-mini stat-mini--red"><span class="stat-mini__val">${noMatch.toLocaleString()}</span><span class="stat-mini__lbl">No Match</span></div>
    </div>`;

  const tableRows = results.map(r => `
    <tr>
      <td data-label="First Name">${r.first_name}</td>
      <td data-label="Last Name">${r.last_name}</td>
      <td data-label="Company">${r.company || '—'}</td>
      <td data-label="Email"><span class="email-cell">${r.email}</span></td>
      <td data-label="Status"><span class="badge ${statusClass(r.status)}">${statusLabel(r.status)}</span></td>
      <td data-label="Confidence">${r.confidence > 0 ? r.confidence + '%' : '—'}</td>
    </tr>`).join('');

  resultArea.innerHTML = `
    <div class="bulk-result-header">
      <h3>Results</h3>
      <button id="bulk-export-btn" class="btn btn--primary btn--sm">
        <i data-lucide="download"></i> Download CSV
      </button>
    </div>
    ${summaryHTML}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>First Name</th><th>Last Name</th><th>Company</th>
            <th>Email</th><th>Status</th><th>Confidence</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;

  if (window.lucide) lucide.createIcons({ nodes: [resultArea] });
}

function exportBulkResults() {
  if (!_bulkResults.length) { Toast.show('No results to export', 'warning'); return; }
  exportCSV(_bulkResults, 'emailfinder-bulk-results.csv');
}

document.addEventListener('DOMContentLoaded', initBulkFinderPage);
