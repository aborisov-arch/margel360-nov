import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { json, preflight } from "../_shared/cors.ts";
import { getIp, rateLimitHit } from "../_shared/rate-limit.ts";
import { FEEDBACK_DISCOUNT_PERCENT } from "../_shared/feedback-reward.ts";
import { feedbackRoute, SOURCES, V1_MAX, V1_RATINGS, V2_MAX, V2_RATINGS } from "../_shared/feedback-form.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const SOURCE_SET = new Set<string>(SOURCES);
const V1_COMMENTS = ["experience_comment", "service_comment", "venue_comment", "rebook_comment"];

function rating(v: unknown, max: number): number | null {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > max) return null;
  return n;
}

function trimOrNull(v: unknown, max = 4000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

type Answer = Record<string, string | number | null>;
type Parsed = { row: Answer; ratings: number[]; max: number };

// Every answer column set to null: saving one form version clears the
// other's, since a re-submit replaces the whole answer.
const EMPTY_ANSWER: Answer = Object.fromEntries(
  [...V1_RATINGS, ...V2_RATINGS].map(q => q.key).concat(V1_COMMENTS, ["improvement_comment"]).map(k => [k, null]));

// The survey page sends form_version 2: five 1-5 ratings and one open
// question. A page still open from before 2026-09-27 sends the v1 shape (four
// 1-4 ratings, a comment each); it is still accepted so that submit works.
function parseAnswer(p: Record<string, unknown>): Parsed | null {
  const v2 = p.form_version === 2;
  const questions = v2 ? V2_RATINGS : V1_RATINGS;
  const max = v2 ? V2_MAX : V1_MAX;
  const ratings = questions.map(q => rating(p[q.key], max));
  if (ratings.some(r => r === null)) return null;
  const row: Answer = { ...EMPTY_ANSWER, form_version: v2 ? 2 : 1 };
  questions.forEach((q, i) => { row[q.key] = ratings[i]; });
  if (v2) row.improvement_comment = trimOrNull(p.improvement_comment);
  else for (const k of V1_COMMENTS) row[k] = trimOrNull(p[k]);
  return { row, ratings: ratings as number[], max };
}

serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ip = getIp(req);
  if (!await rateLimitHit(sb, `fb-sub:ip:${ip}`, 5, 60)) return json({ error: "rate_limited" }, 429);

  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const token = p.token;
  if (typeof token !== "string" || !token) return json({ error: "missing_token" }, 400);

  const answer = parseAnswer(p);
  if (!answer) return json({ error: "invalid_ratings" }, 400);

  const source = typeof p.source === "string" && SOURCE_SET.has(p.source) ? p.source : null;
  if (!source) return json({ error: "invalid_source" }, 400);

  const row: Answer = {
    ...answer.row,
    source,
    source_other: source === "other" ? trimOrNull(p.source_other, 500) : null,
  };

  const { data: e, error: lookupErr } = await sb
    .from("enquiries").select("id, full_name, email, lang").eq("feedback_token", token).maybeSingle();
  if (lookupErr) { console.error(lookupErr); return json({ error: "server_error" }, 500); }
  if (!e) return json({ error: "not_found" }, 404);
  const lang: Lang = e.lang === "en" ? "en" : "bg";

  // One answer per enquiry (unique enquiry_id): the page pre-fills the saved
  // answers, so a re-submit updates that row instead of adding another.
  let firstAnswer = true;
  let { error: saveErr } = await sb.from("event_feedback").insert({ enquiry_id: e.id, ...row });
  if (saveErr?.code === "23505") {
    firstAnswer = false;
    ({ error: saveErr } = await sb.from("event_feedback").update(row).eq("enquiry_id", e.id));
  }
  if (saveErr) { console.error(saveErr); return json({ error: "save_failed" }, 500); }

  // Issue a hall-rent discount code if this enquiry hasn't already received
  // one. Idempotent: re-submitting feedback returns the same code (at the
  // percent it was minted with) rather than generating a new one each time.
  const { code, percent, minted } = await issueDiscountCode(e.id);
  // The code email and the routing below go out once: with the first answer,
  // or with the request that minted the code (a retry after a failed mint).
  const fresh = firstAnswer || minted;
  const emailDelivered = fresh ? await sendDiscountEmail(e.email, e.full_name, code, percent, lang) : true;

  // Reputation routing — fires once, with the code email (rules in
  // _shared/feedback-form.ts):
  //  - delighted: invite the customer to leave a public Google review
  //    (review-gating the solicitation, never the submission).
  //  - unhappy: alert the team for service recovery with the verbatim
  //    comments instead.
  const routing = fresh ? await routeFeedback(e, row, answer, lang).catch(err => {
    console.error("feedback routing failed (non-fatal):", err); return null;
  }) : null;

  return json({ success: true, discount_code: code, discount_percent: percent, email_delivered: emailDelivered, routing });
});

