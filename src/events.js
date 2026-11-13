/* ---------- pen ink canvas (pressure, palm rejection, barrel-button eraser) ---------- */
const INK = (() => {
  const st = { color: '#2b1d10', w: 3, hl: false, eraser: false, penOnly: true, page: 0, drawing: null };
  const el = document.createElement('div');
  el.innerHTML = `<div class="ink-tools" id="inkTools"></div><div class="ink-wrap" id="inkWrap"><canvas id="ink"></canvas><div class="ink-hint" id="inkHint"></div></div>`;
  const cv = el.querySelector('#ink'), cx = cv.getContext('2d'), wrap = el.querySelector('#inkWrap');
  const COLORS = [['#2b1d10', 'Ink'], ['#b3132f', 'Crimson'], ['#1f4fa8', 'Blue'], ['#2f7a3a', 'Green']];
  let W = 1000, H = 640, scale = 1;
  const pages = () => { const c = C(); if (!c.ink || !c.ink.length) c.ink = [[]]; if (st.page >= c.ink.length) st.page = c.ink.length - 1; return c.ink; };
  function tools() {
    const p = pages();
    el.querySelector('#inkTools').innerHTML = COLORS.map(([c, n]) => `<button class="swatch ${!st.eraser && !st.hl && st.color === c ? 'on' : ''}" style="background:${inkCol(c)}" data-ink="color" data-v="${c}" aria-label="${n}"></button>`).join('') +
      `<button class="chip ${st.hl ? 'on' : ''}" data-ink="hl">Highlighter</button><button class="chip ${st.eraser ? 'on' : ''}" data-ink="eraser">Eraser</button>
      <button class="chip" data-ink="w" data-v="-1">Thinner</button><button class="chip" data-ink="w" data-v="1">Thicker</button>
      <button class="chip ${st.penOnly ? 'on' : ''}" data-ink="pen">Pen only</button>
      <button class="chip" data-ink="undo">Undo stroke</button>
      <span style="flex:1"></span>
      <button class="chip" data-ink="prev" ${st.page ? '' : 'disabled'}>‹</button><span class="muted">Page ${st.page + 1} of ${p.length}</span><button class="chip" data-ink="next">${st.page === p.length - 1 ? '+ Page' : '›'}</button>
      <button class="chip" data-ink="clear">Clear page</button>
      <div class="paperrow"><span class="muted">Paper</span>${[['auto', 'Match theme'], ...PAPERS].map(([k, n]) => `<button class="chip ${(C().paper || 'auto') === k ? 'on' : ''}" data-ink="paper" data-v="${k}">${n}</button>`).join('')}</div>`;
    el.querySelector('#inkHint').textContent = st.penOnly ? 'S Pen writes · hold the pen button to erase' : 'Finger or pen';
  }
  function fit() {
    const r = wrap.getBoundingClientRect(); if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    const hCss = Math.max(420, Math.min(window.innerHeight - 220, r.width * 1.3));
    cv.style.height = hCss + 'px'; cv.width = r.width * dpr; cv.height = hCss * dpr;
    scale = r.width / W; H = hCss / scale; cx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    tools(); redraw();
  }
  const paperName = () => { const c = C(), p = c.paper || 'auto'; return p === 'auto' ? (c.skin === 'neongrid' ? 'digital' : 'parchment') : p; };
  const inkCol = c => paperName() === 'digital' ? (NEON[c] || c) : c;
  function paper() {
    wrap.dataset.paper = paperName();
    cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
    cx.drawImage(PAPER.draw(paperName(), W, H, cv.width, cv.height), 0, 0); cx.restore();
  }
  function drawStroke(s) {
    const p = s.p; if (p.length < 3) return;
    const col = inkCol(s.c), neon = paperName() === 'digital' && !(s.a < 1);
    cx.strokeStyle = col; cx.globalAlpha = s.a || 1; cx.lineCap = 'round'; cx.lineJoin = 'round';
    if (neon) { cx.shadowColor = col; cx.shadowBlur = 5; }
    if (s.a < 1) { cx.lineWidth = s.w; cx.beginPath(); cx.moveTo(p[0], p[1]); for (let i = 3; i < p.length; i += 3) cx.lineTo(p[i], p[i + 1]); cx.stroke(); }
    else for (let i = 3; i < p.length; i += 3) { cx.lineWidth = s.w * (0.35 + (p[i + 2] / 100) * 1.3); cx.beginPath(); cx.moveTo(p[i - 3], p[i - 2]); cx.lineTo(p[i], p[i + 1]); cx.stroke(); }
    if (p.length === 3) { cx.beginPath(); cx.arc(p[0], p[1], s.w / 2, 0, 7); cx.fillStyle = col; cx.fill(); }
    cx.globalAlpha = 1; cx.shadowBlur = 0;
  }
  function redraw() { paper(); (pages()[st.page] || []).forEach(drawStroke); if (st.drawing) drawStroke(st.drawing); }
  const pos = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) / scale), Math.round((e.clientY - r.top) / scale), Math.round((e.pressure || .5) * 100)]; };
  function eraseAt(x, y) { const pg = pages()[st.page]; const before = pg.length; for (let i = pg.length - 1; i >= 0; i--) { const p = pg[i].p; for (let j = 0; j < p.length; j += 3) if (Math.abs(p[j] - x) < 14 && Math.abs(p[j + 1] - y) < 14) { pg.splice(i, 1); break; } } if (pg.length !== before) redraw(); }
  let erasing = false;
  cv.addEventListener('pointerdown', e => {
    if (st.penOnly && e.pointerType === 'touch') return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    erasing = st.eraser || (e.pointerType === 'pen' && (e.buttons & 32 || e.buttons & 2));
    const [x, y, pr] = pos(e);
    if (erasing) { eraseAt(x, y); return; }
    st.drawing = { c: st.hl ? '#e8b923' : st.color, w: st.hl ? 18 : st.w, a: st.hl ? .35 : 1, p: [x, y, pr] };
  });
  cv.addEventListener('pointermove', e => {
    if (erasing && e.buttons) { const [x, y] = pos(e); eraseAt(x, y); return; }
    if (!st.drawing) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    evs.forEach(ev => st.drawing.p.push(...pos(ev)));
    const p = st.drawing.p, n = p.length;
    if (st.drawing.a < 1) redraw();
    else { const s = { ...st.drawing, p: p.slice(Math.max(0, n - 3 * (evs.length + 1))) }; drawStroke(s); }
  });
  const end = () => { if (erasing) { erasing = false; save(); return; } if (!st.drawing) return; pages()[st.page].push(st.drawing); st.drawing = null; redraw(); save(); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('touchstart', e => { if (!st.penOnly) e.preventDefault(); }, { passive: false });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-ink]'); if (!b) return; const k = b.dataset.ink, p = pages();
    if (k === 'color') { st.color = b.dataset.v; st.eraser = st.hl = false; }
    if (k === 'hl') { st.hl = !st.hl; st.eraser = false; }
    if (k === 'eraser') { st.eraser = !st.eraser; st.hl = false; }
    if (k === 'w') st.w = Math.max(1, Math.min(10, st.w + +b.dataset.v));
    if (k === 'pen') st.penOnly = !st.penOnly;
    if (k === 'paper') { C().paper = b.dataset.v; save(); }
    if (k === 'undo') { p[st.page].pop(); save(); }
    if (k === 'prev') st.page = Math.max(0, st.page - 1);
    if (k === 'next') { if (st.page === p.length - 1) p.push([]); st.page++; save(); }
    if (k === 'clear') { if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = 'Tap again to clear'; b.classList.add('on'); return; } commit('Cleared notes page ' + (st.page + 1), c => { c.ink[st.page] = []; }); }
    tools(); redraw();
  });
  window.addEventListener('resize', () => { if (el.isConnected) fit(); });
  return { el, fit };
})();

