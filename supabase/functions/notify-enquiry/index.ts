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
