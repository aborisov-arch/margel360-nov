// ── Event types ──
// Each event has a `desc_bg` / `desc_en` paragraph used on the reservation
// picker page, plus a `detailUrl` pointing to its dedicated sub-page. The
// sub-page has a "Резервирай" CTA that links back to /reservation?event=ID.
const eventTypes = [
  { id:'evening',   title_bg:'Вечерно събитие',       title_en:'Evening Event',      desc_bg:'За приятели, рождени дни и специален повод.', desc_en:'For friends, birthdays and special occasions.',           duration_bg:'след 19:00',    duration_en:'after 7:00 PM',   price_eur:1280, img:'assets/images/event-evening.jpg',   included:['sound','lighting','bar','fridge','parking','wc','elevator','furniture','dance','terrace'] },
  {
    id:'corporate', title_bg:'Корпоративно събитие',  title_en:'Corporate Event',    desc_bg:'Тиймбилдинг, презентации и работни срещи.',     desc_en:'Team-building, presentations and corporate meetings.', img:'assets/images/event-corporate.jpg',
    variants: [
      { id:'corp4', label_bg:'4 часа', label_en:'4 hours', price_eur:330, duration_bg:'08:00-17:30', duration_en:'8:00 AM-5:30 PM', included:['sound','lighting','bar','fridge','parking','wc','elevator','tables_conf'] },
      { id:'corp8', label_bg:'8 часа', label_en:'8 hours', price_eur:440, duration_bg:'08:00-17:30', duration_en:'8:00 AM-5:30 PM', included:['sound','lighting','bar','fridge','parking','wc','elevator','tables_conf','projector'] },
    ],
  },
  {
    id:'birthday',  title_bg:'Детски рожден ден',     title_en:"Children's Birthday", desc_bg:'Празник за вашето дете и гостите му.',          desc_en:"A celebration for your child and their guests.", img:'assets/images/event-birthday.jpg',
    variants: [
      { id:'bday_day', label_bg:'Дневно', label_en:'Daytime', sub_bg:'(до 17:30) - 5 часа', sub_en:'(until 5:30 PM) - 5 hours', price_eur:700, duration_bg:'до 17:30',    duration_en:'until 5:30 PM',     included:['sound','lighting','bar','fridge','parking','wc','elevator','furniture','dance'] },
      { id:'bday_eve', label_bg:'Вечерно', label_en:'Evening', sub_bg:'(16:00-24:00) - 5 часа', sub_en:'(4:00 PM-midnight) - 5 hours', price_eur:970, duration_bg:'16:00-24:00', duration_en:'4:00 PM-midnight',   included:['sound','lighting','bar','fridge','parking','wc','elevator','furniture','dance','terrace'] },
    ],
  },
  { id:'wedding',   title_bg:'Сватба',                title_en:'Wedding',            desc_bg:'Тържество с панорамна гледка и 360° тераса.',  desc_en:'A reception with panoramic views and a 360° terrace.',  duration_bg:'По договаряне', duration_en:'By arrangement',  price_eur:1500, img:'assets/images/event-wedding.jpg',   included:['sound','lighting','bar','fridge','parking','wc','elevator','furniture','dance','terrace','redcarpet'] },
];

const includedLabels = {
  bg: { sound:'Професионално 360° озвучаване', lighting:'Проф. осветление', bar:'Бар с ледогенератори', fridge:'3 хладилни витрини', parking:'70+ паркоместа', wc:'Санитарни помещения', elevator:'Асансьор', tables_conf:'Конф. маси и столове', furniture:'50 стола, маси, бар столове', projector:'Проектор и екран', dance:'Танцова площадка', terrace:'Тераса 360м²', redcarpet:'Червен килим' },
  en: { sound:'Professional 360° sound',    lighting:'Prof. lighting',    bar:'Bar with ice makers',  fridge:'3 fridges',          parking:'70+ parking',    wc:'Restrooms',            elevator:'Elevator',   tables_conf:'Conf. tables & chairs',  furniture:'50 chairs, tables, bar stools',     projector:'Projector & screen', dance:'Dance floor', terrace:'360m² terrace', redcarpet:'Red carpet' },
};

