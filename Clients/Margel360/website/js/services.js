const services = [
  { icon: '🎨', title_bg: 'Украса', title_en: 'Decoration', desc_bg: 'Персонализирана украса за вашето тържество.', desc_en: 'Personalised decoration for your celebration.' },
  { icon: '📸', title_bg: 'Фото кабина', title_en: 'Photo Booth', desc_bg: 'Забавна фото кабина за вашите гости.', desc_en: 'A fun photo booth for your guests.' },
  { icon: '🎧', title_bg: 'DJ оборудване', title_en: 'DJ Equipment', desc_bg: 'Професионално DJ оборудване и озвучаване.', desc_en: 'Professional DJ equipment and sound.' },
  { icon: '🌸', title_bg: 'Цветни аранжировки', title_en: 'Floral Arrangements', desc_bg: 'Свежи цветни декорации за вашето събитие.', desc_en: 'Fresh floral decorations for your event.' },
  { icon: '🍰', title_bg: 'Торта по поръчка', title_en: 'Custom Cake', desc_bg: 'Индивидуално изработена торта за специалния повод.', desc_en: 'A bespoke cake crafted for your special occasion.' },
  { icon: '🚗', title_bg: 'Паркинг асистент', title_en: 'Parking Assistant', desc_bg: 'Асистент за улеснено паркиране на вашите гости.', desc_en: 'A parking assistant for your guests.' },
];

const lang = localStorage.getItem('margel_lang') || 'bg';
const grid = document.getElementById('services-grid');

function renderServices(currentLang) {
  if (!grid) return;
  grid.innerHTML = '';
  services.forEach(s => {
    const card = document.createElement('div');
    card.className = 'service-card';

    const icon = document.createElement('div');
    icon.className = 'service-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = s.icon;

    const h3 = document.createElement('h3');
    h3.textContent = currentLang === 'bg' ? s.title_bg : s.title_en;

    const p = document.createElement('p');
    p.textContent = currentLang === 'bg' ? s.desc_bg : s.desc_en;

    card.appendChild(icon);
    card.appendChild(h3);
    card.appendChild(p);
    grid.appendChild(card);
  });
}

renderServices(lang);
document.addEventListener('langChange', e => renderServices(e.detail.lang));