type Lang = "bg" | "en";

const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

// Customer emails in the language of the booking (enquiries.lang).
const COPY = {
  bg: {
    brand: "Маргел", footer: "бул. Околовръстен път 155 · ет. 4 · София",
    reviewSubject: "Бихте ли споделили мнението си публично? · Маргел 360°",
    reviewTitle: (first: string) => `Благодарим, ${first}!`,
    reviewBody: "Радваме се, че сте останали доволни. Ако отделите минута да споделите впечатленията си в Google, ще помогнете на други да открият Маргел 360°.",
    reviewCta: "Оставете отзив в Google",
    codeSubject: (pct: number, code: string) => `Вашата ${pct}% отстъпка · код ${code}`,
    codeEyebrow: "Благодарим за впечатленията",
    codeTitle: (first: string) => `${first}, вашата <em style="font-style:italic;color:#B9894A">отстъпка</em> ви очаква.`,
    codeBody: (pct: number) => `Като благодарност за отделеното време ви подаряваме <strong>${pct}% отстъпка</strong> от наема на залата за следващото ви събитие при нас.`,
    codeLabel: "Вашият промо код",
    codeTerms: "Въведете кода при следваща резервация на нашия сайт. Отстъпката важи само за наема на залата (не за напитки и допълнителни услуги). Валиден за една година, еднократна употреба.",
  },
  en: {
    brand: "Margel", footer: "155 Okolovrasten Pat Blvd · floor 4 · Sofia",
    reviewSubject: "Would you share your experience publicly? · Margel 360°",
    reviewTitle: (first: string) => `Thank you, ${first}!`,
    reviewBody: "We are glad you enjoyed your event. If you have a minute to share your impressions on Google, you will help others discover Margel 360°.",
    reviewCta: "Leave a Google review",
    codeSubject: (pct: number, code: string) => `Your ${pct}% discount · code ${code}`,
    codeEyebrow: "Thank you for your feedback",
    codeTitle: (first: string) => `${first}, your <em style="font-style:italic;color:#B9894A">discount</em> is waiting.`,
    codeBody: (pct: number) => `As a thank-you for your time, here is a <strong>${pct}% discount</strong> off the venue hire for your next event with us.`,
    codeLabel: "Your promo code",
    codeTerms: "Enter the code when you next book on our website. The discount applies to the venue hire only (not to drinks or extra services). Valid for one year, single use.",
  },
};

// full_name originates from the public reservation form — escape before
// interpolating into email HTML.
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const firstName = (fullName: string) => esc((fullName || "").split(" ")[0] || fullName || "");

async function sendResend(to: string | string[], subject: string, html: string): Promise<boolean> {
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
  const FROM_ADDR = Deno.env.get("EVENT_HALL_FROM_EMAIL") ?? "enquiries@margel360.bg";
  const FROM = FROM_ADDR.includes("<") ? FROM_ADDR : `Margel360 <${FROM_ADDR}>`;
  if (!RESEND_KEY || !to || (Array.isArray(to) && !to.length)) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
      // The customer is waiting on this request: never hang on Resend.
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) { console.error("resend rejected:", r.status, await r.text()); return false; }
    return true;
  } catch (err) { console.error("resend failed:", err); return false; }
}

