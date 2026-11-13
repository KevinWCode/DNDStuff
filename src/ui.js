/* ---------- state ---------- */
const KEY = 'inkhud.v1';
let DB;
try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; }
if (!DB || !Array.isArray(DB.chars) || !DB.chars.length) DB = { chars: [sampleAshka(), sampleBrakka()], cur: 0, settings: { digital: false, fs: 1, dockOpen: true }, ui: { mode: 'explore', tab: 'sheet' } };
DB.settings = Object.assign({ digital: false, fs: 1, dockOpen: true }, DB.settings);
DB.ui = Object.assign({ mode: 'explore', tab: 'sheet' }, DB.ui);
const ui = { hpIn: '', target: 'me', bps: false, spellFilter: 'all', lvlFilter: 'all', flipped: new Set(), editing: false, armed: null, xray: null };
const undoStacks = {};
const C = () => DB.chars[DB.cur];
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast('<div class="t1">Could not save</div><div class="t2">Browser storage is full or blocked. Export a backup from the menu.</div>', 5000); } }, 150); }
function commit(label, fn, opts = {}) {
  const c = C(), st = undoStacks[c.id] || (undoStacks[c.id] = []);
  st.push(JSON.stringify(c)); if (st.length > 80) st.shift();
  fn(c);
  if (label) { c.log.unshift({ t: Date.now(), m: label }); if (c.log.length > 300) c.log.length = 300; }
  save(); if (!opts.norender) render();
}
function undo() {
  const c = C(), st = undoStacks[c.id];
  if (!st || !st.length) return;
  const was = c.log[0] ? c.log[0].m : 'last change';
  DB.chars[DB.cur] = JSON.parse(st.pop());
  toast('<div class="t1">Undid</div><div class="t2">' + esc(was) + '</div>', 1600);
  save(); render();
}

/* ---------- icons ---------- */
const I = {
  undo: '<svg class="ico" viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  lock: '<svg class="ico" viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  pen: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  moon: '<svg class="ico" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
  fire: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 22c4 0 7-2.7 7-7 0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-4-3-6 0 4-4 6-4 12 0 4.3 3 7 7 7Z"/></svg>',
  menu: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  plus: '<svg class="ico" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg class="ico" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16Z"/></svg>'
};
const SHAPES = {
  sphere: '<svg class="shape" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
  cone: '<svg class="shape" viewBox="0 0 24 24"><path d="M3 12 21 4v16Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  line: '<svg class="shape" viewBox="0 0 24 24"><rect x="2" y="9" width="20" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  cube: '<svg class="shape" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
};
const TIME = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', free: 'Free / Special' };

/* ---------- render ---------- */
const $ = s => document.querySelector(s);
let R;
function render() {
  const c = C(); R = compute(c);
  document.documentElement.dataset.skin = c.skin || 'ember';
  document.documentElement.style.setProperty('--fs', DB.settings.fs);
  document.body.classList.toggle('combat', DB.ui.mode === 'combat');
  document.body.classList.toggle('editing', ui.editing);
  $('#top').innerHTML = topHTML(c);
  const main = $('#main');
  const sy = window.scrollY;
  main.innerHTML = DB.ui.mode === 'combat' ? combatHTML(c) : ({ sheet: sheetHTML, spells: spellsHTML, gear: gearHTML, notes: notesHTML, log: logHTML }[DB.ui.tab] || sheetHTML)(c);
  const slot = $('#inkSlot'); if (slot) { slot.appendChild(INK.el); INK.fit(); }
  $('#dock').hidden = DB.ui.mode !== 'combat';
  if (DB.ui.mode === 'combat') { $('#dock').innerHTML = dockHTML(c); requestAnimationFrame(sizeDock); }
  window.scrollTo(0, sy);
  if (ui.xray && ui.xray.pinned) showXray(ui.xray.key, null, true);
  postAnim();
}
let pendingAnim = [];
function postAnim() { pendingAnim.forEach(([sel, cls]) => { const el = document.querySelector(sel); if (el) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); } }); pendingAnim = []; }
function sizeDock() { const d = $('#dock'); if (!d) return; document.body.style.setProperty('--dock-h', d.offsetHeight + 'px'); document.body.style.setProperty('--toast-b', (d.offsetHeight + 16) + 'px'); }

