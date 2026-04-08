// Events data — pricing and images from margel360.bg
const events = [
  {
    title_bg: 'Корпоративно събитие',
    title_en: 'Corporate Event',
    desc_bg: 'Тематично фирмено парти, семинар или коктейл в мултифункционалната ни зала.',
    desc_en: 'Themed company party, seminar or cocktail in our multifunctional venue.',
    hours_bg: 'Дневно или вечерно',
    hours_en: 'Day or evening',
    price_bg: 'От 580 лв.',
    price_en: 'From €296',
    img: 'assets/images/event-corporate.jpg',
  },
  {
    title_bg: 'Детски рожден ден',
    title_en: "Children's Birthday",
    desc_bg: 'Широко пространство за игри, анимация и мини-диско за незабравим детски празник.',
    desc_en: 'Wide space for games, animation and mini-disco for an unforgettable kids\' party.',
    hours_bg: 'Дневно до 17:30 или вечерно',
    hours_en: 'Daytime until 5:30 PM or evening',
    price_bg: 'От 580 лв.',
    price_en: 'From €296',
    img: 'assets/images/event-birthday.jpg',
  },
  {
    title_bg: 'Сватба',
    title_en: 'Wedding',
    desc_bg: 'Магическа декорация в залата и тераса с изглед към Витоша — перфектна за вашия специален ден.',
    desc_en: 'Magical décor in the hall and a terrace overlooking Vitosha — perfect for your special day.',
    hours_bg: 'По договаряне',
    hours_en: 'By arrangement',
    price_bg: 'По запитване',
    price_en: 'On request',
    img: 'assets/images/event-wedding.jpg',
  },
  {
    title_bg: 'Вечерно събитие',
    title_en: 'Evening Event',
    desc_bg: 'Рафинираната атмосфера на Маргел 360° е идеалното място за всяко вечерно тържество.',
    desc_en: 'The refined atmosphere of Margel 360° is the perfect setting for any evening celebration.',
    hours_bg: 'Вечерно',
    hours_en: 'Evening',
    price_bg: 'От 680 лв.',
    price_en: 'From €347',
    img: 'assets/images/event-evening.jpg',
  },
  {
    title_bg: 'Коктейл и бизнес среща',
    title_en: 'Cocktail & Business',
    desc_bg: 'До 150 гости тип коктейл. Пълна аудио-визуална техника за презентации и срещи.',
    desc_en: 'Up to 150 guests cocktail style. Full AV equipment for presentations and meetings.',
    hours_bg: 'Гъвкаво работно време',
    hours_en: 'Flexible hours',
    price_bg: 'От 580 лв.',
    price_en: 'From €296',
    img: 'assets/images/event-corporate.jpg',
  },
];

const equipment = [
  { icon: '🔊', label_bg: '12 колони EV/YAMAHA 360°', label_en: '12 EV/YAMAHA speakers 360°' },
  { icon: '💡', label_bg: 'Модерно осветление', label_en: 'Modern lighting' },
  { icon: '🌿', label_bg: 'Панорамна тераса 260 м²', label_en: '260 m² panoramic terrace' },
  { icon: '🧊', label_bg: '2 ледогенератора 50л', label_en: '2 ice makers 50L each' },
  { icon: '🍽️', label_bg: 'Кетъринг оборудване', label_en: 'Catering equipment' },
  { icon: '🚗', label_bg: '70+ паркоместа', label_en: '70+ parking spaces' },
  { icon: '🎬', label_bg: 'Проектор и LED екран', label_en: 'Projector & LED screen' },
  { icon: '🛗', label_bg: 'Асансьор', label_en: 'Elevator' },
  { icon: '❄️', label_bg: '3 хладилни витрини', label_en: '3 refrigerated displays' },
  { icon: '🎤', label_bg: 'Микрофони', label_en: 'Microphones' },
  { icon: '🕺', label_bg: 'Танцова площадка', label_en: 'Dance floor' },
];

function setText(el, text) { el.textContent = text; }

function renderCards(lang) {
  const eventsGrid = document.getElementById('events-grid');
  if (eventsGrid) {
    eventsGrid.innerHTML = '';
    events.forEach((e, idx) => {
      const title = lang === 'bg' ? e.title_bg : e.title_en;
      const desc  = lang === 'bg' ? e.desc_bg  : e.desc_en;
      const hours = lang === 'bg' ? e.hours_bg : e.hours_en;
      const price = lang === 'bg' ? e.price_bg : e.price_en;

      const card = document.createElement('div');
      card.className = 'event-card fade-up delay-' + ((idx % 3) + 1);
      card.setAttribute('role', 'listitem');

      const imgWrap = document.createElement('div');
      imgWrap.className = 'event-card-img-wrap';
      const img = document.createElement('img');
      img.src = e.img;
      img.alt = title;
      img.loading = 'lazy';
      imgWrap.appendChild(img);

      const body = document.createElement('div');
      body.className = 'event-card-body';

      const h3 = document.createElement('h3');
      setText(h3, title);

      const p = document.createElement('p');
      p.style.fontSize = '0.88rem';
      p.style.marginTop = '8px';
      setText(p, desc);

      const meta = document.createElement('div');
      meta.className = 'event-card-meta';

      const hoursSpan = document.createElement('span');
      setText(hoursSpan, hours);

      const priceSpan = document.createElement('span');
      priceSpan.className = 'event-card-price';
      setText(priceSpan, price);

      meta.appendChild(hoursSpan);
      meta.appendChild(priceSpan);
      body.appendChild(h3);
      body.appendChild(p);
      body.appendChild(meta);
      card.appendChild(imgWrap);
      card.appendChild(body);
      eventsGrid.appendChild(card);
    });
    // Trigger animation observer on new elements
    if (window._animObserver) {
      eventsGrid.querySelectorAll('.fade-up').forEach(el => window._animObserver.observe(el));
    }
  }

  const equipGrid = document.getElementById('equip-grid');
  if (equipGrid) {
    equipGrid.innerHTML = '';
    equipment.forEach((item, idx) => {
      const label = lang === 'bg' ? item.label_bg : item.label_en;

      const el = document.createElement('div');
      el.className = 'equip-item fade-up delay-' + ((idx % 4) + 1);
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
    if (window._animObserver) {
      equipGrid.querySelectorAll('.fade-up').forEach(el => window._animObserver.observe(el));
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const lang = localStorage.getItem('margel_lang') || 'bg';
  renderCards(lang);
});

document.addEventListener('langChange', (e) => {
  renderCards(e.detail.lang);
});
