# Margel 360° Event Management Platform — Design Spec

**Date:** 2026-04-10
**Client:** Margel 360° (event venue)
**Project type:** Internal admin platform — enquiry inbox + calendar
**Goal:** Give the Margel360 team a private, login-protected panel to receive client enquiries from the website and manage occupied calendar dates.

---

## Overview

A lightweight internal admin platform with three pages: login, enquiry inbox, and calendar. The existing reservation form on the Margel360 website is wired to post data to Supabase. When a submission arrives, a Resend email is sent to the team with a full summary of what the client requested. The team logs into the admin panel to view all enquiries and manually mark/unmark calendar dates as occupied.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Vanilla HTML/CSS/JS (matches existing Margel360 site) |
| Database + Auth | Supabase (PostgreSQL + Supabase Auth) |
| Email notifications | Resend (via Supabase Edge Function) |
| Hosting | Netlify (existing subscription) |

---

## Architecture

```
Website (existing)
  reservation.html form submit
        │
        ▼
  Supabase DB (enquiries table)
        │
        ├──► Supabase Edge Function → Resend API → team email notification
        │
        ▼
  Admin Panel (new — Netlify, same project)
        ├── /admin/login.html        ← Supabase Auth
        ├── /admin/dashboard.html    ← enquiry inbox
        └── /admin/calendar.html     ← occupied dates calendar
```

---

## Database Schema (Supabase)

### `enquiries` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key, auto-generated |
| full_name | text | client full name |
| phone | text | client phone number |
| event_type | text | selected event type from dropdown |
| preferred_date | date | client's preferred date |
| message | text | additional message/requests |
| created_at | timestamptz | auto-set on insert |

### `occupied_dates` table
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key, auto-generated |
| date | date | the occupied date |
| marked_at | timestamptz | when it was marked |

---

## File Structure

```
Clients/Margel360/website/
├── admin/
│   ├── login.html
│   ├── dashboard.html
│   ├── calendar.html
│   ├── css/
│   │   └── admin.css
│   └── js/
│       ├── supabase-client.js   ← Supabase JS client init
│       ├── auth.js              ← login/logout, session guard
│       ├── dashboard.js         ← fetch and render enquiries
│       └── calendar.js          ← render calendar, mark/unmark dates
```

The admin panel lives inside the existing `website/` folder, deployed to Netlify alongside the existing site.

---

## Pages

### `/admin/login.html`
- Centered login form: email + password fields, submit button
- Uses Supabase Auth (`supabase.auth.signInWithPassword`)
- On success: redirect to `/admin/dashboard.html`
- On failure: show inline error message ("Invalid credentials")
- If already logged in: redirect straight to dashboard
- Design: dark theme matching Margel360 brand (`#0a0a0a` bg, `#e63030` accent)

### `/admin/dashboard.html` — Enquiry Inbox
- Protected: if no active session, redirect to login
- Displays all enquiries from the `enquiries` table, newest first
- Each row shows: full name, phone, event type, preferred date, date received
- Click a row to expand inline and reveal the full message
- No pagination for now — simple full list (volume is low for a single venue)
- Logout button in top-right corner

### `/admin/calendar.html` — Occupied Dates Calendar
- Protected: if no active session, redirect to login
- Monthly calendar rendered in vanilla JS
- Navigation: prev/next month arrows
- Occupied dates (from `occupied_dates` table) shown in red (`#e63030`)
- Click an unoccupied date → mark it as occupied (insert row)
- Click an occupied date → unmark it (delete row)
- Changes persist immediately to Supabase, visible to all team members on refresh
- Logout button in top-right corner

---

## Website Form Integration

The existing `reservation.html` form is updated to submit data to Supabase instead of the current no-op demo submission. Changes:

1. Load the Supabase JS client via CDN in `reservation.html`
2. On form submit (after client-side validation passes): call `supabase.from('enquiries').insert({...})`
3. On success: show existing thank-you confirmation message
4. On error: show generic error message ("Something went wrong, please call us directly")

Fields mapped from the form to the `enquiries` table:
- Full name → `full_name`
- Phone → `phone`
- Event type dropdown → `event_type`
- Preferred date → `preferred_date`
- Message → `message`

---

## Email Notification (Resend)

**Trigger:** Supabase Edge Function called via a database webhook on `INSERT` into the `enquiries` table.

**Recipient:** Team email address (configured as an environment variable in Netlify/Supabase).

**Email content:**
```
Subject: New Enquiry — Margel 360°

You have received a new event enquiry.

Name:           [full_name]
Phone:          [phone]
Event type:     [event_type]
Preferred date: [preferred_date]
Message:        [message]

Submitted at: [created_at]
```

Plain text email — no HTML template needed. Clean and readable on any device.

**Resend free tier:** 3,000 emails/month — more than sufficient for a single venue.

---

## Authentication

- Supabase Auth with email + password
- One account per team member (created manually in Supabase dashboard)
- Session stored in `localStorage` via Supabase JS client
- Each admin page checks for active session on load; redirects to login if none
- Logout clears session and redirects to login

No user management UI — accounts are managed directly in the Supabase dashboard.

---

## Visual Design

Matches the existing Margel360 website design:

| Property | Value |
|---|---|
| Background | `#0a0a0a` |
| Surface/cards | `#111111` |
| Primary text | `#ffffff` |
| Accent (occupied dates, buttons) | `#e63030` |
| Font | Inter (Google Fonts) |
| Border radius | 8px |

---

## Deployment

- Admin panel lives at `yourdomain.com/admin/` (same Netlify site as the existing website)
- No separate deploy needed — the `admin/` folder is part of `Clients/Margel360/website/`
- Supabase project URL and anon key stored as Netlify environment variables, injected at build time or referenced directly in JS (anon key is safe to expose client-side)
- Supabase Edge Function deployed via Supabase CLI for the Resend email trigger

---

## Out of Scope

- Enquiry status management (confirmed/rejected/pending)
- Client-facing login or enquiry tracking
- SMS notifications
- Recurring/blocked date ranges (dates are marked individually)
- Reporting or analytics
- Multi-language support for the admin panel (BG/EN toggle not needed internally)
