# Margel 360° Event Management Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an internal admin platform for Margel360 with a login-protected enquiry inbox and calendar, wired to the existing website reservation form via Supabase, with Resend email notifications on each new enquiry.

**Architecture:** The existing `reservation.js` submit handler posts a rich JSON payload to Supabase on form completion. A Supabase database webhook triggers an Edge Function that emails the team via Resend. The admin panel is plain HTML/CSS/JS inside `website/admin/`, protected by Supabase Auth session checks on every page load.

**Tech Stack:** Vanilla HTML/CSS/JS, Supabase (Auth + PostgreSQL + Edge Functions), Resend API, Netlify hosting

> **Note on testing:** This project has no build step or JS test framework. Each task includes browser verification steps in place of automated tests — open the page, check the behaviour described, confirm it works as specified.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `website/admin/login.html` | Create | Login page UI |
| `website/admin/dashboard.html` | Create | Enquiry inbox UI |
| `website/admin/calendar.html` | Create | Occupied dates calendar UI |
| `website/admin/css/admin.css` | Create | All admin panel styles |
| `website/admin/js/supabase-client.js` | Create | Supabase client singleton |
| `website/admin/js/auth.js` | Create | Session guard + logout |
| `website/admin/js/dashboard.js` | Create | Fetch + render enquiries |
| `website/admin/js/calendar.js` | Create | Fetch + render + toggle calendar dates |
| `website/js/reservation.js` | Modify | Add Supabase submit in `setupSubmit()` |
| `website/reservation.html` | Modify | Add Supabase CDN script tag |
| `supabase/functions/notify-enquiry/index.ts` | Create | Edge Function: send Resend email on INSERT |

---

## Task 1: Supabase Project Setup

**Files:** None (done in Supabase dashboard)

- [ ] **Step 1: Create a new Supabase project**

  Go to [supabase.com](https://supabase.com) → New Project → name it `margel360` → choose a strong database password → save password somewhere safe → wait for project to provision.

- [ ] **Step 2: Run the schema SQL**

  In Supabase dashboard → SQL Editor → New query → paste and run:

  ```sql
  -- Enquiries table (receives form submissions)
  create table enquiries (
    id uuid default gen_random_uuid() primary key,
    full_name text not null,
    email text not null,
    phone text not null,
    event_type text not null,
    event_id text not null,
    preferred_date text not null,
    time_of_day text not null default 'day',
    guests integer,
    addons jsonb default '[]',
    drinks jsonb default '[]',
    payment_method text default 'cash',
    notes text,
    created_at timestamptz default now()
  );

  -- Occupied dates table (managed by admin team)
  create table occupied_dates (
    id uuid default gen_random_uuid() primary key,
    date date not null unique,
    marked_at timestamptz default now()
  );

  -- Enable Row Level Security
  alter table enquiries enable row level security;
  alter table occupied_dates enable row level security;

  -- enquiries: public (anon) can INSERT, authenticated team can SELECT
  create policy "anon_insert_enquiries"
    on enquiries for insert to anon with check (true);

  create policy "auth_read_enquiries"
    on enquiries for select to authenticated using (true);

  -- occupied_dates: only authenticated team can read/write/delete
  create policy "auth_select_occupied_dates"
    on occupied_dates for select to authenticated using (true);

  create policy "auth_insert_occupied_dates"
    on occupied_dates for insert to authenticated with check (true);

  create policy "auth_delete_occupied_dates"
    on occupied_dates for delete to authenticated using (true);
  ```

- [ ] **Step 3: Copy your project credentials**

  In Supabase dashboard → Project Settings → API:
  - Copy **Project URL** (looks like `https://abcdefgh.supabase.co`)
  - Copy **anon / public** key (long JWT string)

  Keep these — you'll paste them into `supabase-client.js` in Task 4.

- [ ] **Step 4: Verify tables exist**

  Supabase dashboard → Table Editor → confirm `enquiries` and `occupied_dates` tables appear with the correct columns.

---

## Task 2: Create Team Login Accounts

**Files:** None (done in Supabase dashboard)

- [ ] **Step 1: Create accounts for each team member**

  Supabase dashboard → Authentication → Users → Invite user → enter each team member's email address. They will receive an email to set their password.

  Repeat for each team member who needs access.

- [ ] **Step 2: Verify accounts appear**

  Authentication → Users → confirm the invited accounts are listed.

---

## Task 3: Admin Panel File Skeleton

**Files:**
- Create: `website/admin/login.html`
- Create: `website/admin/dashboard.html`
- Create: `website/admin/calendar.html`
- Create: `website/admin/css/admin.css` (empty for now)
- Create: `website/admin/js/supabase-client.js` (empty for now)
- Create: `website/admin/js/auth.js` (empty for now)
- Create: `website/admin/js/dashboard.js` (empty for now)
- Create: `website/admin/js/calendar.js` (empty for now)

- [ ] **Step 1: Create the folder structure**

  ```bash
  mkdir -p Clients/Margel360/website/admin/css
  mkdir -p Clients/Margel360/website/admin/js
  ```

- [ ] **Step 2: Create `website/admin/login.html`**

  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login — Margel 360° Admin</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/admin.css">
  </head>
  <body class="login-page">
    <div class="login-card">
      <div class="login-logo">МАРГЕЛ <span>360°</span></div>
      <h1 class="login-title">Admin Panel</h1>
      <form id="login-form" novalidate>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" autocomplete="email" required>
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" autocomplete="current-password" required>
        </div>
        <p class="login-error" id="login-error" role="alert" style="display:none"></p>
        <button type="submit" class="btn btn-primary btn-full" id="login-btn">Sign In</button>
      </form>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="js/supabase-client.js"></script>
    <script>
      // Redirect if already logged in
      db.auth.getSession().then(({ data: { session } }) => {
        if (session) window.location.href = 'dashboard.html';
      });

      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('login-btn');
        const errEl = document.getElementById('login-error');
        btn.disabled = true;
        btn.textContent = 'Signing in…';
        errEl.style.display = 'none';

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) {
          errEl.textContent = 'Invalid email or password. Please try again.';
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Sign In';
        } else {
          window.location.href = 'dashboard.html';
        }
      });
    </script>
  </body>
  </html>
  ```

- [ ] **Step 3: Create `website/admin/dashboard.html`**

  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enquiries — Margel 360° Admin</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/admin.css">
  </head>
  <body>
    <header class="admin-header">
      <a href="dashboard.html" class="admin-logo">МАРГЕЛ <span>360°</span></a>
      <nav class="admin-nav">
        <a href="dashboard.html" class="active">Enquiries</a>
        <a href="calendar.html">Calendar</a>
      </nav>
      <button class="btn btn-outline btn-sm" id="logout-btn">Logout</button>
    </header>

    <main class="admin-main">
      <div class="admin-container">
        <h1 class="page-title">Enquiries</h1>
        <div id="loading" class="loading-state">Loading enquiries…</div>
        <div id="enquiries-wrap" style="display:none">
          <table class="enquiries-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Event</th>
                <th>Date</th>
                <th>Received</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="enquiries-body"></tbody>
          </table>
        </div>
      </div>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="js/supabase-client.js"></script>
    <script src="js/auth.js"></script>
    <script src="js/dashboard.js"></script>
  </body>
  </html>
  ```

