// Shared helpers for the blog listing + post pages. Posts live in
// public.blog_posts (admin/blog.html); EN fields are optional and fall back
// to BG. Plain text bodies with three light rules (escaped first, so no HTML
// injection): blank line = paragraph, "## " = subheading, "- " = bullet.
window.MargelBlog = (function () {
  const SB_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
  const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseHV0c3Vmcm9iem92ZHNpZWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDc3MDQsImV4cCI6MjA5MTQ4MzcwNH0.EY2j3lZRmfGlWcTTNy9CMIHZX1E-2jit11jZwP7UOJo';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'bg'; }
  function pick(row, field) {
    const L = lang();
    return (L === 'en' && row[field + '_en']) ? row[field + '_en'] : row[field + '_bg'];
  }
  function coverUrl(img) {
    if (!img) return null;
    if (/^(https?:)?\//.test(img)) return img;
    if (/^assets\//.test(img)) return '/' + img;
    return SB_URL + '/storage/v1/object/public/blog-images/' + img;
  }
  function fmtDate(iso) {
    if (!iso) return '';
    const loc = lang() === 'en' ? 'en-GB' : 'bg-BG';
    return new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function fetchPosts(query) {
    return fetch(SB_URL + '/rest/v1/blog_posts?' + query,
      { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON } })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function renderBody(text) {
    const lines = String(text || '').split(/\r?\n/);
    const out = []; let para = []; let list = null;
    function flushPara() { if (para.length) { out.push('<p>' + para.map(esc).join('<br>') + '</p>'); para = []; } }
    function flushList() { if (list) { out.push('<ul>' + list.map(function (li) { return '<li>' + esc(li) + '</li>'; }).join('') + '</ul>'); list = null; } }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) { flushPara(); flushList(); continue; }
      if (line.indexOf('## ') === 0) { flushPara(); flushList(); out.push('<h2>' + esc(line.slice(3)) + '</h2>'); continue; }
      if (line.indexOf('- ') === 0) { flushPara(); if (!list) list = []; list.push(line.slice(2)); continue; }
      flushList(); para.push(line);
    }
    flushPara(); flushList();
    return out.join('\n');
  }
  function onLangChange(fn) {
    new MutationObserver(fn).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }
  return { esc: esc, lang: lang, pick: pick, coverUrl: coverUrl, fmtDate: fmtDate,
           fetchPosts: fetchPosts, renderBody: renderBody, onLangChange: onLangChange };
})();
