const faqs = [
  { q_bg: 'Колко човека събира залата?', q_en: 'How many people does the venue hold?',
    a_bg: 'През летния сезон, с използване на панорамната тераса, Маргел 360° побира между 140 и 180 гости. През зимния сезон капацитетът е между 100 и 120 гости. Залата се намира на бул. „Околовръстен път“ №155, ет. 4, София 1618.',
    a_en: 'In summer, with the terrace in use, Margel 360° hosts between 140 and 180 guests. In winter the capacity is 100–120 guests. The venue is at 155 Okolovrasten pat, 4th floor, Sofia 1618.' },
  { q_bg: 'Може ли да ползваме собствен кетъринг?', q_en: 'Can we bring our own catering?',
    a_bg: 'Да, можете да ползвате собствен кетъринг. На Ваше разположение са хладилни витрини за вино и безалкохолни напитки, както и кафемашина с безплатно кафе. Залата не разполага с напълно оборудвана кухня, затова кетърингът трябва да бъде доставен готов за сервиране.',
    a_en: 'Yes, you can bring your own catering. We provide refrigerated displays for wine and soft drinks and a coffee machine with complimentary coffee. The venue does not have a full kitchen — catering should arrive ready to serve.' },
  { q_bg: 'Може ли да осигурим собствена музика?', q_en: 'Can we bring our own DJ or band?',
    a_bg: 'Да, можете да поканите собствен диджей или живо изпълнение. Залата разполага с професионална 360° озвучителна система с 12 тонколони EV/YAMAHA.',
    a_en: 'Yes, you can bring your own DJ or live band. Margel 360° has a full sound system — 12 EV/YAMAHA 360° speakers.' },
  { q_bg: 'Може ли да видим залата преди резервация?', q_en: 'Can we visit the venue?',
    a_bg: 'Разбира се. Свържете се с нас на 0888 100 042 или 360@margel.info и ще организираме оглед на залата в удобно за Вас време.',
    a_en: 'Of course! Contact us at +359 888 100 042 or 360@margel.info to arrange a viewing.' },
  { q_bg: 'До колко часа може да продължи събитието?', q_en: 'Until what time can events run?',
    a_bg: 'Вечерните тържества могат да продължат без фиксиран краен час — толкова, колкото желаете. За всеки започнат час над предварително договореното време се начислява такса за извънреден час. Дневните събития приключват до 17:30 ч.',
    a_en: 'Evening events can run as late as you wish — there is no mandatory end time. An overtime fee applies for each hour beyond the booked duration. Daytime events wrap up by 17:30.' },
  { q_bg: 'Има ли паркинг?', q_en: 'Is there parking?',
    a_bg: 'Да. Залата разполага с над 70 безплатни паркоместа непосредствено пред входа, на бул. „Околовръстен път“ №155, София 1618.',
    a_en: 'Yes, Margel 360° has 70+ free parking spaces right in front of the venue at 155 Okolovrasten pat, Sofia 1618.' },
  { q_bg: 'Шумът от музиката пречи ли на съседите?', q_en: 'Does the music volume disturb neighbours?',
    a_bg: 'Не. Залата се намира в район без жилищни сгради в близост, поради което музиката не безпокои никого — дори при максимална сила.',
    a_en: 'No. The venue sits in an area without nearby residential buildings, so the music does not disturb anyone — even at full volume.' },
  { q_bg: 'Какво е включено в наема на залата?', q_en: 'What is included in the venue rental?',
    a_bg: 'В наема на Маргел 360° са включени: професионално 360° озвучаване (12 тонколони EV/YAMAHA), модерно осветление, панорамна тераса 360 м² с изглед към Витоша, 16 коктейлни маси тип „щъркел“ с еластични покривки, 40 бар стола, бар с два ледогенератора, хладилни витрини за вино и безалкохолни напитки, миялна машина, кафемашина с безплатно кафе, мъжка и дамска тоалетна, климатизация, асансьор, танцова площадка и над 70 безплатни паркоместа.',
    a_en: 'The Margel 360° rental includes: professional 360° sound (12 EV/YAMAHA speakers), modern lighting, a 360 m² panoramic terrace overlooking Vitosha, 16 cocktail tables with stretch covers, 40 bar stools, a bar with 2 ice makers, refrigerated displays for wine and soft drinks, a dishwasher, a coffee machine with complimentary coffee, men\'s and women\'s restrooms, air conditioning, an elevator, a dance floor, and 70+ free parking spaces.' },
  { q_bg: 'С какво оборудване разполага залата?', q_en: 'What equipment does the venue have?',
    a_bg: 'Залата е оборудвана с професионална 360° озвучителна система (12 тонколони EV/YAMAHA), мултимедиен проектор с екран, модерно LED осветление, бар, панорамна тераса 360 м² и над 70 безплатни паркоместа. Цените за наем са от €330 (корпоративно събитие, 4 часа) до €1500 (сватба).',
    a_en: 'Margel 360° features 12 EV/YAMAHA speakers, a projector and screen, modern LED lighting, a bar, a 360 m² panoramic terrace and 70+ parking spaces. Rental prices from €330 (4h corporate) to €1500 (wedding).' },
  { q_bg: 'Какви допълнителни услуги се предлагат?', q_en: 'What additional services are offered?',
    a_bg: 'Предлагаме над 20 допълнителни услуги: диджей за 5 часа (€300), фотограф за 2 часа (€174) или 4 часа (€297), фото будка 360° (€199–€286), декоративна арка с осветление (€389), LED екран (€148), охрана VTA (€100) и други. Пълният списък можете да видите в раздел „Услуги“.',
    a_en: 'Margel 360° offers 20+ optional services: DJ for 5 hours (€300), photographer 2h (€174) or 4h (€297), 360° photo booth (€199–€286), decorative arch (€389), LED screen (€148), VTA security (€100) and more.' },
  { q_bg: 'Може ли да видим снимки от минали събития?', q_en: 'Can we see photos from past events?',
    a_bg: 'Да. Разгледайте нашата галерия на margel360.bg/gallery.html или Facebook страницата ни facebook.com/margel360 за снимки от сватби, рождени дни и корпоративни събития.',
    a_en: 'Yes! Browse the gallery at margel360.bg/gallery.html or our Facebook page facebook.com/margel360/ for photos of weddings, birthdays and corporate events.' },
  { q_bg: 'Какви са цените за наем на залата?', q_en: 'What are the rental prices?',
    a_bg: 'Цените за наем са: корпоративно събитие 4 часа — €330; корпоративно 8 часа — €440; детски рожден ден (дневен) — €700; детски рожден ден (вечерен) — €970; вечерно тържество — €1280; сватба — €1500. Цените са ориентировъчни — за индивидуална оферта се свържете с нас.',
    a_en: 'Margel 360° pricing: corporate 4h — €330, corporate 8h — €440, children\'s birthday daytime — €700, evening — €970, evening event — €1280, wedding — €1500.' },
];

const lang = localStorage.getItem('margel_lang') || 'bg';
const list = document.getElementById('faq-list');

function renderFaq(currentLang) {
  if (!list) return;
  list.innerHTML = '';
  faqs.forEach(faq => {
    const item = document.createElement('div');
    item.className = 'faq-item';

    const btn = document.createElement('button');
    btn.className = 'faq-question';
    btn.setAttribute('aria-expanded', 'false');

    const questionText = document.createElement('span');
    questionText.textContent = currentLang === 'bg' ? faq.q_bg : faq.q_en;

    const icon = document.createElement('span');
    icon.className = 'faq-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '+';

    btn.appendChild(questionText);
    btn.appendChild(icon);

    const answer = document.createElement('div');
    answer.className = 'faq-answer';
    const p = document.createElement('p');
    p.textContent = currentLang === 'bg' ? faq.a_bg : faq.a_en;
    answer.appendChild(p);

    btn.addEventListener('click', () => {
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

    item.appendChild(btn);
    item.appendChild(answer);
    list.appendChild(item);
  });
}

renderFaq(lang);

document.addEventListener('langChange', e => renderFaq(e.detail.lang));
