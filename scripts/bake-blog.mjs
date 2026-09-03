#!/usr/bin/env node
// Bakes static SEO copies of the blog from public.blog_posts:
//   1. website/blog/<slug>/index.html per published post (full head metadata,
//      JSON-LD Article, rendered BG body) - static files outrank the
//      /blog/* -> blog-post.html rewrite in netlify.toml, so crawlers get real
//      HTML while the runtime JS keeps humans on the live DB content.
//   2. The baked cards between blog-list markers in website/blog.html.
//   3. The per-post <url> entries between blog markers in website/sitemap.xml.
// Deletes baked dirs whose post was unpublished/removed. Run after publishing,
// review the diff, commit, push:  node scripts/bake-blog.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';

const SB_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseHV0c3Vmcm9iem92ZHNpZWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDc3MDQsImV4cCI6MjA5MTQ4MzcwNH0.EY2j3lZRmfGlWcTTNy9CMIHZX1E-2jit11jZwP7UOJo';

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const coverUrl = (img) => {
  if (!img) return null;
  if (/^(https?:)?\//.test(img)) return img;
  if (/^assets\//.test(img)) return '/' + img;
  return SB_URL + '/storage/v1/object/public/blog-images/' + img;
};
const absolute = (u) => u && u.startsWith('/') ? 'https://margel360.bg' + u : u;

const fmtDateBg = (iso) => iso
  ? new Date(iso).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Sofia' })
  : '';

// Same three light rules as js/blog-shared.js renderBody - keep in sync.
function renderBody(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = []; let para = []; let list = null;
  const flushPara = () => { if (para.length) { out.push('<p>' + para.map(esc).join('<br>') + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push('<ul>' + list.map(li => '<li>' + esc(li) + '</li>').join('') + '</ul>'); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (line.startsWith('## ')) { flushPara(); flushList(); out.push('<h2>' + esc(line.slice(3)) + '</h2>'); continue; }
    if (line.startsWith('- ')) { flushPara(); (list = list || []).push(line.slice(2)); continue; }
    flushList(); para.push(line);
  }
  flushPara(); flushList();
  return out.join('\n');
}

const res = await fetch(`${SB_URL}/rest/v1/blog_posts?select=*&published=is.true&order=published_at.desc`,
  { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` } });
if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
const posts = await res.json();

const template = readFileSync('website/blog-post.html', 'utf8');

// 1. per-post static pages
for (const p of posts) {
  const url = `https://margel360.bg/blog/${p.slug}`;
  const cover = coverUrl(p.cover_img);
  const ogImage = cover ? absolute(cover) : 'https://margel360.bg/assets/images/og-default.jpg';
  let html = template;
  html = html.replace(/<title[^>]*>[^<]*<\/title>/,
    `<title>${esc(p.title_bg)} | Маргел 360°</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${esc(p.excerpt_bg)}">`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${url}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${esc(p.title_bg)}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${esc(p.excerpt_bg)}">`);
  html = html.replace(/<meta property="og:image" content="[^"]*">/,
    `<meta property="og:image" content="${esc(ogImage)}">`);
  html = html.replace('</head>', `  <meta property="og:url" content="${url}">
  <script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: p.title_bg,
  description: p.excerpt_bg,
  image: ogImage,
  datePublished: p.published_at,
  dateModified: p.updated_at,
  mainEntityOfPage: url,
  author: { '@type': 'Organization', name: 'Маргел 360°', url: 'https://margel360.bg/' },
  publisher: { '@type': 'Organization', name: 'Маргел 360°', url: 'https://margel360.bg/' },
}, null, 2)}
  <\/script>
</head>`);
  const article = `
          <p class="blog-card-date">${esc(fmtDateBg(p.published_at))}</p>
          <h1>${esc(p.title_bg)}</h1>
${cover ? `          <img class="blog-cover" src="${esc(cover)}" alt="">\n` : ''}${renderBody(p.body_bg)}
      `;
  html = html.replace(/<!-- blog-article:start -->[\s\S]*?<!-- blog-article:end -->/,
    `<!-- blog-article:start -->${article}<!-- blog-article:end -->`);
  mkdirSync(`website/blog/${p.slug}`, { recursive: true });
  writeFileSync(`website/blog/${p.slug}/index.html`, html);
  console.log(`baked website/blog/${p.slug}/index.html`);
}

// remove baked dirs for posts no longer published
if (existsSync('website/blog')) {
  const live = new Set(posts.map(p => p.slug));
  for (const dir of readdirSync('website/blog')) {
    if (!live.has(dir)) {
      rmSync(`website/blog/${dir}`, { recursive: true });
      console.log(`removed stale website/blog/${dir}`);
    }
  }
}

// 2. listing cards in blog.html
const card = (p) => {
  const cover = coverUrl(p.cover_img);
  return `      <article class="blog-card">
        <a href="/blog/${esc(p.slug)}">
${cover ? `          <img src="${esc(cover.replace(/^\//, ''))}" alt="" loading="lazy">\n` : ''}          <div class="blog-card-body">
            <p class="blog-card-date">${esc(fmtDateBg(p.published_at))}</p>
            <h2>${esc(p.title_bg)}</h2>
            <p>${esc(p.excerpt_bg)}</p>
          </div>
        </a>
      </article>`;
};
let listing = readFileSync('website/blog.html', 'utf8');
listing = listing.replace(/<!-- blog-list:start -->[\s\S]*?<!-- blog-list:end -->/,
  `<!-- blog-list:start -->\n${posts.map(card).join('\n')}\n      <!-- blog-list:end -->`);
writeFileSync('website/blog.html', listing);
console.log(`website/blog.html: ${posts.length} card(s) baked`);

// 3. sitemap entries
const today = new Date().toISOString().slice(0, 10);
const entries = posts.map(p => `  <url>
    <loc>https://margel360.bg/blog/${esc(p.slug)}</loc>
    <lastmod>${(p.updated_at || p.published_at || today).slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('\n');
let sitemap = readFileSync('website/sitemap.xml', 'utf8');
sitemap = sitemap.replace(/<!-- blog:start -->[\s\S]*?<!-- blog:end -->/,
  `<!-- blog:start -->\n${entries}\n  <!-- blog:end -->`);
writeFileSync('website/sitemap.xml', sitemap);
console.log(`sitemap.xml: ${posts.length} blog url(s)`);