function topHTML(c) {
  const cls = c.classes.map(k => k.name + ' ' + k.lvl).join(' / ');
  const st = undoStacks[c.id] || [];
  const tabs = DB.ui.mode === 'explore' ? `<nav class="wrap tabs" aria-label="Sheet sections">${[['sheet', 'Sheet'], ['spells', c.casting ? 'Spells' : 'Spells'], ['gear', 'Gear & Attacks'], ['notes', 'Notes'], ['log', 'Changelog']].map(([k, n]) => `<button data-act="tab" data-arg="${k}" class="${DB.ui.tab === k ? 'on' : ''}">${n}</button>`).join('')}</nav>` : '';
  return `<div class="wrap top-in">
    <button class="sigil" data-act="menu" aria-label="Characters and settings">${esc(c.portrait || c.name[0])}</button>
    <div class="who"><h1>${esc(c.name)}</h1><div class="sub">${esc(c.species)} ${esc(cls)} · ${c.ruleset === '2024' ? '2024 rules' : '2014 rules'}</div></div>
    <div class="mode" role="tablist"><button data-act="mode" data-arg="explore" class="${DB.ui.mode === 'explore' ? 'on' : ''}">Explore</button><button data-act="mode" data-arg="combat" class="${DB.ui.mode === 'combat' ? 'on' : ''}">Combat</button></div>
    <div class="tools">
      <button class="tbtn" data-act="undo" ${st.length ? '' : 'disabled'} aria-label="Undo">${I.undo}<small>Undo${st.length ? ' ' + st.length : ''}</small></button>
      <button class="tbtn ${ui.editing ? 'on' : ''}" data-act="edit" aria-label="Edit lock">${ui.editing ? I.edit : I.lock}<small>${ui.editing ? 'Editing' : 'Locked'}</small></button>
      <button class="tbtn" data-act="short" aria-label="Short rest">${I.fire}<small>Short</small></button>
      <button class="tbtn" data-act="long" aria-label="Long rest">${I.moon}<small>Long</small></button>
      <button class="tbtn" data-act="menu" aria-label="Menu">${I.menu}<small>Menu</small></button>
    </div></div>${tabs}`;
}
const xa = (key, extra = '') => `data-x="${key}" ${R.stats[key] && R.stats[key].ov ? 'data-ov="1"' : ''} ${extra}`;
const ovc = key => R.stats[key] && R.stats[key].ov ? ' ovr' : '';
function tile(key, label, val, cls = '') { return `<div class="tile${ovc(key)} ${cls}" ${xa(key)}><div class="lbl">${label}</div><div class="v">${val}</div></div>`; }
function diceSmall(st) { return st.dice && st.dice.length ? ' <small>' + st.dice.map(d => (d.startsWith('-') ? '' : '+') + d).join(' ') + '</small>' : ''; }

function vitalsTiles(c, combat) {
  const s = R.stats;
  let h = tile('ac', 'Armor Class', s.ac.v, 'ac-shield') + tile('init', 'Initiative', sgn(s.init.v) + diceSmall(s.init)) + tile('speed', 'Speed', s.speed.v + '<small> ft</small>');
  if (!combat) h += tile('pb', 'Proficiency', sgn(s.pb.v));
  if (c.casting) h += tile('dc', 'Spell DC', s.dc.v) + (combat ? '' : tile('spellatk', 'Spell Atk', sgn(s.spellatk.v) + diceSmall(s.spellatk)));
  if (!combat) h += tile('passive', 'Passive Perc.', s.passive.v);
  return `<div class="tiles">${h}</div>`;
}

