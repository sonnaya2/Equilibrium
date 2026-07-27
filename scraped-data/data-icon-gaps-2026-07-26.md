# Data icon gaps — 2026-07-26

Gap report: `/data` entity names (catalog content, permanent unlocks, regional equipment) vs local art under `public/game/{bosses,activities,upgrades,combat/equipment,skills}`.

Method: slugify entity names; match basename / path leaf under the five roots (832 files indexed). Abstract packages (`… progression`, hubs, infrastructure, residual chains) are counted but **not** harvest candidates.

---

## Counts

| Surface | Unique names | Matched | Missing | Concrete miss | Abstract miss | Match rate |
|---|---:|---:|---:|---:|---:|---:|
| Catalog content (`regions[].content`) | 86 | 53 | 33 | 30 | 3 | 61.6% |
| Catalog upgrades (`regions[].upgrades`) | 947 | 339 | 608 | 422 | 186 | 35.8% |
| Regional equipment (`recordType=equipment`) | 397 | 169 | 228 | 182 | 46 | 42.6% |
| Permanent unlocks (progression + account rows) | 1,042 | 351 | 691 | 475 | 216 | 33.7% |
| Regional activities (context) | 530 | 149 | 381 | 242 | 139 | 28.1% |

**On disk (target roots):** 832 icon files · skills 29/29 complete · bosses/activities already dense for short names.

**Matching caveat:** many “content” misses are **title variants of existing icons** (e.g. `Kerapac, the bound` vs `bosses/kerapac.png`, `Telos, the Warden` vs `telos.png`, `Nex: Angel of Death` vs `nex-aod.png`). Those are resolver/alias work, not harvest work.

---

## Top misses by surface

### Catalog content (true icon gaps, not aliasable bosses)

| Name | Kind | Region | Notes |
|---|---|---|---|
| Pale wisps near Draynor | Divination | misthalin | place/method, not inventory |
| Sanguine Crawler | Slayer | havenhythe | creature, no local art |
| Birdhouses / Clockwork box traps / Black chinchompas | Hunter | havenhythe | concrete item icons possible |
| Fish farming / Giant crayfish fishing | Fishing | havenhythe | activity, weak icon subjects |
| Apex Hide Armour | upgrade | havenhythe | set package — use representative piece (on disk: `apex-hide-body`) |
| Duradel | Slayer | karamja | NPC |
| Temple of Aminishi | Elite Dungeon | asgarnia | place |
| Pest Control / Warriors' Guild / Troll Invasion / Taverley Dungeon | minigame/dungeon | asgarnia | places |
| Advanced Gnome Stronghold course | Agility | kandarin | place |
| Lunar spellbook and Lunar utility | Magic | fremennik | abstract dual |
| Abyss entrance | Runecrafting | forinthry | alias of `activities/abyss` |
| The Barrows Brothers | bossing | morytania | alias of `barrows` activity |

Boss title variants already covered by short files: Kerapac, Rasial, Hermod, Zemouregal & Vorkath, Vermyx, Kezalam, Nakatra, Ivar, Amascut, Telos, Araxxor/Araxxi, Nex: AoD.

### Catalog upgrades — high-value concrete item gaps

| Name | Why it matters |
|---|---|
| **Amulet of glory** | Permanent multi-city travel; exact wiki item |
| Expansive essence pouch | Endgame RC pouch |
| Ring of Fortune / Ring of Wealth | Luck ladder (also Archaeology relic powers) |
| Archaeologist's / Artisan's outfits | XP outfits (master-archaeologist exists; base artisan missing) |
| Auto-screener v1.080 | Archaeology Invention device |
| Cooking gauntlets | Classic burn-reduction gloves |
| Dig Site pendant | Archaeology / Curses travel |
| Explorer's ring 1–4 | Lumbridge diary utility |
| Guildmaster Tony's mattock | End-game Archaeology mattock |
| Passing bracelet | Underworld teleport jewellery |
| Focus storage | Necromancy container |
| Grace of the Elves | Porter BiS necklace (catalog/combat-adjacent) |

Skip as packages: “First Necromancer's equipment”, “Kerapac progression”, “GWD2 anima core and mid-tier…”, museum/chronote economy rows.

