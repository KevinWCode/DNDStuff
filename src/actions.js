/* ---------- overlays ---------- */
let toastT;
function toast(html, ms = 2600) {
  let t = $('#toast'); if (t) t.remove();
  t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = html;
  document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), ms);
  t.onclick = () => t.remove();
}
function modal(html, bind) {
  const ov = $('#ov'); ov.innerHTML = `<div class="scrim" data-scrim="1"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  ov.querySelector('.scrim').addEventListener('click', e => { if (e.target.dataset.scrim) closeModal(); });
  if (bind) bind(ov.querySelector('.sheet'));
  const f = ov.querySelector('input,select,textarea'); if (f && !('ontouchstart' in window)) f.focus();
}
function closeModal() { $('#ov').innerHTML = ''; }
function hideXray() { const x = $('#xray'); if (x) x.remove(); ui.xray = null; }
function showXray(key, anchor, pinned) {
  const st = R.stats[key]; if (!st) return;
  anchor = anchor || document.querySelector(`[data-x="${key}"]`); if (!anchor) return hideXray();
  let x = $('#xray'); if (!x) { x = document.createElement('div'); x.id = 'xray'; x.className = 'xray'; document.body.appendChild(x); }
  const val = st.txt != null ? st.txt : (key === 'ac' || key === 'speed' || key === 'hpmax' || key.startsWith('passive') || key === 'dc') ? st.v : fmtStat(st);
  const eq = st.parts.map(p => typeof p[1] === 'number' ? (p[1] < 0 ? '− ' + -p[1] : p[1]) : p[1]).join(' + ').replace(/\+ −/g, '−');
  x.innerHTML = `<div class="eq">${esc(st.label)} ${esc(String(val))}</div>
    ${st.ov ? `<div class="note">Overridden: <b>${esc(st.ov.f)}</b>${st.ov.note ? ' · ' + esc(st.ov.note) : ''}. Calculated: <s>${st.base}</s></div>` : `<div class="note">= ${esc(eq)}</div>`}
    <ul>${st.parts.map(p => `<li><span>${esc(p[0])}</span><b>${typeof p[1] === 'number' ? sgn(p[1]) : '+' + esc(p[1])}</b></li>`).join('')}</ul>
    ${pinned ? `<div class="x-ov"><button data-act="override" data-arg="${key}">Override ✎</button><button data-act="xclose">Close</button></div>` : ''}`;
  const r = anchor.getBoundingClientRect(), w = x.offsetWidth, h = x.offsetHeight;
  let left = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
  let top = r.top - h - 10; if (top < 70) top = r.bottom + 10;
  x.style.left = left + 'px'; x.style.top = Math.min(top, window.innerHeight - h - 10) + 'px';
  ui.xray = { key, pinned };
}

/* ---------- rolls ---------- */
const ROLLABLE = /^(abil_|save_|skill_|atk_|init|spellatk)/;
function d20() { return 1 + Math.floor(Math.random() * 20); }
function rollCard(key) {
  const st = R.stats[key]; if (!st) return;
  const label = st.label.replace(' modifier', ' check');
  if (!DB.settings.digital) {
    let extra = '';
    if (key.startsWith('atk_')) { const d = R.stats['dmg_' + key.slice(4)]; extra = `<div class="t2">Damage: <b>${esc(d.txt)}</b></div>`; }
    return toast(`<div class="t2">${esc(label)} · roll a d20</div><div class="big">${fmtStat(st)}</div>${extra}`, 3200);
  }
  const a = d20(), b = d20(), bonus = st.dice.reduce((s, d) => s + rollDice(d, {}).total, 0), tot = a + st.v + bonus;
  let extra = '';
  if (key.startsWith('atk_')) { const id = key.slice(4), d = R.stats['dmg_' + id]; const dr = rollDice(d.txt.replace(/[a-z]+$/i, ''), {}); extra = `<div class="t1">Damage ${dr.total}${a === 20 ? ' (crit: roll the dice twice)' : ''}</div><div class="t2">${esc(d.txt)} → [${dr.detail.join(', ')}]</div>`; }
  toast(`<div class="t2">${esc(label)} ${fmtStat(st)}</div><div class="big ${a === 20 ? 'crit' : a === 1 ? 'fumble' : ''}">${tot}</div><div class="t2">d20 ${a}${bonus ? ' + ' + bonus + ' (dice)' : ''} ${sgn(st.v)} · second d20 for adv/dis: ${b} → ${b + st.v + bonus}</div>${extra}`, 4200);
}

/* ---------- HP engine ---------- */
function hpAct(kind) {
  const p = evalF(ui.hpIn, {}); if (!p || !p.n) { toast('<div class="t1">Type an amount first</div><div class="t2">You can enter sums like 7+5</div>', 1800); return; }
  let n = p.n; ui.hpIn = '';
  const c = C();
  if (ui.target !== 'me') {
    const m = c.summons.find(s => s.id === ui.target); if (!m) return;
    commit((kind === 'heal' ? 'Healed ' : 'Damaged ') + m.name + ' ' + n, c => { const s = c.summons.find(x => x.id === m.id); if (kind === 'heal') s.hp = Math.min(s.max, s.hp + n); else s.hp = Math.max(0, s.hp - (kind === 'half' ? Math.floor(n / 2) : n)); });
    return;
  }
  if (kind === 'heal') {
    commit('Healed ' + n, c => { const was = c.hp.cur; c.hp.cur = Math.min(R.stats.hpmax.v, c.hp.cur + n); if (was === 0) c.death = { s: 0, f: 0 }; });
    pendingAnim.push(['#hpPanel', 'flash-heal']); render(); return;
  }
  if (kind === 'temp') { commit('Temp HP set to ' + Math.max(n, c.hp.temp) + (n < c.hp.temp ? ' (kept higher value)' : ''), c => { c.hp.temp = Math.max(c.hp.temp, n); }); return; }
  // damage
  const notes = [];
  if (kind === 'half') { n = Math.floor(n / 2); notes.push('halved'); }
  else if (R.resistBPS && ui.bps) { n = Math.floor(n / 2); notes.push('halved by Rage'); }
  const raw = n;
  commit('Took ' + raw + ' damage' + (notes.length ? ' (' + notes.join(', ') + ')' : ''), c => {
    const form = c.summons.find(s => s.absorb && s.active);
    if (form && n > 0) { const take = Math.min(form.hp, n); form.hp -= take; n -= take; notes.push(form.name + ' absorbed ' + take); if (form.hp === 0) { form.active = false; notes.push('form drops'); } }
    const t = Math.min(c.hp.temp, n); c.hp.temp -= t; n -= t; if (t) notes.push(t + ' from temp HP');
    if (c.hp.cur === 0 && (raw > 0)) { if (n >= R.stats.hpmax.v) { c.death.f = 3; notes.push('massive damage'); } else { c.death.f = Math.min(3, c.death.f + 1); notes.push('death save failure'); } }
    else {
      const over = n - c.hp.cur; c.hp.cur = Math.max(0, c.hp.cur - n);
      if (c.hp.cur === 0) { c.death = { s: 0, f: 0 }; if (over >= R.stats.hpmax.v) { c.death.f = 3; notes.push('massive damage: instant death'); } else notes.push('down to 0 HP'); }
    }
  });
  ui.bps = false;
  pendingAnim.push(['#hpPanel', 'flash-dmg']); render();
  if (notes.length > 1 || notes.some(x => /absorb|temp|death|0 HP/.test(x))) toast('<div class="t1">−' + raw + ' HP</div><div class="t2">' + esc(notes.join(' · ')) + '</div>', 2600);
  const c2 = C();
  if (c2.conc && raw > 0) {
    if (c2.hp.cur === 0) { const name = c2.conc; dropConc('Concentration on ' + name + ' ends (0 HP)'); return; }
    const dc = Math.max(10, Math.floor(raw / 2)), dcc = c2.ruleset === '2024' ? Math.min(30, dc) : dc, sv = R.stats.save_con;
    modal(`<h2>Concentration check</h2><p>You took ${raw} damage while concentrating on <b>${esc(c2.conc)}</b>.</p>
      <div class="tiles"><div class="tile"><div class="lbl">Save DC</div><div class="v">${dcc}</div></div><div class="tile"><div class="lbl">CON save</div><div class="v">${fmtStat(sv)}</div></div></div>
      <div id="cres" class="muted">Roll your d20, or let the app roll.</div>
      <div class="btnrow"><button class="btn" data-m="roll">Roll for me</button><button class="btn pri" data-m="pass">I passed</button><button class="btn dng" data-m="fail">I failed: drop it</button></div>`, sh => {
      sh.addEventListener('click', e => {
        const m = e.target.dataset.m; if (!m) return;
        if (m === 'pass') closeModal();
        if (m === 'fail') { closeModal(); dropConc('Lost concentration on ' + c2.conc); }
        if (m === 'roll') { const a = d20(), bd = sv.dice.reduce((s, d) => s + rollDice(d, {}).total, 0), tot = a + sv.v + bd; const ok = tot >= dcc && a !== 1 || a === 20 && false; sh.querySelector('#cres').innerHTML = `<span style="font-size:2em;font-weight:800">${tot}</span> (d20 ${a} ${sgn(sv.v)}${bd ? ' +' + bd : ''}) vs DC ${dcc}: <b style="color:var(${tot >= dcc ? '--good' : '--bad'})">${tot >= dcc ? 'Held it' : 'Lost it'}</b>`; e.target.remove(); }
      });
    });
  }
}
function dropConc(label) {
  commit(label, c => { (c.concBuffs || []).forEach(b => delete c.active[b]); c.concBuffs = []; c.conc = null; });
}
function setConc(name, buffs, after) {
  const c = C();
  const go = () => { commit('Concentrating on ' + name, c => { (c.concBuffs || []).forEach(b => delete c.active[b]); c.conc = name; c.concBuffs = buffs || []; (buffs || []).forEach(b => c.active[b] = true); }); after && after(); };
  if (c.conc && c.conc !== name) {
    modal(`<h2>Drop ${esc(c.conc)}?</h2><p>You can only concentrate on one spell. Casting ${esc(name)} ends ${esc(c.conc)}.</p><div class="btnrow"><button class="btn" data-m="no">Keep ${esc(c.conc)}</button><button class="btn pri" data-m="yes">Switch to ${esc(name)}</button></div>`, sh => sh.addEventListener('click', e => { if (e.target.dataset.m === 'yes') { closeModal(); go(); } if (e.target.dataset.m === 'no') closeModal(); }));
  } else go();
}

/* ---------- economy / use ---------- */
function markLane(lane, label) {
  if (lane === 'free') return;
  commit(label || (TIME[lane] + ' used'), c => { if (lane === 'action') c.turn.action++; else c.turn[lane] = (c.turn[lane] || 0) + 1; });
}
function useItem(kind, id, lane) {
  const c = C();
  if (kind === 'atk') { markLane('action', 'Attacked with ' + (c.attacks.find(a => a.id === id) || {}).name); rollCard('atk_' + id); return; }
  if (kind === 'spell') return castSpell(id, lane);
  if (kind === 'std') {
    if (id === 'Dash') commit('Dash', c => { c.turn.dash = true; if (lane === 'action') c.turn.action++; else c.turn[lane]++; });
    else if (id === 'Dodge') commit('Dodge', c => { c.active.dodge = true; c.turn.action++; });
    else if (lane !== 'free') markLane(lane, id); else toast('<div class="t1">' + esc(id) + '</div>', 1200);
    return;
  }
  if (kind === 'feat') {
    const f = c.features.find(x => x.id === id); if (!f) return;
    const r = f.res && c.resources.find(x => x.id === f.res);
    if (f.buff && c.active[f.buff]) { commit(f.name + ' ended', c => { delete c.active[f.buff]; }); return; }
    if (r && r.cur <= 0) { toast(`<div class="t1">No ${esc(r.name)} uses left</div><div class="t2">Use the + on Resources if your DM allows it.</div>`); return; }
    let msg = f.name; let heal = 0, tmp = 0;
    if (f.heal) { const h = rollDice(f.heal, R.ctx); heal = h.total; msg += ': healed ' + heal + ' [' + h.detail.join(',') + ']'; }
    if (f.temp) { const t = evalF(f.temp, R.ctx); tmp = t ? t.n : 0; msg += ': ' + tmp + ' temp HP'; }
    commit(msg, c => {
      const rr = f.res && c.resources.find(x => x.id === f.res); if (rr) rr.cur--;
      if (f.buff) c.active[f.buff] = true;
      if (f.extraAction) c.turn.extra = (c.turn.extra || 0) + 1;
      if (heal) { c.hp.cur = Math.min(R.stats.hpmax.v, c.hp.cur + heal); }
      if (tmp) c.hp.temp = Math.max(c.hp.temp, tmp);
      if (lane !== 'free') { if (lane === 'action') c.turn.action++; else c.turn[lane] = (c.turn[lane] || 0) + 1; }
    });
    toast('<div class="t1">' + esc(msg) + '</div>' + (r ? `<div class="t2">${r.cur - 1} of ${r.max} ${esc(r.name)} left</div>` : ''), 2200);
  }
}
function castSpell(id, lane) {
  const c = C(), s = c.spells.find(x => x.id === id); if (!s) return;
  lane = lane || s.time;
  const finish = (slotIdx, sl) => {
    const apply = () => {
      let tmp = 0; if (s.temp) { const t = evalF(String(s.temp).replace(/SL/gi, sl), R.ctx); tmp = t ? t.n : 0; }
      commit('Cast ' + s.name + (sl ? ' at ' + ord(sl) + ' level' : ''), c => {
        if (slotIdx != null) c.slots[slotIdx].used++;
        if (tmp) c.hp.temp = Math.max(c.hp.temp, tmp);
        if (s.buff && !s.conc) c.active[s.buff] = true;
        if (lane && lane !== 'free' && TIME[lane]) { if (lane === 'action') c.turn.action++; else c.turn[lane] = (c.turn[lane] || 0) + 1; }
      });
      if (slotIdx != null) { const sl2 = C().slots[slotIdx]; pendingAnim.push([`#pip-${slotIdx}-${sl2.max - sl2.used}`, 'drain']); render(); }
      if (s.conc) setConc(s.name, s.buff ? [s.buff] : []);
      toast(`<div class="t1">${esc(s.name)}</div><div class="t2">${s.desc ? interp(s.desc, R).slice(0, 220) : ''}</div>`, 3000);
    };
    apply();
  };
  if (!s.lvl) return finish(null, 0);
  const opts = c.slots.map((sl, i) => ({ sl, i })).filter(o => o.sl.lvl >= s.lvl);
  modal(`<h2>Cast ${esc(s.name)}</h2><p class="muted">${ord(s.lvl)}-level spell${s.conc ? ' · Concentration' : ''}${s.ritual ? ' · can be a Ritual (+10 min, no slot)' : ''}</p>
    <div class="btnrow">${opts.map(o => `<button class="btn ${o.sl.max - o.sl.used > 0 ? 'pri' : ''}" data-slot="${o.i}" ${o.sl.max - o.sl.used > 0 ? '' : 'disabled'}>${o.sl.label ? esc(o.sl.label) + ' ' : ''}${ord(o.sl.lvl)} slot (${o.sl.max - o.sl.used} left)</button>`).join('') || '<span class="empty">No slots of this level.</span>'}</div>
    <div class="btnrow"><button class="btn" data-free="1">${s.ritual ? 'Cast as Ritual' : 'Cast without a slot'}</button><button class="btn" data-x2="1">Cancel</button></div>`, sh => sh.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.x2) return closeModal();
    if (b.dataset.free) { closeModal(); return finish(null, s.lvl); }
    if (b.dataset.slot != null) { closeModal(); const i = +b.dataset.slot; finish(i, c.slots[i].lvl); }
  }));
}

