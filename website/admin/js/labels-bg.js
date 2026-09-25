// Bulgarian display labels for values stored in English: enquiry event_type
// (English catalog title), addons/drinks[].name (English item name) and the
// payment_method enum. Mirrors supabase/functions/_shared/labels-bg.ts (the
// team emails) — keep both in sync. Item names prefer the live catalog
// (window.addonServices / window.drinks from catalog-db.js) when loaded.
const EVENT_TYPE_BG = {
  evening: 'Вечерно събитие', corporate: 'Корпоративно събитие',
  corp4: 'Корпоративно събитие — 4 часа', corp8: 'Корпоративно събитие — 8 часа',
  birthday: 'Детски рожден ден', bday_day: 'Детски рожден ден — дневно',
  bday_eve: 'Детски рожден ден — вечерно', wedding: 'Сватба',
};
const EVENT_TITLE_PATTERNS = [
  [/^corporate.*\b8\b/i, 'corp8'], [/^corporate.*\b4\b/i, 'corp4'], [/^corporate/i, 'corporate'],
  [/^children.*day/i, 'bday_day'], [/^children.*even/i, 'bday_eve'], [/^children/i, 'birthday'],
  [/^evening/i, 'evening'], [/^wedding/i, 'wedding'],
];
function eventTypeBg(e) {
  if (e && e.event_id && EVENT_TYPE_BG[e.event_id]) return EVENT_TYPE_BG[e.event_id];
  const raw = String((e && e.event_type) || '').trim();
  const hit = EVENT_TITLE_PATTERNS.find(([re]) => re.test(raw));
  return hit ? EVENT_TYPE_BG[hit[1]] : raw;
}
const PAYMENT_BG = { cash: 'В брой', transfer: 'Банков превод', card: 'Карта' };
function paymentBg(v) { return PAYMENT_BG[v] || v || '-'; }
// Generated from supabase/functions/_shared/item-names.ts (bg names by id).
const ITEM_NAMES_BG = { "arch": "Декоративна арка с осветление", "babich": "Babich Marlborough Sauvignon Blanc", "bar_stool": "Бар стол", "barbayani": "Барбаяни Зелен етикет 0.70л", "benedo_spa": "San Benedetto газирана 0.5л", "benedo_st": "San Benedetto негазирана 0.5л", "booth2": "Фото будка 360° (2 часа)", "booth4": "Фото будка 360° (4 часа)", "candles_h": "Свещи в залата — 60 бр.", "candles_t": "Свещи на терасата — 50 бр.", "carpet_l": "Червена пътека (8 бр.)", "carpet_s": "Червена пътека (6 бр.)", "cheval_cs": "Cheval Cabernet Sauvignon", "cheval_sb": "Cheval Sauvignon Blanc Катаржина", "chiavari": "Стол „Шивари“", "chivas12": "Chivas Regal 12 год. 0.70л", "chivas18": "Chivas Regal 18 год. 0.70л", "clase_azul": "Clase Azul Plata Ultra Prem. 0.70л", "cleaning": "Почистване зала", "cocktail_t": "Коктейлна маса Ø70", "cola": "Coca-Cola 0.33л", "cola0": "Coca-Cola Zero 0.33л", "conf_chair": "Конферентен стол", "corona": "Corona Extra 0.335л", "decoration": "Украса (персонализирана)", "dj": "DJ за 5 часа", "dom": "Dom Pérignon 0.75л", "fanta": "Fanta Портокал 0.33л", "flare_l": "Заря 300–340 сек.", "flare_s": "Заря 150–170 сек.", "flipchart": "Флипчарт", "fountain_l": "Светлинен фонтан 2600мм", "fountain_s": "Светлинен фонтан 1300мм", "glen12": "Glenfiddich 12YO Single Malt", "glen15": "Glenfiddich 15YO Single Malt", "glow_table": "Маса светеща RGB", "granini_a": "Granini Сок ябълка 1л", "granini_o": "Granini Сок портокал 1л", "grey_goose": "Grey Goose Vodka", "heater": "Газова отоплителна гъба", "heater_tbl": "Газова отоплителна маса", "heineken": "Heineken 0.33л", "hygiene": "Хигиенист за 5 часа", "jager": "Jägermeister", "jw_black": "Johnnie Walker Black Label", "jw_blue": "Johnnie Walker Blue Label 0.70л", "jw_gold": "Johnnie Walker Gold Reserve", "laverite": "La Vérité Cabernet Franc", "le_rose": "Le Rosé Katarzyna 0.75л", "le_rose_375": "Le Rosé Katarzyna Estate 0.75л", "le_volte": "Tenuta dell'Ornellaia Le Volte 0.75л", "led": "LED екран", "merlot_cheval": "Merlot Cheval de Катаржина 0.75л", "mic": "Микрофони — 3бр. + брошка", "minuty": "M Minuty Rosé Côtes de Provence", "miraval_jp": "Miraval Studio Jolie & Pitt Rosé 0.75л", "miraval_r": "Château Miraval Rosé 0.75л", "miraval_w": "Château Miraval STUDIO бяло", "moet": "Moët & Chandon Brut", "numbers": "Светещи цифри", "panna25": "Aqua Panna 0.25л", "panna50": "Aqua Panna 0.5л", "panna75": "Aqua Panna 0.75л", "patron": "Patrón Silver Tequila 0.70л", "pelegrino": "San Pellegrino газирана 0.25л", "pelegrino75": "San Pellegrino газирана 0.75л", "perrier_spa": "Perrier Газирана минерална 0.33л", "perrier_st": "Perrier Минерална вода 0.33л", "photo2": "Фотограф за 2 часа", "photo4": "Фотограф за 4 часа", "proj": "Мултимедия EPSON", "prosecco": "Andreola Prosecco Dirupo 0.75л", "prosecco_glera": "Andreola Prosecco Glera Superiore DOCG 0.75л", "question_mark": "Question Mark Катаржина 2020 0.75л", "rect_table": "Правоъгълна маса 180", "redbull": "Red Bull 0.355л", "reyka": "Reyka Vodka 0.70л", "round_table": "Кръгла маса Ø152", "ruinart": "Ruinart Blanc de Blanc 0.75л", "russian_std": "Руски Стандарт Водка", "sanben_tea_lem3": "San Benedetto Студен чай лимон 0.33л кен", "sanben_tea_lem5": "San Benedetto Студен чай лимон 0.5л", "sanben_tea_peach": "San Benedetto Студен чай праскова 0.33л кен", "security": "Охрана VTA за 6 часа", "stclair": "Saint Clair Marlborough Sauv. Blanc", "tonic_cherry": "Thomas Henry Cherry Blossom тоник", "tonic_mango": "Thomas Henry Mystic Mango тоник", "uzo": "Узо Пломари", "valet": "Вале-паркинг за 5 часа", "veuve": "Veuve Clicquot Brut", "villa": "Villa Maria Private Bin Sauv. Blanc", "wall_g": "Декоративна стена GOLD", "wall_s": "Декоративна стена SILVER", "wardrobe": "Гардеробиер за 5 часа" };
function itemNameBg(item) {
  const id = item && item.id;
  const cat = id && ((window.addonServices || []).find(a => a.id === id) || (window.drinks || []).find(d => d.id === id));
  return (cat && cat.name_bg) || (id && ITEM_NAMES_BG[id]) || (item && item.name) || id || '';
}
