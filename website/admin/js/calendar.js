let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-based
let occupiedDates = new Set();
// Map of YYYY-MM-DD → [{ name, event_type, enquiry_id }, ...]
// Populated from confirmed/completed enquiries so the side panel can
// show who booked each red date.
let bookingsByDate = new Map();

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  await Promise.all([loadOccupiedDates(), loadBookings()]);
  renderCalendar();
  renderSidePanel();

  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
    renderSidePanel();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
    renderSidePanel();
  });
});

// Called by admin-i18n.js on language switch
function rerenderPage() {
  renderCalendar();
  renderSidePanel();
}

async function loadOccupiedDates() {
  const { data, error } = await db.from('occupied_dates').select('date');
  if (error) {
    console.error('Failed to load occupied dates:', error);
    return;
  }
  occupiedDates = new Set(data.map(r => r.date));
}

// Pull every confirmed/completed enquiry and group by event date so the
// side panel can show "DD.MM.YYYY — Name (Event type)" per booked day.
// preferred_date is stored as "DD/MM/YYYY"; convert to ISO YYYY-MM-DD.
async function loadBookings() {
  const { data, error } = await db
    .from('enquiries')
    .select('id, full_name, event_type, preferred_date, pipeline_status')
    .in('pipeline_status', ['confirmed', 'completed']);
  if (error) { console.error('Failed to load bookings:', error); return; }
  bookingsByDate = new Map();
  (data || []).forEach(e => {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(e.preferred_date || '');
    if (!m) return;
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    if (!bookingsByDate.has(iso)) bookingsByDate.set(iso, []);
    bookingsByDate.get(iso).push({
      name: e.full_name || '—',
      event_type: e.event_type || '',
      id: e.id,
    });
  });
}

function renderCalendar() {
  const months = t('months');
  document.getElementById('calendar-month').textContent =
    `${months[currentMonth]} ${currentYear}`;

  const gridEl = document.getElementById('calendar-grid');
  gridEl.innerHTML = '';

  // Day-of-week headers (Monday first)
  t('days_short').forEach(label => {
    const el = document.createElement('div');
    el.className = 'cal-day-label';
    el.textContent = label;
    gridEl.appendChild(el);
  });

  // Blank cells before the 1st (Monday = 0, Sunday = 6)
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const startOffset    = (firstDayOfWeek + 6) % 7;
  for (let i = 0; i < startOffset; i++) {
    const el = document.createElement('div');
    el.className = 'cal-cell empty';
    el.setAttribute('aria-hidden', 'true');
    gridEl.appendChild(el);
  }

  // Day cells
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr   = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isOccupied = occupiedDates.has(dateStr);

    const btn = document.createElement('button');
    btn.className = 'cal-cell' + (isOccupied ? ' occupied' : '');
    btn.textContent = d;
    btn.setAttribute('aria-label',
      `${d} ${t('months')[currentMonth]} ${currentYear}${isOccupied ? ' ' + t('cal_occupied_aria') : ''}`
    );
    btn.addEventListener('click', () => toggleDate(dateStr, btn));
    gridEl.appendChild(btn);
  }
}

async function toggleDate(dateStr, btn) {
  const wasOccupied = occupiedDates.has(dateStr);

  // Optimistic UI update
  if (wasOccupied) {
    occupiedDates.delete(dateStr);
    btn.classList.remove('occupied');
    btn.setAttribute('aria-label',
      btn.getAttribute('aria-label').replace(' ' + t('cal_occupied_aria'), '')
    );
  } else {
    occupiedDates.add(dateStr);
    btn.classList.add('occupied');
    btn.setAttribute('aria-label',
      btn.getAttribute('aria-label') + ' ' + t('cal_occupied_aria')
    );
  }

  // Persist to Supabase — revert on failure
  // Note: unmarking a date no longer force-unlocks any linked enquiries.
  // That cross-write was too risky (could bypass the edit_count cap, and
  // could remove a date that was manually occupied for unrelated reasons).
  // Admin unlocks enquiries explicitly via the dashboard row toggle.
  if (wasOccupied) {
    const { error } = await db.from('occupied_dates').delete().eq('date', dateStr);
    if (error) {
      console.error('Failed to unmark date:', error);
      occupiedDates.add(dateStr);
      btn.classList.add('occupied');
      btn.setAttribute('aria-label',
        btn.getAttribute('aria-label') + ' ' + t('cal_occupied_aria')
      );
    }
  } else {
    const { error } = await db.from('occupied_dates').insert({ date: dateStr });
    if (error) {
      console.error('Failed to mark date:', error);
      occupiedDates.delete(dateStr);
      btn.classList.remove('occupied');
      btn.setAttribute('aria-label',
        btn.getAttribute('aria-label').replace(' ' + t('cal_occupied_aria'), '')
      );
    }
  }
}

// Side-panel rendering — only the currently displayed month. For every
// occupied date in that month we either show the customer(s) who booked
// it (from bookingsByDate) OR a placeholder "Заето" pill when the date
// was marked occupied manually without an enquiry attached.
function renderSidePanel() {
  const wrap = document.getElementById('cal-bookings');
  if (!wrap) return;

  // Union of dates: bookings + manually-occupied dates, filtered to the
  // month the calendar is currently displaying. ISO format is YYYY-MM-DD
  // so a startsWith prefix is enough.
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-`;
  const inMonth = iso => iso.startsWith(monthPrefix);
  const allDates = new Set([...occupiedDates, ...bookingsByDate.keys()]);
  const sorted = Array.from(allDates).filter(inMonth).sort();
  if (!sorted.length) {
    wrap.innerHTML = `<div class="empty">Няма заети дати този месец.</div>`;
    return;
  }
  wrap.innerHTML = sorted.map(iso => {
    const [y, m, d] = iso.split('-');
    const dateLabel = `${d}.${m}.${y}`;
    const items = bookingsByDate.get(iso) || [];
    if (!items.length) {
      return `
        <button type="button" class="cal-booking unnamed" data-jump="${iso}">
          <span class="cal-booking__date">${dateLabel}</span>
          <span class="cal-booking__name">Заето (без запитване)</span>
        </button>
      `;
    }
    return items.map(b => `
      <button type="button" class="cal-booking" data-jump="${iso}">
        <span class="cal-booking__date">${dateLabel}</span>
        <span class="cal-booking__name">${esc(b.name)}</span>
        ${b.event_type ? `<span class="cal-booking__type">${esc(b.event_type)}</span>` : ''}
      </button>
    `).join('');
  }).join('');

  // Click a booking → jump the calendar to that month
  wrap.querySelectorAll('[data-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      const iso = btn.getAttribute('data-jump');
      const [y, m] = iso.split('-');
      currentYear = parseInt(y, 10);
      currentMonth = parseInt(m, 10) - 1;
      renderCalendar();
    });
  });
}

// HTML-escape — same helper as the other admin pages (dashboard.js has its
// own copy). Duplicated because this script doesn't load dashboard.js.
function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
