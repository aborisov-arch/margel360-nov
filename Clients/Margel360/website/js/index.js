// Events data
const events = [
  {
    title_bg: 'Корпоративни събития за 4 часа',
    title_en: 'Corporate Event 4h',
    hours_bg: '8:00–17:30',
    hours_en: '8:00–5:30 PM',
    price: '4 066.35 лв.'
  },
  {
    title_bg: 'Корпоративни събития за 8 часа',
    title_en: 'Corporate Event 8h',
    hours_bg: '8:00–17:30',
    hours_en: '8:00–5:30 PM',
    price: '4 083.52 лв.'
  },
  {
    title_bg: 'Детски рожден ден (дневно) до 17:30',
    title_en: 'Kids Birthday (daytime) until 5:30 PM',
    hours_bg: 'до 17:30',
    hours_en: 'until 5:30 PM',
    price: '4 064.24 лв.'
  },
  {
    title_bg: 'Детски рожден ден 5ч. вечерна, 16:00–24:00',
    title_en: 'Kids Birthday 5h evening, 4 PM–midnight',
    hours_bg: '16:00–24:00',
    hours_en: '4:00 PM–midnight',
    price: '4 065.25 лв.'
  },
  {
    title_bg: 'Сватба',
    title_en: 'Wedding',
    hours_bg: 'По договаряне',
    hours_en: 'By arrangement',
    price: '45 473.52 лв.'
  },
];

const equipment = [
  { icon: '🍸', label_bg: 'Собствен бар с оборудване', label_en: 'Own bar with equipment' },
  { icon: '🍽️', label_bg: 'Кетъринг зона', label_en: 'Catering area' },
  { icon: '🚻', label_bg: 'Тоалети', label_en: 'Toilets' },
  { icon: '🔊', label_bg: '360° Озвучаване', label_en: '360° Sound system' },
  { icon: '💡', label_bg: 'Модерно осветление', label_en: 'Modern lighting' },
  { icon: '🎬', label_bg: 'Проектор и екран', label_en: 'Projector and screen' },
  { icon: '🔒', label_bg: 'Видеонаблюдение и охрана', label_en: 'CCTV and security' },
  { icon: '❄️', label_bg: 'Климатизация', label_en: 'Air conditioning' },
  { icon: '📺', label_bg: 'Информационен монитор', label_en: 'Info display' },
  { icon: '🕺', label_bg: 'Танцова площадка', label_en: 'Dance floor' },
  { icon: '🌿', label_bg: 'Две открити площадки', label_en: 'Two outdoor areas' },
];

// Safe text setter — avoids XSS when inserting into DOM
function setText(el, text) {
  el.textContent = text;
}

function renderCards(lang) {
  const eventsGrid = document.getElementById('events-grid');
  if (eventsGrid) {
    eventsGrid.innerHTML = '';
    events.forEach(e => {
      const title = lang === 'bg' ? e.title_bg : e.title_en;
      const hours = lang === 'bg' ? e.hours_bg : e.hours_en;

      const card = document.createElement('div');
      card.className = 'event-card';
      card.setAttribute('role', 'listitem');

      const img = document.createElement('img');
      img.src = 'assets/images/placeholder.jpg';
      img.alt = title; // textContent-equivalent for alt — safe

      const body = document.createElement('div');
      body.className = 'event-card-body';

      const h3 = document.createElement('h3');
      setText(h3, title);

      const meta = document.createElement('div');
      meta.className = 'event-card-meta';

      const hoursSpan = document.createElement('span');
      setText(hoursSpan, hours);

      const priceSpan = document.createElement('span');
      priceSpan.className = 'event-card-price';
      setText(priceSpan, e.price);

      meta.appendChild(hoursSpan);
      meta.appendChild(priceSpan);
      body.appendChild(h3);
      body.appendChild(meta);
      card.appendChild(img);
      card.appendChild(body);
      eventsGrid.appendChild(card);
    });
  }

  const equipGrid = document.getElementById('equip-grid');
  if (equipGrid) {
    equipGrid.innerHTML = '';
    equipment.forEach(item => {
      const label = lang === 'bg' ? item.label_bg : item.label_en;

      const el = document.createElement('div');
      el.className = 'equip-item';
      el.setAttribute('role', 'listitem');

      const icon = document.createElement('div');
      icon.className = 'equip-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = item.icon;

      const span = document.createElement('span');
      setText(span, label);

      el.appendChild(icon);
      el.appendChild(span);
      equipGrid.appendChild(el);
    });
  }
}

// Initial render
document.addEventListener('DOMContentLoaded', () => {
  const lang = localStorage.getItem('margel_lang') || 'bg';
  renderCards(lang);
});

// Re-render on language change dispatched by main.js
document.addEventListener('langChange', (e) => {
  renderCards(e.detail.lang);
});
