const services = [
  {
    img:      'assets/images/services/svc-decoration.jpg',
    title_bg: 'Украса',
    title_en: 'Decoration',
    desc_bg:  'Персонализирана украса за вашето тържество.',
    desc_en:  'Personalised decoration for your celebration.',
  },
  {
    img:      'assets/images/services/svc-photobooth.jpg',
    title_bg: 'Фото кабина',
    title_en: 'Photo Booth',
    desc_bg:  'Забавна фото кабина за вашите гости.',
    desc_en:  'A fun photo booth for your guests.',
  },
  {
    img:      'assets/images/services/svc-dj-new.jpg',
    title_bg: 'DJ оборудване',
    title_en: 'DJ Equipment',
    desc_bg:  'Професионално DJ оборудване и озвучаване.',
    desc_en:  'Professional DJ equipment and sound.',
  },
  {
    img:      'assets/images/services/svc-flowers.jpg',
    title_bg: 'Цветни аранжировки',
    title_en: 'Floral Arrangements',
    desc_bg:  'Свежи цветни декорации за вашето събитие.',
    desc_en:  'Fresh floral decorations for your event.',
  },
  {
    img:      'assets/images/services/svc-cake.jpg',
    title_bg: 'Торта по поръчка',
    title_en: 'Custom Cake',
    desc_bg:  'Индивидуално изработена торта за специалния повод.',
    desc_en:  'A bespoke cake crafted for your special occasion.',
  },
  {
    img:      'assets/images/services/svc-valet.jpg',
    title_bg: 'Паркинг асистент',
    title_en: 'Parking Assistant',
    desc_bg:  'Асистент за улеснено паркиране на вашите гости.',
    desc_en:  'A parking assistant for your guests.',
  },
  {
    img:      'assets/images/services/svc-security.jpg',
    title_bg: 'Охрана',
    title_en: 'Security',
    desc_bg:  'Професионална охрана за вашето събитие.',
    desc_en:  'Professional security for your event.',
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

    body.appendChild(h3);
    body.appendChild(p);
    card.appendChild(imgWrap);
    card.appendChild(body);
    grid.appendChild(card);
  });
}

renderServices(lang);
document.addEventListener('langChange', e => renderServices(e.detail.lang));
