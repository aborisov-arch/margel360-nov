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

// Paid add-on services moved to the public.addon_services table (loaded by
// js/catalog-db.js, managed from admin/catalog.html).
