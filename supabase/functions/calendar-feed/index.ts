// calendar-feed: iCal subscription of confirmed/completed bookings + manual
// blocks for the team's Google Calendar. GET ?token=<64 hex>; the token is a
// per-admin bearer credential created from admin/calendar.html (only its
// sha256 is stored - see migration 20261026120000). Deploy with
// --no-verify-jwt: Google fetches it with no headers.
// Design: docs/superpowers/specs/2026-10-26-google-calendar-feed-design.md
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { handleCalendarFeed } from "../_shared/calendar-feed-handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://margel360.bg").replace(/\/+$/, "");

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

serve((req) => handleCalendarFeed(req, { db: sb, siteUrl: SITE_URL }));