function hpPanel(c, combat) {
  const max = R.stats.hpmax.v, cur = c.hp.cur, tmp = c.hp.temp;
  const pct = Math.max(0, Math.min(1, cur / max)), tot = Math.max(max, cur + tmp);
  const hue = Math.round(pct * 120), col = `hsl(${hue} 70% ${cur ? 45 : 30}%)`;
  const targets = [['me', 'Me']].concat((c.summons || []).map(m => [m.id, m.name.split(' (')[0]]));
  const hasForm = (c.summons || []).find(m => m.absorb && m.active);
  const pad = ['1', '2', '3', '4', '5', '+', '6', '7', '8', '9', '0', '⌫'].map(k => `<button data-act="kp" data-arg="${k}" aria-label="${k === '⌫' ? 'Backspace' : k === 'C' ? 'Clear' : k}">${k}</button>`).join('');
  const parsed = evalF(ui.hpIn, {});
  let death = '';
  if (cur === 0) {
    const d = c.death, dead = d.f >= 3, stable = d.s >= 3;
    death = `<div class="death" role="group" aria-label="Death saves">
      <div class="ph"><h2>${dead ? 'Fallen' : stable ? 'Stable at 0 HP' : 'Death Saves'}</h2><span class="muted">DC 10, no modifier</span></div>
      <div class="ds"><span class="lbl" style="width:70px">Success</span>${[0, 1, 2].map(i => `<button class="s ${d.s > i ? 'on' : ''}" data-act="ds" data-arg="s${i}" aria-label="Success ${i + 1}"></button>`).join('')}</div>
      <div class="ds"><span class="lbl" style="width:70px">Failure</span>${[0, 1, 2].map(i => `<button class="f ${d.f > i ? 'on' : ''}" data-act="ds" data-arg="f${i}" aria-label="Failure ${i + 1}"></button>`).join('')}</div>
      <div class="btnrow"><button class="btn" data-act="dsroll">Roll death save</button><button class="btn pri" data-act="nat20">Natural 20: up at 1 HP</button></div>
      ${dead ? '<div class="muted">Three failures. Undo if that was a misclick, or talk to your DM about resurrection.</div>' : '<div class="muted">Damage while at 0 HP adds a failure (two on a critical hit).</div>'}</div>`;
  }
  return `<section class="panel hp ${combat ? 'hot' : ''} hpcol" id="hpPanel" aria-label="Hit points">
    <div class="ph"><h2>Hit Points</h2><span>${R.bloodied ? '<span class="badge blood">Bloodied</span>' : ''} ${c.conc ? `<button class="badge conc" data-act="dropconc" style="border-radius:999px">Concentrating: ${esc(c.conc)} ✕</button>` : ''}</span></div>
    <div class="hpnum" ${xa('hpmax')}><span class="big">${cur}</span><span class="muted">/ ${max}</span>${tmp ? `<span class="tmp">+${tmp} temp</span>` : ''}</div>
    <div class="hpbar" aria-hidden="true"><div class="f" style="width:${(cur / tot * 100).toFixed(1)}%;background:${col}"></div><div class="t" style="left:${(cur / tot * 100).toFixed(1)}%;width:${(tmp / tot * 100).toFixed(1)}%"></div><div class="txt">${Math.round(pct * 100)}%</div></div>
    ${death}
    ${targets.length > 1 ? `<div class="chips" aria-label="Apply to">${targets.map(([id, n]) => `<button class="chip ${ui.target === id ? 'on' : ''}" data-act="target" data-arg="${id}">${esc(n)}</button>`).join('')}</div>` : ''}
    <div class="hpin"><div class="disp" aria-live="polite" data-act="kp" data-arg="C" title="Tap to clear"><em>${ui.hpIn && parsed && /\+/.test(ui.hpIn) ? '= ' + parsed.n : 'Amount'}</em>${esc(ui.hpIn) || '0'}</div>
      ${R.resistBPS || hasForm ? `<button class="chip ${ui.bps ? 'on' : ''}" data-act="bps" title="Bludgeoning, piercing or slashing">B/P/S${R.resistBPS ? ' <span class="ct">½ Rage</span>' : ''}</button>` : ''}</div>
    <div class="pad">${pad}</div>
    <div class="hpacts"><button class="dmg" data-act="hp" data-arg="dmg">Damage</button><button class="heal" data-act="hp" data-arg="heal">Heal</button><button class="tmpb" data-act="hp" data-arg="temp">Temp HP</button><button data-act="hp" data-arg="half">Half dmg</button></div>
  </section>`;
}