/* ---------- input: tap, long-press X-ray, double-tap override, S Pen hover ---------- */
let press = null, lastTap = { key: null, t: 0 }, hoverT;
document.addEventListener('pointerdown', e => {
  const t = e.target.closest('[data-x]');
  if (!t || e.target.closest('[data-act]') && e.target.closest('[data-act]') !== t && t.contains(e.target.closest('[data-act]'))) { press = null; return; }
  const key = t.dataset.x;
  press = { key, t, x: e.clientX, y: e.clientY, long: false, timer: setTimeout(() => { press.long = true; showXray(key, t, true); if (navigator.vibrate) try { navigator.vibrate(12); } catch (_) {} }, 450) };
});
document.addEventListener('pointermove', e => { if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) { clearTimeout(press.timer); press = null; } });
document.addEventListener('pointerup', e => {
  if (!press) return; clearTimeout(press.timer);
  const p = press; press = null;
  if (p.long) { e.preventDefault(); return; }
  if (e.target.closest('[data-act]') && p.t.contains(e.target.closest('[data-act]'))) return;
  const now = Date.now();
  if (lastTap.key === p.key && now - lastTap.t < 380) { lastTap = { key: null, t: 0 }; const tt = $('#toast'); if (tt) tt.remove(); overrideForm(p.key); return; }
  lastTap = { key: p.key, t: now };
  hideXray();
  if (ROLLABLE.test(p.key)) rollCard(p.key); else showXray(p.key, p.t, true);
});
document.addEventListener('contextmenu', e => { if (e.target.closest('[data-x]')) e.preventDefault(); });
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'pen' && e.pointerType !== 'mouse') return;
  const t = e.target.closest('[data-x]'); clearTimeout(hoverT);
  if (!t) { if (ui.xray && !ui.xray.pinned) hideXray(); return; }
  if (e.buttons) return;
  hoverT = setTimeout(() => { if (!ui.xray || !ui.xray.pinned) showXray(t.dataset.x, t, false); }, e.pointerType === 'pen' ? 120 : 600);
});
document.addEventListener('pointerdown', e => { if (ui.xray && !e.target.closest('#xray') && !e.target.closest('[data-x]')) hideXray(); }, true);
window.addEventListener('scroll', () => { if (ui.xray && !ui.xray.pinned) hideXray(); }, { passive: true });

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.closest('#ov') && !b.closest('#xray')) return;
  const a = b.dataset.act, arg = b.dataset.arg; const c = C();
  switch (a) {
    case 'mode': DB.ui.mode = arg; save(); hideXray(); render(); window.scrollTo(0, 0); break;
    case 'tab': DB.ui.tab = arg; save(); hideXray(); render(); window.scrollTo(0, 0); break;
    case 'go': if (arg === 'combat') DB.ui.mode = 'combat'; else { DB.ui.mode = 'explore'; DB.ui.tab = arg; } save(); hideXray(); render(); window.scrollTo(0, 0); break;
    case 'swap': if (+arg !== DB.cur) { DB.cur = +arg; save(); hideXray(); render(); } break;
    case 'proll': { const P = partyState(), r = d20(), tot = r + R.stats.init.v; P.list = P.list.filter(x => x.id !== c.id); P.list.push({ id: c.id, name: c.name, init: tot, note: 'You · rolled ' + r + ' ' + sgn(R.stats.init.v) }); P.list.sort((a, b) => b.init - a.init); P.turn = 0; save(); render(); toast(`<div class="t2">Initiative</div><div class="big ${r === 20 ? 'crit' : r === 1 ? 'fumble' : ''}">${tot}</div><div class="t2">rolled ${r} ${sgn(R.stats.init.v)}</div>`); break; }
    case 'padd': openForm('Add to initiative', [['name', 'Name', 'text'], ['init', 'Initiative', 'number'], ['note', 'Note (HP, AC, anything)', 'text'], ['foe', 'Enemy', 'check']], { foe: true }, o => { const P = partyState(); if (!o.name) return; const cur = P.list[P.turn]; P.list.push({ id: uid('i'), name: o.name, init: +o.init || 0, note: o.note, foe: o.foe }); P.list.sort((a, b) => b.init - a.init); P.turn = cur ? P.list.indexOf(cur) : 0; save(); render(); }); break;
    case 'pnext': { const P = partyState(); if (!P.list.length) break; P.turn++; if (P.turn >= P.list.length) { P.turn = 0; P.round++; } save(); render(); const e = P.list[P.turn]; toast(`<div class="t2">Round ${P.round}</div><div class="t1">${esc(e.name)}'s turn</div>`, 1400); break; }
    case 'pdel': { const P = partyState(), cur = P.list[P.turn]; P.list = P.list.filter(x => x.id !== arg); P.turn = Math.max(0, cur && P.list.includes(cur) ? P.list.indexOf(cur) : Math.min(P.turn, P.list.length - 1)); save(); render(); break; }
    case 'pclear': DB.party = { list: [], turn: 0, round: 1 }; save(); render(); break;
    case 'undo': undo(); break;
    case 'edit': ui.editing = !ui.editing; render(); toast(ui.editing ? '<div class="t1">Editing unlocked</div><div class="t2">Tap ✎ buttons to change things. Lock again before combat.</div>' : '<div class="t1">Sheet locked</div>', 1600); break;
    case 'short': shortRest(); break;
    case 'long': longRest(); break;
    case 'menu': menu(); break;
    case 'xclose': hideXray(); break;
    case 'override': overrideForm(arg); break;
    case 'kp': if (arg === '⌫') ui.hpIn = ui.hpIn.slice(0, -1); else if (arg === 'C') ui.hpIn = ''; else if (ui.hpIn.length < 12 && !(arg === '+' && (!ui.hpIn || ui.hpIn.endsWith('+')))) ui.hpIn += arg; render(); break;
    case 'hp': hpAct(arg); break;
    case 'target': ui.target = arg; render(); break;
    case 'bps': ui.bps = !ui.bps; render(); break;
    case 'ds': { const k = arg[0], i = +arg[1]; commit('Death save ' + (k === 's' ? 'success' : 'failure'), c => { const cur = c.death[k]; c.death[k] = cur > i ? i : i + 1; }); break; }
    case 'dsroll': { const r = d20(); commit('Death save roll: ' + r, c => { if (r === 20) { c.hp.cur = 1; c.death = { s: 0, f: 0 }; } else if (r === 1) c.death.f = Math.min(3, c.death.f + 2); else if (r >= 10) c.death.s = Math.min(3, c.death.s + 1); else c.death.f = Math.min(3, c.death.f + 1); }); toast(`<div class="t2">Death save</div><div class="big ${r === 20 ? 'crit' : r === 1 ? 'fumble' : ''}">${r}</div><div class="t2">${r === 20 ? 'Back up with 1 HP!' : r === 1 ? 'Two failures' : r >= 10 ? 'Success' : 'Failure'}</div>`); break; }
    case 'nat20': commit('Natural 20: back to 1 HP', c => { c.hp.cur = 1; c.death = { s: 0, f: 0 }; }); break;
    case 'dropconc': modal(`<h2>Stop concentrating on ${esc(c.conc)}?</h2><p class="muted">Its ongoing effects end.</p><div class="btnrow"><button class="btn" data-m="n">Keep it</button><button class="btn dng" data-m="y">End ${esc(c.conc)}</button></div>`, sh => sh.addEventListener('click', e => { if (e.target.dataset.m === 'y') { closeModal(); dropConc('Ended concentration on ' + c.conc); } else if (e.target.dataset.m) closeModal(); })); break;
    case 'buff': commit((c.active[arg] ? 'Ended ' : 'Activated ') + BUFFS[arg].label, c => { if (c.active[arg]) delete c.active[arg]; else { c.active[arg] = true; if (BUFFS[arg].group) Object.keys(BUFFS).forEach(k => { if (k !== arg && BUFFS[k].group === BUFFS[arg].group) delete c.active[k]; }); } }); break;
    case 'cond': commit((c.conditions.includes(arg) ? 'Removed ' : 'Gained ') + arg, c => { c.conditions = c.conditions.includes(arg) ? c.conditions.filter(x => x !== arg) : c.conditions.concat(arg); }); break;
    case 'exh': commit('Exhaustion ' + Math.max(0, Math.min(6, c.exhaustion + +arg)), c => c.exhaustion = Math.max(0, Math.min(6, c.exhaustion + +arg))); break;
    case 'saveprof': if (!ui.editing) { toast('<div class="t1">Sheet is locked</div><div class="t2">Unlock editing to change proficiencies.</div>', 1500); break; } commit('Toggled ' + ABN[arg] + ' save proficiency', c => { c.saves = c.saves.includes(arg) ? c.saves.filter(x => x !== arg) : c.saves.concat(arg); }); break;
    case 'skillprof': if (!ui.editing) { toast('<div class="t1">Sheet is locked</div><div class="t2">Unlock editing to change proficiencies.</div>', 1500); break; } commit('Changed ' + arg + ' proficiency', c => { c.skills[arg] = ((+c.skills[arg] || 0) + 1) % 3; }); break;
    case 'hd': spendHD(+arg); break;
    case 'pip': { const [i, j] = arg.split(':').map(Number), s = c.slots[i], filled = j < s.max - s.used; commit((filled ? 'Spent ' : 'Restored ') + ord(s.lvl) + '-level slot', c => { c.slots[i].used = Math.max(0, Math.min(s.max, s.used + (filled ? 1 : -1))); }, { norender: true }); const s2 = C().slots[i]; pendingAnim.push([`#pip-${i}-${filled ? s2.max - s2.used : s2.max - s2.used - 1}`, filled ? 'drain' : 'fill']); render(); break; }
    case 'res': { const [id, d] = arg.split(':'); const r = c.resources.find(x => x.id === id); if (!r) break; const nv = Math.max(0, Math.min(r.max, r.cur + +d)); if (nv === r.cur) break; commit((+d < 0 ? 'Used ' : 'Regained ') + r.name + ' (' + nv + '/' + r.max + ')', c => c.resources.find(x => x.id === id).cur = nv); break; }
    case 'dawn': { const r = c.resources.find(x => x.id === arg); const g = rollDice(r.regain, R.ctx); commit(r.name + ' regained ' + g.total + ' at dawn', c => { const x = c.resources.find(y => y.id === arg); x.cur = Math.min(x.max, x.cur + g.total); }); toast(`<div class="t2">${esc(r.name)}: ${esc(r.regain)}</div><div class="big">+${g.total}</div><div class="t2">[${g.detail.join(', ')}]</div>`); break; }
    case 'sumhp': { const [id, d] = arg.split(':'); commit(null, c => { const m = c.summons.find(x => x.id === id); m.hp = Math.max(0, Math.min(m.max, m.hp + +d)); }); break; }
    case 'formtoggle': commit('Form ' + arg, c => { const m = c.summons.find(x => x.id === arg); m.active = !m.active; if (m.active && m.hp === 0) m.hp = m.max; }); break;
    case 'set': commit('Swapped to ' + c.sets[+arg].name, c => c.activeSet = +arg); toast(`<div class="t1">${esc(c.sets[+arg].name)}</div><div class="t2">AC ${compute(C()).stats.ac.v}</div>`, 1400); break;
    case 'lane': commit(TIME[arg] + (((arg === 'action' ? c.turn.action >= R.actionsMax : c.turn[arg] >= 1)) ? ' restored' : ' used'), c => { if (arg === 'action') c.turn.action = c.turn.action >= R.actionsMax ? 0 : c.turn.action + 1; else c.turn[arg] = c.turn[arg] >= 1 ? 0 : 1; }); break;
    case 'extra': commit('Extra action this turn', c => c.turn.extra = (c.turn.extra || 0) + 1); break;
    case 'use': { const [k, id, lane] = arg.split(':'); useItem(k, id, lane); break; }
    case 'endturn': commit('End of turn, round ' + c.turn.round, c => { c.turn = { action: 0, bonus: 0, reaction: 0, extra: 0, move: 0, round: c.turn.round + 1, dash: false }; ['dodge', 'shield', 'reckless'].forEach(b => delete c.active[b]); }); toast(`<div class="t2">Turn ended</div><div class="big">Round ${C().turn.round}</div><div class="t2">Actions, movement and reaction are ready. Dodge, Shield and Reckless cleared.</div>`, 1800); break;
    case 'newcombat': commit('New fight', c => { c.turn = { action: 0, bonus: 0, reaction: 0, extra: 0, move: 0, round: 1, dash: false }; }); break;
    case 'move': commit(null, c => { const i = +arg; c.turn.move = c.turn.move === i + 1 ? i : i + 1; }); break;
    case 'moveclear': commit(null, c => c.turn.move = 0); break;
    case 'dash': commit(c.turn.dash ? 'Dash undone' : 'Dash', c => c.turn.dash = !c.turn.dash); break;
    case 'dock': DB.settings.dockOpen = !DB.settings.dockOpen; save(); render(); break;
    case 'sfilter': ui.spellFilter = arg; render(); break;
    case 'lfilter': ui.lvlFilter = arg; render(); break;
    case 'flip': if (e.target.closest('button')) break; ui.flipped.has(arg) ? ui.flipped.delete(arg) : ui.flipped.add(arg); b.classList.toggle('flip'); break;
    case 'cast': castSpell(arg); break;
    case 'attune': { const it = c.items.find(x => x.id === arg); const n = c.items.filter(x => x.attuned).length; if (!it.attuned && n >= (c.attuneMax || 3)) { toast('<div class="t1">All sockets are full</div><div class="t2">End attunement with another item first.</div>'); break; } commit((it.attuned ? 'Ended attunement: ' : 'Attuned: ') + it.name, c => { const x = c.items.find(y => y.id === arg); x.attuned = !x.attuned; }); break; }
    case 'add': addOrEdit(arg); break;
    case 'edititem': { const [k, id] = arg.split(':'); addOrEdit(k, id); break; }
    case 'form': coreForm(arg); break;
    case 'srd': srdSearch(); break;
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.coin) { const k = t.dataset.coin, v = Math.max(0, parseInt(t.value, 10) || 0); commit(k.toUpperCase() + ' set to ' + v, c => c.coins[k] = v); }
  if (t.dataset.notes) commit('Edited notes', c => c.notes = t.value, { norender: true });
});
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); undo(); } if (e.key === 'Escape') { closeModal(); hideXray(); } });
window.addEventListener('resize', () => { if (DB.ui.mode === 'combat') sizeDock(); });
try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) {}
render();
