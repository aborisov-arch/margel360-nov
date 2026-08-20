// Events data - pricing and images from margel360.bg
// `detail` points at the dedicated sub-page where the longer description and
// gallery live. The card on the home page links here; the sub-page links
// onward to /reservation.html?event=<id>.
const events = [
  {
    id: 'evening',
    detail: 'evening.html',
    title_bg: 'Вечерно събитие',
    title_en: 'Evening Event',
    desc_bg: 'Вечерно тържество след 19:00ч. в Маргел 360° - за незабравима вечер с приятели и семейство.',
    desc_en: 'Evening celebration from 19:00 at Margel 360° - an unforgettable night with friends and family.',
    hours_bg: '5 часа',
    hours_en: '5 hours',
    price_bg: '€1350',
    price_en: '€1350',
    img: 'assets/images/event-evening.jpg',
  },
  {
    id: 'corporate',
    detail: 'corporate.html',
    title_bg: 'Корпоративно събитие',
    title_en: 'Corporate Event',
    desc_bg: 'Корпоративни събития 8:00-17:30. Фирмено парти, семинар или обучение с пълна АВ техника.',
    desc_en: 'Corporate events 8:00-17:30. Company party, seminar or training with full AV equipment.',
    hours_bg: '4 или 8 часа',
    hours_en: '4 or 8 hours',
    price_bg: '€330 - €440',
    price_en: '€330 - €440',
    img: 'assets/images/event-corporate.jpg',
  },
  {
    id: 'birthday',
    detail: 'birthday.html',
    title_bg: 'Детски рожден ден',
    title_en: "Children's Birthday",
    desc_bg: 'Детски рожден ден дневно или вечерно. Игри, анимация и мини-диско за незабравим празник.',
    desc_en: 'Children\'s birthday, daytime or evening. Games, animation and mini-disco.',
    hours_bg: 'Дневно или вечерно',
    hours_en: 'Daytime or evening',
    price_bg: '€700 - €970',
    price_en: '€700 - €970',
    img: 'assets/images/event-birthday.jpg',
  },
  {
    id: 'wedding',
    detail: 'wedding.html',
    title_bg: 'Сватба',
    title_en: 'Wedding',
    desc_bg: 'Магическа декорация в залата и тераса с изглед към Витоша - перфектна за вашия специален ден.',
    desc_en: 'Magical décor in the hall and a terrace overlooking Vitosha - perfect for your special day.',
    hours_bg: '6 часа',
    hours_en: '6 hours',
    price_bg: '€1500',
    price_en: '€1500',
    img: 'assets/images/event-wedding.jpg',
  },
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

      // Anchor so users can right-click / open in new tab and crawlers can
      // follow the link.
      const card = document.createElement('a');
      card.className = 'event-row fade-up delay-' + ((idx % 3) + 1);
      card.setAttribute('role', 'listitem');
      card.href = e.detail || ('reservation.html?event=' + e.id);

      const imgWrap = document.createElement('div');
      imgWrap.className = 'event-row__img-wrap';
      const img = document.createElement('img');
      img.src = e.img;
      img.alt = title;
      img.loading = 'lazy';
      imgWrap.appendChild(img);

      const body = document.createElement('div');
      body.className = 'event-row__body';

      const h3 = document.createElement('h3');
      h3.className = 'event-row__title';
      setText(h3, title);

      const p = document.createElement('p');
      p.className = 'event-row__desc';
      setText(p, desc);

      const meta = document.createElement('div');
      meta.className = 'event-row__meta';

      const hoursSpan = document.createElement('span');
      hoursSpan.className = 'event-row__dur';
      setText(hoursSpan, hours);

      const priceSpan = document.createElement('span');
      priceSpan.className = 'event-row__price';
      setText(priceSpan, price);

      meta.appendChild(hoursSpan);
      meta.appendChild(priceSpan);

      const cta = document.createElement('span');
      cta.className = 'event-row__cta';
      cta.textContent = lang === 'bg' ? 'Виж повече →' : 'Learn more →';

      body.appendChild(h3);
      body.appendChild(p);
      body.appendChild(meta);
      body.appendChild(cta);
      card.appendChild(imgWrap);
      card.appendChild(body);
      eventsGrid.appendChild(card);
    });
    // Trigger animation observer on new elements
    if (window._animObserver) {
      eventsGrid.querySelectorAll('.fade-up').forEach(el => window._animObserver.observe(el));
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
