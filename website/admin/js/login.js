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

      // Turnstile token is single-use - read it at submit, then reset the
      // widget so a retry gets a fresh one. Until CAPTCHA protection is
      // switched on in Supabase Auth settings the token is sent and ignored.
      function captchaToken() {
        try { return (typeof turnstile !== 'undefined' && turnstile.getResponse()) || undefined; }
        catch { return undefined; }
      }
      function resetCaptcha() {
        try { if (typeof turnstile !== 'undefined') turnstile.reset(); } catch { /* not rendered */ }
      }

      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn    = document.getElementById('login-btn');
        const errEl  = document.getElementById('login-error');
        btn.disabled = true;
        btn.textContent = t('login_signing');
        errEl.style.display = 'none';

        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        const { error } = await db.auth.signInWithPassword({
          email, password, options: { captchaToken: captchaToken() },
        });
        resetCaptcha();
        if (error) {
          // If the captcha wasn't ready yet (managed widget still solving on
          // a fast submit), say so instead of "wrong password".
          const emsg = String(error.message || error).toLowerCase();
          errEl.textContent    = emsg.includes('captcha') ? t('login_captcha_wait') : t('login_error');
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
          await db.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/admin/reset.html',
            captchaToken: captchaToken(),
          });
        } catch (_) { /* neutral message either way */ }
        resetCaptcha();
        infoEl.textContent = 'Ако има акаунт с този имейл, изпратихме линк за смяна на паролата.';
        infoEl.style.display = 'block';
      });

      // Google OAuth - links to the EXISTING admin user with the same
      // @margel.info email. Signups MUST be disabled in Supabase Auth (PR
      // runbook step 0) so unknown Google accounts are rejected; until
      // then RLS + the requireAuth is_admin bounce still block them.
      // Authorization stays is_admin().
      document.getElementById('google-login-btn')?.addEventListener('click', async () => {
        const errEl = document.getElementById('login-error');
        errEl.style.display = 'none';
        const { error } = await db.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin + '/admin/dashboard.html',
            queryParams: { hd: 'margel.info', prompt: 'select_account' },
          },
        });
        if (error) {
          errEl.textContent = t('login_google_error');
          errEl.style.display = 'block';
        }
      });
      // Surface OAuth/bounce errors carried back in the URL.
      {
        const qs = new URLSearchParams(window.location.search);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const errEl = document.getElementById('login-error');
        if (qs.get('error') === 'not_admin') {
          errEl.textContent = t('login_not_admin');
          errEl.style.display = 'block';
        } else if (qs.get('error') || hash.get('error')) {
          errEl.textContent = t('login_google_error');
          errEl.style.display = 'block';
        }
      }
    } catch (err) {
      console.error('Admin login init error:', err);
    }
