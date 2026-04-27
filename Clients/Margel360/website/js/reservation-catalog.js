// ── Event types ──
const eventTypes = [
  { id:'evening',   title_bg:'Вечерно събитие',       title_en:'Evening Event',      duration_bg:'след 19:00',    duration_en:'after 7:00 PM',   price_eur:1280, img:'assets/images/event-evening.jpg',   included:['sound','lighting','bar','fridge','parking','wc','elevator','furniture','dance','terrace'] },
  {
    id:'corporate', title_bg:'Корпоративно събитие',  title_en:'Corporate Event',    img:'assets/images/event-corporate.jpg',
    variants: [
      { id:'corp4', label_bg:'4 часа', label_en:'4 hours', price_eur:330, duration_bg:'08:00–17:30', duration_en:'8:00 AM–5:30 PM', included:['sound','lighting','bar','fridge','parking','wc','elevator','tables_conf'] },
      { id:'corp8', label_bg:'8 часа', label_en:'8 hours', price_eur:440, duration_bg:'08:00–17:30', duration_en:'8:00 AM–5:30 PM', included:['sound','lighting','bar','fridge','parking','wc','elevator','tables_conf','projector'] },
    ],
  },
  {
    id:'birthday',  title_bg:'Детски рожден ден',     title_en:"Children's Birthday", img:'assets/images/event-birthday.jpg',
    variants: [
      { id:'bday_day', label_bg:'Дневно', label_en:'Daytime', sub_bg:'(до 17:30) — 5 часа', sub_en:'(until 5:30 PM) — 5 hours', price_eur:700, duration_bg:'до 17:30',    duration_en:'until 5:30 PM',     included:['sound','lighting','bar','fridge','parking','wc','elevator','furniture','dance'] },
      { id:'bday_eve', label_bg:'Вечерно', label_en:'Evening', sub_bg:'(16:00–24:00) — 5 часа', sub_en:'(4:00 PM–midnight) — 5 hours', price_eur:970, duration_bg:'16:00–24:00', duration_en:'4:00 PM–midnight',   included:['sound','lighting','bar','fridge','parking','wc','elevator','furniture','dance','terrace'] },
    ],
  },
  { id:'wedding',   title_bg:'Сватба',                title_en:'Wedding',            duration_bg:'По договаряне', duration_en:'By arrangement',  price_eur:1500, img:'assets/images/event-wedding.jpg',   included:['sound','lighting','bar','fridge','parking','wc','elevator','furniture','dance','terrace','redcarpet'] },
];

const includedLabels = {
  bg: { sound:'12 колони EV/YAMAHA 360°', lighting:'Проф. осветление', bar:'Бар с ледогенератори', fridge:'3 хладилни витрини', parking:'70+ паркоместа', wc:'Санитарни помещения', elevator:'Асансьор', tables_conf:'Конф. маси и столове', furniture:'50 стола, маси, бар столове', projector:'Проектор и екран', dance:'Танцова площадка', terrace:'Тераса 260м²', redcarpet:'Червен килим' },
  en: { sound:'12 EV/YAMAHA speakers',    lighting:'Prof. lighting',    bar:'Bar with ice makers',  fridge:'3 fridges',          parking:'70+ parking',    wc:'Restrooms',            elevator:'Elevator',   tables_conf:'Conf. tables & chairs',  furniture:'50 chairs, tables, bar stools',     projector:'Projector & screen', dance:'Dance floor', terrace:'260m² terrace', redcarpet:'Red carpet' },
};

