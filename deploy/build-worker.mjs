// Bundles public/ into a single Cloudflare Worker module that serves the files.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = new URL('../public/', import.meta.url);
const types = { html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  svg: 'image/svg+xml', webmanifest: 'application/manifest+json' };
const files = {};
for (const f of readdirSync(dir)) {
  const body = readFileSync(new URL(f, dir), 'utf8');
  files['/' + f] = { body, type: types[f.split('.').pop()] || 'application/octet-stream',
    etag: '"' + createHash('sha1').update(body).digest('hex').slice(0, 16) + '"' };
}
files['/'] = files['/index.html'];
const src = `const FILES = ${JSON.stringify(files)};
export default {
  async fetch(req) {
    const url = new URL(req.url);
    const f = FILES[url.pathname];
    if (!f) return new Response('Not found', { status: 404 });
    const headers = { 'content-type': f.type, etag: f.etag, 'cache-control': 'public, max-age=0, must-revalidate',
      'x-content-type-options': 'nosniff' };
    if (req.headers.get('if-none-match') === f.etag) return new Response(null, { status: 304, headers });
    return new Response(f.body, { headers });
  },
};
`;
writeFileSync(new URL('worker.js', import.meta.url), src);
console.log('worker.js', src.length, 'bytes');
