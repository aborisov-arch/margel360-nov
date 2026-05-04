(function () {
  const STORAGE_KEY = 'margel_age_verified';
  const LANG_KEY = 'margel_lang';

  const COPY = {
    bg: {
      title: 'Потвърждение за възраст',
      body: 'Навършили ли сте 18 години?',
      note: 'Този раздел съдържа алкохолни напитки.',
      yes: 'Да, навършил съм 18',
      no: 'Не',
    },
    en: {
      title: 'Age Verification',
      body: 'Are you 18 years or older?',
      note: 'This section contains alcoholic beverages.',
      yes: 'Yes, I am 18+',
      no: 'No',
    },
  };

  function getLang() {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'bg';
  }

  function isVerified() {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; }
    catch (e) { return false; }
  }

  function markVerified() {
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById('age-gate-styles')) return;
    const style = document.createElement('style');
    style.id = 'age-gate-styles';
    style.textContent = `
      .age-gate-overlay {
        position: fixed; inset: 0;
        background: rgba(10, 10, 12, 0.92);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        padding: 24px;
        animation: age-gate-fade 0.25s ease;
      }
      @keyframes age-gate-fade { from { opacity: 0; } to { opacity: 1; } }
      .age-gate-card {
        background: #fff;
        color: #1a1a1a;
        max-width: 440px; width: 100%;
        border-radius: 14px;
        padding: 36px 32px 28px;
        text-align: center;
        box-shadow: 0 24px 80px rgba(0,0,0,0.4);
      }
      .age-gate-card h2 {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 1.8px;
        color: #c9a84c;
        font-weight: 700;
        margin-bottom: 18px;
      }
      .age-gate-card p.age-gate-body {
        font-size: 1.35rem;
        font-weight: 700;
        line-height: 1.3;
        color: #1a1a1a;
        margin-bottom: 10px;
      }
      .age-gate-card p.age-gate-note {
        font-size: 0.88rem;
        color: #777;
        margin-bottom: 28px;
      }
      .age-gate-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
      .age-gate-actions button {
        flex: 1 1 140px;
        padding: 13px 24px;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 600;
        letter-spacing: 0.3px;
        font-family: inherit;
        border: none;
        cursor: pointer;
        transition: background 0.25s ease, color 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
      }
      .age-gate-actions .age-gate-yes {
        background: #c9a84c; color: #fff;
      }
      .age-gate-actions .age-gate-yes:hover {
        background: #b8923a; transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(201,168,76,0.35);
      }
      .age-gate-actions .age-gate-no {
        background: transparent; color: #1a1a1a; border: 2px solid #e8e4dd;
      }
      .age-gate-actions .age-gate-no:hover { border-color: #c9a84c; color: #c9a84c; }
      .age-gate-actions button:focus-visible { outline: 3px solid #c9a84c; outline-offset: 3px; }
    `;
    document.head.appendChild(style);
  }

  function buildOverlay(onYes, onNo) {
    const lang = getLang();
    const c = COPY[lang];

    const overlay = document.createElement('div');
    overlay.className = 'age-gate-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'age-gate-title');

    overlay.innerHTML = `
      <div class="age-gate-card">
        <h2 id="age-gate-title">${c.title}</h2>
        <p class="age-gate-body">${c.body}</p>
        <p class="age-gate-note">${c.note}</p>
        <div class="age-gate-actions">
          <button type="button" class="age-gate-no">${c.no}</button>
          <button type="button" class="age-gate-yes">${c.yes}</button>
        </div>
      </div>
    `;

    const yesBtn = overlay.querySelector('.age-gate-yes');
    const noBtn = overlay.querySelector('.age-gate-no');

    yesBtn.addEventListener('click', () => {
      markVerified();
      removeOverlay(overlay);
      if (typeof onYes === 'function') onYes();
    });
    noBtn.addEventListener('click', () => {
      removeOverlay(overlay);
      if (typeof onNo === 'function') onNo();
    });

    trapFocus(overlay, yesBtn);
    return overlay;
  }

  function trapFocus(overlay, initialFocus) {
    const prevActive = document.activeElement;
    const focusables = overlay.querySelectorAll('button');

    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); return; }
      if (e.key !== 'Tab') return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });

    overlay._prevActive = prevActive;
    setTimeout(() => initialFocus && initialFocus.focus(), 50);
  }

  function removeOverlay(overlay) {
    if (overlay._prevActive && typeof overlay._prevActive.focus === 'function') {
      try { overlay._prevActive.focus(); } catch (e) {}
    }
    overlay.remove();
    document.body.style.overflow = '';
  }

  function verify(onConfirm) {
    if (isVerified()) {
      if (typeof onConfirm === 'function') onConfirm();
      return;
    }
    injectStyles();
    document.body.style.overflow = 'hidden';
    const overlay = buildOverlay(
      onConfirm,
      () => { window.location.href = 'index.html'; }
    );
    document.body.appendChild(overlay);
  }

  window.AgeGate = { verify, isVerified };
})();