async function routeFeedback(
  e: { id: string; full_name: string; email: string },
  row: Answer,
  answer: Parsed,
  lang: Lang,
): Promise<{ branch: string } | null> {
  const branch = feedbackRoute(answer.ratings, answer.max);

  // ── Delighted → Google review invite
  const reviewUrl = Deno.env.get("GOOGLE_REVIEW_URL") ?? "";
  if (branch === "review" && reviewUrl && e.email) {
    const c = COPY[lang];
    const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
  <tr><td style="padding:32px 44px 24px;border-bottom:1px solid rgba(185,137,74,0.35);font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;text-transform:uppercase">${c.brand}&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em></td></tr>
  <tr><td style="padding:40px 44px 32px">
    <h1 style="margin:0 0 14px;font:400 32px/1.15 ${SERIF}">${c.reviewTitle(firstName(e.full_name))}</h1>
    <p style="margin:0 0 24px;font:16px/1.55 ${SANS};color:#2A2620">${c.reviewBody}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px"><tr><td>
      <a href="${esc(reviewUrl)}" style="display:inline-block;padding:14px 28px;background:#1A1815;color:#F6F1E8;font:600 12px/1 ${SANS};letter-spacing:0.14em;text-transform:uppercase;text-decoration:none">${c.reviewCta}</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}"><strong style="color:#C9A86A;text-transform:uppercase;letter-spacing:0.16em">${c.brand} 360°</strong> · ${c.footer}</td></tr>
</table></td></tr></table></body></html>`;
    await sendResend(e.email, c.reviewSubject, html);
    return { branch: "review_invite" };
  }

  // ── Unhappy → internal service-recovery alert (team emails stay Bulgarian)
  if (branch === "alert") {
    const recips = [...(Deno.env.get("OWNER_EMAILS") ?? "").split(","), ...(Deno.env.get("TEAM_EMAIL") ?? "").split(",")]
      .map(s => s.trim()).filter(Boolean);
    const to = [...new Set(recips)];
    if (!to.length) return { branch: "low_rating_no_recipients" };
    const SITE = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://margel360.bg").replace(/\/$/, "");
    const line = (label: string, n: unknown, c?: unknown) =>
      `<tr><td style="padding:4px 0;font:13px/1.5 ${SANS};color:#2A2620">${label}: <strong>${n}/${answer.max}</strong>${c ? ` — „${esc(c)}“` : ""}</td></tr>`;
    const lines = answer.max === V2_MAX
      ? V2_RATINGS.map(q => line(q.bg, row[q.key])).join("")
        + (row.improvement_comment ? `<tr><td style="padding:8px 0 4px;font:13px/1.5 ${SANS};color:#2A2620">Какво да подобрим: „${esc(row.improvement_comment)}“</td></tr>` : "")
      : V1_RATINGS.map((q, i) => line(q.bg, row[q.key], row[V1_COMMENTS[i]])).join("");
    const total = answer.ratings.reduce((s, v) => s + v, 0);
    const subject = `⚠️ Ниска оценка от ${esc(e.full_name)} · Маргел 360°`;
    const html = `<!doctype html><html lang="bg"><body style="margin:0;padding:24px;background:#F6F1E8;font-family:${SANS};color:#1A1815">
  <div style="max-width:600px;margin:0 auto;background:#FDFBF7;padding:28px 32px;border-left:4px solid #e05252">
    <h2 style="margin:0 0 6px;font:500 20px/1.2 ${SERIF}">Изисква внимание</h2>
    <p style="margin:0 0 14px;font:13px/1.5 ${SANS};color:#7A7568">${esc(e.full_name)} · обща оценка ${total}/${answer.max * answer.ratings.length}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${lines}
    </table>
    <p style="margin:16px 0 0"><a href="${SITE}/admin/feedback.html" style="color:#B9894A;font-weight:600;text-decoration:none">Отвори впечатленията →</a></p>
  </div></body></html>`;
    await sendResend(to, subject, html);
    return { branch: "low_rating_alert" };
  }

  return { branch: "none" };
}

async function existingCode(enquiryId: string): Promise<{ code: string; percent: number } | null> {
  const { data, error } = await sb.from("discount_codes").select("code, percent")
    .eq("issued_for_enquiry_id", enquiryId).order("created_at", { ascending: true }).limit(1);
  // Never fall through to minting when the lookup itself failed.
  if (error) { console.error("code lookup failed:", error); throw new Error("code_lookup_failed"); }
  return data?.[0] ?? null;
}

// minted = this call created the code (the caller sends the code email then).
async function issueDiscountCode(enquiryId: string): Promise<{ code: string; percent: number; minted: boolean }> {
  const existing = await existingCode(enquiryId);
  if (existing) return { ...existing, minted: false };

  // Format: MG-XXXX-YYYY where each block is 4 chars from an unambiguous
  // alphabet (no 0/O, 1/I). 32^8 = 1.1 trillion combos, more than enough.
  const ALPHA = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const code = "MG-" +
      Array.from(bytes.slice(0, 4)).map(b => ALPHA[b % 32]).join("") + "-" +
      Array.from(bytes.slice(4, 8)).map(b => ALPHA[b % 32]).join("");
    const { error } = await sb.from("discount_codes").insert({
      code, percent: FEEDBACK_DISCOUNT_PERCENT, issued_for_enquiry_id: enquiryId,
    });
    if (!error) return { code, percent: FEEDBACK_DISCOUNT_PERCENT, minted: true };
    if (error.code !== "23505") {
      console.error("code insert failed:", error);
      throw new Error("code_insert_failed");
    }
    // Unique violation: either a parallel submit already minted this
    // enquiry's code (one per enquiry) — hand that one back — or the random
    // code itself collided, so try another.
    const raced = await existingCode(enquiryId);
    if (raced) return { ...raced, minted: false };
  }
  throw new Error("code_collision");
}

async function sendDiscountEmail(to: string, fullName: string, code: string, percent: number, lang: Lang): Promise<boolean> {
  if (!to) return false;
  const c = COPY[lang];
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
  <tr><td style="padding:32px 44px 24px;border-bottom:1px solid rgba(185,137,74,0.35);font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;color:#1A1815;text-transform:uppercase">
    ${c.brand}&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em>
  </td></tr>
  <tr><td style="padding:40px 44px 32px">
    <p style="margin:0 0 8px;font:600 11px/1.2 ${SANS};letter-spacing:0.2em;color:#B9894A;text-transform:uppercase">${c.codeEyebrow}</p>
    <h1 style="margin:0 0 18px;font:400 36px/1.1 ${SERIF};color:#1A1815">${c.codeTitle(firstName(fullName))}</h1>
    <p style="margin:0 0 24px;font:16px/1.55 ${SANS};color:#2A2620">
      ${c.codeBody(percent)}
    </p>
    <div style="margin:0 0 28px;padding:22px;border:2px dashed #B9894A;background:#F6F1E8;text-align:center">
      <p style="margin:0 0 6px;font:600 11px/1.2 ${SANS};letter-spacing:0.18em;color:#7A7568;text-transform:uppercase">${c.codeLabel}</p>
      <p style="margin:0;font:600 26px/1.1 ${SERIF};letter-spacing:0.06em;color:#1A1815">${code}</p>
    </div>
    <p style="margin:0;font:13px/1.6 ${SANS};color:#7A7568">
      ${c.codeTerms}
    </p>
  </td></tr>
  <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}">
    <strong style="color:#C9A86A;text-transform:uppercase;letter-spacing:0.16em">${c.brand} 360°</strong> · ${c.footer}<br>
    <a href="mailto:360@margel.info" style="color:#F6F1E8;text-decoration:none">360@margel.info</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
  return await sendResend(to, c.codeSubject(percent, code), html);
}
