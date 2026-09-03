// Content blocks CRUD - SEO/GEO text sections shown on the public pages.
// Rows live in public.content_blocks (RLS: admin ALL via is_admin(), anon
// SELECT active only); js/content-blocks.js renders them on the site and
// scripts/bake-content-blocks.mjs regenerates the crawler-visible baked
// copies after content changes.

const PAGES = ['index','services','menu','gallery','evening','corporate','birthday','wedding','faq','contact'];

let rows = [];
let pageFilter = 'all';
let editingId = null;

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pageLabel(p) { return t('cnt_page_' + p); }

async function loadRows() {
  const { data, error } = await db.from('content_blocks')
    .select('*').order('page').order('sort_order').order('title_bg');
  if (error) {
    console.error('content load failed:', error);
    showToast(t('cnt_load_failed'), 'error');
    return;
  }
  rows = data || [];
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('cnt-body');
  const list = pageFilter === 'all' ? rows : rows.filter(r => r.page === pageFilter);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#777;padding:28px">${esc(t('cnt_empty'))}</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(r => `
    <tr data-id="${esc(r.id)}"${r.active ? '' : ' style="opacity:0.55"'}>
      <td style="white-space:nowrap">${esc(pageLabel(r.page))}</td>
      <td><strong>${esc(r.title_bg)}</strong><br><span style="color:#777;font-size:0.82rem">${esc(r.title_en)}</span>${r.active ? '' : ` <span style="color:#c62828;font-size:0.78rem">(${esc(t('cnt_hidden'))})</span>`}</td>
      <td>${Number(r.sort_order) || 0}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm btn-toggle" data-id="${esc(r.id)}">${esc(r.active ? t('cnt_hide') : t('cnt_show'))}</button>
        <button class="btn btn-outline btn-sm btn-edit" data-id="${esc(r.id)}">${esc(t('cnt_edit'))}</button>
        <button class="btn btn-danger btn-sm btn-delete" data-id="${esc(r.id)}">${esc(t('cnt_delete'))}</button>
      </td>
    </tr>`).join('');
}

function openForm(row) {
  editingId = row ? row.id : null;
  document.getElementById('cnt-form-title').textContent = t(row ? 'cnt_form_edit' : 'cnt_form_add');
  document.getElementById('cnt-page').value = row ? row.page : (pageFilter !== 'all' ? pageFilter : 'index');
  document.getElementById('cnt-title-bg').value = row ? row.title_bg : '';
  document.getElementById('cnt-title-en').value = row ? row.title_en : '';
  document.getElementById('cnt-body-bg').value = row ? row.body_bg : '';
  document.getElementById('cnt-body-en').value = row ? row.body_en : '';
  document.getElementById('cnt-sort').value = row ? (row.sort_order ?? 100) : 100;
  document.getElementById('cnt-active').checked = row ? !!row.active : true;
  document.getElementById('cnt-form').style.display = 'block';
  document.getElementById('cnt-title-bg').focus();
}

function closeForm() {
  document.getElementById('cnt-form').style.display = 'none';
  editingId = null;
}

async function saveItem() {
  const title_bg = document.getElementById('cnt-title-bg').value.trim();
  const title_en = document.getElementById('cnt-title-en').value.trim();
  const body_bg = document.getElementById('cnt-body-bg').value.trim();
  const body_en = document.getElementById('cnt-body-en').value.trim();
  if (!title_bg || !title_en || !body_bg || !body_en) {
    showToast(t('cnt_required'), 'error');
    return;
  }
  const page = document.getElementById('cnt-page').value;
  if (!PAGES.includes(page)) { showToast(t('cnt_save_failed'), 'error'); return; }

  const saveBtn = document.getElementById('cnt-save');
  saveBtn.disabled = true;
  try {
    const row = {
      page, title_bg, title_en, body_bg, body_en,
      sort_order: Math.max(0, Math.min(9999, parseInt(document.getElementById('cnt-sort').value, 10) || 100)),
      active: document.getElementById('cnt-active').checked,
      updated_at: new Date().toISOString(),
    };
    const { error } = editingId
      ? await db.from('content_blocks').update(row).eq('id', editingId)
      : await db.from('content_blocks').insert({ ...row, id: crypto.randomUUID() });
    if (error) {
      console.error('content save failed:', error);
      showToast(`${t('cnt_save_failed')} - ${error.message}`, 'error');
      return;
    }
    showToast(t('cnt_saved'), 'success');
    closeForm();
    await loadRows();
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteItem(id) {
  if (!confirm(t('cnt_delete_confirm'))) return;
  const { error } = await db.from('content_blocks').delete().eq('id', id);
  if (error) {
    console.error('content delete failed:', error);
    showToast(`${t('cnt_save_failed')} - ${error.message}`, 'error');
    return;
  }
  showToast(t('cnt_deleted'), 'success');
  await loadRows();
}

async function toggleActive(id) {
  const r = rows.find(x => x.id === id);
  if (!r) return;
  const { error } = await db.from('content_blocks')
    .update({ active: !r.active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('content toggle failed:', error);
    showToast(`${t('cnt_save_failed')} - ${error.message}`, 'error');
    return;
  }
  await loadRows();
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  document.getElementById('cnt-add-btn').addEventListener('click', () => openForm(null));
  document.getElementById('cnt-cancel').addEventListener('click', closeForm);
  document.getElementById('cnt-save').addEventListener('click', saveItem);
  document.getElementById('cnt-filter').addEventListener('change', (e) => {
    pageFilter = e.target.value;
    renderTable();
  });
  document.getElementById('cnt-body').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) { openForm(rows.find(r => r.id === editBtn.dataset.id)); return; }
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) { deleteItem(delBtn.dataset.id); return; }
    const tglBtn = e.target.closest('.btn-toggle');
    if (tglBtn) { toggleActive(tglBtn.dataset.id); }
  });

  await loadRows();
});

// admin-i18n.js calls this after a language switch.
function rerenderPage() {
  renderTable();
  if (document.getElementById('cnt-form').style.display !== 'none') {
    document.getElementById('cnt-form-title').textContent = t(editingId ? 'cnt_form_edit' : 'cnt_form_add');
  }
}
