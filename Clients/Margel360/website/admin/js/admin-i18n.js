const ADMIN_LANG = {
  en: {
    nav_enquiries:    'Enquiries',
    nav_calendar:     'Calendar',
    nav_logout:       'Logout',
    dash_title:       'Enquiries',
    dash_loading:     'Loading enquiries…',
    dash_empty:       'No enquiries received yet.',
    dash_error:       'Failed to load enquiries. Check console.',
    col_name:         'Name',
    col_phone:        'Phone',
    col_event:        'Event',
    col_date:         'Date',
    col_received:     'Received',
    col_edited:       'Edited',
    edit_never:       '—',
    edit_lock_btn:    'Lock editing',
    edit_unlock_btn:  'Unlock editing',
    edit_locked_badge:'Locked',
    edit_count_label: 'Customer edits',
    col_status:       'Status',
    col_actions:      'Actions',
    btn_view:         'View',
    btn_close:        'Close',
    status_new:       'New',
    status_answered:  'Answered',
    btn_mark_answered:'Mark answered',
    btn_mark_new:     'Mark as new',
    detail_email:     'Email',
    detail_guests:    'Guests',
    detail_time:      'Time',
    detail_time_day:  'Daytime (until 17:30)',
    detail_time_eve:  'Evening (after 19:00)',
    detail_payment:   'Payment',
    detail_addons:    'Add-on services',
    detail_drinks:    'Drinks',
    detail_notes:     'Notes',
    payment_heading:  'Payment tracking',
    payment_bank:     'Bank',
    payment_cash:     'Cash',
    payment_card:     'Card',
    payment_save:     'Save',
    payment_saved:    'Saved',
    payment_edit:     'Edit',
    payment_cancel:   'Cancel',
    payment_empty:    '—',
    cal_title:        'Occupied Dates',
    cal_sub:          'Click a date to mark it as occupied. Click again to unmark.',
    cal_prev:         'Prev',
    cal_next:         'Next',
    cal_occupied:     'Occupied',
    cal_available:    'Available',
    cal_occupied_aria: '— occupied',
    months:           ['January','February','March','April','May','June','July','August','September','October','November','December'],
    days_short:       ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    login_title:      'Admin Panel',
    login_email:      'Email',
    login_password:   'Password',
    login_btn:        'Sign In',
    login_signing:    'Signing in…',
    login_error:      'Invalid email or password. Please try again.',
  },
  bg: {
    nav_enquiries:    'Запитвания',
    nav_calendar:     'Календар',
    nav_logout:       'Изход',
    dash_title:       'Запитвания',
    dash_loading:     'Зареждане…',
    dash_empty:       'Все още няма получени запитвания.',
    dash_error:       'Грешка при зареждане. Проверете конзолата.',
    col_name:         'Име',
    col_phone:        'Телефон',
    col_event:        'Събитие',
    col_date:         'Дата',
    col_received:     'Получено',
    col_edited:       'Редактирано',
    edit_never:       '—',
    edit_lock_btn:    'Заключи редакция',
    edit_unlock_btn:  'Отключи редакция',
    edit_locked_badge:'Заключено',
    edit_count_label: 'Редакции от клиента',
    col_status:       'Статус',
    col_actions:      'Действия',
    btn_view:         'Преглед',
    btn_close:        'Затвори',
    status_new:       'Ново',
    status_answered:  'Отговорено',
    btn_mark_answered:'Отбележи като отговорено',
    btn_mark_new:     'Отбележи като ново',
    detail_email:     'Имейл',
    detail_guests:    'Гости',
    detail_time:      'Час',
    detail_time_day:  'Дневен (до 17:30)',
    detail_time_eve:  'Вечерен (след 19:00)',
    detail_payment:   'Плащане',
    detail_addons:    'Допълнителни услуги',
    detail_drinks:    'Напитки',
    detail_notes:     'Бележки',
    payment_heading:  'Проследяване на плащане',
    payment_bank:     'Банка',
    payment_cash:     'В брой',
    payment_card:     'Карта',
    payment_save:     'Запази',
    payment_saved:    'Запазено',
    payment_edit:     'Редактирай',
    payment_cancel:   'Отказ',
    payment_empty:    '—',
    cal_title:        'Заети дати',
    cal_sub:          'Натиснете дата, за да я отбележите като заета. Натиснете отново за отмяна.',
    cal_prev:         'Назад',
    cal_next:         'Напред',
    cal_occupied:     'Заето',
    cal_available:    'Свободно',
    cal_occupied_aria: '— заето',
    months:           ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември'],
    days_short:       ['Пон','Вт','Ср','Чет','Пет','Съб','Нед'],
    login_title:      'Административен панел',
    login_email:      'Имейл',
    login_password:   'Парола',
    login_btn:        'Вход',
    login_signing:    'Влизане…',
    login_error:      'Невалиден имейл или парола. Моля, опитайте отново.',
  }
};

function getAdminLang() {
  return localStorage.getItem('admin_lang') || 'bg';
}

function setAdminLang(lang) {
  localStorage.setItem('admin_lang', lang);
  applyAdminLang(lang);
}

function applyAdminLang(lang) {
  const tr = ADMIN_LANG[lang] || ADMIN_LANG.bg;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (tr[key] !== undefined) el.textContent = tr[key];
  });
  document.documentElement.lang = lang === 'bg' ? 'bg' : 'en';
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

function t(key) {
  return (ADMIN_LANG[getAdminLang()] || ADMIN_LANG.bg)[key] ?? key;
}

document.addEventListener('DOMContentLoaded', () => {
  applyAdminLang(getAdminLang());
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setAdminLang(btn.dataset.lang);
      // Re-render dynamic content if a render function exists
      if (typeof rerenderPage === 'function') rerenderPage();
    });
  });
});
