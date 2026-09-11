// Owner-only user administration (admin/users.html). Lists the admin
// accounts and lets an owner set a new password for any of them. Everything
// privileged happens in the admin-users edge function (JWT + is_owner()
// gate + service role); this file is UI only. The owner check up front just
// gives non-owners a clear message instead of a 403 toast.

const GENERATED_PASSWORD_LENGTH = 14;
const MIN_PASSWORD_LENGTH = 8;

let allUsers = [];
let openUserId = null;
let currentEmail = '';

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmtDate(iso) {
  if (!iso) return t('usr_never');
  const locale = getAdminLang() === 'en' ? 'en-GB' : 'bg-BG';
  return new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Unambiguous alphabet (no 0/O, 1/l/I) + a symbol so it passes typical
// strength rules; the owner copies it into the email/message to the user.
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(GENERATED_PASSWORD_LENGTH - 1);
  crypto.getRandomValues(bytes);
  const core = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
  return core + '!';
}

// functions.invoke surfaces non-2xx as an error whose context is the raw
// Response - pull the JSON body out so the UI can show the real reason.
async function invokeAdminUsers(body) {
  const { data, error } = await db.functions.invoke('admin-users', { body });
  if (!error) return { data };
  let detail = null;
  try { detail = await error.context?.json(); } catch (_) { /* no JSON body */ }
  return { error: detail?.error || error.message || 'error', detail: detail?.detail };
}

function passwordFormRow(u) {
  return `
    <tr class="usr-pw-row" data-id="${esc(u.id)}">
      <td colspan="4">
        <form class="usr-pw-form" autocomplete="off" data-id="${esc(u.id)}">
          <label for="usr-pw-${esc(u.id)}" class="usr-pw-label">${esc(t('usr_pw_label'))} <strong>${esc(u.email)}</strong></label>
          <input type="text" id="usr-pw-${esc(u.id)}" class="usr-pw-input" autocomplete="off" spellcheck="false" minlength="${MIN_PASSWORD_LENGTH}" maxlength="72" placeholder="${esc(t('usr_pw_placeholder'))}">
          <button type="button" class="btn btn-outline btn-sm usr-gen">${esc(t('usr_generate'))}</button>
          <button type="submit" class="btn btn-primary btn-sm usr-save">${esc(t('usr_save'))}</button>
          <button type="button" class="btn btn-outline btn-sm usr-cancel">${esc(t('usr_cancel'))}</button>
        </form>
      </td>
    </tr>`;
}

function renderTable() {
  const body = document.getElementById('usr-body');
  if (!allUsers.length) {
    body.innerHTML = `<tr><td colspan="4" style="color:#777">${esc(t('usr_empty'))}</td></tr>`;
    return;
  }
  body.innerHTML = allUsers.map(u => {
    const isMe = u.email.toLowerCase() === currentEmail;
    return `
      <tr data-id="${esc(u.id)}">
        <td>${esc(u.email)}${isMe ? ` <span class="usr-you">${esc(t('usr_you'))}</span>` : ''}</td>
        <td>${esc(fmtDate(u.created_at))}</td>
        <td>${esc(fmtDate(u.last_sign_in_at))}</td>
        <td><button type="button" class="btn btn-outline btn-sm usr-change" data-id="${esc(u.id)}">${esc(t('usr_change'))}</button></td>
      </tr>` + (openUserId === u.id ? passwordFormRow(u) : '');
  }).join('');
  if (openUserId) document.getElementById(`usr-pw-${openUserId}`)?.focus();
}

// admin-i18n.js calls this after a language switch.
function rerenderPage() {
  if (document.getElementById('content').style.display === 'none') return;
  renderTable();
}

async function loadUsers() {
  const { data, error } = await invokeAdminUsers({ action: 'list' });
  if (error) throw new Error(error);
  allUsers = data?.users ?? [];
}

async function savePassword(form) {
  const id = form.getAttribute('data-id');
  const user = allUsers.find(u => u.id === id);
  const input = form.querySelector('.usr-pw-input');
  const pw = input.value;
  if (!user) return;
  if (pw.length < MIN_PASSWORD_LENGTH) { showToast(t('usr_pw_short'), 'error'); input.focus(); return; }
  const btn = form.querySelector('.usr-save');
  btn.disabled = true; btn.textContent = t('usr_saving');
  const { data, error, detail } = await invokeAdminUsers({ action: 'set_password', user_id: id, password: pw });
  if (error) {
    btn.disabled = false; btn.textContent = t('usr_save');
    const msg = error === 'weak_password' ? t('usr_weak') + (detail ? ` (${detail})` : '')
              : error === 'forbidden'     ? t('usr_no_access')
              : t('usr_error');
    showToast(msg, 'error');
    return;
  }
  openUserId = null;
  showToast((data?.sessions_revoked ? t('usr_ok') : t('usr_ok_nosess')).replace('{email}', data?.email || user.email), 'success');
  // The audit row and last-sign-in may have moved; refresh quietly.
  try { await loadUsers(); } catch (_) { /* keep the current list */ }
  renderTable();
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;
  currentEmail = (session.user?.email || '').toLowerCase();

  const loading = document.getElementById('loading');
  let isOwner = false;
  try { const { data } = await db.rpc('is_owner'); isOwner = !!data; } catch (_) { isOwner = false; }
  if (!isOwner) {
    loading.style.display = 'none';
    document.getElementById('no-access').style.display = 'block';
    return;
  }

  try {
    await loadUsers();
  } catch (e) {
    loading.style.display = 'none';
    document.getElementById('content').style.display = 'block';
    document.getElementById('usr-body').innerHTML =
      `<tr><td colspan="4" style="color:var(--accent)">${esc(t('usr_error'))}: ${esc(e.message)}</td></tr>`;
    return;
  }
  loading.style.display = 'none';
  document.getElementById('content').style.display = 'block';
  renderTable();

  const table = document.getElementById('usr-table');
  table.addEventListener('click', (evt) => {
    const change = evt.target.closest('.usr-change');
    if (change) { openUserId = openUserId === change.getAttribute('data-id') ? null : change.getAttribute('data-id'); renderTable(); return; }
    const gen = evt.target.closest('.usr-gen');
    if (gen) { const input = gen.closest('form').querySelector('.usr-pw-input'); input.value = generatePassword(); input.focus(); input.select(); return; }
    const cancel = evt.target.closest('.usr-cancel');
    if (cancel) { openUserId = null; renderTable(); return; }
  });
  table.addEventListener('submit', (evt) => {
    const form = evt.target.closest('.usr-pw-form');
    if (!form) return;
    evt.preventDefault();
    savePassword(form);
  });
});
