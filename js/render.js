// Vanadium 5e — rendering: blocks, stat blocks, spell & item cards, text enhancement
// ---------- block rendering ----------
function renderBlocks(blocks, opts = {}) {
  let out = '', list = null;
  const closeList = () => { if (list !== null) { out += '<ul>' + list + '</ul>'; list = null; } };
  const minL = Math.min(6, ...(blocks || []).filter(b => b.t === 'h').map(b => b.lvl));
  for (const b of blocks || []) {
    if (b.t === 'li') { list = (list || '') + `<li>${b.html}</li>`; continue; }
    closeList();
    if (b.t === 'h') {
      const rel = opts.book ? b.lvl - 3 : b.lvl - minL;
      const tag = 'h' + Math.min(6, Math.max(3, 3 + rel + (opts.hbase || 0)));
      out += `<${tag}${b.id ? ` id="h-${esc(b.id)}"` : ''}>${esc(b.text)}</${tag}>`;
    } else if (b.t === 'p') out += `<p>${b.html}</p>`;
    else if (b.t === 'quote') out += `<blockquote>${b.html}${b.attr ? `<cite>— ${esc(b.attr)}</cite>` : ''}</blockquote>`;
    else if (b.t === 'aside') out += `<aside>${b.title ? `<div class="ah">${esc(b.title)}</div>` : ''}${renderBlocks(b.blocks || [])}</aside>`;
    else if (b.t === 'table') {
      const n = Math.max(b.head.length, ...b.rows.map(r => r.length));
      const rollable = /^d\d+$/i.test((b.head[0] || '').trim());
      out += `<div class="tblw">${b.caption ? `<div class="ah" style="font-weight:600;margin-bottom:4px">${esc(b.caption)}</div>` : ''}<table class="dt"><thead><tr>${b.head.map((x, i) => `<th>${i === 0 && rollable ? `<span class="dice" data-roll="1${esc(x.trim().toLowerCase())}" data-lab="${esc(b.caption || 'Table roll')}">${esc(x)}</span>` : esc(x)}</th>`).join('')}</tr></thead><tbody>`;
      for (const r of b.rows) out += '<tr>' + Array.from({ length: n }, (_, k) => `<td>${r[k] ?? ''}</td>`).join('') + '</tr>';
      out += '</tbody></table></div>';
    }
  }
  closeList();
  return out;
}

// ---------- text enhancement: dice, to-hit, conditions ----------
const CONDS = ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];
const ENH_RE = new RegExp('(\\b\\d*d(?:4|6|8|10|12|20|100)(?:\\s*[+−-]\\s*\\d+(?!d))?\\b)|((?:[+−-]\\d+) to hit)|((?:Attack Roll|Attack|Bonus):\\s*([+−-]\\d+))|\\b(' + CONDS.join('|') + ')\\b', 'gi');
function enhance(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement; if (!p || p.closest('a,button,.dice,.lnk,th,h1,h2,h3,input,select,textarea,.mon-n,.sp5-n,.noenh')) return NodeFilter.FILTER_REJECT;
      ENH_RE.lastIndex = 0; return ENH_RE.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const s = n.data; let m, last = 0, frag = null; ENH_RE.lastIndex = 0;
    while ((m = ENH_RE.exec(s))) {
      frag = frag || document.createDocumentFragment();
      frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      const el = document.createElement('span');
      if (m[1]) { el.className = 'dice'; el.dataset.roll = m[1].replace(/\s+/g, '').replace(/−/g, '-'); el.textContent = m[1]; }
      else if (m[2]) { el.className = 'dice'; el.dataset.roll = '1d20' + m[2].split(' ')[0].replace(/−/g, '-'); el.dataset.d20 = '1'; el.textContent = m[2]; }
      else if (m[3]) { el.className = 'dice'; el.dataset.roll = '1d20' + m[4].replace(/−/g, '-'); el.dataset.d20 = '1'; el.textContent = m[3]; }
      else { const c = byName('conditions', m[5]); if (c) { el.className = 'lnk'; el.dataset.go = 'conditions--' + c.id; } el.textContent = m[5]; }
      frag.appendChild(el); last = m.index + m[0].length;
    }
    if (frag) { frag.appendChild(document.createTextNode(s.slice(last))); n.replaceWith(frag); }
  }
}

