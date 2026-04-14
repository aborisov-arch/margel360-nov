let currentYear  = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-based
let occupiedDates = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  await loadOccupiedDates();
  renderCalendar();

  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });
});

// Called by admin-i18n.js on language switch
function rerenderPage() {
  renderCalendar();
}

async function loadOccupiedDates() {
  const { data, error } = await db.from('occupied_dates').select('date');
  if (error) {
    console.error('Failed to load occupied dates:', error);
    return;
  }
  occupiedDates = new Set(data.map(r => r.date));
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
