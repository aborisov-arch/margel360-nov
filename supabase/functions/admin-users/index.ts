// Owner-only user administration: list the admin accounts and set a new
// password for any of them. Deploy WITH verify_jwt (no --no-verify-jwt):
// the caller's admin session JWT is the first gate, public.is_owner() under
// the caller's identity is the second (fail-closed, same pattern as
// update-enquiry-admin). Only then is the service role used for the
// GoTrue admin API. Passwords are never logged.
//
// POST { action: "list" }
//   -> { users: [{ id, email, created_at, last_sign_in_at }] }
// POST { action: "set_password", user_id, password }
//   -> { ok: true, email, sessions_revoked }
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 72; // bcrypt input limit
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ADMIN_ORIGINS = new Set(["https://margel360.bg", "https://www.margel360.bg"]);
function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ADMIN_ORIGINS.has(origin) ? origin : "https://margel360.bg",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

type ListedUser = { id: string; email: string; created_at: string; last_sign_in_at: string | null };

async function listUsers(): Promise<ListedUser[]> {
  const { data, error } = await sbAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return (data.users ?? [])
    .filter((u) => !!u.email)
    .map((u) => ({
      id: u.id,
      email: u.email as string,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));
}

// GoTrue's admin API has no "log this user out everywhere" call, so after
// the password change we sign in as the target with the new password and
// revoke that session with scope=global, which drops every session and
// refresh token the account had. Best-effort: a failure here still leaves
// the new password in place, the response just says sessions_revoked=false.
async function revokeAllSessions(email: string, password: string): Promise<boolean> {
  try {
    const sbTarget = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sbTarget.auth.signInWithPassword({ email, password });
    if (error || !data.session) return false;
    const { error: outErr } = await sbAdmin.auth.admin.signOut(data.session.access_token, "global");
    return !outErr;
  } catch (e) {
    console.error("session revocation failed:", (e as Error)?.message ?? e);
    return false;
  }
}

serve(async (req) => {
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return json({ error: "unauthorized" }, 401);
  const sbUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: { user: caller }, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !caller) return json({ error: "unauthorized" }, 401);
  // Owner gate: authenticated admin != owner. Ask the DB's is_owner() under
  // the caller's identity and fail closed on any error.
  const { data: isOwner, error: ownerErr } = await sbUser.rpc("is_owner");
  if (ownerErr || isOwner !== true) return json({ error: "forbidden" }, 403);

  let body: { action?: unknown; user_id?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  if (body.action === "list") {
    try {
      return json({ users: await listUsers() });
    } catch (e) {
      console.error("listUsers failed:", (e as Error)?.message ?? e);
      return json({ error: "server_error" }, 500);
    }
  }

  if (body.action === "set_password") {
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!UUID_RE.test(userId)) return json({ error: "bad_user_id" }, 400);
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      return json({ error: "bad_password", detail: `length ${MIN_PASSWORD}..${MAX_PASSWORD}` }, 400);
    }

    const { data: targetRes, error: getErr } = await sbAdmin.auth.admin.getUserById(userId);
    if (getErr || !targetRes?.user?.email) return json({ error: "not_found" }, 404);
    const targetEmail = targetRes.user.email;

    const { error: updErr } = await sbAdmin.auth.admin.updateUserById(userId, { password });
    if (updErr) {
      // GoTrue reports weak / leaked passwords here when password strength
      // checks are enabled in the dashboard - surface that to the UI.
      const msg = updErr.message || "";
      const weak = /weak|pwned|leaked|strength|characters/i.test(msg);
      console.error("updateUserById failed:", updErr.status, weak ? "weak_password" : msg);
      return json({ error: weak ? "weak_password" : "server_error", detail: weak ? msg : undefined }, weak ? 400 : 500);
    }

    const sessionsRevoked = await revokeAllSessions(targetEmail, password);

    // Audit trail (service role bypasses RLS; owners read it on activity.html).
    const { error: auditErr } = await sbAdmin.from("audit_log").insert({
      table_name: "auth.users",
      record_id: userId,
      action: "UPDATE",
      changed_by: caller.email ?? caller.id,
      label: targetEmail,
      changes: { password: { old: "••••••••", new: "••••••••" } },
    });
    if (auditErr) console.error("audit_log insert failed:", auditErr.message);

    console.log(`password set for ${targetEmail} by ${caller.email ?? caller.id}; sessions_revoked=${sessionsRevoked}`);
    return json({ ok: true, email: targetEmail, sessions_revoked: sessionsRevoked });
  }

  return json({ error: "unknown_action" }, 400);
});