function savesHTML(c) {
  return `<section class="panel"><div class="ph"><h2>Saving Throws</h2></div><div class="rows">${ABIL.map(a => {
    const st = R.stats['save_' + a];
    return `<div class="row${ovc('save_' + a)}" ${xa('save_' + a)}><button class="pm ${c.saves.includes(a) ? 'p1' : ''}" data-act="saveprof" data-arg="${a}" aria-label="Toggle ${ABN[a]} save proficiency"><i></i></button><span class="nm">${ABN[a]}</span><span class="val">${sgn(st.v)}${diceSmall(st)}</span></div>`;
  }).join('')}</div></section>`;
}
function abilHTML(c) {
  return `<section class="panel hot"><div class="ph"><h2>Abilities</h2><button class="btn sm edit-only" data-act="form" data-arg="abil">${I.edit} Scores</button></div><div class="abil">${ABIL.map(a => `<div class="ab${ovc('abil_' + a)}" ${xa('abil_' + a)}><div class="lbl">${ABN[a].slice(0, 3)}</div><div class="m">${sgn(R.mods[a])}</div><span class="s">${c.abilities[a]}</span></div>`).join('')}</div></section>`;
}
function skillsHTML(c) {
  return `<section class="panel"><div class="ph"><h2>Skills</h2><span class="muted" style="font-size:.8em">○ none ● proficient ◆ expertise</span></div><div class="rows">${SKILLS.map(([k, a, n]) => {
    const st = R.stats['skill_' + k], p = +c.skills[k] || 0;
    return `<div class="row${ovc('skill_' + k)}" ${xa('skill_' + k)}><button class="pm p${p}" data-act="skillprof" data-arg="${k}" aria-label="Cycle ${n} proficiency"><i></i></button><span class="ab3">${a}</span><span class="nm">${n}</span><span class="val">${sgn(st.v)}${diceSmall(st)}</span></div>`;
  }).join('')}</div>
  <div class="chips" style="margin-top:10px"><span class="passive${ovc('passive')}" ${xa('passive')}>Passive Perception <b>${R.stats.passive.v}</b></span><span class="passive" ${xa('passive_ins')}>Insight <b>${R.stats.passive_ins.v}</b></span><span class="passive" ${xa('passive_inv')}>Investigation <b>${R.stats.passive_inv.v}</b></span></div></section>`;
}
function hitDiceHTML(c) {
  return `<section class="panel"><div class="ph"><h2>Hit Dice</h2><span class="muted">Spend on a Short Rest</span></div>${c.hitDice.map((h, i) => `<div class="res"><div class="nm"><b>d${h.die}</b> ${esc(h.cls)}<small>${h.max - h.used} of ${h.max} left</small></div><div class="mini-pips">${Array.from({ length: h.max }, (_, j) => `<i class="${j < h.max - h.used ? '' : 'u'}"></i>`).join('')}</div><button class="btn sm" data-act="hd" data-arg="${i}" ${h.used >= h.max ? 'disabled' : ''}>Spend</button></div>`).join('')}</section>`;
}
function condHTML(c) {
  return `<section class="panel"><div class="ph"><h2>Conditions</h2><div class="step" aria-label="Exhaustion"><button data-act="exh" data-arg="-1" aria-label="Less exhaustion">−</button><span title="Exhaustion">Exh ${c.exhaustion}</span><button data-act="exh" data-arg="1" aria-label="More exhaustion">+</button></div></div>
  <div class="chips">${CONDITIONS.map(k => `<button class="chip bad ${c.conditions.includes(k) ? 'on' : ''}" data-act="cond" data-arg="${k}">${k}</button>`).join('')}</div>
  ${c.exhaustion ? `<p class="muted" style="margin:10px 0 0">${c.ruleset === '2024' ? `Exhaustion ${c.exhaustion}: −${2 * c.exhaustion} to every D20 Test and −${5 * c.exhaustion} ft speed (already applied).` : 'Exhaustion (2014): see the level table. Level 1 is disadvantage on ability checks.'} Level 6 is death.</p>` : ''}</section>`;
}
function featuresHTML(c) {
  const groups = LANES.map(([k, n]) => [n, c.features.filter(f => f.time === k)]).filter(g => g[1].length);
  return `<section class="panel"><div class="ph"><h2>Features & Traits</h2><button class="btn sm edit-only" data-act="add" data-arg="feature">${I.plus} Add</button></div>
  ${groups.map(([n, fs]) => `<div class="lbl" style="margin:8px 0 4px">${n}</div><div class="rows">${fs.map(f => `<div class="row" style="align-items:flex-start"><div class="nm"><b>${esc(f.name)}</b>${f.res ? ' ' + resPips(c, f.res) : ''}<div class="muted" style="font-size:.92em">${interp(f.desc || '', R)}</div></div><button class="btn sm edit-only" data-act="edititem" data-arg="feature:${f.id}">${I.edit}</button></div>`).join('')}</div>`).join('') || '<div class="empty">No features yet. Unlock editing to add one.</div>'}</section>`;
}
function resPips(c, rid) { const r = c.resources.find(x => x.id === rid); return r ? `<span class="tag m">${r.cur}/${r.max}</span>` : ''; }

function sheetHTML(c) {
  return `<div class="grid3">
    <div class="stack">${abilHTML(c)}${savesHTML(c)}</div>
    <div class="stack">${skillsHTML(c)}</div>
    <div class="stack col3">${hpPanel(c, false)}<section class="panel"><div class="ph"><h2>Defenses & Speed</h2><button class="btn sm edit-only" data-act="form" data-arg="identity">${I.edit} Core</button></div>${vitalsTiles(c, false)}<p class="dicemode" style="margin:10px 0 0">Tap any number for a big-print roll card. Long-press (or hover the S Pen) to see the math. Double-tap to override it.</p></section>${hitDiceHTML(c)}${condHTML(c)}${featuresHTML(c)}</div>
  </div>`;
}