// ── Free amenities included with every venue rental (margel360.bg) ──
const venueIncluded = [
  { icon:'🔊',  label_bg:'Професионално озвучение',                    label_en:'Professional sound' },
  { icon:'💡',  label_bg:'Модерно осветление',                          label_en:'Modern lighting' },
  { icon:'🌿',  label_bg:'Панорамна тераса 360 м²',                     label_en:'Panoramic terrace 360 m²' },
  { icon:'🍸',  label_bg:'16 бр. маси тип „щъркел" + еластан',         label_en:'16 cocktail tables + stretch covers' },
  { icon:'🪑',  label_bg:'40 бр. бар столове',                          label_en:'40 bar stools' },
  { icon:'🅿️',  label_bg:'Безплатен паркинг до 70+ автомобила',        label_en:'Free parking up to 70+ vehicles' },
  { icon:'🧊',  label_bg:'Бар с 2 бр. ледогенератори',                  label_en:'Bar with 2 ice makers' },
  { icon:'🍷',  label_bg:'Хладилни витрини за вино и безалк. напитки', label_en:'Wine & soft-drinks fridges' },
  { icon:'🍽️',  label_bg:'Миялна машина',                              label_en:'Dishwasher' },
  { icon:'☕',  label_bg:'Кафе машина с безплатно кафе',               label_en:'Coffee machine with free coffee' },
  { icon:'🚻',  label_bg:'Мъжка и дамска тоалетна',                    label_en:"Men's and women's restrooms" },
];

