// Catalog CRUD - drinks + addon services shown on the public site, the
// booking wizard and the customer edit page. Rows live in public.drinks /
// public.addon_services (RLS: admin ALL via is_admin(), anon SELECT active
// only). Images upload to the public 'catalog-images' bucket; the img column
// stores either a repo asset path ('assets/…', seeded rows) or a storage
// object path '<row-id>/<epoch-millis>.<ext>'.

const BUCKET = 'catalog-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const BGN_RATE = 1.95583;     // fixed legal peg - never fetch this
const MAX_PRICE_EUR = 50000;  // matches the server-side MAX_ADDON_PRICE bound

let activeTab = 'drinks';     // 'drinks' | 'services'
let rows = { drinks: [], services: [] };
let editingId = null;
let editingImagePath = null;
let pendingFile = null;

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tableFor(tab) { return tab === 'drinks' ? 'drinks' : 'addon_services'; }

function imgUrl(path) {
  if (!path) return null;
  // Seeded rows point at repo assets served from the site root; uploads
  // live in the catalog-images bucket.
  if (/^assets\//.test(path)) return '/' + path;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function bgn(eur) {
  return (Math.round(Number(eur) * BGN_RATE * 100) / 100).toFixed(2);
}

async function loadRows() {
  const [dr, sv] = await Promise.all([
    db.from('drinks').select('*').order('cat').order('sort_order').order('name_bg'),
    db.from('addon_services').select('*').order('sort_order').order('name_bg'),
  ]);
  if (dr.error || sv.error) {
    console.error('catalog load failed:', dr.error || sv.error);
    showToast(t('cat_load_failed'), 'error');
    return;
  }
  rows = { drinks: dr.data || [], services: sv.data || [] };
  renderTable();
}

function detailsCell(r) {
  if (activeTab === 'drinks') return esc(t('cat_cat_' + r.cat));
  const bits = [];
  if (r.id === 'cleaning') bits.push(`<span style="color:#8a6d1a;font-size:0.78rem">${esc(t('cat_mandatory_badge'))}</span>`);
  if (r.max_qty != null) bits.push(esc(`${t('cat_badge_maxqty')} ${r.max_qty}`));
  if (r.free_until != null) bits.push(esc(`${t('cat_badge_free')} ${r.free_until}`));
  return bits.join(' · ');
}

function renderTable() {
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
  document.getElementById('cat-add-btn').textContent = t(activeTab === 'drinks' ? 'cat_add_drink' : 'cat_add_service');
  const tbody = document.getElementById('catalog-body');
  const list = rows[activeTab];
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#777;padding:28px">${esc(t('cat_empty'))}</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(r => `
    <tr data-id="${esc(r.id)}"${r.active ? '' : ' style="opacity:0.55"'}>
      <td>${r.img
        ? `<img src="${esc(imgUrl(r.img))}" alt="" style="width:56px;height:40px;object-fit:cover;border-radius:6px">`
        : `<span style="display:inline-flex;width:56px;height:40px;border-radius:6px;background:#eee;align-items:center;justify-content:center" aria-hidden="true">${activeTab === 'drinks' ? '🍷' : '🎈'}</span>`}</td>
      <td><strong>${esc(r.name_bg)}</strong><br><span style="color:#777;font-size:0.82rem">${esc(r.name_en)}</span>${r.active ? '' : ` <span style="color:#c62828;font-size:0.78rem">(${esc(t('cat_hidden'))})</span>`}</td>
      <td>${detailsCell(r)}</td>
      <td style="white-space:nowrap">€${Number(r.price_eur).toFixed(2)}<br><span style="color:#777;font-size:0.8rem">${bgn(r.price_eur)} лв.</span></td>
      <td>${Number(r.sort_order) || 0}</td>
      <td style="white-space:nowrap">
        ${r.id === 'cleaning' ? '' : `<button class="btn btn-outline btn-sm btn-toggle" data-id="${esc(r.id)}">${esc(r.active ? t('cat_deactivate') : t('cat_activate'))}</button>`}
        <button class="btn btn-outline btn-sm btn-edit" data-id="${esc(r.id)}">${esc(t('cat_edit'))}</button>
        ${r.id === 'cleaning' ? '' : `<button class="btn btn-danger btn-sm btn-delete" data-id="${esc(r.id)}">${esc(t('cat_delete'))}</button>`}
      </td>
    </tr>`).join('');
}

function syncQtyFields() {
  const on = document.getElementById('cf-qty-item').checked;
  document.getElementById('cf-qty-detail').style.display = on ? '' : 'none';
}

function syncBgnView() {
  const price = Number(document.getElementById('cf-price').value);
  document.getElementById('cf-bgn-view').textContent =
    Number.isFinite(price) && price >= 0 ? `= ${bgn(price)} лв.` : '';
}

function openForm(row) {
  const isDrinks = activeTab === 'drinks';
  editingId = row ? row.id : null;
  editingImagePath = row ? row.img : null;
  pendingFile = null;

  document.getElementById('cf-drink-fields').style.display = isDrinks ? '' : 'none';
  document.getElementById('cf-service-fields').style.display = isDrinks ? 'none' : '';
  document.getElementById('catalog-form-title').textContent =
    t(isDrinks ? (row ? 'cat_form_edit_drink' : 'cat_form_add_drink')
               : (row ? 'cat_form_edit_service' : 'cat_form_add_service'));

  document.getElementById('cf-name-bg').value = row ? row.name_bg : '';
  document.getElementById('cf-name-en').value = row ? row.name_en : '';
  document.getElementById('cf-price').value = row ? row.price_eur : '';
  document.getElementById('cf-sort').value = row ? (row.sort_order ?? 100) : 100;

  const isCleaning = !!row && row.id === 'cleaning';
  const activeBox = document.getElementById('cf-active');
  activeBox.checked = row ? !!row.active : true;
  activeBox.disabled = isCleaning;   // DB trigger enforces this too
  document.getElementById('cf-active-note').hidden = !isCleaning;

  if (isDrinks) {
    document.getElementById('cf-cat').value = row ? String(row.cat) : '0';
  } else {
    document.getElementById('cf-hint-bg').value = row?.hint_bg || '';
    document.getElementById('cf-hint-en').value = row?.hint_en || '';
    document.getElementById('cf-qty-item').checked = !!row && (row.max_qty != null || row.free_until != null);
    document.getElementById('cf-max-qty').value = row?.max_qty ?? '';
    document.getElementById('cf-free-until').value = row?.free_until ?? '';
    syncQtyFields();
  }

  document.getElementById('cf-image').value = '';
  document.getElementById('cf-image-preview').innerHTML = editingImagePath
    ? `<img src="${esc(imgUrl(editingImagePath))}" alt="" style="max-width:180px;border-radius:8px">`
    : '';
  syncBgnView();
  document.getElementById('catalog-form').style.display = 'block';
  document.getElementById('cf-name-bg').focus();
}

function closeForm() {
  document.getElementById('catalog-form').style.display = 'none';
  editingId = null;
  editingImagePath = null;
  pendingFile = null;
}

function serviceQtyColumns() {
  const qtyItem = document.getElementById('cf-qty-item').checked;
  if (!qtyItem) return { free_until: null, max_qty: null };
  const freeRaw = parseInt(document.getElementById('cf-free-until').value, 10);
  const maxRaw = parseInt(document.getElementById('cf-max-qty').value, 10);
  const free_until = Number.isInteger(freeRaw) && freeRaw >= 0 ? freeRaw : null;
  // A qty item needs at least one non-null column so the renderers show a
  // stepper; an empty cap on a non-furniture item means "uncapped" (999).
  const max_qty = Number.isInteger(maxRaw) && maxRaw >= 1 ? maxRaw
                : (free_until != null ? null : 999);
  return { free_until, max_qty };
}

async function saveItem() {
  const name_bg = document.getElementById('cf-name-bg').value.trim();
  const name_en = document.getElementById('cf-name-en').value.trim();
  if (!name_bg || !name_en) { showToast(t('cat_name_required'), 'error'); return; }
  const price = Number(document.getElementById('cf-price').value);
  if (!Number.isFinite(price) || price < 0 || price > MAX_PRICE_EUR) {
    showToast(t('cat_price_invalid'), 'error');
    return;
  }

  const saveBtn = document.getElementById('cf-save');
  saveBtn.disabled = true;
  try {
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
        showToast(`${t('cat_save_failed')} - ${upErr.message}`, 'error');
        return;
      }
      image_path = path;
    }

    const base = {
      id: rowId,
      name_bg, name_en,
      price_eur: Math.round(price * 100) / 100,
      img: image_path,
      sort_order: Math.max(0, Math.min(9999, parseInt(document.getElementById('cf-sort').value, 10) || 100)),
      active: editingId === 'cleaning' ? true : document.getElementById('cf-active').checked,
      updated_at: new Date().toISOString(),
    };
    const row = activeTab === 'drinks'
      ? { ...base, cat: parseInt(document.getElementById('cf-cat').value, 10) }
      : {
          ...base,
          hint_bg: document.getElementById('cf-hint-bg').value.trim() || null,
          hint_en: document.getElementById('cf-hint-en').value.trim() || null,
          ...serviceQtyColumns(),
        };

    const table = tableFor(activeTab);
    const { error } = editingId
      ? await db.from(table).update(row).eq('id', editingId)
      : await db.from(table).insert(row);
    if (error) {
      console.error('catalog save failed:', error);
      showToast(`${t('cat_save_failed')} - ${error.message}`, 'error');
      if (pendingFile && image_path !== oldImagePath) {
        db.storage.from(BUCKET).remove([image_path])
          .catch(e => console.warn('orphaned image cleanup failed:', e));
      }
      return;
    }

    // Replaced a bucket image: best-effort removal of the old object (repo
    // asset paths are never deleted).
    if (pendingFile && oldImagePath && oldImagePath !== image_path && !/^assets\//.test(oldImagePath)) {
      db.storage.from(BUCKET).remove([oldImagePath])
        .catch(e => console.warn('old image cleanup failed:', e));
    }

    showToast(t('cat_saved'), 'success');
    closeForm();
    await loadRows();
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteItem(id) {
  const r = rows[activeTab].find(x => x.id === id);
  if (!r) return;
  if (!confirm(t('cat_delete_confirm'))) return;
  const { error } = await db.from(tableFor(activeTab)).delete().eq('id', id);
  if (error) {
    console.error('catalog delete failed:', error);
    showToast(`${t('cat_save_failed')} - ${error.message}`, 'error');
    return;
  }
  if (r.img && !/^assets\//.test(r.img)) {
    db.storage.from(BUCKET).remove([r.img])
      .catch(e => console.warn('image cleanup failed:', e));
  }
  showToast(t('cat_deleted'), 'success');
  await loadRows();
}

async function toggleActive(id) {
  const r = rows[activeTab].find(x => x.id === id);
  if (!r) return;
  const { error } = await db.from(tableFor(activeTab))
    .update({ active: !r.active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('catalog toggle failed:', error);
    showToast(`${t('cat_save_failed')} - ${error.message}`, 'error');
    return;
  }
  await loadRows();
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  document.getElementById('cat-add-btn').addEventListener('click', () => openForm(null));
  document.getElementById('cf-cancel').addEventListener('click', closeForm);
  document.getElementById('cf-save').addEventListener('click', saveItem);
  document.getElementById('cf-qty-item').addEventListener('change', syncQtyFields);
  document.getElementById('cf-price').addEventListener('input', syncBgnView);

  document.getElementById('cf-image').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    pendingFile = null;
    if (!file) return;
    if (!IMAGE_EXT[file.type] || file.size > MAX_IMAGE_BYTES) {
      showToast(t('cat_img_invalid'), 'error');
      e.target.value = '';
      return;
    }
    pendingFile = file;
    document.getElementById('cf-image-preview').innerHTML =
      `<img src="${URL.createObjectURL(file)}" alt="" style="max-width:180px;border-radius:8px">`;
  });

  document.getElementById('catalog-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-tab');
    if (!btn || btn.dataset.tab === activeTab) return;
    activeTab = btn.dataset.tab;
    closeForm();
    renderTable();
  });

  document.getElementById('catalog-body').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) { openForm(rows[activeTab].find(r => r.id === editBtn.dataset.id)); return; }
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
  if (document.getElementById('catalog-form').style.display !== 'none') {
    const isDrinks = activeTab === 'drinks';
    document.getElementById('catalog-form-title').textContent =
      t(isDrinks ? (editingId ? 'cat_form_edit_drink' : 'cat_form_add_drink')
                 : (editingId ? 'cat_form_edit_service' : 'cat_form_add_service'));
  }
}