/* --- slots & resources --- */
function slotsHTML(c) {
  if (!c.slots.length) return c.casting ? `<section class="panel"><div class="ph"><h2>Spell Slots</h2><button class="btn sm edit-only" data-act="form" data-arg="slots">${I.edit}</button></div><div class="empty">No slots set.</div></section>` : '';
  return `<section class="panel hot"><div class="ph"><h2>Spell Slots</h2><button class="btn sm edit-only" data-act="form" data-arg="slots">${I.edit} Slots</button></div><div class="slots">${c.slots.map((s, i) => `<div class="slotrow"><span class="lv">${s.label ? esc(s.label) + ' ' : ''}${ord(s.lvl)}</span>${Array.from({ length: s.max }, (_, j) => `<button class="pip ${j >= s.max - s.used ? 'used' : ''}" id="pip-${i}-${j}" data-act="pip" data-arg="${i}:${j}" aria-label="${ord(s.lvl)} level slot ${j + 1}"></button>`).join('')}<span class="muted">${s.rest === 'short' ? 'Short rest' : 'Long rest'}</span></div>`).join('')}</div></section>`;
}
const ord = n => n === 0 ? 'Cantrip' : n + (['th', 'st', 'nd', 'rd'][n] || 'th');
function resourcesHTML(c) {
  return `<section class="panel"><div class="ph"><h2>Resources & Charges</h2><button class="btn sm edit-only" data-act="add" data-arg="resource">${I.plus} Add</button></div>${c.resources.map(r => `<div class="res"><div class="nm"><b>${esc(r.name)}</b><small>${{ short: 'Recharges on Short Rest', long: 'Recharges on Long Rest', dawn: 'Regains ' + (r.regain || 'all') + ' at dawn', none: 'Does not recharge' }[r.rest] || ''}${r.note ? ' · ' + esc(r.note) : ''}</small></div>
    ${r.max <= 10 ? `<div class="mini-pips">${Array.from({ length: r.max }, (_, j) => `<i class="${j < r.cur ? '' : 'u'}"></i>`).join('')}</div>` : ''}
    <div class="step"><button data-act="res" data-arg="${r.id}:-1" aria-label="Use one">−</button><span>${r.cur}/${r.max}</span><button data-act="res" data-arg="${r.id}:1" aria-label="Regain one">+</button></div>
    ${r.rest === 'dawn' && r.regain ? `<button class="btn sm" data-act="dawn" data-arg="${r.id}">Dawn: ${esc(r.regain)}</button>` : ''}
    <button class="btn sm edit-only" data-act="edititem" data-arg="resource:${r.id}">${I.edit}</button></div>`).join('') || '<div class="empty">Track rage, ki, wand charges, anything with uses.</div>'}</section>`;
}
function summonsHTML(c) {
  if (!c.summons.length && !ui.editing) return '';
  return `<section class="panel"><div class="ph"><h2>Companions & Forms</h2><button class="btn sm edit-only" data-act="add" data-arg="summon">${I.plus} Add</button></div>${c.summons.map(m => {
    const p = Math.max(0, m.hp / m.max);
    return `<div class="res"><div class="nm"><b>${esc(m.name)}</b> <span class="tag">AC ${m.ac}</span>${m.absorb ? `<button class="chip ${m.active ? 'on' : ''}" data-act="formtoggle" data-arg="${m.id}" style="min-height:34px;padding:4px 10px">${m.active ? 'Form active' : 'Assume form'}</button>` : ''}<small>${esc(m.note || '')}</small>
      <div class="hpbar" style="height:14px;margin-top:6px"><div class="f" style="width:${p * 100}%;background:hsl(${p * 120} 65% 45%)"></div></div></div>
      <div class="step"><button data-act="sumhp" data-arg="${m.id}:-1" aria-label="Damage 1">−</button><span>${m.hp}/${m.max}</span><button data-act="sumhp" data-arg="${m.id}:1" aria-label="Heal 1">+</button></div>
      <button class="btn sm edit-only" data-act="edititem" data-arg="summon:${m.id}">${I.edit}</button></div>`;
  }).join('') || '<div class="empty">Add a familiar, summon, or Wild Shape form. Forms can soak damage first.</div>'}</section>`;
}
function attacksHTML(c, onlySet) {
  const list = R.attacks.filter(a => !onlySet || a.inSet);
  return `<section class="panel hot"><div class="ph"><h2>Attacks</h2><button class="btn sm edit-only" data-act="add" data-arg="attack">${I.plus} Add</button></div>
  <div class="sets">${c.sets.map((s, i) => `<button class="chip ${c.activeSet === i ? 'on' : ''}" data-act="set" data-arg="${i}">${esc(s.name)}${s.shield ? ' <span class="ct">+shield</span>' : ''}</button>`).join('')}<button class="chip edit-only" data-act="add" data-arg="set">${I.plus} Set</button></div>
  ${list.map(a => `<div class="atk${ovc('atk_' + a.w.id)}" ${xa('atk_' + a.w.id)}><div><b>${esc(a.w.name)}</b><div>${a.w.mastery ? `<span class="tag m">${esc(a.w.mastery)}</span>` : ''}<span class="tag">${esc(a.w.props || '')}</span></div></div>
    <div class="hit">${sgn(a.hit.v)}<small>TO HIT${a.hit.dice.length ? ' ' + a.hit.dice.map(d => '+' + d).join(' ') : ''}</small></div>
    <div class="dm" ${xa('dmg_' + a.w.id)}>${esc(a.dmgTxt)}<small>${esc(a.w.type || '')}</small></div>
    ${ui.editing ? `<button class="btn sm" data-act="edititem" data-arg="attack:${a.w.id}" style="grid-column:1/-1">${I.edit} Edit</button>` : ''}</div>`).join('') || '<div class="empty">No attacks in this weapon set.</div>'}
  ${ui.editing && c.sets[c.activeSet] ? `<button class="btn sm" data-act="edititem" data-arg="set:${c.activeSet}">${I.edit} Edit this set</button>` : ''}</section>`;
}
function buffTray(c) {
  return `<section class="panel"><div class="ph"><h2>Buffs & Situations</h2><button class="btn sm edit-only" data-act="form" data-arg="buffs">${I.edit}</button></div><div class="chips">${c.buffs.filter(b => BUFFS[b]).map(b => `<button class="chip ${c.active[b] ? 'on' : ''}" data-act="buff" data-arg="${b}" title="${esc(BUFFS[b].desc)}">${BUFFS[b].label}${BUFFS[b].ac ? ` <span class="ct">+${BUFFS[b].ac} AC</span>` : ''}${BUFFS[b].atk ? ' <span class="ct">+1d4</span>' : ''}</button>`).join('')}</div>
  ${Object.keys(c.active).filter(k => c.active[k] && BUFFS[k]).length ? `<p class="muted" style="margin:8px 0 0;font-size:.9em">${Object.keys(c.active).filter(k => c.active[k] && BUFFS[k]).map(k => '<b>' + BUFFS[k].label + ':</b> ' + esc(BUFFS[k].desc)).join('<br>')}</p>` : ''}</section>`;
}

