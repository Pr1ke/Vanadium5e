# Vanadium — 5e Reference

The Vanadium rules compendium, for D&D fifth edition. It has the same look and engine as *Vanadium — Draw Steel Reference*. The feature set follows 5etools.

## Run it

The app loads its data with `fetch`, so serve the folder rather than opening `index.html` directly:

```
cd "Vanadium — 5e Reference"
python -m http.server 8000      # then open http://localhost:8000
```

Any static host works the same way (GitHub Pages, Netlify, the server you use for the Draw Steel version). To get an "Update from GitHub" button on a PHP/Apache host, see [deploy/README.md](deploy/README.md).

## What's inside

- **Both editions:** SRD 5.1 (2014) and SRD 5.2 (2024). Use the `2014 · 2024 · Both` switch in the top bar.
- **Reference lists with pill filters (include/exclude), sorting and search:** spells, bestiary, equipment, magic items, classes, species/races, backgrounds, feats, conditions, skills, languages, item properties, damage types and poisons.
- **Class pages:** class table, features by level, subclasses and the class spell list.
- **SRD rules reader:** Combat, Ability Scores, Adventuring, Spellcasting, Equipment and the Appendix.
- **Stat blocks:**
  - Dice, to-hit bonuses, HP and initiative are clickable and roll.
  - Click an ability to roll a check; Shift-click it to roll a saving throw.
  - Conditions and spells link to their entries and show a preview on hover.
- **GM tools:**
  - Encounter Builder: 2024 XP budget or 2014 thresholds with multipliers.
  - Initiative Tracker: HP, conditions, rounds, with the current creature's stat block shown alongside.
  - DM Screen.
  - Random Magic Item.
  - Dice roller: advantage/disadvantage, `4d6kh3` and similar expressions.
- **Import 5etools JSON:** load homebrew or your own 5etools-format files (creatures, spells, items, feats, backgrounds, species, conditions).
  - `{@tags}` are converted.
  - Imports are stored in this browser only.
  - Classes in 5etools format aren't supported yet.
- **Pins, global search (`/`) and dark mode.** The mobile layout has a tab bar and bottom sheets.

## Files

| Path | What it is |
|---|---|
| `index.html` | App shell and stylesheet. Generated, so don't edit it directly (see below). |
| `js/core.js` | Data loading, editions, pins, menu |
| `js/render.js` | Stat blocks, spell and item cards, dice and condition linking |
| `js/pages.js` | List pages, class pages, rules reader, home, library, search |
| `js/dm.js` | Dice, encounter builder, initiative, DM screen, random item |
| `js/import5et.js` | 5etools-format importer |
| `js/main.js` | Boot, router |
| `data/srd.json`, `data/srd.gz.txt` | Built SRD data (the app prefers the compressed `.gz.txt`) |
| `tools/build-srd.mjs` | Builds `data/` from the 5e-bits SRD database |
| `tools/compose-index.mjs`, `tools/fivee.css` | Build `index.html` from the Draw Steel Vanadium stylesheet plus the 5e additions |

## Rebuilding

To rebuild the data:

```
git clone --depth 1 https://github.com/5e-bits/5e-database
node tools/build-srd.mjs 5e-database/src
```

To change the styling, edit `tools/fivee.css`, then run:

```
node tools/compose-index.mjs "../Vanadium — Draw Steel Reference/index.html"
```

Bump `DATA_V` in `js/core.js` whenever the data changes, so browsers drop their cached copy.

## Legal

This work includes material from the System Reference Document 5.1 and the System Reference Document 5.2 by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. Both SRDs are licensed under the Creative Commons Attribution 4.0 International License (https://creativecommons.org/licenses/by/4.0/legalcode). The structured data comes from 5e-bits/5e-database (MIT). Some icons are from Lucide (ISC). Full notices are in [CREDITS.md](CREDITS.md). Vanadium is not affiliated with or endorsed by Wizards of the Coast.
