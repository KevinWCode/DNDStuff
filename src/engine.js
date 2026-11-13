/* ---------- math engine: everything computed locally, every number carries its breakdown ---------- */
const mod = s => Math.floor((s - 10) / 2);
const sgn = n => (n >= 0 ? '+' : '') + n;
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const lvlOf = c => c.classes.reduce((a, k) => a + (+k.lvl || 0), 0);
const uid = p => p + Math.random().toString(36).slice(2, 8);

/* Evaluate a formula like "15 + DEX + 2", "1d8 + STR + PB" or "3+4". Returns {n, dice[]}. */
function evalF(f, ctx) {
  if (f == null) return null;
  const s = String(f).replace(/\s+/g, '').toUpperCase();
  if (!s) return null;
  const re = /([+\-*]?)(\d*D\d+|\d+|[A-Z]+)/g;
  let m, n = 0, dice = [], last = 0, ok = false, consumed = 0;
  while ((m = re.exec(s))) {
    if (m.index !== consumed) return null;
    consumed = re.lastIndex; ok = true;
    const op = m[1] || '+', t = m[2];
    if (/D\d+/.test(t)) { dice.push((op === '-' ? '-' : '') + t.toLowerCase().replace(/^d/, '1d')); continue; }
    let v;
    if (/^\d+$/.test(t)) v = +t;
    else if (ctx && t in ctx) v = ctx[t];
    else return null;
    if (op === '*') { n = n - last + last * v; last = last * v; }
    else { last = op === '-' ? -v : v; n += last; }
  }
  return ok && consumed === s.length ? { n, dice } : null;
}

