import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";

// Cron-triggered on the 1st of each month: builds a CSV of customers with
// marketing consent (deduped by email, then phone) and emails it to the
// owners — replaces the manual download ritual on the marketing page.
// Mirrors the dedupe + CSV rules of website/admin/js/marketing.js.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_KEY   = Deno.env.get("RESEND_API_KEY")!;
const FROM_ADDR    = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
const FROM_EMAIL   = FROM_ADDR.includes("<") ? FROM_ADDR : `Margel360 <${FROM_ADDR}>`;
const OWNER_EMAILS = Deno.env.get("OWNER_EMAILS") ?? "";
const TEAM_EMAIL   = Deno.env.get("TEAM_EMAIL") ?? "";
// INTENTIONALLY shared with send-team-digest / send-event-reminders: one
// secret guards the internal cron functions (Vault: team_digest_cron_secret).
const CRON_SECRET  = Deno.env.get("TEAM_DIGEST_CRON_SECRET") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// CSV cell escape: quote-double, and prefix ' when the value starts with
// = + - @ so Excel can't execute customer-controlled formulas.
function csvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\n;]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

type Enquiry = {
  full_name: string | null; email: string | null; phone: string | null;
  event_type: string | null; pipeline_status: string | null;
  marketing_consent: boolean | null; created_at: string;
};

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!CRON_SECRET) { console.error("TEAM_DIGEST_CRON_SECRET not configured"); return json({ error: "not_configured" }, 500); }
  if ((req.headers.get("x-cron-secret") ?? "") !== CRON_SECRET) return json({ error: "unauthorized" }, 401);

  const recipients = [...OWNER_EMAILS.split(","), ...TEAM_EMAIL.split(",")].map(s => s.trim()).filter(Boolean);
  const unique = [...new Set(recipients)];
  if (!unique.length) return json({ error: "no_recipients" }, 500);

  const { data, error } = await sb
    .from("enquiries")
    .select("full_name, email, phone, event_type, pipeline_status, marketing_consent, created_at")
    .eq("marketing_consent", true)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) { console.error("query failed:", error); return json({ error: "query_failed" }, 500); }

  // Dedupe by lower(email), falling back to digits-only phone — keep the most
  // recent enquiry's contact row, aggregate the rest.
  const byKey = new Map<string, { e: Enquiry; count: number; events: Set<string> }>();
  for (const e of (data ?? []) as Enquiry[]) {
    const key = (e.email ?? "").toLowerCase().trim() || (e.phone ?? "").replace(/\D/g, "");
    if (!key) continue;
    const cur = byKey.get(key);
    if (cur) {
      cur.count++;
      if (e.event_type) cur.events.add(e.event_type);
    } else {
      byKey.set(key, { e, count: 1, events: new Set(e.event_type ? [e.event_type] : []) });
    }
  }

  // Nothing to export → no email. An empty monthly CSV is just inbox noise.
  if (byKey.size === 0) {
    return json({ scanned: data?.length ?? 0, contacts: 0, sent: 0, note: "no consenting contacts — skipped" });
  }

  const header = ["Име", "Имейл", "Телефон", "Събития", "Брой запитвания", "Статус", "Последен контакт"];
  const lines = [header.join(",")];
  for (const { e, count, events } of byKey.values()) {
    lines.push([
      csvCell(e.full_name), csvCell(e.email), csvCell(e.phone),
      csvCell([...events].join(" | ")), csvCell(count),
      csvCell(e.pipeline_status), csvCell(e.created_at?.slice(0, 10)),
    ].join(","));
  }
  // BOM so Excel opens the Cyrillic as UTF-8.
  const csv = "﻿" + lines.join("\r\n");
  const csvB64 = btoa(String.fromCharCode(...new TextEncoder().encode(csv)));

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const subject = `Маргел 360° · маркетинг списък · ${ym}`;
  const html = `<p>Месечен експорт: <strong>${byKey.size}</strong> клиенти със съгласие за маркетинг (от ${data?.length ?? 0} запитвания).</p><p>Файлът е прикачен (CSV, отваря се в Excel).</p>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL, to: unique, subject, html,
      attachments: [{ filename: `margel360_marketing_${ym}.csv`, content: csvB64 }],
    }),
  });
  if (!r.ok) { console.error("resend failed:", await r.text()); return json({ error: "send_failed" }, 502); }

  return json({ scanned: data?.length ?? 0, contacts: byKey.size, sent: unique.length });
});
