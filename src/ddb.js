/* ---------- D&D Beyond import (unofficial character-service v5 JSON; public characters only) ---------- */
const DDB_URL = id => 'https://character-service.dndbeyond.com/character/v5/character/' + id;
const DDB_ABIL = { 1: 'str', 2: 'dex', 3: 'con', 4: 'int', 5: 'wis', 6: 'cha' };
const DDB_ABIL_NAME = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
const DDB_SKILL = { acrobatics: 'acrobatics', 'animal-handling': 'animal', arcana: 'arcana', athletics: 'athletics', deception: 'deception', history: 'history', insight: 'insight', intimidation: 'intimidation', investigation: 'investigation', medicine: 'medicine', nature: 'nature', perception: 'perception', performance: 'performance', persuasion: 'persuasion', religion: 'religion', 'sleight-of-hand': 'sleight', stealth: 'stealth', survival: 'survival' };
const DDB_TIME = { 1: 'action', 3: 'bonus', 4: 'reaction' };
const DDB_SKINS = { warlock: 'ember', sorcerer: 'ember', wizard: 'arcane', artificer: 'arcane', fighter: 'steel', barbarian: 'steel', rogue: 'steel', monk: 'steel', druid: 'verdant', ranger: 'verdant', cleric: 'radiant', paladin: 'radiant', bard: 'radiant' };
const CASTER_ABIL = { wizard: 'int', artificer: 'int', cleric: 'wis', druid: 'wis', ranger: 'wis', monk: 'wis', bard: 'cha', paladin: 'cha', sorcerer: 'cha', warlock: 'cha' };

function ddbId(s) { const m = String(s || '').match(/(\d{5,})/); return m ? m[1] : null; }
const strip = h => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&rsquo;|&#39;/g, "'").replace(/&ldquo;|&rdquo;|&quot;/g, '"').replace(/&mdash;/g, '—').replace(/\n{3,}/g, '\n\n').trim();