function compute(c) {
  const L = lvlOf(c), ctx = { LVL: L, LEVEL: L };
  const M = {}; ABIL.forEach(a => { M[a] = mod(+c.abilities[a] || 10); ctx[a.toUpperCase()] = M[a]; });
  const R = { mods: M, lvl: L, stats: {} };
  const act = id => !!c.active[id];
  const is24 = c.ruleset === '2024';
  const items = (c.items || []).filter(i => i.equipped && (!i.attune || i.attuned));

  const mk = (key, label, parts, dice = []) => {
    const base = parts.reduce((a, p) => a + (typeof p[1] === 'number' ? p[1] : 0), 0);
    const st = { key, label, parts, base, v: base, dice: parts.filter(p => typeof p[1] === 'string').map(p => p[1]).concat(dice) };
    const o = c.overrides[key];
    if (o && o.f !== '') { const r = evalF(o.f, ctx); if (r) { st.ov = o; st.v = r.n; st.dice = r.dice; } }
    R.stats[key] = st; return st;
  };

  const pb = mk('pb', 'Proficiency Bonus', [['Level ' + L, 2 + Math.floor((L - 1) / 4)]]);
  ctx.PB = pb.v; R.pb = pb.v;
  ABIL.forEach(a => mk('abil_' + a, ABN[a] + ' modifier', [[ABN[a] + ' ' + c.abilities[a], M[a]]]));
  const exh = +c.exhaustion || 0;
  const exhPart = (is24 && exh) ? [['Exhaustion ' + exh + ' (2024)', -2 * exh]] : [];
  const blessD = act('bless') ? [['Bless', '1d4']] : [];

  ABIL.forEach(a => {
    const parts = [[ABN[a].slice(0, 3).toUpperCase() + ' mod', M[a]]];
    if (c.saves.includes(a)) parts.push(['Proficient', pb.v]);
    items.forEach(i => i.saves && parts.push([i.name, +i.saves]));
    if (act('rage') && a === 'str') parts.push(['Rage: advantage', 0]);
    if (a === 'dex') { if (act('cover2')) parts.push(['Half cover', 2]); if (act('cover5')) parts.push(['¾ cover', 5]); }
    mk('save_' + a, ABN[a] + ' save', parts.concat(exhPart, blessD));
  });
  SKILLS.forEach(([k, a, n]) => {
    const p = +c.skills[k] || 0, parts = [[a.toUpperCase() + ' mod', M[a]]];
    if (p === 1) parts.push(['Proficient', pb.v]);
    if (p === 2) parts.push(['Expertise', pb.v * 2]);
    mk('skill_' + k, n, parts.concat(exhPart));
  });
  const perc = R.stats.skill_perception;
  const pp = [['Base', 10], ['Perception', perc.v]];
  if (c.conditions.includes('Poisoned')) pp.push(['Poisoned (disadv.)', -5]);
  mk('passive', 'Passive Perception', pp);
  mk('passive_ins', 'Passive Insight', [['Base', 10], ['Insight', R.stats.skill_insight.v]]);
  mk('passive_inv', 'Passive Investigation', [['Base', 10], ['Investigation', R.stats.skill_investigation.v]]);

  // AC
  const set = (c.sets || [])[c.activeSet] || {};
  const acp = [];
  const A = c.ac || { type: 'armor', base: 10, dexCap: 99 };
  acp.push([A.name || 'Base', +A.base || 10]);
  acp.push(['DEX' + (A.dexCap < 99 ? ' (max ' + A.dexCap + ')' : ''), Math.min(M.dex, A.dexCap ?? 99)]);
  (A.adds || []).forEach(a => acp.push([a.toUpperCase() + ' (' + (A.name || '') + ')', M[a]]));
  if (set.shield) acp.push(['Shield (' + set.name + ')', 2]);
  if (+A.misc) acp.push(['Misc', +A.misc]);
  items.forEach(i => i.ac && acp.push([i.name, +i.ac]));
  ['cover2', 'cover5', 'shield', 'haste'].forEach(b => act(b) && acp.push([BUFFS[b].label, BUFFS[b].ac]));
  mk('ac', 'Armor Class', acp);

  mk('init', 'Initiative', [['DEX mod', M.dex]].concat(+c.initMisc ? [['Misc', +c.initMisc]] : [], exhPart));
  const spd = [['Base speed', +c.speed || 30]];
  if (is24 && exh) spd.push(['Exhaustion ' + exh, -5 * exh]);
  if (act('haste')) spd.push(['Haste (doubled)', +c.speed || 30]);
  if (c.conditions.some(x => ['Grappled', 'Restrained', 'Paralyzed', 'Stunned', 'Unconscious', 'Petrified'].includes(x))) spd.push(['Condition: speed 0', -spd.reduce((a, p) => a + p[1], 0)]);
  mk('speed', 'Speed', spd);
  mk('hpmax', 'Hit Point Maximum', [['Max HP', +c.hp.max]]);

  if (c.casting) {
    const ca = c.casting.ability;
    mk('dc', 'Spell Save DC', [['Base', 8], ['Proficiency', pb.v], [ca.toUpperCase() + ' mod', M[ca]]]);
    mk('spellatk', 'Spell Attack', [['Proficiency', pb.v], [ca.toUpperCase() + ' mod', M[ca]]].concat(exhPart, blessD));
    ctx.DC = R.stats.dc.v; ctx.ATK = R.stats.spellatk.v; ctx.MOD = M[ca];
  }

  // attacks
  R.attacks = (c.attacks || []).map(w => {
    const ab = w.ability === 'finesse' ? (M.str >= M.dex ? 'str' : 'dex') : w.ability;
    const hp = [], dp = [[w.dmg + ' ' + (w.type || ''), w.dmg]];
    if (w.spellAtk && c.casting) { hp.push(['Spell attack', R.stats.spellatk.base - (blessD.length ? 0 : 0)]); }
    else { hp.push([ab.toUpperCase() + ' mod', M[ab]]); if (w.prof) hp.push(['Proficient', pb.v]); hp.push(...exhPart); }
    if (+w.magic) { hp.push(['Magic', +w.magic]); dp.push(['Magic', +w.magic]); }
    if (!w.spellAtk || w.addMod) dp.push([ab.toUpperCase() + ' mod', M[ab]]);
    if (!w.spellAtk) hp.push(...blessD); else if (act('bless')) hp.push(['Bless', '1d4']);
    if (act('rage') && w.melee && ab === 'str') dp.push(['Rage', 2]);
    if (act('gwm') && w.heavy) { if (is24) dp.push(['Great Weapon Master', pb.v]); else { hp.push(['GWM', -5]); dp.push(['GWM', 10]); } }
    if (act('sharp') && w.ranged && !is24) { hp.push(['Sharpshooter', -5]); dp.push(['Sharpshooter', 10]); }
    if (act('hex')) dp.push(['Hex (necrotic)', '1d6']);
    if (act('sneak') && (w.ability === 'finesse' || w.ranged)) { const rl = (c.classes.find(k => /rogue/i.test(k.name)) || {}).lvl || 1; dp.push(['Sneak Attack', Math.ceil(rl / 2) + 'd6']); }
    const hit = mk('atk_' + w.id, w.name + ' to hit', hp);
    const dmgN = dp.reduce((a, p) => a + (typeof p[1] === 'number' ? p[1] : 0), 0);
    const dmgD = dp.filter(p => typeof p[1] === 'string').map(p => p[1]);
    const o = c.overrides['dmg_' + w.id];
    let dmgTxt = dmgD.join(' + ') + (dmgN ? ' ' + sgn(dmgN).replace(/^\+/, '+ ').replace(/^-/, '- ') : '');
    if (o && o.f) { const r = evalF(o.f, ctx); dmgTxt = r ? r.dice.join(' + ') + (r.n ? ' ' + sgn(r.n) : '') : o.f; }
    R.stats['dmg_' + w.id] = { key: 'dmg_' + w.id, label: w.name + ' damage', parts: dp, v: dmgN, dice: [], txt: dmgTxt, ov: o && o.f ? o : null };
    return { w, hit, dmgTxt, ab, inSet: (set.attacks || []).includes(w.id) };
  });
  R.ctx = ctx;
  R.resistBPS = act('rage');
  R.bloodied = c.hp.cur > 0 && c.hp.cur < R.stats.hpmax.v / 2;
  R.actionsMax = 1 + (+c.turn.extra || 0) + (act('haste') ? 1 : 0);
  return R;
}
const fmtStat = st => st ? sgn(st.v) + (st.dice && st.dice.length ? ' ' + st.dice.map(d => d.startsWith('-') ? d : '+' + d).join(' ') : '') : '';
function interp(txt, R) {
  return esc(txt).replace(/\{\{(\w+)\}\}/g, (_, k) => {
    k = k.toUpperCase();
    if (k === 'ATK') return '<b>' + sgn(R.ctx.ATK ?? 0) + '</b>';
    if (k === 'MOD') return '<b>' + (R.ctx.MOD ?? 0) + '</b>';
    return '<b>' + (R.ctx[k] ?? '?') + '</b>';
  });
}
function rollDice(expr, ctx) {
  // "2d6+3", "1d10+LVL"
  let total = 0, detail = [];
  const s = String(expr).replace(/\s+/g, '').toUpperCase();
  const re = /([+-]?)(\d*)D(\d+)|([+-]?)(\d+|[A-Z]+)/g; let m;
  while ((m = re.exec(s))) {
    if (m[3]) { const n = +(m[2] || 1), d = +m[3], sg = m[1] === '-' ? -1 : 1; for (let i = 0; i < n; i++) { const r = 1 + Math.floor(Math.random() * d); total += sg * r; detail.push(r); } }
    else { const v = /^\d+$/.test(m[5]) ? +m[5] : (ctx[m[5]] ?? 0); total += (m[4] === '-' ? -1 : 1) * v; }
  }
  return { total, detail };
}