/* ---------- rests ---------- */
function shortRest() {
  const c = C();
  modal(`<h2>Short Rest</h2><p class="muted">Spend Hit Dice to heal (each die + CON ${sgn(R.mods.con)}). Then finish the rest to recover short-rest resources and pact slots.</p>
    <div id="hdl">${c.hitDice.map((h, i) => `<div class="res"><div class="nm"><b>d${h.die}</b> ${esc(h.cls)}<small>${h.max - h.used} left</small></div><button class="btn sm" data-hd="${i}" ${h.used >= h.max ? 'disabled' : ''}>Roll d${h.die}</button></div>`).join('')}</div>
    <div class="btnrow"><button class="btn" data-x2="1">Close</button><button class="btn pri" data-fin="1">Finish Short Rest</button></div>`, sh => sh.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.x2) closeModal();
    if (b.dataset.hd != null) { spendHD(+b.dataset.hd); closeModal(); shortRest(); }
    if (b.dataset.fin) { closeModal(); commit('Short Rest', c => { c.slots.forEach(s => { if (s.rest === 'short') s.used = 0; }); c.resources.forEach(r => { if (r.rest === 'short') r.cur = r.max; else if (r.shortRegain) r.cur = Math.min(r.max, r.cur + r.shortRegain); }); }); toast('<div class="t1">Short Rest complete</div><div class="t2">Short-rest resources and pact slots restored.</div>'); }
  }));
}
function spendHD(i) {
  const c = C(), h = c.hitDice[i]; if (!h || h.used >= h.max) return;
  const r = 1 + Math.floor(Math.random() * h.die), heal = Math.max(1, r + R.mods.con);
  commit(`Spent d${h.die} Hit Die: healed ${heal} (rolled ${r})`, c => { c.hitDice[i].used++; c.hp.cur = Math.min(R.stats.hpmax.v, c.hp.cur + heal); });
  toast(`<div class="t2">d${h.die} ${r} ${sgn(R.mods.con)}</div><div class="big">+${heal}</div><div class="t2">Rolled ${r}. Using physical dice? Undo and use Heal instead.</div>`);
}
function longRest() {
  const c = C(), is24 = c.ruleset === '2024';
  modal(`<h2>Take a Long Rest?</h2><p>This restores HP to ${R.stats.hpmax.v}, all spell slots and resources, ${is24 ? 'all' : 'half your'} Hit Dice, rolls dawn recharges, clears temp HP, buffs and concentration, and lowers Exhaustion by 1.</p><p class="muted">Clicked by accident later? Undo brings everything back.</p>
    <div class="btnrow"><button class="btn" data-x2="1">Not yet</button><button class="btn pri" data-go="1">Take Long Rest</button></div>`, sh => sh.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; if (b.dataset.x2) closeModal();
    if (b.dataset.go) {
      closeModal(); const dawn = [];
      commit('Long Rest', c => {
        c.hp.cur = R.stats.hpmax.v; c.hp.temp = 0; c.death = { s: 0, f: 0 };
        c.hitDice.forEach(h => { h.used = is24 ? 0 : Math.max(0, h.used - Math.max(1, Math.floor(h.max / 2))); });
        c.slots.forEach(s => s.used = 0);
        c.resources.forEach(r => { if (r.rest === 'dawn' && r.regain) { const g = rollDice(r.regain, R.ctx).total; r.cur = Math.min(r.max, r.cur + g); dawn.push(r.name + ' +' + g); } else if (r.rest !== 'none') r.cur = r.max; });
        c.exhaustion = Math.max(0, c.exhaustion - 1); c.active = {}; c.conc = null; c.concBuffs = [];
        c.turn = { action: 0, bonus: 0, reaction: 0, extra: 0, move: 0, round: 1, dash: false };
      });
      toast('<div class="t1">Long Rest complete</div><div class="t2">' + (dawn.length ? 'Dawn: ' + esc(dawn.join(', ')) : 'Fully restored.') + '</div>', 3200);
    }
  }));
}

