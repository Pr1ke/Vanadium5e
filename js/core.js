// Vanadium 5e — core: helpers, data, editions, pins, menu
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const store = {
  get(k, d) { try { const v = localStorage.getItem('v5_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('v5_' + k, JSON.stringify(v)); } catch (e) { } }
};
const ORD = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const slug = s => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const uniq = a => [...new Set(a.filter(x => x !== null && x !== undefined && x !== ''))];
const mod = n => Math.floor((n - 10) / 2);
const sgn = n => (n >= 0 ? '+' : '−') + Math.abs(n);
const cap = s => String(s || '').replace(/^./, c => c.toUpperCase());

let D = null;               // SRD data
let isMob = false;
const SRCN = { '2014': 'SRD 5.1', '2024': 'SRD 5.2' };
const srcName = e => e.ed === 'hb' ? (e.srcTitle || 'Homebrew') : SRCN[e.ed] || e.ed;
const edBadge = e => `<span class="edb e${e.ed}" title="${esc(e.ed === 'hb' ? 'Imported: ' + (e.srcTitle || '') : e.ed === '2024' ? '2024 rules (SRD 5.2)' : '2014 rules (SRD 5.1)')}">${esc(e.ed === 'hb' ? (e.srcAbbr || 'HB') : e.ed)}</span>`;

// ---------- data loading (same approach as Vanadium: gzip+base64 text, cached) ----------
const DATA_V = '5e-2026-11-18a';
async function readBody(r, onProg) {
  const total = +r.headers.get('content-length') || 0;
  if (!r.body || !onProg) return new Uint8Array(await r.arrayBuffer());
  const rd = r.body.getReader(), parts = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onProg(got, total); }
  const out = new Uint8Array(got); let o = 0; for (const x of parts) { out.set(x, o); o += x.length; } return out;
}
async function bytesToJSON(u8) {
  if (u8[0] === 0x48 && u8[1] === 0x34 && u8[2] === 0x73 && u8[3] === 0x49) { const bin = atob(new TextDecoder().decode(u8).trim()); u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); }
  if (u8[0] === 0x1f && u8[1] === 0x8b) u8 = new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(u8));
}
async function getJSON(u, onProg) {
  let cache = null;
  try { cache = await caches.open('v5-' + DATA_V); const hit = await cache.match(u); if (hit) return await bytesToJSON(new Uint8Array(await hit.arrayBuffer())); } catch (e) { cache = null; }
  let u8 = null, data;
  if (typeof DecompressionStream !== 'undefined') {
    try { const r = await fetch(u.replace(/\.json$/, '.gz.txt') + '?v=' + DATA_V); if (r.ok) { u8 = await readBody(r, onProg); data = await bytesToJSON(u8); } } catch (e) { u8 = null; }
  }
  if (data === undefined) { const r = await fetch(u + '?v=' + DATA_V); if (!r.ok) throw new Error(u + ' ' + r.status); u8 = await readBody(r, onProg); data = await bytesToJSON(u8); }
  if (cache) { try { await cache.put(u, new Response(u8)); caches.keys().then(ks => ks.filter(k => k.startsWith('v5-') && k !== 'v5-' + DATA_V).forEach(k => caches.delete(k))); } catch (e) { } }
  return data;
}
const IDB = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((res, rej) => { try { const q = indexedDB.open('vanadium5e', 1); q.onupgradeneeded = () => q.result.createObjectStore('packs', { keyPath: 'id' }); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); } catch (e) { rej(e); } });
    return this.db;
  },
  async all() { try { const db = await this.open(); return await new Promise((res, rej) => { const t = db.transaction('packs').objectStore('packs').getAll(); t.onsuccess = () => res(t.result || []); t.onerror = () => rej(t.error); }); } catch (e) { return []; } },
  async put(p) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('packs', 'readwrite'); t.objectStore('packs').put(p); t.oncomplete = res; t.onerror = () => rej(t.error); }); },
  async del(id) { const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction('packs', 'readwrite'); t.objectStore('packs').delete(id); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
};

