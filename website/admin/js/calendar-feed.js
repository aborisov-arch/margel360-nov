// Google Calendar subscription card on admin/calendar.html.
//
// Each admin gets their own feed URL: the create_calendar_feed_token RPC
// mints a token, stores only its sha256 and returns the plaintext ONCE. The
// card therefore shows the full URL only in the page load that created it;
// on later visits it shows the token prefix, when it was created and when
// Google last fetched the feed (calendar-feed edge function bookkeeping).
// Copy lives in admin-i18n.js (gcal_*). calendar.js calls
// initCalendarFeedCard(session) after requireAuth() and renderFeedCard() on
// language switch; esc() comes from calendar.js.
const FEED_TOKEN_RE = /^[a-f0-9]{64}$/;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const AGO_HOURS_LIMIT = 48;

let feedRow = null;          // active token row (prefix + timestamps) or null
let feedFreshUrl = null;     // plaintext feed URL minted in this page load
let feedLoadFailed = false;

// Read at call time: SUPABASE_URL is a top-level const of supabase-client.js.
function feedBaseUrl() {
  return `${SUPABASE_URL}/functions/v1/calendar-feed?token=`;
}

// Never lets a card problem reach the calendar page: any failure degrades to
// the "status unavailable" state.
async function initCalendarFeedCard(_session) {
  try {
    await loadFeedRow();
  } catch (err) {
    console.error('Calendar feed card failed to load:', err);
    feedLoadFailed = true;
    feedRow = null;
  }
  renderFeedCard();
}

async function loadFeedRow() {
  const { data, error } = await db
    .from('calendar_feed_tokens')
    .select('token_prefix, created_at, last_fetched_at, fetch_count')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('Failed to load the calendar feed token:', error);
    feedLoadFailed = true;
    feedRow = null;
    return;
  }
  feedLoadFailed = false;
  feedRow = data || null;
}

function renderFeedCard() {
  const body = document.getElementById('gcal-body');
  if (!body) return;
  // A URL minted in this page load is shown whatever the status reload did -
  // it is the only time the admin will ever see it.
  if (feedFreshUrl) {
    body.innerHTML = feedFreshHtml(feedFreshUrl);
    document.getElementById('gcal-copy').addEventListener('click', copyFeedUrl);
    return;
  }
  if (feedLoadFailed) {
    body.innerHTML = `<p class="gcal-status">${esc(t('gcal_load_failed'))}</p>`;
    return;
  }
  if (feedRow) {
    body.innerHTML = feedActiveHtml(feedRow);
    document.getElementById('gcal-rotate').addEventListener('click', rotateFeedUrl);
    document.getElementById('gcal-revoke').addEventListener('click', revokeFeedUrl);
    return;
  }
  body.innerHTML = feedEmptyHtml();
  document.getElementById('gcal-create').addEventListener('click', createFeedUrl);
}

function feedEmptyHtml() {
  return `
    <p>${esc(t('gcal_intro'))}</p>
    <button type="button" class="btn btn-primary btn-sm" id="gcal-create">${esc(t('gcal_create'))}</button>
    <p class="gcal-note">${esc(t('gcal_note_personal'))}</p>
  `;
}

function feedFreshHtml(url) {
  return `
    <p>${esc(t('gcal_fresh_intro'))}</p>
    <div class="gcal-url-row">
      <input id="gcal-url" type="text" readonly value="${esc(url)}" aria-label="${esc(t('gcal_url_label'))}" spellcheck="false">
      <button type="button" class="btn btn-primary btn-sm" id="gcal-copy">${esc(t('gcal_copy'))}</button>
    </div>
    <ol class="gcal-steps" id="gcal-steps">
      <li>${esc(t('gcal_step1'))}</li>
      <li>${esc(t('gcal_step2'))}</li>
      <li>${esc(t('gcal_step3'))}</li>
    </ol>
    <p class="gcal-warn" id="gcal-warn" role="note">${esc(t('gcal_warn'))}</p>
  `;
}

function feedActiveHtml(row) {
  const fetched = row.last_fetched_at
    ? `${esc(t('gcal_last_fetch'))} <strong>${esc(agoText(new Date(row.last_fetched_at)))}</strong> (${esc(String(row.fetch_count ?? 0))} ${esc(t('gcal_times'))})`
    : esc(t('gcal_never_fetched'));
  return `
    <p class="gcal-status" id="gcal-status">
      ${esc(t('gcal_active'))} <strong>…${esc(row.token_prefix || '')}</strong><br>
      ${esc(t('gcal_created'))} ${esc(shortDate(new Date(row.created_at)))}<br>
      ${fetched}
    </p>
    <div class="gcal-actions">
      <button type="button" class="btn btn-outline btn-sm" id="gcal-rotate">${esc(t('gcal_rotate'))}</button>
      <button type="button" class="btn btn-outline btn-sm" id="gcal-revoke">${esc(t('gcal_revoke'))}</button>
    </div>
    <p class="gcal-note">${esc(t('gcal_note_personal'))}</p>
  `;
}

// dd.mm.yyyy - the admin panel's date style (see the side panel).
function shortDate(d) {
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function agoText(d) {
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(diff) || diff < MINUTE_MS) return t('gcal_ago_now');
  if (diff < HOUR_MS) return t('gcal_ago_min').replace('{n}', String(Math.floor(diff / MINUTE_MS)));
  if (diff < AGO_HOURS_LIMIT * HOUR_MS) return t('gcal_ago_h').replace('{n}', String(Math.floor(diff / HOUR_MS)));
  return t('gcal_ago_d').replace('{n}', String(Math.floor(diff / DAY_MS)));
}

async function withButtonLocked(id, work) {
  const btn = document.getElementById(id);
  if (btn) btn.disabled = true;
  try { await work(); }
  finally { if (btn && document.body.contains(btn)) btn.disabled = false; }
}

async function mintFeedUrl() {
  const { data, error } = await db.rpc('create_calendar_feed_token');
  if (error || typeof data !== 'string' || !FEED_TOKEN_RE.test(data)) {
    console.error('create_calendar_feed_token failed:', error || data);
    showToast(t('gcal_create_failed'), 'error');
    return;
  }
  feedFreshUrl = feedBaseUrl() + data;
  try {
    await loadFeedRow();
  } catch (err) {
    console.error('Calendar feed status reload failed:', err);
  }
  renderFeedCard();
  showToast(t('gcal_created_toast'));
}

function createFeedUrl() {
  return withButtonLocked('gcal-create', mintFeedUrl);
}

function rotateFeedUrl() {
  if (!window.confirm(t('gcal_rotate_confirm'))) return;
  return withButtonLocked('gcal-rotate', mintFeedUrl);
}

function revokeFeedUrl() {
  if (!window.confirm(t('gcal_revoke_confirm'))) return;
  return withButtonLocked('gcal-revoke', async () => {
    const { error } = await db.rpc('revoke_calendar_feed_token');
    if (error) {
      console.error('revoke_calendar_feed_token failed:', error);
      showToast(t('gcal_revoke_failed'), 'error');
      return;
    }
    feedFreshUrl = null;
    feedRow = null;
    renderFeedCard();
    showToast(t('gcal_revoked'));
  });
}

async function copyFeedUrl() {
  const input = document.getElementById('gcal-url');
  if (!input) return;
  try {
    await navigator.clipboard.writeText(input.value);
  } catch (_) {
    // Older WebViews: fall back to the selection-based copy.
    input.focus();
    input.select();
    try { document.execCommand('copy'); } catch (_e) { /* nothing more to try */ }
  }
  showToast(t('gcal_copied'));
}
