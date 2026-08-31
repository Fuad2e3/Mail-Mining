// ============================================================================
// core.js — shared runtime for the EmailFinder app
//
// Everything that talks to the existing backend lives here: the auth guard,
// the account/credit sync against /api/auth/check-status, credit deduction
// against /api/auth/deduct-credits, and the package upgrade request. The
// login/register/admin system and the API itself are untouched — this file
// only consumes them.
// ============================================================================

'use strict';

const EF = (() => {

  // ── Storage keys (shared with the rest of the site) ──────────────────────
  const KEYS = {
    auth:    'lgs_auth',
    session: 'lgs_session',
    token:   'lgs_token',
    theme:   'lgs_theme',
    history: 'lgs_ef_history',
    prefs:   'lgs_ef_prefs'
  };

  // ── API host resolution (same rules as the rest of the site) ─────────────
  function getApiHost() {
    const custom = (localStorage.getItem('lgs_api_url') || '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
    if (custom) return custom;

    const globalCfg = (window.LGS_CONFIG && window.LGS_CONFIG.API_URL)
      ? window.LGS_CONFIG.API_URL.trim().replace(/\/+$/, '').replace(/\/api$/, '')
      : '';
    if (globalCfg) return globalCfg;

    const h = window.location.hostname;
    const isLocal = h === 'localhost' || h === '127.0.0.1';
    const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(h);
    if (isLocal) return 'http://localhost:5000';
    if (isIp) return `http://${h}:5000`;
    if (h.endsWith('github.io') || h.endsWith('netlify.app') || h.endsWith('vercel.app')) {
      return (window.LGS_CONFIG && window.LGS_CONFIG.API_URL)
        ? window.LGS_CONFIG.API_URL.trim().replace(/\/+$/, '')
        : 'http://localhost:5000';
    }
    return (window.location.protocol === 'file:' || !window.location.origin || window.location.origin === 'null')
      ? ((window.LGS_CONFIG && window.LGS_CONFIG.API_URL) || 'http://localhost:5000')
      : window.location.origin;
  }
  const authApi = () => `${getApiHost()}/api/auth`;

  // ── Session ──────────────────────────────────────────────────────────────
  function isAuthed() {
    return localStorage.getItem(KEYS.auth) === 'true' || sessionStorage.getItem(KEYS.auth) === 'true';
  }

  function getSession() {
    const raw = localStorage.getItem(KEYS.session) || sessionStorage.getItem(KEYS.session);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function clearSession() {
    [localStorage, sessionStorage].forEach(store => {
      store.removeItem(KEYS.auth);
      store.removeItem(KEYS.session);
      store.removeItem(KEYS.token);
    });
  }

  function logout(confirmFirst = true) {
    if (confirmFirst && !confirm('Are you sure you want to logout?')) return;
    clearSession();
    window.location.href = 'login.html';
  }

  function requireAuth() {
    if (!isAuthed()) { window.location.href = 'login.html'; return false; }
    return true;
  }

  // ── Account state (filled by syncAccount) ────────────────────────────────
  const account = {
    id: null, name: 'User', email: '', package: 'free',
    dailyCredits: 50, usedCreditsToday: 0, remainingCredits: 50
  };

  function initials(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'U';
    return parts.map(p => p[0]).join('').substring(0, 2).toUpperCase();
  }

  function renderAccount() {
    const avatar = document.getElementById('ef-avatar');
    if (avatar) avatar.textContent = initials(account.name);

    const nameEl = document.getElementById('ef-user-name');
    if (nameEl) nameEl.textContent = account.name || 'User';

    const planEl = document.getElementById('ef-user-plan');
    if (planEl) {
      const pkg = (account.package || 'free').toLowerCase();
      planEl.textContent = pkg === 'enterprise' ? 'Enterprise Plan' : pkg === 'pro' ? 'Pro Plan' : 'Free Plan';
      planEl.className = 'plan-badge' + (pkg === 'pro' ? ' plan-badge--pro' : pkg === 'enterprise' ? ' plan-badge--enterprise' : '');
    }

    renderCredits();
  }

  function renderCredits() {
    const total = Math.max(1, parseInt(account.dailyCredits, 10) || 50);
    const left = Math.max(0, parseInt(account.remainingCredits, 10) || 0);
    const pct = Math.min(100, Math.round((left / total) * 100));

    const label = document.getElementById('ef-credit-label');
    if (label) label.textContent = `${left.toLocaleString()} / ${total.toLocaleString()} credits`;

    const pctEl = document.getElementById('ef-credit-pct');
    if (pctEl) pctEl.textContent = `${pct}%`;

    const fill = document.getElementById('ef-credit-fill');
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.className = 'credit-box__fill' + (pct < 20 ? ' credit-box__fill--crit' : pct < 50 ? ' credit-box__fill--low' : '');
    }

    document.querySelectorAll('[data-ef-credits]').forEach(el => {
      el.textContent = left.toLocaleString();
    });
  }

  // Pulls live user state, credits and the system announcement. Also enforces
  // the ban/delete states exactly like the rest of the site does.
  async function syncAccount() {
    const session = getSession();
    if (!session) return null;

    account.id = session.id;
    account.email = session.email || '';
    account.name = session.fullname || session.name || 'User';
    renderAccount();

    try {
      const res = await fetch(`${authApi()}/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email, id: session.id })
      });
      const data = await res.json();

      if (data && (data.status === 'banned' || data.status === 'deleted' || data.status === 'inactive')) {
        clearSession();
        alert(data.message || 'Your account has been banned or removed by an administrator.');
        window.location.href = 'login.html';
        return null;
      }

      if (data && data.user) {
        account.id = data.user.id != null ? data.user.id : account.id;
        account.name = data.user.name || account.name;
        account.email = data.user.email || account.email;
        account.package = data.user.package || 'free';
        account.dailyCredits = data.user.dailyCredits != null ? data.user.dailyCredits : 50;
        account.usedCreditsToday = data.user.usedCreditsToday || 0;
        account.remainingCredits = data.user.remainingCredits != null ? data.user.remainingCredits : 50;
        renderAccount();
        // Pages render account-dependent bits off this event rather than polling.
        document.dispatchEvent(new CustomEvent('ef:account', { detail: account }));
      }

      if (data && data.announcement) showAnnouncement(data.announcement);
      return data;
    } catch (err) {
      console.error('[EF] Account sync failed:', err);
      return null;
    }
  }

  function showAnnouncement(text) {
    const banner = document.getElementById('ef-announcement');
    const textEl = document.getElementById('ef-announcement-text');
    if (!banner || !textEl) return;
    textEl.textContent = text;
    banner.classList.add('is-visible');
  }

  // Charges the user's daily pool. Resolves to { ok, message }. A failure —
  // including a network failure — must stop the operation, same as the
  // existing mining workspace does.
  async function spendCredits(amount = 1, label = 'search') {
    const session = getSession();
    if (!session || (!session.email && !session.id)) return { ok: true, skipped: true };

    const count = Math.max(1, parseInt(amount, 10) || 1);
    try {
      const res = await fetch(`${authApi()}/deduct-credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.email, id: session.id, amount: count, count })
      });
      const data = await res.json();

      if (!res.ok || (data && data.success === false)) {
        return { ok: false, message: (data && data.message) || `Not enough credits for this ${label}.` };
      }

      if (data && data.success) {
        account.remainingCredits = data.remainingCredits;
        account.usedCreditsToday = data.usedCreditsToday;
        renderCredits();
      }
      return { ok: true, remaining: data && data.remainingCredits };
    } catch (err) {
      console.error('[EF] Credit deduction failed:', err);
      return { ok: false, message: 'Could not reach the credit server. Please try again.' };
    }
  }

  async function requestUpgrade(plan) {
    const session = getSession();
    if (!session) return { success: false, message: 'You are not signed in.' };
    try {
      const res = await fetch(`${authApi()}/upgrade-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: session.id, email: session.email, requestedPackage: plan })
      });
      return await res.json();
    } catch {
      return { success: false, message: 'Network error submitting upgrade request.' };
    }
  }

  // ── Theme ────────────────────────────────────────────────────────────────
  const Theme = {
    get() {
      return localStorage.getItem(KEYS.theme)
        || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    },
    set(theme) {
      localStorage.setItem(KEYS.theme, theme);
      document.documentElement.setAttribute('data-theme', theme);
      document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        btn.setAttribute('aria-pressed', String(theme === 'dark'));
        btn.innerHTML = `<i data-lucide="${theme === 'dark' ? 'moon' : 'sun'}"></i>`;
      });
      icons();
    },
    toggle() { Theme.set(Theme.get() === 'dark' ? 'light' : 'dark'); },
    init() { Theme.set(Theme.get()); }
  };

  // ── Icons ────────────────────────────────────────────────────────────────
  function icons(scope) {
    if (!window.lucide) return;
    try {
      if (scope) lucide.createIcons({ nodes: [scope] });
      else lucide.createIcons();
    } catch { /* icon library not ready — text labels still render */ }
  }

  // ── Toast ────────────────────────────────────────────────────────────────
  const Toast = (() => {
    let container;
    function ensure() {
      if (!container || !document.body.contains(container)) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
      }
      return container;
    }
    function dismiss(toast) {
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', () => toast.remove(), { once: true });
      setTimeout(() => toast.remove(), 500);
    }
    function show(message, type = 'success', duration = 3500) {
      const c = ensure();
      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      const iconMap = { success: 'check-circle', error: 'x-circle', warning: 'alert-triangle', info: 'info' };
      toast.innerHTML =
        `<i data-lucide="${iconMap[type] || 'info'}" class="toast__icon"></i>` +
        `<span class="toast__msg"></span>` +
        `<button class="toast__close" aria-label="Dismiss"><i data-lucide="x"></i></button>`;
      // Message text may come from an API response, so never inject it as HTML.
      toast.querySelector('.toast__msg').textContent = message;
      toast.querySelector('.toast__close').addEventListener('click', () => dismiss(toast));
      c.appendChild(toast);
      icons(toast);
      requestAnimationFrame(() => toast.classList.add('toast--visible'));
      setTimeout(() => dismiss(toast), duration);
      return toast;
    }
    return { show };
  })();

  // ── Modal ────────────────────────────────────────────────────────────────
  const Modal = {
    open(id) {
      const m = document.getElementById(id);
      if (!m) return;
      m.removeAttribute('hidden');
      document.body.classList.add('modal-open');
    },
    close(id) {
      const m = document.getElementById(id);
      if (!m) return;
      m.setAttribute('hidden', '');
      document.body.classList.remove('modal-open');
    },
    init() {
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.modal:not([hidden])').forEach(m => Modal.close(m.id));
      });
      document.addEventListener('click', e => {
        if (e.target.classList && e.target.classList.contains('modal')) Modal.close(e.target.id);
        const closer = e.target.closest('[data-modal-close]');
        if (closer) Modal.close(closer.dataset.modalClose);
        const opener = e.target.closest('[data-modal-open]');
        if (opener) Modal.open(opener.dataset.modalOpen);
      });
    }
  };

  // ── Sidebar (off-canvas on small screens) ────────────────────────────────
  const Sidebar = {
    init() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      if (!sidebar) return;

      document.querySelectorAll('[data-sidebar-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
          const open = sidebar.classList.toggle('sidebar--open');
          if (overlay) overlay.classList.toggle('active', open);
          btn.setAttribute('aria-expanded', String(open));
        });
      });
      if (overlay) overlay.addEventListener('click', () => {
        sidebar.classList.remove('sidebar--open');
        overlay.classList.remove('active');
      });

      const page = (location.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
      sidebar.querySelectorAll('.nav-link').forEach(link => {
        const href = (link.getAttribute('href') || '').split('/').pop().toLowerCase();
        if (href && href === page) link.classList.add('active');
      });
    }
  };

  // ── Clipboard ────────────────────────────────────────────────────────────
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      Toast.show('Copied to clipboard', 'success');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* clipboard unavailable */ }
      document.body.removeChild(ta);
      Toast.show('Copied to clipboard', 'success');
    }
  }

  // ── CSV ──────────────────────────────────────────────────────────────────
  function exportCSV(rows, filename = 'emailfinder-results.csv') {
    if (!rows || !rows.length) { Toast.show('No data to export', 'warning'); return; }
    const headers = Object.keys(rows[0]);
    const lines = [
      headers.join(','),
      ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Toast.show('CSV downloaded', 'success');
  }

  function parseCSV(text) {
    const lines = String(text || '').trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    return lines.slice(1).map(line => {
      const vals = line.match(/(?:"[^"]*"|[^,])+/g) || [];
      const obj = {};
      headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, '').trim(); });
      return obj;
    });
  }

  // ── Search history (per browser) ─────────────────────────────────────────
  const History = {
    MAX: 200,
    load() {
      try { return JSON.parse(localStorage.getItem(KEYS.history)) || []; } catch { return []; }
    },
    save(arr) { localStorage.setItem(KEYS.history, JSON.stringify(arr.slice(0, History.MAX))); },
    add(entry) {
      if (Prefs.get('history', true) === false) return;
      const arr = History.load();
      arr.unshift({ ...entry, id: Date.now(), date: new Date().toISOString() });
      History.save(arr);
    },
    clear() { localStorage.removeItem(KEYS.history); }
  };

  // ── Preferences ──────────────────────────────────────────────────────────
  const Prefs = {
    all() {
      try { return JSON.parse(localStorage.getItem(KEYS.prefs)) || {}; } catch { return {}; }
    },
    get(key, fallback) {
      const p = Prefs.all();
      return p[key] === undefined ? fallback : p[key];
    },
    set(key, value) {
      const p = Prefs.all();
      p[key] = value;
      localStorage.setItem(KEYS.prefs, JSON.stringify(p));
    },
    reset() { localStorage.removeItem(KEYS.prefs); }
  };

  // ── Result presentation helpers ──────────────────────────────────────────
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
    const map = { valid: 'badge--valid', invalid: 'badge--invalid', unknown: 'badge--unknown', accept_all: 'badge--accept-all' };
    return map[(status || '').toLowerCase()] || 'badge--unknown';
  }
  function statusLabel(status) {
    const map = { valid: 'Valid', invalid: 'Invalid', unknown: 'Unknown', accept_all: 'Accept-All' };
    return map[(status || '').toLowerCase()] || 'Unknown';
  }
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  function init() {
    Theme.init();
    Modal.init();
    Sidebar.init();
    icons();

    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => Theme.toggle());
    });

    document.querySelectorAll('[data-ef-logout]').forEach(btn => {
      btn.addEventListener('click', () => logout());
    });

    const announceClose = document.getElementById('ef-announcement-close');
    if (announceClose) {
      announceClose.addEventListener('click', () => {
        document.getElementById('ef-announcement').classList.remove('is-visible');
      });
    }

    if (isAuthed()) syncAccount();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    KEYS, getApiHost, isAuthed, getSession, requireAuth, logout,
    account, syncAccount, renderCredits, spendCredits, requestUpgrade,
    Theme, Toast, Modal, Sidebar, History, Prefs,
    icons, copyToClipboard, exportCSV, parseCSV,
    confidenceLabel, confidenceClass, statusClass, statusLabel, escapeHtml
  };
})();

// Convenience globals used inline by the pages
window.EF = EF;
window.Toast = EF.Toast;
window.Modal = EF.Modal;
window.copyToClipboard = EF.copyToClipboard;
