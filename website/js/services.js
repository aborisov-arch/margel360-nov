const services = [
  {
    img:      'assets/images/services/svc-decoration.jpg',
    title_bg: 'Украса',
    title_en: 'Decoration',
    desc_bg:  'Персонализирана украса за вашето тържество.',
    desc_en:  'Personalised decoration for your celebration.',
    price:    '€182',
  },
  {
    img:      'assets/images/services/svc-photobooth.jpg',
    title_bg: 'Фото кабина 360° (2 часа)',
    title_en: 'Photo Booth 360° (2 hours)',
    desc_bg:  'Фото бутка 360градуса, RGB 100см.',
    desc_en:  '360° photo booth, RGB 100cm.',
    price:    '€199',
  },
  {
    img:      'assets/images/services/svc-photobooth.jpg',
    title_bg: 'Фото кабина 360° (4 часа)',
    title_en: 'Photo Booth 360° (4 hours)',
    desc_bg:  'Фото бутка 360градуса, RGB 100см.',
    desc_en:  '360° photo booth, RGB 100cm.',
    price:    '€286',
  },
  {
    img:      'assets/images/services/svc-dj-new.jpg',
    title_bg: 'DJ оборудване',
    title_en: 'DJ Equipment',
    desc_bg:  'DJ за 5часа, овъртайм 60 EUR/1 час.',
    desc_en:  'DJ for 5 hours, overtime 60 EUR/hour.',
    price:    '€300 / 5ч.',
  },
  {
    img:      'assets/images/services/svc-flowers.jpg',
    title_bg: 'Свещи и осветление',
    title_en: 'Candles & Lighting',
    desc_bg:  'Свещи в залата и терасата, светлинни фонтани.',
    desc_en:  'Candles in the hall and terrace, light fountains.',
    price:    '€51',
  },
  {
    img:      'assets/images/services/svc-valet.jpg',
    title_bg: 'Вале-паркинг',
    title_en: 'Valet Parking',
    desc_bg:  'Вале-паркинг за 5 часа, овъртайм €25/ч.',
    desc_en:  'Valet parking for 5 hours, overtime €25/hour.',
    price:    '€141 / 5ч.',
  },
  {
    img:      'assets/images/services/svc-security.jpg',
    title_bg: 'Охрана',
    title_en: 'Security',
    desc_bg:  'Охрана VTA, за 6 часа, 1 служител.',
    desc_en:  'VTA security, 6 hours, 1 officer.',
    price:    '€100 / 6ч.',
  },
  {
    img:      'assets/images/services/mic.jpg',
    title_bg: 'Микрофони',
    title_en: 'Microphones',
    desc_bg:  '3 броя + 1 брой тип брошка.',
    desc_en:  '3 units + 1 lapel microphone.',
    price:    '€50',
  },
  {
    img:      'assets/images/services/photographer.jpg',
    title_bg: 'Фотограф (2 часа)',
    title_en: 'Photographer (2 hours)',
    desc_bg:  'Професионален фотограф за вашето събитие.',
    desc_en:  'Professional photographer for your event.',
    price:    '€174',
  },
  {
    img:      'assets/images/services/photographer.jpg',
    title_bg: 'Фотограф (4 часа)',
    title_en: 'Photographer (4 hours)',
    desc_bg:  'Професионален фотограф за вашето събитие.',
    desc_en:  'Professional photographer for your event.',
    price:    '€297',
  },
  {
    img:      'assets/images/services/projector.jpg',
    title_bg: 'Мултимедия EPSON',
    title_en: 'EPSON Projector',
    desc_bg:  'Мултимедиен проектор за презентации и видео.',
    desc_en:  'Multimedia projector for presentations and video.',
    price:    '€92',
  },
  {
    img:      'assets/images/services/fireworks.jpg',
    title_bg: 'Заря 150–170 сек.',
    title_en: 'Fireworks 150–170s',
    desc_bg:  '150–170 секунди / 100 изстрела.',
    desc_en:  '150–170 seconds / 100 shots.',
    price:    '€225',
  },
  {
    img:      'assets/images/services/fireworks.jpg',
    title_bg: 'Заря 300–340 сек.',
    title_en: 'Fireworks 300–340s',
    desc_bg:  '300–340 секунди / 200 изстрела.',
    desc_en:  '300–340 seconds / 200 shots.',
    price:    '€404',
  },
  {
    img:      'assets/images/services/fountain-s.jpg',
    title_bg: 'Светлинен фонтан 1300мм',
    title_en: 'Light Fountain 1300mm',
    desc_bg:  'Светлинен фонтан Н 1300мм — 6 бр.',
    desc_en:  'Light fountain H 1300mm — 6 pcs.',
    price:    '€49',
  },
  {
    img:      'assets/images/services/fountain-l.jpg',
    title_bg: 'Светлинен фонтан 2600мм',
    title_en: 'Light Fountain 2600mm',
    desc_bg:  'Машина Н 2600мм — 2 бр.',
    desc_en:  'Machine H 2600mm — 2 pcs.',
    price:    '€82',
  },
  {
    img:      'assets/images/services/led.jpg',
    title_bg: 'Лед екран VIDEO/FOTO',
    title_en: 'LED Screen VIDEO/FOTO',
    desc_bg:  'Лед екран за VIDEO/FOTO 3800/2500мм.',
    desc_en:  'LED screen for VIDEO/PHOTO 3800/2500mm.',
    price:    '€148',
  },
  {
    img:      'assets/images/services/glow-numbers.jpg',
    title_bg: 'Светещи цифри',
    title_en: 'Glowing Numbers',
    desc_bg:  'Светещи Цифри Н=1100mm.',
    desc_en:  'Glowing numbers H=1100mm.',
    price:    '€35 / бр.',
  },
  {
    img:      'assets/images/services/arch.jpg',
    title_bg: 'Декоративна арка',
    title_en: 'Decorative Arch',
    desc_bg:  'Декоративна арка L3000 H1600 с осветление.',
    desc_en:  'Decorative arch L3000 H1600 with lighting.',
    price:    '€389',
  },
  {
    img:      'assets/images/services/wall-silver.jpg',
    title_bg: 'Декоративна стена SILVER',
    title_en: 'Decorative Wall SILVER',
    desc_bg:  'Декоративна стена SILVER L-3000 H2500.',
    desc_en:  'Decorative wall SILVER L-3000 H2500.',
    price:    '€182',
  },
  {
    img:      'assets/images/services/wall-gold.jpg',
    title_bg: 'Декоративна стена GOLD',
    title_en: 'Decorative Wall GOLD',
    desc_bg:  'Декоративна стена GOLD L-3000 H2500.',
    desc_en:  'Decorative wall GOLD L-3000 H2500.',
    price:    '€182',
  },
  {
    img:      'assets/images/services/heater.jpg',
    title_bg: 'Газова отоплителна гъба',
    title_en: 'Gas Patio Heater',
    desc_bg:  'Газова отоплителна гъба за терасата.',
    desc_en:  'Gas patio heater for the terrace.',
    price:    '€74 / бр.',
  },
  {
    img:      'assets/images/services/table-glow.jpg',
    title_bg: 'Маса светеща RGB',
    title_en: 'RGB Glowing Table',
    desc_bg:  'Маса светеща 1100мм Ф60см RGB.',
    desc_en:  'Glowing table 1100mm Ø60cm RGB.',
    price:    '€20 / бр.',
  },
  {
    img:      'assets/images/services/wardrobe.jpg',
    title_bg: 'Гардеробиер',
    title_en: 'Cloakroom Attendant',
    desc_bg:  'Гардеробиер за 5 часа, офъртайм 20 EUR/1 час.',
    desc_en:  'Cloakroom attendant for 5 hours, overtime 20 EUR/hour.',
    price:    '€90 / 5ч.',
  },
  {
    img:      'assets/images/services/redcarpet.jpg',
    title_bg: 'Червена пътека (6 бр.)',
    title_en: 'Red Carpet (6 pieces)',
    desc_bg:  'Червена пътека с оградни стойки и въже — 6 бр.',
    desc_en:  'Red carpet with barrier posts and rope — 6 pieces.',
    price:    '€65',
  },
  {
    img:      'assets/images/services/redcarpet.jpg',
    title_bg: 'Червена пътека (8 бр.)',
    title_en: 'Red Carpet (8 pieces)',
    desc_bg:  'Червена пътека с оградни стойки и въже — 8 бр.',
    desc_en:  'Red carpet with barrier posts and rope — 8 pieces.',
    price:    '€76',
  },
  {
    img:      'assets/images/services/candles.jpg',
    title_bg: 'Свещи в залата (60 бр.)',
    title_en: 'Hall Candles (60 pcs)',
    desc_bg:  'Декоративни свещи за залата — 60 броя.',
    desc_en:  'Decorative candles for the hall — 60 pieces.',
    price:    '€51',
  },
  {
    img:      'assets/images/services/candles-terrace.jpg',
    title_bg: 'Свещи на терасата (50 бр.)',
    title_en: 'Terrace Candles (50 pcs)',
    desc_bg:  'Декоративни свещи за терасата — 50 броя.',
    desc_en:  'Decorative candles for the terrace — 50 pieces.',
    price:    '€51',
  },
  {
    img:      'assets/images/services/heater-table.jpg',
    title_bg: 'Газова отоплителна маса',
    title_en: 'Gas Heating Table',
    desc_bg:  'Газова отоплителна маса за терасата.',
    desc_en:  'Gas heating table for the terrace.',
    price:    '€74 / бр.',
  },
  {
    img:      'assets/images/services/flipchart.jpg',
    title_bg: 'Флипчарт',
    title_en: 'Flipchart',
    desc_bg:  'Флипчарт за презентации и обучения.',
    desc_en:  'Flipchart for presentations and training.',
    price:    '€25',
  },
  {
    img:      'assets/images/services/hygienist.jpg',
    title_bg: 'Хигиенист',
    title_en: 'Hygienist',
    desc_bg:  'Хигиенист за 5 часа, овъртайм €20/ч.',
    desc_en:  'Hygienist for 5 hours, overtime €20/hour.',
    price:    '€80 / 5ч.',
  },
  {
    img:      'assets/images/services/cleaning.jpg',
    title_bg: 'Почистване на залата',
    title_en: 'Hall Cleaning',
    desc_bg:  'Цялостно почистване на залата след събитието.',
    desc_en:  'Full cleaning of the hall after the event.',
    price:    '€70',
  },
];

const lang = localStorage.getItem('margel_lang') || 'bg';
const grid = document.getElementById('services-grid');

function renderServices(currentLang) {
  if (!grid) return;
  grid.innerHTML = '';
  services.forEach(s => {
    const card = document.createElement('div');
    card.className = 'service-card';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'service-card-img';
    const img = document.createElement('img');
    img.src = s.img;
    img.alt = currentLang === 'bg' ? s.title_bg : s.title_en;
    img.loading = 'lazy';
    imgWrap.appendChild(img);

    const body = document.createElement('div');
    body.className = 'service-card-body';

    const h3 = document.createElement('h3');
    h3.textContent = currentLang === 'bg' ? s.title_bg : s.title_en;

    const p = document.createElement('p');
    p.textContent = currentLang === 'bg' ? s.desc_bg : s.desc_en;

    const price = document.createElement('p');
    price.className = 'service-card-price';
    price.textContent = s.price;

    body.appendChild(h3);
    body.appendChild(p);
    body.appendChild(price);
    card.appendChild(imgWrap);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

renderServices(lang);
document.addEventListener('langChange', e => renderServices(e.detail.lang));
