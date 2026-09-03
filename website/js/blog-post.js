// Blog post renderer - serves /blog/<slug> (netlify rewrite) and the baked
// static copies. Renders the post from public.blog_posts and keeps the head
// metadata (title, description, canonical, og:*) in sync with the post.
(function () {
  const B = window.MargelBlog;
  let post = null;

  function slugFromUrl() {
    const m = /\/blog\/([^\/?#]+)/.exec(location.pathname);
    if (m) return decodeURIComponent(m[1].replace(/\/$/, ''));
    return new URLSearchParams(location.search).get('slug') || '';
  }

  function setMeta(sel, attr, value) {
    const el = document.querySelector(sel);
    if (el && value) el.setAttribute(attr, value);
  }

  function render() {
    const holder = document.getElementById('blog-article');
    if (!holder || !post) return;
    const title = B.pick(post, 'title');
    const excerpt = B.pick(post, 'excerpt');
    const cover = B.coverUrl(post.cover_img);
    holder.innerHTML =
      '<p class="blog-card-date">' + B.esc(B.fmtDate(post.published_at)) + '</p>' +
      '<h1>' + B.esc(title) + '</h1>' +
      (cover ? '<img class="blog-cover" src="' + B.esc(cover) + '" alt="">' : '') +
      B.renderBody(B.pick(post, 'body'));

    const url = 'https://margel360.bg/blog/' + encodeURIComponent(post.slug);
    document.title = title + (B.lang() === 'en' ? ' | Margel 360°' : ' | Маргел 360°');
    setMeta('meta[name="description"]', 'content', excerpt);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', excerpt);
    if (cover) {
      setMeta('meta[property="og:image"]', 'content',
        cover.indexOf('http') === 0 ? cover : 'https://margel360.bg' + cover);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const holder = document.getElementById('blog-article');
    if (!holder) return;
    const slug = slugFromUrl();
    if (!slug || slug === 'blog-post.html') {
      holder.innerHTML = '';
      document.getElementById('post-notfound').hidden = false;
      return;
    }
    B.fetchPosts('select=*&published=is.true&slug=eq.' + encodeURIComponent(slug) + '&limit=1')
      .then(function (rows) {
        if (!rows.length) {
          // Baked pages already carry the content - only blank the page when
          // there is nothing baked underneath.
          if (!holder.querySelector('h1')) {
            holder.innerHTML = '';
            document.getElementById('post-notfound').hidden = false;
          }
          return;
        }
        post = rows[0];
        render();
      })
      .catch(function (e) { console.warn('blog post: keeping baked copy -', e); });
    B.onLangChange(function () { if (post) render(); });
  });
})();
