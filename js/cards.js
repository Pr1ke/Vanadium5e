// Vanadium 5e — Card Maker: printable item and quest cards (ported from Vanadium for Draw Steel)
// Cards are self-contained, editable copies: picking an SRD item only pre-fills a card, it never links back to the rules data.
const CARD_SIZES = { poker: ['Poker (63 × 88 mm)', 63, 88], tarot: ['Tarot (70 × 120 mm)', 70, 120], large: ['Large (89 × 127 mm)', 89, 127] };
const CARD_PAPERS = { a4: ['A4', 210, 297], letter: ['US Letter', 215.9, 279.4] };
const CARD_STYLES = { modern: ['Modern', 'Coloured header band, clean white body'], classic: ['Classic', 'Parchment, serif type, ornamental frame'], bold: ['Bold', 'Full-colour card with a big icon'], minimal: ['Ink saver', 'White card, thin coloured frame, cheap to print'] };
const CARD_PALETTE = ['#6b6b6b', '#3d7a4a', '#2d5f8a', '#6b3fa0', '#c2531f', '#a8322d', '#a87a1e', '#2a7f7a', '#7a4a2a', '#b0406f', '#3b4a63', '#5b6b2e', '#1d1d1f'];
const RAR_COL = [['very rare', '#6b3fa0'], ['uncommon', '#3d7a4a'], ['common', '#6b6b6b'], ['rare', '#2d5f8a'], ['legendary', '#c2531f'], ['artifact', '#a8322d']];
const CAT_COL = { Weapon: '#a8322d', Armor: '#3b4a63', 'Adventuring Gear': '#5b6b2e', Tools: '#2d5f8a', 'Mounts and Vehicles': '#7a4a2a' };
const KIND_COL = { item: '#7a4a2a', quest: '#a87a1e' };
const REWARD_KINDS = {
  gold: ['Gold', 'gi:two-coins', 'e.g. 250'], item: ['Item', 'gi:open-treasure-chest', 'e.g. Cloak of Elvenkind'], ally: ['Ally', 'gi:shaking-hands', 'e.g. The dwarves of Ironhold join you'],
  xp: ['XP', 'gi:upgrade', 'e.g. 1,800'], favor: ['Favour', 'gi:laurel-crown', 'e.g. The duke owes you a favour'], other: ['Other', 'gi:star-medal', 'Anything else']
};

