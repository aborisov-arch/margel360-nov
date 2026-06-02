// Services page — derived directly from `addonServices` in
// reservation-catalog.js so the public services page and the reservation
// wizard never drift apart. Adding/renaming a service or swapping its image
// in the catalog updates both surfaces.

// Services that come in multiple sizes/lengths/styles are merged into a
// single card on this page (e.g. fireworks 150-170s vs 300-340s render as
// one "Заря" card with two side-by-side variant pills). The catalog stays
// flat — the grouping is presentation-only and only on the services page;
// the reservation wizard still lists each variant separately.
const SERVICE_GROUPS = [
  { key:'photographer', ids:['photo2','photo4'],
    title_bg:'Фотограф',          title_en:'Photographer',
    desc_bg:'Професионален фотограф за вашето събитие.',
    desc_en:'Professional photographer for your event.',
    variants:[
      { id:'photo2', label_bg:'2 часа', label_en:'2 hours' },
      { id:'photo4', label_bg:'4 часа', label_en:'4 hours' },
    ] },
  { key:'booth', ids:['booth2','booth4'],
    title_bg:'Фото будка 360°',   title_en:'360° Photo Booth',
    desc_bg:'Фото будка 360°, RGB Ø100 см.',
    desc_en:'360° photo booth, RGB Ø100 cm.',
    variants:[
      { id:'booth2', label_bg:'2 часа', label_en:'2 hours' },
      { id:'booth4', label_bg:'4 часа', label_en:'4 hours' },
    ] },
  { key:'fireworks', ids:['flare_s','flare_l'],
    title_bg:'Заря',               title_en:'Sparkle Fountains',
    desc_bg:'Студена заря за торта или ефектен момент.',
    desc_en:'Cold sparkle fountains for the cake or showpiece moment.',
    variants:[
      { id:'flare_s', label_bg:'150–170 сек.', label_en:'150–170 sec.' },
      { id:'flare_l', label_bg:'300–340 сек.', label_en:'300–340 sec.' },
    ] },
  { key:'light_fountain', ids:['fountain_s','fountain_l'],
    title_bg:'Светлинен фонтан',  title_en:'Light Fountain',
    desc_bg:'Светлинни фонтани за вход, торта или сцена.',
    desc_en:'Light fountains for entrance, cake or stage moments.',
    variants:[
      { id:'fountain_s', label_bg:'1300 мм', label_en:'1300 mm' },
      { id:'fountain_l', label_bg:'2600 мм', label_en:'2600 mm' },
    ] },
  { key:'wall', ids:['wall_s','wall_g'],
    title_bg:'Декоративна стена', title_en:'Decorative Wall',
    desc_bg:'Декоративна стена L-3000 × H2500 за фон или фото зона.',
    desc_en:'Decorative wall L-3000 × H2500 as backdrop or photo wall.',
    variants:[
      { id:'wall_s', label_bg:'SILVER', label_en:'SILVER' },
      { id:'wall_g', label_bg:'GOLD',   label_en:'GOLD' },
    ] },
  { key:'carpet', ids:['carpet_s','carpet_l'],
    title_bg:'Червена пътека',    title_en:'Red Carpet',
    desc_bg:'Червена пътека с оградни стойки и въже.',
    desc_en:'Red carpet with barrier posts and rope.',
    variants:[
      { id:'carpet_s', label_bg:'6 бр.', label_en:'6 pieces' },
      { id:'carpet_l', label_bg:'8 бр.', label_en:'8 pieces' },
    ] },
  { key:'candles', ids:['candles_h','candles_t'],
    title_bg:'Декоративни свещи', title_en:'Decorative Candles',
    desc_bg:'Свещи за залата и терасата.',
    desc_en:'Candles for the hall and the terrace.',
    variants:[
      { id:'candles_h', label_bg:'Залата — 60 бр.',    label_en:'Hall — 60 pcs' },
      { id:'candles_t', label_bg:'Терасата — 50 бр.', label_en:'Terrace — 50 pcs' },
    ] },
  { key:'heating', ids:['heater','heater_tbl'],
    title_bg:'Газово отопление',  title_en:'Gas Heating',
    desc_bg:'Газово отопление за терасата.',
    desc_en:'Gas heating for the terrace.',
    variants:[
      { id:'heater',     label_bg:'Гъба', label_en:'Patio heater' },
      { id:'heater_tbl', label_bg:'Маса', label_en:'Heating table' },
    ] },
];
const GROUPED_IDS = new Set(SERVICE_GROUPS.flatMap(g => g.ids));
const FIRST_ID_OF_GROUP = new Map(SERVICE_GROUPS.map(g => [g.ids[0], g]));

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

