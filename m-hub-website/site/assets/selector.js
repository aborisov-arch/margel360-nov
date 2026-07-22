/* M-HUB — interactive unit selector (Building 2 floor plan) */
(function () {
  var dataEl = document.getElementById('unit-data');
  if (!dataEl) return;
  var cfg = JSON.parse(dataEl.textContent);
  var stage = document.getElementById('sel-stage');
  var svg = document.getElementById('sel-svg');
  var tip = document.getElementById('sel-tip');
  if (!svg || !stage) return;

  var els = {
    name: document.getElementById('sp-name'),
    badge: document.getElementById('sp-badge'),
    wh: document.getElementById('sp-wh'),
    mezz: document.getElementById('sp-mezz'),
    yard: document.getElementById('sp-yard'),
    ideal: document.getElementById('sp-ideal'),
    avg: document.getElementById('sp-avg'),
    total: document.getElementById('sp-total'),
    cta: document.getElementById('sp-cta')
  };

  function unit(n) {
    for (var i = 0; i < cfg.units.length; i++) if (cfg.units[i].n === n) return cfg.units[i];
    return null;
  }

  function select(n) {
    var u = unit(n);
    if (!u) return;
    var rects = svg.querySelectorAll('rect.u');
    for (var i = 0; i < rects.length; i++) rects[i].classList.remove('sel');
    var r = svg.querySelector('rect.u[data-unit="' + n + '"]');
    if (r) r.classList.add('sel');
    els.name.textContent = u.name;
    els.badge.textContent = u.statusLabel;
    els.badge.className = 'badge ' + (u.status === 'available' ? 'badge-sale' : 'badge-reserved');
    els.wh.textContent = u.wh;
    els.mezz.textContent = u.mezz;
    els.yard.textContent = u.yard;
    els.ideal.textContent = u.ideal;
    els.avg.textContent = u.avg;
    els.total.textContent = u.total;
    els.cta.href = cfg.contactUrl + '?unit=' + n;
    els.cta.textContent = cfg.ctaLabel.replace('{n}', u.name);
  }

  function showTip(u, evt) {
    tip.innerHTML =
      '<div class="tt-name">' + u.name + '</div>' +
      '<div class="tt-row">' + u.wh + ' · ' + cfg.tipMezz + ' ' + u.mezz + '</div>' +
      '<div class="tt-row tt-price">' + u.total + '</div>' +
      '<div class="tt-status' + (u.status === 'available' ? '' : ' tt-res') + '">' + u.statusLabel + '</div>';
    tip.style.display = 'block';
    moveTip(evt);
  }

  function moveTip(evt) {
    var b = stage.getBoundingClientRect();
    var x = evt.clientX - b.left, y = evt.clientY - b.top;
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    x = Math.min(Math.max(x - tw / 2, 8), b.width - tw - 8);
    y = y - th - 18;
    if (y < 4) y = evt.clientY - b.top + 20;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  var rects = svg.querySelectorAll('rect.u');
  for (var i = 0; i < rects.length; i++) {
    (function (r) {
      var u = unit(parseInt(r.getAttribute('data-unit'), 10));
      r.addEventListener('mouseenter', function (e) { showTip(u, e); });
      r.addEventListener('mousemove', moveTip);
      r.addEventListener('mouseleave', function () { tip.style.display = 'none'; });
      r.addEventListener('click', function () {
        select(u.n);
        var p = document.getElementById('sel-panel');
        if (p && window.innerWidth < 700) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      r.setAttribute('tabindex', '0');
      r.setAttribute('role', 'button');
      r.setAttribute('aria-label', u.name + ', ' + u.wh + ', ' + u.statusLabel);
      r.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(u.n); }
      });
    })(rects[i]);
  }

  select(cfg.initial);
})();
