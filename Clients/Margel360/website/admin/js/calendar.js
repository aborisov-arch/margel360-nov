let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-based (0 = January)
let occupiedDates = new Set();

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

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

async function loadOccupiedDates() {
  const { data, error } = await db.from('occupied_dates').select('date');
  if (error) {
    console.error('Failed to load occupied dates:', error);
    return;
  }
  occupiedDates = new Set(data.map(r => r.date));
}

function renderCalendar() {
  document.getElementById('calendar-month').textContent =
    `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  const gridEl = document.getElementById('calendar-grid');
  gridEl.innerHTML = '';

  // Day-of-week header labels (Monday first)
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(label => {
    const el = document.createElement('div');
    el.className = 'cal-day-label';
    el.textContent = label;
    gridEl.appendChild(el);
  });

  // Blank cells before the 1st of the month (Monday = 0, Sunday = 6)
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  const startOffset = (firstDayOfWeek + 6) % 7;
  for (let i = 0; i < startOffset; i++) {
    const el = document.createElement('div');
    el.className = 'cal-cell empty';
    el.setAttribute('aria-hidden', 'true');
    gridEl.appendChild(el);
  }

  // Day cells
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isOccupied = occupiedDates.has(dateStr);

    const btn = document.createElement('button');
    btn.className = 'cal-cell' + (isOccupied ? ' occupied' : '');
    btn.textContent = d;
    btn.setAttribute('aria-label',
      `${d} ${MONTH_NAMES[currentMonth]} ${currentYear}${isOccupied ? ' — occupied' : ''}`
    );
    btn.addEventListener('click', () => toggleDate(dateStr, btn));
    gridEl.appendChild(btn);
  }
}

async function toggleDate(dateStr, btn) {
  const wasOccupied = occupiedDates.has(dateStr);

  // Optimistic UI update — apply immediately
  if (wasOccupied) {
    occupiedDates.delete(dateStr);
    btn.classList.remove('occupied');
    btn.setAttribute('aria-label',
      btn.getAttribute('aria-label').replace(' — occupied', '')
    );
  } else {
    occupiedDates.add(dateStr);
    btn.classList.add('occupied');
    btn.setAttribute('aria-label', btn.getAttribute('aria-label') + ' — occupied');
  }

  // Persist to Supabase — revert on failure
  if (wasOccupied) {
    const { error } = await db.from('occupied_dates').delete().eq('date', dateStr);
    if (error) {
      console.error('Failed to unmark date:', error);
      // Revert
      occupiedDates.add(dateStr);
      btn.classList.add('occupied');
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') + ' — occupied');
    }
  } else {
    const { error } = await db.from('occupied_dates').insert({ date: dateStr });
    if (error) {
      console.error('Failed to mark date:', error);
      // Revert
      occupiedDates.delete(dateStr);
      btn.classList.remove('occupied');
      btn.setAttribute('aria-label',
        btn.getAttribute('aria-label').replace(' — occupied', '')
      );
    }
  }
}