/* --- combat --- */
function combatHTML(c) {
  const sp = R.stats.speed.v * (c.turn.dash ? 2 : 1), sq = Math.min(48, Math.floor(sp / 5));
  return `<div class="hud">
    ${hpPanel(c, true)}
    <div class="stack">
      <section class="panel"><div class="roundbox"><span class="rn">Round ${c.turn.round}</span><span class="muted" style="flex:1">${R.actionsMax > 1 ? R.actionsMax + ' actions this turn' : ''}</span><button class="btn sm" data-act="newcombat">New fight</button><button class="endturn" data-act="endturn">End Turn</button></div></section>
      <section class="panel">${vitalsTiles(c, true)}
        <div class="lbl" style="margin:12px 0 6px">Movement · ${sp - c.turn.move * 5} of ${sp} ft left</div>
        <div class="moves">${Array.from({ length: sq }, (_, i) => `<button class="${i < c.turn.move ? 'u' : ''}" data-act="move" data-arg="${i}" aria-label="Square ${i + 1}"></button>`).join('')}</div>
        <div class="btnrow" style="margin-top:8px"><button class="chip ${c.turn.dash ? 'on' : ''}" data-act="dash">Dash</button><button class="chip" data-act="moveclear">Reset move</button></div></section>
      ${buffTray(c)}
      ${condHTML(c)}
    </div>
    <div class="stack">${attacksHTML(c, true)}${slotsHTML(c)}${resourcesHTML(c)}${summonsHTML(c)}</div>
  </div>`;
}
function laneItems(c, lane) {
  const out = [];
  if (lane === 'action') R.attacks.filter(a => a.inSet).forEach(a => out.push({ k: 'atk', id: a.w.id, n: a.w.name, s: sgn(a.hit.v) + ' · ' + a.dmgTxt }));
  c.spells.filter(s => s.time === lane && (s.lvl === 0 || c.slots.length)).forEach(s => out.push({ k: 'spell', id: s.id, n: s.name, s: (s.lvl ? ord(s.lvl) : 'Cantrip') + (s.conc ? ' · Conc.' : '') + (s.range ? ' · ' + s.range : '') }));
  c.features.filter(f => f.time === lane).forEach(f => { const r = f.res && c.resources.find(x => x.id === f.res); out.push({ k: 'feat', id: f.id, n: f.name, s: r ? r.cur + '/' + r.max + ' left' : (f.buff ? (c.active[f.buff] ? 'Active' : 'Toggle') : 'Feature') }); });
  (STD_ACTIONS[lane] || []).forEach(([n, s]) => out.push({ k: 'std', id: n, n, s, std: 1 }));
  return out;
}
function dockHTML(c) {
  const t = c.turn, open = DB.settings.dockOpen;
  const spent = { action: t.action >= R.actionsMax, bonus: t.bonus >= 1, reaction: t.reaction >= 1, free: false };
  return `<button class="dock-toggle" data-act="dock">${open ? 'Hide action bar' : 'Show action bar'}</button>
  <div class="wrap dock-in" ${open ? '' : 'hidden'}>${LANES.map(([k, n]) => `<section class="lane ${spent[k] ? 'spent' : k !== 'free' ? 'avail' : ''}" data-lane="${k}">
    <header><span class="gem"></span><b>${n}${k === 'action' && R.actionsMax > 1 ? ' ×' + (R.actionsMax - t.action) : ''}</b>${k !== 'free' ? `<button data-act="lane" data-arg="${k}">${spent[k] ? 'Spent' : 'Mark used'}</button>` : ''}${k === 'action' ? '<button data-act="extra" title="Action Surge, Haste">+1</button>' : ''}</header>
    <div class="cards">${laneItems(c, k).map(it => `<button class="card ${it.std ? 'std' : ''}" data-act="use" data-arg="${it.k}:${esc(it.id)}:${k}"><b>${esc(it.n)}</b><span>${esc(it.s)}</span></button>`).join('')}</div></section>`).join('')}</div>`;
}

