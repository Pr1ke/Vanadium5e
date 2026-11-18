// Builds data/srd.json (+ data/srd.gz.txt) for Vanadium 5e from the 5e-bits SRD database.
// Usage: node tools/build-srd.mjs <path-to-5e-database/src>   (folder that contains 2014/ and 2024/, or 2014/en …)
// Source data: https://github.com/5e-bits/5e-database (MIT). Game content: SRD 5.1 (CC-BY-4.0) and SRD 5.2 (CC-BY-4.0), Wizards of the Coast.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2];
if (!ROOT) { console.error('usage: node tools/build-srd.mjs <srd-src-dir>'); process.exit(1); }
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const L = (ed, f) => {
  for (const p of [path.join(ROOT, ed, 'en', `5e-SRD-${f}.json`), path.join(ROOT, ed, `5e-SRD-${f}.json`)]) if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  return [];
};
const SUF = { 2014: '', 2024: '-24' };
const idOf = (index, ed) => index + SUF[ed];
const ED = ['2014', '2024'];

// ---------------- text helpers ----------------
const escH = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(s) {
  s = escH(s);
  s = s.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1<i>$2</i>').replace(/(^|\W)_(?!\s)(.+?)_(?!\w)/g, '$1<i>$2</i>');
  return s.replace(/\s+/g, ' ').trim();
}
const cap = s => String(s || '').replace(/^./, c => c.toUpperCase());
const titleCase = s => String(s || '').replace(/\b[a-z]/g, c => c.toUpperCase());
// markdown-ish text (string or array of strings) → Vanadium blocks
function md(src, o = {}) {
  const parts = [Array.isArray(src) ? src.filter(x => x != null).join('\n') : src];
  const out = [];
  for (const part of parts) {
    if (part == null) continue;
    const lines = String(part).replace(/\r/g, '').split('\n');
    let i = 0;
    while (i < lines.length) {
      let ln = lines[i];
      const t = ln.trim();
      if (!t) { i++; continue; }
      if (/^\|/.test(t)) { // table
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) { rows.push(lines[i].trim()); i++; }
        const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const body = rows.filter(r => !/^[\s|:-]+$/.test(r));
        const head = cells(body[0] || '');
        out.push({ t: 'table', head, rows: body.slice(1).map(r => cells(r).map(inline)) });
        continue;
      }
      let m;
      if ((m = t.match(/^(#{1,6})\s+(.*)$/))) { out.push({ t: 'h', lvl: m[1].length + (o.hshift || 0), text: m[2].replace(/\*+/g, '').trim() }); i++; continue; }
      if ((m = t.match(/^(?:[-*•]|\d+\.)\s+(.*)$/))) { out.push({ t: 'li', html: inline(m[1]) }); i++; continue; }
      out.push({ t: 'p', html: inline(t) }); i++;
    }
  }
  return out;
}
// 5e-bits 2024 magic items sometimes flatten a d100 table into a paragraph: leave as-is.
const firstText = blocks => (blocks.find(b => b.t === 'p') || {}).html || '';

// ---------------- conditions / skills / misc ----------------
const out = { meta: { built: new Date().toISOString().slice(0, 10), sources: { '2014': 'SRD 5.1', '2024': 'SRD 5.2' } } };
const simple = (f, map) => ED.flatMap(ed => L(ed, f).map(x => ({ id: idOf(x.index, ed), name: x.name, ed, ...(map ? map(x, ed) : {}), body: md(x.desc ?? x.description ?? '') })));
out.conditions = simple('Conditions');
out.skills = simple('Skills', x => ({ ability: x.ability_score?.name }));
out.damage = simple('Damage-Types');
out.languages = simple('Languages', x => ({ type: x.type, script: x.script || '', speakers: (x.typical_speakers || []).join(', ') }));
out.properties = [
  ...simple('Weapon-Properties', () => ({ kind: 'Weapon property' })),
  ...L('2024', 'Weapon-Mastery-Properties').map(x => ({ id: idOf(x.index, '2024') + '-mastery', name: x.name, ed: '2024', kind: 'Weapon mastery', body: md(x.description) }))
];
out.poisons = L('2024', 'Poisons').map(x => ({ id: idOf(x.index, '2024'), name: x.name, ed: '2024', type: cap(x.type), cost: x.cost + ' gp', body: md(x.description) }));

// ---------------- spells ----------------
const SCH = s => s?.name || s;
out.spells = ED.flatMap(ed => L(ed, 'Spells').map(s => {
  const body = md(s.desc ?? s.description);
  const higher = s.higher_level ? md(s.higher_level) : [];
  if (higher.length) { higher[0] = { ...higher[0], html: '<b><i>' + (ed === '2024' ? 'Using a Higher-Level Spell Slot.' : 'At Higher Levels.') + '</i></b> ' + higher[0].html }; }
  if (ed === '2024') { // 2024 inlines higher level text in description sometimes as "_**Using a Higher-Level Spell Slot.**_"
    body.forEach(b => { if (b.html) b.html = b.html.replace(/<i><b>(.+?)<\/b><\/i>/g, '<b><i>$1</i></b>'); });
  }
  const comp = (s.components || []).join(', ') + (s.material ? ` (${s.material.replace(/\.$/, '')})` : '');
  return {
    id: idOf(s.index, ed), name: s.name, ed, level: s.level, school: SCH(s.school), time: cap(s.casting_time), range: String(s.range || '').replace(/\s*Component.*$/i, ''), comp, compS: (s.components || []).join(''),
    dur: cap(s.duration), conc: !!s.concentration, ritual: !!s.ritual,
    classes: (s.classes || []).map(c => c.name), subclasses: (s.subclasses || []).map(c => c.name),
    dmg: uniqArr((s.damage?.damage_type ? [s.damage.damage_type.name] : [])), save: s.dc?.dc_type?.name || '', attack: s.attack_type || '',
    area: s.area_of_effect ? `${s.area_of_effect.size}-ft. ${s.area_of_effect.type}` : '',
    body: [...body, ...higher]
  };
}));
function uniqArr(a) { return [...new Set(a.filter(Boolean))]; }
const SPELLID = {}; for (const s of out.spells) SPELLID[s.ed + ':' + s.name.toLowerCase()] = s.id;

// ---------------- monsters ----------------
const ABS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const SAB = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'];
const mod = n => Math.floor((n - 10) / 2);
const sgn = n => (n >= 0 ? '+' : '−') + Math.abs(n);
const crStr = c => c === 0.125 ? '1/8' : c === 0.25 ? '1/4' : c === 0.5 ? '1/2' : String(c);
function usageTag(u) {
  if (!u) return '';
  if (u.type === 'per day') return ` (${u.times}/Day${u.times_in_lair ? `, or ${u.times_in_lair}/Day in Lair` : ''})`;
  if (u.type === 'recharge on roll') return ` (Recharge ${u.min_value === 6 ? '6' : u.min_value + '–6'})`;
  if (u.type === 'recharge after rest') return ` (Recharges after a ${(u.rest_types || []).map(cap).join(' or ')} Rest)`;
  if (u.type === 'at will') return '';
  if (u.type === 'per turn') return '';
  return '';
}
function linkSpells(html, ed, names) {
  for (const n of names.sort((a, b) => b.length - a.length)) {
    const id = SPELLID[ed + ':' + n.toLowerCase()]; if (!id) continue;
    const re = new RegExp('(^|[^\\w>-])(' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\w<])', 'i');
    html = html.replace(re, (m0, a, b) => `${a}<a class="lnk" data-go="spells--${id}">${b}</a>`);
  }
  return html;
}
function monItems(list, ed) {
  return (list || []).map(a => {
    let html = md(a.desc || '').map(b => b.t === 'li' ? '<span class="mli">• ' + b.html + '</span>' : b.html).join('<br>');
    const sc = a.spellcasting;
    if (sc && sc.spells) {
      const names = sc.spells.map(s => s.name);
      if (ed === '2024' && /:\s*$/.test(a.desc || '')) {
        const groups = {};
        for (const s of sc.spells) { const u = s.usage || { type: 'at will' }; const k = u.type === 'at will' ? 'At Will' : u.type === 'per day' ? `${u.times}/Day Each` : cap(u.type); (groups[k] = groups[k] || []).push(s.name + (s.notes ? ` (${s.notes})` : '')); }
        html += Object.entries(groups).map(([k, v]) => `<br><span class="mli"><b>${escH(k)}:</b> ${v.map(escH).join(', ')}</span>`).join('');
      }
      html = linkSpells(html, ed, names);
    }
    return { n: a.name + usageTag(a.usage), h: html };
  });
}
out.monsters = ED.flatMap(ed => L(ed, 'Monsters').map(m => {
  const ab = ABS.map(k => m[k]);
  const saves = {}, skills = [];
  for (const p of m.proficiencies || []) {
    const n = p.proficiency.name;
    if (/^Saving Throw: /.test(n)) saves[n.slice(14, 17).replace(/^(.)(..)$/, (x, a, b) => a + b.toLowerCase())] = p.value;
    else if (/^Skill: /.test(n)) skills.push(n.slice(7) + ' ' + sgn(p.value));
  }
  const acs = (m.armor_class || []).map(a => {
    const note = a.armor ? a.armor.map(x => x.name.toLowerCase()).join(', ') : a.type && a.type !== 'dex' ? a.type + (a.type === 'natural' ? ' armor' : '') : a.desc || '';
    const extra = a.condition ? ` (${a.condition.name || a.desc})` : a.spell ? ` (with ${a.spell.name})` : '';
    return a.value + (note && note !== 'dex' ? ` (${note})` : '') + extra;
  });
  const sp = m.speed || {};
  const speed = Object.entries(sp).filter(([k]) => k !== 'hover').map(([k, v]) => k === 'walk' ? v : `${k} ${v}`).join(', ') + (sp.hover ? ' (hover)' : '');
  const se = m.senses || {};
  const senses = Object.entries(se).filter(([k]) => k !== 'passive_perception').map(([k, v]) => `${k} ${v}`).concat(se.passive_perception != null ? [`passive Perception ${se.passive_perception}`] : []).join(', ');
  const ci = (m.condition_immunities || []).map(c => c.name || c);
  const type = cap(m.type) + (m.subtype ? ` (${m.subtype})` : '');
  const allItems = [...(m.special_abilities || []), ...(m.actions || []), ...(m.legendary_actions || []), ...(m.reactions || []), ...(m.bonus_actions || [])];
  const lr = (m.special_abilities || []).find(x => /^Legendary Resistance/.test(x.name));
  const legN = (m.legendary_actions || []).length ? (ed === '2024' ? ((m.legendary_actions_uses) || 3) : 3) : 0;
  const pb = m.proficiency_bonus || 2;
  return {
    id: idOf(m.index, ed), name: m.name, ed, size: m.size, type, tkey: cap(m.type.replace(/^swarm.*/i, 'swarm')), align: cap(m.alignment || ''),
    ac: acs.join(', ') || '—', acN: (m.armor_class || [])[0]?.value ?? 10,
    hp: `${m.hit_points} (${(m.hit_points_roll || m.hit_dice || '').replace(/\s+/g, ' ')})`, hpN: m.hit_points, hpRoll: (m.hit_points_roll || m.hit_dice || '').replace(/\s+/g, ''),
    speed, ab, saves, skills: skills.join(', '), pb,
    vuln: (m.damage_vulnerabilities || []).map(cap).join(', '), res: (m.damage_resistances || []).map(cap).join(', '),
    imm: (m.damage_immunities || []).map(cap).join(', '), cimm: ci.join(', '), senses, pp: se.passive_perception ?? 10 + mod(m.wisdom),
    lang: m.languages || '—', cr: crStr(m.challenge_rating), crN: m.challenge_rating, xp: m.xp || 0, xpLair: m.xp_in_lair || 0,
    init: mod(m.dexterity), gear: m.gear || '',
    traits: monItems(m.special_abilities, ed), actions: monItems(m.actions, ed), bonus: monItems(m.bonus_actions, ed),
    reactions: monItems(m.reactions, ed), legendary: monItems(m.legendary_actions, ed), legN,
    legendaryRes: lr ? (lr.usage?.times || 3) : 0,
    spellcaster: allItems.some(x => x.spellcasting), desc: m.desc ? md(m.desc) : [],
    dmgTypes: uniqArr(allItems.flatMap(x => (x.damage || []).map(d => d.damage_type?.name)))
  };
}));

// ---------------- equipment ----------------
const costS = c => c ? `${c.quantity} ${c.unit}` : '—';
const costN = c => !c ? 0 : c.quantity * ({ cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 }[c.unit] || 1);
out.items = ED.flatMap(ed => L(ed, 'Equipment').map(e => {
  const cats = ed === '2014' ? [e.equipment_category?.name] : (e.equipment_categories || []).map(c => c.name);
  let cat = ed === '2014' ? e.equipment_category?.name : null, sub = '';
  if (ed === '2014') {
    sub = e.category_range || (e.armor_category ? e.armor_category + ' Armor' : '') || e.gear_category?.name || e.tool_category || e.vehicle_category || '';
    if (cat === 'Weapon') cat = 'Weapon';
  } else {
    if (cats.includes('Weapons')) { cat = 'Weapon'; sub = cats.find(c => /^(Simple|Martial) (Melee|Ranged)/.test(c)) || ''; sub = sub.replace(/ Weapons$/, ''); }
    else if (cats.includes('Armor') || cats.includes('Shields')) { cat = 'Armor'; sub = cats.find(c => /Light|Medium|Heavy|Shield/.test(c)) || ''; }
    else if (cats.some(c => /Tools|Instruments|Gaming Sets/.test(c))) { cat = 'Tools'; sub = cats.find(c => c !== 'Tools') || 'Other Tools'; }
    else if (cats.some(c => /Mounts|Vehicles/.test(c))) { cat = 'Mounts and Vehicles'; sub = cats[0]; }
    else { cat = 'Adventuring Gear'; sub = cats.find(c => c !== 'Adventuring Gear') || 'Standard Gear'; }
  }
  if (/^Armor$/.test(cat) && /Shield/.test(sub)) sub = 'Shield';
  const props = (e.properties || []).map(p => p.name);
  const r = {
    id: idOf(e.index, ed), name: e.name, ed, cat, sub, cost: costS(e.cost), costN: costN(e.cost), weight: e.weight != null ? e.weight + ' lb.' : '—', weightN: e.weight || 0,
    body: md(e.desc ?? e.description ?? '')
  };
  if (e.damage) { r.dmg = `${e.damage.damage_dice} ${e.damage.damage_type?.name?.toLowerCase() || ''}`.trim(); }
  if (e.two_handed_damage) r.dmg2 = e.two_handed_damage.damage_dice;
  if (props.length) r.props = props;
  if (e.range && (e.throw_range || e.range.long)) r.range = e.range.long ? `${e.range.normal}/${e.range.long} ft.` : '';
  if (e.throw_range) r.range = `${e.throw_range.normal}/${e.throw_range.long} ft.`;
  if (e.mastery) r.mastery = e.mastery.name;
  if (e.armor_class) { const a = e.armor_class; r.acS = /Shield/.test(sub) ? '+' + a.base : a.base + (a.dex_bonus ? (a.max_bonus ? ` + Dex (max ${a.max_bonus})` : ' + Dex') : ''); }
  if (e.str_minimum) r.strMin = e.str_minimum;
  if (e.stealth_disadvantage) r.stealth = 'Disadvantage';
  if (e.speed) r.speedS = `${e.speed.quantity} ${e.speed.unit}`;
  if (e.capacity) r.capacity = e.capacity;
  if (e.contents?.length) r.contents = e.contents.map(c => (c.quantity > 1 ? c.quantity + ' × ' : '') + c.item.name);
  if (e.don_time) r.don = `${e.don_time} / ${e.doff_time}`;
  return r;
}));
// magic items
const RAR = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact', 'Varies'];
out.magic = ED.flatMap(ed => L(ed, 'Magic-Items').filter(x => !x.variant).map(x => {
  let lines = ed === '2014' ? [...(x.desc || [])] : String(x.desc || '').split(/\n/).map(s => s.trim()).filter(Boolean);
  let typeLine = lines.shift() || '';
  const attune = ed === '2014' ? /requires attunement/i.test(typeLine) : !!x.attunement || /requires attunement/i.test(typeLine);
  const attuneBy = (typeLine.match(/requires attunement( by [^)]+)?/i) || [])[1] || '';
  return {
    id: idOf(x.index, ed), name: x.name, ed, cat: x.equipment_category?.name || '', rarity: titleCase(x.rarity?.name || ''), attune, attuneBy: attuneBy.trim(),
    typeLine: typeLine.replace(/\s+/g, ' ').trim(), variants: (x.variants || []).map(v => v.name), body: md(lines)
  };
}));

// ---------------- feats & backgrounds ----------------
out.feats = ED.flatMap(ed => L(ed, 'Feats').map(f => {
  let pre = '';
  if (Array.isArray(f.prerequisites)) pre = f.prerequisites.map(p => p.ability_score ? `${p.ability_score.name} ${p.minimum_score}+` : p.level ? `Level ${p.level}+` : p.feature_named || '').filter(Boolean).join(', ');
  else if (f.prerequisites) pre = [f.prerequisites.minimum_level ? `Level ${f.prerequisites.minimum_level}+` : '', f.prerequisites.feature_named ? f.prerequisites.feature_named + ' Feature' : ''].filter(Boolean).join(', ');
  const type = f.type ? titleCase(f.type.replace(/-/g, ' ')) : 'General';
  return { id: idOf(f.index, ed), name: f.name, ed, type, pre, body: md(f.desc ?? f.description) };
}));
out.backgrounds = ED.flatMap(ed => L(ed, 'Backgrounds').map(b => {
  const body = [];
  const profs = (b.starting_proficiencies || b.proficiencies || []).map(p => p.name.replace(/^(Skill|Tool): /, ''));
  if (b.ability_scores) body.push({ t: 'p', html: `<b>Ability Scores:</b> ${b.ability_scores.map(a => ({ STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' }[a.name])).join(', ')}` });
  if (b.feat) body.push({ t: 'p', html: `<b>Feat:</b> <a class="lnk" data-go="feats--${idOf(b.feat.index, ed)}">${escH(b.feat.name)}</a>${b.feat.note ? ` (${escH(b.feat.note)})` : ''}` });
  if (profs.length) body.push({ t: 'p', html: `<b>Proficiencies:</b> ${profs.map(escH).join(', ')}` });
  if (b.language_options) body.push({ t: 'p', html: `<b>Languages:</b> Choose ${b.language_options.choose}` });
  const eq = (b.equipment_options || []).map(o => o.desc).concat((b.starting_equipment || []).length ? [(b.starting_equipment || []).map(e => (e.quantity > 1 ? e.quantity + ' ' : '') + e.equipment.name).join(', ') + (b.starting_gold ? `, ${b.starting_gold.quantity} ${b.starting_gold.unit}` : '')] : []).concat((b.starting_equipment_options || []).map(o => o.desc || (o.from?.equipment_category ? `one ${o.from.equipment_category.name.replace(/s$/, '').toLowerCase()}` : '')));
  if (eq.filter(Boolean).length) body.push({ t: 'p', html: `<b>Equipment:</b> ${eq.filter(Boolean).map(escH).join('; ')}` });
  if (b.feature) { body.push({ t: 'h', lvl: 4, text: 'Feature: ' + b.feature.name }); body.push(...md(b.feature.desc)); }
  if (b.description) body.push(...md(b.description));
  const tbl = (title, opt, key) => { if (!opt?.from?.options) return; body.push({ t: 'table', head: ['d' + opt.from.options.length, title], rows: opt.from.options.map((o, i) => [String(i + 1), escH(o.string || o.desc || (o[key] && o[key].desc) || '')]) }); };
  if (b.personality_traits) { body.push({ t: 'h', lvl: 4, text: 'Suggested Characteristics' }); tbl('Personality Trait', b.personality_traits); tbl('Ideal', b.ideals); tbl('Bond', b.bonds); tbl('Flaw', b.flaws); }
  return { id: idOf(b.index, ed), name: b.name, ed, skills: profs.filter(p => !/supplies|tools|kit|set|instrument/i.test(p)).join(', '), feat: b.feat?.name || b.feature?.name || '', body };
}));

// ---------------- races / species ----------------
const TR = {}; for (const ed of ED) for (const t of L(ed, 'Traits')) TR[ed + ':' + t.index] = t;
const traitBlocks = (ed, refs) => (refs || []).flatMap(r => { const t = TR[ed + ':' + r.index]; const bl = md(t ? (t.desc ?? t.description) : ''); if (bl[0] && bl[0].t === 'p') bl[0] = { ...bl[0], html: `<b><i>${escH(r.name)}.</i></b> ` + bl[0].html }; else bl.unshift({ t: 'p', html: `<b><i>${escH(r.name)}.</i></b>` }); return bl; });
const asiS = list => (list || []).map(a => `${a.ability_score.name} +${a.bonus}`).join(', ');
out.races = [
  ...L('2014', 'Races').map(r => {
    const subs = L('2014', 'Subraces').filter(s => s.race.index === r.index);
    const body = [
      { t: 'p', html: `<b><i>Ability Score Increase.</i></b> ${escH(asiS(r.ability_bonuses) || '—')}${r.ability_bonus_options ? ` Choose ${r.ability_bonus_options.choose} other abilities: +1 each.` : ''}` },
      { t: 'p', html: `<b><i>Age.</i></b> ${escH(r.age)}` }, { t: 'p', html: `<b><i>Alignment.</i></b> ${escH(r.alignment)}` },
      { t: 'p', html: `<b><i>Size.</i></b> ${escH(r.size_description)}` }, { t: 'p', html: `<b><i>Speed.</i></b> Your base walking speed is ${r.speed} feet.` },
      ...traitBlocks('2014', r.traits), { t: 'p', html: `<b><i>Languages.</i></b> ${escH(r.language_desc)}` }
    ];
    for (const s of subs) body.push({ t: 'h', lvl: 4, text: s.name }, ...md(s.desc), { t: 'p', html: `<b><i>Ability Score Increase.</i></b> ${escH(asiS(s.ability_bonuses))}` }, ...traitBlocks('2014', s.racial_traits));
    return { id: r.index, name: r.name, ed: '2014', size: r.size, speed: r.speed + ' ft.', asi: asiS(r.ability_bonuses), traits: (r.traits || []).map(t => t.name), subs: subs.map(s => s.name), body };
  }),
  ...L('2024', 'Species').map(r => {
    const subs = L('2024', 'Subspecies').filter(s => s.species.index === r.index);
    const body = [{ t: 'p', html: `<b>Creature Type:</b> ${escH(r.type || 'Humanoid')} · <b>Size:</b> ${escH(r.size || r.size_options?.desc || '')} · <b>Speed:</b> ${r.speed} feet` }, { t: 'h', lvl: 4, text: `As a ${r.name}, you have these special traits.` }, ...traitBlocks('2024', (r.traits || []).filter(t => !subs.some(s => (s.traits || []).some(x => x.index === t.index))))];
    if (subs.length) {
      body.push({ t: 'h', lvl: 4, text: subs.length > 3 ? 'Lineages & Ancestries' : 'Options' });
      body.push({ t: 'table', head: ['Option', 'Traits'], rows: subs.map(s => [escH(s.name), escH((s.traits || []).map(t => t.name + (t.level > 1 ? ` (level ${t.level})` : '')).join(', ') + (s.damage_type ? ` · ${s.damage_type.name}` : ''))]) });
      const seen = new Set();
      for (const s of subs) for (const t of s.traits || []) { if (seen.has(t.index)) continue; seen.add(t.index); body.push(...traitBlocks('2024', [t])); }
    }
    return { id: idOf(r.index, '2024'), name: r.name, ed: '2024', size: r.size || (r.size_options ? 'Small or Medium' : ''), speed: r.speed + ' ft.', asi: 'From background', traits: (r.traits || []).map(t => t.name), subs: subs.map(s => s.name), body };
  })
];

// ---------------- classes ----------------
const FEAT = {}; for (const ed of ED) for (const f of L(ed, 'Features')) FEAT[ed + ':' + f.index] = f;
const human = k => cap(k.replace(/_/g, ' ').replace(/\bdice\b/, 'die'));
function csVal(v) {
  if (v == null) return '—';
  if (typeof v === 'object' && !Array.isArray(v)) { if ('dice_count' in v) return `${v.dice_count}d${v.dice_value}`; return Object.values(v).join('/'); }
  if (Array.isArray(v)) return null;
  if (v === 0) return '—';
  return String(v);
}
out.classes = ED.map(ed => {
  const LV = L(ed, 'Levels');
  const subsAll = L(ed, 'Subclasses');
  const featsAll = L(ed, 'Features');
  return L(ed, 'Classes').map(c => {
    const lv = LV.filter(l => l.class.index === c.index && !l.subclass).sort((a, b) => a.level - b.level);
    // table
    const csKeys = uniqArr(lv.flatMap(l => Object.keys(l.class_specific || {}).filter(k => csVal(l.class_specific[k]) !== null)));
    const DROP = /^(arcane_recovery_levels|creating_spell_slots|brutal_critical_dice|destroy_undead_cr|aura_range|metamagic_known|favored_enemies|favored_terrain|mystic_arcanum_level_\d|wild_shape_swim|wild_shape_fly|magical_secrets_max_\d|song_of_rest_die)$/;
    const keepCs = csKeys.filter(k => !DROP.test(k) && lv.some(l => { const v = l.class_specific?.[k]; return v && v !== 0; }));
    const spKeys = uniqArr(lv.flatMap(l => Object.keys(l.spellcasting || {}))).filter(k => lv.some(l => l.spellcasting?.[k]));
    const slotKeys = spKeys.filter(k => /^spell_slots_level_\d$/.test(k)).sort();
    const otherSp = spKeys.filter(k => !/^spell_slots_level_\d$/.test(k));
    const head = ['Level', 'PB', 'Features', ...keepCs.map(human), ...otherSp.map(k => human(k).replace(/ known$/, '').replace('Prepared spells', 'Prepared')), ...slotKeys.map(k => ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'][+k.slice(-1) - 1])];
    const rows = lv.map(l => [String(l.level), '+' + l.prof_bonus, (l.features || []).map(f => f.name).filter(n => !/^Ability Score Improvement \d/.test(n) || true).map(n => n.replace(/ \(\d+(st|nd|rd|th) level\)/, '')).join(', ') || '—', ...keepCs.map(k => csVal(l.class_specific?.[k]) ?? '—'), ...otherSp.map(k => String(l.spellcasting?.[k] ?? '—')), ...slotKeys.map(k => l.spellcasting?.[k] ? String(l.spellcasting[k]) : '—')]);
    // features (class)
    const feats = [];
    const seen = new Set();
    for (const l of lv) for (const fr of l.features || []) {
      const f = FEAT[ed + ':' + fr.index]; if (!f || seen.has(fr.index)) continue; seen.add(fr.index);
      const kids = featsAll.filter(x => x.parent && x.parent.index === fr.index);
      const body = md(f.desc ?? f.description);
      for (const k of kids) body.push({ t: 'h', lvl: 6, text: k.name }, ...md(k.desc ?? k.description));
      feats.push({ name: f.name, level: l.level, body });
    }
    // subclasses
    const subs = subsAll.filter(s => s.class.index === c.index).map(s => {
      let features = [];
      if (ed === '2024') features = (s.features || []).map(f => ({ name: f.name, level: f.level, body: md(f.description) }));
      else {
        const sl = LV.filter(l => l.subclass && l.subclass.index === s.index).sort((a, b) => a.level - b.level);
        for (const l of sl) for (const fr of l.features || []) { const f = FEAT[ed + ':' + fr.index]; if (!f) continue; const kids = featsAll.filter(x => x.parent && x.parent.index === fr.index); const body = md(f.desc); for (const k of kids) body.push({ t: 'h', lvl: 6, text: k.name }, ...md(k.desc)); features.push({ name: f.name, level: l.level, body }); }
      }
      return { id: s.index, name: s.name, flavor: s.subclass_flavor || s.summary || '', body: md(s.desc ?? s.description), features, spells: (s.spells || []).map(x => ({ pre: x.prerequisites?.map(p => p.name).join(', '), name: x.spell.name })) };
    });
    // proficiencies & equipment summary
    const profs = (c.proficiencies || []).map(p => p.name).filter(n => !/^Saving Throw/.test(n));
    const info = [
      ['Hit Point Die', `d${c.hit_die} per ${c.name} level`],
      ['Primary Ability', c.primary_ability?.desc || ''],
      ['Saving Throws', (c.saving_throws || []).map(s => ({ STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' }[s.name])).join(', ')],
      ['Proficiencies', profs.join(', ')],
      ['Skills', (c.proficiency_choices || []).map(p => p.desc).filter(Boolean).join('; ')],
      ['Starting Equipment', [...(c.starting_equipment || []).map(e => (e.quantity > 1 ? e.quantity + ' ' : '') + e.equipment.name), ...(c.starting_equipment_options || []).map(o => o.desc)].filter(Boolean).join('; ')],
      ['Hit Points', `${c.hit_die} + Con modifier at 1st level; ${c.hit_die / 2 + 1} + Con modifier (or 1d${c.hit_die}) per level after`]
    ].filter(x => x[1]);
    if (c.multi_classing?.prerequisites) info.push(['Multiclassing', c.multi_classing.prerequisites.map(p => `${p.ability_score.name} ${p.minimum_score}`).join(', ')]);
    let spellAbility = '';
    const scBlocks = [];
    if (c.spellcasting) { spellAbility = c.spellcasting.spellcasting_ability?.name || ''; for (const i of c.spellcasting.info || []) { scBlocks.push({ t: 'h', lvl: 5, text: i.name }, ...md(i.desc)); } }
    return { id: idOf(c.index, ed), name: c.name, ed, hd: c.hit_die, primary: c.primary_ability?.desc || '', saves: info[2]?.[1] || '', spellAbility, info, table: { head, rows }, features: feats, subclasses: subs, spellcasting: scBlocks };
  });
}).flat();

// ---------------- rules book (SRD 5.1 rule sections) ----------------
const RS = {}; for (const s of L('2014', 'Rule-Sections')) RS[s.index] = s;
out.book = [];
for (const r of L('2014', 'Rules')) {
  out.book.push({ id: 'p-' + r.index, title: r.name, isPart: true, blocks: [] });
  for (const sub of r.subsections) {
    const s = RS[sub.index]; if (!s) continue;
    let blocks = md(s.desc);
    if (blocks[0] && blocks[0].t === 'h' && blocks[0].lvl <= 2) blocks = blocks.slice(1);
    let n = 0; blocks.forEach(b => { if (b.t === 'h') b.id = sub.index + '-' + (++n); });
    out.book.push({ id: sub.index, title: s.name, part: r.name, blocks });
  }
}

// ---------------- write ----------------
const counts = Object.fromEntries(Object.entries(out).filter(([k, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
const json = JSON.stringify(out);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'srd.json'), json);
fs.writeFileSync(path.join(OUT, 'srd.gz.txt'), zlib.gzipSync(Buffer.from(json), { level: 9 }).toString('base64'));
console.log(counts, (json.length / 1048576).toFixed(2) + ' MB');