// ── Paid add-on services (from margel360.bg services page) ──
const addonServices = [
  { id:'dj',         name_bg:'DJ за 5 часа',                  name_en:'DJ for 5 hours',                 price:300,    img:'assets/images/services/dj.jpg' },
  { id:'photo2',     name_bg:'Фотограф за 2 часа',            name_en:'Photographer 2h',                price:173.84, img:'assets/images/services/photographer.jpg' },
  { id:'photo4',     name_bg:'Фотограф за 4 часа',            name_en:'Photographer 4h',                price:296.55, img:'assets/images/services/photographer.jpg' },
  { id:'booth2',     name_bg:'Фото будка 360° (2 часа)',      name_en:'360° Photo Booth (2 hours)',     price:199.40, img:'assets/images/services/booth.jpg' },
  { id:'booth4',     name_bg:'Фото будка 360° (4 часа)',      name_en:'360° Photo Booth (4 hours)',     price:286.32, img:'assets/images/services/booth.jpg' },
  { id:'arch',       name_bg:'Декоративна арка с осветление', name_en:'Decorative arch + lights',       price:388.58, img:'assets/images/services/arch.jpg' },
  { id:'wall_s',     name_bg:'Декоративна стена SILVER',      name_en:'Decorative wall SILVER',         price:181.51, img:'assets/images/services/wall-silver.jpg' },
  { id:'wall_g',     name_bg:'Декоративна стена GOLD',        name_en:'Decorative wall GOLD',           price:181.51, img:'assets/images/services/wall-gold.jpg' },
  { id:'decoration', name_bg:'Украса (персонализирана)',      name_en:'Decoration (custom)',            price:181.51, img:'assets/images/services/svc-decoration.jpg' },
  { id:'flare_s',    name_bg:'Заря 150–170 сек.',             name_en:'Sparkle fountain 150–170s',      price:224.97, img:'assets/images/services/fireworks.jpg' },
  { id:'flare_l',    name_bg:'Заря 300–340 сек.',             name_en:'Sparkle fountain 300–340s',      price:403.92, img:'assets/images/services/fireworks.jpg' },
  { id:'fountain_s', name_bg:'Светлинен фонтан 1300мм',       name_en:'Light fountain 1300mm',          price:49.08,  img:'assets/images/services/fountain-s.jpg' },
  { id:'fountain_l', name_bg:'Светлинен фонтан 2600мм',       name_en:'Light fountain 2600mm',          price:81.81,  img:'assets/images/services/fountain-l.jpg' },
  { id:'led',        name_bg:'LED екран',                     name_en:'LED screen',                     price:148.27, img:'assets/images/services/led.jpg' },
  { id:'mic',        name_bg:'Микрофони — 3бр. + брошка',     name_en:'Microphones set',                price:49.60,  img:'assets/images/services/mic.jpg' },
  { id:'proj',       name_bg:'Мултимедия EPSON',              name_en:'EPSON multimedia projector',     price:92.03,  img:'assets/images/services/projector.jpg' },
  { id:'flipchart',  name_bg:'Флипчарт',                      name_en:'Flipchart',                      price:24.54,  img:'assets/images/services/flipchart.jpg' },
  { id:'security',   name_bg:'Охрана VTA за 6 часа',          name_en:'VTA security 6h',                price:100,    img:'assets/images/services/security.jpg' },
  { id:'hygiene',    name_bg:'Хигиенист за 5 часа',           name_en:'Hygienist 5h',                   price:80,     img:'assets/images/services/hygienist.jpg' },
  { id:'wardrobe',   name_bg:'Гардеробиер за 5 часа',         name_en:'Wardrobe attendant 5h',          price:90,     img:'assets/images/services/wardrobe.jpg' },
  { id:'valet',      name_bg:'Вале-паркинг за 5 часа',        name_en:'Valet parking 5h',               price:140.61, img:'assets/images/services/valet.jpg' },
  { id:'cleaning',   name_bg:'Почистване зала',               name_en:'Hall cleaning',                  price:70,     img:'assets/images/services/cleaning.jpg' },
  { id:'carpet_l',   name_bg:'Червена пътека (8 бр.)',        name_en:'Red carpet (8 pieces)',          price:75.67,  img:'assets/images/services/redcarpet.jpg' },
  { id:'carpet_s',   name_bg:'Червена пътека (6 бр.)',        name_en:'Red carpet (6 pieces)',          price:64.93,  img:'assets/images/services/redcarpet.jpg' },
  { id:'candles_h',  name_bg:'Свещи в залата — 60 бр.',       name_en:'Hall candles 60 pcs',            price:51.13,  img:'assets/images/services/candles.jpg' },
  { id:'candles_t',  name_bg:'Свещи на терасата — 50 бр.',    name_en:'Terrace candles 50 pcs',         price:51.13,  img:'assets/images/services/candles-terrace.jpg' },
  { id:'numbers',    name_bg:'Светещи цифри',                 name_en:'Light-up numbers',               price:34.77,  img:'assets/images/services/glow-numbers.jpg' },
  { id:'heater',     name_bg:'Газова отоплителна гъба',       name_en:'Gas patio heater',               price:74.14,  img:'assets/images/services/heater.jpg' },
  { id:'heater_tbl', name_bg:'Газова отоплителна маса',       name_en:'Gas heating table',              price:74.14,  img:'assets/images/services/heater-table.jpg' },
  { id:'glow_table', name_bg:'Маса светеща RGB',              name_en:'RGB glowing table',              price:20.45,  img:'assets/images/services/table-glow.jpg' },
  // Furniture extras — first N pcs included with venue rental, then per piece:
  { id:'bar_stool',  name_bg:'Бар стол (над 40)',             name_en:'Bar stool (above 40)',           price:5.11,   img:'assets/images/services/bar-stool.jpg' },
  { id:'conf_chair', name_bg:'Конферентен стол (над 40)',     name_en:'Conference chair (above 40)',    price:5.11,   img:'assets/images/services/conf-chair.jpg' },
  { id:'chiavari',   name_bg:'Стол „Шивари“ (над 10)',        name_en:'Chiavari chair (above 10)',      price:6.65,   img:'assets/images/services/chiavari.jpg' },
  { id:'cocktail_t', name_bg:'Коктейлна маса Ø70 (над 16)',   name_en:'Cocktail table Ø70 (above 16)',  price:12.78,  img:'assets/images/services/cocktail-table.jpg' },
  { id:'rect_table', name_bg:'Правоъгълна маса 180 (над 1)',  name_en:'Rectangular table 180 (above 1)',price:23.01,  img:'assets/images/services/rect-table.jpg' },
  { id:'round_table',name_bg:'Кръгла маса Ø152 (над 1)',      name_en:'Round table Ø152 (above 1)',     price:24.54,  img:'assets/images/services/round-table.jpg' },
];
