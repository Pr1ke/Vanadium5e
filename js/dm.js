// Vanadium 5e — game-master tools: dice, encounter builder, initiative, DM screen, random item
// ================= DICE =================
let ADV = 0;
const rnd = n => 1 + Math.floor(Math.random() * n);
function rollExpr(expr, o = {}) {
  const src = String(expr || '').replace(/\s+/g, '').replace(/−/g, '-').toLowerCase();
  if (!src) return null;
  const re = /([+-]?)(\d*)d(\d+)(?:(kh|kl|dh|dl)(\d+))?|([+-]?)(\d+)/g;
  let m, total = 0, parts = [], any = false, nat = null, pos = 0;
  while ((m = re.exec(src))) {
    if (m.index !== pos) return null; pos = re.lastIndex; any = true;
    if (m[3]) {
      const sign = m[1] === '-' ? -1 : 1, n = Math.min(200, parseInt(m[2] || '1')), f = parseInt(m[3]);
      let rolls = Array.from({ length: n }, () => rnd(f));
      let adv = '';
      if (n === 1 && f === 20 && (o.adv || 0) !== 0) { const b = rnd(20); const keep = o.adv > 0 ? Math.max(rolls[0], b) : Math.min(rolls[0], b); adv = ` [${rolls[0]}, ${b}] ${o.adv > 0 ? 'adv' : 'dis'}`; rolls = [keep]; }
      let kept = rolls.map((v, i) => ({ v, i, keep: true }));
      if (m[4]) { const k = Math.min(n, parseInt(m[5])); const sorted = [...kept].sort((a, b) => a.v - b.v); const drop = m[4] === 'kh' ? sorted.slice(0, n - k) : m[4] === 'kl' ? sorted.slice(k) : m[4] === 'dh' ? sorted.slice(n - k) : sorted.slice(0, k); drop.forEach(d => d.keep = false); }
      const sum = kept.filter(x => x.keep).reduce((s, x) => s + x.v, 0);
      if (n === 1 && f === 20) nat = kept[0].v;
      total += sign * sum;
      parts.push(`${sign < 0 ? '− ' : parts.length ? '+ ' : ''}${n}d${f}${m[4] ? m[4] + m[5] : ''} ${adv ? adv.trim() + ' → ' : ''}[${kept.map(x => x.keep ? x.v : `<span class="dropd">${x.v}</span>`).join(', ')}]`);
    } else { const v = parseInt(m[7]) * (m[6] === '-' ? -1 : 1); total += v; parts.push((v < 0 ? '− ' : '+ ') + Math.abs(v)); }
  }
  if (!any || pos !== src.length) return null;
  return { total, parts: parts.join(' '), nat };
}
function doRoll(expr, label, o = {}) {
  const adv = o.d20 ? (o.adv ?? ADV) : 0;
  const r = rollExpr(expr, { adv });
  if (!r) { toast('Can’t roll “' + esc(expr) + '”'); return null; }
  const cls = r.nat === 20 ? 'n20' : r.nat === 1 ? 'n1' : '';
  $('#rlog').insertAdjacentHTML('afterbegin', `<div class="rl"><div class="tot ${cls}">${r.total}</div><div><div class="lab">${esc(label || expr)}</div><div class="tt">${esc(expr)} · ${r.parts}</div>${r.nat === 20 ? '<span class="tl" style="background:var(--nat20)">Natural 20</span>' : r.nat === 1 ? '<span class="tl" style="background:var(--nat1)">Natural 1</span>' : ''}</div></div>`);
  while ($('#rlog').children.length > 60) $('#rlog').lastChild.remove();
  toast(`${label ? esc(label) + ': ' : ''}<b>${r.total}</b>${adv ? (adv > 0 ? ' (adv)' : ' (dis)') : ''}${r.nat === 20 ? ' · natural 20!' : r.nat === 1 ? ' · natural 1' : ''}`);
  return r;
}
const openRoller = () => { $('#roller').classList.add('on'); if (!isMob) $('#fab').style.display = 'none'; };
const closeRoller = () => { $('#roller').classList.remove('on'); $('#fab').style.display = ''; };
$('#fab').onclick = openRoller;
$('#rclose').onclick = closeRoller;
$('#dq').innerHTML = [4, 6, 8, 10, 12, 20, 100].map(f => `<button data-q="${f}">d${f}</button>`).join('');
$('#dq').onclick = e => { const b = e.target.closest('[data-q]'); if (b) doRoll('1d' + b.dataset.q, 'd' + b.dataset.q, { d20: b.dataset.q === '20' }); };
$('#advseg').onclick = e => { const b = e.target.closest('[data-adv]'); if (!b) return; ADV = +b.dataset.adv; $$('#advseg button').forEach(x => x.classList.toggle('on', x === b)); };
const rgo = () => { const v = $('#rexpr').value.trim() || '1d20'; doRoll(v, '', { d20: /^1?d20([+-]\d+)?$/i.test(v.replace(/\s/g, '')) }); };
$('#rgo').onclick = rgo;
$('#rexpr').onkeydown = e => { if (e.key === 'Enter') rgo(); };
function rollLabel(el) {
  if (el.dataset.lab) return el.dataset.lab;
  const ma = el.closest('.ma5'), mon = el.closest('.mon'), sp = el.closest('.sp5');
  const a = ma && ma.querySelector('.mn') ? ma.querySelector('.mn').textContent.replace(/\.$/, '') : '';
  const who = mon ? mon.dataset.name : sp ? sp.querySelector('.sp5-n')?.textContent : '';
  return [who, a].filter(Boolean).join(': ') || el.textContent;
}
document.addEventListener('click', e => {
  const r = e.target.closest('[data-roll]'); if (!r || !r.dataset.roll) return;
  e.preventDefault();
  const useSave = e.shiftKey && r.dataset.roll2;
  const lab = rollLabel(r) + (useSave ? ' (save)' : '');
  doRoll(useSave ? r.dataset.roll2 : r.dataset.roll, r.dataset.d20 && useSave ? lab.replace(/check \(save\)$/, 'saving throw') : lab, { d20: !!r.dataset.d20 });
  if (!isMob) openRoller();
});

