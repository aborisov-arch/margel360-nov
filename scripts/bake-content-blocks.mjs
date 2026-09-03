#!/usr/bin/env node
// Regenerates the baked (crawler-visible) copies of the SEO/GEO content
// blocks inside the public pages from the live public.content_blocks table.
// Runtime JS (content-blocks.js) always shows live rows; this keeps the raw
// HTML that non-JS crawlers and AI engines read in sync. Run after content
// changes, then review the diff, commit and push:
//   node scripts/bake-content-blocks.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const SB_URL = 'https://wlxutsufrobzovdsiecb.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndseHV0c3Vmcm9iem92ZHNpZWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDc3MDQsImV4cCI6MjA5MTQ4MzcwNH0.EY2j3lZRmfGlWcTTNy9CMIHZX1E-2jit11jZwP7UOJo';
const PAGES = ['index','services','menu','gallery','evening','corporate','birthday','wedding','faq','contact'];

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Baked copy is Bulgarian - the site's default, crawler-visible language.
const blockHtml = (b) => {
  const paras = String(b.body_bg).split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `        <p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('\n');
  return `      <article class="content-block">\n        <h2>${esc(b.title_bg)}</h2>\n${paras}\n      </article>`;
};

const res = await fetch(`${SB_URL}/rest/v1/content_blocks?select=page,title_bg,body_bg,sort_order&active=is.true&order=sort_order.asc`,
  { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` } });
if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
const rows = await res.json();

for (const page of PAGES) {
  const file = `website/${page}.html`;
  const blocks = rows.filter(r => r.page === page);
  let html = readFileSync(file, 'utf8');
  const re = /([ \t]*)<!-- content-blocks:start -->[\s\S]*?<!-- content-blocks:end -->/;
  if (!re.test(html)) { console.warn(`SKIP ${file}: no content-blocks markers`); continue; }
  const inner = blocks.length ? '\n' + blocks.map(blockHtml).join('\n') + '\n      ' : '';
  html = html.replace(re, `      <!-- content-blocks:start -->${inner}<!-- content-blocks:end -->`);
  // The section itself hides when the page has no blocks.
  html = html.replace(
    /<section class="section content-blocks-section" id="content-blocks-section"( hidden)?/,
    `<section class="section content-blocks-section" id="content-blocks-section"${blocks.length ? '' : ' hidden'}`);
  writeFileSync(file, html);
  console.log(`${file}: ${blocks.length} block(s) baked`);
}