// ---------- monsters ----------
const ABN = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'], ABS = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha'];
const ABFULL = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
function maKind(sec, a) {
  if (sec === 'legendary') return 'vil';
  if (sec === 'reactions') return 'trig';
  if (sec === 'traits') return 'trait';
  const h = strip(a.h);
  if (/^Melee or Ranged|^Melee/i.test(h)) return 'melee';
  if (/^Ranged/i.test(h)) return 'ranged';
  if (/saving throw/i.test(h)) return 'area';
  return 'melee';
}
const xpS = n => Number(n || 0).toLocaleString('en-US');
function legendIntro(m) {
  const nm = m.name.toLowerCase().startsWith('the ') ? m.name : 'the ' + m.name.toLowerCase();
  if (m.ed === '2024') return `<b>Legendary Action Uses: ${m.legN || 3}${m.xpLair ? ` (${(m.legN || 3) + 1} in Lair)` : ''}.</b> Immediately after another creature's turn, ${nm} can expend a use to take one of the following actions. It regains all expended uses at the start of each of its turns.`;
  if (m.legendaryHdr) return m.legendaryHdr;
  return `${cap(nm)} can take ${m.legN || 3} legendary actions, choosing from the options below. Only one option can be used at a time and only at the end of another creature's turn. Spent legendary actions are regained at the start of its turn.`;
}
function renderMonster(m, opts = {}) {
  if (!m) return '';
  const pinned = isPinned('monsters', m.id);
  const ab = m.ab || [10, 10, 10, 10, 10, 10];
  let h = `<div class="mon" data-mon="${esc(m.id)}" data-name="${esc(m.name)}"><div class="mon-h"><div><div class="mon-n"><a data-go="monsters--${esc(m.id)}">${esc(m.name)}</a></div><div class="mon-k">${esc([m.size, m.type].filter(Boolean).join(' '))}${m.align ? ', ' + esc(m.align) : ''}</div></div>
    <div class="mon-r"><span class="crb">CR ${esc(m.cr)}</span><button class="ab-pin ${pinned ? 'on' : ''}" data-pin="monsters--${esc(m.id)}" title="Pin">★</button><div style="margin-top:3px">${xpS(m.xp)} XP${m.xpLair ? ` (${xpS(m.xpLair)} in lair)` : ''}</div></div></div>`;
  const init = m.init ?? mod(ab[1]);
  h += `<div class="mon-stats s4" style="grid-template-columns:repeat(4,1fr)"><div><b>${esc(String(m.ac).split(' ')[0])}</b><span>Armor Class</span></div>
    <div class="rollable" data-roll="${esc(m.hpRoll || '')}" data-lab="${esc(m.name)} hit points" title="Roll hit points (${esc(m.hpRoll || '')})"><b>${esc(m.hpN ?? m.hp)}</b><span>Hit Points</span></div>
    <div class="rollable" data-roll="1d20${init >= 0 ? '+' : ''}${init}" data-d20="1" data-lab="${esc(m.name)} initiative" title="Roll initiative"><b>${sgn(init)}</b><span>Initiative</span></div>
    <div><b>+${esc(m.pb || 2)}</b><span>Prof. Bonus</span></div></div>`;
  h += `<div class="abil">${ab.map((s, i) => { const sv = m.saves && m.saves[ABS[i]]; return `<div data-roll="1d20${mod(s) >= 0 ? '+' : ''}${mod(s)}" data-d20="1" data-lab="${esc(m.name)}: ${ABFULL[i]} check" ${sv != null ? `data-roll2="1d20${sv >= 0 ? '+' : ''}${sv}"` : ''} title="Click: ${ABFULL[i]} check${sv != null ? ' · Shift-click: saving throw' : ''}"><i>${ABN[i]}</i><b>${s}</b><small>${sgn(mod(s))}</small>${sv != null ? `<small class="sv">save ${sgn(sv)}</small>` : ''}</div>`; }).join('')}</div>`;
  const def = [];
  const L = (k, v) => v && def.push(`<div><b>${k}</b> ${esc(v)}</div>`);
  L('Armor Class', String(m.ac).includes('(') ? m.ac : '');
  L('Hit Points', m.hp); L('Speed', m.speed);
  if (m.saves && Object.keys(m.saves).length) L('Saving Throws', Object.entries(m.saves).map(([k, v]) => k + ' ' + sgn(v)).join(', '));
  L('Skills', m.skills); L('Vulnerabilities', m.vuln); L('Resistances', m.res); L('Immunities', [m.imm, m.cimm].filter(Boolean).join(m.imm && m.cimm ? '; ' : ''));
  L('Senses', m.senses); L('Languages', m.lang); L('Gear', m.gear);
  h += `<div class="mon-def5">${def.join('')}</div>`;
  if (m.desc && m.desc.length && opts.lore) h += `<div class="mon-lore5 rd" style="font-size:14px">${renderBlocks(m.desc)}</div>`;
  const sec = (key, title, intro) => {
    const list = m[key] || []; if (!list.length) return '';
    return `<div class="msec">${title}</div>${intro ? `<div class="ma5" style="border-top:0;color:var(--cardmut)">${intro}</div>` : ''}` + list.map((a, i) => `<div class="ma5" data-ab="${esc(m.id)}:${key}:${i}"><span class="ma-i ${maKind(key, a)}" style="display:inline-flex;width:20px;height:20px;vertical-align:-4px;margin-right:6px">${ICON[maKind(key, a)]}</span><span class="mn">${esc(a.n)}.</span> ${a.h}</div>`).join('');
  };
  h += `<div class="mon-items">${sec('traits', 'Traits')}${sec('actions', 'Actions')}${sec('bonus', 'Bonus Actions')}${sec('reactions', 'Reactions')}${sec('legendary', 'Legendary Actions', legendIntro(m))}${(m.extraSecs || []).map(s => `<div class="msec">${esc(s.title)}</div><div class="ma5" style="border-top:0">${renderBlocks(s.blocks)}</div>`).join('')}</div>`;
  if (!opts.nosrc) h += `<div class="mon-src"><span>${esc(m.tkey || '')}${m.spellcaster ? ' · Spellcaster' : ''}</span><span>${edBadge(m)} ${esc(srcName(m))}</span></div>`;
  return h + `</div>`;
}