let CARDS = { style: 'modern', size: 'poker', paper: 'a4', backs: true, watermark: true, iconBack: true, deck: [], ...store.get('cards', {}) };
if (!Array.isArray(CARDS.deck)) CARDS.deck = [];
const saveCards = () => store.set('cards', CARDS);
const cuid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- icons (game-icons.net, CC BY 3.0) ----------
let ICONS = null, iconLoad = null;
function loadIcons() {
  if (ICONS) return Promise.resolve(ICONS);
  return iconLoad || (iconLoad = getJSON('data/icons-gi.json').then(d => { d.names = Object.keys(d.icons); ICONS = d; return d; }).catch(e => { iconLoad = null; throw e; }));
}
const iconDef = ref => { if (!ref || !ICONS) return null; const v = ICONS.icons[String(ref).replace(/^gi:/, '')]; return v ? { w: ICONS.w, d: v[0], eo: !!v[1] } : null; };
const iconSvg = (ref, cls = '') => { const d = iconDef(ref); return d ? `<svg class="${cls}" viewBox="0 0 ${d.w} ${d.w}" aria-hidden="true"><path fill="currentColor"${d.eo ? ' fill-rule="evenodd"' : ''} d="${d.d}"/></svg>` : ''; };
const ICON_DEFAULT = {
  Armor: 'breastplate', Weapon: 'broadsword', Weapons: 'broadsword', Ammunition: 'arrow-cluster', 'Wondrous Items': 'gem-pendant', Potion: 'potion-ball', Potions: 'potion-ball',
  Ring: 'diamond-ring', Rings: 'diamond-ring', Rod: 'winged-scepter', Scroll: 'scroll-unfurled', Staff: 'wizard-staff', Staffs: 'wizard-staff', Wand: 'orb-wand', Wands: 'orb-wand',
  'Adventuring Gear': 'knapsack', Tools: 'toolbox', 'Mounts and Vehicles': 'horse-head', item: 'swap-bag', quest: 'scroll-unfurled'
};
const ICON_SYN = { potion: 'potion-ball', elixir: 'potion-ball', philter: 'round-bottom-flask', draught: 'round-bottom-flask', tonic: 'round-bottom-flask', oil: 'round-bottom-flask', salve: 'round-bottom-flask', ointment: 'round-bottom-flask', flask: 'round-bottom-flask', vial: 'round-bottom-flask', ring: 'diamond-ring', amulet: 'gem-pendant', necklace: 'gem-pendant', pendant: 'gem-pendant', periapt: 'gem-pendant', medallion: 'gem-pendant', brooch: 'gem-pendant', scarab: 'gem-pendant', talisman: 'gem-pendant', cloak: 'cloak', cape: 'cloak', mantle: 'cloak', robe: 'robe', boots: 'boots', slippers: 'boots', helm: 'visored-helm', helmet: 'visored-helm', hat: 'pointy-hat', circlet: 'crown', crown: 'crown', headband: 'crown', shield: 'shield', armor: 'breastplate', plate: 'breastplate', breastplate: 'breastplate', mail: 'chain-mail', blade: 'broadsword', sword: 'broadsword', longsword: 'broadsword', shortsword: 'broadsword', greatsword: 'two-handed-sword', scimitar: 'broadsword', rapier: 'broadsword', axe: 'battle-axe', greataxe: 'battle-axe', handaxe: 'battle-axe', hammer: 'war-pick', maul: 'war-pick', mace: 'flanged-mace', spear: 'spear-hook', trident: 'trident', javelin: 'spear-hook', bow: 'pocket-bow', longbow: 'pocket-bow', shortbow: 'pocket-bow', crossbow: 'crossbow', arrow: 'arrow-cluster', arrows: 'arrow-cluster', bolt: 'arrow-cluster', dagger: 'bowie-knife', knife: 'bowie-knife', dart: 'dart', staff: 'wizard-staff', quarterstaff: 'wizard-staff', wand: 'orb-wand', rod: 'winged-scepter', orb: 'crystal-ball', ball: 'crystal-ball', book: 'spell-book', tome: 'spell-book', manual: 'spell-book', scroll: 'scroll-unfurled', map: 'treasure-map', key: 'key', lantern: 'lantern-flame', lamp: 'lantern-flame', candle: 'candle-light', torch: 'torch', bag: 'swap-bag', pouch: 'swap-bag', sack: 'swap-bag', satchel: 'knapsack', backpack: 'knapsack', pack: 'knapsack', gloves: 'gloves', gauntlets: 'mailed-fist', bracers: 'bracer', belt: 'belt', girdle: 'belt', mask: 'domino-mask', coin: 'two-coins', coins: 'two-coins', bell: 'ringing-bell', horn: 'hunting-horn', pipes: 'pan-flute', flute: 'pan-flute', lute: 'lyre', lyre: 'lyre', harp: 'lyre', drum: 'drum', skull: 'skull-crossed-bones', bone: 'bone-knife', eye: 'eye-target', feather: 'feather', heart: 'heart-bottle', egg: 'egg-clutch', seed: 'seedling', flower: 'flower-emblem', fire: 'fire', flame: 'fire', ice: 'ice-cube', frost: 'snowflake-1', snow: 'snowflake-1', storm: 'lightning-storm', lightning: 'lightning-storm', thunder: 'lightning-storm', star: 'star-swirl', moon: 'moon', sun: 'sun', chain: 'crossed-chains', rope: 'rope-coil', hourglass: 'hourglass', mirror: 'mirror-mirror', dust: 'powder', powder: 'powder', bomb: 'unlit-bomb', beads: 'prayer-beads', bead: 'prayer-beads', stone: 'stone-pile', gem: 'cut-diamond', jewel: 'cut-diamond', crystal: 'crystal-growth', spider: 'spider-alt', dragon: 'dragon-head', wing: 'feathered-wing', wings: 'feathered-wing', broom: 'broom', blood: 'drop', water: 'water-drop', poison: 'poison-bottle', thorn: 'thorny-vine', smoke: 'smoke-bomb', mead: 'beer-stein', ale: 'beer-stein', wine: 'wine-bottle', rations: 'meat', food: 'meat', bread: 'sliced-bread', tent: 'camping-tent', chest: 'open-treasure-chest', horse: 'horse-head', saddle: 'saddle', boat: 'sailboat', ship: 'sailboat', cart: 'wooden-crate', wagon: 'wooden-crate', instrument: 'lyre', kit: 'toolbox', tools: 'toolbox', supplies: 'toolbox', figurine: 'chess-knight', deck: 'card-random', cards: 'card-random', dice: 'dice-six-faces-five', quiver: 'quiver', cube: 'cube', sphere: 'crystal-ball', bottle: 'potion-ball', decanter: 'potion-ball', cauldron: 'cauldron', goggles: 'steampunk-goggles', lens: 'magnifying-glass', glass: 'magnifying-glass', pick: 'war-pick', sling: 'sling', net: 'fishing-net', whip: 'whip', flail: 'flail', lance: 'spear-hook', halberd: 'halberd', glaive: 'halberd', pike: 'spear-hook' };
function autoIcon(c) {
  const words = String(c.title || '').toLowerCase().replace(/[’']s\b/g, '').split(/[^a-z]+/).filter(w => w.length > 2);
  if (ICONS) {
    for (const w of words) { const sg = w.replace(/s$/, ''); const syn = ICON_SYN[w] || ICON_SYN[sg]; if (syn && ICONS.icons[syn]) return 'gi:' + syn; }
    for (const w of words.slice().reverse()) { const sg = w.replace(/s$/, ''); if (ICONS.icons[w]) return 'gi:' + w; if (ICONS.icons[sg]) return 'gi:' + sg; }
  }
  return 'gi:' + (ICON_DEFAULT[c.hint] || ICON_DEFAULT[c.k] || 'sparkles');
}
const cardIcon = c => c.icon === 'none' ? null : (c.icon || autoIcon(c));

// ---------- text: light markup that stays editable as plain text ----------
// **bold**, *italic*, lines starting with "- " are bullets, a blank line starts a new paragraph
const mdInline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*(?=\S)(.+?)\*(?!\w)/g, '$1<i>$2</i>');
function cardMd(s) {
  return String(s || '').replace(/\r/g, '').trim().split(/\n\s*\n/).filter(p => p.trim()).map(p => {
    const lines = p.split('\n').map(l => l.trim()).filter(Boolean);
    let h = '';
    lines.forEach((l, i) => { const li = /^[-•]\s+/.test(l); if (li) h += `<span class="ic-li">${mdInline(l.replace(/^[-•]\s+/, ''))}</span>`; else h += mdInline(l) + (i < lines.length - 1 && !/^[-•]\s+/.test(lines[i + 1]) ? '<br>' : ''); });
    return `<p>${h}</p>`;
  }).join('');
}
const htmlMd = h => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(b|strong)>/gi, '**').replace(/<\/?(i|em)>/gi, '*').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\*\*\s*\*\*/g, '').trim();
function blocksMd(blocks) {
  const out = [];
  for (const b of blocks || []) {
    if (b.t === 'li') { const s = '- ' + htmlMd(b.html); if (out.length && out[out.length - 1].li) out[out.length - 1].s += '\n' + s; else out.push({ s, li: true }); continue; }
    if (b.t === 'p') out.push({ s: htmlMd(b.html) });
    else if (b.t === 'h') out.push({ s: '**' + b.text + '**' });
    else if (b.t === 'table') out.push({ s: (b.caption ? '**' + b.caption + '**\n' : '') + b.rows.map(r => '- ' + r.map(htmlMd).filter(Boolean).join(' — ')).join('\n') });
    else if (b.t === 'quote') out.push({ s: '*' + htmlMd(b.html) + '*' });
    else if (b.t === 'aside') out.push({ s: (b.title ? '**' + b.title + '**\n' : '') + blocksMd(b.blocks) });
  }
  return out.map(x => x.s).filter(Boolean).join('\n\n');
}