// ---------- entity types ----------
const TYPES = {
  spells: { label: 'Spells', one: 'Spell' }, monsters: { label: 'Bestiary', one: 'Creature' }, items: { label: 'Equipment', one: 'Item' }, magic: { label: 'Magic Items', one: 'Magic Item' },
  classes: { label: 'Classes', one: 'Class' }, races: { label: 'Species & Races', one: 'Species' }, backgrounds: { label: 'Backgrounds', one: 'Background' }, feats: { label: 'Feats', one: 'Feat' },
  conditions: { label: 'Conditions', one: 'Condition' }, skills: { label: 'Skills', one: 'Skill' }, languages: { label: 'Languages', one: 'Language' },
  properties: { label: 'Item Properties', one: 'Property' }, damage: { label: 'Damage Types', one: 'Damage Type' }, poisons: { label: 'Poisons', one: 'Poison' }
};
let BYID = {};
let PACKS = [];                       // imported homebrew packs
const HB = {};                        // type -> [entities] from packs
function rebuildIndex() {
  BYID = {};
  for (const t of Object.keys(TYPES)) { BYID[t] = {}; for (const e of allOf(t)) BYID[t][e.id] = e; }
}
const allOf = t => [...(D[t] || []), ...(HB[t] || [])];
// edition filter: 'all' | '2014' | '2024'
let EDF = store.get('edf', '2024');
const edOk = e => EDF === 'all' || e.ed === EDF || e.ed === 'hb';
const itemsOf = t => allOf(t).filter(edOk);
// best match for a name in the current edition (used by condition links etc.)
function byName(t, name) {
  const n = String(name).toLowerCase();
  const all = allOf(t).filter(e => e.name.toLowerCase() === n);
  return all.find(e => e.ed === (EDF === 'all' ? '2024' : EDF)) || all.find(edOk) || all[0];
}
function addPack(p) {
  PACKS = PACKS.filter(x => x.id !== p.id); PACKS.push(p);
  for (const t of Object.keys(TYPES)) HB[t] = PACKS.flatMap(pk => (pk.data[t] || []).map(e => (e.ed = 'hb', e.pack = pk.id, e.srcTitle = e.srcTitle || pk.title, e.srcAbbr = e.srcAbbr || pk.abbr, e)));
}
function removePack(id) { PACKS = PACKS.filter(x => x.id !== id); for (const t of Object.keys(TYPES)) HB[t] = (HB[t] || []).filter(e => e.pack !== id); }

// ---------- routing ----------
function go(h) { if (location.hash.slice(1) === h) route(); else location.hash = h; }
window.addEventListener('hashchange', () => route());