// ================= XP TABLES =================
const XP14 = { 1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500], 5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100], 9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500], 13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400], 16: [1600, 3200, 4800, 7200], 17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500], 19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700] };
const XP24 = { 1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100], 6: [600, 1000, 1400], 7: [750, 1300, 1700], 8: [1000, 1700, 2100], 9: [1300, 2000, 2600], 10: [1600, 2300, 3100], 11: [1900, 2900, 4100], 12: [2200, 3700, 4700], 13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800], 16: [3800, 6100, 9800], 17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000] };
const CRXP = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };
const MULTS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
function mult14(count, party) {
  if (!count) return 1;
  let i = count === 1 ? 1 : count === 2 ? 2 : count <= 6 ? 3 : count <= 10 ? 4 : count <= 14 ? 5 : 6;
  if (party < 3) i++; else if (party >= 6) i--;
  return MULTS[Math.max(0, Math.min(MULTS.length - 1, i))];
}

// ================= ENCOUNTER BUILDER =================
let ENC = store.get('enc', null) || { name: 'New encounter', party: [3, 3, 3, 3], method: '2024', list: [] };
let ENCS = store.get('encs', []);
const saveEnc = () => store.set('enc', ENC);
let encQ = '', encFit = store.get('encfit', true);
function encMath() {
  const P = ENC.party.filter(l => l >= 1 && l <= 20);
  const mons = ENC.list.map(x => ({ m: BYID.monsters[x.id], n: x.n })).filter(x => x.m);
  const count = mons.reduce((s, x) => s + x.n, 0);
  const xp = mons.reduce((s, x) => s + (x.m.xp || 0) * x.n, 0);
  if (ENC.method === '2014') {
    const th = [0, 1, 2, 3].map(i => P.reduce((s, l) => s + XP14[l][i], 0));
    const mul = mult14(count, P.length), adj = Math.round(xp * mul);
    const d = adj >= th[3] ? 'deadly' : adj >= th[2] ? 'hard' : adj >= th[1] ? 'medium' : adj >= th[0] ? 'easy' : count ? 'trivial' : 'none';
    return { P, mons, count, xp, adj, mul, th, labels: ['Easy', 'Medium', 'Hard', 'Deadly'], d, cmp: adj };
  }
  const th = [0, 1, 2].map(i => P.reduce((s, l) => s + XP24[l][i], 0));
  const d = xp > th[2] * 1.25 ? 'beyond high' : xp >= th[2] ? 'high' : xp >= th[1] ? 'moderate' : xp >= th[0] ? 'low' : count ? 'trivial' : 'none';
  return { P, mons, count, xp, adj: xp, mul: 1, th, labels: ['Low', 'Moderate', 'High'], d, cmp: xp };
}
const DCOL = { none: 'var(--ink3)', trivial: '#7d8a96', easy: '#5f8f55', low: '#5f8f55', medium: '#c9a24a', moderate: '#c9a24a', hard: '#d4682f', high: '#d4682f', deadly: '#b5302a', 'beyond high': '#b5302a' };
function encounterPage() {
  $('#main').innerHTML = `<div class="enc"><div class="enc-l" id="encl"></div><div class="enc-r" id="encr"><div class="pick-h"><div class="pick-top"><b>Add creatures</b><button class="btn ghost sm" id="closepick">Done</button></div><input type="search" id="encq" placeholder="Search creatures, type or CR…" value="${esc(encQ)}"><div class="pick-tabs"><label class="fit"><input type="checkbox" id="encfit" ${encFit ? 'checked' : ''}> Sensible CR for this party</label></div></div><div class="pick-list" id="picklist"></div></div></div>`;
  $('#encq').oninput = e => { encQ = e.target.value; drawPicker(); };
  $('#encfit').onchange = e => { encFit = e.target.checked; store.set('encfit', encFit); drawPicker(); };
  $('#closepick').onclick = () => $('#encr').classList.remove('on');
  $('#picklist').onclick = e => { const b = e.target.closest('[data-add]'); if (b) { addToEncounter(b.dataset.add, true); } };
  drawEnc(); drawPicker();
  document.title = 'Encounter Builder — Vanadium 5e';
}
function drawEnc() {
  const M = encMath(), box = $('#encl'); if (!box) return;
  const maxv = M.th[M.th.length - 1] * 1.35 || 1;
  const segs = M.th.map((t, i) => [M.labels[i], t, M.th[i + 1] ?? maxv]);
  const lowEnd = M.th[0];
  const dkey = M.d;
  box.innerHTML = `<div class="enc-top"><input class="encname" id="encname" value="${esc(ENC.name)}"><div class="enc-acts">${ENCS.length ? `<select class="encsel" id="encload"><option value="">Load saved…</option>${ENCS.map((x, i) => `<option value="${i}">${esc(x.name)}</option>`).join('')}</select>` : ''}<button class="btn ghost sm" id="encsave">Save</button><button class="btn ghost sm" id="encnew">New</button><button class="btn sm" id="encrun" ${M.count ? '' : 'disabled'}>▶ Run in initiative</button></div></div>
    <div class="party"><div style="flex:1;min-width:260px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);margin-bottom:6px">Party · ${M.P.length} character${M.P.length === 1 ? '' : 's'} (levels)</div><div class="pmembers" id="pmem">${ENC.party.map((l, i) => `<span class="pm">PC ${i + 1}<input type="number" min="1" max="20" value="${l}" data-pl="${i}"><button data-prm="${i}" title="Remove">×</button></span>`).join('')}<button class="btn ghost sm" id="padd">+ Add</button><button class="btn ghost sm" id="pset" title="Set every character to the same level">All level…</button></div>
      <div class="method" style="margin-top:10px">Method: <div class="advseg" style="width:auto"><button class="${ENC.method === '2024' ? 'on' : ''}" data-meth="2024">2024 XP budget</button><button class="${ENC.method === '2014' ? 'on' : ''}" data-meth="2014">2014 thresholds</button></div></div></div>
      <div class="es"><span>Creature XP</span><b>${xpS(M.xp)}</b>${ENC.method === '2014' ? `<small>× ${M.mul} (${M.count} creature${M.count === 1 ? '' : 's'}) = ${xpS(M.adj)} adjusted</small>` : `<small>${M.count} creature${M.count === 1 ? '' : 's'}</small>`}<small>${M.P.length ? xpS(Math.round(M.xp / M.P.length)) + ' XP each' : ''}</small></div></div>
    <div class="meter-wrap"><div class="meter-h"><div><span class="dlabel" style="color:${DCOL[dkey]}">${dkey === 'none' ? 'No creatures' : esc(dkey)}</span><span class="worth">${ENC.method === '2014' ? 'Adjusted XP vs. party thresholds' : 'XP vs. party budget'}</span></div><span class="evt">${xpS(M.cmp)} XP</span></div>
      <div class="diffbar"><div class="seg" style="width:${lowEnd / maxv * 100}%;background:#7d8a96" ></div>${segs.map(([l, a, b], i) => `<div class="seg ${M.cmp >= a ? 'on' : ''}" style="width:${Math.max(0, (Math.min(b, maxv) - a) / maxv * 100)}%;background:${DCOL[l.toLowerCase()]}"><span>${l}</span></div>`).join('')}<div class="mk" style="left:${Math.min(99.5, M.cmp / maxv * 100)}%"></div></div>
      <div class="mticks">${segs.map(([l, a]) => `<span>${l}: ${xpS(a)}</span>`).join('')}</div></div>
    <div class="grp-h"><h2>Creatures</h2><div><button class="btn ghost sm mobonly" id="openpick">+ Add creatures</button>${M.count ? '<button class="btn ghost sm" id="encclear">Clear</button>' : ''}</div></div>
    <div class="grp">${M.mons.length ? M.mons.map(({ m, n }, i) => `<div class="ent"><div class="ent-n"><a class="lnk" style="border:0" data-go="monsters--${esc(m.id)}">${esc(m.name)}</a> ${EDF === 'all' ? edBadge(m) : ''}<span>CR ${esc(m.cr)} · ${xpS(m.xp)} XP each · AC ${esc(String(m.ac).split(' ')[0])} · HP ${esc(m.hpN)}</span></div><div class="step"><button data-dec="${i}">−</button><b>${n}</b><button data-inc="${i}">+</button></div><span class="pev" style="min-width:70px;text-align:right">${xpS(m.xp * n)} XP</span></div>`).join('') : '<div class="gempty">Add creatures from the list on the right (or the + button on any stat block).</div>'}</div>
    <p class="encnote">${ENC.method === '2024' ? 'SRD 5.2 method: add up the XP of every creature and compare it to the party’s Low, Moderate and High budgets.' : 'SRD 5.1-era method: total XP is multiplied by a factor for the number of creatures (adjusted for party size), then compared with the party’s Easy, Medium, Hard and Deadly thresholds.'} Every creature’s XP is still awarded in full when it is defeated.</p>`;
  $('#encname').oninput = e => { ENC.name = e.target.value; saveEnc(); };
  $$('[data-pl]', box).forEach(i => i.onchange = () => { ENC.party[+i.dataset.pl] = Math.max(1, Math.min(20, parseInt(i.value) || 1)); saveEnc(); drawEnc(); drawPicker(); });
  $$('[data-prm]', box).forEach(b => b.onclick = () => { ENC.party.splice(+b.dataset.prm, 1); saveEnc(); drawEnc(); drawPicker(); });
  $('#padd').onclick = () => { ENC.party.push(ENC.party[ENC.party.length - 1] || 1); saveEnc(); drawEnc(); };
  $('#pset').onclick = () => { const v = parseInt(prompt('Level for every character (1–20):', ENC.party[0] || 1)); if (v >= 1 && v <= 20) { ENC.party = ENC.party.map(() => v); saveEnc(); drawEnc(); drawPicker(); } };
  $$('[data-meth]', box).forEach(b => b.onclick = () => { ENC.method = b.dataset.meth; saveEnc(); drawEnc(); });
  $$('[data-inc]', box).forEach(b => b.onclick = () => { ENC.list[+b.dataset.inc].n++; saveEnc(); drawEnc(); });
  $$('[data-dec]', box).forEach(b => b.onclick = () => { const x = ENC.list[+b.dataset.dec]; if (--x.n <= 0) ENC.list.splice(+b.dataset.dec, 1); saveEnc(); drawEnc(); });
  if ($('#encclear')) $('#encclear').onclick = () => { ENC.list = []; saveEnc(); drawEnc(); };
  if ($('#openpick')) $('#openpick').onclick = () => $('#encr').classList.add('on');
  $('#encsave').onclick = () => { const i = ENCS.findIndex(x => x.name === ENC.name); const copy = JSON.parse(JSON.stringify(ENC)); if (i >= 0) ENCS[i] = copy; else ENCS.push(copy); store.set('encs', ENCS); toast('Saved “' + esc(ENC.name) + '”'); drawEnc(); };
  $('#encnew').onclick = () => { ENC = { name: 'New encounter', party: ENC.party.slice(), method: ENC.method, list: [] }; saveEnc(); drawEnc(); };
  if ($('#encload')) $('#encload').onchange = e => { const x = ENCS[+e.target.value]; if (x) { ENC = JSON.parse(JSON.stringify(x)); saveEnc(); drawEnc(); drawPicker(); } };
  $('#encrun').onclick = () => { for (const { m, n } of M.mons) for (let k = 0; k < n; k++) addCombatant(m, true); saveInit(); go('initiative'); };
}
function drawPicker() {
  const box = $('#picklist'); if (!box) return;
  const P = ENC.party.length ? ENC.party : [1];
  const avg = P.reduce((s, l) => s + l, 0) / P.length;
  const toks = encQ.toLowerCase().split(/\s+/).filter(Boolean);
  let list = itemsOf('monsters').filter(m => toks.every(t => (m.name + ' ' + m.type + ' cr' + m.cr + ' ' + m.cr).toLowerCase().includes(t)));
  if (encFit && !toks.length) list = list.filter(m => CRV(m.crN ?? m.cr) <= Math.max(1, avg + 3) && CRV(m.crN ?? m.cr) >= Math.max(0, avg / 4 - 1));
  list.sort((a, b) => CRV(a.crN ?? a.cr) - CRV(b.crN ?? b.cr) || a.name.localeCompare(b.name));
  box.innerHTML = list.slice(0, 300).map(m => `<div class="prow"><div class="pn"><a class="lnk" style="border:0" data-go="monsters--${esc(m.id)}">${esc(m.name)}</a> ${EDF === 'all' ? edBadge(m) : ''}<span>${esc(m.size)} ${esc(m.type)} · AC ${esc(String(m.ac).split(' ')[0])} · HP ${esc(m.hpN)}</span></div><span class="pev">CR ${esc(m.cr)}</span><button class="addm" data-add="${esc(m.id)}" title="Add">+</button></div>`).join('') + (list.length > 300 ? `<div class="gempty">${list.length - 300} more — search to narrow down.</div>` : '') || '<div class="gempty">No creatures match.</div>';
}
function addToEncounter(id, quiet) {
  const m = BYID.monsters[id]; if (!m) return;
  const x = ENC.list.find(q => q.id === id); if (x) x.n++; else ENC.list.push({ id, n: 1 });
  saveEnc(); if ($('#encl')) drawEnc();
  toast(`Added ${esc(m.name)} to <a href="#encounter" style="color:#fff">${esc(ENC.name)}</a>`);
}

