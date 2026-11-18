// Vanadium 5e — pages: lists, classes, rules reader, home, library, search, pins
// ---------- list pages ----------
const CRV = c => { if (typeof c === 'number') return c; const s = String(c ?? ''); const n = s.includes('/') ? (([a, b]) => a / b)(s.replace(/[^\d/]/g, '').split('/').map(Number)) : parseFloat(s); return isNaN(n) ? -1 : n; };
const RARO = { Common: 1, Uncommon: 2, Rare: 3, 'Very Rare': 4, Legendary: 5, Artifact: 6, Varies: 7 };
const byNum = (x, y) => (parseFloat(x) || 0) - (parseFloat(y) || 0);
const crCmp = (x, y) => CRV(x.replace(/^CR /, '')) - CRV(y.replace(/^CR /, ''));
const speedModes = m => ['fly', 'swim', 'climb', 'burrow'].filter(k => new RegExp('\\b' + k + '\\b', 'i').test(m.speed || '')).map(cap);
const dmgList = s => uniq(String(s || '').split(/[,;]\s*/).map(x => x.trim()).filter(x => /^(Acid|Bludgeoning|Cold|Fire|Force|Lightning|Necrotic|Piercing|Poison|Psychic|Radiant|Slashing|Thunder)$/i.test(x)).map(cap));
const nameCol = (e, label) => `${esc(label ?? e.name)}${EDF === 'all' || e.ed === 'hb' ? edBadge(e) : ''}`;
const LIST = {
  spells: {
    cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['Level', e => lvlShort(e.level), 'mu', e => e.level], ['School', e => e.school, 'mu'], ['Time', e => e.time.replace(/,.*$/, ''), 'mu'], ['Range', e => e.range, 'mu']],
    filters: [
      ['Level', e => e.level === 0 ? 'Cantrip' : 'Level ' + e.level, (x, y) => (parseInt(x.slice(6)) || 0) - (parseInt(y.slice(6)) || 0)], ['Class', e => e.classes, null, true], ['School', e => e.school],
      ['Casting time', e => /bonus/i.test(e.time) ? 'Bonus Action' : /reaction/i.test(e.time) ? 'Reaction' : /^1 action|^action$/i.test(e.time) ? 'Action' : 'Longer'],
      ['Concentration', e => e.conc ? 'Concentration' : 'No concentration'], ['Ritual', e => e.ritual ? 'Ritual' : 'Not a ritual'],
      ['Components', e => ['V', 'S', 'M'].filter(c => (e.compS || e.comp).includes(c)).map(c => ({ V: 'Verbal', S: 'Somatic', M: 'Material' }[c])), null, true],
      ['Damage type', e => e.dmg || [], null, true], ['Saving throw', e => e.save || null], ['Subclass', e => e.subclasses || [], null, true]
    ],
    text: e => e.name + ' ' + e.school + ' ' + (e.classes || []).join(' ') + ' ' + (e.body || []).map(b => strip(b.html || b.text || '')).join(' '),
    meta: e => spellLevelLine(e) + (e.classes?.length ? ' · ' + e.classes.join(', ') : '')
  },
  monsters: {
    cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['CR', e => e.cr, 'mu', e => CRV(e.crN ?? e.cr)], ['Type', e => e.tkey || e.type, 'mu'], ['Size', e => e.size, 'mu'], ['HP', e => e.hpN, 'mu', e => e.hpN || 0]],
    filters: [
      ['CR', e => 'CR ' + e.cr, crCmp], ['Type', e => e.tkey || e.type], ['Size', e => e.size, (x, y) => ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].indexOf(x) - ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'].indexOf(y)],
      ['Movement', e => speedModes(e), null, true], ['Legendary', e => (e.legendary || []).length ? 'Legendary' : 'Not legendary'], ['Spellcaster', e => e.spellcaster ? 'Spellcaster' : 'Not a spellcaster'],
      ['Deals damage', e => e.dmgTypes || [], null, true], ['Resists', e => dmgList(e.res), null, true], ['Immune to', e => dmgList(e.imm), null, true],
      ['Condition immunity', e => String(e.cimm || '').split(/,\s*/).filter(Boolean).map(cap), null, true], ['Alignment', e => e.align || null]
    ],
    text: e => e.name + ' ' + e.type + ' ' + (e.align || '') + ' ' + ['traits', 'actions', 'bonus', 'reactions', 'legendary'].flatMap(k => (e[k] || []).map(a => a.n + ' ' + strip(a.h))).join(' '),
    meta: e => `${e.size} ${e.type}, CR ${e.cr} (${xpS(e.xp)} XP)`,
    tools: e => `<button class="ibtn" data-addenc="${esc(e.id)}" title="Add to encounter">+ Encounter</button><button class="ibtn" data-addinit="${esc(e.id)}" title="Add to initiative tracker">+ Initiative</button>`
  },
  items: {
    cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['Category', e => e.sub || e.cat, 'mu'], ['Cost', e => e.cost, 'mu', e => e.costN || 0], ['Weight', e => e.weight, 'mu', e => e.weightN || 0]],
    filters: [['Category', e => e.cat], ['Subcategory', e => e.sub || null], ['Property', e => e.props || [], null, true], ['Mastery', e => e.mastery || null], ['Damage type', e => e.dmg ? cap(e.dmg.split(' ').pop()) : null]],
    meta: e => [e.cat, e.sub].filter(Boolean).join(' · ')
  },
  magic: {
    cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['Rarity', e => e.rarity, 'mu', e => RARO[e.rarity] || 9, e => `<span class="${rarCls(e.rarity)}">${esc(e.rarity)}</span>`], ['Type', e => e.cat, 'mu'], ['Attune', e => e.attune ? 'Yes' : '—', 'mu']],
    filters: [['Rarity', e => e.rarity, (x, y) => (RARO[x] || 9) - (RARO[y] || 9)], ['Type', e => e.cat], ['Attunement', e => e.attune ? 'Requires attunement' : 'No attunement']],
    meta: e => e.typeLine || e.rarity
  },
  races: { cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['Size', e => e.size, 'mu'], ['Speed', e => e.speed, 'mu'], ['Ability', e => e.asi, 'mu']], filters: [['Size', e => e.size]], meta: e => e.ed === '2014' ? 'Race' : 'Species' },
  backgrounds: { cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['Skills', e => e.skills, 'mu'], ['Feat / Feature', e => e.feat, 'mu']], filters: [], meta: e => 'Background' },
  feats: { cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['Type', e => e.type, 'mu'], ['Prerequisite', e => e.pre || '—', 'mu']], filters: [['Type', e => e.type]], meta: e => e.type + ' feat' },
  conditions: { cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)]], filters: [], meta: () => 'Condition' },
  skills: { cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['Ability', e => e.ability, 'mu']], filters: [['Ability', e => e.ability]], meta: e => (e.ability || '') + ' skill' },
  languages: { cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['Type', e => e.type, 'mu'], ['Script', e => e.script, 'mu']], filters: [['Type', e => e.type]], meta: e => (e.type || '') + ' language' },
  properties: { cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['Kind', e => e.kind, 'mu']], filters: [['Kind', e => e.kind]], meta: e => e.kind },
  damage: { cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)]], filters: [], meta: () => 'Damage type' },
  poisons: { cols: [['Name', e => e.name, 'nm', null, e => nameCol(e)], ['Type', e => e.type, 'mu'], ['Cost', e => e.cost, 'mu', e => parseFloat(e.cost) || 0]], filters: [['Type', e => e.type]], meta: e => e.type + ' poison' }
};
function entityView(type, e) {
  const cfg = LIST[type] || {};
  return `<div class="ent-h"><div style="flex:1"><h2>${esc(e.name)}</h2><div class="meta">${esc(cfg.meta ? cfg.meta(e) : TYPES[type].one)} · ${edBadge(e)} ${esc(srcName(e))}</div></div><div class="ent-tools">${cfg.tools ? cfg.tools(e) : ''}<button class="ibtn ${isPinned(type, e.id) ? 'on' : ''}" data-pin="${type}--${esc(e.id)}" title="Pin">★</button></div></div>${entityBody(type, e)}`;
}
const LSTATE = {};
let curList = null, lastType = null;
function listPage(type, sel) {
  const cfg = LIST[type], items = itemsOf(type);
  const filters = [...(EDF === 'all' || (HB[type] || []).length ? [['Source', e => srcName(e)]] : []), ...cfg.filters];
  const st = LSTATE[type] = LSTATE[type] || { q: '', f: {}, sort: null, dir: 1, open: false };
  const main = $('#main');
  main.innerHTML = `<div class="lp"><div class="lp-left"><div class="lp-head"><h1>${TYPES[type].label}<small id="lcount"></small></h1>
    <div class="frow"><input id="lq" type="search" placeholder="Filter ${TYPES[type].label.toLowerCase()}…" value="${esc(st.q)}">${filters.length ? `<button class="fbtn ${!isMob && st.open ? 'on' : ''}" id="lfb">Filters<span id="fcount"></span></button>` : ''}<button class="fbtn" id="lreset" title="Reset">Reset</button></div>
    <div class="chips" id="lchips"></div></div><div class="filters ${!isMob && st.open ? 'on' : ''}" id="lfilters"></div>
    <div class="ltable"><table class="list"><thead><tr>${cfg.cols.map((c, i) => `<th data-c="${i}">${c[0]}</th>`).join('')}</tr></thead><tbody id="lbody"></tbody></table></div></div>
    <div class="lp-right" id="lview"><div class="empty">Select an entry from the list.</div></div></div>`;
  const groups = filters.map(([name, fn, cmp]) => {
    const vals = uniq(items.flatMap(e => { const v = fn(e); return Array.isArray(v) ? v : [v]; }).map(String));
    vals.sort(cmp || ((a, b) => String(a).localeCompare(String(b))));
    return { name, fn, vals };
  }).filter(g => g.vals.length > 1 || (st.f[g.name] && Object.keys(st.f[g.name]).length));
  const fwrap = $('#lfilters');
  fwrap.innerHTML = `<div class="shead"><b>Filters</b><button class="btn" id="fdone">Show results</button></div>` + groups.map((g, gi) => `<div class="fg"><div class="fg-h">${esc(g.name)}<button data-all="${gi}">clear</button></div><div class="pills">${g.vals.map(v => {
    const s = (st.f[g.name] || {})[v]; return `<span class="pill ${s === 1 ? 'inc' : s === -1 ? 'exc' : ''}" data-g="${gi}" data-v="${esc(v)}">${esc(v)}</span>`;
  }).join('')}</div></div>`).join('');
  fwrap.onclick = e => {
    const p = e.target.closest('.pill');
    if (p) {
      const g = groups[p.dataset.g]; const m = st.f[g.name] = st.f[g.name] || {}; const v = p.dataset.v;
      m[v] = m[v] === 1 ? -1 : m[v] === -1 ? 0 : 1; if (!m[v]) delete m[v];
      p.className = 'pill ' + (m[v] === 1 ? 'inc' : m[v] === -1 ? 'exc' : ''); refresh(); return;
    }
    const c = e.target.closest('[data-all]'); if (c) { delete st.f[groups[c.dataset.all].name]; $$(`.pill[data-g="${c.dataset.all}"]`, fwrap).forEach(p => p.className = 'pill'); refresh(); }
    if (e.target.closest('#fdone')) closeFilters();
  };
  const openFilters = () => { fwrap.classList.add('on'); if (isMob) showScrim(closeFilters); };
  const closeFilters = () => { fwrap.classList.remove('on'); hideScrim(); };
  if ($('#lfb')) $('#lfb').onclick = () => {
    if (isMob) { fwrap.classList.contains('on') ? closeFilters() : openFilters(); return; }
    st.open = !st.open; fwrap.classList.toggle('on', st.open); $('#lfb').classList.toggle('on', st.open);
  };
  $('#lreset').onclick = () => { LSTATE[type] = null; listPage(type, curSel()); };
  const textOf = cfg.text ? (e => (e._t = e._t || cfg.text(e).toLowerCase())) : (e => (e._t = e._t || (e.name + ' ' + (e.body || []).map(b => strip(b.html || b.text || '')).join(' ')).toLowerCase()));
  const curSel = () => (decodeURIComponent(location.hash).split('--')[1] || null);
  let rows = [];
  function refresh() {
    const toks = st.q.toLowerCase().split(/\s+/).filter(Boolean);
    rows = items.filter(e => {
      for (const g of groups) {
        const m = st.f[g.name]; if (!m) continue;
        const v = g.fn(e); const arr = (Array.isArray(v) ? v : [v]).map(String);
        const inc = Object.keys(m).filter(k => m[k] === 1), exc = Object.keys(m).filter(k => m[k] === -1);
        if (inc.length && !arr.some(x => inc.includes(x))) return false;
        if (exc.length && arr.some(x => exc.includes(x))) return false;
      }
      if (toks.length) { const nm = e.name.toLowerCase(); if (!toks.every(t => nm.includes(t) || textOf(e).includes(t))) return false; }
      return true;
    });
    if (toks.length) { const t0 = toks.join(' '); rows.sort((a, b) => (b.name.toLowerCase().includes(t0)) - (a.name.toLowerCase().includes(t0))); }
    if (st.sort != null) {
      const c = cfg.cols[st.sort]; const k = c[3] || c[1];
      rows = rows.slice().sort((a, b) => { const x = k(a), y = k(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * st.dir || a.name.localeCompare(b.name); });
    }
    const s = curSel();
    const lim = Math.min(rows.length, 800);
    $('#lbody').innerHTML = rows.length ? rows.slice(0, lim).map(e => `<tr class="r ${e.id === s ? 'sel' : ''}" data-id="${esc(e.id)}">${cfg.cols.map(c => `<td class="${c[2] || ''}">${c[4] ? c[4](e) : esc(c[1](e))}</td>`).join('')}</tr>`).join('') + (rows.length > lim ? `<tr><td colspan="9" class="empty">${rows.length - lim} more — refine your filter.</td></tr>` : '') : `<tr><td colspan="9" class="empty">No matches.</td></tr>`;
    $('#lcount').textContent = rows.length + ' / ' + items.length;
    $$('th', main).forEach(th => th.className = +th.dataset.c === st.sort ? (st.dir > 0 ? 's-asc' : 's-desc') : '');
    const chips = []; let nf = 0;
    for (const g of groups) { const m = st.f[g.name] || {}; for (const k in m) { nf++; chips.push(`<span class="chip ${m[k] > 0 ? 'inc' : 'exc'}" data-cg="${esc(g.name)}" data-cv="${esc(k)}">${esc(g.name)}: ${m[k] < 0 ? 'not ' : ''}${esc(k)} ×</span>`); } }
    $('#lchips').innerHTML = chips.join('');
    if ($('#fcount')) $('#fcount').textContent = nf ? ` (${nf})` : '';
    if ($('#fdone')) $('#fdone').textContent = `Show ${rows.length} result${rows.length === 1 ? '' : 's'}`;
  }
  $('#lchips').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; delete st.f[c.dataset.cg][c.dataset.cv]; listPage(type, curSel()); };
  $('#lq').oninput = e => { st.q = e.target.value; refresh(); };
  $('#lq').onkeydown = e => { if (e.key === 'Enter' && rows[0]) go(type + '--' + rows[0].id); };
  $$('th', main).forEach(th => th.onclick = () => { const c = +th.dataset.c; if (st.sort === c) st.dir *= -1; else { st.sort = c; st.dir = 1; } refresh(); });
  $('#lbody').onclick = e => { const tr = e.target.closest('tr.r'); if (tr) go(type + '--' + tr.dataset.id); };
  refresh();
  curList = type;
  showEntity(type, sel);
}
function showEntity(type, id) {
  const e = id && BYID[type][id], v = $('#lview'); if (!v) return;
  $$('#lbody tr.r').forEach(tr => tr.classList.toggle('sel', tr.dataset.id === id));
  $('.lp').classList.toggle('detail', !!e);
  if (!e) { v.innerHTML = `<div class="empty">Select an entry from the list.</div>`; document.title = TYPES[type].label + ' — Vanadium 5e'; return; }
  v.innerHTML = `<div class="backbar"><button data-back="${type}">${ICON.back}${esc(TYPES[type].label)}</button><span class="sp"></span></div>` + entityView(type, e);
  v.scrollTop = 0; enhance(v);
  const tr = $(`#lbody tr[data-id="${CSS.escape(id)}"]`);
  if (tr && !isMob) { const box = tr.closest('.ltable'); const r = tr.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.top < b.top + 28 || r.bottom > b.bottom) tr.scrollIntoView({ block: 'center' }); }
  document.title = e.name + ' — Vanadium 5e';
}