function ddbToChar(raw) {
  const d = raw && raw.data ? raw.data : raw;
  if (!d || !Array.isArray(d.stats) || !Array.isArray(d.classes)) throw new Error('This does not look like D&D Beyond character data.');
  const mods = Object.values(d.modifiers || {}).flat().filter(Boolean);
  const has = (type, sub) => mods.some(m => m.type === type && m.subType === sub);
  const sum = (type, sub) => mods.filter(m => m.type === type && m.subType === sub).reduce((a, m) => a + (+(m.fixedValue ?? m.value) || 0), 0);
  const c = blankChar();
  c.id = 'ddb' + d.id; c.ddbId = d.id; c.name = d.name || 'Imported hero';
  c.species = (d.race && (d.race.fullName || d.race.baseName || d.race.baseRaceName)) || '';
  c.portrait = (c.name[0] || '?').toUpperCase();
  c.classes = d.classes.map(k => ({ name: k.definition.name, lvl: k.level, hd: k.definition.hitDice || 8, sub: (k.subclassDefinition && k.subclassDefinition.name) || '' }));
  c.hitDice = d.classes.map(k => ({ cls: k.definition.name, die: k.definition.hitDice || 8, max: k.level, used: Math.min(k.level, k.hitDiceUsed || 0) }));
  const lvl = c.classes.reduce((a, k) => a + k.lvl, 0), pb = 2 + Math.floor((lvl - 1) / 4);
  const main = d.classes.slice().sort((a, b) => (b.isStartingClass ? 1 : 0) - (a.isStartingClass ? 1 : 0) || b.level - a.level)[0];
  const mainName = main.definition.name.toLowerCase();
  c.skin = DDB_SKINS[mainName] || 'radiant';
  c.ruleset = d.classes.some(k => k.definition.isLegacy || (k.definition.sources || []).some(s => s.sourceId === 1 || s.sourceId === 2)) ? '2014' : '2024';

  // abilities: base + bonuses, or override
  ABIL.forEach((a, i) => {
    const id = i + 1, base = (d.stats.find(s => s.id === id) || {}).value || 10;
    const bonus = ((d.bonusStats || []).find(s => s.id === id) || {}).value || 0;
    const ov = ((d.overrideStats || []).find(s => s.id === id) || {}).value;
    const name = Object.keys(DDB_ABIL_NAME).find(k => DDB_ABIL_NAME[k] === a);
    const setTo = mods.filter(m => m.type === 'set' && m.subType === name + '-score').reduce((x, m) => Math.max(x, +m.value || 0), 0);
    c.abilities[a] = ov || Math.max(base + bonus + sum('bonus', name + '-score'), setTo);
  });
  const M = {}; ABIL.forEach(a => M[a] = mod(c.abilities[a]));
  c.saves = ABIL.filter(a => has('proficiency', Object.keys(DDB_ABIL_NAME).find(k => DDB_ABIL_NAME[k] === a) + '-saving-throws'));
  c.skills = {};
  Object.entries(DDB_SKILL).forEach(([slug, k]) => { if (has('expertise', slug)) c.skills[k] = 2; else if (has('proficiency', slug)) c.skills[k] = 1; });

  // hit points
  const max = d.overrideHitPoints || ((d.baseHitPoints || 0) + (d.bonusHitPoints || 0) + M.con * lvl + sum('bonus', 'hit-points-per-level') * lvl);
  c.hp = { max, cur: Math.max(0, max - (d.removedHitPoints || 0)), temp: d.temporaryHitPoints || 0 };
  c.death = { s: (d.deathSaves && d.deathSaves.successCount) || 0, f: (d.deathSaves && d.deathSaves.failCount) || 0 };
  c.speed = ((d.race && d.race.weightSpeeds && d.race.weightSpeeds.normal && d.race.weightSpeeds.normal.walk) || 30) + sum('bonus', 'speed') + sum('bonus', 'unarmored-movement');
  c.initMisc = sum('bonus', 'initiative');

  // inventory, armor, weapons
  const inv = d.inventory || [];
  const armor = inv.find(i => i.equipped && i.definition && i.definition.armorTypeId && i.definition.armorTypeId <= 3);
  const shield = inv.find(i => i.equipped && i.definition && i.definition.armorTypeId === 4);
  if (armor) { const t = armor.definition.armorTypeId; c.ac = { type: 'armor', name: armor.definition.name, base: armor.definition.armorClass || 10, dexCap: t === 1 ? 99 : t === 2 ? 2 : 0, misc: 0 }; }
  else {
    const adds = [];
    if (mainName === 'barbarian' || d.classes.some(k => /barbarian/i.test(k.definition.name))) adds.push('con');
    else if (d.classes.some(k => /monk/i.test(k.definition.name))) adds.push('wis');
    const draconic = d.classes.some(k => k.subclassDefinition && /draconic/i.test(k.subclassDefinition.name));
    c.ac = { type: adds.length ? 'unarmored' : 'armor', name: draconic ? 'Draconic Resilience' : adds.length ? 'Unarmored Defense' : 'Unarmored', base: draconic ? 13 : 10, dexCap: 99, adds, misc: 0 };
  }
  c.items = inv.map(i => {
    const df = i.definition || {}, itemMods = (df.grantedModifiers || []);
    const acb = itemMods.filter(m => m.type === 'bonus' && m.subType === 'armor-class').reduce((a, m) => a + (+m.value || 0), 0);
    const svb = itemMods.filter(m => m.type === 'bonus' && m.subType === 'saving-throws').reduce((a, m) => a + (+m.value || 0), 0);
    return { id: uid('i'), name: df.name || 'Item', qty: i.quantity || 1, equipped: !!i.equipped, attune: !!df.canAttune, attuned: !!i.isAttuned, ac: acb || 0, saves: svb || 0, desc: strip(df.snippet || df.description || '').slice(0, 400) };
  });
  c.attuneMax = 3;
  const weapons = inv.filter(i => i.definition && i.definition.damage && (i.equipped || inv.length < 12));
  c.attacks = weapons.map(i => {
    const df = i.definition, props = (df.properties || []).map(p => p.name);
    const ranged = df.attackType === 2, magic = (+((df.name || '').match(/\+(\d)/) || [])[1] || 0) || (df.grantedModifiers || []).filter(m => m.subType === 'magic').reduce((a, m) => a + (+m.value || 0), 0);
    return { id: uid('a'), name: df.name, ability: props.includes('Finesse') ? 'finesse' : ranged ? 'dex' : 'str', prof: true, magic, dmg: df.damage.diceString || '1d4', type: (df.damageType || '').toLowerCase(), props: props.join(', ') + (df.range && df.longRange ? ' ' + df.range + '/' + df.longRange : ''), mastery: (df.weaponMasteryProperty || df.masteryName || ''), melee: !ranged, ranged, heavy: props.includes('Heavy') };
  });
  c.sets = [{ name: shield ? 'Weapons & Shield' : 'Main', attacks: c.attacks.map(a => a.id), shield: !!shield }];
  if (shield && c.attacks.some(a => /two-handed/i.test(a.props))) c.sets.push({ name: 'Two-handed', attacks: c.attacks.filter(a => /two-handed/i.test(a.props) || a.ranged).map(a => a.id), shield: false }), c.sets[0].attacks = c.attacks.filter(a => !/two-handed/i.test(a.props)).map(a => a.id);
  const cur = d.currencies || {}; c.coins = { cp: cur.cp || 0, sp: cur.sp || 0, ep: cur.ep || 0, gp: cur.gp || 0, pp: cur.pp || 0 };

  // spells
  const castCls = d.classes.find(k => CASTER_ABIL[k.definition.name.toLowerCase()] && (k.definition.canCastSpells !== false));
  const ca = castCls ? CASTER_ABIL[castCls.definition.name.toLowerCase()] : (d.classes.some(k => k.subclassDefinition && /eldritch knight|arcane trickster/i.test(k.subclassDefinition.name)) ? 'int' : null);
  c.casting = ca ? { ability: ca } : null;
  const rawSpells = [].concat(...(d.classSpells || []).map(cs => cs.spells || []), ...Object.values(d.spells || {}).filter(Array.isArray));
  const seen = new Set();
  c.spells = rawSpells.filter(s => s && s.definition && (s.prepared || s.alwaysPrepared || s.definition.level === 0 || s.countsAsKnownSpell || /warlock|sorcerer|bard|ranger/.test(mainName) || !s.hasOwnProperty('prepared'))).filter(s => { const k = s.definition.name; if (seen.has(k)) return false; seen.add(k); return true; }).map(s => {
    const df = s.definition, r = df.range || {}, act = df.activation || {}, du = df.duration || {};
    const area = (r.aoeType || '').toLowerCase();
    return { id: uid('s'), name: df.name, lvl: df.level || 0, school: df.school || '', time: DDB_TIME[act.activationType] || 'free', range: r.origin === 'Ranged' ? (r.rangeValue || '') + ' ft' : (r.origin || '') + (r.aoeValue ? ' (' + r.aoeValue + '-ft ' + (r.aoeType || '') + ')' : ''), area: /sphere|cylinder|emanation/.test(area) ? 'sphere' : ['cone', 'line', 'cube'].includes(area) ? area : '', conc: !!df.concentration, ritual: !!df.ritual, comp: (df.components || []).map(n => ({ 1: 'V', 2: 'S', 3: 'M' })[n]).filter(Boolean).join(', '), dur: du.durationType === 'Instantaneous' ? 'Instant' : (du.durationType === 'Concentration' ? 'Up to ' : '') + (du.durationInterval || '') + ' ' + (du.durationUnit || '').toLowerCase(), desc: strip(df.description) };
  });
  c.slots = (d.spellSlots || []).filter(s => s.available > 0).map(s => ({ lvl: s.level, max: s.available, used: s.used || 0, rest: 'long' }))
    .concat((d.pactMagic || []).filter(s => s.available > 0).map(s => ({ lvl: s.level, max: s.available, used: s.used || 0, label: 'Pact', rest: 'short' })));
  if (!c.slots.length && ca) {
    // character-service sometimes leaves slots empty; fall back to the standard full-caster table for single-class full casters
    const full = [[2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1]];
    if (['wizard', 'cleric', 'druid', 'bard', 'sorcerer'].includes(mainName) && d.classes.length === 1) c.slots = (full[lvl - 1] || []).map((n, i) => ({ lvl: i + 1, max: n, used: 0, rest: 'long' }));
  }

  // limited-use actions -> resources + features
  c.resources = []; c.features = [];
  const acts = [].concat(...Object.values(d.actions || {}).filter(Array.isArray));
  acts.forEach(a => {
    if (!a || !a.name) return;
    const lu = a.limitedUse, f = { id: uid('f'), name: a.name, time: DDB_TIME[a.activation && a.activation.activationType] || 'free', desc: strip(a.snippet || a.description || '').slice(0, 500) };
    if (lu) {
      let maxU = lu.maxUses || 0;
      if (lu.useProficiencyBonus) maxU = pb * (lu.proficiencyBonusOperator === 2 ? 1 : 1) + (lu.maxUses || 0);
      if (lu.statModifierUsesId) maxU = Math.max(1, M[DDB_ABIL[lu.statModifierUsesId]] + (lu.maxUses || 0));
      if (maxU > 0) { const r = { id: uid('r'), name: a.name, max: maxU, cur: Math.max(0, maxU - (lu.numberUsed || 0)), rest: lu.resetType === 1 ? 'short' : lu.resetType === 3 ? 'dawn' : 'long' }; c.resources.push(r); f.res = r.id; }
    }
    if (/^rage$/i.test(a.name)) f.buff = 'rage';
    if (/action surge/i.test(a.name)) f.extraAction = true;
    if (/second wind/i.test(a.name)) f.heal = '1d10+' + ((d.classes.find(k => /fighter/i.test(k.definition.name)) || {}).level || 1);
    c.features.push(f);
  });
  inv.filter(i => i.limitedUse && i.limitedUse.maxUses).forEach(i => c.resources.push({ id: uid('r'), name: i.definition.name, max: i.limitedUse.maxUses, cur: Math.max(0, i.limitedUse.maxUses - (i.limitedUse.numberUsed || 0)), rest: i.limitedUse.resetType === 3 ? 'dawn' : i.limitedUse.resetType === 1 ? 'short' : 'long', regain: i.limitedUse.resetTypeDescription && (i.limitedUse.resetTypeDescription.match(/\d+d\d+(\s*\+\s*\d+)?/) || [])[0] ? i.limitedUse.resetTypeDescription.match(/\d+d\d+(\s*\+\s*\d+)?/)[0].replace(/\s/g, '') : '' }));
  if (d.inspiration) c.resources.push({ id: uid('r'), name: 'Heroic Inspiration', max: 1, cur: 1, rest: 'none' });

  // buffs relevant to this build
  const b = ['bless', 'cover2', 'cover5', 'dodge'];
  if (c.classes.some(k => /barbarian/i.test(k.name))) b.unshift('rage', 'reckless');
  if (c.classes.some(k => /rogue/i.test(k.name))) b.unshift('sneak');
  if (c.spells.some(s => /^hex$/i.test(s.name))) { b.push('hex'); c.spells.forEach(s => { if (/^hex$/i.test(s.name)) s.buff = 'hex'; }); }
  if (c.spells.some(s => /^shield$/i.test(s.name))) b.push('shield');
  if (c.spells.some(s => /^haste$/i.test(s.name))) b.push('haste');
  (d.feats || []).forEach(ft => { const n = ft.definition && ft.definition.name || ''; if (/great weapon master/i.test(n)) b.push('gwm'); if (/sharpshooter/i.test(n)) b.push('sharp'); c.features.push({ id: uid('f'), name: n, time: 'free', desc: strip(ft.definition.snippet || ft.definition.description || '').slice(0, 400) }); });
  c.buffs = [...new Set(b)];
  c.conditions = (d.conditions || []).map(x => CONDITIONS[(x.id || 0) - 1]).filter(Boolean);
  const n = d.notes || {}, tr = d.traits || {};
  c.notes = [n.backstory && 'Backstory:\n' + strip(n.backstory), tr.personalityTraits && 'Personality: ' + strip(tr.personalityTraits), tr.ideals && 'Ideals: ' + strip(tr.ideals), tr.bonds && 'Bonds: ' + strip(tr.bonds), tr.flaws && 'Flaws: ' + strip(tr.flaws), n.allies && 'Allies: ' + strip(n.allies), n.otherNotes && strip(n.otherNotes)].filter(Boolean).join('\n\n');
  c.log = [{ t: Date.now(), m: 'Imported from D&D Beyond (character ' + d.id + ')' }];
  return c;
}