function renderSingleCard(svc, lang) {
  const card = document.createElement('div');
  card.className = 'service-card';

  const imgWrap = document.createElement('div');
  imgWrap.className = 'service-card-img';
  const img = document.createElement('img');
  img.src = svc.img;
  img.alt = lang === 'bg' ? svc.name_bg : svc.name_en;
  img.loading = 'lazy';
  imgWrap.appendChild(img);

  const body = document.createElement('div');
  body.className = 'service-card-body';

  const h3 = document.createElement('h3');
  h3.textContent = lang === 'bg' ? svc.name_bg : svc.name_en;

  const p = document.createElement('p');
  p.textContent = descFor(svc, lang);

  const price = document.createElement('p');
  price.className = 'service-card-price';
  price.textContent = fmtPrice(svc);

  body.appendChild(h3);
  body.appendChild(p);
  if (svc.hint_bg || svc.hint_en) {
    const hint = document.createElement('p');
    hint.style.cssText = 'font-size:0.82rem;color:var(--text-muted);margin-top:4px';
    hint.textContent = lang === 'bg' ? svc.hint_bg : svc.hint_en;
    body.appendChild(hint);
  }
  body.appendChild(price);
  card.appendChild(imgWrap);
  card.appendChild(body);
  return card;
}

function renderGroupCard(group, lang) {
  const variantsData = group.variants
    .map(v => ({ v, svc: addonServices.find(s => s.id === v.id) }))
    .filter(x => x.svc);
  if (!variantsData.length) return null;
  const firstSvc = variantsData[0].svc;

  const card = document.createElement('div');
  card.className = 'service-card';

  const imgWrap = document.createElement('div');
  imgWrap.className = 'service-card-img';
  const img = document.createElement('img');
  img.src = firstSvc.img;
  img.alt = lang === 'bg' ? group.title_bg : group.title_en;
  img.loading = 'lazy';
  imgWrap.appendChild(img);

  const body = document.createElement('div');
  body.className = 'service-card-body';

  const h3 = document.createElement('h3');
  h3.textContent = lang === 'bg' ? group.title_bg : group.title_en;

  const p = document.createElement('p');
  p.textContent = lang === 'bg' ? group.desc_bg : group.desc_en;

  const variants = document.createElement('div');
  variants.className = 'service-variants';
  variantsData.forEach(({ v, svc }) => {
    const cell = document.createElement('div');
    cell.className = 'service-variant';
    const lbl = document.createElement('span');
    lbl.className = 'service-variant__label';
    lbl.textContent = lang === 'bg' ? v.label_bg : v.label_en;
    const pr = document.createElement('span');
    pr.className = 'service-variant__price';
    pr.textContent = '€' + svc.price;
    cell.append(lbl, pr);
    variants.appendChild(cell);
  });

  body.append(h3, p, variants);
  card.append(imgWrap, body);
  return card;
}

function renderServices(currentLang) {
  const grid = document.getElementById('services-grid');
  if (!grid || typeof addonServices === 'undefined') return;
  grid.innerHTML = '';
  addonServices.forEach(svc => {
    if (FIRST_ID_OF_GROUP.has(svc.id)) {
      const groupCard = renderGroupCard(FIRST_ID_OF_GROUP.get(svc.id), currentLang);
      if (groupCard) grid.appendChild(groupCard);
      return;
    }
    if (GROUPED_IDS.has(svc.id)) return; // already rendered as part of its group
    grid.appendChild(renderSingleCard(svc, currentLang));
  });
}

const lang = localStorage.getItem('margel_lang') || 'bg';
renderServices(lang);
document.addEventListener('langChange', e => renderServices(e.detail.lang));