### Regional equipment — concrete gaps

| Name | Notes |
|---|---|
| Occultist's ring | Necromancy ring residual |
| Gemstone hauberk | Mid-high hybrid armour piece |
| Deathwarden robe top | Necromancy tank set piece |
| Sirenic / Tectonic / Cryptbloom / Anima core **set names** | Pieces already on disk — set labels need resolver, not new art |
| Drygore weapon set / Chaotic weapons | Packages — pieces partly present |
| Channeller's ring | Already on disk as `channelers-ring` (alias) |

### Permanent unlocks — concrete gaps

| Name | Notes |
|---|---|
| Binding contract | Ancient Summoning |
| Brooch of the Gods | Invention/porter utility |
| Divine charge | Invention fuel |
| Elder overload potion / Vulnerability bomb / Adrenaline renewal potion / Weapon poison+++ | Combat consumables |
| Fury of the Small | Necromancy talent |
| Ava's alerter / accumulator | Ranged ammo saver chain |
| Diary T4 rewards | Explorer's ring 4, Varrock armour 4, Drakan's medallion, Sixth-Age circuit, Camulet, etc. |
| Hazelmere's signet ring / Amulet of fury / Blood amulet of fury | Luck / hybrid jewellery |
| Archers' / Seers' / Warrior / Ferocious / Leviathan rings | Fremennik ladder + upgrades |
| Grasping rune pouch / Rune pouch / Seed bag / Herb bag / Wood box | Inventory QoL |

Already on disk (do not re-harvest): Bonecrusher, Charming imp, Herbicide, Seedicide, Ring of vigour, Salve (e), Asylum surgeon's ring, Spring cleaner 9001, Enhanced Excalibur, Spirit cape, Dreadnip, EoF, most T90–T95 BiS weapons/armour pieces under `combat/equipment` and `upgrades/progression`.

---

## Recommended harvest list (≤40 concrete subjects)

Priority for `assets/source-manifest-expansion-30.json` — exact wiki inventory subjects only:

1. Amulet of glory  
2. Grace of the Elves  
3. Ring of Fortune  
4. Ring of Wealth  
5. Hazelmere's signet ring  
6. Amulet of fury  
7. Blood amulet of fury  
8. Archers' ring  
9. Seers' ring  
10. Warrior ring  
11. Ferocious ring  
12. Leviathan ring  
13. Superior leviathan ring  
14. Expansive essence pouch  
15. Grasping rune pouch  
16. Seed bag  
17. Herb bag  
18. Wood box  
19. Brooch of the Gods  
20. Dig Site pendant  
21. Cooking gauntlets  
22. Auto-screener v1.080  
23. Guildmaster Tony's mattock  
24. Passing bracelet  
25. Occultist's ring  
26. Binding contract  
27. Divine charge  
28. Elder overload potion  
29. Vulnerability bomb  
30. Adrenaline renewal potion  
31. Weapon poison+++  
32. Fury of the Small  
33. Gemstone hauberk  
34. Deathwarden robe top  
35. Ava's alerter  
36. Drakan's medallion  
37. Explorer's ring 4  
38. Varrock armour 4  
39. Sixth-Age circuit  
40. Camulet  

**Not harvested (by policy):** abstract packages, boss title aliases, set-family labels when a representative piece already exists, gen-AI invent, runtime wiki hotlinks.

---

## Follow-ups (outside this expansion)

1. **Name-alias map** in the data UI resolver: strip epithets (`the bound`, `the Warden`), map `Nex: Angel of Death` → `nex-aod`, `Zemouregal & Vorkath` → `zemouregal-vorkath`, set names → representative piece files.  
2. **Diary T1–T3** and remaining T4 rewards (Karamja gloves 4, Morytania legs 4, …) — second pass if `/data` starts rendering diary icons.  
3. **Consumable flasks / powerbursts / holy aggroverload** — only if combat/consumables surface ships icons.  
4. Do not expand harvest for Archaeology monolith *relic power* rows (always abstract).

Analysis dump: `tmp-icon-gap-analysis.json` (generated 2026-07-26).