- [ ] **Step 4: Create `website/admin/calendar.html`**

  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Calendar — Margel 360° Admin</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="css/admin.css">
  </head>
  <body>
    <header class="admin-header">
      <a href="dashboard.html" class="admin-logo">МАРГЕЛ <span>360°</span></a>
      <nav class="admin-nav">
        <a href="dashboard.html">Enquiries</a>
        <a href="calendar.html" class="active">Calendar</a>
      </nav>
      <button class="btn btn-outline btn-sm" id="logout-btn">Logout</button>
    </header>

    <main class="admin-main">
      <div class="admin-container">
        <h1 class="page-title">Occupied Dates</h1>
        <p class="page-sub">Click a date to mark it as occupied (red). Click again to unmark.</p>
        <div class="calendar-controls">
          <button class="btn btn-outline btn-sm" id="prev-month">← Prev</button>
          <h2 id="calendar-month" class="cal-month-label"></h2>
          <button class="btn btn-outline btn-sm" id="next-month">Next →</button>
        </div>
        <div class="calendar-grid" id="calendar-grid"></div>
        <div class="cal-legend">
          <span class="legend-dot occupied"></span> Occupied
          <span class="legend-dot available"></span> Available
        </div>
      </div>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="js/supabase-client.js"></script>
    <script src="js/auth.js"></script>
    <script src="js/calendar.js"></script>
  </body>
  </html>
  ```

- [ ] **Step 5: Create empty placeholder files**

  Create these as empty files for now (content added in later tasks):
  - `website/admin/css/admin.css`
  - `website/admin/js/supabase-client.js`
  - `website/admin/js/auth.js`
  - `website/admin/js/dashboard.js`
  - `website/admin/js/calendar.js`

- [ ] **Step 6: Commit**

  ```bash
  git add Clients/Margel360/website/admin/
  git commit -m "feat: scaffold admin panel HTML pages and folder structure"
  ```

---

## Task 4: Supabase Client JS

**Files:**
- Write: `website/admin/js/supabase-client.js`

- [ ] **Step 1: Write `supabase-client.js`**

  Replace `YOUR_PROJECT_URL` and `YOUR_ANON_KEY` with the values you copied in Task 1 Step 3.

  ```javascript
  // Supabase project credentials
  // The anon key is safe to expose client-side — Row Level Security controls data access.
  const SUPABASE_URL = 'YOUR_PROJECT_URL';
  const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

  const { createClient } = supabase;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  ```

- [ ] **Step 2: Verify in browser**

  Open `website/admin/login.html` in a browser (you can use VS Code Live Server or drag to browser). Open DevTools console. No errors should appear. If you see `supabase is not defined`, check that the CDN script tag loads before `supabase-client.js` in the HTML.

- [ ] **Step 3: Commit**

  ```bash
  git add Clients/Margel360/website/admin/js/supabase-client.js
  git commit -m "feat: add Supabase client initialisation"
  ```

---

## Task 5: Auth JS (Session Guard + Logout)

**Files:**
- Write: `website/admin/js/auth.js`

- [ ] **Step 1: Write `auth.js`**

  ```javascript
  // requireAuth: call at top of each protected page.
  // Redirects to login if no active session. Returns session if valid.
  async function requireAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return null;
    }
    return session;
  }

  // Wire logout button on any page that includes this script
  document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await db.auth.signOut();
        window.location.href = 'login.html';
      });
    }
  });
  ```

- [ ] **Step 2: Verify login flow in browser**

  Open `website/admin/dashboard.html` directly. You should be immediately redirected to `login.html` (because there's no active session). Enter a valid team member email + password → you should land on `dashboard.html`. Open `dashboard.html` again → no redirect (session is active). Click Logout → redirected back to `login.html`.

- [ ] **Step 3: Commit**

  ```bash
  git add Clients/Margel360/website/admin/js/auth.js
  git commit -m "feat: add session guard and logout to admin auth"
  ```

---

## Task 6: Admin CSS

**Files:**
- Write: `website/admin/css/admin.css`

- [ ] **Step 1: Write `admin.css`**

  ```css
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0a0a0a;
    --surface: #111111;
    --surface-2: #1a1a1a;
    --border: #2a2a2a;
    --text: #ffffff;
    --text-muted: #888888;
    --accent: #e63030;
    --accent-hover: #cc2a2a;
    --radius: 8px;
    --font: 'Inter', Arial, sans-serif;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 15px;
    line-height: 1.6;
    min-height: 100vh;
  }

  /* ── Login page ── */
  .login-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
  }

  .login-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 48px 40px;
    width: 100%;
    max-width: 400px;
  }

  .login-logo {
    font-size: 1.4rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .login-logo span { color: var(--accent); }

  .login-title {
    font-size: 1rem;
    font-weight: 400;
    color: var(--text-muted);
    margin-bottom: 32px;
  }

  .login-error {
    color: var(--accent);
    font-size: 0.875rem;
    margin-bottom: 12px;
  }

  /* ── Admin header ── */
  .admin-header {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 0 32px;
    height: 60px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .admin-logo {
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    text-decoration: none;
    color: var(--text);
    white-space: nowrap;
  }

  .admin-logo span { color: var(--accent); }

  .admin-nav {
    display: flex;
    gap: 8px;
    flex: 1;
  }

  .admin-nav a {
    text-decoration: none;
    color: var(--text-muted);
    font-size: 0.9rem;
    padding: 6px 14px;
    border-radius: 6px;
    transition: color 0.2s, background 0.2s;
  }

  .admin-nav a:hover { color: var(--text); background: var(--surface-2); }
  .admin-nav a.active { color: var(--text); font-weight: 600; }

  /* ── Main content ── */
  .admin-main { padding: 40px 32px; }

  .admin-container { max-width: 1100px; margin: 0 auto; }

  .page-title {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .page-sub {
    color: var(--text-muted);
    margin-bottom: 32px;
    font-size: 0.9rem;
  }

  /* ── Buttons ── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 6px;
    font-family: var(--font);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.2s, opacity 0.2s;
    text-decoration: none;
  }

  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover:not(:disabled) { background: var(--accent-hover); }

  .btn-outline { background: transparent; color: var(--text); border: 1px solid var(--border); }
  .btn-outline:hover { background: var(--surface-2); }

  .btn-full { width: 100%; }
  .btn-sm { padding: 6px 14px; font-size: 0.8rem; }

  /* ── Form elements ── */
  .form-group { margin-bottom: 20px; }

  .form-group label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 6px;
  }

  .form-group input {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-family: var(--font);
    font-size: 0.95rem;
    padding: 10px 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .form-group input:focus { border-color: var(--accent); }

  /* ── Loading state ── */
  .loading-state {
    color: var(--text-muted);
    padding: 40px 0;
    text-align: center;
  }

  /* ── Enquiries table ── */
  .enquiries-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .enquiries-table th {
    text-align: left;
    padding: 12px 16px;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }

  .enquiries-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }

  .enquiries-table tbody tr:hover > td { background: var(--surface); }

  .btn-expand {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-family: var(--font);
    font-size: 0.8rem;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }

  .btn-expand:hover { color: var(--text); border-color: var(--text-muted); }

  .detail-row.hidden { display: none; }

  .detail-panel {
    background: var(--surface-2);
    border-radius: var(--radius);
    padding: 20px 24px;
    margin: 4px 0 8px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
    font-size: 0.875rem;
  }

  .detail-section {
    margin-top: 12px;
    font-size: 0.875rem;
  }

  .detail-section ul {
    margin: 6px 0 0 16px;
    color: var(--text-muted);
  }

  .detail-notes {
    margin-top: 12px;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .empty-state {
    text-align: center;
    color: var(--text-muted);
    padding: 60px 0;
  }

  /* ── Calendar ── */
  .calendar-controls {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 24px;
  }

  .cal-month-label {
    font-size: 1.2rem;
    font-weight: 600;
    min-width: 220px;
    text-align: center;
  }

  .calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 6px;
    max-width: 560px;
  }

  .cal-day-label {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--text-muted);
    padding: 8px 0;
  }

  .cal-cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    background: var(--surface);
    border: 1px solid var(--border);
    font-family: var(--font);
    color: var(--text);
    transition: background 0.15s, border-color 0.15s;
  }

  .cal-cell:hover { background: var(--surface-2); border-color: var(--text-muted); }

  .cal-cell.occupied {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .cal-cell.occupied:hover { background: var(--accent-hover); border-color: var(--accent-hover); }

  .cal-cell.empty {
    background: transparent;
    border-color: transparent;
    cursor: default;
  }

  .cal-legend {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-top: 20px;
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .legend-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    margin-right: 6px;
  }

  .legend-dot.occupied { background: var(--accent); }
  .legend-dot.available { background: var(--surface); border: 1px solid var(--border); }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .admin-header { padding: 0 16px; gap: 12px; }
    .admin-main { padding: 24px 16px; }
    .enquiries-table th:nth-child(2),
    .enquiries-table td:nth-child(2),
    .enquiries-table th:nth-child(5),
    .enquiries-table td:nth-child(5) { display: none; }
  }
  ```

- [ ] **Step 2: Verify in browser**

  Open `website/admin/login.html`. Confirm:
  - Dark background (`#0a0a0a`)
  - Centered white card with "МАРГЕЛ 360°" logo (red degree symbol)
  - Email and password inputs render correctly

