// Blog CRUD - posts on the public /blog pages (public.blog_posts; rendered
// by js/blog.js + js/blog-post.js, static copies via scripts/bake-blog.mjs).
// RLS: admin ALL via is_admin(), anon SELECT published only. Covers upload to
// the public 'blog-images' bucket. Slug locks once a post has been published
// so URLs never break.

const BUCKET = 'blog-images';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

let rows = [];
let editingId = null;
let editingImagePath = null;
let editingEverPublished = false;
let pendingFile = null;
let slugTouched = false;

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// BG -> latin slug (transliteration per the official BG standard, simplified).
const TRANSLIT = { 'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sht','ъ':'a','ь':'y','ю':'yu','я':'ya' };
function slugify(title) {
  return String(title || '').toLowerCase()
    .split('').map(ch => TRANSLIT[ch] != null ? TRANSLIT[ch] : ch).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
}

function imgUrl(path) {
  if (!path) return null;
  if (/^assets\//.test(path)) return '/' + path;
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function loadRows() {
  const { data, error } = await db.from('blog_posts')
    .select('*').order('published_at', { ascending: false, nullsFirst: true }).order('created_at', { ascending: false });
  if (error) {
    console.error('blog load failed:', error);
    showToast(t('blg_load_failed'), 'error');
    return;
  }
  rows = data || [];
  renderTable();
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

function renderTable() {
  const tbody = document.getElementById('blg-body-rows');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#777;padding:28px">${esc(t('blg_empty'))}</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr data-id="${esc(r.id)}"${r.published ? '' : ' style="opacity:0.6"'}>
      <td>${r.cover_img
        ? `<img src="${esc(imgUrl(r.cover_img))}" alt="" style="width:56px;height:40px;object-fit:cover;border-radius:6px">`
        : `<span style="display:inline-flex;width:56px;height:40px;border-radius:6px;background:#eee;align-items:center;justify-content:center" aria-hidden="true">📝</span>`}</td>
      <td><strong>${esc(r.title_bg)}</strong><br><span style="color:#777;font-size:0.82rem">/blog/${esc(r.slug)}</span></td>
      <td>${r.published
        ? `<span style="color:#2e7d32">${esc(t('blg_published'))}</span>`
        : `<span style="color:#8a6d1a">${esc(t('blg_draft'))}</span>`}</td>
      <td style="white-space:nowrap">${fmtDate(r.published_at)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm btn-toggle" data-id="${esc(r.id)}">${esc(r.published ? t('blg_unpublish') : t('blg_publish'))}</button>
        <button class="btn btn-outline btn-sm btn-edit" data-id="${esc(r.id)}">${esc(t('blg_edit'))}</button>
        <button class="btn btn-danger btn-sm btn-delete" data-id="${esc(r.id)}">${esc(t('blg_delete'))}</button>
      </td>
    </tr>`).join('');
}

function openForm(row) {
  editingId = row ? row.id : null;
  editingImagePath = row ? row.cover_img : null;
  editingEverPublished = !!row && !!row.published_at;
  pendingFile = null;
  slugTouched = !!row;

  document.getElementById('blg-form-title').textContent = t(row ? 'blg_form_edit' : 'blg_form_add');
  document.getElementById('blg-title-bg').value = row ? row.title_bg : '';
  document.getElementById('blg-title-en').value = row ? row.title_en : '';
  document.getElementById('blg-slug').value = row ? row.slug : '';
  document.getElementById('blg-excerpt-bg').value = row ? row.excerpt_bg : '';
  document.getElementById('blg-excerpt-en').value = row ? row.excerpt_en : '';
  document.getElementById('blg-body-bg').value = row ? row.body_bg : '';
  document.getElementById('blg-body-en').value = row ? row.body_en : '';
  document.getElementById('blg-published').checked = row ? !!row.published : false;

  const slugEl = document.getElementById('blg-slug');
  slugEl.readOnly = editingEverPublished;
  document.getElementById('blg-slug-note').hidden = !editingEverPublished;

  document.getElementById('blg-image').value = '';
  document.getElementById('blg-image-preview').innerHTML = editingImagePath
    ? `<img src="${esc(imgUrl(editingImagePath))}" alt="" style="max-width:220px;border-radius:8px">`
    : '';
  document.getElementById('blg-form').style.display = 'block';
  document.getElementById('blg-title-bg').focus();
}

function closeForm() {
  document.getElementById('blg-form').style.display = 'none';
  editingId = null;
  editingImagePath = null;
  editingEverPublished = false;
  pendingFile = null;
}

async function saveItem() {
  const title_bg = document.getElementById('blg-title-bg').value.trim();
  const excerpt_bg = document.getElementById('blg-excerpt-bg').value.trim();
  const body_bg = document.getElementById('blg-body-bg').value.trim();
  const slug = document.getElementById('blg-slug').value.trim();
  if (!title_bg || !excerpt_bg || !body_bg) { showToast(t('blg_required'), 'error'); return; }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3) { showToast(t('blg_slug_invalid'), 'error'); return; }

  const saveBtn = document.getElementById('blg-save');
  saveBtn.disabled = true;
  try {
    const rowId = editingId || crypto.randomUUID();
    let cover_img = editingImagePath;
    const oldImagePath = editingImagePath;

    if (pendingFile) {
      const ext = IMAGE_EXT[pendingFile.type];
      const path = `${rowId}/${Date.now()}.${ext}`;
      const { error: upErr } = await db.storage.from(BUCKET)
        .upload(path, pendingFile, { contentType: pendingFile.type });
      if (upErr) {
        console.error('cover upload failed:', upErr);
        showToast(`${t('blg_save_failed')} - ${upErr.message}`, 'error');
        return;
      }
      cover_img = path;
    }

    const published = document.getElementById('blg-published').checked;
    const existing = editingId ? rows.find(x => x.id === editingId) : null;
    const row = {
      id: rowId, slug,
      title_bg, title_en: document.getElementById('blg-title-en').value.trim(),
      excerpt_bg, excerpt_en: document.getElementById('blg-excerpt-en').value.trim(),
      body_bg, body_en: document.getElementById('blg-body-en').value.trim(),
      cover_img, published,
      // First publish stamps the date; unpublish/republish keeps the original.
      published_at: published ? (existing?.published_at ?? new Date().toISOString()) : existing?.published_at ?? null,
      updated_at: new Date().toISOString(),
    };

    const { error } = editingId
      ? await db.from('blog_posts').update(row).eq('id', editingId)
      : await db.from('blog_posts').insert(row);
    if (error) {
      console.error('blog save failed:', error);
      showToast(`${t('blg_save_failed')} - ${error.message}`, 'error');
      if (pendingFile && cover_img !== oldImagePath) {
        db.storage.from(BUCKET).remove([cover_img]).catch(e => console.warn('orphaned cover cleanup failed:', e));
      }
      return;
    }
    if (pendingFile && oldImagePath && oldImagePath !== cover_img && !/^assets\//.test(oldImagePath)) {
      db.storage.from(BUCKET).remove([oldImagePath]).catch(e => console.warn('old cover cleanup failed:', e));
    }
    showToast(t('blg_saved'), 'success');
    closeForm();
    await loadRows();
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteItem(id) {
  const r = rows.find(x => x.id === id);
  if (!r) return;
  if (!confirm(t('blg_delete_confirm'))) return;
  const { error } = await db.from('blog_posts').delete().eq('id', id);
  if (error) {
    console.error('blog delete failed:', error);
    showToast(`${t('blg_save_failed')} - ${error.message}`, 'error');
    return;
  }
  if (r.cover_img && !/^assets\//.test(r.cover_img)) {
    db.storage.from(BUCKET).remove([r.cover_img]).catch(e => console.warn('cover cleanup failed:', e));
  }
  showToast(t('blg_deleted'), 'success');
  await loadRows();
}

async function togglePublished(id) {
  const r = rows.find(x => x.id === id);
  if (!r) return;
  const publishing = !r.published;
  const { error } = await db.from('blog_posts')
    .update({
      published: publishing,
      published_at: publishing ? (r.published_at ?? new Date().toISOString()) : r.published_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('blog toggle failed:', error);
    showToast(`${t('blg_save_failed')} - ${error.message}`, 'error');
    return;
  }
  await loadRows();
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  document.getElementById('blg-add-btn').addEventListener('click', () => openForm(null));
  document.getElementById('blg-cancel').addEventListener('click', closeForm);
  document.getElementById('blg-save').addEventListener('click', saveItem);

  // Auto-suggest the slug from the BG title until the manager edits it.
  document.getElementById('blg-title-bg').addEventListener('input', (e) => {
    if (!slugTouched && !editingEverPublished) {
      document.getElementById('blg-slug').value = slugify(e.target.value);
    }
  });
  document.getElementById('blg-slug').addEventListener('input', () => { slugTouched = true; });

  document.getElementById('blg-image').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    pendingFile = null;
    if (!file) return;
    if (!IMAGE_EXT[file.type] || file.size > MAX_IMAGE_BYTES) {
      showToast(t('blg_img_invalid'), 'error');
      e.target.value = '';
      return;
    }
    pendingFile = file;
    document.getElementById('blg-image-preview').innerHTML =
      `<img src="${URL.createObjectURL(file)}" alt="" style="max-width:220px;border-radius:8px">`;
  });

  document.getElementById('blg-body-rows').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.btn-edit');
    if (editBtn) { openForm(rows.find(r => r.id === editBtn.dataset.id)); return; }
    const delBtn = e.target.closest('.btn-delete');
    if (delBtn) { deleteItem(delBtn.dataset.id); return; }
    const tglBtn = e.target.closest('.btn-toggle');
    if (tglBtn) { togglePublished(tglBtn.dataset.id); }
  });

  await loadRows();
});

// admin-i18n.js calls this after a language switch.
function rerenderPage() {
  renderTable();
  if (document.getElementById('blg-form').style.display !== 'none') {
    document.getElementById('blg-form-title').textContent = t(editingId ? 'blg_form_edit' : 'blg_form_add');
  }
}