// ---------- building cards ----------
function emptyCard(k) {
  return k === 'quest'
    ? { id: cuid('q'), k: 'quest', n: 1, title: '', from: '', text: '', rewards: [{ k: 'gold', v: '' }, { k: 'ally', v: '' }, { k: 'item', v: '' }], color: '', icon: '', back: 'Quest', foot: '' }
    : { id: cuid('c'), k: 'item', n: 1, title: '', sub: '', stats: '', text: '', color: '', icon: '', back: 'Item', foot: '' };
}
function cardFromEntity(t, e) {
  const c = emptyCard('item');
  c.title = e.name; c.src = { t, id: e.id }; c.hint = e.cat || ''; c.text = blocksMd(e.body);
  c.foot = e.ed === 'hb' ? (e.srcTitle || 'Homebrew') : srcName(e);
  if (t === 'magic') {
    let tl = e.typeLine || e.cat || 'Magic item';
    const rar = String(e.rarity || '').trim();
    if (rar && !tl.toLowerCase().includes(rar.toLowerCase().split(/[\s(,]/)[0])) tl += ', ' + rar.toLowerCase();
    if (e.attune && !/attunement/i.test(tl)) tl += ' (requires attunement' + (e.attuneBy ? ' ' + e.attuneBy : '') + ')';
    c.sub = tl; c.back = 'Magic Item';
    const r = rar.toLowerCase(); c.color = (RAR_COL.find(([k]) => r.startsWith(k)) || [])[1] || '';
  } else {
    c.sub = [e.cat, e.sub].filter(Boolean).join(' · '); c.back = e.cat || 'Item'; c.color = CAT_COL[e.cat] || '';
    const st = [['Cost', e.cost], ['Weight', e.weight], ['Damage', e.dmg && e.dmg + (e.dmg2 ? ` (${e.dmg2} two-handed)` : '')], ['AC', e.acS], ['Range', e.range], ['Speed', e.speedS], ['Capacity', e.capacity], ['Strength', e.strMin && 'Str ' + e.strMin], ['Stealth', e.stealth]].filter(x => x[1]);
    c.stats = st.map(([l, v]) => l + ': ' + v).join('\n');
    const extra = [e.props && e.props.length ? '**Properties:** ' + e.props.join(', ') : '', e.mastery ? '**Mastery:** ' + e.mastery : '', e.contents && e.contents.length ? '**Contents:** ' + e.contents.join(', ') : ''].filter(Boolean).join('\n');
    if (extra) c.text = extra + (c.text ? '\n\n' + c.text : '');
  }
  return c;
}
const rewardText = r => { const v = String(r.v || '').trim(); if (r.k === 'gold' && /^[\d.,\s]+$/.test(v)) return v + ' gp'; if (r.k === 'xp' && /^[\d.,\s]+$/.test(v)) return v + ' XP'; return v; };
const statRows = s => String(s || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ['', l]; });
// resolved view of a card: everything the renderers need
function cardView(c) {
  const v = { title: c.title || (c.k === 'quest' ? 'Untitled quest' : 'Untitled item'), color: c.color || KIND_COL[c.k] || '#7a4a2a', icon: cardIcon(c), back: c.back || (c.k === 'quest' ? 'Quest' : 'Item'), foot: c.foot || '' };
  if (c.k === 'quest') {
    v.sub = 'Quest' + (c.from ? ' · ' + c.from : ''); v.check = true;
    const rw = (c.rewards || []).filter(r => String(r.v || '').trim());
    v.body = cardMd(c.text) + (rw.length ? `<div class="ic-rw"><b>Rewards</b>${rw.map(r => `<span class="ic-rwi"><span class="ic-bx"></span>${iconSvg(REWARD_KINDS[r.k]?.[1])}<span>${mdInline(rewardText(r))}</span></span>`).join('')}</div>` : '');
  } else {
    v.sub = c.sub || ''; const st = statRows(c.stats);
    v.body = (st.length ? `<div class="ic-st">${st.map(([l, x]) => `<span>${l ? `<small>${esc(l)}</small>` : ''}${mdInline(x)}</span>`).join('')}</div>` : '') + cardMd(c.text);
  }
  return v;
}
function cardHtml(c, attrs = '') {
  const v = cardView(c), st = CARDS.style || 'modern', [, cw, ch] = CARD_SIZES[CARDS.size] || CARD_SIZES.poker;
  const ic = v.icon ? iconSvg(v.icon) : '';
  return `<div class="icard st-${st}" style="--cc:${esc(v.color)};--cw:${cw};--ch:${ch}" ${attrs}>
    <div class="ic-h">${ic ? `<span class="ic-i">${ic}</span>` : ''}<span class="ic-t"><b>${esc(v.title)}</b>${v.sub ? `<small>${esc(v.sub)}</small>` : ''}</span>${v.check ? '<span class="ic-ck"></span>' : ''}</div>
    <div class="ic-b">${st === 'classic' ? '<div class="ic-orn"><i></i><span></span><i></i></div>' : ''}<div class="ic-x">${v.body}</div>${v.foot ? `<div class="ic-f">${esc(v.foot)}</div>` : ''}${CARDS.watermark !== false && ic && st !== 'bold' && st !== 'minimal' ? `<span class="ic-wm">${ic}</span>` : ''}</div></div>`;
}
function cardBackHtml(c) {
  const v = cardView(c), st = CARDS.style || 'modern', [, cw, ch] = CARD_SIZES[CARDS.size] || CARD_SIZES.poker;
  const ic = CARDS.iconBack !== false && v.icon ? iconSvg(v.icon) : '<span class="ib-dia"></span>';
  return `<div class="icard back st-${st}" style="--cc:${esc(v.color)};--cw:${cw};--ch:${ch}"><div class="ib-in"><span class="ib-c">${ic}</span><b>${esc(v.back)}</b></div></div>`;
}
// shrink the body text until it fits; flag cards whose text is still too long
function fitCards(root) {
  if (!root) return;
  $$('.icard:not(.back)', root).forEach(el => {
    const x = $('.ic-x', el); if (!x) return;
    let s = 10.5; x.style.fontSize = s + 'px';
    while (x.scrollHeight > x.clientHeight + 1 && s > 6.5) { s -= 0.25; x.style.fontSize = s + 'px'; }
    el.classList.toggle('ovf', x.scrollHeight > x.clientHeight + 1);
  });
}
// fit now, then again once the card fonts have loaded (the serif font of the Classic style loads on first use and changes the measurements)
function fitWhenReady(root, after) {
  fitCards(root); if (after) after();
  const F = document.fonts; if (!F || !root) return Promise.resolve();
  return Promise.all(["11px 'Source Serif 4'", "bold 11px 'Source Serif 4'", '10px Inter', 'bold 14px Inter'].map(f => F.load(f).catch(() => { })))
    .then(() => F.ready).catch(() => { }).then(() => { if (root.isConnected) { fitCards(root); if (after) after(); } });
}

