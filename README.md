# Mail-Mining

A prospecting workspace with two tools behind one account system.

| App | Entry point | What it does |
|---|---|---|
| **EmailFinder** | `dashboard.html` | Builds and screens professional email addresses — single lookup, bulk CSV, verification, history |
| **Web Data Mining** | `app.html` | The original scraper workspace: extracts company details, contacts and page content from a list of websites |

Both share the same login, credits, package and admin system.

---

## EmailFinder

The app users land on after signing in.

| Page | File | Purpose |
|---|---|---|
| Dashboard | `dashboard.html` | Activity, credit usage, recent searches |
| Email Finder | `finder.html` | 12 address patterns generated and ranked for one person |
| Bulk Finder | `bulk-finder.html` | CSV upload, processed locally, results exported as CSV |
| Verification | `verification.html` | Screens a single address against every signal |
| History | `history.html` | Every search, stored in the browser, searchable and exportable |
| Settings | `settings.html` | Account details, preferences, appearance, local data |
| API Docs | `api.html` | The planned REST interface (not live yet) |
| Pricing | `pricing.html` | Plan comparison; sends a real upgrade request to the administrator |

### What the engine actually checks

Address scoring runs entirely in the browser. It uses signals that can honestly
be evaluated client-side:

- **Syntax** — RFC-shaped local part and domain
- **Domain format** — well-formed, resolvable-looking hostname
- **Disposable domain** — matched against a throwaway-provider list
- **Role address** — `info@`, `support@`, `sales@`… flagged as shared inboxes
- **Free provider** — Gmail/Outlook/etc. flagged as personal, not company, mailboxes
- **Pattern frequency** — how often each pattern is used for business mail

**Mailbox-level checks are not performed.** MX lookups, SMTP probes and
catch-all detection need a mail server, so the UI reports them as *not checked*
rather than guessing. A high confidence score is a strong prediction, never a
delivery guarantee.

Credits are charged through the existing API: one per finder search, one per
verification, one per row of a bulk run.

---

## System (unchanged)

- `login.html` — sign in / register / password reset
- `admin.html`, `admin/` — administrator console
- `dev/API/` — Express API: auth, credits, packages, upgrade requests, admin
- `dev/scraper/` — scraping server used by the Web Data Mining workspace

The frontend apps consume these; none of it was modified to add EmailFinder.

---

## Assets

```
assets/
  ef-app.css        EmailFinder design system (sidebar shell, dark + light)
  ef/core.js        session, credits, theme, sidebar, toast, modal, history
  ef/data.js        domain lists, patterns, plans
  ef/engine.js      pattern generation + confidence scoring + finder page
  ef/bulk.js        CSV processing
  ef/verify.js      single-address screening
  ef/history.js     history page
  ef/dashboard.js   dashboard stats
  app-ui.css        Web Data Mining workspace styles
  app.js            Web Data Mining engine (built from dev/app.src.js)
  styles.css        login and legal pages
```

`Demo design/` holds the original design reference the EmailFinder UI was built from.

---

## Running locally

Serve the repository root over HTTP (the pages use `localStorage` and `fetch`,
so `file://` will not work):

```bash
npx http-server -p 8080 .
```

Point `assets/config.js` at the API host, then start the backend:

```bash
cd dev/API && npm install && npm start
```

## Technology

HTML5, CSS custom properties, vanilla ES6+ JavaScript. Lucide icons and Google
Fonts via CDN. No build step for the EmailFinder app; the mining workspace
bundle is produced with `npm run build` in `dev/`.