// ---------- class pages ----------
let clsTab = 'features', clsSub = store.get('clssub', {});
function classPage(id) {
  const list = itemsOf('classes');
  const c = BYID.classes[id] || list[0];
  if (!c) { $('#main').innerHTML = '<div class="empty">No classes for this edition.</div>'; return; }
  const spells = itemsOf('spells').filter(s => s.ed === c.ed && (s.classes || []).includes(c.name));
  const subs = c.subclasses || [];
  const tabs = [['features', 'Class features'], ...(subs.length ? [['sub', subs.length > 1 ? 'Subclasses' : 'Subclass']] : []), ...(spells.length ? [['spells', `Spells (${spells.length})`]] : [])];
  if (!tabs.some(t => t[0] === clsTab)) clsTab = 'features';
  const navName = x => esc(x.name) + (EDF === 'all' ? ' ' + edBadge(x) : '');
  $('#main').innerHTML = `<div class="cls"><div class="mchips">${list.map(x => `<a class="${x.id === c.id ? 'cur' : ''}" href="#classes--${esc(x.id)}">${esc(x.name)}${EDF === 'all' ? ' ' + x.ed.slice(2) : ''}</a>`).join('')}</div><div class="cls-nav">${list.map(x => `<a class="cn ${x.id === c.id ? 'cur' : ''}" href="#classes--${esc(x.id)}">${navName(x)}</a>${x.id === c.id ? `<div class="sub">${c.features.map((f, i) => `<a data-jump="cf-${i}">${esc(f.name)}</a>`).join('')}</div>` : ''}`).join('')}</div>
   <div class="cls-main" id="cmain"><div class="cls-head"><h1>${esc(c.name)}</h1><div class="stats">
     <div class="stat">Hit Die<b>d${esc(c.hd)}</b></div>${c.primary ? `<div class="stat">Primary ability<b>${esc(c.primary)}</b></div>` : ''}<div class="stat">Saving throws<b>${esc(c.saves || '—')}</b></div>${c.spellAbility ? `<div class="stat">Spellcasting<b>${esc(c.spellAbility)}</b></div>` : ''}<div class="stat">Source<b>${esc(srcName(c))}</b></div></div>
     <div class="ent-tools"><button class="ibtn ${isPinned('classes', c.id) ? 'on' : ''}" data-pin="classes--${esc(c.id)}">★</button></div></div>
     <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${clsTab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
     <div id="ctab"></div></div></div>`;
  const cur = $('.mchips a.cur'); if (cur) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
  const feat = (f, i, pre) => `<div class="feat5" id="${pre}-${i}"><h3>${esc(f.name)}<span class="lv">Level ${f.level}</span></h3><div class="rd">${renderBlocks(f.body, { hbase: 1 })}</div></div>`;
  const draw = () => {
    const box = $('#ctab');
    if (clsTab === 'features') {
      box.innerHTML = `<div class="kv">${c.info.map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join('')}</div>
        <h3 style="margin:18px 0 8px;font-size:18px">The ${esc(c.name)}</h3><div class="ctbl tblw"><table class="dt"><thead><tr>${c.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${c.table.rows.map(r => `<tr>${r.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
        ${c.spellcasting && c.spellcasting.length ? `<div class="rd" style="margin-top:14px"><aside><div class="ah">Spellcasting</div>${renderBlocks(c.spellcasting)}</aside></div>` : ''}
        <h3 style="margin:22px 0 4px;font-size:18px">Class features</h3>${c.features.map((f, i) => feat(f, i, 'cf')).join('')}`;
    } else if (clsTab === 'sub') {
      const sid = clsSub[c.id] && subs.find(s => s.id === clsSub[c.id]) ? clsSub[c.id] : subs[0].id;
      const s = subs.find(x => x.id === sid);
      box.innerHTML = `${subs.length > 1 ? `<div class="subsel">${subs.map(x => `<span class="pill ${x.id === sid ? 'inc' : ''}" data-sub="${esc(x.id)}">${esc(x.name)}</span>`).join('')}</div>` : ''}
        <h2 style="font-size:26px;margin:4px 0 2px">${esc(s.name)}</h2><div style="color:var(--ink3);margin-bottom:10px">${esc(s.flavor)}${s.src ? ' · ' + esc(s.src) : ''}</div><div class="rd">${renderBlocks(s.body)}</div>
        ${(s.spells || []).length ? `<div class="tblw"><table class="dt" style="max-width:820px"><thead><tr><th>Level</th><th>Spells</th></tr></thead><tbody>${Object.entries(s.spells.reduce((a, x) => ((a[x.pre || '—'] = a[x.pre || '—'] || []).push(x.name), a), {})).map(([k, v]) => `<tr><td>${esc(k.replace(/^.*?(\d+)$/, 'Level $1'))}</td><td>${v.map(n => { const sp = allOf('spells').find(q => q.name === n && q.ed === c.ed); return sp ? `<a class="lnk" data-go="spells--${sp.id}">${esc(n)}</a>` : esc(n); }).join(', ')}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${s.features.map((f, i) => feat(f, i, 'sf')).join('') || '<div class="empty">No features listed.</div>'}`;
      $$('[data-sub]', box).forEach(p => p.onclick = () => { clsSub[c.id] = p.dataset.sub; store.set('clssub', clsSub); draw(); });
    } else {
      const by = {}; spells.forEach(s => (by[s.level] = by[s.level] || []).push(s));
      box.innerHTML = `<p class="note" style="margin-top:0">${esc(c.name)} spell list (${esc(srcName(c))}). Hover a spell to preview it.</p><div class="splist">${Object.keys(by).sort((a, b) => a - b).map(l => `<h4>${l == 0 ? 'Cantrips' : ORD(+l) + ' level'}</h4>${by[l].sort((a, b) => a.name.localeCompare(b.name)).map(s => `<a class="lnk" style="border:0" data-go="spells--${esc(s.id)}">${esc(s.name)}${s.conc ? ' <span class="tagc conc" style="font-size:10px">C</span>' : ''}${s.ritual ? ' <span class="tagc" style="font-size:10px">R</span>' : ''}</a>`).join('')}`).join('')}</div>`;
    }
    enhance(box);
  };
  $$('.tab').forEach(t => t.onclick = () => { clsTab = t.dataset.tab; $$('.tab').forEach(x => x.classList.toggle('on', x === t)); draw(); });
  $$('[data-jump]').forEach(a => a.onclick = () => { if (clsTab !== 'features') { clsTab = 'features'; $$('.tab').forEach(x => x.classList.toggle('on', x.dataset.tab === 'features')); draw(); } const el = document.getElementById(a.dataset.jump); if (el) el.scrollIntoView({ behavior: 'smooth' }); });
  draw();
  document.title = c.name + ' — Vanadium 5e';
}
function classIndex() {
  const list = itemsOf('classes');
  $('#main').innerHTML = `<div class="home"><div class="hwrap"><div class="gsec">Classes</div><div class="grid">${list.map(c => `<a class="tile" href="#classes--${esc(c.id)}"><b>${esc(c.name)} ${EDF === 'all' ? edBadge(c) : ''}</b><span>${esc(strip(c.subclasses?.[0]?.body?.[0]?.html || '') ? 'd' + c.hd + ' Hit Die · ' + (c.primary || c.saves) : 'd' + c.hd + ' Hit Die · Saves: ' + c.saves)}</span><em>${c.features.length} features · ${(c.subclasses || []).length} subclass${(c.subclasses || []).length === 1 ? '' : 'es'}</em></a>`).join('')}</div></div></div>`;
  document.title = 'Classes — Vanadium 5e';
}

// ---------- rules reader ----------
function bookPage(ch, anchor) {
  const chs = D.book.filter(c => c.blocks.length);
  let c = chs.find(x => x.id === ch) || D.book.find(x => x.id === ch && x.isPart) && chs.find(x => x.part === D.book.find(y => y.id === ch).title) || chs[0];
  const ci = chs.indexOf(c);
  const curPart = c.part;
  const nav = D.book.map(x => {
    if (x.isPart) { const kids = chs.filter(k => k.part === x.title); return `<a class="part ${curPart === x.title ? 'open' : ''}" href="#book--${kids[0]?.id}">${esc(x.title)}<span>${kids.length}</span></a>`; }
    if (x.part !== curPart) return '';
    let s = `<a class="ch sub ${x.id === c.id ? 'cur' : ''}" href="#book--${x.id}">${esc(x.title)}</a>`;
    if (x.id === c.id) s += x.blocks.filter(b => b.t === 'h' && b.lvl <= 4).map(b => `<a class="l${b.lvl - 2} sub" data-jump="h-${b.id}">${esc(b.text)}</a>`).join('');
    return s;
  }).join('') + `<a class="part" href="#screen">DM Screen<span>›</span></a>`;
  const prev = chs[ci - 1], next = chs[ci + 1];
  $('#main').innerHTML = `<div class="bk"><div class="bk-nav" id="bnav"><div class="bk-books" style="font-weight:600;font-size:13px;color:var(--ink2)">System Reference Document 5.1</div>${nav}</div><div class="bk-main" id="bmain"><div class="chap-part">${esc(c.part || '')}</div><h1 class="chap-title">${esc(c.title)}</h1><div class="rd">${renderBlocks(c.blocks, { book: true })}</div>
    <div class="bk-pager">${prev ? `<a class="ibtn" href="#book--${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="ibtn" href="#book--${next.id}">${esc(next.title)} →</a>` : ''}</div>
    <p class="attrib" style="margin:30px auto 0;max-width:820px">From the System Reference Document 5.1 by Wizards of the Coast LLC, licensed under CC-BY-4.0.</p></div>
    <button class="mtoc-btn" id="mtoc"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 6h16M4 12h16M4 18h10"/></svg>Contents</button></div>`;
  const bm = $('#bmain'); enhance(bm);
  const nv = $('#bnav');
  $('#mtoc').onclick = () => { nv.classList.add('on'); showScrim(() => nv.classList.remove('on')); };
  $$('#bnav a').forEach(a => a.addEventListener('click', () => { if (isMob) { nv.classList.remove('on'); hideScrim(); } }));
  $$('#bnav [data-jump]').forEach(a => a.onclick = () => { const el = document.getElementById(a.dataset.jump); if (el) el.scrollIntoView({ behavior: isMob ? 'auto' : 'smooth' }); });
  const cn = $('#bnav .ch.cur'); if (cn && !isMob) cn.scrollIntoView({ block: 'center' });
  if (anchor) { const el = document.getElementById('h-' + anchor); if (el) { el.scrollIntoView(); el.style.transition = 'background 1.5s'; el.style.background = 'var(--accsoft)'; setTimeout(() => el.style.background = '', 1600); } }
  else bm.scrollTop = 0;
  document.title = c.title + ' — SRD Rules';
}

// ---------- home ----------
function home() {
  const feats = [['encounter', 'Encounter Builder', 'Budget XP, see difficulty', 'swords', 'acc'], ['initiative', 'Initiative Tracker', 'Turns, HP and conditions', 'list', 'steel'], ['screen', 'DM Screen', 'DCs, cover, travel, exhaustion', 'screen', 'gold'], ['loot', 'Random Magic Item', 'Roll treasure by rarity', 'gem', 'moss'], ['import', 'Import 5etools JSON', 'Add homebrew & your own data', 'upload', 'acc']];
  const blurb = {
    spells: 'Every spell with filters by class, level, school and more', monsters: 'Stat blocks with clickable dice, filters by CR, type and traits', items: 'Weapons, armor, gear, tools, mounts and packs', magic: 'Wondrous items, weapons, armor, potions, by rarity',
    classes: 'Class tables, features by level, subclasses, spell lists', races: 'Traits, sizes and lineages', backgrounds: 'Proficiencies, feats and equipment', feats: 'Origin, general, fighting style and epic boons',
    conditions: 'Blinded, charmed, prone and the rest', skills: 'What each skill covers', languages: 'Standard and exotic languages', properties: 'Weapon properties and masteries', damage: 'Acid to thunder', poisons: 'Contact, ingested, inhaled, injury'
  };
  const tiles = [
    ['Rules', [['book', 'SRD Rules', 'Combat, adventuring, spellcasting, equipment'], ['screen', 'DM Screen', 'Quick reference tables'], ['conditions'], ['skills'], ['properties'], ['languages']]],
    ['Character options', [['classes'], ['races'], ['backgrounds'], ['feats'], ['spells']]],
    ['Bestiary & treasure', [['monsters'], ['items'], ['magic'], ['poisons'], ['damage']]],
    ['Your stuff', [['library', 'Library & sources', 'SRD editions and your imports'], ['pinned', 'Pinned items', 'Your starred spells, monsters and rules']]]
  ];
  $('#main').innerHTML = `<div class="home"><div class="hero"><h1>Fifth edition, at your fingertips</h1><p>A fast, searchable reference for rules, spells, monsters and items, with tools for running the game. Showing <b>${EDF === 'all' ? '2014 + 2024' : EDF}</b> rules.</p>
    <div class="hsearch">${ico('search', 20)}<input id="hq" placeholder="Search spells, monsters, items, rules…" ${isMob ? 'readonly' : ''}><kbd>/</kbd></div>
    <div class="hchips">${[['spells', 'Spells'], ['monsters', 'Bestiary'], ['magic', 'Magic Items'], ['classes', 'Classes'], ['book', 'Rules']].map(([k, l]) => `<a href="#${k}">${l}</a>`).join('')}</div></div>
    <div class="hwrap"><div class="gsec">Run the game</div><div class="feats">${feats.map(([k, l, d, ic, c]) => `<a class="feat" href="#${k}"><span class="fi fi-${c}">${ico(ic, 20)}</span><b>${l}</b><span>${d}</span></a>`).join('')}</div>
    ${tiles.map(([sec, ts]) => `<div class="gsec">${sec}</div><div class="grid">` + ts.map(([k, l, d]) => `<a class="tile" href="#${k}"><b>${esc(l || TYPES[k].label)}</b><span>${esc(d || blurb[k] || '')}</span>${TYPES[k] ? `<em>${itemsOf(k).length} entries</em>` : ''}</a>`).join('') + '</div>').join('')}</div></div>`;
  const hq = $('#hq');
  if (isMob) hq.onclick = openMSearch;
  else { hq.oninput = () => { $('#q').value = hq.value; doSearch(hq.value, hq); }; hq.onkeydown = e => searchKeys(e); hq.focus({ preventScroll: true }); }
  document.title = 'Vanadium — 5e Reference';
}

// ---------- library ----------
function libraryPage() {
  const cnt = (ed, pk) => Object.keys(TYPES).map(t => [t, (pk ? (pk.data[t] || []) : (D[t] || []).filter(e => e.ed === ed)).length]).filter(x => x[1]).map(([t, n]) => `${n} ${TYPES[t].label.toLowerCase()}`).join(' · ');
  const card = (kind, title, desc, acts, cls) => `<div class="bookc ${cls || ''}"><div class="kind">${kind}</div><b>${esc(title)}</b><div class="cnt">${desc}</div><div class="acts">${acts}</div></div>`;
  $('#main').innerHTML = `<div class="lib"><h1>Library</h1><p class="note">Everything Vanadium 5e knows about. The built-in content is the open System Reference Documents; anything you import lives only in this browser.</p>
    <div class="books">
      ${card('Core rules · 2014', 'SRD 5.1', esc(cnt('2014')) + ' · rules chapters', `<a class="btn" href="#book">Read rules</a><button class="btn ghost" data-edf="2014">Use 2014</button>`, 'k-core')}
      ${card('Core rules · 2024', 'SRD 5.2', esc(cnt('2024')), `<button class="btn" data-edf="2024">Use 2024</button><button class="btn ghost" data-edf="all">Show both</button>`, 'k-core')}
      ${PACKS.map(p => card('Imported · ' + esc(p.fileName || 'JSON'), p.title, esc(cnt(null, p) || 'empty'), `<button class="btn danger" data-delpack="${esc(p.id)}">Remove</button>`, 'k-adventure')).join('')}
      <a class="bookc" href="#import" style="text-decoration:none;color:var(--ink);border-style:dashed;justify-content:center"><div class="kind">Add content</div><b>Import 5etools JSON →</b><div class="cnt">Homebrew and your own data in 5etools format</div></a>
    </div>
    <div class="mine" id="updbox" style="max-width:760px"></div>
    <div class="attrib"><b>Legal.</b> This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) and the System Reference Document 5.2 (“SRD 5.2”) by Wizards of the Coast LLC, available at <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener">dndbeyond.com/srd</a>. The SRD 5.1 and SRD 5.2 are licensed under the Creative Commons Attribution 4.0 International License, available at <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noopener">creativecommons.org/licenses/by/4.0/legalcode</a>. Structured data from the 5e-bits <a href="https://github.com/5e-bits/5e-database" target="_blank" rel="noopener">5e-database</a> (MIT). Vanadium is not affiliated with or endorsed by Wizards of the Coast. Data built ${esc(D.meta?.built || '')}.</div></div>`;
  document.title = 'Library — Vanadium 5e';
  updaterBox();
}

// ---------- site updater (deploy/update.php on the server) ----------
let updTimer = null;
async function updaterBox(msg) {
  const box = $('#updbox'); if (!box) return;
  clearInterval(updTimer);
  let st = null;
  try { const r = await fetch('update.php', { cache: 'no-store', credentials: 'same-origin' }); if (r.ok && /json/.test(r.headers.get('content-type') || '')) st = await r.json(); } catch (e) { }
  if (!$('#updbox')) return;
  if (!st) { box.innerHTML = `<h2>Site updates</h2><div class="note">The updater isn’t installed on this server (upload <code>deploy/update.php</code> next to <code>index.html</code> to enable the update button).</div>`; return; }
  let left = st.next_allowed_in || 0;
  const when = st.updated_at ? new Date(st.updated_at).toLocaleString() : 'never (installed by hand)';
  box.innerHTML = `<h2>Site updates</h2><div class="it"><div class="t"><b>${st.commit ? 'Version ' + esc(st.commit.slice(0, 7)) : 'Unknown version'}</b><span>Last update: ${esc(when)}${st.last_result ? ' · ' + esc(st.last_result) : ''}</span>${msg ? `<span style="display:block;color:var(--ink);margin-top:2px">${msg}</span>` : ''}</div><button class="btn" id="updgo">Update from GitHub</button></div><div class="note" style="font-size:12.5px">Downloads the latest version of <code>${esc(st.repo)}</code> (${esc(st.branch)}) onto this server. Anyone can press it, at most once every ${Math.round(st.cooldown / 60)} minutes.</div>`;
  const btn = $('#updgo');
  const tick = () => { if (left > 0) { btn.disabled = true; btn.textContent = `Available in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; left--; } else { btn.disabled = false; btn.textContent = 'Update from GitHub'; clearInterval(updTimer); } };
  tick(); if (left > 0) updTimer = setInterval(tick, 1000);
  btn.onclick = async () => {
    const h = {};
    if (st.needs_key) { const k = prompt('Update password:'); if (!k) return; h['X-Update-Key'] = k; }
    btn.disabled = true; btn.textContent = 'Updating…';
    let res;
    try { const r = await fetch('update.php', { method: 'POST', headers: h, cache: 'no-store', credentials: 'same-origin' }); res = await r.json(); }
    catch (e) { res = { ok: false, error: 'the server didn’t answer (' + e.message + ')' }; }
    if (res.status === 'updated') {
      toast('Updated, reloading…');
      try { // refresh this browser's cached copies of the app files, then reload
        const files = ['./', 'index.html', ...$$('script[src]').map(s => s.getAttribute('src'))];
        await Promise.all(files.map(f => fetch(f, { cache: 'reload' }).catch(() => { })));
        for (const k of await caches.keys()) if (k.startsWith('v5-')) await caches.delete(k);
      } catch (e) { }
      setTimeout(() => location.reload(), 400); return;
    }
    updaterBox(res.status === 'current' ? 'Already up to date.' : res.status === 'cooldown' ? 'Someone updated recently. Try again when the timer runs out.' : `<span style="color:var(--bad)">Update failed: ${esc(res.error || 'unknown error')}</span>`);
  };
}
async function deletePack(id) {
  const p = PACKS.find(x => x.id === id); if (!p) return;
  if (!await confirmSheet(`Remove “${p.title}” from this browser? You can import it again later.`, 'Remove')) return;
  try { await IDB.del(id); } catch (e) { }
  removePack(id); rebuildIndex(); buildIndex(); buildMenu(); toast('Removed'); route();
}

// ---------- pinned ----------
function pinnedPage() {
  const valid = pins.map(k => { const [t, id] = k.split('--'); return [t, BYID[t] && BYID[t][id], k]; }).filter(x => x[1]);
  const mons = valid.filter(x => x[0] === 'monsters'), sps = valid.filter(x => x[0] === 'spells'), rest = valid.filter(x => x[0] !== 'monsters' && x[0] !== 'spells');
  $('#main').innerHTML = `<div class="pinpage"><h1>Pinned Items</h1><div class="note">Star (★) any spell, creature or entry to collect it here: a character's spell sheet or tonight's monsters. Saved in this browser only. ${valid.length ? '<button class="ibtn" id="clrpins" style="display:inline-flex;margin-left:8px">Clear all</button>' : ''}</div>
   ${!valid.length ? '<div class="empty">Nothing pinned yet.</div>' : ''}
   ${mons.length ? `<h2 class="abgh" style="margin-bottom:8px">Creatures · ${xpS(mons.reduce((s, x) => s + (x[1].xp || 0), 0))} XP total</h2><div class="pincols">${mons.map(x => renderMonster(x[1])).join('')}</div>` : ''}
   ${sps.length ? `<h2 class="abgh" style="margin-bottom:8px">Spells</h2><div class="pincols">${sps.sort((a, b) => a[1].level - b[1].level).map(x => renderSpell(x[1])).join('')}</div>` : ''}
   ${rest.map(([t, e]) => `<div class="pincard">${entityView(t, e)}</div>`).join('')}</div>`;
  if ($('#clrpins')) $('#clrpins').onclick = () => { pins = []; store.set('pins', pins); updatePins(); pinnedPage(); };
  enhance($('#main'));
  document.title = 'Pinned — Vanadium 5e';
}

// ---------- search ----------
let SIDX = [];
const TPRI = { conditions: 0, classes: 0, spells: 1, monsters: 1, chapter: 1, races: 1, magic: 2, items: 2, feats: 2, backgrounds: 2, rule: 5, page: 0 };
const PAGES = [['encounter', 'Encounter Builder'], ['initiative', 'Initiative Tracker'], ['screen', 'DM Screen'], ['loot', 'Random Magic Item'], ['import', 'Import 5etools JSON'], ['library', 'Library'], ['roller', 'Dice Roller']];
function buildIndex() {
  SIDX = [];
  Object.keys(TYPES).forEach(t => itemsOf(t).forEach(e => SIDX.push({
    t, id: e.id, n: e.name, l: e.name.toLowerCase(), ed: e,
    ex: t === 'spells' ? lvlShort(e.level) + ' ' + e.school : t === 'monsters' ? 'CR ' + e.cr + ' ' + (e.tkey || '') : t === 'magic' ? e.rarity : t === 'items' ? (e.sub || e.cat) : t === 'feats' ? e.type : ''
  })));
  for (const c of D.book) {
    if (c.isPart) continue;
    SIDX.push({ t: 'chapter', id: c.id, n: c.title, l: c.title.toLowerCase(), ex: c.part });
    c.blocks.forEach(b => { if (b.t === 'h' && b.text.length < 80) SIDX.push({ t: 'rule', id: c.id + '--' + b.id, n: b.text, l: b.text.toLowerCase(), ex: c.title }); });
  }
  PAGES.forEach(([k, n]) => SIDX.push({ t: 'page', id: k, n, l: n.toLowerCase(), ex: 'Tool' }));
}
let sresults = [], ssel = 0;
function runSearch(q) {
  const s = q.trim().toLowerCase(); if (!s) return [];
  const toks = s.split(/\s+/); const res = [];
  for (const it of SIDX) {
    if (!toks.every(t => it.l.includes(t))) continue;
    let sc = it.l === s ? 0 : it.l.startsWith(s) ? 10 : it.l.includes(s) ? 20 : 30;
    sc += (TPRI[it.t] ?? 4) + it.l.length / 100 + (it.ed && it.ed.ed === '2014' && EDF === 'all' ? 0.5 : 0);
    res.push([sc, it]);
  }
  res.sort((a, b) => a[0] - b[0]);
  const seen = new Set(), out = [];
  for (const [, it] of res) { if (it.t === 'rule' && seen.has(it.l)) continue; seen.add(it.l + (it.t === 'rule' ? '' : it.t + it.id)); out.push(it); if (out.length >= 50) break; }
  return out;
}
const tyLabel = it => it.t === 'rule' ? 'Rule' : it.t === 'chapter' ? 'Chapter' : it.t === 'page' ? 'Tool' : TYPES[it.t].one;
const srHtml = list => list.map((it, i) => `<div class="sr ${i === 0 && !isMob ? 'sel' : ''}" data-i="${i}"><span class="ty">${esc(tyLabel(it))}</span><span class="nm">${esc(it.n)}${it.ed && EDF === 'all' ? ' ' + edBadge(it.ed) : ''}</span><span class="ex">${esc(it.ex || '')}</span></div>`).join('');
function doSearch(q, anchorEl) {
  const box = $('#sres');
  sresults = runSearch(q); ssel = 0;
  if (!q.trim()) { box.classList.remove('on'); return; }
  box.innerHTML = sresults.length ? srHtml(sresults) : `<div class="sr"><span class="nm">No results${EDF !== 'all' ? ' — try showing both editions' : ''}</span></div>`;
  if (anchorEl && anchorEl.id === 'hq') { const r = anchorEl.getBoundingClientRect(); Object.assign(box.style, { position: 'fixed', top: (r.bottom + 4) + 'px', left: r.left + 'px', width: r.width + 'px', right: 'auto' }); }
  else Object.assign(box.style, { position: '', top: '', left: '', width: '', right: '' });
  box.classList.add('on');
}
function openResult(it) {
  if (!it) return;
  $('#sres').classList.remove('on'); $('#q').value = ''; $('#q').blur(); closeMSearch();
  if (it.t === 'rule' || it.t === 'chapter') go('book--' + it.id); else if (it.t === 'page') go(it.id); else go(it.t + '--' + it.id);
}
function searchKeys(e) {
  const box = $('#sres');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ssel = Math.max(0, Math.min(sresults.length - 1, ssel + (e.key === 'ArrowDown' ? 1 : -1))); $$('.sr', box).forEach((r, i) => r.classList.toggle('sel', i === ssel)); $$('.sr', box)[ssel]?.scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter') openResult(sresults[ssel]);
  else if (e.key === 'Escape') { box.classList.remove('on'); e.target.blur(); }
}
$('#q').addEventListener('input', e => doSearch(e.target.value));
$('#q').addEventListener('keydown', searchKeys);
$('#q').addEventListener('focus', e => { if (e.target.value) doSearch(e.target.value); });
$('#sres').addEventListener('mousedown', e => { const r = e.target.closest('.sr[data-i]'); if (r) { e.preventDefault(); openResult(sresults[+r.dataset.i]); } });
document.addEventListener('click', e => { if (!e.target.closest('#searchwrap,#sres,#hq')) $('#sres').classList.remove('on'); });
document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); isMob ? openMSearch() : $('#q').focus(); } });
let mres = [];
function openMSearch() { $('#msearch').classList.add('on'); const q = $('#mq'); q.value = ''; $('#mres').innerHTML = '<div class="hint">Type to search across every spell, monster, item and rule.</div>'; setTimeout(() => q.focus(), 30); }
function closeMSearch() { $('#msearch').classList.remove('on'); $('#mq').blur(); }
$('#msearchbtn').onclick = openMSearch;
$('#mqclose').onclick = closeMSearch;
$('#mq').addEventListener('input', e => { mres = runSearch(e.target.value); $('#mres').innerHTML = e.target.value.trim() ? (mres.length ? srHtml(mres) : '<div class="hint">No results.</div>') : '<div class="hint">Type to search across every spell, monster, item and rule.</div>'; });
$('#mq').addEventListener('keydown', e => { if (e.key === 'Enter' && mres[0]) openResult(mres[0]); });
$('#mres').addEventListener('click', e => { const r = e.target.closest('.sr[data-i]'); if (r) openResult(mres[+r.dataset.i]); });

// ---------- mobile sheets & peeks ----------
function browseSheet() {
  const sec = (t, ks) => `<h3>${t}</h3><div class="sgrid">${ks.map(([k, l, d]) => `<a href="#${k}"><b>${esc(l || TYPES[k].label)}</b><span>${esc(d || (TYPES[k] ? itemsOf(k).length + ' entries' : ''))}</span></a>`).join('')}</div>`;
  $('#sheet').innerHTML = `<div class="grab"></div><h3>Rules edition</h3><div class="edseg">${edSegHtml()}</div>` +
    sec('Player', [['classes'], ['races'], ['backgrounds'], ['feats'], ['spells']]) +
    sec('Game master', [['monsters'], ['encounter', 'Encounter Builder', 'XP budget & difficulty'], ['initiative', 'Initiative', 'Turns, HP, conditions'], ['screen', 'DM Screen', 'Quick reference'], ['loot', 'Random Item', 'Roll by rarity'], ['import', 'Import', '5etools JSON']]) +
    sec('Items & reference', [['items'], ['magic'], ['poisons'], ['conditions'], ['skills'], ['properties'], ['languages'], ['damage']]) +
    `<p class="attrib">Content from SRD 5.1 and SRD 5.2 by Wizards of the Coast LLC, CC-BY-4.0. Not affiliated with Wizards of the Coast.</p>`;
  $('#sheet').classList.add('on'); showScrim();
  $$('#sheet a').forEach(a => a.addEventListener('click', closeSheets));
}
function peek(t, id) {
  const ent = BYID[t] && BYID[t][id]; if (!ent) return go(t + '--' + id);
  $('#peek').innerHTML = `<div class="grab"></div><div class="pk-h"><b>${esc(ent.name)}</b><a class="btn ghost" href="#${t}--${esc(id)}">Open</a></div>${entityBody(t, ent, { nosrc: true, compact: true })}`;
  $('#peek').classList.add('on'); showScrim(); $('#peek').scrollTop = 0; enhance($('#peek'));
  $$('#peek a[href]').forEach(a => a.addEventListener('click', closeSheets));
}
$$('#tabbar button').forEach(b => b.onclick = () => {
  const t = b.dataset.tab; closeSheets(); if (t !== 'roll') closeRoller();
  if (t === 'home') go(''); else if (t === 'library') go('book'); else if (t === 'pinned') go('pinned');
  else if (t === 'browse') browseSheet(); else if (t === 'roll') { $('#roller').classList.contains('on') ? closeRoller() : openRoller(); }
});
function markTab() {
  const h = location.hash.slice(1); const a = h.split('--')[0];
  const t = !h ? 'home' : a === 'book' || a === 'screen' ? 'library' : a === 'pinned' ? 'pinned' : 'browse';
  $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
}

// ---------- hover previews ----------
const hov = $('#hov'); let hovT = null;
function hideHov() { hov.style.display = 'none'; clearTimeout(hovT); }
document.addEventListener('mouseover', e => {
  if (isMob) return;
  const g = e.target.closest('.lnk[data-go]'); if (!g) return;
  clearTimeout(hovT);
  hovT = setTimeout(() => {
    const [t, id] = g.dataset.go.split('--'); const ent = BYID[t] && BYID[t][id]; if (!ent) return;
    hov.innerHTML = (t === 'monsters' || t === 'spells') ? entityBody(t, ent, { nosrc: true, compact: true }) : `<h2>${esc(ent.name)}</h2>${entityBody(t, ent, { compact: true })}`;
    hov.style.display = 'block';
    const r = g.getBoundingClientRect(); const w = hov.offsetWidth, h = hov.offsetHeight;
    let x = Math.min(innerWidth - w - 10, r.left), y = r.bottom + 6; if (y + h > innerHeight - 10) y = Math.max(10, r.top - h - 6);
    hov.style.left = x + 'px'; hov.style.top = y + 'px';
  }, 250);
});
document.addEventListener('mouseout', e => { if (e.target.closest('.lnk[data-go]')) hideHov(); });
