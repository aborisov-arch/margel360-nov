document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.getElementById('drinks-menu-tabs');
  const grid = document.getElementById('drinks-menu-grid');
  if (!tabs || !grid) return;

  let activeCat = 0;

  function render() {
    const lang = localStorage.getItem('margel_lang') || 'bg';

    tabs.innerHTML = '';
    drinkCategories[lang].forEach((catName, i) => {
      const btn = document.createElement('button');
      btn.className = 'drinks-menu-tab' + (i === activeCat ? ' active' : '');
      btn.type = 'button';
      btn.textContent = catName;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === activeCat ? 'true' : 'false');
      btn.addEventListener('click', () => { activeCat = i; render(); });
      tabs.appendChild(btn);
    });

    grid.innerHTML = '';
    drinks.filter(d => d.cat === activeCat).forEach(d => {
      const card = document.createElement('article');
      card.className = 'drink-card';

      const imgWrap = document.createElement('div'); imgWrap.className = 'drink-card-img';
      const img = document.createElement('img');
      img.src = d.img;
      img.alt = lang === 'bg' ? d.name_bg : d.name_en;
      img.loading = 'lazy';
      imgWrap.appendChild(img);

      const body = document.createElement('div'); body.className = 'drink-card-body';
      const name = document.createElement('h3'); name.className = 'drink-card-name';
      name.textContent = lang === 'bg' ? d.name_bg : d.name_en;
      const price = document.createElement('p'); price.className = 'drink-card-price';
      price.textContent = '€' + Number(d.price_eur).toFixed(2);

      body.appendChild(name); body.appendChild(price);
      card.appendChild(imgWrap); card.appendChild(body);
      grid.appendChild(card);
    });
  }

  render();
  document.addEventListener('langChange', render);
});
