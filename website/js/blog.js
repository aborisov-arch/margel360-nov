// Blog listing - replaces the baked cards in blog.html with the live
// published posts (newest first). On failure the baked copy stays.
(function () {
  const B = window.MargelBlog;
  let posts = null;

  function render() {
    const grid = document.getElementById('blog-grid');
    if (!grid || !posts) return;
    document.getElementById('blog-none').style.display = posts.length ? 'none' : '';
    grid.innerHTML = posts.map(function (p) {
      const cover = B.coverUrl(p.cover_img);
      return '<article class="blog-card"><a href="/blog/' + encodeURIComponent(p.slug) + '">' +
        (cover ? '<img src="' + B.esc(cover) + '" alt="" loading="lazy">' : '') +
        '<div class="blog-card-body">' +
        '<p class="blog-card-date">' + B.esc(B.fmtDate(p.published_at)) + '</p>' +
        '<h2>' + B.esc(B.pick(p, 'title')) + '</h2>' +
        '<p>' + B.esc(B.pick(p, 'excerpt')) + '</p>' +
        '</div></a></article>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.getElementById('blog-grid')) return;
    B.fetchPosts('select=slug,title_bg,title_en,excerpt_bg,excerpt_en,cover_img,published_at' +
                 '&published=is.true&order=published_at.desc&limit=100')
      .then(function (rows) { posts = rows; render(); })
      .catch(function (e) {
        console.warn('blog list: keeping baked copy -', e);
        var grid = document.getElementById('blog-grid');
        if (grid && !grid.querySelector('.blog-card')) document.getElementById('blog-error').style.display = '';
      });
    B.onLangChange(render);
  });
})();
