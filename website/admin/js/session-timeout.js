// Idle session timeout for the admin panel.
// Supabase refresh tokens keep a session alive indefinitely, so an unattended
// authenticated tab stays logged in. This logs the admin out after a period of
// inactivity (mitigating shoulder-surfing / unlocked-machine risk).
//
// Self-contained. Relies on the global `db` (Supabase client, from
// supabase-client.js) and, when present, the global showToast() (from toast.js).
// Loaded only on authenticated admin pages — never on login.html — so there is
// no logout/redirect loop.
(function () {
  'use strict';

  var IDLE_LIMIT_MS = 30 * 60 * 1000;   // 30 min of no activity → sign out
  var WARN_BEFORE_MS = 2 * 60 * 1000;   // surface a warning 2 min before logout
  var ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click', 'mousemove'];
  var THROTTLE_MS = 1000;               // reset the timer at most once per second

  var idleTimer = null;
  var warnTimer = null;
  var lastReset = 0;
  var loggingOut = false;

  function isBg() {
    try { return (localStorage.getItem('margel_lang') || 'bg') === 'bg'; } catch (e) { return true; }
  }

  function clearTimers() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (warnTimer) { clearTimeout(warnTimer); warnTimer = null; }
  }

  function warn() {
    var msg = isBg()
      ? 'Сесията ще изтече скоро поради неактивност.'
      : 'Your session will expire soon due to inactivity.';
    if (typeof showToast === 'function') showToast(msg, 'error');
  }

  function logout() {
    if (loggingOut) return;
    loggingOut = true;
    clearTimers();
    var done = function () { window.location.href = 'login.html?expired=1'; };
    try {
      if (typeof db !== 'undefined' && db.auth && db.auth.signOut) {
        // Redirect regardless of whether signOut resolves or rejects.
        db.auth.signOut().then(done, done);
        return;
      }
    } catch (e) { /* fall through to redirect */ }
    done();
  }

  function reset() {
    if (loggingOut) return;
    clearTimers();
    warnTimer = setTimeout(warn, Math.max(0, IDLE_LIMIT_MS - WARN_BEFORE_MS));
    idleTimer = setTimeout(logout, IDLE_LIMIT_MS);
  }

  function onActivity() {
    if (loggingOut) return;
    var now = Date.now();
    if (now - lastReset < THROTTLE_MS) return;
    lastReset = now;
    reset();
  }

  ACTIVITY_EVENTS.forEach(function (ev) {
    document.addEventListener(ev, onActivity, { passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) onActivity();
  });

  reset();   // start the clock on page load
})();
