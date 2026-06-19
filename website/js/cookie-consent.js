// Cookie consent banner — Google Consent Mode v2.
// Each page's <head> sets the consent default to 'denied'; this banner lets
// the visitor grant it (gtag('consent','update', …)) and remembers the choice
// so analytics/ads only run with consent. Self-contained (no dependencies).
(function () {
  'use strict';
  var KEY = 'margel_cookie_consent';

  function grant() {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        ad_storage: 'granted',
        ad_user_data: 'granted',
        ad_personalization: 'granted',
        analytics_storage: 'granted'
      });
    }
  }

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved === 'granted') { grant(); return; }   // already accepted
  if (saved === 'denied') { return; }             // already declined → stays denied

  function show() {
    var bg = true;
    try { bg = (localStorage.getItem('margel_lang') || 'bg') === 'bg'; } catch (e) {}
    var T = bg
      ? { text: 'Използваме бисквитки за анализ и реклама, за да подобряваме сайта. Можете да приемете или да откажете.', accept: 'Приемам', reject: 'Отказвам' }
      : { text: 'We use cookies for analytics and advertising to improve the site. You can accept or decline.', accept: 'Accept', reject: 'Decline' };

    var style = document.createElement('style');
    style.textContent =
      '.cc-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#1a1a1a;color:#f4f1ea;' +
      'box-shadow:0 -6px 30px rgba(0,0,0,.28);padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;' +
      'gap:12px 20px;font:400 14px/1.5 "Inter",Arial,sans-serif;transform:translateY(110%);transition:transform .35s ease}' +
      '.cc-banner.cc-show{transform:translateY(0)}' +
      '.cc-banner p{margin:0;flex:1 1 280px;min-width:220px}' +
      '.cc-actions{display:flex;gap:10px;flex:0 0 auto}' +
      '.cc-btn{cursor:pointer;border:0;border-radius:8px;padding:10px 18px;font:600 14px "Inter",Arial,sans-serif}' +
      '.cc-accept{background:#c9a84c;color:#1a1a1a}.cc-accept:hover{background:#b8923a}' +
      '.cc-reject{background:transparent;color:#f4f1ea;border:1px solid rgba(244,241,234,.4)}' +
      '.cc-reject:hover{background:rgba(244,241,234,.1)}' +
      '@media(max-width:560px){.cc-banner{padding:13px 14px}.cc-actions{flex:1 1 100%}.cc-btn{flex:1}}';
    document.head.appendChild(style);

    var b = document.createElement('div');
    b.className = 'cc-banner';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-live', 'polite');
    b.setAttribute('aria-label', bg ? 'Съгласие за бисквитки' : 'Cookie consent');
    b.innerHTML =
      '<p>' + T.text + '</p>' +
      '<div class="cc-actions">' +
      '<button class="cc-btn cc-reject" type="button">' + T.reject + '</button>' +
      '<button class="cc-btn cc-accept" type="button">' + T.accept + '</button>' +
      '</div>';
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('cc-show'); });

    function close() {
      b.classList.remove('cc-show');
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 350);
    }
    b.querySelector('.cc-accept').addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'granted'); } catch (e) {}
      grant(); close();
    });
    b.querySelector('.cc-reject').addEventListener('click', function () {
      try { localStorage.setItem(KEY, 'denied'); } catch (e) {}
      close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show);
  else show();
})();