// ---------- icons ----------
const ICON = {
  melee: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14.5 17.5 3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2"/></svg>',
  ranged: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 20 20 4M14 4h6v6M4 14v6h6"/></svg>',
  area: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
  trig: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  trait: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 16.5 5.5 21l2-7.5L2 9h7z"/></svg>',
  vil: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16 3 6l5 4 4-6 4 6 5-4-2 10zM5 18h14v2H5z"/></svg>',
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m15 18-6-6 6-6"/></svg>',
  die: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 2 21 7v10l-9 5-9-5V7z"/></svg>'
};
const ICO = {
  swords: '<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="m19 21 2-2"/><path d="M14.5 6.5 18 3h3v3l-3.5 3.5"/><path d="m5 14 4 4"/><path d="m7 17-3 3"/><path d="m3 19 2 2"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  screen: '<rect x="2" y="4" width="6" height="16" rx="1"/><rect x="9" y="4" width="6" height="16" rx="1"/><rect x="16" y="4" width="6" height="16" rx="1"/>',
  dice: '<path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="m12 8-4 7h8z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l4-6 4 6z"/>'
};
const ico = (k, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICO[k] || ''}</svg>`;

// ---------- pins ----------
let pins = store.get('pins', []);
function isPinned(t, id) { return pins.includes(t + '--' + id); }
function togglePin(key) {
  pins = pins.includes(key) ? pins.filter(x => x !== key) : [...pins, key];
  store.set('pins', pins); updatePins();
  $$(`[data-pin="${CSS.escape(key)}"]`).forEach(b => b.classList.toggle('on', pins.includes(key)));
  toast(pins.includes(key) ? 'Pinned' : 'Unpinned');
}
function updatePins() { $('#pincount').textContent = pins.length; }

// ---------- menu ----------
function MENU() {
  return [
    ['Rules', [['book', 'SRD Rules (5.1)'], ['screen', 'DM Screen & Quick Reference'], ['-'], ['conditions'], ['skills'], ['languages'], ['damage'], ['properties']]],
    ['Player', [['classes'], ['races'], ['backgrounds'], ['feats'], ['-'], ['spells']]],
    ['Bestiary', [['monsters'], ['-'], ['encounter', 'Encounter Builder'], ['initiative', 'Initiative Tracker']]],
    ['Items', [['items'], ['magic'], ['poisons'], ['-'], ['loot', 'Random Magic Item']]],
    ['Utilities', [['roller', 'Dice Roller'], ['import', 'Import 5etools JSON'], ['library', 'Library & Sources'], ['pinned', 'Pinned Items']]]
  ];
}
function buildMenu() {
  $('#menu').innerHTML = MENU().map(([lab, items]) => `<div class="mi"><button>${lab}</button><div class="dd">${items.map(([k, l]) => k === '-' ? '<hr>' : `<a href="#${k}">${esc(l || TYPES[k].label)}${TYPES[k] ? `<span>${itemsOf(k).length}</span>` : ''}</a>`).join('')}</div></div>`).join('');
  $$('.mi>button').forEach(b => b.onclick = e => { e.stopPropagation(); const m = b.parentElement; const was = m.classList.contains('open'); $$('.mi').forEach(x => x.classList.remove('open')); if (!was) m.classList.add('open'); });
  $$('#menu a').forEach(a => a.addEventListener('click', () => { $$('.mi').forEach(x => x.classList.remove('open')); $('#menu').classList.remove('on'); }));
}
document.addEventListener('click', e => { if (!e.target.closest('.mi')) $$('.mi').forEach(x => x.classList.remove('open')); });
$('#burger').onclick = () => $('#menu').classList.toggle('on');

// ---------- edition switch ----------
const EDOPTS = [['2014', '2014'], ['2024', '2024'], ['all', 'Both']];
const edSegHtml = () => EDOPTS.map(([k, l]) => `<button data-edf="${k}" class="${EDF === k ? 'on' : ''}" title="${k === 'all' ? 'Show 2014 and 2024 rules' : 'Show ' + k + ' rules (' + SRCN[k] + ')'}">${l}</button>`).join('');
function setEdition(k) {
  EDF = k; store.set('edf', k);
  $$('[data-edf]').forEach(b => b.classList.toggle('on', b.dataset.edf === k));
  for (const t in LSTATE) LSTATE[t] && (LSTATE[t].f = LSTATE[t].f || {});
  buildMenu(); buildIndex(); lastType = null; route();
  toast(k === 'all' ? 'Showing 2014 + 2024 rules' : `Showing ${k} rules (${SRCN[k]})`);
}
$('#edseg').innerHTML = edSegHtml();
document.addEventListener('click', e => { const b = e.target.closest('[data-edf]'); if (b) { e.preventDefault(); setEdition(b.dataset.edf); } });

// ---------- toast / scrim / theme / mobile ----------
let toastT;
function toast(h) { const t = $('#toast'); t.innerHTML = h; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => t.style.display = 'none', 2400); }
let scrimCb = null;
function showScrim(cb) { scrimCb = cb; $('#scrim').classList.add('on'); }
function hideScrim() { $('#scrim').classList.remove('on'); scrimCb = null; }
$('#scrim').onclick = () => { const cb = scrimCb; hideScrim(); $('#sheet').classList.remove('on'); $('#peek').classList.remove('on'); if (cb) cb(); };
function closeSheets() { $('#sheet').classList.remove('on'); $('#peek').classList.remove('on'); hideScrim(); }
function applyTheme(th) { document.documentElement.dataset.theme = th; store.set('theme', th); const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = th === 'dark' ? '#18191c' : '#ffffff'; }
$('#themebtn').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
$('#pinsbtn').onclick = () => go('pinned');
function setupMobile() {
  const mq = matchMedia('(max-width: 900px)');
  const apply = () => { const was = isMob; isMob = mq.matches; document.body.classList.toggle('mob', isMob); if (was !== isMob && D) route(); };
  mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply);
  apply();
}
function confirmSheet(msg, okLabel) {
  return new Promise(res => {
    const el = document.createElement('div');
    el.className = 'dlg';
    el.innerHTML = `<div class="dlg-b"><div style="margin-bottom:14px">${esc(msg)}</div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" data-r="0">Cancel</button><button class="btn" data-r="1">${esc(okLabel)}</button></div></div>`;
    el.onclick = e => { const b = e.target.closest('[data-r]'); if (b || e.target === el) { el.remove(); res(b && b.dataset.r === '1'); } };
    document.body.appendChild(el);
  });
}
