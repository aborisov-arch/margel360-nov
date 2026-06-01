// Services page — derived directly from `addonServices` in
// reservation-catalog.js so the public services page and the reservation
// wizard never drift apart. Adding/renaming a service or swapping its image
// in the catalog updates both surfaces.

function fmtPrice(svc) {
  // Bake the duration suffix into the price for items priced per session.
  const perSession = {
    dj: '/ 5ч.', security: '/ 6ч.', hygiene: '/ 5ч.',
    wardrobe: '/ 5ч.', valet: '/ 5ч.',
  };
  const perPiece = new Set(['numbers', 'heater', 'heater_tbl', 'glow_table']);
  const suffix = perSession[svc.id] || (perPiece.has(svc.id) ? '/ бр.' : '');
  return '€' + svc.price + (suffix ? ' ' + suffix : '');
}

function descFor(svc, lang) {
  const bg = {
    dj:          'DJ за 5 часа — професионално озвучаване и осветление.',
    photo2:      'Професионален фотограф за вашето събитие.',
    photo4:      'Професионален фотограф за вашето събитие.',
    booth2:      'Фото будка 360°, RGB Ø100 см.',
    booth4:      'Фото будка 360°, RGB Ø100 см.',
    arch:        'Декоративна арка L3000 × H1600 с осветление.',
    wall_s:      'Декоративна стена SILVER L-3000 × H2500.',
    wall_g:      'Декоративна стена GOLD L-3000 × H2500.',
    decoration:  'Персонализирана украса за вашето тържество.',
    flare_s:     'Заря 150–170 сек. / 100 изстрела.',
    flare_l:     'Заря 300–340 сек. / 200 изстрела.',
    fountain_s:  'Светлинен фонтан H 1300 мм — 6 бр.',
    fountain_l:  'Светлинен фонтан H 2600 мм — 2 бр.',
    led:         'LED екран за VIDEO/FOTO 3800 × 2500 мм.',
    mic:         '3 броя + 1 брошка.',
    proj:        'Мултимедиен EPSON проектор за презентации и видео.',
    flipchart:   'Флипчарт за презентации и обучения.',
    security:    'Охрана VTA, 6 часа, 1 служител.',
    hygiene:     'Хигиенист за 5 часа.',
    wardrobe:    'Гардеробиер за 5 часа.',
    valet:       'Вале-паркинг за 5 часа.',
    cleaning:    'Цялостно почистване на залата след събитието.',
    carpet_l:    'Червена пътека с оградни стойки и въже — 8 бр.',
    carpet_s:    'Червена пътека с оградни стойки и въже — 6 бр.',
    candles_h:   'Декоративни свещи за залата — 60 броя.',
    candles_t:   'Декоративни свещи за терасата — 50 броя.',
    numbers:     'Светещи цифри H = 1100 мм.',
    heater:      'Газова отоплителна гъба за терасата.',
    heater_tbl:  'Газова отоплителна маса за терасата.',
    glow_table:  'Маса светеща 1100 мм Ø60 см RGB.',
    bar_stool:   'Бар стол — първите 40 бр. са включени в наема.',
    conf_chair:  'Конферентен стол — първите 40 бр. са включени в наема.',
    chiavari:    'Стол „Шивари" — първите 10 бр. са включени в наема.',
    cocktail_t:  'Коктейлна маса Ø70 — първите 16 бр. са включени в наема.',
    rect_table:  'Правоъгълна маса 180 см — 1 бр. включена в наема.',
    round_table: 'Кръгла маса Ø152 — 1 бр. включена в наема.',
  };
  const en = {
    dj:          'DJ for 5 hours — professional sound and lighting.',
    photo2:      'Professional photographer for your event.',
    photo4:      'Professional photographer for your event.',
    booth2:      '360° photo booth, RGB Ø100 cm.',
    booth4:      '360° photo booth, RGB Ø100 cm.',
    arch:        'Decorative arch L3000 × H1600 with lighting.',
    wall_s:      'Decorative wall SILVER L-3000 × H2500.',
    wall_g:      'Decorative wall GOLD L-3000 × H2500.',
    decoration:  'Personalised decoration for your celebration.',
    flare_s:     'Sparkle fountain 150–170 sec. / 100 shots.',
    flare_l:     'Sparkle fountain 300–340 sec. / 200 shots.',
    fountain_s:  'Light fountain H 1300 mm — 6 pcs.',
    fountain_l:  'Light fountain H 2600 mm — 2 pcs.',
    led:         'LED screen for VIDEO/PHOTO 3800 × 2500 mm.',
    mic:         '3 handheld + 1 lapel microphone.',
    proj:        'EPSON multimedia projector for presentations and video.',
    flipchart:   'Flipchart for presentations and training.',
    security:    'VTA security, 6 hours, 1 officer.',
    hygiene:     'Hygienist for 5 hours.',
    wardrobe:    'Wardrobe attendant for 5 hours.',
    valet:       'Valet parking for 5 hours.',
    cleaning:    'Full hall cleaning after the event.',
    carpet_l:    'Red carpet with barrier posts and rope — 8 pieces.',
    carpet_s:    'Red carpet with barrier posts and rope — 6 pieces.',
    candles_h:   'Decorative candles for the hall — 60 pieces.',
    candles_t:   'Decorative candles for the terrace — 50 pieces.',
    numbers:     'Light-up numbers H = 1100 mm.',
    heater:      'Gas patio heater for the terrace.',
    heater_tbl:  'Gas heating table for the terrace.',
    glow_table:  'RGB glowing table 1100 mm Ø60 cm.',
    bar_stool:   'Bar stool — first 40 included with venue rental.',
    conf_chair:  'Conference chair — first 40 included with venue rental.',
    chiavari:    'Chiavari chair — first 10 included with venue rental.',
    cocktail_t:  'Cocktail table Ø70 — first 16 included with venue rental.',
    rect_table:  'Rectangular table 180 cm — 1 included with venue rental.',
    round_table: 'Round table Ø152 — 1 included with venue rental.',
  };
  return (lang === 'bg' ? bg : en)[svc.id] || '';
}

function renderServices(currentLang) {
  const grid = document.getElementById('services-grid');
  if (!grid || typeof addonServices === 'undefined') return;
  grid.innerHTML = '';
  addonServices.forEach(svc => {
    const card = document.createElement('div');
    card.className = 'service-card';

    const imgWrap = document.createElement('div');
    imgWrap.className = 'service-card-img';
    const img = document.createElement('img');
    img.src = svc.img;
    img.alt = currentLang === 'bg' ? svc.name_bg : svc.name_en;
    img.loading = 'lazy';
    imgWrap.appendChild(img);

    const body = document.createElement('div');
    body.className = 'service-card-body';

    const h3 = document.createElement('h3');
    h3.textContent = currentLang === 'bg' ? svc.name_bg : svc.name_en;

    const p = document.createElement('p');
    p.textContent = descFor(svc, currentLang);

    const price = document.createElement('p');
    price.className = 'service-card-price';
    price.textContent = fmtPrice(svc);

    body.appendChild(h3);
    body.appendChild(p);
    if (svc.hint_bg || svc.hint_en) {
      const hint = document.createElement('p');
      hint.style.cssText = 'font-size:0.82rem;color:var(--text-muted);margin-top:4px';
      hint.textContent = currentLang === 'bg' ? svc.hint_bg : svc.hint_en;
      body.appendChild(hint);
    }
    body.appendChild(price);
    card.appendChild(imgWrap);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

const lang = localStorage.getItem('margel_lang') || 'bg';
renderServices(lang);
document.addEventListener('langChange', e => renderServices(e.detail.lang));
