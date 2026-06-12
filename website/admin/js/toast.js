// Tiny toast helper — non-blocking feedback instead of native alert().
// Usage: showToast('Saved.', 'success' | 'error' | undefined)
// Styles live in admin.css (.toast-stack / .toast).
(function () {
  const TOAST_VISIBLE_MS = 4200;
  const TOAST_EXIT_MS = 300;

  let stack = null;
  function ensureStack() {
    if (stack && document.body.contains(stack)) return stack;
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
    return stack;
  }

  window.showToast = function showToast(message, type) {
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ` toast--${type}` : '');
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.textContent = String(message ?? '');
    ensureStack().appendChild(el);
    // Double rAF so the entry transition actually plays.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    setTimeout(() => {
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), TOAST_EXIT_MS);
    }, TOAST_VISIBLE_MS);
    // Click to dismiss early.
    el.addEventListener('click', () => {
      el.classList.remove('is-in');
      setTimeout(() => el.remove(), TOAST_EXIT_MS);
    });
  };
})();