// ================= INITIATIVE TRACKER =================
let INIT = store.get('init', null) || { round: 1, turn: 0, list: [], sel: null, rollHp: false };
const saveInit = () => store.set('init', INIT);
let initCondFor = null;
function addCombatant(m, quiet) {
  const same = INIT.list.filter(c => c.monId === m.id).length;
  if (same === 1) { const first = INIT.list.find(c => c.monId === m.id); if (!/\d$/.test(first.name)) first.name += ' 1'; }
  let hp = m.hpN || 1;
  if (INIT.rollHp && m.hpRoll) { const r = rollExpr(m.hpRoll); if (r) hp = Math.max(1, r.total); }
  const init = rnd(20) + (m.init ?? mod(m.ab?.[1] || 10));
  INIT.list.push({ key: Math.random().toString(36).slice(2, 9), name: m.name + (same ? ' ' + (same + 1) : ''), init, dex: m.init ?? mod(m.ab?.[1] || 10), hp, max: hp, ac: String(m.ac).split(' ')[0], monId: m.id, conds: [], player: false });
  if (!quiet) { saveInit(); toast(`${esc(m.name)} joins initiative (${init})`); if ($('#itl')) drawInit(); }
}
function sortInit() {
  const cur = INIT.list[INIT.turn]?.key;
  INIT.list.sort((a, b) => b.init - a.init || (b.dex || 0) - (a.dex || 0) || a.name.localeCompare(b.name));
  INIT.turn = Math.max(0, INIT.list.findIndex(c => c.key === cur));
}
function initiativePage() {
  $('#main').innerHTML = `<div class="it5"><div class="it5-l" id="itl"></div><div class="it5-r" id="itr"></div></div>`;
  drawInit();
  document.title = 'Initiative — Vanadium 5e';
}
function drawInit() {
  const box = $('#itl'); if (!box) return;
  const L = INIT.list;
  if (INIT.turn >= L.length) INIT.turn = 0;
  box.innerHTML = `<div class="it5-top"><h1>Initiative</h1><span class="rnd">Round ${INIT.round}</span><button class="btn ghost sm" id="itprev" title="Previous turn">◀</button><button class="btn sm" id="itnext">Next turn ▶</button></div>
    <div class="enc-acts" style="margin-bottom:10px"><button class="btn ghost sm" id="itsort">Sort</button><button class="btn ghost sm" id="itroll">Reroll monsters</button><button class="btn ghost sm" id="itreset">New round 1</button><button class="btn ghost sm danger" id="itclear">Clear</button><label class="fit" style="margin-left:4px"><input type="checkbox" id="itrollhp" ${INIT.rollHp ? 'checked' : ''}> Roll monster HP</label></div>
    ${L.map((c, i) => { const pct = c.max ? Math.max(0, Math.min(100, c.hp / c.max * 100)) : 100; return `<div class="cbt ${i === INIT.turn ? 'cur' : ''} ${c.hp <= 0 && !c.player ? 'dead' : ''}" data-k="${c.key}">
      <div class="ini"><input type="number" value="${c.init}" data-ini="${c.key}" title="Initiative"></div>
      <div class="cn"><b data-sel="${c.key}">${esc(c.name)}</b><div class="sub">${c.player ? 'Player character' : 'Creature'}${c.ac ? ' · AC ' + esc(c.ac) : ''}${c.note ? ' · ' + esc(c.note) : ''}</div>${c.conds.length ? `<div class="cconds">${c.conds.map(x => `<span data-uncond="${c.key}|${esc(x)}" title="Click to remove">${esc(x)} ×</span>`).join('')}</div>` : ''}${initCondFor === c.key ? `<div class="condpick">${[...CONDS.map(cap), 'Concentrating', 'Bloodied', 'Hidden', 'Dodging', 'Raging', 'Blessed'].map(x => `<span class="${c.conds.includes(x) ? 'on' : ''}" data-cond="${c.key}|${x}">${x}</span>`).join('')}</div>` : ''}</div>
      <div class="hpw">${c.max ? `<div class="hpbar"><i class="${pct < 25 ? 'low' : pct < 50 ? 'mid' : ''}" style="width:${pct}%"></i></div><span class="hpv">${c.hp}/${c.max}</span>` : ''}<input class="hpin" type="number" inputmode="numeric" placeholder="±HP" data-hpin="${c.key}"><div class="acts"><button class="dmg" data-dmg="${c.key}" title="Damage">−</button><button class="heal" data-heal="${c.key}" title="Heal">+</button><button data-condbtn="${c.key}" title="Conditions">☰</button><button data-rm="${c.key}" title="Remove">×</button></div></div></div>`; }).join('') || '<div class="gempty" style="background:var(--panel);border:1px solid var(--line);border-radius:var(--r-md)">No combatants yet. Add players below, add creatures from the bestiary (“+ Initiative”), or run an encounter from the Encounter Builder.</div>'}
    <div class="addrow"><b style="font-size:13px">Add player</b><input id="pname" placeholder="Name" style="width:130px"><input id="pinit" type="number" placeholder="Init" style="width:70px"><input id="php" type="number" placeholder="HP (opt.)" style="width:90px"><input id="pac" placeholder="AC" style="width:56px"><button class="btn sm" id="padd2">Add</button></div>
    <div class="addrow"><b style="font-size:13px">Add creature</b><input id="mname" list="mlist" placeholder="Search the bestiary…" style="flex:1;min-width:180px"><datalist id="mlist">${itemsOf('monsters').map(m => `<option value="${esc(m.name)}${EDF === 'all' ? ' (' + m.ed + ')' : ''}">`).join('')}</datalist><input id="mcount" type="number" value="1" min="1" style="width:60px"><button class="btn sm" id="madd">Add</button></div>`;
  const find = k => L.find(c => c.key === k);
  const hpApply = (k, sign) => { const inp = $(`[data-hpin="${k}"]`); const v = parseInt(inp.value); if (!v) { inp.focus(); return; } const c = find(k); if (!c.max) { c.max = c.hp = 0; } c.hp = Math.max(0, Math.min(c.max || 9999, c.hp + sign * Math.abs(v))); if (c.hp <= c.max / 2 && !c.conds.includes('Bloodied') && sign < 0 && !c.player && c.hp > 0) c.conds.push('Bloodied'); if (c.hp > c.max / 2) c.conds = c.conds.filter(x => x !== 'Bloodied'); saveInit(); drawInit(); };
  box.onclick = e => {
    const t = e.target.closest('[data-sel],[data-dmg],[data-heal],[data-rm],[data-condbtn],[data-cond],[data-uncond]'); if (!t) return;
    if (t.dataset.sel) { INIT.sel = t.dataset.sel; saveInit(); drawInitSide(); if (isMob) { const c = find(INIT.sel); if (c?.monId) peek('monsters', c.monId); } return; }
    if (t.dataset.dmg) return hpApply(t.dataset.dmg, -1);
    if (t.dataset.heal) return hpApply(t.dataset.heal, 1);
    if (t.dataset.rm) { const i = L.findIndex(c => c.key === t.dataset.rm); L.splice(i, 1); if (INIT.turn > i) INIT.turn--; saveInit(); drawInit(); return; }
    if (t.dataset.condbtn) { initCondFor = initCondFor === t.dataset.condbtn ? null : t.dataset.condbtn; drawInit(); return; }
    const [k, x] = (t.dataset.cond || t.dataset.uncond).split('|'); const c = find(k);
    c.conds = c.conds.includes(x) ? c.conds.filter(y => y !== x) : [...c.conds, x]; saveInit(); drawInit();
  };
  $$('[data-ini]', box).forEach(i => i.onchange = () => { find(i.dataset.ini).init = parseInt(i.value) || 0; sortInit(); saveInit(); drawInit(); });
  $$('[data-hpin]', box).forEach(i => i.onkeydown = e => { if (e.key === 'Enter') { const v = i.value.trim(); hpApply(i.dataset.hpin, v.startsWith('+') ? 1 : -1); } });
  $('#itnext').onclick = () => { if (!L.length) return; let n = 0; do { INIT.turn++; if (INIT.turn >= L.length) { INIT.turn = 0; INIT.round++; } n++; } while (n < L.length && L[INIT.turn].hp <= 0 && !L[INIT.turn].player); const c = L[INIT.turn]; if (c.monId) INIT.sel = c.key; saveInit(); drawInit(); };
  $('#itprev').onclick = () => { if (!L.length) return; INIT.turn--; if (INIT.turn < 0) { INIT.turn = L.length - 1; INIT.round = Math.max(1, INIT.round - 1); } saveInit(); drawInit(); };
  $('#itsort').onclick = () => { sortInit(); saveInit(); drawInit(); };
  $('#itroll').onclick = () => { L.forEach(c => { if (!c.player) c.init = rnd(20) + (c.dex || 0); }); sortInit(); INIT.turn = 0; saveInit(); drawInit(); };
  $('#itreset').onclick = () => { INIT.round = 1; INIT.turn = 0; saveInit(); drawInit(); };
  $('#itclear').onclick = async () => { if (await confirmSheet('Remove every combatant?', 'Clear')) { INIT = { round: 1, turn: 0, list: [], sel: null, rollHp: INIT.rollHp }; saveInit(); drawInit(); } };
  $('#itrollhp').onchange = e => { INIT.rollHp = e.target.checked; saveInit(); };
  $('#padd2').onclick = () => { const n = $('#pname').value.trim(); if (!n) return $('#pname').focus(); const hp = parseInt($('#php').value) || 0; L.push({ key: Math.random().toString(36).slice(2, 9), name: n, init: parseInt($('#pinit').value) || 0, dex: 0, hp, max: hp, ac: $('#pac').value.trim(), conds: [], player: true }); sortInit(); saveInit(); drawInit(); $('#pname').focus(); };
  $('#madd').onclick = () => { const v = $('#mname').value.trim(); const ed = (v.match(/\((2014|2024)\)$/) || [])[1]; const nm = v.replace(/\s*\((2014|2024)\)$/, '').toLowerCase(); const m = itemsOf('monsters').find(x => x.name.toLowerCase() === nm && (!ed || x.ed === ed)) || itemsOf('monsters').find(x => x.name.toLowerCase().startsWith(nm)); if (!m) { toast('No creature called “' + esc(v) + '”'); return; } const n = Math.max(1, Math.min(30, parseInt($('#mcount').value) || 1)); for (let k = 0; k < n; k++) addCombatant(m, true); sortInit(); saveInit(); drawInit(); };
  $('#mname').onkeydown = e => { if (e.key === 'Enter') $('#madd').click(); };
  drawInitSide();
}
function drawInitSide() {
  const side = $('#itr'); if (!side) return;
  $$('.cbt').forEach(el => el.style.outline = el.dataset.k === INIT.sel ? '2px dashed var(--line2)' : '');
  const c = INIT.list.find(x => x.key === INIT.sel) || INIT.list[INIT.turn];
  const m = c && c.monId && BYID.monsters[c.monId];
  side.innerHTML = m ? renderMonster(m) : `<div class="empty">${c ? 'Player characters have no stat block here.' : 'Click a creature’s name to see its stat block.'}</div>`;
  enhance(side);
}

