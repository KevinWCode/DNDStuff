/* ---------- Pen Notes paper: drawn in code, cached, seeded so it looks the same every time ---------- */
const PAPERS = [['parchment', 'Parchment'], ['deckle', 'Handmade'], ['vellum', 'Old map'], ['digital', 'Digital'], ['lined', 'Lined']];
// On the digital paper the stored ink colours are shown as neon so they stay readable on the dark page.
const NEON = { '#2b1d10': '#eaf6ff', '#b3132f': '#ff4fd8', '#1f4fa8': '#00e5ff', '#2f7a3a': '#3dff9a', '#e8b923': '#ffe14d' };
const PAPER = (() => {
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function grain(g, r, amt, dk, bl) { const c = g.canvas, img = g.getImageData(0, 0, c.width, c.height), d = img.data; for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const n = (r() - .5) * amt; d[i] += n * dk; d[i + 1] += n * dk; d[i + 2] += n * bl; } g.putImageData(img, 0, 0); }
  function blot(g, W, H, r, n, col, a0, a1, a) { for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, rad = a0 + r() * (a1 - a0), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${col},${a * (.5 + r() * .5)})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } }
  function fib(g, W, H, r, n, col, a) { g.lineCap = 'round'; for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, l = 4 + r() * 16, t = r() * Math.PI; g.strokeStyle = `rgba(${col},${a * r()})`; g.lineWidth = .4 + r() * .8; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(t + .6) * l / 2, y + Math.sin(t + .6) * l / 2, x + Math.cos(t) * l, y + Math.sin(t) * l); g.stroke(); } }
  function vig(g, W, H, col, inner, a) { const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * inner, W / 2, H / 2, Math.max(W, H) * .75); gr.addColorStop(0, `rgba(${col},0)`); gr.addColorStop(1, `rgba(${col},${a})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  const D = {
    lined(g, W, H) { g.fillStyle = '#f4ecda'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(80,110,160,.18)'; g.lineWidth = 1.2; for (let y = 60; y < H; y += 38) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.strokeStyle = 'rgba(180,40,50,.25)'; g.beginPath(); g.moveTo(70, 0); g.lineTo(70, H); g.stroke(); },
    parchment(g, W, H, r, gr) { g.fillStyle = '#ead8b0'; g.fillRect(0, 0, W, H); blot(g, W, H, r, 26 * H / 640, '150,105,45', 60, 200, .12); blot(g, W, H, r, 10 * H / 640, '255,245,215', 60, 160, .25); fib(g, W, H, r, 900 * H / 640, '110,75,30', .28);
      g.strokeStyle = 'rgba(120,72,30,.13)'; g.lineWidth = 3; g.beginPath(); g.arc(W * .84, 520, 58, .3, Math.PI * 1.85); g.stroke(); vig(g, W, H, '95,52,15', .3, .55); gr(22, 1, .8); },
    deckle(g, W, H, r, gr) { const pts = [], s = 6, i = 12, j = 7;
      for (let x = i; x <= W - i; x += s) pts.push([x, i + (r() - .3) * j]); for (let y = i; y <= H - i; y += s) pts.push([W - i + (r() - .7) * j, y]);
      for (let x = W - i; x >= i; x -= s) pts.push([x, H - i + (r() - .7) * j]); for (let y = H - i; y >= i; y -= s) pts.push([i + (r() - .3) * j, y]);
      const path = () => { g.beginPath(); pts.forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); };
      g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 14; g.shadowOffsetY = 4; g.fillStyle = '#f3e9d2'; path(); g.fill(); g.restore();
      g.save(); path(); g.clip(); blot(g, W, H, r, 18 * H / 640, '190,165,120', 50, 160, .1);
      for (let k = 0; k < 300 * H / 640; k++) { g.fillStyle = `rgba(${r() < .7 ? '120,95,60' : '90,110,80'},${.15 + r() * .35})`; g.beginPath(); g.ellipse(r() * W, r() * H, .5 + r() * 1.4, .4 + r() * .9, r() * 3, 0, 7); g.fill(); }
      fib(g, W, H, r, 500 * H / 640, '150,125,90', .22); g.strokeStyle = 'rgba(150,120,80,.35)'; g.lineWidth = 6; path(); g.stroke(); g.restore(); gr(14, 1, .9); },
    vellum(g, W, H, r, gr) { g.fillStyle = '#dcc597'; g.fillRect(0, 0, W, H); blot(g, W, H, r, 40 * H / 640, '130,95,45', 40, 180, .14); blot(g, W, H, r, 14 * H / 640, '250,235,200', 40, 140, .22);
      g.save(); g.translate(W * .78, 190); g.globalAlpha = .1; g.strokeStyle = g.fillStyle = '#5b3d18'; g.lineWidth = 1.5; g.beginPath(); g.arc(0, 0, 90, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, 76, 0, 7); g.stroke();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, l = k % 2 ? 54 : 110; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - .12) * 18, Math.sin(a - .12) * 18); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.lineTo(Math.cos(a + .12) * 18, Math.sin(a + .12) * 18); g.closePath(); k % 2 ? g.stroke() : g.fill(); }
      g.font = '700 26px Rajdhani,sans-serif'; g.textAlign = 'center'; g.fillText('N', 0, -118); g.restore();
      const folds = [[W / 2, 0, W / 2, H]]; for (let y = 640 / 2; y < H; y += 640) folds.push([0, y, W, y]);
      folds.forEach(([a, b, c2, d]) => { g.lineWidth = 2.5; g.strokeStyle = 'rgba(90,60,25,.16)'; g.beginPath(); g.moveTo(a - 1, b - 1); g.lineTo(c2 - 1, d - 1); g.stroke(); g.strokeStyle = 'rgba(255,248,225,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(a + 1.5, b + 1.5); g.lineTo(c2 + 1.5, d + 1.5); g.stroke(); });
      fib(g, W, H, r, 380 * H / 640, '100,70,30', .18); vig(g, W, H, '80,50,20', .4, .42); gr(26, 1, .75); },
    digital(g, W, H, r) { const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0c1e'); bg.addColorStop(1, '#07070e'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      blot(g, W, H, r, 5, '255,43,214', 120, 320, .07); blot(g, W, H, r, 5, '0,229,255', 120, 320, .06);
      g.fillStyle = 'rgba(0,229,255,.22)'; for (let y = 32; y < H; y += 32) for (let x = 32; x < W; x += 32) g.fillRect(x - .9, y - .9, 1.8, 1.8);
      g.strokeStyle = 'rgba(0,229,255,.07)'; g.lineWidth = 1; for (let x = 160; x < W; x += 160) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 160; y < H; y += 160) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.025)'; for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1.5);
      g.save(); g.strokeStyle = '#00e5ff'; g.shadowColor = '#00e5ff'; g.shadowBlur = 10; g.lineWidth = 2.5; const m = 14, L = 46;
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { g.beginPath(); g.moveTo(x, y + sy * L); g.lineTo(x, y); g.lineTo(x + sx * L, y); g.stroke(); });
      g.strokeStyle = '#ff2bd6'; g.shadowColor = '#ff2bd6'; g.lineWidth = 2; g.beginPath(); g.moveTo(W - 260, m); g.lineTo(W - 90, m); g.stroke(); g.restore();
      g.font = '600 13px Rajdhani,monospace'; g.fillStyle = 'rgba(125,243,255,.55)'; g.textAlign = 'left'; g.fillText('// FIELD.LOG', m + 58, m + 5);
      g.textAlign = 'right'; g.fillText('SYNC ●  ' + Math.floor(r() * 9000 + 1000).toString(16).toUpperCase(), W - m - 4, H - m - 8); }
  };
  let cache = null, key = '';
  function draw(name, W, H, pw, ph) {
    const k = [name, pw, ph].join(); if (cache && key === k) return cache;
    const c = document.createElement('canvas'); c.width = pw; c.height = ph; const g = c.getContext('2d');
    g.setTransform(pw / W, 0, 0, ph / H, 0, 0); const r = rng(name.length * 97 + 11);
    (D[name] || D.parchment)(g, W, H, r, (amt, dk, bl) => { g.setTransform(1, 0, 0, 1, 0, 0); grain(g, r, amt, dk, bl); g.setTransform(pw / W, 0, 0, ph / H, 0, 0); });
    cache = c; key = k; return c;
  }
  return { draw };
})();