function ddbImport() {
  modal(`<h2>Import from D&D Beyond</h2>
    <p class="muted" style="margin:0">Paste your character's link, like dndbeyond.com/characters/12345678. The character must be set to <b>Public</b> in its D&D Beyond privacy settings. This uses D&D Beyond's unofficial data feed, so it can break if they change it.</p>
    <form class="form" id="ddbf"><label class="full">Character link or ID<input class="field" id="ddbq" placeholder="https://www.dndbeyond.com/characters/12345678" autocomplete="off"></label></form>
    <div class="btnrow"><button class="btn pri" data-go="1">Import</button></div>
    <div id="ddbmsg" class="muted"></div>
    <details id="ddbman"><summary class="lbl" style="cursor:pointer;padding:8px 0">If the import is blocked: paste the data yourself</summary>
      <ol class="muted" style="margin:6px 0 10px;padding-left:20px;line-height:1.6"><li>Tap <b>Open data page</b>. A page full of text opens in a new tab.</li><li>Long-press the text, tap <b>Select all</b>, then <b>Copy</b>.</li><li>Come back here, paste it in the box, and tap <b>Import pasted data</b>.</li></ol>
      <div class="btnrow"><a class="btn" id="ddblink" href="#" target="_blank" rel="noopener">Open data page</a></div>
      <textarea class="field" id="ddbjson" style="min-height:110px;font-family:ui-monospace,monospace;font-size:.8em;margin-top:8px" placeholder="Paste the copied text here" aria-label="D&D Beyond character data"></textarea>
      <div class="btnrow" style="margin-top:8px"><button class="btn" data-paste="1">Import pasted data</button></div></details>
    <div class="btnrow"><span style="flex:1"></span><button class="btn" data-x2="1">Close</button></div>`, sh => {
    const q = sh.querySelector('#ddbq'), msg = sh.querySelector('#ddbmsg'), link = sh.querySelector('#ddblink');
    const syncLink = () => { const id = ddbId(q.value); link.href = id ? DDB_URL(id) : '#'; link.style.opacity = id ? 1 : .5; };
    q.addEventListener('input', syncLink); syncLink();
    const finish = json => {
      const c = ddbToChar(json);
      const existing = DB.chars.findIndex(k => k.ddbId && k.ddbId === c.ddbId);
      if (existing >= 0) { c.ink = DB.chars[existing].ink; c.overrides = DB.chars[existing].overrides; c.log = c.log.concat(DB.chars[existing].log || []); DB.chars[existing] = c; DB.cur = existing; }
      else { DB.chars.push(c); DB.cur = DB.chars.length - 1; }
      save(); closeModal(); render();
      toast(`<div class="t1">${existing >= 0 ? 'Updated' : 'Imported'} ${esc(c.name)}</div><div class="t2">Check HP, AC and spells against D&D Beyond. Unlock editing to fix anything.</div>`, 4500);
    };
    const go = async () => {
      const id = ddbId(q.value); if (!id) { msg.innerHTML = '<b style="color:var(--bad)">Paste a character link or the number at the end of it.</b>'; return; }
      msg.textContent = 'Fetching character ' + id + '…';
      let res;
      try { res = await fetch(DDB_URL(id), { headers: { Accept: 'application/json' } }); }
      catch (e) { sh.querySelector('#ddbman').open = true; msg.innerHTML = '<b>D&D Beyond blocked the direct import from this app.</b> Use the steps below instead; they take about 20 seconds.'; return; }
      try {
        const j = await res.json();
        if (!res.ok || j.success === false) { msg.innerHTML = '<b style="color:var(--bad)">D&D Beyond said no.</b> ' + (res.status === 403 || res.status === 404 ? 'Make sure the character is set to Public (Character settings → Privacy → Public).' : esc(j.message || 'Status ' + res.status)); return; }
        finish(j);
      } catch (e) { msg.innerHTML = '<b style="color:var(--bad)">Could not read that character.</b> ' + esc(e.message || ''); }
    };
    sh.querySelector('#ddbf').addEventListener('submit', e => { e.preventDefault(); go(); });
    sh.addEventListener('click', e => {
      const b = e.target.closest('button,a'); if (!b) return;
      if (b.id === 'ddblink' && b.getAttribute('href') === '#') { e.preventDefault(); msg.innerHTML = '<b style="color:var(--bad)">Paste your character link at the top first.</b>'; }
      if (b.dataset.x2) closeModal();
      if (b.dataset.go) go();
      if (b.dataset.paste) { try { finish(JSON.parse(sh.querySelector('#ddbjson').value)); } catch (err) { msg.innerHTML = '<b style="color:var(--bad)">That text did not import.</b> ' + esc(err instanceof SyntaxError ? 'Make sure you copied the whole page (Select all).' : err.message); } }
    });
  });
}
