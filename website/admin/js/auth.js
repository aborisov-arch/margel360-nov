// requireAuth: call at the top of each protected page's DOMContentLoaded handler.
// Checks for an active Supabase session. Redirects to login.html if none found.
// Returns the session object if authenticated.
async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  // Authorization gate (UX layer - RLS is the real boundary): an
  // authenticated session that is not on the admin allowlist gets signed
  // out and bounced with a message instead of a dead dashboard.
  try {
    const { data: isAdmin, error } = await db.rpc('is_admin');
    if (!error && isAdmin === false) {
      await db.auth.signOut();
      window.location.href = 'login.html?error=not_admin';
      return null;
    }
  } catch (_) { /* fail open - RLS still protects the data */ }
  // Reveal tiered UI and guard tiered pages (UX layer - RLS is the boundary):
  // owner-only = audit log (Дневник), finance-only = Финанси. The blog editor
  // (gogov) is a plain admin: both stay hidden and both pages bounce him.
  try {
    const [ownerRes, finRes] = await Promise.all([db.rpc('is_owner'), db.rpc('is_finance_admin')]);
    if (ownerRes.data) document.querySelectorAll('.owner-only').forEach(el => { el.hidden = false; });
    if (finRes.data) document.querySelectorAll('.finance-only').forEach(el => { el.hidden = false; });
    const page = (window.location.pathname.split('/').pop() || '').toLowerCase();
    if ((page === 'financials.html' && finRes.data === false) ||
        (page === 'activity.html' && ownerRes.data === false)) {
      window.location.href = 'dashboard.html';
      return null;
    }
  } catch (_) { /* ignore - RLS still protects the data */ }
  return session;
}

// Wire the logout button on any page that includes this script.
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await db.auth.signOut();
      window.location.href = 'login.html';
    });
  }
});