// ---------- spells ----------
const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
function spellLevelLine(s) {
  if (s.ed === '2024' || s.ed === 'hb') return s.level === 0 ? `${s.school} Cantrip` : `Level ${s.level} ${s.school}`;
  return s.level === 0 ? `${s.school} cantrip` : `${ORD(s.level)}-level ${s.school.toLowerCase()}`;
}
const lvlShort = l => l === 0 ? 'Cantrip' : ORD(l);
function renderSpell(s, opts = {}) {
  if (!s) return '';
  const pinned = isPinned('spells', s.id);
  let h = `<div class="sp5" data-spell="${esc(s.id)}"><div class="sp5-h"><div class="t"><div class="sp5-n"><a data-go="spells--${esc(s.id)}">${esc(s.name)}</a></div><div class="sp5-k">${esc(spellLevelLine(s))}${s.ritual ? '<span class="tagc">Ritual</span>' : ''}${s.conc ? '<span class="tagc conc">Concentration</span>' : ''}</div></div><span class="lvlpill">${esc(lvlShort(s.level))}</span><button class="ab-pin ${pinned ? 'on' : ''}" data-pin="spells--${esc(s.id)}" title="Pin">★</button></div>`;
  h += `<div class="sp5-g"><div><span>Casting Time</span>${esc(s.time)}</div><div><span>Range</span>${esc(s.range)}</div><div title="${esc(s.comp)}"><span>Components</span>${esc(s.comp.replace(/\s*\(.*$/, '') + (/\(/.test(s.comp) ? ' *' : ''))}</div><div><span>Duration</span>${esc(s.conc ? s.dur.replace(/^Concentration,?\s*/i, '') : s.dur)}${s.conc ? ' (C)' : ''}</div></div>`;
  h += `<div class="sp5-b">${/\(/.test(s.comp) ? `<p style="font-size:13px;color:var(--cardmut)">* ${esc(s.comp.match(/\((.*)\)\s*$/)?.[1] || '')}</p>` : ''}${renderBlocks(s.body)}</div>`;
  if (!opts.nosrc) h += `<div class="sp5-f"><span>${esc((s.classes || []).join(', ') || '—')}</span><span>${edBadge(s)} ${esc(srcName(s))}</span></div>`;
  return h + '</div>';
}