// ================= DM SCREEN =================
const T = (head, rows) => `<div class="tblw" style="margin:0"><table class="dt"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
function screenPage() {
  const cards = [
    ['Difficulty Class', T(['Task', 'DC'], [['Very easy', 5], ['Easy', 10], ['Medium', 15], ['Hard', 20], ['Very hard', 25], ['Nearly impossible', 30]])],
    ['Cover', T(['Cover', 'Effect'], [['Half', '+2 to AC and Dexterity saving throws'], ['Three-quarters', '+5 to AC and Dexterity saving throws'], ['Total', 'Can’t be targeted directly by an attack or spell']])],
    ['Actions in combat', `<ul><li><b>Attack</b> — make an attack (Extra Attack adds more)</li><li><b>Cast a Spell / Magic</b> — cast a spell or use a magic item or feature</li><li><b>Dash</b> — extra movement equal to your Speed</li><li><b>Disengage</b> — your movement doesn’t provoke opportunity attacks</li><li><b>Dodge</b> — attacks against you have disadvantage; advantage on Dex saves</li><li><b>Help</b> — give an ally advantage on a check or attack</li><li><b>Hide</b> — make a Dexterity (Stealth) check</li><li><b>Ready</b> — prepare a reaction to a trigger</li><li><b>Search</b> — make a Wisdom (Perception) or Intelligence (Investigation) check</li><li><b>Use an Object / Utilize</b> — interact with a second object</li><li><b>Influence / Study</b> (2024) — Charisma checks to sway; Intelligence checks to recall or examine</li></ul>`],
    ['Travel pace', T(['Pace', 'Minute', 'Hour', 'Day', 'Effect'], [['Fast', '400 ft.', '4 miles', '30 miles', '−5 to passive Perception'], ['Normal', '300 ft.', '3 miles', '24 miles', '—'], ['Slow', '200 ft.', '2 miles', '18 miles', 'Able to use Stealth']])],
    ['Light & vision', T(['Light', 'Effect'], [['Bright', 'Normal vision'], ['Dim', 'Lightly obscured: disadvantage on sight-based Perception'], ['Darkness', 'Heavily obscured: effectively blinded']]) + '<p><b>Darkvision</b> treats dim light as bright and darkness as dim light, within its range (no colour in darkness).</p>'],
    ['Exhaustion', `<p><b>2024:</b> each level gives −2 to every d20 test and −5 ft. Speed. Level 6 is death. A long rest removes 1 level.</p>` + T(['2014 level', 'Effect'], [[1, 'Disadvantage on ability checks'], [2, 'Speed halved'], [3, 'Disadvantage on attack rolls and saving throws'], [4, 'Hit point maximum halved'], [5, 'Speed reduced to 0'], [6, 'Death']])],
    ['Proficiency bonus', T(['Level / CR', 'Bonus'], [['1–4 · CR 0–4', '+2'], ['5–8 · CR 5–8', '+3'], ['9–12 · CR 9–12', '+4'], ['13–16 · CR 13–16', '+5'], ['17–20 · CR 17–20', '+6'], ['CR 21–24', '+7'], ['CR 25–28', '+8'], ['CR 29–30', '+9']])],
    ['Creature size', T(['Size', 'Space'], [['Tiny', '2½ by 2½ ft.'], ['Small', '5 by 5 ft.'], ['Medium', '5 by 5 ft.'], ['Large', '10 by 10 ft.'], ['Huge', '15 by 15 ft.'], ['Gargantuan', '20 by 20 ft. or larger']])],
    ['Concentration & death saves', `<ul><li>Taking damage while concentrating: Constitution save, DC 10 or half the damage taken (whichever is higher; 2024 caps the DC at 30).</li><li>Death saves: DC 10, three successes = stable, three failures = dead. Natural 20 regains 1 HP; natural 1 counts as two failures.</li><li>Damage at 0 HP = one failed death save (a critical hit = two). Damage ≥ your HP maximum while at 0 HP kills outright.</li></ul>`],
    ['Falling, suffocating, food', `<ul><li><b>Falling:</b> 1d6 bludgeoning per 10 ft. fallen (max 20d6); land prone unless you avoid all damage.</li><li><b>Holding breath:</b> 1 + Con modifier minutes (min 30 seconds); then survive rounds equal to Con modifier (min 1) before dropping to 0 HP.</li><li><b>Food & water:</b> 1 lb. of food and 1 gallon of water per day (2 gallons in hot weather).</li></ul>`],
    ['Object armor class', T(['Substance', 'AC'], [['Cloth, paper, rope', 11], ['Crystal, glass, ice', 13], ['Wood, bone', 15], ['Stone', 17], ['Iron, steel', 19], ['Mithral', 21], ['Adamantine', 23]])],
    ['XP by challenge rating', T(['CR', 'XP', 'CR', 'XP'], Array.from({ length: 17 }, (_, i) => { const k = Object.keys(CRXP); const a = k[i], b = k[i + 17]; return [a, xpS(CRXP[a]), b || '', b ? xpS(CRXP[b]) : '']; }))],
    ['Encounter budget per character (2024)', T(['Level', 'Low', 'Moderate', 'High'], Object.entries(XP24).map(([l, v]) => [l, ...v.map(xpS)]))],
    ['Encounter thresholds per character (2014)', T(['Level', 'Easy', 'Medium', 'Hard', 'Deadly'], Object.entries(XP14).map(([l, v]) => [l, ...v.map(xpS)])) + '<p>Multiply total XP by ×1 (1 creature), ×1.5 (2), ×2 (3–6), ×2.5 (7–10), ×3 (11–14), ×4 (15+). One step higher for parties under 3, lower for 6+.</p>']
  ];
  $('#main').innerHTML = `<div class="scr"><h1>DM Screen</h1><p class="note">Quick reference for the table. Click a condition or a die expression to use it. Full rules are in the <a href="#book">SRD rules reader</a>.</p>
    <div class="scrg">${cards.map(([t, h]) => `<div class="scrc"><h3>${t}</h3>${h}</div>`).join('')}
    <div class="scrc"><h3>Conditions</h3><div class="pills">${itemsOf('conditions').map(c => `<a class="pill lnk" style="border-bottom:1px solid var(--line2)" data-go="conditions--${esc(c.id)}">${esc(c.name)}</a>`).join('')}</div></div></div></div>`;
  enhance($('#main'));
  document.title = 'DM Screen — Vanadium 5e';
}

// ================= RANDOM MAGIC ITEM =================
let lootLast = null;
function lootPage(rar) {
  const all = itemsOf('magic');
  const rars = Object.keys(RARO).filter(r => all.some(m => m.rarity === r));
  if (rar) { const pool = all.filter(m => rar === 'Any' ? m.rarity !== 'Artifact' && m.rarity !== 'Varies' : m.rarity === rar); lootLast = pool[Math.floor(Math.random() * pool.length)]?.id || null; }
  const e = lootLast && BYID.magic[lootLast];
  $('#main').innerHTML = `<div class="scr"><h1>Random Magic Item</h1><p class="note">Roll a random item from the ${esc(EDF === 'all' ? '2014 and 2024' : EDF)} magic items${(HB.magic || []).length ? ' (including your imports)' : ''}.</p>
    <div class="enc-acts" style="margin-bottom:16px">${['Any', ...rars].map(r => `<button class="btn ${r === 'Any' ? '' : 'ghost'} sm" data-loot="${esc(r)}"><span class="${r === 'Any' ? '' : rarCls(r)}">${esc(r)}</span></button>`).join('')}</div>
    ${e ? `<div style="max-width:820px">${entityView('magic', e)}</div>` : '<div class="empty" style="text-align:left;padding:10px 0">Pick a rarity to roll.</div>'}</div>`;
  $$('[data-loot]').forEach(b => b.onclick = () => lootPage(b.dataset.loot));
  enhance($('#main'));
  document.title = 'Random Magic Item — Vanadium 5e';
}
