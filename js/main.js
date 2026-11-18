// Vanadium 5e — boot, router, global events
document.addEventListener('click', e => {
  const pin = e.target.closest('[data-pin]'); if (pin) { e.preventDefault(); togglePin(pin.dataset.pin); return; }
  if (e.target.closest('[data-roll]')) return; // handled by the dice module
  const ae = e.target.closest('[data-addenc]'); if (ae) { e.preventDefault(); addToEncounter(ae.dataset.addenc); return; }
  const ai = e.target.closest('[data-addinit]'); if (ai) { e.preventDefault(); const m = BYID.monsters[ai.dataset.addinit]; if (m) { addCombatant(m, true); sortInit(); saveInit(); toast(`${esc(m.name)} added to <a href="#initiative" style="color:#fff">initiative</a>`); } return; }
  const back = e.target.closest('[data-back]'); if (back) { go(back.dataset.back); return; }
  const del = e.target.closest('[data-delpack]'); if (del) { e.preventDefault(); deletePack(del.dataset.delpack); return; }
  const g = e.target.closest('[data-go]');
  if (g) {
    e.preventDefault(); hideHov();
    const [t, id] = g.dataset.go.split('--');
    if (isMob && g.classList.contains('lnk')) { peek(t, id); return; }
    closeSheets();
    if (BYID[t] && BYID[t][id] && !edOk(BYID[t][id])) { setEditionQuiet('all'); }
    go(g.dataset.go); return;
  }
});
function setEditionQuiet(k) { EDF = k; store.set('edf', k); $$('[data-edf]').forEach(b => b.classList.toggle('on', b.dataset.edf === k)); buildMenu(); buildIndex(); lastType = null; }

function route() {
  if (!D) return;
  hideHov(); $('#sres').classList.remove('on'); closeSheets(); closeMSearch();
  if (isMob) closeRoller();
  markTab();
  const h = decodeURIComponent(location.hash.slice(1));
  const [a, b, c] = h.split('--');
  const done = () => { if (isMob) $('#main').scrollTop = 0; };
  const page = fn => { lastType = null; fn(); done(); };
  if (!a) return page(home);
  if (a === 'book') return page(() => bookPage(b, c));
  if (a === 'library') return page(libraryPage);
  if (a === 'import') return page(importPage);
  if (a === 'pinned') return page(pinnedPage);
  if (a === 'encounter') return page(encounterPage);
  if (a === 'initiative') return page(initiativePage);
  if (a === 'screen') return page(screenPage);
  if (a === 'loot') return page(() => lootPage());
  if (a === 'roller') { openRoller(); history.replaceState(null, '', '#'); return page(home); }
  if (a === 'classes') return page(() => b ? classPage(b) : classIndex());
  if (LIST[a]) {
    if (b && BYID[a][b] && !edOk(BYID[a][b])) setEditionQuiet('all');
    if (lastType === a && $('#lview')) showEntity(a, b);
    else { listPage(a, b); lastType = a; }
    if (isMob && b) { const v = $('#lview'); if (v) v.scrollTop = 0; }
    return;
  }
  home();
}

async function boot() {
  applyTheme(store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  setupMobile();
  try { D = await getJSON('data/srd.json', (g, t) => { $('#loadmsg').textContent = `Loading the rules… ${(g / 1048576).toFixed(1)}${t ? ' / ' + (t / 1048576).toFixed(1) : ''} MB`; }); }
  catch (e) { $('#loadmsg').innerHTML = 'Could not load the rules data (' + esc(e.message) + ').<br>If you opened index.html straight from disk, serve the folder instead (for example <code>npx serve</code> or <code>python -m http.server</code>).'; return; }
  for (const p of await IDB.all()) addPack(p);
  rebuildIndex(); buildMenu(); buildIndex(); updatePins();
  route();
  $('#loading').style.display = 'none';
}
boot();
