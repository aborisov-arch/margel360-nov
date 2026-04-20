const faqs = [
  {
    q_bg: 'Колко човека събира залата?',
    q_en: 'How many people does the venue hold?',
    a_bg: 'Маргел 360° побира до 100 гости на маса и до 140 гости на коктейл. Залата се намира на бул. Околовръстен път 155, ет.4, София 1618.',
    a_en: 'Margel 360° holds up to 100 seated guests and up to 140 for cocktail events. Located at 155 Okolovrsten Pat Blvd, 4th floor, Sofia 1618.'
  },
  {
    q_bg: 'Може ли да си доведем кетъринг?',
    q_en: 'Can we bring our own catering?',
    a_bg: 'Да, в зала Маргел 360° можете да ползвате собствен кетъринг. Разполагаме с напълно оборудвана кухня на адрес бул. Околовръстен път 155, ет.4, София.',
    a_en: 'Yes, you can bring your own catering to Margel 360°. We have a fully equipped kitchen at 155 Okolovrsten Pat Blvd, 4th floor, Sofia.'
  },
  {
    q_bg: 'Може ли да си доведем музика?',
    q_en: 'Can we bring our own DJ or band?',
    a_bg: 'Да, можете да доведете свой DJ или жива музика. Маргел 360° разполага с пълна звукова система — 12 колони EV/YAMAHA 360°.',
    a_en: 'Yes, you can bring your own DJ or live band. Margel 360° has a full sound system — 12 EV/YAMAHA 360° speakers.'
  },
  {
    q_bg: 'Може ли да видим залата преди резервация?',
    q_en: 'Can we visit the venue before booking?',
    a_bg: 'Разбира се! Свържете се с нас на 0888 100 042 или 360@margel.info, за да уговорим посещение на зала Маргел 360°, бул. Околовръстен път 155, ет.4, София.',
    a_en: 'Of course! Contact us at 0888 100 042 or 360@margel.info to arrange a visit to Margel 360°, 155 Okolovrsten Pat Blvd, 4th floor, Sofia.'
  },
  {
    q_bg: 'До колко часа може да продължи събитието?',
    q_en: 'Until what time can events run?',
    a_bg: 'Вечерните тържества в Маргел 360° могат да продължат до 24:00 часа. Дневните събития приключват до 17:30 ч.',
    a_en: 'Evening events at Margel 360° can run until midnight. Daytime events end at 17:30.'
  },
  {
    q_bg: 'Има ли паркинг?',
    q_en: 'Is there parking?',
    a_bg: 'Да, Маргел 360° разполага с 70+ безплатни паркоместа на бул. Околовръстен път 155, София 1618.',
    a_en: 'Yes, Margel 360° has 70+ free parking spaces at 155 Okolovrsten Pat Blvd, Sofia 1618.'
  },
  {
    q_bg: 'Шумът от музиката пречи ли на съседите?',
    q_en: 'Does the music volume disturb neighbours?',
    a_bg: 'Не. Зала Маргел 360° е напълно звукоизолирана, така че шумът не излиза извън нея.',
    a_en: 'No. Margel 360° is fully soundproofed so noise does not escape outside.'
  },
  {
    q_bg: 'Какво е включено в наема на залата?',
    q_en: 'What is included in the venue rental?',
    a_bg: 'В наема на зала Маргел 360° са включени: 12 колони EV/YAMAHA звукова система, професионално осветление, бар с ледогенератори, 3 хладилни витрини, маси и столове, климатизация, асансьор, танцова площадка и 70+ безплатни паркоместа.',
    a_en: 'Margel 360° rental includes: 12 EV/YAMAHA speakers, professional lighting, bar with ice makers, 3 fridges, tables and chairs, air conditioning, elevator, dance floor, and 70+ free parking spaces.'
  },
  {
    q_bg: 'С какво оборудване разполага залата?',
    q_en: 'What equipment does the venue have?',
    a_bg: 'Маргел 360° разполага с: 12 колони EV/YAMAHA, проектор и екран, модерно LED осветление, бар, оборудвана кухня, панорамна тераса 260м² и 70+ паркоместа. Цени за наем от €330 (4ч. корпоративно) до €1500 (сватба).',
    a_en: 'Margel 360° has: 12 EV/YAMAHA speakers, projector and screen, modern LED lighting, bar, equipped kitchen, 260m² panoramic terrace, and 70+ parking spaces. Rental from €330 (4h corporate) to €1500 (wedding).'
  },
  {
    q_bg: 'Какви допълнителни услуги се предлагат?',
    q_en: 'What additional services are available?',
    a_bg: 'Маргел 360° предлага над 20 допълнителни услуги: DJ за 5 часа (€300), фотограф 2ч. (€174) или 4ч. (€297), фото будка 360° (€199–€286), декоративна арка (€389), LED екран (€148), охрана VTA (€100) и още.',
    a_en: 'Margel 360° offers 20+ additional services: DJ 5h (€300), photographer 2h (€174) or 4h (€297), 360° photo booth (€199–€286), decorative arch (€389), LED screen (€148), VTA security (€100) and more.'
  },
  {
    q_bg: 'Може ли да видим снимки от минали събития?',
    q_en: 'Can we see photos from past events?',
    a_bg: 'Да! Разгледайте галерията на margel360.bg/gallery.html или нашата Facebook страница facebook.com/margel360/ за снимки от сватби, рождени дни и корпоративни събития в залата.',
    a_en: 'Yes! Check our gallery at margel360.bg/gallery.html or facebook.com/margel360/ for photos of weddings, birthdays, and corporate events at the venue.'
  },
  {
    q_bg: 'Какви са цените за наем на залата?',
    q_en: 'What are the rental prices?',
    a_bg: 'Цените в Маргел 360°: корпоративно 4ч. — €330, корпоративно 8ч. — €440, детски рожден ден дневен — €700, вечерен — €970, вечерно събитие — €1280, сватба — €1500.',
    a_en: 'Margel 360° prices: corporate 4h — €330, corporate 8h — €440, children\'s birthday daytime — €700, evening — €970, evening event — €1280, wedding — €1500.'
  },
];

document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('faq-list');
  const lang = localStorage.getItem('margel_lang') || 'bg';

  function renderFaq(currentLang) {
    if (!list) return;
    const items = list.querySelectorAll('.faq-item');
    items.forEach((item, i) => {
      if (!faqs[i]) return;
      const qSpan = item.querySelector('[itemprop="name"]');
      const aP    = item.querySelector('[itemprop="text"]');
      if (qSpan) qSpan.textContent = currentLang === 'bg' ? faqs[i].q_bg : faqs[i].q_en;
      if (aP)    aP.textContent    = currentLang === 'bg' ? faqs[i].a_bg : faqs[i].a_en;
    });
  }

  list?.addEventListener('click', e => {
    const btn = e.target.closest('.faq-question');
    if (!btn) return;
    const item   = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    list.querySelectorAll('.faq-item.open').forEach(el => {
      el.classList.remove('open');
      el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });

  renderFaq(lang);
  document.addEventListener('langChange', e => renderFaq(e.detail.lang));
});
