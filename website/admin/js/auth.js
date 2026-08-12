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
  // Reveal owner-only UI (e.g. the Activity-log nav link) for the two owners.
  // Non-fatal: a failure just leaves owner-only elements hidden.
  try {
    const { data: isOwner } = await db.rpc('is_owner');
    if (isOwner) document.querySelectorAll('.owner-only').forEach(el => { el.hidden = false; });
  } catch (_) { /* ignore */ }
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
