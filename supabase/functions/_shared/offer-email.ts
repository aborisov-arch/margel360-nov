// Branded cover-note email that carries the offer XLSX as an attachment.
// The full priced line items live in the attached spreadsheet (built client
// side by offer-export.js) — this email is the polished cover letter, so we
// deliberately do NOT recompute pricing here (keeps the venue price/sync-map
// logic in one place).

type OfferEnquiry = {
  full_name: string | null;
  preferred_date: string | null;
  event_type: string | null;
  guests: number | null;
  edit_token?: string | null;
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtDateBg(stored: string | null): string {
  return String(stored ?? "").replaceAll("/", ".");
}

const SERIF = "Fraunces,Georgia,'Times New Roman',serif";
const SANS  = "Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export function renderOfferEmail(e: OfferEnquiry, siteUrl: string): { subject: string; html: string } {
  const site = siteUrl.replace(/\/$/, "");
  const first = (e.full_name || "").split(" ")[0] || e.full_name || "";
  const dateBg = fmtDateBg(e.preferred_date);
  const subject = dateBg
    ? `Вашата оферта от Маргел 360° · ${dateBg}`
    : `Вашата оферта от Маргел 360°`;
  const editLine = e.edit_token
    ? `<p style="margin:0 0 24px;font:14px/1.6 ${SANS};color:#2A2620">Можете да прегледате и допълните резервацията си тук:
        <a href="${site}/edit.html?token=${esc(e.edit_token)}" style="color:#B9894A">отворете резервацията</a>.</p>`
    : "";
  const facts = [
    e.event_type ? `<strong>Събитие:</strong> ${esc(e.event_type)}` : "",
    dateBg ? `<strong>Дата:</strong> ${dateBg}` : "",
    e.guests ? `<strong>Гости:</strong> ${esc(e.guests)}` : "",
  ].filter(Boolean).join(" · ");

  const html = `<!doctype html><html lang="bg"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Manrope:wght@300;400;500;600;700&display=swap');</style>
</head><body style="margin:0;padding:0;background:#F6F1E8;font-family:${SANS};color:#1A1815">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F1E8;padding:32px 0">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF7;max-width:600px;width:100%">
      <tr><td style="padding:32px 44px 24px;border-bottom:1px solid rgba(185,137,74,0.35);font:500 18px/1.2 ${SERIF};letter-spacing:0.18em;color:#1A1815;text-transform:uppercase">
        Маргел&nbsp;<em style="font-style:italic;color:#B9894A;font-weight:400">360°</em>
      </td></tr>
      <tr><td style="padding:40px 44px 32px">
        <h1 style="margin:0 0 12px;font:400 36px/1.12 ${SERIF};color:#1A1815">Вашата <em style="font-style:italic;color:#B9894A">оферта</em></h1>
        <p style="margin:0 0 20px;font:16px/1.55 ${SANS};color:#2A2620">
          Здравейте, ${esc(first)}. Благодарим за интереса към Маргел 360°. Прикачили сме персонализирана оферта за вашето събитие${dateBg ? ` на ${dateBg}` : ""}.
        </p>
        ${facts ? `<p style="margin:0 0 20px;padding:14px 18px;border-left:3px solid #B9894A;background:#F6F1E8;font:14px/1.6 ${SANS};color:#1A1815">${facts}</p>` : ""}
        <p style="margin:0 0 20px;font:14px/1.6 ${SANS};color:#2A2620">
          Офертата е в прикачения файл (.pdf). За въпроси или потвърждение просто отговорете на този имейл или ни пишете на <a href="mailto:360@margel.info" style="color:#B9894A">360@margel.info</a>.
        </p>
        ${editLine}
      </td></tr>
      <tr><td style="padding:24px 44px;background:#1A1815;color:#C9A86A;font:11px/1.6 ${SANS}">
        <strong style="color:#C9A86A;text-transform:uppercase;letter-spacing:0.16em">Маргел 360°</strong> · бул. Околовръстен път 155 · ет. 4 · София<br>
        <a href="mailto:360@margel.info" style="color:#F6F1E8;text-decoration:none">360@margel.info</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  return { subject, html };
}
