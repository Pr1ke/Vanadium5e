// Vanadium 5e — importer for 5etools-format JSON (homebrew files and data files you own)
// Supports: monster, spell, item, baseitem, feat, background, race, condition. Renders {@tags}.
const X5 = (() => {
  const SIZE = { F: 'Fine', D: 'Diminutive', T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', C: 'Colossal', V: 'Varies' };
  const SCH = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation', P: 'Psionic' };
  const ALI = { L: 'lawful', N: 'neutral', NX: 'neutral', NY: 'neutral', C: 'chaotic', G: 'good', E: 'evil', U: 'unaligned', A: 'any alignment' };
  const DMGT = { A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning', N: 'necrotic', P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder' };
  const PROP = { V: 'Versatile', F: 'Finesse', L: 'Light', T: 'Thrown', '2H': 'Two-Handed', H: 'Heavy', R: 'Reach', A: 'Ammunition', LD: 'Loading', S: 'Special', RLD: 'Reload', BF: 'Burst Fire' };
  const ITYPE = { M: 'Melee Weapon', R: 'Ranged Weapon', A: 'Ammunition', AF: 'Ammunition', LA: 'Light Armor', MA: 'Medium Armor', HA: 'Heavy Armor', S: 'Shield', G: 'Adventuring Gear', P: 'Potion', RD: 'Rod', RG: 'Ring', SC: 'Scroll', WD: 'Wand', ST: 'Staff', INS: 'Musical Instrument', AT: "Artisan's Tools", T: 'Tools', GS: 'Gaming Set', MNT: 'Mount', VEH: 'Vehicle', SHP: 'Vehicle (water)', AIR: 'Vehicle (air)', TAH: 'Tack and Harness', TG: 'Trade Good', $: 'Treasure', $A: 'Art Object', $G: 'Gemstone', $C: 'Coinage', OTH: 'Other', FD: 'Food and Drink', SCF: 'Spellcasting Focus', EXP: 'Explosive', GV: 'Generic Variant' };
  const FCAT = { O: 'Origin', G: 'General', FS: 'Fighting Style', 'FS:P': 'Fighting Style', 'FS:R': 'Fighting Style', EB: 'Epic Boon' };
  const ABL = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };
  const ABF = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  const t0 = s => String(s || '').split('|')[0];
  const crN = c => { const s = String(typeof c === 'object' && c ? c.cr : c ?? ''); if (s.includes('/')) { const [a, b] = s.split('/'); return a / b; } return parseFloat(s); };
  const pbOf = c => { const n = crN(c); return isNaN(n) ? 2 : n < 5 ? 2 : Math.min(9, Math.floor((n - 1) / 4) + 2); };
  let LOCAL = {}; // names in the file being imported, for links
  // ----- {@tag} rendering -----
  const ATK = { mw: 'Melee Weapon Attack:', rw: 'Ranged Weapon Attack:', 'mw,rw': 'Melee or Ranged Weapon Attack:', ms: 'Melee Spell Attack:', rs: 'Ranged Spell Attack:', 'ms,rs': 'Melee or Ranged Spell Attack:', m: 'Melee Attack Roll:', r: 'Ranged Attack Roll:', 'm,r': 'Melee or Ranged Attack Roll:' };
  const LINKT = { spell: 'spells', creature: 'monsters', item: 'magic', condition: 'conditions', feat: 'feats', background: 'backgrounds', race: 'races', skill: 'skills', language: 'languages', class: 'classes' };
  function link(tag, parts) {
    const name = parts[0], disp = parts[2] || name;
    const t = LINKT[tag];
    if (t) {
      const n = name.toLowerCase();
      const local = (LOCAL[t] || []).find(e => e.name.toLowerCase() === n);
      let e = local || allOf(t).find(x => x.name.toLowerCase() === n && x.ed === '2024') || allOf(t).find(x => x.name.toLowerCase() === n);
      if (!e && t === 'magic') { e = allOf('items').find(x => x.name.toLowerCase() === n); if (e) return `<a class="lnk" data-go="items--${esc(e.id)}">${esc(disp)}</a>`; }
      if (e) return `<a class="lnk" data-go="${t}--${esc(e.id)}">${esc(disp)}</a>`;
    }
    return `<i>${esc(disp)}</i>`;
  }
  function tagOne(tag, body) {
    const parts = body.split('|').map(s => s.trim());
    switch (tag) {
      case 'b': case 'bold': return `<b>${body}</b>`;
      case 'i': case 'italic': return `<i>${body}</i>`;
      case 's': case 'strike': return `<s>${body}</s>`;
      case 'u': case 'underline': return `<u>${body}</u>`;
      case 'sup': return `<sup>${body}</sup>`; case 'sub': return `<sub>${body}</sub>`;
      case 'code': return `<code>${body}</code>`;
      case 'note': return `<i>${body}</i>`;
      case 'atk': return `<i>${ATK[body] || 'Attack:'}</i>`;
      case 'atkr': return `<i>${ATK[body] || 'Attack Roll:'}</i>`;
      case 'hit': return `${+parts[0] >= 0 ? '+' : ''}${parts[0]}`;
      case 'h': return '<i>Hit:</i> ';
      case 'm': return '<i>Miss:</i> ';
      case 'hom': return '<i>Hit or Miss:</i> ';
      case 'actSave': return `<i>${ABF[parts[0]] || cap(parts[0])} Saving Throw:</i>`;
      case 'actSaveFail': return `<i>${parts[0] ? 'Failure by ' + parts[0] + ' or More' : 'Failure'}:</i>`;
      case 'actSaveSuccess': return '<i>Success:</i>';
      case 'actSaveSuccessOrFail': return '<i>Failure or Success:</i>';
      case 'actTrigger': return '<i>Trigger:</i>'; case 'actResponse': return '<i>Response:</i>';
      case 'damage': case 'dice': case 'autodice': return parts[1] || parts[0];
      case 'd20': return `<span class="dice" data-roll="1d20${+parts[0] >= 0 ? '+' : ''}${parts[0]}" data-d20="1">${+parts[0] >= 0 ? '+' : ''}${parts[0]}</span>`;
      case 'scaledamage': case 'scaledice': return parts[2] || parts[0];
      case 'dc': return `DC ${parts[0]}`;
      case 'chance': return parts[1] || `${parts[0]} percent`;
      case 'recharge': return `(Recharge ${!parts[0] || parts[0] === '6' ? '6' : parts[0] + '–6'})`;
      case 'skillCheck': return `${cap(parts[1] || parts[0])} (${parts[0]})`;
      case 'filter': return parts[0];
      default: if (LINKT[tag]) return link(tag, parts); return esc(parts[2] || parts[0]);
    }
  }
  function tags(s) {
    let out = String(s ?? '');
    if (!out.includes('{@')) return esc(out).replace(/&amp;(?=[a-z#0-9]+;)/g, '&');
    out = esc(out);
    let guard = 0;
    const re = /\{@(\w+)\s?([^{}]*)\}/;
    while (re.test(out) && guard++ < 500) out = out.replace(re, (m, a, b) => tagOne(a, b));
    return out;
  }
  // ----- entries → blocks -----
  function blocks(entries, depth = 0) {
    const out = [];
    for (const e of [].concat(entries || [])) {
      if (e == null) continue;
      if (typeof e === 'string') { out.push({ t: 'p', html: tags(e) }); continue; }
      switch (e.type) {
        case 'list': for (const it of e.items || []) { if (typeof it === 'string') out.push({ t: 'li', html: tags(it) }); else { const inner = blocks(it.entries || (it.entry ? [it.entry] : []), depth + 1); out.push({ t: 'li', html: (it.name ? `<b><i>${tags(it.name)}.</i></b> ` : '') + inner.map(b => b.html || '').join(' ') }); } } break;
        case 'table': out.push({ t: 'table', caption: e.caption, head: (e.colLabels || []).map(x => strip(tags(x))), rows: (e.rows || []).map(r => (r.row || r).map(c => typeof c === 'object' && c ? (c.roll ? (c.roll.exact ?? `${c.roll.min}–${c.roll.max}`) + '' : c.entry ? tags(c.entry) : blocks([c]).map(b => b.html).join(' ')) : tags(c))) }); break;
        case 'inset': case 'insetReadaloud': out.push({ t: 'aside', title: e.name || '', blocks: blocks(e.entries, depth + 1) }); break;
        case 'quote': out.push({ t: 'quote', html: (e.entries || []).map(tags).join('<br>'), attr: e.by }); break;
        case 'item': case 'itemSub': case 'itemSpell': out.push({ t: 'p', html: `<b><i>${tags(e.name)}${/[.!?:]$/.test(e.name || '') ? '' : '.'}</i></b> ` + blocks(e.entries || (e.entry ? [e.entry] : [])).map(b => b.html || '').join(' ') }); break;
        case 'abilityDc': out.push({ t: 'p', html: `<b>${tags(e.name)} save DC</b> = 8 + your proficiency bonus + your ${(e.attributes || []).map(a => ABF[a] || a).join(' or ')} modifier` }); break;
        case 'abilityAttackMod': out.push({ t: 'p', html: `<b>${tags(e.name)} attack modifier</b> = your proficiency bonus + your ${(e.attributes || []).map(a => ABF[a] || a).join(' or ')} modifier` }); break;
        case 'image': case 'gallery': case 'hr': case 'statblock': case 'refClassFeature': case 'refSubclassFeature': case 'refOptionalfeature': break;
        default: {
          const kids = blocks(e.entries || (e.entry ? [e.entry] : []), depth + 1);
          if (e.name && depth >= 1 && kids[0] && kids[0].t === 'p') { kids[0] = { ...kids[0], html: `<b><i>${tags(e.name)}.</i></b> ${kids[0].html}` }; out.push(...kids); }
          else { if (e.name) out.push({ t: 'h', lvl: 4 + Math.min(2, depth), text: strip(tags(e.name)) }); out.push(...kids); }
        }
      }
    }
    return out;
  }
  const inlineHtml = entries => blocks(entries, 1).map(b => b.t === 'li' ? `<span class="mli">• ${b.html}</span>` : b.t === 'table' ? renderBlocks([b]) : b.html || '').join('<br>');
  // ----- monsters -----
  function align(a) {
    if (!a) return '';
    if (a.length && typeof a[0] === 'object') return a.map(x => x.special || align(x.alignment) + (x.chance ? ` (${x.chance}%)` : '')).join(' or ');
    const s = a.join(' ');
    if (s === 'L N C G E' || s === 'A') return 'any alignment';
    if (s === 'N') return 'neutral'; if (s === 'U') return 'unaligned';
    if (s === 'L N C E' || s === 'C G NY E N' && false) return 'any non-good alignment';
    if (a.length > 2) return 'any ' + a.filter(x => /[GE]/.test(x)).map(x => ALI[x]).join('/') + ' alignment';
    return a.map(x => ALI[x] || x).join(' ');
  }
  function mtype(t) {
    if (!t) return ['', ''];
    if (typeof t === 'string') return [cap(t), cap(t)];
    const base = typeof t.type === 'object' ? (t.type.choose || []).map(cap).join(' or ') : cap(t.type);
    const tg = (t.tags || []).map(x => typeof x === 'string' ? x : (x.prefix ? x.prefix + ' ' : '') + x.tag).join(', ');
    return [(t.swarmSize ? `Swarm of ${SIZE[t.swarmSize]} ${base}s` : base) + (tg ? ` (${tg})` : ''), t.swarmSize ? 'Swarm' : base];
  }
  const dmgText = (list, key) => (list || []).map(x => typeof x === 'string' ? cap(x) : x.special ? x.special : `${(x[key] ? dmgText(x[key], key) : '')}${x.note ? ' ' + x.note : ''}`.trim() + (x.preNote ? '' : '')).join(', ');
  function spellcasting(sc) {
    let h = inlineHtml(sc.headerEntries || []);
    const line = (k, list) => `<br><span class="mli"><b>${esc(k)}:</b> ${list.map(tags).join(', ')}</span>`;
    if (sc.will) h += line('At will', sc.will);
    if (sc.daily) for (const k of Object.keys(sc.daily).sort().reverse()) h += line(k.replace('e', '') + '/day' + (k.endsWith('e') ? ' each' : ''), sc.daily[k]);
    if (sc.spells) for (const k of Object.keys(sc.spells).sort((a, b) => a - b)) { const x = sc.spells[k]; h += line(k === '0' ? 'Cantrips (at will)' : `${ORD(+k)} level (${x.slots ? x.slots + ' slot' + (x.slots > 1 ? 's' : '') : x.lower ? ORD(x.lower) + '–' + ORD(+k) : 'at will'})`, x.spells || []); }
    if (sc.footerEntries) h += '<br>' + inlineHtml(sc.footerEntries);
    return { n: sc.name || 'Spellcasting', h };
  }
  function monster(m, meta) {
    const ab = ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => m[k] ?? 10);
    const [type, tkey] = mtype(m.type);
    const crS = typeof m.cr === 'object' && m.cr ? m.cr.cr : m.cr != null ? String(m.cr) : '—';
    const ac = (m.ac || []).map(a => typeof a === 'number' ? String(a) : a.special ? a.special : a.ac + (a.from ? ` (${a.from.map(f => strip(tags(f))).join(', ')})` : '') + (a.condition ? ' ' + strip(tags(a.condition)) : '')).join(', ');
    const sp = m.speed || {};
    const speed = typeof sp === 'number' ? sp + ' ft.' : ['walk', 'burrow', 'climb', 'fly', 'swim'].filter(k => sp[k] != null).map(k => { const v = sp[k]; const n = typeof v === 'object' ? v.number + ' ft.' + (v.condition ? ' ' + strip(tags(v.condition)) : '') : v + ' ft.'; return (k === 'walk' ? '' : k + ' ') + n; }).join(', ');
    const speedH = speed + (sp.canHover && !/hover/i.test(speed) ? ' (hover)' : '');
    const saves = {}; for (const k in m.save || {}) saves[ABL[k]] = parseInt(m.save[k]);
    const items = (arr) => (arr || []).map(a => ({ n: strip(tags(a.name || '')), h: inlineHtml(a.entries || []) }));
    const traits = items(m.trait), actions = items(m.action), bonus = items(m.bonus), reactions = items(m.reaction);
    for (const sc of m.spellcasting || []) { const it = spellcasting(sc); (sc.displayAs === 'action' ? actions : sc.displayAs === 'bonus' ? bonus : sc.displayAs === 'reaction' ? reactions : traits).push(it); }
    const xp = CRXP[crS] ?? 0;
    const cimm = (m.conditionImmune || []).map(x => typeof x === 'string' ? cap(x) : (x.conditionImmune || []).map(cap).join(', ') + (x.note ? ' ' + x.note : '')).join(', ');
    return {
      id: slug(m.name) + '-' + slug(m.source || meta.abbr), name: m.name, size: (m.size || []).map(s => SIZE[s] || s).join(' or '), type, tkey, align: cap(align(m.alignment)),
      ac: ac || '—', acN: parseInt(ac) || 10, hp: m.hp ? (m.hp.special || `${m.hp.average} (${m.hp.formula})`) : '—', hpN: m.hp?.average ?? 0, hpRoll: (m.hp?.formula || '').replace(/\s+/g, ''),
      speed: speedH, ab, saves, skills: Object.entries(m.skill || {}).filter(([k]) => k !== 'other').map(([k, v]) => cap(k) + ' ' + v).join(', '), pb: pbOf(m.cr),
      vuln: dmgText(m.vulnerable, 'vulnerable'), res: dmgText(m.resist, 'resist'), imm: dmgText(m.immune, 'immune'), cimm,
      senses: [...(m.senses || []).map(s => strip(tags(s))), `passive Perception ${m.passive ?? 10 + mod(ab[4])}`].join(', '), lang: (m.languages || []).map(s => strip(tags(s))).join(', ') || '—',
      cr: crS, crN: crN(m.cr), xp, xpLair: typeof m.cr === 'object' && m.cr?.xpLair || 0, init: typeof m.initiative === 'number' ? m.initiative : mod(ab[1]), gear: (m.gear || []).map(g => t0(typeof g === 'string' ? g : g.item)).join(', '),
      traits, actions, bonus, reactions, legendary: items(m.legendary), legN: m.legendaryActions || 3, legendaryHdr: m.legendaryHeader ? inlineHtml(m.legendaryHeader) : '',
      extraSecs: m.mythic ? [{ title: 'Mythic Actions', blocks: [...blocks(m.mythicHeader || []), ...m.mythic.map(a => ({ t: 'p', html: `<b><i>${tags(a.name)}.</i></b> ${inlineHtml(a.entries)}` }))] }] : [],
      spellcaster: !!(m.spellcasting || []).length, desc: [], dmgTypes: uniq((m.damageTags || []).map(d => cap(DMGT[d] || ''))), srcAbbr: m.source || meta.abbr
    };
  }
  // ----- spells -----
  function range(r) {
    if (!r) return '';
    const d = r.distance || {};
    const dist = d.type === 'self' ? 'Self' : d.type === 'touch' ? 'Touch' : d.type === 'sight' ? 'Sight' : d.type === 'unlimited' ? 'Unlimited' : d.amount != null ? `${d.amount} ${d.type === 'feet' ? 'feet' : d.type === 'miles' ? (d.amount === 1 ? 'mile' : 'miles') : d.type}` : cap(d.type || '');
    if (r.type === 'point') return dist;
    if (r.type === 'special') return 'Special';
    return `Self (${d.amount}-${d.type === 'feet' ? 'foot' : d.type} ${r.type})`;
  }
  const UNIT = { action: 'action', bonus: 'bonus action', reaction: 'reaction', minute: 'minute', hour: 'hour', round: 'round' };
  function duration(list) {
    return (list || []).map(d => {
      if (d.type === 'instant') return 'Instantaneous';
      if (d.type === 'permanent') return 'Until ' + (d.ends || ['dispelled']).map(x => x === 'dispel' ? 'dispelled' : x === 'trigger' ? 'triggered' : x).join(' or ');
      if (d.type === 'special') return 'Special';
      const t = d.duration || {}; const s = `${t.upTo ? 'up to ' : ''}${t.amount} ${t.type}${t.amount > 1 ? 's' : ''}`;
      return d.concentration ? 'Concentration, ' + s : cap(s);
    }).join(' or ');
  }
  function spell(s, meta) {
    const c = s.components || {};
    const mat = typeof c.m === 'string' ? c.m : c.m && c.m.text ? c.m.text : '';
    const comp = [c.v && 'V', c.s && 'S', c.m && 'M', c.r && 'R'].filter(Boolean).join(', ') + (mat ? ` (${mat})` : '');
    const higher = blocks(s.entriesHigherLevel || []);
    return {
      id: slug(s.name) + '-' + slug(s.source || meta.abbr), name: s.name, level: s.level || 0, school: SCH[s.school] || s.school || '',
      time: (s.time || []).map(t => `${t.number} ${UNIT[t.unit] || t.unit}${t.number > 1 ? 's' : ''}${t.condition ? ', ' + t.condition : ''}`).join(' or '),
      range: range(s.range), comp, compS: [c.v && 'V', c.s && 'S', c.m && 'M'].filter(Boolean).join(''), dur: duration(s.duration), conc: (s.duration || []).some(d => d.concentration), ritual: !!s.meta?.ritual,
      classes: uniq((s.classes?.fromClassList || []).map(x => x.name)), subclasses: [], dmg: (s.damageInflict || []).map(cap), save: (s.savingThrow || []).map(x => ABL[x.slice(0, 3)] ? ABF[x.slice(0, 3)] : cap(x)).join(', '),
      body: [...blocks(s.entries), ...higher], srcAbbr: s.source || meta.abbr
    };
  }
  // ----- items -----
  function item(it, meta) {
    const type = t0(it.type), name = it.name;
    const magic = it.rarity && !/^none$/i.test(it.rarity) || it.wondrous || it.reqAttune || /^(P|RD|RG|SC|WD|ST)$/.test(type);
    const typeName = it.wondrous ? 'Wondrous Item' : ITYPE[type] || (type ? type : 'Item');
    const id = slug(name) + '-' + slug(it.source || meta.abbr);
    const cost = it.value != null ? (it.value >= 100 ? (it.value / 100) + ' gp' : it.value >= 10 ? (it.value / 10) + ' sp' : it.value + ' cp') : '—';
    if (magic) {
      const att = it.reqAttune === true ? '' : typeof it.reqAttune === 'string' ? it.reqAttune : '';
      const rar = String(it.rarity || 'unknown').replace(/\b\w/g, c => c.toUpperCase()).replace('Unknown (Magic)', 'Varies').replace(/^Unknown$/, 'Varies');
      return ['magic', { id, name, cat: typeName.replace(/ Weapon$/, ' Weapon').replace(/^(Melee|Ranged) Weapon$/, 'Weapon').replace(/^(Light|Medium|Heavy) Armor$/, 'Armor'), rarity: rar, attune: !!it.reqAttune, attuneBy: att, typeLine: `${typeName}, ${String(it.rarity || '').toLowerCase()}${it.reqAttune ? ` (requires attunement${att ? ' ' + att : ''})` : ''}`, variants: [], body: blocks(it.entries), srcAbbr: it.source || meta.abbr }];
    }
    const cat = /^(M|R)$/.test(type) || it.weapon ? 'Weapon' : /^(LA|MA|HA|S)$/.test(type) ? 'Armor' : /^(INS|AT|T|GS)$/.test(type) ? 'Tools' : /^(MNT|VEH|SHP|AIR|TAH)$/.test(type) ? 'Mounts and Vehicles' : 'Adventuring Gear';
    const sub = cat === 'Weapon' ? `${cap(it.weaponCategory || '')} ${type === 'R' ? 'Ranged' : 'Melee'}`.trim() : ITYPE[type] || '';
    const r = { id, name, cat, sub, cost, costN: (it.value || 0) / 100, weight: it.weight != null ? it.weight + ' lb.' : '—', weightN: it.weight || 0, body: blocks(it.entries), srcAbbr: it.source || meta.abbr };
    if (it.dmg1) r.dmg = `${it.dmg1} ${DMGT[it.dmgType] || ''}`.trim();
    if (it.dmg2) r.dmg2 = it.dmg2;
    if (it.property) r.props = it.property.map(p => PROP[t0(typeof p === 'string' ? p : p.uid || p.property)] || t0(p));
    if (it.range) r.range = it.range + ' ft.';
    if (it.mastery) r.mastery = t0(typeof it.mastery[0] === 'string' ? it.mastery[0] : it.mastery[0].uid);
    if (it.ac) r.acS = type === 'S' ? '+' + it.ac : it.ac + (type === 'LA' ? ' + Dex' : type === 'MA' ? ' + Dex (max 2)' : '');
    if (it.strength) r.strMin = it.strength; if (it.stealth) r.stealth = 'Disadvantage';
    return ['items', r];
  }
  // ----- options -----
  function prereq(list) {
    return (list || []).map(p => [p.level ? `Level ${typeof p.level === 'object' ? p.level.level : p.level}+` : '', ...(p.ability || []).map(a => Object.entries(a).map(([k, v]) => `${ABF[k] || k} ${v}+`).join(' or ')), p.race ? p.race.map(r => cap(r.name)).join(' or ') : '', p.spellcasting || p.spellcasting2020 ? 'Spellcasting or Pact Magic' : '', p.feat ? p.feat.map(f => cap(t0(f))).join(', ') : '', p.other || '', p.feature ? p.feature.map(t0).join(', ') : ''].filter(Boolean).join(', ')).filter(Boolean).join('; ');
  }
  const feat = (f, meta) => ({ id: slug(f.name) + '-' + slug(f.source || meta.abbr), name: f.name, type: FCAT[f.category] || 'General', pre: prereq(f.prerequisite), body: blocks(f.entries), srcAbbr: f.source || meta.abbr });
  const background = (b, meta) => ({ id: slug(b.name) + '-' + slug(b.source || meta.abbr), name: b.name, skills: (b.skillProficiencies || []).flatMap(o => Object.keys(o).filter(k => o[k] === true).map(cap)).join(', '), feat: (b.feats || []).flatMap(o => Object.keys(o).map(k => cap(t0(k)))).join(', '), body: blocks(b.entries), srcAbbr: b.source || meta.abbr });
  const race = (r, meta) => ({ id: slug(r.name) + '-' + slug(r.source || meta.abbr), name: r.name, size: (r.size || []).map(s => SIZE[s] || s).join(' or '), speed: (typeof r.speed === 'number' ? r.speed : r.speed?.walk ?? 30) + ' ft.', asi: (r.ability || []).map(a => Object.entries(a).filter(([k]) => ABL[k]).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(', ')).join('; ') || '—', traits: [], subs: [], body: blocks(r.entries), srcAbbr: r.source || meta.abbr });
  const condition = (c, meta) => ({ id: slug(c.name) + '-' + slug(c.source || meta.abbr), name: c.name, body: blocks(c.entries), srcAbbr: c.source || meta.abbr });
  // resolve simple _copy references within the same file
  function resolveCopies(arr) {
    const byN = {}; arr.forEach(x => { if (!x._copy) byN[(x.name + '|' + (x.source || '')).toLowerCase()] = x; });
    return arr.map(x => {
      if (!x._copy) return x;
      const base = byN[(x._copy.name + '|' + (x._copy.source || '')).toLowerCase()] || Object.values(byN).find(b => b.name.toLowerCase() === String(x._copy.name).toLowerCase());
      if (!base) return null;
      const y = { ...JSON.parse(JSON.stringify(base)), ...x }; delete y._copy; return y;
    }).filter(Boolean);
  }
  function convert(json, fileName) {
    const src = json._meta?.sources?.[0] || {};
    const meta = { abbr: src.abbreviation || src.json || (fileName || 'HB').replace(/\.json$/i, '').slice(0, 10), title: src.full || (fileName || 'Imported data').replace(/\.json$/i, '').replace(/[-_]+/g, ' ') };
    const data = {}; const warn = [];
    const put = (t, e) => (data[t] = data[t] || []).push(e);
    LOCAL = {};
    for (const s of json.spell || []) (LOCAL.spells = LOCAL.spells || []).push({ name: s.name, id: slug(s.name) + '-' + slug(s.source || meta.abbr) });
    for (const m of json.monster || []) (LOCAL.monsters = LOCAL.monsters || []).push({ name: m.name, id: slug(m.name) + '-' + slug(m.source || meta.abbr) });
    const each = (key, fn) => { let arr = json[key] || []; const before = arr.length; arr = resolveCopies(arr); if (arr.length < before) warn.push(`${before - arr.length} ${key} entr${before - arr.length === 1 ? 'y' : 'ies'} copy another book’s entry and were skipped`); for (const x of arr) { try { fn(x); } catch (e) { console.warn(key, x?.name, e); warn.push(`Skipped ${key} “${x?.name}”: ${e.message}`); } } };
    each('monster', m => put('monsters', monster(m, meta)));
    each('spell', s => put('spells', spell(s, meta)));
    each('item', it => { const [t, e] = item(it, meta); put(t, e); });
    each('baseitem', it => { const [t, e] = item(it, meta); put(t, e); });
    each('magicvariant', it => { const [, e] = item({ ...it, ...(it.inherits || {}), rarity: it.inherits?.rarity || 'varies' }, meta); e.cat = e.cat || 'Variant'; put('magic', e); });
    each('feat', f => put('feats', feat(f, meta)));
    each('background', b => put('backgrounds', background(b, meta)));
    each('race', r => put('races', race(r, meta)));
    each('species', r => put('races', race(r, meta)));
    each('condition', c => put('conditions', condition(c, meta)));
    if (json.class) warn.push('Classes in 5etools format aren’t supported yet and were skipped.');
    return { meta, data, warn };
  }
  return { convert, tags, blocks };
})();

// ---------- import page ----------
let pendingImp = null;
function importPage() {
  $('#main').innerHTML = `<div class="imp"><h1>Import 5etools JSON</h1>
    <p class="note">Add homebrew or your own data in <b>5etools JSON format</b> — the format used by the 5etools homebrew repository and its data files. Creatures, spells, items, magic items, feats, backgrounds, species and conditions are converted, including <code>{@tags}</code> such as <code>{@spell fireball}</code> and <code>{@damage 2d6}</code>. <b>Files stay on this device</b> and are saved in this browser only.</p>
    <label class="drop" id="drop"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 18v-6M9 15l3-3 3 3"/></svg><b>Drop JSON files here or tap to choose</b><span>One or more .json files in 5etools format</span><input type="file" id="jfile" accept=".json,application/json" multiple></label>
    <div class="frow" style="max-width:760px;margin-top:12px"><input id="jurl" placeholder="…or paste a URL to a 5etools-format JSON file (e.g. a raw GitHub link)"><button class="btn" id="jurlgo">Fetch</button></div>
    <div class="stage" id="stage"></div>
    <div class="mine"><h2>Your imports</h2>${PACKS.length ? PACKS.map(p => `<div class="it"><div class="t"><b>${esc(p.title)}</b><span>${esc(Object.entries(p.data).map(([t, a]) => a.length + ' ' + TYPES[t].label.toLowerCase()).join(' · '))} · imported ${esc((p.importedAt || '').slice(0, 10))}</span></div><button class="btn danger" data-delpack="${esc(p.id)}">Remove</button></div>`).join('') : '<div class="note">Nothing imported yet.</div>'}</div></div>`;
  const drop = $('#drop'), inp = $('#jfile');
  inp.onchange = () => inp.files.length && handleJson([...inp.files]);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => { const f = [...e.dataTransfer.files]; if (f.length) handleJson(f); });
  $('#jurlgo').onclick = async () => {
    const u = $('#jurl').value.trim(); if (!u) return;
    $('#stage').innerHTML = `<div class="progt">Fetching…</div>`;
    try { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); const j = await r.json(); showImport([{ json: j, name: decodeURIComponent(u.split('/').pop() || 'remote.json') }]); }
    catch (e) { $('#stage').innerHTML = `<div class="warn">Couldn’t fetch that file: ${esc(e.message)}. The server may not allow downloads from other sites; download the file and drop it here instead.</div>`; }
  };
  document.title = 'Import — Vanadium 5e';
}
async function handleJson(files) {
  const stage = $('#stage');
  const ok = [];
  for (const f of files) {
    try { ok.push({ json: JSON.parse(await f.text()), name: f.name }); }
    catch (e) { stage.innerHTML = `<div class="warn">${esc(f.name)} isn’t valid JSON: ${esc(e.message)}</div>`; return; }
  }
  showImport(ok);
}
function showImport(list) {
  const stage = $('#stage');
  const res = list.map(x => ({ ...X5.convert(x.json, x.name), fileName: x.name }));
  const data = {}; res.forEach(r => Object.entries(r.data).forEach(([t, a]) => (data[t] = data[t] || []).push(...a)));
  const warn = res.flatMap(r => r.warn);
  const n = Object.values(data).reduce((s, a) => s + a.length, 0);
  const meta = res[0].meta;
  pendingImp = { id: 'hb-' + slug(meta.title).slice(0, 40) + '-' + Date.now().toString(36), title: res.length > 1 ? meta.title + ` (+${res.length - 1} files)` : meta.title, abbr: meta.abbr, fileName: res.map(r => r.fileName).join(', '), data, importedAt: new Date().toISOString() };
  stage.innerHTML = `<div class="pv"><div class="row"><label>Title<input id="pvtitle" value="${esc(pendingImp.title)}"></label><label style="max-width:160px">Short name<input id="pvabbr" value="${esc(pendingImp.abbr)}"></label></div>
    <div class="pvstats">${Object.entries(data).map(([t, a]) => `<div class="stat">${esc(TYPES[t].label)}<b>${a.length}</b></div>`).join('') || '<div class="stat">Entries<b>0</b></div>'}</div>
    ${n ? '<div class="okb">Looks good. Review the entries below, then add them to your library.</div>' : '<div class="warn">Nothing Vanadium can use was found. Is this a 5etools-format file with keys like “monster”, “spell” or “item”?</div>'}
    ${warn.length ? `<div class="warn">${warn.slice(0, 8).map(esc).join('<br>')}${warn.length > 8 ? `<br>…and ${warn.length - 8} more` : ''}</div>` : ''}
    <div class="pvlist">${Object.entries(data).flatMap(([t, a]) => a.slice(0, 150).map(e => `<div>${esc(e.name)}<span>${esc(TYPES[t].one)}${e.cr ? ' · CR ' + esc(e.cr) : ''}${e.level != null && t === 'spells' ? ' · ' + esc(lvlShort(e.level)) : ''}${e.rarity ? ' · ' + esc(e.rarity) : ''}</span></div>`)).join('')}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="pvsave" ${n ? '' : 'disabled'}>Add to library</button><button class="btn ghost" id="pvcancel">Discard</button></div></div>`;
  $('#pvcancel').onclick = () => { pendingImp = null; stage.innerHTML = ''; };
  $('#pvsave').onclick = async () => {
    const p = pendingImp; p.title = $('#pvtitle').value.trim() || p.title; p.abbr = $('#pvabbr').value.trim() || p.abbr;
    for (const a of Object.values(p.data)) for (const e of a) { e.srcTitle = p.title; e.srcAbbr = p.abbr; }
    let persisted = true;
    try { await IDB.put(JSON.parse(JSON.stringify(p))); } catch (e) { persisted = false; }
    addPack(p); rebuildIndex(); buildIndex(); buildMenu(); pendingImp = null;
    toast(persisted ? 'Added to your library' : 'Added for this session (browser storage unavailable)');
    const first = Object.keys(p.data)[0]; go(first || 'library');
  };
}
