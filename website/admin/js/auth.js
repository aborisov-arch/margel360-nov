// requireAuth: call at the top of each protected page's DOMContentLoaded handler.
// Checks for an active Supabase session. Redirects to login.html if none found.
// Returns the session object if authenticated.
async function requireAuth() {
  const here = () => encodeURIComponent(location.pathname + location.search + location.hash);
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'login.html?return=' + here();
    return null;
  }
  // Enforce two-factor (AAL2). A password-only session is not enough to
  // reach admin data. Lockout-safe: an admin with no factor is sent to
  // security.html to enrol, not stranded; one whose factor hasn't been
  // verified this session is bounced to login to complete the challenge.
  const { data: aal, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !aal) { window.location.href = 'login.html'; return null; }
  if (aal.currentLevel !== 'aal2') {
    window.location.href = (aal.nextLevel === 'aal2')
      ? 'login.html?return=' + here()
      : 'security.html';
    return null;
  }
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
