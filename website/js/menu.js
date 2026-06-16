// Standalone drinks menu page — renders an editorial price list grouped by
// category from the shared drinks-data.js catalog (drinks + drinkCategories).
// Re-renders on language change.
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('menu-sections');
  if (!root || typeof drinks === 'undefined' || typeof drinkCategories === 'undefined') return;

  function render() {
    const lang = localStorage.getItem('margel_lang') || 'bg';
    const cats = drinkCategories[lang] || drinkCategories.bg;
    root.innerHTML = '';

    cats.forEach((catName, i) => {
      const items = drinks.filter(d => d.cat === i);
      if (!items.length) return;

      const section = document.createElement('section');
      section.className = 'menu-category';

      const h2 = document.createElement('h2');
      h2.className = 'menu-category-title';
      h2.textContent = catName;
      section.appendChild(h2);

      const list = document.createElement('ul');
      list.className = 'menu-list';
      list.setAttribute('role', 'list');

      items.forEach(d => {
        const li = document.createElement('li');
        li.className = 'menu-row';

        const name = document.createElement('span');
        name.className = 'menu-row-name';
        name.textContent = lang === 'bg' ? d.name_bg : d.name_en;

        const dots = document.createElement('span');
        dots.className = 'menu-row-dots';
        dots.setAttribute('aria-hidden', 'true');

        const price = document.createElement('span');
        price.className = 'menu-row-price';
        price.textContent = '€' + Number(d.price_eur).toFixed(2);

        li.append(name, dots, price);
        list.appendChild(li);
      });

      section.appendChild(list);
      root.appendChild(section);
    });
  }

  render();
  document.addEventListener('langChange', render);
});
