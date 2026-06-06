import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
          `  - ${a.name}: €${addonEur(a.id, a.price).toFixed(2)}`
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

    const refNo = record.enquiry_number != null ? `#${record.enquiry_number} ` : "";
    const subject = `New Enquiry — ${refNo}${record.full_name} — ${record.event_type}`;

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
