// Builds the web bundle the Android app ships with (www/).
// - Copies the built index.html and icons from the repo root
// - Downloads the Google Fonts into www/fonts so the app looks right with no internet
// - Drops the service worker, which the app doesn't need (files are already on the device)
// Usage: node scripts/apk-web.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function vendorFonts(html) {
  const m = html.match(/<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)">/);
  if (!m) return html;
  const cssUrl = m[1].replace(/&amp;/g, '&');
  let css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text();
  const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)\s]+/g) || [])];
  fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
  let i = 0;
  for (const u of urls) {
    const name = `f${i++}${path.extname(new URL(u).pathname) || '.woff2'}`;
    const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
    fs.writeFileSync(path.join(out, 'fonts', name), buf);
    css = css.split(u).join(`fonts/${name}`);
  }
  fs.writeFileSync(path.join(out, 'fonts.css'), css);
  console.log(`vendored ${urls.length} font files`);
  return html
    .replace(/<link rel="preconnect"[^>]*>/g, '')
    .replace(m[0], '<link rel="stylesheet" href="fonts.css">');
}

(async () => {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html
    .replace(/if\('serviceWorker' in navigator\)\{[^\n]*\}\n?/, '')
    .replace(/<link rel="manifest"[^>]*>/, '');
  try {
    html = await vendorFonts(html);
  } catch (e) {
    console.warn('Could not download fonts, the app will load them online instead:', e.message);
  }
  fs.writeFileSync(path.join(out, 'index.html'), html);
  for (const f of ['icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(root, f), path.join(out, f));
  console.log('www/ ready');
})();
