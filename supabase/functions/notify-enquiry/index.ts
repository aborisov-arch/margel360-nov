import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { eventTypeBg, itemNameBg, paymentBg, timeOfDayBg } from "../_shared/labels-bg.ts";
import { partnerCategoryLabel } from "../_shared/enquiry-email.ts";

// notify-enquiry is fired by the database webhook on INSERT into
// enquiries. The webhook is configured in the Supabase dashboard with
// the X-Internal-Secret header (must match INTERNAL_SHARED_SECRET).
// Without this gate, anyone could POST a fake record and spam the team
// inbox with bogus "New enquiry" emails. Refuse if the secret is missing
// or empty (fail-closed if the env var is ever unset on deploy).
const INTERNAL_SECRET = Deno.env.get("INTERNAL_SHARED_SECRET") ?? "";

serve(async (req) => {
  try {
    if (!INTERNAL_SECRET) {
      console.error("INTERNAL_SHARED_SECRET not configured");
      return new Response(JSON.stringify({ error: "misconfigured" }), { status: 500 });
    }
    if (req.headers.get("x-internal-secret") !== INTERNAL_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorised" }), { status: 401 });
    }
    const payload = await req.json();
    const record = payload.record;

    if (!record) {
      return new Response(JSON.stringify({ error: "No record in payload" }), { status: 400 });
    }

    // Old BGN prices (pre-2026-05-04) — convert if the stored price exactly
    // matches the old BGN value for that addon id; otherwise treat as EUR.
    const ADDON_BGN_PRICES: Record<string, number> = {
      dj: 587, photo2: 340, photo4: 580, booth2: 390, booth4: 560,
      arch: 760, wall_s: 355, wall_g: 355, flare_s: 440, flare_l: 790,
      fountain_s: 96, fountain_l: 160, led: 290, mic: 97, proj: 180,
      security: 196, hygiene: 156, wardrobe: 176, valet: 275,
      carpet_l: 148, candles_h: 100, numbers: 68,
    };
    const addonEur = (id: string, p: number) => {
      const old = ADDON_BGN_PRICES[id];
      return old != null && p === old ? p / 1.95583 : p;
    };

    const addonsText = Array.isArray(record.addons) && record.addons.length
      ? record.addons.map((a: { id: string; name: string; price: number }) =>
          `  - ${itemNameBg(a)}: €${addonEur(a.id, a.price).toFixed(2)}`
        ).join("\n")
      : null;

    const drinksText = Array.isArray(record.drinks) && record.drinks.length
      ? record.drinks.map((d: { name: string; qty: number }) =>
          `  - ${itemNameBg(d)} × ${d.qty}`
        ).join("\n")
      : null;

    const partnersText = Array.isArray(record.partner_interest) && record.partner_interest.length
      ? record.partner_interest.map((p: { name: string; category: string }) =>
          `  - ${p.name} (${partnerCategoryLabel(p.category, "bg")})`
        ).join("\n")
      : null;

    const timeLabel = timeOfDayBg({ time_of_day: record.time_of_day });

    const refNo = record.enquiry_number != null ? `#${record.enquiry_number} ` : "";

    const body = [
      "Ново запитване в Маргел 360°",
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      ...(refNo ? [`Номер:          ${refNo.trim()}`] : []),
      `Име:            ${record.full_name}`,
      `Имейл:          ${record.email}`,
      `Телефон:        ${record.phone}`,
      "",
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `Събитие:        ${eventTypeBg(record)}`,
      `Дата:           ${record.preferred_date}`,
      `Час:            ${timeLabel}`,
      `Гости:          ${record.guests ?? "—"}`,
      `Плащане:        ${paymentBg(record.payment_method)}`,
      "",
      ...(addonsText ? ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "Допълнителни услуги:", addonsText, ""] : []),
      ...(drinksText ? ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "Напитки:", drinksText, ""] : []),
      ...(partnersText ? ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "Интерес към партньори (без заплащане):", partnersText, ""] : []),
      ...(record.notes ? ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "Бележки:", record.notes, ""] : []),
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
      "",
      `Изпратено на: ${new Date(record.created_at).toLocaleString("bg-BG", { timeZone: "Europe/Sofia" })}`,
    ].join("\n");

    const subject = `Ново запитване — ${refNo}${record.full_name} — ${eventTypeBg(record)}`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Margel360 <enquiries@margel360.bg>",
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
