// Reaches here two ways: (1) from a Supabase recovery link - the client
    // auto-detects the token in the URL and establishes a temporary session;
    // (2) an already-logged-in admin changing their own password. Either way,
    // a present session means we can call updateUser({ password }).
    try {
      const form      = document.getElementById('reset-form');
      const msg       = document.getElementById('reset-msg');
      const loadingEl = document.getElementById('reset-loading');
      const invalidEl = document.getElementById('reset-invalid');
      let shown = false;

      function showForm() {
        if (shown) return;
        shown = true;
        loadingEl.style.display = 'none';
        invalidEl.style.display = 'none';
        form.style.display = 'block';
        document.getElementById('new-password').focus();
      }
      function showInvalid() {
        if (shown) return;
        loadingEl.style.display = 'none';
        form.style.display = 'none';
        invalidEl.style.display = 'block';
      }

      // The recovery session may arrive via this event…
      db.auth.onAuthStateChange((_event, session) => { if (session) showForm(); });
      // …or already be present. Give detectSessionInUrl a moment before giving up.
      db.auth.getSession().then(({ data: { session } }) => {
        if (session) { showForm(); return; }
        setTimeout(() => {
          db.auth.getSession().then(({ data: { session: s } }) => { if (s) showForm(); else showInvalid(); });
        }, 1500);
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msg.style.display = 'none';
        const pw = document.getElementById('new-password').value;
        const cf = document.getElementById('confirm-password').value;
        if (pw.length < 8) { msg.textContent = 'Паролата трябва да е поне 8 символа.'; msg.style.display = 'block'; return; }
        if (pw !== cf)     { msg.textContent = 'Паролите не съвпадат.'; msg.style.display = 'block'; return; }
        const btn = document.getElementById('reset-btn');
        btn.disabled = true; btn.textContent = 'Запазване…';
        const { error } = await db.auth.updateUser({ password: pw });
        if (error) {
          msg.textContent = 'Грешка: ' + (error.message || 'неуспешно записване');
          msg.style.display = 'block';
          btn.disabled = false; btn.textContent = 'Запази паролата';
          return;
        }
        document.querySelector('.login-card').innerHTML =
          '<div class="login-logo">МАРГЕЛ <span>360°</span></div>' +
          '<h1 class="login-title">Паролата е запазена ✓</h1>' +
          '<p style="text-align:center;color:#555">Пренасочване към панела…</p>';
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1300);
      });
    } catch (err) {
      console.error('Reset init error:', err);
    }
