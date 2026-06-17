// requireAuth: call at the top of each protected page's DOMContentLoaded handler.
// Checks for an active Supabase session. Redirects to login.html if none found.
// Returns the session object if authenticated.
async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = 'login.html';
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
