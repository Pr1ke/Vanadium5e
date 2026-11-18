// Composes index.html: Vanadium's stylesheet (from the Draw Steel app) + 5e additions + 5e app shell.
// Usage: node tools/compose-index.mjs "<path to Vanadium — Draw Steel Reference/index.html>"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(process.argv[2], 'utf8');
const css = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>')).split('\n');
const find = (s, from = 0) => css.findIndex((l, i) => i >= from && l.includes(s));
// keep: base → end of respite embed; skip negotiation/montage/sessions/cards; keep the clean theme layer up to cards v2
const a = 0, b = find('/* ---------- negotiation ---------- */');
const c = find('/* =================== VANADIUM — clean app theme'), d = find('/* ================= cards v2 ================= */', c);
const base = [...css.slice(a, b), ...css.slice(c, d)].join('\n');
const extra = fs.readFileSync(path.join(here, 'fivee.css'), 'utf8');
const D20 = `<svg width="26" height="26" viewBox="0 0 32 32"><path d="M16 2 28 9v14l-12 7-12-7V9z" fill="#cfd6de"/><path d="M16 2 28 9 16 12 4 9z" fill="#e6ebf0"/><path d="M16 12 28 9v14L16 30z" fill="#aab6c2"/><path d="m16 12-5 9h10z" fill="#D9622B"/><path d="m11 21 5 9 5-9z" fill="#b84f20"/></svg>`;
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Cpath d=%22M16 2 28 9v14l-12 7-12-7V9z%22 fill=%22%23cfd6de%22/%3E%3Cpath d=%22m16 12-5 9h10z%22 fill=%22%23D9622B%22/%3E%3C/svg%3E">
<title>Vanadium — 5e Reference</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;0,8..60,700;1,8..60,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${base}
${extra}
</style>
</head>
<body>
<div id="loading"><div>Vanadium</div><div class="bar"><div></div></div><div id="loadmsg" style="font-size:13px;font-family:var(--ui);text-transform:none;letter-spacing:0">Loading the rules…</div></div>
<header id="top">
  <button class="tbtn" id="burger" aria-label="Menu"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
  <a id="brand" href="#">${D20}<span>Vanadium</span><span class="ed5">5e</span></a>
  <nav class="menu" id="menu"></nav>
  <div id="searchwrap">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
    <input id="q" placeholder="Search everything…" autocomplete="off" spellcheck="false">
    <div id="sres"></div>
  </div>
  <div class="edseg" id="edseg" title="Which rules edition to show"></div>
  <button class="mbtn" id="msearchbtn" aria-label="Search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></button>
  <button class="tbtn" id="pinsbtn" title="Pinned"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/></svg><span id="pincount">0</span></button>
  <button class="tbtn" id="themebtn" title="Toggle theme"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>
</header>
<div id="main"></div>
<footer>Vanadium 5e uses content from the System Reference Documents 5.1 and 5.2 by Wizards of the Coast LLC, licensed under <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noopener">CC-BY-4.0</a>. Not affiliated with Wizards of the Coast. <a href="#library">Details</a></footer>

<nav id="tabbar">
  <button data-tab="home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>Home</button>
  <button data-tab="browse"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Browse</button>
  <button data-tab="library"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13v2z"/></svg>Rules</button>
  <button data-tab="pinned"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l2.6 5.9 6.4.6-4.9 4.3 1.5 6.3L12 16.9 6.4 20.1l1.5-6.3L3 9.5l6.4-.6z"/></svg>Pinned<span id="mpincount" style="display:none"></span></button>
  <button data-tab="roll"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="m12 8-4 7h8z"/></svg>Roll</button>
</nav>
<div id="scrim"></div>
<div id="sheet"></div>
<div id="peek"></div>
<div id="msearch"><div class="mh"><input id="mq" placeholder="Search spells, monsters, items, rules…" autocomplete="off" spellcheck="false" enterkeyhint="search"><button id="mqclose">Cancel</button></div><div id="mres"><div class="hint">Type to search across every spell, monster, item and rule.</div></div></div>

<button id="fab" title="Dice roller"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"><path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="m12 8-4 7h8z"/><path d="M12 2v6M3 7l5 8M21 7l-5 8M8 15l-5 2M16 15l5 2M8 15l4 7 4-7"/></svg></button>
<div id="roller">
  <div class="rh">Dice <button id="rclose">×</button></div>
  <div class="rb">
    <div class="dq" id="dq"></div>
    <div class="rrow"><input id="rexpr" placeholder="e.g. 2d6+3 or 4d6kh3" autocomplete="off" spellcheck="false"></div>
    <div class="rrow"><div class="advseg" id="advseg"><button data-adv="0" class="on">Normal</button><button data-adv="1">Advantage</button><button data-adv="-1">Disadvantage</button></div></div>
    <button class="bigroll" id="rgo">Roll</button>
    <div id="rlog"></div>
  </div>
</div>
<div id="hov"></div>
<div id="toast"></div>
<script src="js/core.js"></script>
<script src="js/render.js"></script>
<script src="js/pages.js"></script>
<script src="js/dm.js"></script>
<script src="js/import5et.js"></script>
<script src="js/main.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(here, '..', 'index.html'), html);
console.log('index.html', html.length, 'bytes; base css lines', b - a + d - c);