// ---------- items ----------
const rarCls = r => 'rar rar-' + slug(r || 'varies');
function itemKV(e) {
  const kv = [];
  const P = (k, v) => v && kv.push(`<b>${k}</b><span>${v}</span>`);
  P('Category', esc([e.cat, e.sub].filter(Boolean).join(' · ')));
  P('Cost', esc(e.cost)); P('Weight', esc(e.weight));
  if (e.dmg) P('Damage', esc(e.dmg) + (e.dmg2 ? ` (${esc(e.dmg2)} two-handed)` : ''));
  if (e.range) P('Range', esc(e.range));
  if (e.props) P('Properties', e.props.map(p => { const x = byName('properties', p.replace(/\s*\(.*$/, '')); return x ? `<a class="lnk" data-go="properties--${x.id}">${esc(p)}</a>` : esc(p); }).join(', '));
  if (e.mastery) { const x = allOf('properties').find(p => p.name === e.mastery && /mastery/i.test(p.kind)); P('Mastery', x ? `<a class="lnk" data-go="properties--${x.id}">${esc(e.mastery)}</a>` : esc(e.mastery)); }
  if (e.acS) P('Armor Class', esc(e.acS)); if (e.strMin) P('Strength', 'Str ' + e.strMin); if (e.stealth) P('Stealth', esc(e.stealth)); if (e.don) P('Don / Doff', esc(e.don));
  if (e.speedS) P('Speed', esc(e.speedS)); if (e.capacity) P('Capacity', esc(e.capacity));
  if (e.contents) P('Contents', esc(e.contents.join(', ')));
  return kv.length ? `<div class="kv">${kv.join('')}</div>` : '';
}
function magicHead(e) {
  return `<p style="font-style:italic;color:var(--ink2);margin:0 0 10px;font-family:var(--serif)">${esc(e.typeLine || [e.cat, e.rarity].filter(Boolean).join(', '))}</p><div class="kv"><b>Rarity</b><span class="${rarCls(e.rarity)}">${esc(e.rarity || '—')}</span><b>Attunement</b><span>${e.attune ? 'Required' + (e.attuneBy ? ' ' + esc(e.attuneBy) : '') : 'No'}</span>${e.cat ? `<b>Type</b><span>${esc(e.cat)}</span>` : ''}${e.variants && e.variants.length ? `<b>Variants</b><span>${esc(e.variants.join(', '))}</span>` : ''}</div>`;
}

// ---------- generic entity body (used by views, pins, peeks, hovers) ----------
function entityBody(t, e, opts = {}) {
  if (t === 'monsters') return renderMonster(e, { nosrc: opts.nosrc, lore: !opts.compact });
  if (t === 'spells') return renderSpell(e, { nosrc: opts.nosrc });
  if (t === 'items') return itemKV(e) + `<div class="rd">${renderBlocks(e.body)}</div>`;
  if (t === 'magic') return magicHead(e) + `<div class="rd">${renderBlocks(e.body)}</div>`;
  if (t === 'classes') return `<div class="rd">${renderBlocks((e.subclasses?.[0]?.body) || [])}</div><p><a class="btn ghost sm" href="#classes--${esc(e.id)}">Open class page</a></p>`;
  let pre = '';
  if (t === 'feats') pre = `<p style="font-style:italic;color:var(--ink2);margin:0 0 8px">${esc(e.type)} Feat${e.pre ? ` (Prerequisite: ${esc(e.pre)})` : ''}</p>`;
  if (t === 'races') pre = `<div class="kv"><b>Size</b><span>${esc(e.size || '—')}</span><b>Speed</b><span>${esc(e.speed || '—')}</span><b>Ability Scores</b><span>${esc(e.asi || '—')}</span>${e.subs && e.subs.length ? `<b>${e.ed === '2014' ? 'Subraces' : 'Options'}</b><span>${esc(e.subs.join(', '))}</span>` : ''}</div>`;
  if (t === 'poisons') pre = `<div class="kv"><b>Type</b><span>${esc(e.type)}</span><b>Price per dose</b><span>${esc(e.cost)}</span></div>`;
  if (t === 'skills' && e.ability) pre = `<p style="color:var(--ink2);margin:0 0 8px">Ability: <b>${esc(e.ability)}</b></p>`;
  if (t === 'languages') pre = `<div class="kv"><b>Type</b><span>${esc(e.type || '—')}</span>${e.script ? `<b>Script</b><span>${esc(e.script)}</span>` : ''}${e.speakers ? `<b>Typical speakers</b><span>${esc(e.speakers)}</span>` : ''}</div>`;
  if (t === 'properties') pre = `<p style="color:var(--ink2);margin:0 0 8px">${esc(e.kind || '')}</p>`;
  return pre + `<div class="rd">${renderBlocks(e.body)}</div>`;
}
