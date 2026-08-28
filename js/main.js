// ============================================================
// main.js — Global utilities, theme, sidebar, toast, modals
// ============================================================

'use strict';

// ── Theme ──────────────────────────────────────────────────
const ThemeManager = (() => {
  const KEY = 'ef_theme';
  function get() { return localStorage.getItem(KEY) || 'dark'; }
  function set(t) {
    localStorage.setItem(KEY, t);
    document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.setAttribute('aria-pressed', t === 'dark');
    });
  }
  function init() { set(get()); }
  function toggle() { set(get() === 'dark' ? 'light' : 'dark'); }
  return { init, toggle, get, set };
})();

// ── Toast Notifications ────────────────────────────────────
const Toast = (() => {
  let container;
  function ensureContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  }

  function show(message, type = 'success', duration = 3500) {
    const c = ensureContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icons = { success:'check-circle', error:'x-circle', warning:'alert-triangle', info:'info' };
    toast.innerHTML = `
      <i data-lucide="${icons[type] || 'info'}" class="toast__icon"></i>
      <span class="toast__msg">${message}</span>
      <button class="toast__close" aria-label="Dismiss"><i data-lucide="x"></i></button>
    `;
    toast.querySelector('.toast__close').addEventListener('click', () => dismiss(toast));
    c.appendChild(toast);
    if (window.lucide) lucide.createIcons({ nodes: [toast] });
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => dismiss(toast), duration);
    return toast;
  }

  function dismiss(toast) {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }

  return { show };
})();

// ── Modal ──────────────────────────────────────────────────
const Modal = (() => {
  function open(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.removeAttribute('hidden');
    m.setAttribute('aria-modal', 'true');
    document.body.classList.add('modal-open');
    const focusable = m.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) focusable[0].focus();
  }
  function close(id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.setAttribute('hidden', '');
    m.removeAttribute('aria-modal');
    document.body.classList.remove('modal-open');
  }
  function init() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal:not([hidden])').forEach(m => close(m.id));
      }
    });
    document.addEventListener('click', e => {
      if (e.target.classList.contains('modal')) close(e.target.id);
      if (e.target.dataset.modalClose) close(e.target.dataset.modalClose);
      if (e.target.dataset.modalOpen)  open(e.target.dataset.modalOpen);
    });
  }
  return { open, close, init };
})();

// ── Sidebar (dashboard pages) ──────────────────────────────
const Sidebar = (() => {
  function init() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    const toggles  = document.querySelectorAll('[data-sidebar-toggle]');
    if (!sidebar) return;

    toggles.forEach(btn => btn.addEventListener('click', () => {
      const open = sidebar.classList.toggle('sidebar--open');
      if (overlay) overlay.classList.toggle('active', open);
      btn.setAttribute('aria-expanded', open);
    }));
    if (overlay) overlay.addEventListener('click', () => {
      sidebar.classList.remove('sidebar--open');
      overlay.classList.remove('active');
    });

    // Mark active link
    const path = location.pathname.split('/').pop() || 'dashboard.html';
    sidebar.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href.includes(path)) link.classList.add('active');
    });
  }
  return { init };
})();

// ── Clipboard ──────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    Toast.show('Email copied to clipboard', 'success');
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    Toast.show('Email copied to clipboard', 'success');
  }
}

// ── CSV helpers ────────────────────────────────────────────
function exportCSV(rows, filename = 'emailfinder-results.csv') {
  if (!rows.length) { Toast.show('No data to export', 'warning'); return; }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g,'""')}"`).join(','))
  ];
  const blob = new Blob([lines.join('\n')], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  Toast.show('CSV downloaded', 'success');
}

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.match(/(?:"[^"]*"|[^,])+/g) || [];
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g,'').trim(); });
    return obj;
  });
}

// ── History (localStorage) ─────────────────────────────────
const History = (() => {
  const KEY = 'ef_history';
  const MAX = 100;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function save(arr) {
    localStorage.setItem(KEY, JSON.stringify(arr.slice(0, MAX)));
  }
  function add(entry) {
    const arr = load();
    arr.unshift({ ...entry, id: Date.now(), date: new Date().toISOString() });
    save(arr);
  }
  function clear() { localStorage.removeItem(KEY); }
  return { load, add, clear };
})();

// ── Confidence helpers ─────────────────────────────────────
function confidenceLabel(score) {
  if (score >= 90) return 'Very High';
  if (score >= 75) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}
function confidenceClass(score) {
  if (score >= 90) return 'conf--very-high';
  if (score >= 75) return 'conf--high';
  if (score >= 50) return 'conf--medium';
  return 'conf--low';
}
function statusClass(status) {
  const map = { valid:'badge--valid', invalid:'badge--invalid', unknown:'badge--unknown', accept_all:'badge--accept-all' };
  return map[(status||'').toLowerCase()] || 'badge--unknown';
}
function statusLabel(status) {
  const map = { valid:'Valid', invalid:'Invalid', unknown:'Unknown', accept_all:'Accept-All' };
  return map[(status||'').toLowerCase()] || 'Unknown';
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  Modal.init();
  Sidebar.init();
  if (window.lucide) lucide.createIcons();

  // Theme toggle
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ThemeManager.toggle();
      if (window.lucide) lucide.createIcons();
    });
  });

  // Mobile nav toggle (landing pages)
  const navToggle = document.getElementById('nav-toggle');
  const navMenu   = document.getElementById('nav-menu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const open = navMenu.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open);
    });
  }
});
