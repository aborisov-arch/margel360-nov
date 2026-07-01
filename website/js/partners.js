// Public partners page — reads public.partners with the anon key (RLS
// exposes active rows only) and renders the Catering + Artists sections.
// A partner added in the admin panel appears here automatically.
// Depends on: reservation-supabase.js (reservationDb), main.js (langChange).

const PARTNERS_BUCKET = 'partner-images';
let _partnersData = null; // null until fetched; [] on error/empty

function partnerImgUrl(path) {
  return reservationDb.storage.from(PARTNERS_BUCKET).getPublicUrl(path).data.publicUrl;
}

function partnerCard(p, lang) {
  const card = document.createElement('div');
  card.className = 'service-card';

  const imgWrap = document.createElement('div');
  imgWrap.className = 'service-card-img';
  if (p.image_path) {
    const img = document.createElement('img');
    img.src = partnerImgUrl(p.image_path);
    img.alt = p.name;
    img.loading = 'lazy';
    imgWrap.appendChild(img);
  } else {
    imgWrap.style.cssText = 'display:flex;align-items:center;justify-content:center;font-size:2.6rem;background:#F6F1E8';
    imgWrap.textContent = p.category === 'catering' ? '🍽️' : '🎤';
    imgWrap.setAttribute('aria-hidden', 'true');
  }

  const body = document.createElement('div');
  body.className = 'service-card-body';

  const h3 = document.createElement('h3');
  h3.textContent = p.name;
  body.appendChild(h3);

  const desc = lang === 'bg' ? p.description_bg : (p.description_en || p.description_bg);
  if (desc) {
    const d = document.createElement('p');
    d.textContent = desc;
    body.appendChild(d);
  }

  if (p.website_url || p.phone) {
    const contact = document.createElement('p');
    contact.className = 'service-card-price';
    if (p.website_url) {
      const a = document.createElement('a');
      a.href = p.website_url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = (typeof translations !== 'undefined' && translations[lang]?.partners_visit) || 'Посети сайта';
      contact.appendChild(a);
    }
    if (p.phone) {
      if (p.website_url) contact.appendChild(document.createTextNode(' · '));
      const tel = document.createElement('a');
      tel.href = 'tel:' + p.phone.replace(/[^\d+]/g, '');
      tel.textContent = p.phone;
      contact.appendChild(tel);
    }
    body.appendChild(contact);
  }

  card.appendChild(imgWrap);
  card.appendChild(body);
  return card;
}

function renderPartnersPage(lang) {
  if (_partnersData === null) return; // not loaded yet
  const errEl = document.getElementById('partners-error');
  const noneEl = document.getElementById('partners-none');

  const sections = [
    { cat: 'catering', section: 'partners-catering-section', grid: 'partners-catering-grid' },
    { cat: 'artist',   section: 'partners-artists-section',  grid: 'partners-artists-grid' },
  ];
  let shown = 0;
  sections.forEach(({ cat, section, grid }) => {
    const sec = document.getElementById(section);
    const g = document.getElementById(grid);
    const inCat = _partnersData.filter(p => p.category === cat);
    g.innerHTML = '';
    if (!inCat.length) { sec.style.display = 'none'; return; }
    inCat.forEach(p => g.appendChild(partnerCard(p, lang)));
    sec.style.display = 'block';
    shown += inCat.length;
  });
  noneEl.style.display = (!shown && errEl.style.display === 'none') ? 'block' : 'none';
}

async function loadPartnersPage() {
  const errEl = document.getElementById('partners-error');
  try {
    const { data, error } = await reservationDb
      .from('partners')
      .select('id, category, name, description_bg, description_en, website_url, phone, image_path')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    _partnersData = data || [];
    errEl.style.display = 'none';
  } catch (err) {
    console.warn('Partners fetch failed:', err);
    _partnersData = [];
    errEl.style.display = 'block';
  }
  renderPartnersPage(localStorage.getItem('margel_lang') || 'bg');
}

document.addEventListener('DOMContentLoaded', loadPartnersPage);
document.addEventListener('langChange', (e) => renderPartnersPage(e.detail.lang));
