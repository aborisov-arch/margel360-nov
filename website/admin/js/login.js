try {
      // ?return=<encoded-url> lets other pages (e.g. /edit.html in admin
      // mode) bounce here when there's no session and come back after
      // login. Restricted to SAME-ORIGIN relative paths to prevent open
      // redirect phishing (decoding once, then asserting it starts with
      // a single "/" and has no scheme or "//" prefix).
      function safeReturn(raw) {
        if (!raw) return 'dashboard.html';
        let decoded;
        try { decoded = decodeURIComponent(raw); } catch { return 'dashboard.html'; }
        if (/[\r\n\t]/.test(decoded)) return 'dashboard.html';
        // Resolve against our own origin and only accept a result that
        // stays on it. The URL constructor normalises absolute URLs,
        // protocol-relative "//evil.com", and backslash / %5C tricks that
        // a character-class regex can miss - anything off-origin falls
        // back to the dashboard. Path + query + hash are preserved so
        // /edit.html?token=… in admin mode still round-trips.
        try {
          const u = new URL(decoded, window.location.origin);
          if (u.origin !== window.location.origin) return 'dashboard.html';
          const path = u.pathname + u.search + u.hash;
          return path.startsWith('/') ? path : 'dashboard.html';
        } catch {
          return 'dashboard.html';
        }
      }
      const postLogin = safeReturn(new URLSearchParams(window.location.search).get('return'));
      db.auth.getSession().then(({ data: { session } }) => {
        if (session) window.location.href = postLogin;
      });

      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn    = document.getElementById('login-btn');
        const errEl  = document.getElementById('login-error');
        btn.disabled = true;
        btn.textContent = t('login_signing');
        errEl.style.display = 'none';

        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) {
          errEl.textContent    = t('login_error');
          errEl.style.display  = 'block';
          btn.disabled         = false;
          btn.textContent      = t('login_btn');
        } else {
          window.location.href = postLogin;
        }
      });

      // Forgot password - sends a Supabase recovery link to reset.html.
      // Always shows the same neutral message (never reveals whether an
      // account exists for that email).
      document.getElementById('forgot-link').addEventListener('click', async () => {
        const errEl  = document.getElementById('login-error');
        const infoEl = document.getElementById('login-info');
        const email  = document.getElementById('email').value.trim();
        errEl.style.display = 'none';
        infoEl.style.display = 'none';
        if (!email) {
          errEl.textContent = 'Въведете имейла си, после натиснете „Забравена парола?".';
          errEl.style.display = 'block';
          return;
        }
        try {
          await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/admin/reset.html' });
        } catch (_) { /* neutral message either way */ }
        infoEl.textContent = 'Ако има акаунт с този имейл, изпратихме линк за смяна на паролата.';
        infoEl.style.display = 'block';
      });
    } catch (err) {
      console.error('Admin login init error:', err);
    }