/* --- spells --- */
function spellsHTML(c) {
  const f = ui.spellFilter, lf = ui.lvlFilter;
  const lvls = [...new Set(c.spells.map(s => s.lvl))].sort((a, b) => a - b);
  const list = c.spells.filter(s => (f === 'all' || (f === 'conc' && s.conc) || (f === 'ritual' && s.ritual) || s.time === f) && (lf === 'all' || s.lvl === +lf)).sort((a, b) => a.lvl - b.lvl || a.name.localeCompare(b.name));
  return `<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,2.4fr)">
    <div class="stack">${c.casting ? `<section class="panel"><div class="tiles">${tile('dc', 'Spell DC', R.stats.dc.v)}${tile('spellatk', 'Spell Atk', sgn(R.stats.spellatk.v) + diceSmall(R.stats.spellatk))}${tile('abil_' + c.casting.ability, c.casting.ability.toUpperCase(), sgn(R.mods[c.casting.ability]))}</div></section>` : `<section class="panel"><div class="empty">No spellcasting ability set. Unlock editing and use Core to add one.</div></section>`}${slotsHTML(c)}</div>
    <section class="panel"><div class="ph"><h2>Spellbook</h2><span class="btnrow"><button class="btn sm edit-only" data-act="srd">Search SRD</button><button class="btn sm edit-only" data-act="add" data-arg="spell">${I.plus} Add</button></span></div>
      <div class="filters">${[['all', 'All'], ['conc', 'Concentration'], ['ritual', 'Ritual'], ['action', 'Action'], ['bonus', 'Bonus'], ['reaction', 'Reaction']].map(([k, n]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="sfilter" data-arg="${k}">${n}</button>`).join('')}</div>
      <div class="levelbar" ${c.spells.length ? "" : "hidden"}>${['all'].concat(lvls).map(l => `<button class="${String(lf) === String(l) ? 'on' : ''}" data-act="lfilter" data-arg="${l}">${l === 'all' ? 'All' : l === 0 ? 'C' : l}</button>`).join('')}</div>
      <div class="spgrid">${list.map(s => `<div class="sp ${ui.flipped.has(s.id) ? 'flip' : ''}" data-act="flip" data-arg="${s.id}" role="button" tabindex="0" aria-label="${esc(s.name)} card, tap to flip">
        <div class="in"><div class="face"><span class="lvl">${s.lvl || 'C'}</span><h3>${esc(s.name)}</h3><div class="muted">${s.lvl ? ord(s.lvl) + '-level ' : ''}${esc(s.school || '')}${s.lvl ? '' : ' cantrip'}</div>
          <dl class="meta"><dt>Cast</dt><dd>${TIME[s.time] || esc(s.time)}</dd><dt>Range</dt><dd>${esc(s.range || '—')}</dd><dt>Duration</dt><dd>${esc(s.dur || '—')}</dd><dt>Parts</dt><dd>${esc(s.comp || '—')}</dd></dl>
          <div class="ftr">${s.area && SHAPES[s.area] ? SHAPES[s.area] : ''}${s.conc ? '<span class="tag m">Concentration</span>' : ''}${s.ritual ? '<span class="tag m">Ritual</span>' : ''}<span class="muted" style="margin-left:auto;font-size:.8em">tap to flip</span></div></div>
        <div class="face back"><h3>${esc(s.name)}</h3><p>${interp(s.desc || '', R)}</p><div class="ftr"><button class="btn sm pri" data-act="cast" data-arg="${s.id}">${s.lvl ? 'Cast' : 'Use'}</button><button class="btn sm edit-only" data-act="edititem" data-arg="spell:${s.id}">${I.edit}</button></div></div></div></div>`).join('') || '<div class="empty">No spells match.</div>'}</div>
    </section></div>`;
}

/* --- gear --- */
function gearHTML(c) {
  const maxAtt = c.attuneMax || 3, att = c.items.filter(i => i.attuned);
  return `<div class="grid2">
    <div class="stack">${attacksHTML(c, false)}${buffTray(c)}${summonsHTML(c)}</div>
    <div class="stack">
      <section class="panel"><div class="ph"><h2>Attunement</h2><span class="muted">${att.length} of ${maxAtt}</span></div><div class="sockets">${Array.from({ length: maxAtt }, (_, i) => att[i] ? `<div class="sock full" data-act="attune" data-arg="${att[i].id}"><div>${esc(att[i].name)}</div></div>` : `<div class="sock"><div class="muted">Empty socket</div></div>`).join('')}</div><p class="muted" style="margin:10px 0 0;font-size:.9em">Tap an attuned item to end attunement. Tap "Attune" on an item below to socket it.</p></section>
      <section class="panel"><div class="ph"><h2>Inventory</h2><button class="btn sm edit-only" data-act="add" data-arg="item">${I.plus} Add</button></div><div class="rows items">${c.items.map(i => `<div class="row" style="align-items:flex-start"><span class="qty">${i.qty}×</span><div class="nm"><b>${esc(i.name)}</b>${i.equipped ? ' <span class="tag">Equipped</span>' : ''}${i.attuned ? ' <span class="tag m">Attuned</span>' : ''}${i.desc ? `<div class="muted" style="font-size:.9em">${esc(i.desc)}</div>` : ''}</div>${i.attune && !i.attuned ? `<button class="btn sm" data-act="attune" data-arg="${i.id}">Attune</button>` : ''}<button class="btn sm edit-only" data-act="edititem" data-arg="item:${i.id}">${I.edit}</button></div>`).join('') || '<div class="empty">Nothing carried.</div>'}</div></section>
      <section class="panel"><div class="ph"><h2>Coin</h2></div><div class="coins">${['cp', 'sp', 'ep', 'gp', 'pp'].map(k => `<label class="coin"><span class="lbl">${k.toUpperCase()}</span><input id="coin-${k}" inputmode="numeric" value="${c.coins[k]}" data-coin="${k}" aria-label="${k.toUpperCase()}"></label>`).join('')}</div></section>
    </div></div>`;
}
function notesHTML(c) {
  return `<div class="grid2" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)"><section class="panel"><div class="ph"><h2>Pen Notes</h2><span class="muted">Write with the S Pen. Fingers are ignored when Pen only is on.</span></div><div id="inkSlot"></div></section>
  <section class="panel"><div class="ph"><h2>Backstory & Campaign</h2></div><textarea class="field" id="notes" data-notes="1" style="min-height:420px" aria-label="Backstory and campaign notes">${esc(c.notes)}</textarea></section></div>`;
}
function logHTML(c) {
  const fmt = t => { const d = new Date(t); return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  return `<section class="panel log"><div class="ph"><h2>Changelog</h2><span class="muted">Every change, newest first. Undo steps back through this session.</span></div><div class="rows">${c.log.slice(0, 200).map(l => `<div class="row"><time>${fmt(l.t)}</time><span class="nm">${esc(l.m)}</span></div>`).join('') || '<div class="empty">Nothing yet. Take some damage.</div>'}</div></section>`;
}
