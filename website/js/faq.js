const faqs = [
  { q_bg: 'Колко човека събира залата?', q_en: 'How many people does the venue hold?', a_bg: 'Залата може да побере до 200 човека в зависимост от конфигурацията на събитието.', a_en: 'The venue can accommodate up to 200 people depending on event configuration.' },
  { q_bg: 'Може ли да си доведем кетъринг?', q_en: 'Can we bring our own catering?', a_bg: 'Да, можете да ползвате собствен кетъринг. Разполагаме с оборудвана кухня.', a_en: 'Yes, you can bring your own catering. We have a fully equipped kitchen available.' },
  { q_bg: 'Може ли да си доведем музика?', q_en: 'Can we bring our own DJ or band?', a_bg: 'Да, можете да доведете свой DJ или жива музика. Залата разполага с пълна звукова система.', a_en: 'Yes, you can bring your own DJ or live band. The venue has a full sound system.' },
  { q_bg: 'Може ли да ни покажат залата?', q_en: 'Can we visit the venue?', a_bg: 'Разбира се! Свържете се с нас за да уговорим посещение.', a_en: 'Of course! Contact us to arrange a viewing.' },
  { q_bg: 'До колко часа може да остане?', q_en: 'Until what time can events run?', a_bg: 'Вечерните тържества могат да продължат до 24:00 часа.', a_en: 'Evening events can run until midnight.' },
  { q_bg: 'Има ли паркинг?', q_en: 'Is there parking?', a_bg: 'Да, разполагаме с два обширни паркинга за Вашите гости.', a_en: 'Yes, we have two spacious parking areas for your guests.' },
  { q_bg: 'Силата на музика пречи ли на никого?', q_en: 'Does the music volume disturb neighbours?', a_bg: 'Залата е звукоизолирана, така че шумът не излиза извън нея.', a_en: 'The venue is fully soundproofed so noise does not escape outside.' },
  { q_bg: 'Какво е включено в наема на залата?', q_en: 'What is included in the venue rental?', a_bg: 'Включени са: бар оборудване, озвучаване, осветление, маси и столове, климатизация.', a_en: 'Included: bar equipment, sound system, lighting, tables and chairs, air conditioning.' },
  { q_bg: 'С какво оборудване разполага залата?', q_en: 'What equipment does the venue have?', a_bg: 'Пълна звукова система, проектор и екран, модерно осветление, бар, кухня и паркинг.', a_en: 'Full sound system, projector and screen, modern lighting, bar, kitchen, and parking.' },
  { q_bg: 'Допълнително оборудване, което може да бъде добавено?', q_en: 'Can additional equipment be added?', a_bg: 'Да, предлагаме допълнителни услуги като украса, фото кабина и DJ оборудване.', a_en: 'Yes, we offer additional services like decoration, photo booth, and DJ equipment.' },
  { q_bg: 'Може ли да видим снимки и клипове от събитията?', q_en: 'Can we see photos and videos from past events?', a_bg: 'Да! Разгледайте галерията ни или нашата Facebook страница.', a_en: 'Yes! Check out our gallery or our Facebook page.' },
];

const lang = localStorage.getItem('margel_lang') || 'bg';
const list = document.getElementById('faq-list');

function renderFaq(currentLang) {
  if (!list) return;
  list.innerHTML = '';
  faqs.forEach(faq => {
    const item = document.createElement('div');
    item.className = 'faq-item';

    const btn = document.createElement('button');
    btn.className = 'faq-question';
    btn.setAttribute('aria-expanded', 'false');

    const questionText = document.createElement('span');
    questionText.textContent = currentLang === 'bg' ? faq.q_bg : faq.q_en;

    const icon = document.createElement('span');
    icon.className = 'faq-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '+';

    btn.appendChild(questionText);
    btn.appendChild(icon);

    const answer = document.createElement('div');
    answer.className = 'faq-answer';
    const p = document.createElement('p');
    p.textContent = currentLang === 'bg' ? faq.a_bg : faq.a_en;
    answer.appendChild(p);

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      list.querySelectorAll('.faq-item.open').forEach(el => {
        el.classList.remove('open');
        el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    item.appendChild(btn);
    item.appendChild(answer);
    list.appendChild(item);
  });
}

renderFaq(lang);

document.addEventListener('langChange', e => renderFaq(e.detail.lang));
