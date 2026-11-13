const fs=require('fs');const r=f=>fs.readFileSync(__dirname+'/'+f,'utf8');
const fonts='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@400;500;600;700;800&family=Grenze:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&family=Cinzel:wght@500;700&family=Orbitron:wght@500;700&family=Rajdhani:wght@500;700&family=Cormorant+Garamond:wght@500;700&family=IM+Fell+English&family=Crimson+Pro:wght@400;600&display=swap">';
const js=['data.js','engine.js','ui.js','actions.js','ddb.js','events.js'].map(r).join('\n');
const core=`<style>\n${r('style.css')}\n${r('hud.css')}\n${r('themes.css')}\n</style>\n${r('body.html')}`;
// artifact page (skeleton is added at publish)
fs.writeFileSync(__dirname+'/ink-and-initiative.html',`<title>Ink & Initiative</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n${fonts}\n${core}\n<script>\n${js}\n</script>\n`);
// standalone installable PWA
const out=process.argv[2]; fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(out+'/index.html',`<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Ink & Initiative</title>
<meta name="theme-color" content="#1d1715"><meta name="mobile-web-app-capable" content="yes"><link rel="manifest" href="manifest.webmanifest"><link rel="icon" href="icon-192.png"><link rel="apple-touch-icon" href="icon-192.png">\n${fonts}\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>\n</head><body>\n${core}\n<script>\n${js}\nif('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').catch(()=>{});}\n</script>\n</body></html>\n`);
fs.writeFileSync(out+'/manifest.webmanifest',JSON.stringify({name:'Ink & Initiative',short_name:'Ink & Init',description:'Pen-friendly D&D 5e character sheet with a combat HUD',start_url:'./',scope:'./',display:'standalone',orientation:'any',background_color:'#14100f',theme_color:'#1d1715',icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},null,1));
fs.writeFileSync(out+'/sw.js',`const V='ink-v4';const CORE=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.hostname.includes('dnd5eapi'))return;
e.respondWith(caches.match(e.request).then(hit=>{const net=fetch(e.request).then(res=>{if(res.ok||res.type==='opaque'){const cp=res.clone();caches.open(V).then(c=>c.put(e.request,cp));}return res;}).catch(()=>hit);return hit||net;}));});
`);
console.log('built');
