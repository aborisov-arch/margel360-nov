// Shared drinks catalog used by both reservation.js (picker) and drinks.js (menu page)
const drinkCategories = {
  bg: ['Шампанско', 'Вино', 'Алкохол & Уиски', 'Безалкохолно', 'Вода'],
  en: ['Champagne', 'Wine', 'Spirits & Whisky', 'Soft Drinks', 'Water'],
};

const drinks = [
  // Champagne & Sparkling
  { id:'dom',         cat:0, name_bg:'Dom Pérignon 0.75л',                 name_en:'Dom Pérignon 0.75L',                 price_eur:321, img:'assets/images/drinks/dom-perignon.png' },
  { id:'ruinart',     cat:0, name_bg:'Ruinart Blanc de Blanc 0.75л',       name_en:'Ruinart Blanc de Blanc 0.75L',       price_eur:123, img:'assets/images/drinks/ruinart.png' },
  { id:'veuve',       cat:0, name_bg:'Veuve Clicquot Brut',                name_en:'Veuve Clicquot Brut',                price_eur:71,  img:'assets/images/drinks/veuve-clicquot.png' },
  { id:'moet',        cat:0, name_bg:'Moët & Chandon Brut',                name_en:'Moët & Chandon Brut',                price_eur:62,  img:'assets/images/drinks/moet.png' },
  { id:'prosecco',    cat:0, name_bg:'Andreola Prosecco Dirupo 0.75л',     name_en:'Andreola Prosecco Dirupo 0.75L',     price_eur:16,  img:'assets/images/drinks/prosecco.png' },
  // Wine — Red, White, Rosé
  { id:'laverite',    cat:1, name_bg:'La Vérité Cabernet Franc',           name_en:'La Vérité Cabernet Franc',           price_eur:22,  img:'assets/images/drinks/laverite-cabernet-franc.png' },
  { id:'cheval_cs',   cat:1, name_bg:'Cheval Cabernet Sauvignon',          name_en:'Cheval Cabernet Sauvignon',          price_eur:8,   img:'assets/images/drinks/cheval-cabernet-sauvignon.png' },
  { id:'miraval_w',   cat:1, name_bg:'Château Miraval STUDIO бяло',        name_en:'Château Miraval Studio White',       price_eur:23,  img:'assets/images/drinks/miraval-white.png' },
  { id:'villa',       cat:1, name_bg:'Villa Maria Private Bin Sauv. Blanc',name_en:'Villa Maria Private Bin Sauv. Blanc',price_eur:17,  img:'assets/images/drinks/sauvignon-villa.png' },
  { id:'babich',      cat:1, name_bg:'Babich Marlborough Sauvignon Blanc', name_en:'Babich Marlborough Sauvignon Blanc', price_eur:16,  img:'assets/images/drinks/babich-marlborough.png' },
  { id:'stclair',     cat:1, name_bg:'Saint Clair Marlborough Sauv. Blanc',name_en:'Saint Clair Marlborough Sauv. Blanc',price_eur:14,  img:'assets/images/drinks/saintclair-marlborough.png' },
  { id:'cheval_sb',   cat:1, name_bg:'Cheval Sauvignon Blanc Катаржина',   name_en:'Cheval Sauvignon Blanc Katarzyna',   price_eur:8,   img:'assets/images/drinks/cheval-sauvignon-blanc.png' },
  { id:'minuty',      cat:1, name_bg:'M Minuty Rosé Côtes de Provence',    name_en:'M Minuty Rosé Côtes de Provence',    price_eur:23,  img:'assets/images/drinks/minuty-rose.png' },
  { id:'miraval_r',   cat:1, name_bg:'Château Miraval Rosé',               name_en:'Château Miraval Rosé',               price_eur:35,  img:'assets/images/drinks/miraval-rose.png' },
  { id:'le_rose',     cat:1, name_bg:'Le Rosé Katarzyna',                  name_en:'Le Rosé Katarzyna',                  price_eur:13,  img:'assets/images/drinks/le-rose.png' },
  // Spirits & Whisky (incl. beer + vodka + tequila + liqueurs)
  { id:'heineken',    cat:2, name_bg:'Heineken 0.33л',                     name_en:'Heineken 0.33L',                     price_eur:1,   img:'assets/images/drinks/heineken.png' },
  { id:'jager',       cat:2, name_bg:'Jägermeister',                       name_en:'Jägermeister',                       price_eur:13,  img:'assets/images/drinks/jagermeister.png' },
  { id:'uzo',         cat:2, name_bg:'Узо Пломари',                        name_en:'Uzo Plomari',                        price_eur:5,   img:'assets/images/drinks/uzo.png' },
  { id:'patron',      cat:2, name_bg:'Patrón Silver Tequila 0.70л',        name_en:'Patrón Silver Tequila 0.70L',        price_eur:64,  img:'assets/images/drinks/patron.png' },
  { id:'jw_blue',     cat:2, name_bg:'Johnnie Walker Blue Label 0.70л',    name_en:'Johnnie Walker Blue Label 0.70L',    price_eur:277, img:'assets/images/drinks/johnnie-walker-blue.png' },
  { id:'chivas18',    cat:2, name_bg:'Chivas Regal 18 год. 0.70л',         name_en:'Chivas Regal 18 year 0.70L',         price_eur:75,  img:'assets/images/drinks/chivas18.png' },
  { id:'chivas12',    cat:2, name_bg:'Chivas Regal 12 год. 0.70л',         name_en:'Chivas Regal 12 year 0.70L',         price_eur:30,  img:'assets/images/drinks/chivas12.png' },
  { id:'glen15',      cat:2, name_bg:'Glenfiddich 15YO Single Malt',       name_en:'Glenfiddich 15YO Single Malt',       price_eur:61,  img:'assets/images/drinks/glenfiddich-15.png' },
  { id:'glen12',      cat:2, name_bg:'Glenfiddich 12YO Single Malt',       name_en:'Glenfiddich 12YO Single Malt',       price_eur:45,  img:'assets/images/drinks/glenfiddich-12.png' },
  { id:'jw_gold',     cat:2, name_bg:'Johnnie Walker Gold Reserve',        name_en:'Johnnie Walker Gold Reserve',        price_eur:53,  img:'assets/images/drinks/johnnie-walker-gold.png' },
  { id:'jw_black',    cat:2, name_bg:'Johnnie Walker Black Label',         name_en:'Johnnie Walker Black Label',         price_eur:30,  img:'assets/images/drinks/johnnie-walker-black.png' },
  { id:'grey_goose',  cat:2, name_bg:'Grey Goose Vodka',                   name_en:'Grey Goose Vodka',                   price_eur:47,  img:'assets/images/drinks/grey-goose.png' },
  { id:'reyka',       cat:2, name_bg:'Reyka Vodka 0.70л',                  name_en:'Reyka Vodka 0.70L',                  price_eur:24,  img:'assets/images/drinks/reyka.png' },
  { id:'russian_std', cat:2, name_bg:'Руски Стандарт Водка',               name_en:'Russian Standard Vodka',             price_eur:13,  img:'assets/images/drinks/russian-standard.png' },
  // Soft Drinks (juices, tonics, colas, energy)
  { id:'granini_a',   cat:3, name_bg:'Granini Сок ябълка 1л',              name_en:'Granini Apple Juice 1L',             price_eur:2,   img:'assets/images/drinks/granini-apple.png' },
  { id:'granini_o',   cat:3, name_bg:'Granini Сок портокал 1л',            name_en:'Granini Orange Juice 1L',            price_eur:2,   img:'assets/images/drinks/granini-orange.png' },
  { id:'tonic_mango', cat:3, name_bg:'Thomas Henry Mystic Mango тоник',    name_en:'Thomas Henry Mystic Mango Tonic',    price_eur:2,   img:'assets/images/drinks/tonic-mango.png' },
  { id:'tonic_cherry',cat:3, name_bg:'Thomas Henry Cherry Blossom тоник',  name_en:'Thomas Henry Cherry Blossom Tonic',  price_eur:2,   img:'assets/images/drinks/tonic-cherry.png' },
  { id:'cola',        cat:3, name_bg:'Coca-Cola 0.33л',                    name_en:'Coca-Cola 0.33L',                    price_eur:1,   img:'assets/images/drinks/coca-cola.png' },
  { id:'cola0',       cat:3, name_bg:'Coca-Cola Zero 0.33л',               name_en:'Coca-Cola Zero 0.33L',               price_eur:1,   img:'assets/images/drinks/coca-zero.png' },
  { id:'fanta',       cat:3, name_bg:'Fanta Портокал 0.33л',               name_en:'Fanta Orange 0.33L',                 price_eur:1,   img:'assets/images/drinks/fanta.png' },
  { id:'redbull',     cat:3, name_bg:'Red Bull',                           name_en:'Red Bull',                           price_eur:2,   img:'assets/images/drinks/red-bull.png' },
  // Water
  { id:'panna25',     cat:4, name_bg:'Aqua Panna 0.25л',                   name_en:'Aqua Panna 0.25L',                   price_eur:2,   img:'assets/images/drinks/aqua-panna-25.png' },
  { id:'panna75',     cat:4, name_bg:'Aqua Panna 0.75л',                   name_en:'Aqua Panna 0.75L',                   price_eur:3,   img:'assets/images/drinks/aqua-panna-75.png' },
  { id:'benedo_spa',  cat:4, name_bg:'San Benedetto газирана 0.5л',        name_en:'San Benedetto sparkling 0.5L',       price_eur:1,   img:'assets/images/drinks/san-benedetto-sparkling.png' },
  { id:'benedo_st',   cat:4, name_bg:'San Benedetto минерална',            name_en:'San Benedetto still',                price_eur:1,   img:'assets/images/drinks/san-benedetto-still.png' },
  { id:'pelegrino75', cat:4, name_bg:'San Pellegrino 0.75л',               name_en:'San Pellegrino 0.75L',               price_eur:3,   img:'assets/images/drinks/san-pelegrino-75.png' },
  { id:'pelegrino',   cat:4, name_bg:'San Pellegrino 0.5л',                name_en:'San Pellegrino 0.5L',                price_eur:2,   img:'assets/images/drinks/san-pelegrino.png' },
];
