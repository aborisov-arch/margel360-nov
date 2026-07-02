function esc(s){ return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function fmt(iso){ if(!iso) return '—'; return new Date(iso).toLocaleString('bg-BG',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
    function avg(arr){ if(!arr.length) return 0; return arr.reduce((s,n)=>s+n,0)/arr.length; }

    const SOURCE_LABELS = { friends: 'Приятели', social: 'Социални мрежи', google: 'Google', other: 'Друго' };

    document.addEventListener('DOMContentLoaded', async () => {
      const session = await requireAuth();
      if (!session) return;

      const { data, error } = await db
        .from('event_feedback')
        .select('id, enquiry_id, experience_rating, experience_comment, service_rating, service_comment, venue_rating, venue_comment, source, source_other, rebook_rating, rebook_comment, submitted_at, enquiries(full_name, event_type, preferred_date, email)')
        .order('submitted_at', { ascending: false });

      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';

      if (error) {
        document.getElementById('content').innerHTML = `<p style="color:var(--accent);padding:20px 0">Грешка: ${esc(error.message)}</p>`;
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
              <span class="qa-block__rating">${rating ?? '—'}/4</span>
            </div>
            ${comment ? `<div class="qa-block__comment">„${esc(comment)}"</div>` : ''}
          </div>`;
        const sourceBlock = `
          <div class="qa-block">
            <div class="qa-block__q">
              <span class="qa-block__label">Откъде научиха</span>
            </div>
            <div class="qa-block__source">${esc(SOURCE_LABELS[r.source] || r.source || '—')}${r.source === 'other' && r.source_other ? `<em>— ${esc(r.source_other)}</em>` : ''}</div>
          </div>`;
        return `
          <div class="feedback-card">
            <div class="feedback-card__hdr">
              <div>
                <span class="feedback-card__name">${esc(e.full_name)}</span>
                <span class="feedback-card__meta"> · ${esc(e.event_type || '—')} · ${esc(e.preferred_date || '—')}</span>
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
