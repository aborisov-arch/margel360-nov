// Partners CRUD — catering companies + artists shown on the public site and
// in the reservation wizard's mark-interest step. Rows live in
// public.partners (RLS: admin ALL via is_admin(), anon SELECT active only).
// Images upload to the public 'partner-images' bucket; partners.image_path
// stores the object path '<row-uuid>/<epoch-millis>.<ext>'.

const BUCKET = 'partner-images';
// Keep in sync with the bucket's file_size_limit / allowed_mime_types
// (migration 20260701120000_partners_catalog.sql) — the server enforces
// them; this pre-check just gives a friendlier error.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

let partners = [];
let filterCat = '';        // '' | 'catering' | 'artist'
let editingId = null;      // null = create mode
let editingImagePath = null;
let pendingFile = null;

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function imgUrl(path) {
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function catLabel(cat) {
  return t(cat === 'catering' ? 'partners_cat_catering' : 'partners_cat_artist');
}

// Render-time guard: only ever emit an <a href> for http(s) URLs. A
// javascript: (or other) scheme written to the row by any path other than
// this form's validated submit would otherwise become a live link.
function websiteCell(url) {
  if (!url) return '';
  return /^https?:\/\//i.test(url)
    ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, ''))}</a>`
    : esc(url);
}

async function loadPartners() {
  const { data, error } = await db.from('partners')
    .select('*')
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) {
    console.error('partners load failed:', error);
    showToast(t('partners_load_failed'), 'error');
    return;
  }
  partners = data || [];
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('partners-body');
  const rows = filterCat ? partners.filter(p => p.category === filterCat) : partners;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#777;padding:28px">${esc(t('partners_empty'))}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(p => `
    <tr data-id="${esc(p.id)}"${p.active ? '' : ' style="opacity:0.55"'}>
      <td>${p.image_path
        ? `<img src="${esc(imgUrl(p.image_path))}" alt="" style="width:56px;height:40px;object-fit:cover;border-radius:6px">`
        : `<span style="display:inline-flex;width:56px;height:40px;border-radius:6px;background:#eee;align-items:center;justify-content:center" aria-hidden="true">${p.category === 'catering' ? '🍽️' : '🎤'}</span>`}</td>
      <td><strong>${esc(p.name)}</strong>${p.active ? '' : ` <span style="color:#c62828;font-size:0.78rem">(${esc(t('partners_hidden'))})</span>`}</td>
      <td>${esc(catLabel(p.category))}</td>
      <td style="font-size:0.84rem">${websiteCell(p.website_url)}${p.website_url && p.phone ? ' · ' : ''}${esc(p.phone || '')}</td>
      <td>${Number(p.sort_order) || 0}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm btn-toggle" data-id="${esc(p.id)}">${esc(p.active ? t('partners_deactivate') : t('partners_activate'))}</button>
        <button class="btn btn-outline btn-sm btn-edit" data-id="${esc(p.id)}">${esc(t('partners_edit'))}</button>
        <button class="btn btn-danger btn-sm btn-delete" data-id="${esc(p.id)}">${esc(t('partners_delete'))}</button>
      </td>
    </tr>`).join('');
}

function openForm(partner) {
  editingId = partner ? partner.id : null;
  editingImagePath = partner ? partner.image_path : null;
  pendingFile = null;
  document.getElementById('partner-form-title').textContent = t(partner ? 'partners_form_edit' : 'partners_form_add');
  document.getElementById('pf-name').value = partner ? partner.name : '';
  document.getElementById('pf-category').value = partner ? partner.category : 'catering';
  document.getElementById('pf-desc-bg').value = partner ? (partner.description_bg || '') : '';
  document.getElementById('pf-desc-en').value = partner ? (partner.description_en || '') : '';
  document.getElementById('pf-url').value = partner ? (partner.website_url || '') : '';
  document.getElementById('pf-phone').value = partner ? (partner.phone || '') : '';
  document.getElementById('pf-sort').value = partner ? (partner.sort_order ?? 100) : 100;
  document.getElementById('pf-active').checked = partner ? !!partner.active : true;
  document.getElementById('pf-image').value = '';
  const preview = document.getElementById('pf-image-preview');
  preview.innerHTML = editingImagePath
    ? `<img src="${esc(imgUrl(editingImagePath))}" alt="" style="max-width:180px;border-radius:8px">`
    : '';
  document.getElementById('partner-form').style.display = 'block';
  document.getElementById('pf-name').focus();
}

function closeForm() {
  document.getElementById('partner-form').style.display = 'none';
  editingId = null;
  editingImagePath = null;
  pendingFile = null;
}

async function savePartner() {
  const name = document.getElementById('pf-name').value.trim();
  if (!name) { showToast(t('partners_name_required'), 'error'); return; }
  const website_url = document.getElementById('pf-url').value.trim() || null;
  if (website_url && !/^https?:\/\//i.test(website_url)) {
    showToast(t('partners_url_invalid'), 'error');
    return;
  }

  const saveBtn = document.getElementById('pf-save');
  saveBtn.disabled = true;
  try {
    // Fix the row id up-front so create + edit share one upload path
    // ('<row-uuid>/<millis>.<ext>').
    const rowId = editingId || crypto.randomUUID();
    let image_path = editingImagePath;
    const oldImagePath = editingImagePath;

    if (pendingFile) {
      const ext = IMAGE_EXT[pendingFile.type];
      const path = `${rowId}/${Date.now()}.${ext}`;
      const { error: upErr } = await db.storage.from(BUCKET)
        .upload(path, pendingFile, { contentType: pendingFile.type });
      if (upErr) {
        console.error('image upload failed:', upErr);
        showToast(`${t('partners_save_failed')} — ${upErr.message}`, 'error');
        return;
      }
      image_path = path;
    }

    const row = {
      id: rowId,
      category: document.getElementById('pf-category').value,
      name,
      description_bg: document.getElementById('pf-desc-bg').value.trim() || null,
      description_en: document.getElementById('pf-desc-en').value.trim() || null,
      website_url,
      phone: document.getElementById('pf-phone').value.trim() || null,
      sort_order: Math.max(0, Math.min(9999, parseInt(document.getElementById('pf-sort').value, 10) || 100)),
      active: document.getElementById('pf-active').checked,
      image_path,
      updated_at: new Date().toISOString(),
    };

    const { error } = editingId
      ? await db.from('partners').update(row).eq('id', editingId)
      : await db.from('partners').insert(row);
    if (error) {
      console.error('partner save failed:', error);
      showToast(`${t('partners_save_failed')} — ${error.message}`, 'error');
      // Row write failed after a fresh upload: clean up the now-orphaned
      // object (best-effort) instead of leaving it to accumulate on retry.
      if (pendingFile && image_path !== oldImagePath) {
        db.storage.from(BUCKET).remove([image_path])
          .catch(e => console.warn('orphaned image cleanup failed:', e));
      }
      return;
    }

    // Replaced image: best-effort removal of the old object.
    if (pendingFile && oldImagePath && oldImagePath !== image_path) {
      db.storage.from(BUCKET).remove([oldImagePath])
        .catch(e => console.warn('old image cleanup failed:', e));
    }

    showToast(t('partners_saved'), 'success');
    closeForm();
    await loadPartners();
  } finally {
    saveBtn.disabled = false;
  }
}

async function deletePartner(id) {
  const p = partners.find(x => x.id === id);
  if (!p) return;
  if (!confirm(t('partners_delete_confirm'))) return;
  const { error } = await db.from('partners').delete().eq('id', id);
  if (error) {
    console.error('partner delete failed:', error);
    showToast(`${t('partners_save_failed')} — ${error.message}`, 'error');
    return;
  }
  if (p.image_path) {
    db.storage.from(BUCKET).remove([p.image_path])
      .catch(e => console.warn('image cleanup failed:', e));
  }
  showToast(t('partners_deleted'), 'success');
  await loadPartners();
}

async function toggleActive(id) {
  const p = partners.find(x => x.id === id);
  if (!p) return;
  const { error } = await db.from('partners')
    .update({ active: !p.active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('partner toggle failed:', error);
    showToast(`${t('partners_save_failed')} — ${error.message}`, 'error');
    return;
  }
  await loadPartners();
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  document.getElementById('partner-add-btn').addEventListener('click', () => openForm(null));
  document.getElementById('pf-cancel').addEventListener('click', closeForm);
  document.getElementById('pf-save').addEventListener('click', savePartner);

  document.getElementById('pf-image').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    pendingFile = null;
    if (!file) return;
    if (!IMAGE_EXT[file.type] || file.size > MAX_IMAGE_BYTES) {
      showToast(t('partners_img_invalid'), 'error');
      e.target.value = '';
      return;
    }
    pendingFile = file;
    document.getElementById('pf-image-preview').innerHTML =
      `<img src="${URL.createObjectURL(file)}" alt="" style="max-width:180px;border-radius:8px">`;
  });

  document.getElementById('partners-filter').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-filter');
    if (!btn) return;
    filterCat = btn.dataset.cat;
    document.querySelectorAll('.cat-filter').forEach(b => b.classList.toggle('active', b === btn));
    renderTable();
  });

  document.getElementById('partners-body').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) { openForm(partners.find(p => p.id === editBtn.dataset.id)); return; }
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) { deletePartner(delBtn.dataset.id); return; }
    const tglBtn = e.target.closest('.btn-toggle');
    if (tglBtn) { toggleActive(tglBtn.dataset.id); }
  });

  await loadPartners();
});

// admin-i18n.js calls this after a language switch.
function rerenderPage() {
  renderTable();
  if (document.getElementById('partner-form').style.display !== 'none') {
    document.getElementById('partner-form-title').textContent = t(editingId ? 'partners_form_edit' : 'partners_form_add');
  }
}