// ── Paid add-on services (from margel360.bg services page) ──
// Order matters: the wizard renders these in a 2-col grid (renderAddons in
// reservation.js). Group paired variants (Silver/Gold, 2h/4h, small/large)
// consecutively so each pair lands on the same row. Singles fill afterwards.
const addonServices = [
  // ── Paired variants - each pair sits on its own row ──
  { id:'photo2',     name_bg:'Фотограф за 2 часа',            name_en:'Photographer 2h',                price:174, img:'assets/images/services/photographer.jpg' },
  { id:'photo4',     name_bg:'Фотограф за 4 часа',            name_en:'Photographer 4h',                price:297, img:'assets/images/services/photographer.jpg' },
  { id:'booth2',     name_bg:'Фото будка 360° (2 часа)',      name_en:'360° Photo Booth (2 hours)',     price:199, img:'assets/images/services/svc-photobooth.jpg' },
  { id:'booth4',     name_bg:'Фото будка 360° (4 часа)',      name_en:'360° Photo Booth (4 hours)',     price:286, img:'assets/images/services/svc-photobooth.jpg' },
  { id:'wall_s',     name_bg:'Декоративна стена SILVER',      name_en:'Decorative wall SILVER',         price:182, img:'assets/images/services/wall-silver.jpg' },
  { id:'wall_g',     name_bg:'Декоративна стена GOLD',        name_en:'Decorative wall GOLD',           price:182, img:'assets/images/services/wall-gold.jpg' },
  { id:'flare_s',    name_bg:'Заря 150-170 сек.',             name_en:'Sparkle fountain 150-170s',      price:225, img:'assets/images/services/fireworks.jpg' },
  { id:'flare_l',    name_bg:'Заря 300-340 сек.',             name_en:'Sparkle fountain 300-340s',      price:404, img:'assets/images/services/fireworks.jpg' },
  { id:'fountain_s', name_bg:'Светлинен фонтан 1300мм',       name_en:'Light fountain 1300mm',          price:49,  img:'assets/images/services/fountain-s.jpg' },
  { id:'fountain_l', name_bg:'Светлинен фонтан 2600мм',       name_en:'Light fountain 2600mm',          price:82,  img:'assets/images/services/fountain-l.jpg' },
  { id:'carpet_s',   name_bg:'Червена пътека (6 бр.)',        name_en:'Red carpet (6 pieces)',          price:65,  img:'assets/images/services/redcarpet.jpg' },
  { id:'carpet_l',   name_bg:'Червена пътека (8 бр.)',        name_en:'Red carpet (8 pieces)',          price:76,  img:'assets/images/services/redcarpet.jpg' },
  { id:'candles_h',  name_bg:'Свещи в залата - 60 бр.',       name_en:'Hall candles 60 pcs',            price:51,  img:'assets/images/services/candles.jpg' },
  { id:'candles_t',  name_bg:'Свещи на терасата - 50 бр.',    name_en:'Terrace candles 50 pcs',         price:51,  img:'assets/images/services/candles-terrace.jpg' },
  { id:'heater',     name_bg:'Газова отоплителна гъба',       name_en:'Gas patio heater',               price:74,  img:'assets/images/services/heater.jpg' },
  { id:'heater_tbl', name_bg:'Газова отоплителна маса',       name_en:'Gas heating table',              price:74,  img:'assets/images/services/heater-table.jpg' },
  // ── Singles - paired up two-per-row for layout, no semantic grouping ──
  { id:'dj',         name_bg:'DJ за 5 часа',                  name_en:'DJ for 5 hours',                 price:300, img:'assets/images/services/svc-dj-new.jpg', hint_bg:'За всеки допълнителен час - €60', hint_en:'Each additional hour - €60' },
  { id:'arch',       name_bg:'Декоративна арка с осветление', name_en:'Decorative arch + lights',       price:389, img:'assets/images/services/arch.jpg' },
  { id:'decoration', name_bg:'Украса (персонализирана)',      name_en:'Decoration (custom)',            price:182, img:'assets/images/services/svc-decoration.jpg' },
  { id:'led',        name_bg:'LED екран',                     name_en:'LED screen',                     price:148, img:'assets/images/services/led.jpg' },
  { id:'mic',        name_bg:'Микрофони - 3бр. + брошка',     name_en:'Microphones set',                price:50,  img:'assets/images/services/mic.jpg' },
  { id:'proj',       name_bg:'Мултимедия EPSON',              name_en:'EPSON multimedia projector',     price:92,  img:'assets/images/services/projector.jpg' },
  { id:'flipchart',  name_bg:'Флипчарт',                      name_en:'Flipchart',                      price:25,  img:'assets/images/services/flipchart.jpg' },
  { id:'security',   name_bg:'Охрана VTA за 6 часа',          name_en:'VTA security 6h',                price:100, img:'assets/images/services/svc-security.jpg' },
  { id:'hygiene',    name_bg:'Хигиенист за 5 часа',           name_en:'Hygienist 5h',                   price:80,  img:'assets/images/services/hygienist.jpg', hint_bg:'За всеки допълнителен час - €20', hint_en:'Each additional hour - €20' },
  { id:'wardrobe',   name_bg:'Гардеробиер за 5 часа',         name_en:'Wardrobe attendant 5h',          price:90,  img:'assets/images/services/wardrobe.jpg',  hint_bg:'За всеки допълнителен час - €20', hint_en:'Each additional hour - €20' },
  { id:'valet',      name_bg:'Вале-паркинг за 5 часа',        name_en:'Valet parking 5h',               price:141, img:'assets/images/services/svc-valet.jpg', hint_bg:'За всеки допълнителен час - €25', hint_en:'Each additional hour - €25' },
  { id:'cleaning',   name_bg:'Почистване зала',               name_en:'Hall cleaning',                  price:70,  img:'assets/images/services/cleaning.jpg' },
  { id:'numbers',    name_bg:'Светещи цифри',                 name_en:'Light-up numbers',               price:35,  img:'assets/images/services/glow-numbers.jpg' },
  { id:'glow_table', name_bg:'Маса светеща RGB',              name_en:'RGB glowing table',              price:20,  img:'assets/images/services/table-glow.jpg' },
  // Furniture extras - `freeUntil` pcs included with venue rental, then `price` per extra piece:
  { id:'bar_stool',  name_bg:'Бар стол',              name_en:'Bar stool',              price:5,  freeUntil:40, img:'assets/images/services/bar-stool.jpg' },
  { id:'conf_chair', name_bg:'Конферентен стол',      name_en:'Conference chair',       price:5,  freeUntil:40, img:'assets/images/services/conf-chair.jpg' },
  { id:'chiavari',   name_bg:'Стол „Шивари“',         name_en:'Chiavari chair',         price:7,  freeUntil:10, img:'assets/images/services/chiavari.jpg' },
  { id:'cocktail_t', name_bg:'Коктейлна маса Ø70',    name_en:'Cocktail table Ø70',     price:13, freeUntil:16, img:'assets/images/services/cocktail-table.jpg' },
  { id:'rect_table', name_bg:'Правоъгълна маса 180',  name_en:'Rectangular table 180',  price:23, freeUntil:1,  img:'assets/images/services/rect-table.jpg' },
  { id:'round_table',name_bg:'Кръгла маса Ø152',      name_en:'Round table Ø152',       price:25, freeUntil:1,  img:'assets/images/services/round-table.jpg' },
];