- [ ] **Step 3: Commit**

  ```bash
  git add Clients/Margel360/website/admin/css/admin.css
  git commit -m "feat: add admin panel CSS — dark theme matching Margel360 brand"
  ```

---

## Task 7: Dashboard JS (Enquiry Inbox)

**Files:**
- Write: `website/admin/js/dashboard.js`

- [ ] **Step 1: Write `dashboard.js`**

  ```javascript
  document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    const loadingEl = document.getElementById('loading');
    const wrapEl = document.getElementById('enquiries-wrap');

    const { data: enquiries, error } = await db
      .from('enquiries')
      .select('*')
      .order('created_at', { ascending: false });

    loadingEl.style.display = 'none';
    wrapEl.style.display = 'block';

    if (error) {
      wrapEl.innerHTML = '<p style="color:#e63030;padding:20px">Failed to load enquiries. Check console.</p>';
      console.error(error);
      return;
    }

    renderEnquiries(enquiries);
  });

  function renderEnquiries(enquiries) {
    const tbody = document.getElementById('enquiries-body');

    if (!enquiries || !enquiries.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No enquiries received yet.</td></tr>';
      return;
    }

    tbody.innerHTML = '';

    enquiries.forEach(e => {
      // Main row
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(e.full_name)}</td>
        <td>${esc(e.phone)}</td>
        <td>${esc(e.event_type)}</td>
        <td>${esc(e.preferred_date)}</td>
        <td>${fmtDate(e.created_at)}</td>
        <td><button class="btn-expand" data-id="${e.id}">View</button></td>
      `;
      tbody.appendChild(tr);

      // Detail row (hidden)
      const detailTr = document.createElement('tr');
      detailTr.className = 'detail-row hidden';
      detailTr.id = `detail-${e.id}`;
      detailTr.innerHTML = `
        <td colspan="6">
          <div class="detail-panel">
            <div class="detail-grid">
              <div><strong>Email:</strong> ${esc(e.email)}</div>
              <div><strong>Guests:</strong> ${e.guests || '—'}</div>
              <div><strong>Time:</strong> ${e.time_of_day === 'day' ? 'Daytime (until 17:30)' : 'Evening (after 19:00)'}</div>
              <div><strong>Payment:</strong> ${esc(e.payment_method)}</div>
            </div>
            ${fmtAddons(e.addons)}
            ${fmtDrinks(e.drinks)}
            ${e.notes ? `<div class="detail-notes"><strong>Notes:</strong> ${esc(e.notes)}</div>` : ''}
          </div>
        </td>
      `;
      tbody.appendChild(detailTr);
    });

    // Toggle expand/collapse
    tbody.addEventListener('click', e => {
      const btn = e.target.closest('.btn-expand');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const detailRow = document.getElementById(`detail-${id}`);
      const isOpen = !detailRow.classList.contains('hidden');

      // Close all open detail rows
      tbody.querySelectorAll('.detail-row').forEach(r => r.classList.add('hidden'));
      tbody.querySelectorAll('.btn-expand').forEach(b => b.textContent = 'View');

      // Open this one if it was closed
      if (!isOpen) {
        detailRow.classList.remove('hidden');
        btn.textContent = 'Close';
      }
    });
  }

  function esc(str) {
    if (str == null) return '—';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function fmtAddons(addons) {
    if (!addons || !addons.length) return '';
    const items = addons.map(a => `<li>${esc(a.name)} — €${(a.price / 1.95583).toFixed(2)}</li>`).join('');
    return `<div class="detail-section"><strong>Add-on services:</strong><ul>${items}</ul></div>`;
  }

  function fmtDrinks(drinks) {
    if (!drinks || !drinks.length) return '';
    const items = drinks.map(d => `<li>${esc(d.name)} × ${d.qty}</li>`).join('');
    return `<div class="detail-section"><strong>Drinks:</strong><ul>${items}</ul></div>`;
  }
  ```

- [ ] **Step 2: Seed a test enquiry in Supabase**

  Supabase dashboard → Table Editor → `enquiries` → Insert row. Fill in:
  - `full_name`: Test User
  - `email`: test@example.com
  - `phone`: 0888123456
  - `event_type`: Corporate Event (4h)
  - `event_id`: corp4
  - `preferred_date`: 15/05/2026
  - `time_of_day`: evening
  - `guests`: 50
  - `addons`: `[{"id":"dj","name":"DJ for 5 hours","price":500}]`
  - `drinks`: `[{"id":"veuve","name":"Veuve Clicquot Brut","qty":2}]`
  - `payment_method`: cash
  - `notes`: Please set up the stage near the window.

- [ ] **Step 3: Verify in browser**

  Log in → open `dashboard.html`. Confirm:
  - The test enquiry row appears with name, phone, event, date, received timestamp
  - Click "View" → detail panel expands showing email, guests, add-on, drink, notes
  - Click "View" again → detail collapses
  - Click a different row's "View" → previous detail closes, new one opens

- [ ] **Step 4: Commit**

  ```bash
  git add Clients/Margel360/website/admin/js/dashboard.js
  git commit -m "feat: add enquiry inbox — fetch and render all submissions with expandable details"
  ```

---

## Task 8: Calendar JS

**Files:**
- Write: `website/admin/js/calendar.js`

- [ ] **Step 1: Write `calendar.js`**

  ```javascript
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth(); // 0-based (0 = January)
  let occupiedDates = new Set();

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await loadOccupiedDates();
    renderCalendar();

    document.getElementById('prev-month').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      renderCalendar();
    });
  });

  async function loadOccupiedDates() {
    const { data, error } = await db.from('occupied_dates').select('date');
    if (error) { console.error('Failed to load occupied dates:', error); return; }
    occupiedDates = new Set(data.map(r => r.date));
  }

  function renderCalendar() {
    document.getElementById('calendar-month').textContent =
      `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    const gridEl = document.getElementById('calendar-grid');
    gridEl.innerHTML = '';

    // Day-of-week labels (Monday first)
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(label => {
      const el = document.createElement('div');
      el.className = 'cal-day-label';
      el.textContent = label;
      gridEl.appendChild(el);
    });

    // How many blank cells before the 1st (Monday = 0, Sunday = 6)
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
    const startOffset = (firstDayOfWeek + 6) % 7;
    for (let i = 0; i < startOffset; i++) {
      const el = document.createElement('div');
      el.className = 'cal-cell empty';
      gridEl.appendChild(el);
    }

    // Day cells
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isOccupied = occupiedDates.has(dateStr);

      const btn = document.createElement('button');
      btn.className = 'cal-cell' + (isOccupied ? ' occupied' : '');
      btn.textContent = d;
      btn.setAttribute('aria-label',
        `${d} ${MONTH_NAMES[currentMonth]} ${currentYear}${isOccupied ? ' — occupied' : ''}`
      );
      btn.addEventListener('click', () => toggleDate(dateStr, btn));
      gridEl.appendChild(btn);
    }
  }

  async function toggleDate(dateStr, btn) {
    // Optimistic UI update
    const wasOccupied = occupiedDates.has(dateStr);
    if (wasOccupied) {
      occupiedDates.delete(dateStr);
      btn.classList.remove('occupied');
      btn.setAttribute('aria-label', btn.getAttribute('aria-label').replace(' — occupied', ''));
    } else {
      occupiedDates.add(dateStr);
      btn.classList.add('occupied');
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') + ' — occupied');
    }

    // Persist to Supabase
    if (wasOccupied) {
      const { error } = await db.from('occupied_dates').delete().eq('date', dateStr);
      if (error) {
        // Revert on failure
        console.error('Failed to unmark date:', error);
        occupiedDates.add(dateStr);
        btn.classList.add('occupied');
      }
    } else {
      const { error } = await db.from('occupied_dates').insert({ date: dateStr });
      if (error) {
        // Revert on failure
        console.error('Failed to mark date:', error);
        occupiedDates.delete(dateStr);
        btn.classList.remove('occupied');
      }
    }
  }
  ```

- [ ] **Step 2: Verify in browser**

  Open `calendar.html` (while logged in). Confirm:
  - Current month name and year display correctly in the header
  - Calendar grid has 7 columns with Mon–Sun labels
  - Days start on the correct weekday
  - Click any date → it turns red immediately
  - Refresh page → red date persists (stored in Supabase)
  - Click red date → it returns to grey
  - Refresh → date is no longer red
  - Prev/Next buttons navigate months correctly

- [ ] **Step 3: Commit**

  ```bash
  git add Clients/Margel360/website/admin/js/calendar.js
  git commit -m "feat: add occupied dates calendar with optimistic toggle and Supabase persistence"
  ```

---

## Task 9: Wire Reservation Form to Supabase

**Files:**
- Modify: `website/reservation.html` (add Supabase CDN)
- Modify: `website/js/reservation.js` (update `setupSubmit`)

The form is a 6-step wizard. The submit action is in the `setupSubmit()` function at the bottom of `reservation.js`. Currently it just hides the wizard and shows a success message. We replace this with a Supabase insert, then show success on completion.

- [ ] **Step 1: Add Supabase CDN to `reservation.html`**

  In `reservation.html`, find the script tags at the bottom (before `</body>`):

  ```html
  <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
  <script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/bg.js"></script>
  <script src="js/translations-reservation.js"></script>
  <script src="js/main.js"></script>
  <script src="js/reservation.js"></script>
  ```

  Add the Supabase CDN **before** `reservation.js`:

  ```html
  <script src="https://cdn.jsdelivr.net/npm/flatpickr"></script>
  <script src="https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/bg.js"></script>
  <script src="js/translations-reservation.js"></script>
  <script src="js/main.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="js/reservation-supabase.js"></script>
  <script src="js/reservation.js"></script>
  ```

- [ ] **Step 2: Create `website/js/reservation-supabase.js`**

  Rather than modifying `reservation.js` directly, create a separate file that initialises the Supabase client for the public website (uses the same credentials but a separate file so the admin panel and website remain independent):

  ```javascript
  // Supabase client for the public reservation form
  // Anon key is safe to expose — RLS policies allow anon INSERT on enquiries only
  const SUPABASE_URL = 'YOUR_PROJECT_URL';   // same value as admin/js/supabase-client.js
  const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY'; // same value as admin/js/supabase-client.js

  const { createClient } = supabase;
  const reservationDb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  ```

- [ ] **Step 3: Update `setupSubmit()` in `website/js/reservation.js`**

  Find the existing `setupSubmit` function (line ~383):

  ```javascript
  function setupSubmit() {
    const btn = document.getElementById('btn-submit');
    if (!btn) return;
    btn.addEventListener('click', () => {
      booking.payment = document.querySelector('input[name="payment"]:checked')?.value || 'cash';
      document.getElementById('step-5')?.classList.remove('active');
      document.querySelector('.wizard-progress').style.display = 'none';
      document.getElementById('form-success').style.display = 'block';
      window.scrollTo({ top: document.querySelector('.wizard-section').offsetTop - 90, behavior: 'smooth' });
    });
  }
  ```

  Replace it with:

  ```javascript
  function setupSubmit() {
    const btn = document.getElementById('btn-submit');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      booking.payment = document.querySelector('input[name="payment"]:checked')?.value || 'cash';

      btn.disabled = true;
      const origText = btn.textContent;
      btn.textContent = getLang() === 'bg' ? 'Изпращане…' : 'Sending…';

      // Serialize add-ons: only selected ones
      const addonsPayload = Object.entries(booking.addons)
        .filter(([, price]) => price > 0)
        .map(([id, price]) => {
          const svc = addonServices.find(s => s.id === id);
          return { id, name: svc ? svc.name_en : id, price };
        });

      // Serialize drinks: only items with qty > 0
      const drinksPayload = Object.entries(booking.drinkQtys)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const drink = drinks.find(d => d.id === id);
          return { id, name: drink ? drink.name_en : id, qty, price_bgn: drink?.price_bgn || null };
        });

      const payload = {
        full_name: booking.name,
        email: booking.email,
        phone: booking.phone,
        event_type: booking.event ? booking.event.title_en : '',
        event_id: booking.event ? booking.event.id : '',
        preferred_date: booking.date,
        time_of_day: booking.time,
        guests: booking.guests ? parseInt(booking.guests, 10) : null,
        addons: addonsPayload,
        drinks: drinksPayload,
        payment_method: booking.payment,
        notes: booking.notes || null,
      };

      const { error } = await reservationDb.from('enquiries').insert(payload);

      if (error) {
        console.error('Submission error:', error);
        btn.disabled = false;
        btn.textContent = origText;
        const lang = getLang();
        alert(lang === 'bg'
          ? 'Нещо се обърка. Моля обадете ни се директно на 0888 10 09 42.'
          : 'Something went wrong. Please call us directly on 0888 10 09 42.');
        return;
      }

      // Success
      document.getElementById('step-5')?.classList.remove('active');
      document.querySelector('.wizard-progress').style.display = 'none';
      document.getElementById('form-success').style.display = 'block';
      window.scrollTo({ top: document.querySelector('.wizard-section').offsetTop - 90, behavior: 'smooth' });
    });
  }
  ```

- [ ] **Step 4: Verify end-to-end submission**

  Open `reservation.html` in a browser. Complete all 6 steps with test data:
  - Step 1: Select any event type
  - Step 2: Pick a date, select daytime or evening
  - Step 3: Select 1–2 add-on services
  - Step 4: Add a couple of drinks
  - Step 5: Fill name, email, phone, guests, notes
  - Step 6: Click "Изпрати запитване"

  Expected: success message appears. Go to Supabase → Table Editor → `enquiries` → confirm new row exists with all data including addons and drinks JSON arrays.

  Also verify: open `admin/dashboard.html` → new enquiry appears at the top of the list → click View → all details including add-ons and drinks are shown correctly.

- [ ] **Step 5: Commit**

  ```bash
  git add Clients/Margel360/website/reservation.html \
          Clients/Margel360/website/js/reservation.js \
          Clients/Margel360/website/js/reservation-supabase.js
  git commit -m "feat: wire reservation form to Supabase — submit full booking payload on step 6"
  ```

---

## Task 10: Supabase Edge Function — Email Notification

**Files:**
- Create: `supabase/functions/notify-enquiry/index.ts`

This Edge Function is triggered by a Supabase database webhook on INSERT to `enquiries`. It calls the Resend API to send a notification email to the team.

- [ ] **Step 1: Install Supabase CLI**

  ```bash
  brew install supabase/tap/supabase
  ```

  Verify: `supabase --version` should print a version number.

- [ ] **Step 2: Initialise Supabase project locally**

  From the repo root:

  ```bash
  cd "Clients/Margel360"
  supabase init
  ```

  This creates a `supabase/` folder. It is safe to commit.

- [ ] **Step 3: Create the Edge Function**

  ```bash
  supabase functions new notify-enquiry
  ```

  This creates `supabase/functions/notify-enquiry/index.ts`.

- [ ] **Step 4: Write `supabase/functions/notify-enquiry/index.ts`**

  ```typescript
  import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

  serve(async (req) => {
    try {
      const payload = await req.json();
      const record = payload.record;

      if (!record) {
        return new Response(JSON.stringify({ error: "No record in payload" }), { status: 400 });
      }

      const addonsText = Array.isArray(record.addons) && record.addons.length
        ? record.addons.map((a: { name: string; price: number }) =>
            `  - ${a.name}: €${(a.price / 1.95583).toFixed(2)}`
          ).join("\n")
        : null;

      const drinksText = Array.isArray(record.drinks) && record.drinks.length
        ? record.drinks.map((d: { name: string; qty: number }) =>
            `  - ${d.name} × ${d.qty}`
          ).join("\n")
        : null;

      const timeLabel = record.time_of_day === "day"
        ? "Daytime (until 17:30)"
        : "Evening (after 19:00)";

      const body = [
        "New enquiry received at Margel 360°",
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        `Name:           ${record.full_name}`,
        `Email:          ${record.email}`,
        `Phone:          ${record.phone}`,
        "",
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        `Event:          ${record.event_type}`,
        `Date:           ${record.preferred_date}`,
        `Time:           ${timeLabel}`,
        `Guests:         ${record.guests ?? "—"}`,
        `Payment:        ${record.payment_method}`,
        "",
        ...(addonsText ? ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "Add-on services:", addonsText, ""] : []),
        ...(drinksText ? ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "Drinks:", drinksText, ""] : []),
        ...(record.notes ? ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "Notes:", record.notes, ""] : []),
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
        "",
        `Submitted at: ${new Date(record.created_at).toLocaleString("en-GB")}`,
      ].join("\n");

      const subject = `New Enquiry — ${record.full_name} — ${record.event_type}`;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "enquiries@margel360.bg",
          to: Deno.env.get("TEAM_EMAIL"),
          subject,
          text: body,
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        console.error("Resend error:", errBody);
        return new Response(JSON.stringify({ error: errBody }), { status: 500 });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err) {
      console.error("Edge function error:", err);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
    }
  });
  ```

- [ ] **Step 5: Link local project to Supabase**

  ```bash
  supabase login
  supabase link --project-ref YOUR_PROJECT_REF
  ```

  `YOUR_PROJECT_REF` is the string in your Supabase project URL: `https://YOUR_PROJECT_REF.supabase.co`.

- [ ] **Step 6: Set environment variables on Supabase**

  ```bash
  supabase secrets set RESEND_API_KEY=re_your_resend_api_key
  supabase secrets set TEAM_EMAIL=team@margel360.bg
  ```

  Replace `re_your_resend_api_key` with your Resend API key (from resend.com → API Keys → Create API Key, free tier).
  Replace `team@margel360.bg` with the team's actual email address.

  > **Resend setup:** Sign up at resend.com → add and verify your domain (margel360.bg) → create an API key → use it above. The sender address `enquiries@margel360.bg` must match a verified domain in Resend.

- [ ] **Step 7: Deploy the Edge Function**

  ```bash
  supabase functions deploy notify-enquiry --no-verify-jwt
  ```

  The `--no-verify-jwt` flag is required because this function is called by a database webhook (not a user request), so there's no JWT to verify.

  Expected output: `Deployed Function notify-enquiry` with a function URL.

- [ ] **Step 8: Create the database webhook**

  Supabase dashboard → Database → Webhooks → Create a new hook:
  - **Name:** `on_enquiry_insert`
  - **Table:** `enquiries`
  - **Events:** ✅ Insert
  - **Type:** Supabase Edge Functions
  - **Edge Function:** `notify-enquiry`

  Save.

- [ ] **Step 9: End-to-end email test**

  Submit a test enquiry from `reservation.html` (complete all 6 steps). Within ~10 seconds, the team email inbox should receive a notification email with the full enquiry summary.

  If no email arrives: Supabase dashboard → Edge Functions → `notify-enquiry` → Logs → check for errors.

- [ ] **Step 10: Commit**

  ```bash
  cd ../..  # back to repo root
  git add Clients/Margel360/supabase/
  git commit -m "feat: add Supabase Edge Function for Resend email notification on new enquiry"
  ```

---

## Task 11: Deploy to Netlify

**Files:** None (configuration only)

- [ ] **Step 1: Push the full branch to GitHub**

  ```bash
  git push origin main
  ```

- [ ] **Step 2: Connect to Netlify**

  Netlify dashboard → Add new site → Import from Git → select the repository → set:
  - **Publish directory:** `Clients/Margel360/website`
  - **Build command:** (leave empty — no build step)

  Deploy.

- [ ] **Step 3: Verify the admin panel URL**

  After deploy, navigate to `https://your-site.netlify.app/admin/login.html`. Confirm:
  - Login page loads
  - Sign in with a team member account
  - Dashboard shows enquiries
  - Calendar shows and allows toggling dates

- [ ] **Step 4: Set up a custom domain (optional)**

  Netlify dashboard → Domain management → Add custom domain → e.g. `admin.margel360.bg`.

  The main website stays at `margel360.bg`; the admin panel is accessible at `margel360.bg/admin/`.

- [ ] **Step 5: Final smoke test**

  - Submit a real enquiry from the live website
  - Confirm email notification arrives at team inbox
  - Log into admin panel → confirm enquiry appears
  - Mark the booked date as occupied on the calendar
  - Confirm the occupied date persists after page refresh

---

## Self-Review Checklist (do not delete)

- [x] Supabase schema covers all fields collected by the reservation wizard (event, date, time, add-ons, drinks, contact, payment, notes)
- [x] RLS policies: anon can insert enquiries (website form), authenticated can read enquiries, authenticated can read/insert/delete occupied_dates
- [x] Login page redirects if already authenticated
- [x] Dashboard and calendar redirect to login if no session
- [x] Logout button wired on both protected pages
- [x] Optimistic UI for calendar toggle (instant feedback, reverts on error)
- [x] Form submit disables button and shows loading text during async call
- [x] Error handling on form submit: shows alert with phone number fallback
- [x] XSS prevention: all user data rendered through `esc()` function
- [x] Email includes full summary: name, email, phone, event, date, time, guests, payment, add-ons, drinks, notes
- [x] Edge Function deployed with `--no-verify-jwt` for webhook compatibility
- [x] Resend sender domain must match a verified domain in Resend dashboard
