const services = [
  {
    img:      'assets/images/services/svc-decoration.jpg',
    title_bg: 'Украса',
    title_en: 'Decoration',
    desc_bg:  'Персонализирана украса за вашето тържество.',
    desc_en:  'Personalised decoration for your celebration.',
    price:    '€181.51',
  },
  {
    img:      'assets/images/services/svc-photobooth.jpg',
    title_bg: 'Фото кабина 360°',
    title_en: 'Photo Booth 360°',
    desc_bg:  'Фото бутка 360°, RGB 100см.',
    desc_en:  '360° photo booth, RGB 100cm.',
    price:    '€199.40 / 2ч. — €286.32 / 4ч.',
  },
  {
    img:      'assets/images/services/svc-dj-new.jpg',
    title_bg: 'DJ оборудване',
    title_en: 'DJ Equipment',
    desc_bg:  'DJ за 5 часа, овъртайм €60/час.',
    desc_en:  'DJ for 5 hours, overtime €60/hour.',
    price:    '€300 / 5ч.',
  },
  {
    img:      'assets/images/services/candles.jpg',
    title_bg: 'Свещи в залата',
    title_en: 'Hall Candles',
    desc_bg:  '60 бр. електронни свещи в залата.',
    desc_en:  '60 electronic candles in the hall.',
    price:    '€51.13',
  },
  {
    img:      'assets/images/services/candles-terrace.jpg',
    title_bg: 'Свещи на терасата',
    title_en: 'Terrace Candles',
    desc_bg:  '50 бр. восъчни свещи на терасата.',
    desc_en:  '50 wax candles on the terrace.',
    price:    '€51.13',
  },
  {
    img:      'assets/images/services/svc-valet.jpg',
    title_bg: 'Вале-паркинг',
    title_en: 'Valet Parking',
    desc_bg:  'Вале-паркинг за 5 часа, овъртайм 50лв/ч.',
    desc_en:  'Valet parking for 5 hours, overtime 50 BGN/hour.',
    price:    '€140.61 / 5ч.',
  },
  {
    img:      'assets/images/services/svc-security.jpg',
    title_bg: 'Охрана',
    title_en: 'Security',
    desc_bg:  'Охрана VTA, 6 часа, 1 служител (€99.49 за всеки следващ).',
    desc_en:  'VTA security, 6 hours, 1 officer (€99.49 per extra).',
    price:    '€100 / 6ч.',
  },
  {
    img:      'assets/images/services/mic.jpg',
    title_bg: 'Микрофони',
    title_en: 'Microphones',
    desc_bg:  '3 броя + 1 брой тип брошка.',
    desc_en:  '3 units + 1 lapel microphone.',
    price:    '€49.60',
  },
  {
    img:      'assets/images/services/photographer.jpg',
    title_bg: 'Фотограф',
    title_en: 'Photographer',
    desc_bg:  'Професионален фотограф за вашето събитие.',
    desc_en:  'Professional photographer for your event.',
    price:    '€173.84 / 2ч. — €296.55 / 4ч.',
  },
  {
    img:      'assets/images/services/projector.jpg',
    title_bg: 'Мултимедия EPSON',
    title_en: 'EPSON Projector',
    desc_bg:  'Мултимедиен проектор за презентации и видео.',
    desc_en:  'Multimedia projector for presentations and video.',
    price:    '€92.03',
  },
  {
    img:      'assets/images/services/flipchart.jpg',
    title_bg: 'Флипчарт',
    title_en: 'Flipchart',
    desc_bg:  'Флипчарт за презентации и обучения.',
    desc_en:  'Flipchart for presentations and trainings.',
    price:    '€24.54',
  },
  {
    img:      'assets/images/services/fireworks.jpg',
    title_bg: 'Заря',
    title_en: 'Fireworks',
    desc_bg:  'Заря 150–170 сек. (100 изстрела) или 300–340 сек. (200 изстрела).',
    desc_en:  'Fireworks 150–170s (100 shots) or 300–340s (200 shots).',
    price:    '€224.97 / €403.92',
  },
  {
    img:      'assets/images/services/fountain-s.jpg',
    title_bg: 'Светлинен фонтан 1300мм',
    title_en: 'Light Fountain 1300mm',
    desc_bg:  'Светлинен фонтан Н 1300мм — 6 бр.',
    desc_en:  'Light fountain H 1300mm — 6 pcs.',
    price:    '€49.08',
  },
  {
    img:      'assets/images/services/fountain-l.jpg',
    title_bg: 'Светлинен фонтан 2600мм',
    title_en: 'Light Fountain 2600mm',
    desc_bg:  'Светлинен фонтан от машина Н 2600мм — 2 бр.',
    desc_en:  'Machine light fountain H 2600mm — 2 pcs.',
    price:    '€81.81',
  },
  {
    img:      'assets/images/services/led.jpg',
    title_bg: 'Лед екран VIDEO/FOTO',
    title_en: 'LED Screen VIDEO/PHOTO',
    desc_bg:  'Лед екран за VIDEO/FOTO 3800/2500мм.',
    desc_en:  'LED screen for VIDEO/PHOTO 3800/2500mm.',
    price:    '€148.27',
  },
  {
    img:      'assets/images/services/glow-numbers.jpg',
    title_bg: 'Светещи цифри',
    title_en: 'Glowing Numbers',
    desc_bg:  'Светещи цифри H=1100мм.',
    desc_en:  'Glowing numbers H=1100mm.',
    price:    '€34.77 / бр.',
  },
  {
    img:      'assets/images/services/arch.jpg',
    title_bg: 'Декоративна арка',
    title_en: 'Decorative Arch',
    desc_bg:  'Декоративна арка L3000 H1600 с осветление.',
    desc_en:  'Decorative arch L3000 H1600 with lighting.',
    price:    '€388.58',
  },
  {
    img:      'assets/images/services/wall-silver.jpg',
    title_bg: 'Декоративна стена SILVER',
    title_en: 'Decorative Wall SILVER',
    desc_bg:  'Декоративна стена SILVER L-3000 H2500.',
    desc_en:  'Decorative wall SILVER L-3000 H2500.',
    price:    '€181.51',
  },
  {
    img:      'assets/images/services/wall-gold.jpg',
    title_bg: 'Декоративна стена GOLD',
    title_en: 'Decorative Wall GOLD',
    desc_bg:  'Декоративна стена GOLD L-3000 H2500.',
    desc_en:  'Decorative wall GOLD L-3000 H2500.',
    price:    '€181.51',
  },
  {
    img:      'assets/images/services/heater.jpg',
    title_bg: 'Газова отоплителна гъба',
    title_en: 'Gas Patio Heater',
    desc_bg:  'Газова отоплителна гъба за терасата.',
    desc_en:  'Gas patio heater for the terrace.',
    price:    '€74.14 / бр.',
  },
  {
    img:      'assets/images/services/heater-table.jpg',
    title_bg: 'Газова отоплителна маса',
    title_en: 'Gas Heating Table',
    desc_bg:  'Газова отоплителна маса 900/900/H1050.',
    desc_en:  'Gas heating table 900/900/H1050.',
    price:    '€74.14 / бр.',
  },
  {
    img:      'assets/images/services/table-glow.jpg',
    title_bg: 'Маса светеща RGB',
    title_en: 'RGB Glowing Table',
    desc_bg:  'Маса светеща 1100мм Ø60см RGB.',
    desc_en:  'Glowing table 1100mm Ø60cm RGB.',
    price:    '€20.45 / бр.',
  },
  {
    img:      'assets/images/services/wardrobe.jpg',
    title_bg: 'Гардеробиер',
    title_en: 'Cloakroom Attendant',
    desc_bg:  'Гардеробиер за 5 часа, овъртайм €20/час.',
    desc_en:  'Cloakroom attendant for 5 hours, overtime €20/hour.',
    price:    '€90 / 5ч.',
  },
  {
    img:      'assets/images/services/hygienist.jpg',
    title_bg: 'Хигиенист',
    title_en: 'Hygienist',
    desc_bg:  'Хигиенист за 5 часа, овъртайм €20/час.',
    desc_en:  'Hygienist for 5 hours, overtime €20/hour.',
    price:    '€80 / 5ч.',
  },
  {
    img:      'assets/images/services/redcarpet.jpg',
    title_bg: 'Червена пътека (8 бр.)',
    title_en: 'Red Carpet (8 pcs)',
    desc_bg:  '8 оградни стойки и въже, пред централен вход.',
    desc_en:  '8 barrier posts and rope, main entrance.',
    price:    '€75.67',
  },
  {
    img:      'assets/images/services/redcarpet.jpg',
    title_bg: 'Червена пътека (6 бр.)',
    title_en: 'Red Carpet (6 pcs)',
    desc_bg:  '6 оградни стойки и въже, пред вход на залата.',
    desc_en:  '6 barrier posts and rope, hall entrance.',
    price:    '€64.93',
  },
  {
    img:      'assets/images/services/cleaning.jpg',
    title_bg: 'Почистване на зала',
    title_en: 'Hall Cleaning',
    desc_bg:  'Професионално почистване след събитието.',
    desc_en:  'Professional post-event cleaning.',
    price:    '€70',
  },
  {
    img:      'assets/images/services/bar-stool.jpg',
    title_bg: 'Бар стол (доп.)',
    title_en: 'Bar Stool (extra)',
    desc_bg:  'Над 40 включени в наема.',
    desc_en:  'Above the 40 included with rental.',
    price:    '€5.11 / бр.',
  },
  {
    img:      'assets/images/services/conf-chair.jpg',
    title_bg: 'Конферентен стол (доп.)',
    title_en: 'Conference Chair (extra)',
    desc_bg:  'Над 40 включени в наема.',
    desc_en:  'Above the 40 included with rental.',
    price:    '€5.11 / бр.',
  },
  {
    img:      'assets/images/services/chiavari.jpg',
    title_bg: 'Стол „Шивари“ (доп.)',
    title_en: 'Chiavari Chair (extra)',
    desc_bg:  'Над 10 включени в наема.',
    desc_en:  'Above the 10 included with rental.',
    price:    '€6.65 / бр.',
  },
  {
    img:      'assets/images/services/cocktail-table.jpg',
    title_bg: 'Коктейлна маса Ø70см (доп.)',
    title_en: 'Cocktail Table Ø70cm (extra)',
    desc_bg:  'С еластан. Над 16 включени в наема.',
    desc_en:  'With stretch cover. Above the 16 included.',
    price:    '€12.78 / бр.',
  },
  {
    img:      'assets/images/services/rect-table.jpg',
    title_bg: 'Правоъгълна маса 180см (доп.)',
    title_en: 'Rectangular Table 180cm (extra)',
    desc_bg:  'С еластан. Над 1 включена в наема.',
    desc_en:  'With stretch cover. Above the 1 included.',
    price:    '€23.01 / бр.',
  },
  {
    img:      'assets/images/services/round-table.jpg',
    title_bg: 'Кръгла маса Ø152см (доп.)',
    title_en: 'Round Table Ø152cm (extra)',
    desc_bg:  'С еластан. Над 1 включена в наема.',
    desc_en:  'With stretch cover. Above the 1 included.',
    price:    '€24.54 / бр.',
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