// ---------- page ----------
function cardsPage(t, id) {
  if (!ICONS) {
    $('#main').innerHTML = '<div class="scr cardsp"><h1>Card Maker</h1><div class="empty">Loading icons…</div></div>';
    loadIcons().catch(() => { ICONS = { w: 512, icons: {}, names: [] }; toast('Could not load the icons'); }).then(() => { if (/^#cards/.test(location.hash)) cardsPage(t, id); });
    return;
  }
  if (t && id) { history.replaceState(null, '', '#cards'); const e = BYID[t] && BYID[t][id]; if (e) setTimeout(() => cardEditor(cardFromEntity(t, e), true), 0); }
  const deck = CARDS.deck, total = deck.reduce((s, c) => s + (c.n || 1), 0), st = CARDS.style || 'modern';
  const pool = [...itemsOf('magic').map(e => ['magic', e]), ...itemsOf('items').map(e => ['items', e])];
  $('#main').innerHTML = `<div class="scr cardsp"><h1>Card Maker</h1>
    <p class="note">Make printable cards for loot and quests. Pick an item to pre-fill a card from the rules, or start from an empty one. Click any card to edit it.</p>
    <div class="cardadd"><div class="csearch">${ico('search', 16)}<input id="c-q" placeholder="Pick an item: search ${pool.length} magic items and equipment…" autocomplete="off" spellcheck="false"><div id="c-qres" class="cqres"></div></div>
      <button class="btn ghost" id="c-empty">+ Empty item card</button><button class="btn" id="c-quest">+ Quest card</button></div>
    <div class="cdesign"><div class="cd-h">Card style</div><div class="cstyles">${Object.entries(CARD_STYLES).map(([k, [l, d]]) => `<button class="cstyle ${st === k ? 'on' : ''}" data-cstyle="${k}"><span class="cs-prev st-${k}"><i></i><em></em><em></em></span><b>${l}</b><small>${d}</small></button>`).join('')}</div>
      <div class="cardopts"><label>Size <select id="c-size">${Object.entries(CARD_SIZES).map(([k, v]) => `<option value="${k}" ${CARDS.size === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
      <label>Paper <select id="c-paper">${Object.entries(CARD_PAPERS).map(([k, v]) => `<option value="${k}" ${CARDS.paper === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label>
      <label class="row-c"><input type="checkbox" id="c-wm" ${CARDS.watermark !== false ? 'checked' : ''}> Icon watermark</label>
      <label class="row-c"><input type="checkbox" id="c-backs" ${CARDS.backs ? 'checked' : ''}> Print backs</label>
      <label class="row-c"><input type="checkbox" id="c-iback" ${CARDS.iconBack !== false ? 'checked' : ''}> Card icon on back</label></div></div>
    <div class="cacts"><button class="btn" id="c-print" ${total ? '' : 'disabled'}>Print / save as PDF (${total} card${total === 1 ? '' : 's'})</button>${deck.length ? '<button class="btn ghost" id="c-clear">Clear all cards</button>' : ''}<span class="note" style="font-size:12.5px">${sheetInfo()}</span></div>
    ${deck.length ? `<div class="cdeck">${deck.map((c, i) => { const v = cardView(c); return `<div class="cdeck-r" data-cid="${esc(c.id)}"><button class="cd-ic" data-cedit="${i}" style="--cc:${esc(v.color)}" title="Edit">${v.icon ? iconSvg(v.icon) : '—'}</button><b>${esc(v.title)}</b><em class="c-ovf">Text too long</em><span>${c.k === 'quest' ? 'Quest' : 'Item'}</span><button class="ibtn" data-cedit="${i}" title="Edit">✎</button><button class="ibtn" data-cdup="${i}" title="Duplicate">⧉</button><div class="step"><button data-cdec="${i}" title="Fewer copies">−</button><b>${c.n || 1}</b><button data-cinc="${i}" title="More copies">+</button></div><button class="ibtn" data-crm="${i}" title="Delete card">✕</button></div>`; }).join('')}</div>
      <div class="cgrid">${deck.map((c, i) => cardHtml(c, `data-cedit="${i}" data-cid="${esc(c.id)}" title="Click to edit"`)).join('')}</div>`
      : '<div class="empty" style="text-align:left;padding:10px 0">No cards yet. Search for an item above, or start an empty item or quest card.</div>'}
    <p class="note credit">Icons: <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a> by Lorc, Delapouite and contributors (CC BY 3.0). Printed cards carry this credit and the SRD notice in the page margin.</p></div>`;
  fitWhenReady($('.cgrid'), () => $$('.cgrid .icard').forEach(el => $(`.cdeck-r[data-cid="${CSS.escape(el.dataset.cid)}"]`)?.classList.toggle('ovf', el.classList.contains('ovf'))));
  const re = () => { saveCards(); cardsPage(); };
  $$('[data-cstyle]').forEach(b => b.onclick = () => { CARDS.style = b.dataset.cstyle; re(); });
  $('#c-size').onchange = e => { CARDS.size = e.target.value; re(); };
  $('#c-paper').onchange = e => { CARDS.paper = e.target.value; re(); };
  $('#c-wm').onchange = e => { CARDS.watermark = e.target.checked; re(); };
  $('#c-backs').onchange = e => { CARDS.backs = e.target.checked; re(); };
  $('#c-iback').onchange = e => { CARDS.iconBack = e.target.checked; saveCards(); };
  $('#c-empty').onclick = () => cardEditor(emptyCard('item'), true);
  $('#c-quest').onclick = () => cardEditor(emptyCard('quest'), true);
  if ($('#c-clear')) $('#c-clear').onclick = async () => { if (await confirmSheet(`Delete all ${deck.length} cards? This can’t be undone.`, 'Delete all')) { CARDS.deck = []; re(); } };
  $('#c-print').onclick = printCards;
  $$('[data-cedit]').forEach(b => b.onclick = () => cardEditor(CARDS.deck[+b.dataset.cedit], false));
  $$('[data-cdup]').forEach(b => b.onclick = () => { const i = +b.dataset.cdup; const c = JSON.parse(JSON.stringify(CARDS.deck[i])); c.id = cuid(c.k === 'quest' ? 'q' : 'c'); c.n = 1; CARDS.deck.splice(i + 1, 0, c); re(); });
  $$('[data-cinc]').forEach(b => b.onclick = () => { const c = CARDS.deck[+b.dataset.cinc]; c.n = (c.n || 1) + 1; re(); });
  $$('[data-cdec]').forEach(b => b.onclick = () => { const c = CARDS.deck[+b.dataset.cdec]; if ((c.n || 1) > 1) { c.n--; re(); } });
  $$('[data-crm]').forEach(b => b.onclick = async () => { const c = CARDS.deck[+b.dataset.crm]; if (await confirmSheet(`Delete the card “${cardView(c).title}”?`, 'Delete')) { CARDS.deck = CARDS.deck.filter(x => x !== c); re(); } });
  // item search: pick one to open a pre-filled card
  const cq = $('#c-q'), box = $('#c-qres');
  const show = () => {
    const q = cq.value.trim().toLowerCase(); if (!q) { box.innerHTML = ''; box.classList.remove('on'); return; }
    const hits = pool.filter(([, e]) => e.name.toLowerCase().includes(q)).sort((a, b) => (b[1].name.toLowerCase().startsWith(q) - a[1].name.toLowerCase().startsWith(q)) || a[1].name.localeCompare(b[1].name)).slice(0, 14);
    box.innerHTML = hits.map(([t, e]) => { const c = cardFromEntity(t, e); return `<button data-pick="${t}--${esc(e.id)}"><span class="cd-ic" style="--cc:${esc(cardView(c).color)}">${iconSvg(autoIcon(c))}</span><b>${esc(e.name)}${EDF === 'all' || e.ed === 'hb' ? ' ' + edBadge(e) : ''}</b><small>${esc(t === 'magic' ? (e.rarity || 'Magic item') + ' · ' + (e.cat || '') : [e.cat, e.sub].filter(Boolean).join(' · '))}</small>${CARDS.deck.some(x => x.src && x.src.t === t && x.src.id === e.id) ? '<em>has a card</em>' : ''}</button>`; }).join('') || '<div class="empty" style="padding:12px">No item matches. Use “Empty item card” to make your own.</div>';
    box.classList.add('on');
    $$('[data-pick]', box).forEach(b => b.onmousedown = ev => { ev.preventDefault(); const [t, id] = b.dataset.pick.split('--'); box.classList.remove('on'); cardEditor(cardFromEntity(t, BYID[t][id]), true); });
  };
  cq.oninput = show; cq.onfocus = show; cq.onblur = () => setTimeout(() => box.classList.remove('on'), 150);
  cq.onkeydown = e => { if (e.key === 'Enter') { const f = $('[data-pick]', box); if (f) f.dispatchEvent(new MouseEvent('mousedown')); } if (e.key === 'Escape') { cq.value = ''; show(); } };
  document.title = 'Card Maker — Vanadium 5e';
}
function sheetLayout() {
  const [, cw, ch] = CARD_SIZES[CARDS.size] || CARD_SIZES.poker, [, pw, ph] = CARD_PAPERS[CARDS.paper] || CARD_PAPERS.a4, M = 6;
  const cols = Math.max(1, Math.floor((pw - 2 * M) / cw)), rows = Math.max(1, Math.floor((ph - 2 * M) / ch));
  return { cw, ch, pw, ph, cols, rows, per: cols * rows };
}
const sheetInfo = () => { const L = sheetLayout(); return `${L.per} cards per ${CARD_PAPERS[CARDS.paper]?.[0] || 'A4'} sheet`; };

// ---------- editor (items and quests) ----------
function cardEditor(c0, isNew) {
  const c = JSON.parse(JSON.stringify(c0)); const Q = c.k === 'quest';
  const el = document.createElement('div'); el.className = 'dlg';
  const itemNames = uniq(itemsOf('magic').map(e => e.name)).sort();
  const field = (id, label, val, ph, area, rows) => `<label class="cfield">${label}${area ? `<textarea id="${id}" rows="${rows || 5}" placeholder="${esc(ph || '')}">${esc(val || '')}</textarea>` : `<input id="${id}" value="${esc(val || '')}" placeholder="${esc(ph || '')}">`}</label>`;
  const preview = () => { const p = $('.ccust-p', el); p.innerHTML = cardHtml(c) + (CARDS.backs ? cardBackHtml(c) : ''); fitWhenReady(p, () => { const w = $('#ce-ovf', el); if (w) w.style.display = $('.icard.ovf', p) ? '' : 'none'; }); };
  const draw = () => {
    const v = cardView(c);
    el.innerHTML = `<div class="dlg-b ccust"><h2>${isNew ? 'New' : 'Edit'} ${Q ? 'quest' : 'item'} card</h2><div class="ccust-g"><div class="ccust-f">
      ${Q ? field('ce-t', 'Quest', c.title, 'e.g. The Lost Mine') + field('ce-from', 'Given by / where (shown under the title)', c.from, 'e.g. Gundren Rockseeker · Phandalin')
          + field('ce-x', 'What the heroes were asked to do', c.text, 'Find the lost mine of the Rockseeker brothers and drive out whoever holds it.', true, 3)
          + `<div class="cfield">Rewards</div>${(c.rewards || []).map((r, i) => `<div class="qrow"><select data-rk="${i}">${Object.entries(REWARD_KINDS).map(([k, [l]]) => `<option value="${k}" ${r.k === k ? 'selected' : ''}>${l}</option>`).join('')}</select><input data-rv="${i}" value="${esc(r.v || '')}" placeholder="${esc(REWARD_KINDS[r.k]?.[2] || '')}" ${r.k === 'item' ? 'list="ce-items"' : ''}>${r.k === 'item' ? `<button class="ibtn" data-rcard="${i}" title="Also make a card for this item">+ Card</button>` : ''}<button class="ibtn" data-rd="${i}" title="Remove">✕</button></div>`).join('')}
            <datalist id="ce-items">${itemNames.map(n => `<option value="${esc(n)}">`).join('')}</datalist><button class="btn ghost sm" id="ce-radd" style="align-self:flex-start">+ Reward</button>`
        : field('ce-t', 'Name', c.title, 'e.g. Sword of the Ember Tide') + field('ce-s', 'Subtitle', c.sub, 'e.g. Weapon (longsword), rare (requires attunement)')
          + field('ce-st', 'Stats (one per line, “Label: value”)', c.stats, 'Cost: 50 gp\nWeight: 3 lb.\nDamage: 1d8 slashing', true, 3)
          + field('ce-x', 'Text', c.text, 'What the item does.', true, 7)}
      <div class="chint">**bold**, *italic*, a line starting with “- ” is a bullet, a blank line starts a new paragraph.</div>
      <div class="cfield">Icon</div><div class="cc-icon"><span class="cd-ic big" style="--cc:${esc(v.color)}">${v.icon ? iconSvg(v.icon) : '—'}</span><button class="btn ghost sm" id="ce-pick">Choose icon…</button><button class="btn ghost sm" id="ce-noicon">No icon</button>${c.icon ? '<button class="btn ghost sm" id="ce-autoi">Automatic</button>' : ''}</div>
      <div class="cfield">Colour</div><div class="cc-pal">${CARD_PALETTE.map(x => `<button data-col="${x}" style="background:${x}" class="${v.color.toLowerCase() === x ? 'on' : ''}" title="${x}"></button>`).join('')}<input type="color" id="ce-col" value="${esc(v.color)}" title="Custom colour">${c.color ? '<button class="btn ghost sm" id="ce-dcol">Default</button>' : ''}</div>
      <div class="mtrow">${field('ce-b', 'Label on the back', c.back, Q ? 'Quest' : 'Item')}${field('ce-f', 'Footer', c.foot, Q ? 'e.g. Chapter 2' : 'e.g. SRD 5.2')}</div>
      </div><div><div class="ccust-p"></div><div class="warn" id="ce-ovf" style="display:none">The text doesn’t fit, even at the smallest size. Shorten it or pick a larger card size.</div></div></div>
      <div class="dlgfoot">${!isNew ? '<button class="btn danger" id="ce-del">Delete</button>' : ''}<span style="flex:1"></span><button class="btn ghost" id="ce-cancel">Cancel</button><button class="btn" id="ce-ok">${isNew ? 'Add card' : 'Save'}</button></div></div>`;
    preview();
    const val = s => ($(s, el)?.value ?? '');
    const keep = () => {
      c.title = val('#ce-t').trim(); c.text = val('#ce-x'); c.back = val('#ce-b').trim(); c.foot = val('#ce-f').trim();
      if (Q) { c.from = val('#ce-from').trim(); $$('[data-rk]', el).forEach(s => c.rewards[+s.dataset.rk].k = s.value); $$('[data-rv]', el).forEach(s => c.rewards[+s.dataset.rv].v = s.value); }
      else { c.sub = val('#ce-s').trim(); c.stats = val('#ce-st'); }
    };
    $$('input:not([type=color]),textarea', el).forEach(i => i.oninput = () => { keep(); preview(); });
    $$('[data-rk]', el).forEach(s => s.onchange = () => { keep(); draw(); });
    $$('[data-rd]', el).forEach(b => b.onclick = () => { keep(); c.rewards.splice(+b.dataset.rd, 1); draw(); });
    $$('[data-rcard]', el).forEach(b => b.onclick = () => {
      keep(); const name = String(c.rewards[+b.dataset.rcard].v || '').trim(); if (!name) { toast('Type the item first'); return; }
      const e = byName('magic', name) || byName('items', name);
      const nc = e ? cardFromEntity(BYID.magic[e.id] === e ? 'magic' : 'items', e) : Object.assign(emptyCard('item'), { title: name });
      CARDS.deck.push(nc); saveCards(); toast(`Card added for ${esc(nc.title)}${e ? '' : ' (empty, not in the rules)'}`);
    });
    if ($('#ce-radd', el)) $('#ce-radd', el).onclick = () => { keep(); c.rewards.push({ k: 'other', v: '' }); draw(); setTimeout(() => $$('[data-rv]', el).pop()?.focus(), 0); };
    $('#ce-pick', el).onclick = () => { keep(); iconPicker(c, ref => { c.icon = ref; draw(); }); };
    $('#ce-noicon', el).onclick = () => { keep(); c.icon = 'none'; draw(); };
    if ($('#ce-autoi', el)) $('#ce-autoi', el).onclick = () => { keep(); c.icon = ''; draw(); };
    $$('[data-col]', el).forEach(b => b.onclick = () => { keep(); c.color = b.dataset.col; draw(); });
    $('#ce-col', el).onchange = e => { keep(); c.color = e.target.value; draw(); };
    if ($('#ce-dcol', el)) $('#ce-dcol', el).onclick = () => { keep(); c.color = ''; draw(); };
    $('#ce-cancel', el).onclick = () => el.remove();
    if ($('#ce-del', el)) $('#ce-del', el).onclick = async () => { if (await confirmSheet(`Delete the card “${cardView(c).title}”?`, 'Delete')) { CARDS.deck = CARDS.deck.filter(x => x.id !== c.id); saveCards(); el.remove(); cardsPage(); } };
    $('#ce-ok', el).onclick = () => {
      keep(); if (!c.title) { toast(Q ? 'Give the quest a name' : 'Give the item a name'); $('#ce-t', el).focus(); return; }
      if (Q) c.rewards = c.rewards.filter(r => String(r.v || '').trim());
      const i = CARDS.deck.findIndex(x => x.id === c.id); if (i >= 0) CARDS.deck[i] = c; else CARDS.deck.push(c);
      saveCards(); el.remove(); if (/^#cards/.test(location.hash)) cardsPage(); else toast(`Card added. <a href="#cards" style="color:#fff">Open Card Maker</a>`);
    };
  };
  draw(); document.body.appendChild(el); setTimeout(() => { const t = $('#ce-t', el); if (t && !t.value) t.focus(); }, 30);
}
function iconPicker(c, onPick) {
  const el = document.createElement('div'); el.className = 'dlg';
  const sugg = () => { const out = new Set([autoIcon(c)]); const words = String(c.title || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length > 2); for (const w of words) { const sg = w.replace(/s$/, ''); ICONS.names.filter(n => n.split('-').includes(sg) || n.split('-').includes(w)).slice(0, 8).forEach(n => out.add('gi:' + n)); } out.add('gi:' + (ICON_DEFAULT[c.hint] || ICON_DEFAULT[c.k] || 'sparkles')); return [...out].filter(iconDef).slice(0, 16); };
  el.innerHTML = `<div class="dlg-b ipick"><h2>Choose an icon</h2>
    <div class="csearch">${ico('search', 16)}<input id="ip-q" placeholder="Search ${ICONS.names.length.toLocaleString()} icons, e.g. potion, sword, skull, castle…" autocomplete="off"></div>
    <div class="ip-sug-h">Suggested${c.title ? ` for “${esc(c.title)}”` : ''}</div><div class="ip-grid sug" id="ip-sug"></div>
    <div class="ip-sug-h" id="ip-rh"></div><div class="ip-grid" id="ip-res"></div>
    <div class="dlgfoot"><span class="note" style="margin:0;font-size:12px">Icons: game-icons.net (CC BY 3.0)</span><span style="flex:1"></span><button class="btn ghost" id="ip-x">Cancel</button></div></div>`;
  document.body.appendChild(el);
  const cell = ref => { const n = ref.slice(3).replace(/-/g, ' '); return `<button data-ic="${ref}" title="${esc(n)}">${iconSvg(ref)}<span>${esc(n)}</span></button>`; };
  const bind = () => $$('[data-ic]', el).forEach(b => b.onclick = () => { el.remove(); onPick(b.dataset.ic); });
  const render = q => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    let names = terms.length ? ICONS.names.filter(n => terms.every(t => n.includes(t))) : ICONS.names;
    if (terms.length) names = names.slice().sort((a, b) => (b.split('-').includes(terms[0]) - a.split('-').includes(terms[0])) || a.length - b.length);
    $('#ip-rh', el).textContent = terms.length ? `${names.length.toLocaleString()} matches${names.length > 300 ? ' (showing 300)' : ''}` : `Browse all (showing 300 of ${names.length.toLocaleString()})`;
    $('#ip-res', el).innerHTML = names.slice(0, 300).map(n => cell('gi:' + n)).join('') || '<div class="empty">No icons match. Try another word.</div>';
    bind();
  };
  $('#ip-sug', el).innerHTML = sugg().map(cell).join('');
  let tm; $('#ip-q', el).oninput = e => { clearTimeout(tm); tm = setTimeout(() => render(e.target.value.trim()), 150); };
  $('#ip-x', el).onclick = () => el.remove();
  el.onclick = e => { if (e.target === el) el.remove(); };
  render(''); setTimeout(() => $('#ip-q', el)?.focus(), 30);
}

// ---------- printing: real-size sheets with crop marks, backs mirrored for double-sided printing ----------
async function printCards() {
  await loadIcons();
  const L = sheetLayout(), faces = CARDS.deck.flatMap(c => Array.from({ length: Math.max(1, c.n || 1) }, () => c));
  if (!faces.length) return;
  const gx = (L.pw - L.cols * L.cw) / 2, gy = (L.ph - L.rows * L.ch) / 2;
  const marks = () => { let h = ''; const t = 'class="cmark"';
    for (let i = 0; i <= L.cols; i++) { const x = gx + i * L.cw; h += `<i ${t} style="left:${x}mm;top:${gy - 4.5}mm;height:3.5mm"></i><i ${t} style="left:${x}mm;top:${gy + L.rows * L.ch + 1}mm;height:3.5mm"></i>`; }
    for (let j = 0; j <= L.rows; j++) { const y = gy + j * L.ch; h += `<i ${t} style="top:${y}mm;left:${gx - 4.5}mm;width:3.5mm"></i><i ${t} style="top:${y}mm;left:${gx + L.cols * L.cw + 1}mm;width:3.5mm"></i>`; }
    return h; };
  const sheet = cells => `<div class="csheet" style="width:${L.pw}mm;height:${L.ph}mm">${marks()}<div class="cs-grid" style="left:${gx}mm;top:${gy}mm;grid-template-columns:repeat(${L.cols},${L.cw}mm);grid-auto-rows:${L.ch}mm">${cells.join('')}</div><div class="cs-cred">Icons: game-icons.net (CC BY 3.0) · Rules text from the System Reference Document 5.1/5.2 by Wizards of the Coast LLC (CC-BY-4.0) · Made with Vanadium 5e</div></div>`;
  let html = '';
  for (let p = 0; p < faces.length; p += L.per) {
    const pg = faces.slice(p, p + L.per);
    html += sheet(pg.map(c => cardHtml(c)));
    if (CARDS.backs) { const cells = Array(L.per).fill('<div></div>'); pg.forEach((c, i) => { const r = Math.floor(i / L.cols), col = i % L.cols; cells[r * L.cols + (L.cols - 1 - col)] = cardBackHtml(c); }); html += sheet(cells); }
  }
  $('#cprint')?.remove(); $('#cpage')?.remove();
  const root = document.createElement('div'); root.id = 'cprint'; root.innerHTML = html; document.body.appendChild(root);
  const pst = document.createElement('style'); pst.id = 'cpage'; pst.textContent = `@page{size:${L.pw}mm ${L.ph}mm;margin:0}`; document.head.appendChild(pst);
  await fitWhenReady(root);
  const bad = $$('.icard.ovf', root).length;
  if (bad) toast(`${bad} card${bad > 1 ? 's have' : ' has'} text that doesn’t fit. It will be cut off.`);
  document.body.classList.add('cprinting');
  const done = () => { document.body.classList.remove('cprinting'); root.remove(); pst.remove(); };
  window.addEventListener('afterprint', done, { once: true });
  setTimeout(() => window.print(), 50);
}
