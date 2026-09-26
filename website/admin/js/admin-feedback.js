function esc(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function fmt(iso){ if(!iso) return '-'; return new Date(iso).toLocaleString('bg-BG',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
    function avg(arr){ if(!arr.length) return 0; return arr.reduce((s,n)=>s+n,0)/arr.length; }

    const SOURCE_LABELS = { friends: 'Приятели', social: 'Социални мрежи', google: 'Google', other: 'Друго' };

    // ── Survey delivery ── mirrors send-feedback-request: confirmed/completed
    // events get the survey around 12:00 Sofia the day after; a failed run is
    // retried while the event is at most CATCH_UP_DAYS old; one reminder
    // follows 3 days after the first email while that email is at most
    // RESEND_MAX_AGE_DAYS old and nothing was submitted.
    const CATCH_UP_DAYS = 7, RESEND_MAX_AGE_DAYS = 10, DELIVERY_ROWS = 15;
    const SOFIA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' });

    // Day number (days since 1970-01-01) of the Sofia calendar date of an instant.
    function sofiaDay(date) {
      const p = Object.fromEntries(SOFIA_DAY.formatToParts(date).map(x => [x.type, x.value]));
      return Date.UTC(+p.year, +p.month - 1, +p.day) / 86400000;
    }
    // preferred_date is stored as "DD/MM/YYYY".
    function eventDay(stored) {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(stored || '');
      return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86400000 : null;
    }
    function fmtSofia(iso) {
      return new Date(iso).toLocaleString('bg-BG', { timeZone: 'Europe/Sofia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function renderDelivery(events, answeredAt) {
      const el = document.getElementById('delivery');
      const today = sofiaDay(new Date());
      const past = events
        .map(e => ({ ...e, day: eventDay(e.preferred_date) }))
        .filter(e => e.day !== null && e.day < today)
        .sort((a, b) => b.day - a.day || b.enquiry_number - a.enquiry_number);

      if (!past.length) {
        el.innerHTML = '<p style="color:#777;padding:8px 0">Все още няма минали потвърдени събития.</p>';
        return;
      }

      const n = { sent: 0, ontime: 0, late: 0, missing: 0, wait: 0, answered: 0 };
      const rows = past.map(e => {
        const answered = answeredAt[e.id];
        if (answered) n.answered++;
        let survey;
        if (e.feedback_sent_at) {
          n.sent++;
          const after = sofiaDay(new Date(e.feedback_sent_at)) - e.day;
          const when = `<small>${esc(fmtSofia(e.feedback_sent_at))}</small>`;
          if (after <= 1) { n.ontime++; survey = `<span class="status-badge fb-ok">На следващия ден</span><br>${when}`; }
          else { n.late++; survey = `<span class="status-badge fb-late">След ${after} дни</span><br>${when}`; }
        } else if (e.email && today - e.day <= CATCH_UP_DAYS) {
          n.wait++; survey = '<span class="status-badge fb-wait">Предстои</span><br><small>около 12:00 ч.</small>';
        } else {
          n.missing++; survey = `<span class="status-badge fb-missing">${e.email ? 'Не е изпратена' : 'Няма имейл'}</span>`;
        }
        const reminderDue = e.feedback_sent_at && !answered
          && Date.now() - Date.parse(e.feedback_sent_at) < RESEND_MAX_AGE_DAYS * 86400000;
        const reminder = e.feedback_resent_at ? `<span>${esc(fmtSofia(e.feedback_resent_at))}</span>`
          : `<span class="fb-muted">${reminderDue ? 'Предстои' : '—'}</span>`;
        const answer = answered
          ? `<span class="status-badge fb-ok">Попълнена</span><br><small>${esc(fmtSofia(answered))}</small>`
          : `<span class="fb-muted">${e.feedback_sent_at ? 'Няма отговор' : '—'}</span>`;
        return `<tr>
          <td>${esc(String(e.preferred_date).replaceAll('/', '.'))}</td>
          <td><strong>${esc(e.full_name)}</strong><br><small>№${esc(e.enquiry_number)} · ${esc(eventTypeBg(e) || '-')}</small></td>
          <td>${survey}</td>
          <td>${reminder}</td>
          <td>${answer}</td>
        </tr>`;
      });

      const pct = n.sent ? ` (${Math.round(n.answered / n.sent * 100)}%)` : '';
      el.innerHTML = `
        <div class="feedback-summary">
          <div><span class="lbl">Минали събития</span><span class="val">${past.length}</span></div>
          <div><span class="lbl">На следващия ден</span><span class="val">${n.ontime}</span></div>
          <div><span class="lbl">Със закъснение</span><span class="val">${n.late}</span></div>
          <div><span class="lbl">Неизпратени</span><span class="val">${n.missing}</span></div>
          ${n.wait ? `<div><span class="lbl">Предстоят</span><span class="val">${n.wait}</span></div>` : ''}
          <div><span class="lbl">Попълнени</span><span class="val">${n.answered}<small>${pct}</small></span></div>
        </div>
        <table class="customers-table fb-delivery-table">
          <thead><tr><th>Събитие</th><th>Клиент</th><th>Анкета</th><th>Напомняне</th><th>Отговор</th></tr></thead>
          <tbody>${rows.slice(0, DELIVERY_ROWS).join('')}</tbody>
        </table>
        ${rows.length > DELIVERY_ROWS ? `<button type="button" class="btn btn-outline btn-sm fb-more" id="fb-more">Покажи всички (${rows.length})</button>` : ''}`;

      const more = document.getElementById('fb-more');
      if (more) more.addEventListener('click', () => {
        el.querySelector('tbody').innerHTML = rows.join('');
        more.remove();
      });
    }

    document.addEventListener('DOMContentLoaded', async () => {
      const session = await requireAuth();
      if (!session) return;

      const [{ data, error }, events] = await Promise.all([
        db.from('event_feedback')
          .select('id, enquiry_id, experience_rating, experience_comment, service_rating, service_comment, venue_rating, venue_comment, source, source_other, rebook_rating, rebook_comment, submitted_at, enquiries(full_name, event_type, preferred_date, email)')
          .order('submitted_at', { ascending: false }),
        db.from('enquiries')
          .select('id, enquiry_number, full_name, email, event_type, event_id, preferred_date, feedback_sent_at, feedback_resent_at')
          .in('pipeline_status', ['confirmed', 'completed']),
      ]);

      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';

      const loadErr = events.error || error;
      if (loadErr) {
        document.getElementById('delivery').innerHTML = `<p style="color:var(--accent);padding:8px 0">Грешка: ${esc(loadErr.message)}</p>`;
      } else {
        // Earliest submission per enquiry (a customer may re-submit).
        const answeredAt = {};
        (data ?? []).forEach(r => {
          if (!answeredAt[r.enquiry_id] || r.submitted_at < answeredAt[r.enquiry_id]) answeredAt[r.enquiry_id] = r.submitted_at;
        });
        renderDelivery(events.data ?? [], answeredAt);
      }

      if (error) {
        document.getElementById('summary').innerHTML = `<p style="color:var(--accent);padding:20px 0">Грешка: ${esc(error.message)}</p>`;
        return;
      }

      const rows = data ?? [];
      const sumEl = document.getElementById('summary');

      if (rows.length === 0) {
        sumEl.innerHTML = '<div class="feedback-summary"><div><span class="lbl">Получени</span><span class="val">0</span></div></div>';
        document.getElementById('list').innerHTML = '<p style="color:#777;padding:20px 0">Все още няма впечатления.</p>';
        return;
      }

      const a1 = avg(rows.map(r => r.experience_rating).filter(Boolean));
      const a2 = avg(rows.map(r => r.service_rating).filter(Boolean));
      const a3 = avg(rows.map(r => r.venue_rating).filter(Boolean));
      const a5 = avg(rows.map(r => r.rebook_rating).filter(Boolean));

      const srcCounts = { friends: 0, social: 0, google: 0, other: 0 };
      rows.forEach(r => { if (r.source && srcCounts[r.source] != null) srcCounts[r.source]++; });

      sumEl.innerHTML = `
        <div class="feedback-summary">
          <div><span class="lbl">Получени</span><span class="val">${rows.length}</span></div>
          <div><span class="lbl">Преживяване</span><span class="val">${a1.toFixed(1)}<small>/4</small></span></div>
          <div><span class="lbl">Обслужване</span><span class="val">${a2.toFixed(1)}<small>/4</small></span></div>
          <div><span class="lbl">Зала</span><span class="val">${a3.toFixed(1)}<small>/4</small></span></div>
          <div><span class="lbl">Резервация отново</span><span class="val">${a5.toFixed(1)}<small>/4</small></span></div>
        </div>
        <div class="feedback-summary" style="display:block">
          <span class="lbl" style="display:block;margin-bottom:10px;font-size:0.7rem;letter-spacing:0.14em;color:#888;text-transform:uppercase;font-weight:600">Откъде научиха за нас</span>
          <div class="source-bars">
            <div class="source-bars__cell"><span class="lbl">Приятели</span><span class="val">${srcCounts.friends}</span></div>
            <div class="source-bars__cell"><span class="lbl">Соц. мрежи</span><span class="val">${srcCounts.social}</span></div>
            <div class="source-bars__cell"><span class="lbl">Google</span><span class="val">${srcCounts.google}</span></div>
            <div class="source-bars__cell"><span class="lbl">Друго</span><span class="val">${srcCounts.other}</span></div>
          </div>
        </div>
      `;

      document.getElementById('list').innerHTML = rows.map(r => {
        const e = r.enquiries || {};
        const qa = (label, rating, comment) => `
          <div class="qa-block">
            <div class="qa-block__q">
              <span class="qa-block__label">${esc(label)}</span>
              <span class="qa-block__rating">${rating ?? '-'}/4</span>
            </div>
            ${comment ? `<div class="qa-block__comment">„${esc(comment)}"</div>` : ''}
          </div>`;
        const sourceBlock = `
          <div class="qa-block">
            <div class="qa-block__q">
              <span class="qa-block__label">Откъде научиха</span>
            </div>
            <div class="qa-block__source">${esc(SOURCE_LABELS[r.source] || r.source || '-')}${r.source === 'other' && r.source_other ? `<em>- ${esc(r.source_other)}</em>` : ''}</div>
          </div>`;
        return `
          <div class="feedback-card">
            <div class="feedback-card__hdr">
              <div>
                <span class="feedback-card__name">${esc(e.full_name)}</span>
                <span class="feedback-card__meta"> · ${esc(eventTypeBg(e) || '-')} · ${esc(e.preferred_date || '-')}</span>
              </div>
              <span class="feedback-card__meta">${fmt(r.submitted_at)}</span>
            </div>
            ${qa('Преживяване', r.experience_rating, r.experience_comment)}
            ${qa('Обслужване', r.service_rating, r.service_comment)}
            ${qa('Зала', r.venue_rating, r.venue_comment)}
            ${sourceBlock}
            ${qa('Резервация отново', r.rebook_rating, r.rebook_comment)}
          </div>
        `;
      }).join('');
    });