/* ---------- forms ---------- */
const buffOpts = () => [['', '—']].concat(Object.keys(BUFFS).map(k => [k, BUFFS[k].label]));
const resOpts = () => [['', '—']].concat(C().resources.map(r => [r.id, r.name]));
const FORMS = {
  spell: () => [['name', 'Name', 'text'], ['lvl', 'Level (0 = cantrip)', 'number'], ['school', 'School', 'text'], ['time', 'Casting time', 'select', [['action', 'Action'], ['bonus', 'Bonus Action'], ['reaction', 'Reaction'], ['free', 'Other / longer']]], ['range', 'Range', 'text'], ['area', 'Area shape', 'select', [['', 'None'], ['sphere', 'Sphere / Emanation'], ['cone', 'Cone'], ['line', 'Line'], ['cube', 'Cube']]], ['comp', 'Components', 'text'], ['dur', 'Duration', 'text'], ['conc', 'Concentration', 'check'], ['ritual', 'Ritual', 'check'], ['buff', 'Turns on a buff', 'select', buffOpts()], ['temp', 'Temp HP formula (SL = slot level)', 'text'], ['desc', 'Rules text. {{dc}}, {{atk}} and {{mod}} fill in live.', 'textarea']],
  attack: () => [['name', 'Name', 'text'], ['ability', 'Ability', 'select', [['str', 'STR'], ['dex', 'DEX'], ['finesse', 'Finesse (best of STR/DEX)'], ['int', 'INT'], ['wis', 'WIS'], ['cha', 'CHA']]], ['dmg', 'Damage dice', 'text'], ['type', 'Damage type', 'text'], ['magic', 'Magic bonus', 'number'], ['props', 'Properties', 'text'], ['mastery', 'Weapon Mastery (2024)', 'text'], ['prof', 'Proficient', 'check'], ['melee', 'Melee', 'check'], ['ranged', 'Ranged', 'check'], ['heavy', 'Heavy', 'check'], ['spellAtk', 'Uses spell attack', 'check'], ['addMod', 'Add ability mod to damage (spell)', 'check']],
  feature: () => [['name', 'Name', 'text'], ['time', 'Used as', 'select', [['action', 'Action'], ['bonus', 'Bonus Action'], ['reaction', 'Reaction'], ['free', 'Free / passive']]], ['res', 'Spends resource', 'select', resOpts()], ['buff', 'Toggles buff', 'select', buffOpts()], ['heal', 'Heals (e.g. 1d10+2)', 'text'], ['temp', 'Temp HP formula (CHA+LVL, PB)', 'text'], ['extraAction', 'Grants an extra action', 'check'], ['desc', 'Description', 'textarea']],
  resource: () => [['name', 'Name', 'text'], ['max', 'Maximum', 'number'], ['cur', 'Current', 'number'], ['rest', 'Recharges', 'select', [['short', 'Short Rest'], ['long', 'Long Rest'], ['dawn', 'At dawn (rolled)'], ['none', 'Never']]], ['regain', 'Dawn regain dice (e.g. 1d3)', 'text'], ['shortRegain', 'Regain on Short Rest (partial)', 'number'], ['note', 'Note', 'text']],
  summon: () => [['name', 'Name', 'text'], ['max', 'Max HP', 'number'], ['hp', 'Current HP', 'number'], ['ac', 'AC', 'number'], ['note', 'Note / attacks', 'text'], ['absorb', 'Wild Shape style form: damage hits this first, overflow to me', 'check']],
  item: () => [['name', 'Name', 'text'], ['qty', 'Quantity', 'number'], ['ac', 'AC bonus', 'number'], ['saves', 'Save bonus', 'number'], ['equipped', 'Equipped', 'check'], ['attune', 'Requires attunement', 'check'], ['desc', 'Description', 'textarea']],
  set: () => [['name', 'Set name', 'text'], ['shield', 'Includes a shield (+2 AC)', 'check'], ['attacks', 'Attacks in this set', 'multi', C().attacks.map(a => [a.id, a.name])]]
};
const LISTS = { spell: 'spells', attack: 'attacks', feature: 'features', resource: 'resources', summon: 'summons', item: 'items' };
function fieldHTML([k, label, type, opts], v) {
  const id = 'f_' + k;
  if (type === 'check') return `<label class="ck"><input type="checkbox" id="${id}" name="${k}" ${v ? 'checked' : ''}>${label}</label>`;
  if (type === 'select') return `<label>${label}<select class="field" id="${id}" name="${k}">${opts.map(([a, b]) => `<option value="${esc(a)}" ${String(v ?? '') === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></label>`;
  if (type === 'textarea') return `<label class="full">${label}<textarea class="field" id="${id}" name="${k}">${esc(v || '')}</textarea></label>`;
  if (type === 'multi') return `<fieldset class="full" style="border:0;padding:0;margin:0"><legend class="lbl">${label}</legend><div class="chips">${opts.map(([a, b]) => `<label class="chip"><input type="checkbox" name="${k}" value="${esc(a)}" ${(v || []).includes(a) ? 'checked' : ''}> ${esc(b)}</label>`).join('')}</div></fieldset>`;
  return `<label class="${type === 'text' && k === 'name' ? 'full' : ''}">${label}<input class="field" id="${id}" name="${k}" type="${type === 'number' ? 'number' : 'text'}" ${type === 'number' ? 'inputmode="numeric"' : ''} value="${esc(v ?? '')}"></label>`;
}
function readForm(sh, fields) {
  const o = {};
  fields.forEach(([k, , type]) => {
    if (type === 'multi') o[k] = [...sh.querySelectorAll(`input[name="${k}"]:checked`)].map(i => i.value);
    else { const el = sh.querySelector(`[name="${k}"]`); if (!el) return; o[k] = type === 'check' ? el.checked : type === 'number' ? (el.value === '' ? 0 : +el.value) : el.value; }
  });
  return o;
}
function openForm(title, fields, vals, onSave, onDelete) {
  modal(`<h2>${esc(title)}</h2><form class="form" id="frm">${fields.map(f => fieldHTML(f, vals[f[0]])).join('')}</form>
    <div class="btnrow">${onDelete ? '<button class="btn dng" data-del="1">Delete</button>' : ''}<span style="flex:1"></span><button class="btn" data-x2="1">Cancel</button><button class="btn pri" data-save="1">Save</button></div>`, sh => {
    sh.querySelector('#frm').addEventListener('submit', e => e.preventDefault());
    sh.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.x2) closeModal();
      if (b.dataset.save) { const o = readForm(sh, fields); closeModal(); onSave(o); }
      if (b.dataset.del) { if (b.dataset.armed) { closeModal(); onDelete(); } else { b.dataset.armed = 1; b.textContent = 'Tap again to delete'; b.classList.add('arm'); } }
    });
  });
}
function addOrEdit(kind, id) {
  const c = C();
  if (kind === 'set') {
    const i = id == null ? null : +id, cur = i == null ? { name: 'New set', attacks: [], shield: false } : c.sets[i];
    return openForm(i == null ? 'New weapon set' : 'Edit weapon set', FORMS.set(), cur, o => commit((i == null ? 'Added' : 'Edited') + ' weapon set ' + o.name, c => { if (i == null) { c.sets.push(o); c.activeSet = c.sets.length - 1; } else Object.assign(c.sets[i], o); }), i == null || c.sets.length < 2 ? null : () => commit('Removed weapon set', c => { c.sets.splice(i, 1); c.activeSet = 0; }));
  }
  const list = LISTS[kind], cur = id ? c[list].find(x => x.id === id) : { name: '', lvl: 1, time: kind === 'spell' ? 'action' : 'free', max: 1, cur: 1, rest: 'long', qty: 1, hp: 10, ac: 10, ability: 'str', prof: true, melee: true, dmg: '1d6', equipped: true };
  if (kind === 'summon' && !id) cur.max = 10;
  openForm((id ? 'Edit ' : 'Add ') + kind, FORMS[kind](), cur, o => commit((id ? 'Edited ' : 'Added ') + kind + ' ' + o.name, c => {
    if (id) Object.assign(c[list].find(x => x.id === id), o);
    else { o.id = uid(kind[0]); c[list].push(o); if (kind === 'attack' && c.sets[c.activeSet]) c.sets[c.activeSet].attacks.push(o.id); }
  }), id ? () => commit('Removed ' + kind + ' ' + cur.name, c => { c[list] = c[list].filter(x => x.id !== id); if (kind === 'attack') c.sets.forEach(s => s.attacks = s.attacks.filter(a => a !== id)); }) : null);
}
function coreForm(which) {
  const c = C();
  if (which === 'abil') return openForm('Ability scores', ABIL.map(a => [a, ABN[a], 'number']), c.abilities, o => commit('Edited ability scores', c => ABIL.forEach(a => c.abilities[a] = +o[a] || 10)));
  if (which === 'slots') {
    const f = []; for (let l = 1; l <= 9; l++) f.push(['s' + l, ord(l) + '-level slots', 'number']); f.push(['pl', 'Pact slot level', 'number'], ['pm', 'Pact slots', 'number']);
    const v = {}; c.slots.forEach(s => { if (s.label === 'Pact') { v.pl = s.lvl; v.pm = s.max; } else v['s' + s.lvl] = s.max; });
    return openForm('Spell slots', f, v, o => commit('Edited spell slots', c => { const ns = []; for (let l = 1; l <= 9; l++) if (+o['s' + l]) { const old = c.slots.find(s => s.lvl === l && !s.label); ns.push({ lvl: l, max: +o['s' + l], used: Math.min(old ? old.used : 0, +o['s' + l]), rest: 'long' }); } if (+o.pm) ns.push({ lvl: +o.pl || 1, max: +o.pm, used: 0, label: 'Pact', rest: 'short' }); c.slots = ns; }));
  }
  if (which === 'buffs') return openForm('Buff tray', [['buffs', 'Show these toggles', 'multi', Object.keys(BUFFS).map(k => [k, BUFFS[k].label])]], { buffs: c.buffs }, o => commit('Edited buff tray', c => c.buffs = o.buffs));
  // identity / core
  const v = { name: c.name, species: c.species, portrait: c.portrait, classes: c.classes.map(k => `${k.name} ${k.lvl} d${k.hd}${k.sub ? ' ' + k.sub : ''}`).join('; '), ruleset: c.ruleset, skin: c.skin, speed: c.speed, hpmax: c.hp.max, actype: c.ac.type, acname: c.ac.name, acbase: c.ac.base, dexcap: c.ac.dexCap >= 99 ? '' : c.ac.dexCap, acadds: (c.ac.adds || []).join(','), acmisc: c.ac.misc, init: c.initMisc, cast: c.casting ? c.casting.ability : '', attune: c.attuneMax || 3 };
  openForm('Core details', [['name', 'Name', 'text'], ['species', 'Species', 'text'], ['portrait', 'Sigil letter', 'text'], ['classes', 'Classes: "Name Level dDie Subclass", split with ;', 'text'], ['ruleset', 'Rules', 'select', [['2024', '2024 (SRD 5.2.1)'], ['2014', '2014 (SRD 5.1)']]], ['skin', 'Theme', 'select', SKINS], ['hpmax', 'Max HP', 'number'], ['speed', 'Speed', 'number'], ['acname', 'Armor name', 'text'], ['acbase', 'Armor base AC', 'number'], ['dexcap', 'DEX cap (blank = none)', 'text'], ['acadds', 'Extra AC abilities (e.g. con)', 'text'], ['acmisc', 'Misc AC', 'number'], ['init', 'Initiative bonus', 'number'], ['cast', 'Spellcasting ability', 'select', [['', 'None']].concat(ABIL.map(a => [a, ABN[a]]))], ['attune', 'Attunement slots', 'number']], v, o => commit('Edited core details', c => {
    c.name = o.name || c.name; c.species = o.species; c.portrait = (o.portrait || o.name[0] || '?').slice(0, 2); c.ruleset = o.ruleset; c.skin = o.skin; c.speed = +o.speed || 30;
    c.hp.max = +o.hpmax || c.hp.max; c.hp.cur = Math.min(c.hp.cur, c.hp.max);
    const ks = o.classes.split(';').map(s => s.trim()).filter(Boolean).map(s => { const m = s.match(/^(.+?)\s+(\d+)(?:\s+d(\d+))?(?:\s+(.*))?$/); return m ? { name: m[1], lvl: +m[2], hd: +(m[3] || 8), sub: m[4] || '' } : null; }).filter(Boolean);
    if (ks.length) { c.classes = ks; c.hitDice = ks.map(k => { const old = c.hitDice.find(h => h.cls === k.name); return { cls: k.name, die: k.hd, max: k.lvl, used: Math.min(old ? old.used : 0, k.lvl) }; }); }
    c.ac = { type: o.acadds ? 'unarmored' : 'armor', name: o.acname, base: +o.acbase || 10, dexCap: o.dexcap === '' ? 99 : +o.dexcap, adds: o.acadds.split(/[ ,]+/).map(s => s.trim().toLowerCase()).filter(s => ABIL.includes(s)), misc: +o.acmisc || 0 };
    c.initMisc = +o.init || 0; c.casting = o.cast ? { ability: o.cast } : null; c.attuneMax = +o.attune || 3;
  }));
}
const SKINS = [['ember', 'Ember (Warlock, Sorcerer)'], ['arcane', 'Parchment & ink (Wizard)'], ['steel', 'Brushed steel (Fighter, Barbarian)'], ['verdant', 'Verdant (Druid, Ranger)'], ['radiant', 'Radiant (Cleric, Paladin)']];
function overrideForm(key) {
  const st = R.stats[key]; if (!st) return; hideXray();
  const o = C().overrides[key] || { f: '', note: '' };
  modal(`<h2>Override ${esc(st.label)}</h2><p class="muted">Calculated: <b>${st.txt != null ? esc(st.txt) : st.base}</b> = ${st.parts.map(p => esc(p[0]) + ' ' + (typeof p[1] === 'number' ? sgn(p[1]) : esc(p[1]))).join(', ')}</p>
    <form class="form" id="ovf"><label class="full">Value or formula<input class="field" id="ovv" value="${esc(o.f)}" placeholder="${key.startsWith('dmg_') ? '1d8 + DEX + 2' : 'e.g. 17 or 15 + DEX + 2'}" autocomplete="off"></label>
    <label class="full">Reason (shows in the X-ray)<input class="field" id="ovn" value="${esc(o.note || '')}" placeholder="DM boon: Blessing of Protection"></label></form>
    <div class="chips">${['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA', 'PB', 'LVL', '+', '1d4', '1d6', '1d8'].map(t => `<button class="chip" data-tok="${t}">${t}</button>`).join('')}</div>
    <div id="ovp" class="muted"></div>
    <div class="btnrow"><button class="btn dng" data-clr="1">Remove override</button><span style="flex:1"></span><button class="btn" data-x2="1">Cancel</button><button class="btn pri" data-sv="1">Save</button></div>`, sh => {
    const inp = sh.querySelector('#ovv'), prev = sh.querySelector('#ovp');
    const upd = () => { const r = evalF(inp.value, R.ctx); prev.innerHTML = inp.value ? (r ? 'Result: <b>' + r.n + (r.dice.length ? ' + ' + r.dice.join(' + ') : '') + '</b>' : 'Use numbers, dice, + and −, and STR DEX CON INT WIS CHA PB LVL.') : ''; };
    inp.addEventListener('input', upd); upd();
    sh.querySelector('#ovf').addEventListener('submit', e => e.preventDefault());
    sh.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tok) { const t = b.dataset.tok; inp.value = (inp.value.trim() ? inp.value.trim() + (t === '+' ? ' ' : ' + ') : '') + (t === '+' ? '+' : t); upd(); }
      if (b.dataset.x2) closeModal();
      if (b.dataset.clr) { closeModal(); commit('Removed override on ' + st.label, c => delete c.overrides[key]); }
      if (b.dataset.sv) { const f = inp.value.trim(); if (f && !evalF(f, R.ctx)) { prev.innerHTML = '<b style="color:var(--bad)">That formula did not parse.</b> Try something like 15 + DEX + 2.'; return; } closeModal(); commit((f ? 'Override ' + st.label + ' = ' + f : 'Removed override on ' + st.label), c => { if (f) c.overrides[key] = { f, note: sh.querySelector('#ovn').value }; else delete c.overrides[key]; }); }
    });
  });
}

/* ---------- SRD lookup (works in the installed app; blocked inside the preview frame) ---------- */
function srdSearch() {
  modal(`<h2>Search the SRD</h2><p class="muted">Pulls open-licensed spells from dnd5eapi.co (SRD 5.1, CC-BY-4.0).</p><form class="form" id="srdf"><label class="full">Spell name<input class="field" id="srdq" placeholder="fireball" autocomplete="off"></label></form><div id="srdr" class="rows"></div><div class="btnrow"><button class="btn" data-x2="1">Close</button><button class="btn pri" data-go="1">Search</button></div>`, sh => {
    const go = async () => {
      const q = sh.querySelector('#srdq').value.trim(), out = sh.querySelector('#srdr'); if (!q) return;
      out.innerHTML = '<div class="empty">Searching…</div>';
      try {
        const r = await fetch('https://www.dnd5eapi.co/api/2014/spells?name=' + encodeURIComponent(q)); const j = await r.json();
        out.innerHTML = j.results.slice(0, 12).map(s => `<div class="row"><span class="nm">${esc(s.name)}</span><button class="btn sm" data-idx="${esc(s.index)}">Add</button></div>`).join('') || '<div class="empty">No matches.</div>';
      } catch (e) { out.innerHTML = '<div class="empty">Could not reach the SRD from here. This works once the app is installed from its own address; in the preview, add spells by hand.</div>'; }
    };
    sh.querySelector('#srdf').addEventListener('submit', e => { e.preventDefault(); go(); });
    sh.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.x2) closeModal(); if (b.dataset.go) go();
      if (b.dataset.idx) {
        b.textContent = '…';
        try {
          const s = await (await fetch('https://www.dnd5eapi.co/api/2014/spells/' + b.dataset.idx)).json();
          const ct = (s.casting_time || '').toLowerCase(), area = s.area_of_effect ? s.area_of_effect.type : '';
          commit('Added spell ' + s.name + ' from SRD', c => c.spells.push({ id: uid('s'), name: s.name, lvl: s.level, school: s.school && s.school.name, time: /bonus/.test(ct) ? 'bonus' : /reaction/.test(ct) ? 'reaction' : /1 action/.test(ct) ? 'action' : 'free', range: s.range, area: ['sphere', 'cone', 'line', 'cube'].includes(area) ? area : area === 'cylinder' ? 'sphere' : '', conc: s.concentration, ritual: s.ritual, comp: (s.components || []).join(', '), dur: s.duration, desc: (s.desc || []).join('\n\n') + (s.higher_level && s.higher_level.length ? '\n\nAt higher levels: ' + s.higher_level.join(' ') : '') }), { norender: false });
          b.textContent = 'Added';
        } catch (err) { b.textContent = 'Failed'; }
      }
    });
  });
}

/* ---------- menu ---------- */
function menu() {
  const c = C();
  modal(`<h2>Characters</h2><div class="rows">${DB.chars.map((k, i) => `<div class="row"><span class="sigil" style="width:38px;height:38px;font-size:18px">${esc(k.portrait || k.name[0])}</span><span class="nm"><b>${esc(k.name)}</b><div class="muted">${esc(k.classes.map(x => x.name + ' ' + x.lvl).join(' / '))}</div></span>${i === DB.cur ? '<span class="tag m">Open</span>' : `<button class="btn sm" data-sw="${i}">Open</button>`}</div>`).join('')}</div>
  <div class="btnrow"><button class="btn" data-new="1">${I.plus} New character</button><button class="btn" data-dup="1">Duplicate</button>${DB.chars.length > 1 ? '<button class="btn dng" data-delc="1">Delete this one</button>' : ''}</div>
  <h2>Table settings</h2>
  <div class="chips"><button class="chip ${DB.settings.digital ? 'on' : ''}" data-dig="1">Roll dice in the app</button><button class="chip" data-fs="-0.08">Text smaller</button><button class="chip" data-fs="0.08">Text larger</button><button class="chip ${c.ruleset === '2024' ? 'on' : ''}" data-rs="2024">2024 rules</button><button class="chip ${c.ruleset === '2014' ? 'on' : ''}" data-rs="2014">2014 rules</button></div>
  <div class="lbl">Theme</div><div class="chips">${SKINS.map(([k, n]) => `<button class="chip ${c.skin === k ? 'on' : ''}" data-skin="${k}">${n}</button>`).join('')}</div>
  <h2>Backup</h2><p class="muted" style="margin:0">Everything lives on this tablet only. Copy a backup now and then, and paste one here to restore or move a character.</p>
  <textarea class="field" id="ioj" style="min-height:110px;font-family:ui-monospace,monospace;font-size:.8em" aria-label="Character JSON"></textarea>
  <div class="btnrow"><button class="btn" data-exp="1">Show this character's backup</button><button class="btn" data-copy="1">Copy</button><button class="btn" data-dl="1">Download .json</button><button class="btn pri" data-imp="1">Import pasted backup</button></div>
  <div id="iomsg" class="muted"></div>
  <div class="btnrow"><span style="flex:1"></span><button class="btn" data-x2="1">Done</button></div>`, sh => sh.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset, ta = sh.querySelector('#ioj'), msg = sh.querySelector('#iomsg');
    if (d.x2) closeModal();
    if (d.sw != null) { DB.cur = +d.sw; save(); closeModal(); hideXray(); render(); }
    if (d.new) { DB.chars.push(blankChar()); DB.cur = DB.chars.length - 1; ui.editing = true; save(); closeModal(); render(); coreForm('identity'); }
    if (d.dup) { const n = JSON.parse(JSON.stringify(c)); n.id = uid('c'); n.name += ' (copy)'; DB.chars.push(n); DB.cur = DB.chars.length - 1; save(); closeModal(); render(); }
    if (d.delc) { if (!d.armed) { d.armed = 1; b.textContent = 'Tap again to delete ' + c.name; b.classList.add('arm'); return; } DB.chars.splice(DB.cur, 1); DB.cur = 0; save(); closeModal(); render(); }
    if (d.dig) { DB.settings.digital = !DB.settings.digital; b.classList.toggle('on'); save(); }
    if (d.fs) { DB.settings.fs = Math.min(1.4, Math.max(.8, +(DB.settings.fs + +d.fs).toFixed(2))); save(); render(); }
    if (d.rs) { commit('Switched to ' + d.rs + ' rules', c => c.ruleset = d.rs); closeModal(); menu(); }
    if (d.skin) { commit('Theme: ' + d.skin, c => c.skin = d.skin); closeModal(); menu(); }
    if (d.exp) { ta.value = JSON.stringify(c); msg.textContent = 'Backup ready. Copy it somewhere safe.'; }
    if (d.copy) { if (!ta.value) ta.value = JSON.stringify(c); const txt = ta.value; const p = navigator.clipboard && navigator.clipboard.writeText(txt); if (p) p.then(() => msg.textContent = 'Copied.').catch(() => { ta.select(); msg.textContent = 'Select-all is on; use your keyboard copy.'; }); else { ta.select(); msg.textContent = 'Text selected; copy it.'; } }
    if (d.dl) { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(c, null, 1)], { type: 'application/json' })); a.download = c.name.replace(/\W+/g, '-') + '.json'; document.body.appendChild(a); a.click(); a.remove(); msg.textContent = 'If nothing downloaded, use Copy instead (downloads only work in the installed app).'; } catch (err) { msg.textContent = 'Downloads are blocked here. Use Copy.'; } }
    if (d.imp) { try { const n = JSON.parse(ta.value); if (!n.abilities || !n.hp) throw 0; const base = blankChar(); const merged = Object.assign(base, n, { id: uid('c') }); DB.chars.push(merged); DB.cur = DB.chars.length - 1; save(); closeModal(); render(); toast('<div class="t1">Imported ' + esc(merged.name) + '</div>'); } catch (err) { msg.innerHTML = '<b style="color:var(--bad)">That is not a character backup.</b> Paste the full text from "Show this character\'s backup".'; } }
  }));
}
