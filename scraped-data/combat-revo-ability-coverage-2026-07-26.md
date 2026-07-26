# Revolution bar ability coverage matrix

**Date:** 2026-07-26  
**Repo:** `C:\Users\Sonnaya\Rs3Equilibrium`  
**Sources (read-only):**

| Source | Path / URL |
|--------|------------|
| Expanded Revo++ bars (single-target only) | `data/combat/revolution-bars.json` |
| Wiki scrape snapshot | `scraped-data/combat-revolution-bars-2026-07-25.json` |
| Ability records | `data/combat/abilities.json` |
| Record → engine id map | `src/combat/data/specs.ts` → `ENGINE_ID_BY_RECORD_ID` (+ Adaptive Strike special-case in `resolveBarSlot`) |
| Engine AbilitySpecs | `src/combat/styles/{melee,ranged,magic,necromancy}/abilities.ts` (`*_ABILITIES`, + `volleyOfSouls()` factory) |
| Wiki multi / manual / levelling bars | https://runescape.wiki/w/Revolution/Bars (fetched 2026-07-26) |

**Resolution path (engine):** `resolveBarSlot` → engine map (or setup-specific Adaptive Strike) → `engineSpecs.get(id)` → else `specFromRecord` if `damagePercent` → else **unmodelled**.

**Legend**

| Column | Meaning |
|--------|---------|
| **record id** | `abilities.json` id, or `null` / missing |
| **engine map** | Value in `ENGINE_ID_BY_RECORD_ID`, or special resolve rule |
| **engine spec?** | AbilitySpec present in style `*_ABILITIES` (or factory) with calculable use |
| **bars** | Where the name appears: `ST` single-target Revo++ (in `revolution-bars.json`); `multi` wiki multi-target; `manual` wiki endgame manual; `repl` wiki replacement; `lvl` levelling bars |

---

## 1. Melee

| ability name | record id | engine map | engine spec? | notes |
|--------------|-----------|------------|--------------|-------|
| Berserk | `melee:berserk` | `berserk` | **yes** | ST DW/2H, multi 2H. Buff ultimate (`hits: []` + buff). |
| Meteor Strike | `melee:meteor-strike` | `meteor_strike` | **yes** | ST DW/2H, multi 2H, manual. |
| Chaos Roar | `melee:chaos-roar` | `chaos_roar` | **yes** | ST DW/2H, multi 2H, manual. Multi notes: omit if not owned. |
| Overpower | `melee:overpower` | `overpower` | **yes** | ST DW/2H, multi 2H, manual. |
| Rend | `melee:rend` | `rend` | **yes** | ST DW/2H, multi 2H, manual. |
| Dismember | `melee:dismember` | `dismember` | **yes** | ST DW/2H, manual. Not on multi 2H BiS. |
| Flurry | `melee:flurry` | `flurry` | **yes** | ST dual-wield only. |
| Hurricane | `melee:hurricane` | `hurricane` | **yes** | ST 2H + multi 2H + manual 2H. |
| Adaptive Strike | `melee:adaptive-strike` | **special** → `adaptive_strike_dw` / `adaptive_strike_2h` | **yes** | Not in `ENGINE_ID_BY_RECORD_ID`; `resolveBarSlot` picks by `setup`. |
| Greater Fury | `melee:greater-fury` | `greater_fury` | **yes** | ST DW/2H, multi 2H. |
| Fury | `melee:fury` | `fury` | **yes** | `repl` for Greater Fury. |
| Assault | `melee:assault` | `assault` | **yes** | ST DW/2H, multi 2H, manual. |
| Punish | `melee:punish` | `punish` | **yes** | **manual** endgame only (not Revo++ ST). Engine has HP-threshold multiplier constants. |
| Attack | `melee:attack` | `attack` | **yes** | **manual** auto basic. |
| Sacrifice | `shared:sacrifice` | **— (unmapped)** | **no** | Multi 2H (heal + damage variants). Resolves via **record adapter** (`modelledBy: "record"`, 70–70%). No shared engine AbilitySpec. |

**Melee multi-target note:** Wiki deprecates dual-wield multi; multi bars are 2H only. **Not present** in `revolution-bars.json` (ST-only data).

---

## 2. Ranged

| ability name | record id | engine map | engine spec? | notes |
|--------------|-----------|------------|--------------|-------|
| Greater Death's Swiftness | `ranged:greater-deaths-swiftness` | `greater_deaths_swiftness` | **yes** | ST + manual. Buff ultimate (`hits: []`). |
| Death's Swiftness | `ranged:deaths-swiftness` | `deaths_swiftness` | **yes** | `repl`. Buff ultimate. |
| Greater Ricochet | `ranged:greater-ricochet` | `greater_ricochet` | **yes** | ST + manual. |
| Ricochet | `ranged:ricochet` | `ricochet` | **yes** | `repl`. |
| Sacrifice | `shared:sacrifice` | **—** | **no** | ST ranged. Record adapter only (style overridden to bar style). |
| Imbue: Shadows | `ranged:imbue-shadows` | `imbue_shadows` | **yes** | ST + manual. |
| Shadow Tendrils | `ranged:shadow-tendrils` | `shadow_tendrils` | **yes** | ST + manual. |
| Galeshot | `ranged:galeshot` | `galeshot` | **yes** | ST + manual. |
| Rapid Fire | `ranged:rapid-fire` | `rapid_fire` | **yes** | ST + manual. |
| Deadshot | `ranged:deadshot` | `deadshot` | **yes** | ST + manual. |
| Snap Shot | `ranged:snap-shot` | `snap_shot` | **yes** | ST + manual. |
| Piercing Shot | `ranged:piercing-shot` | `piercing_shot` | **yes** | ST + manual. |
| Ranged (ability) | `ranged:attack` | `ranged_attack` | **yes** | **manual** auto basic (`name` in JSON: `"Ranged"`). |

**Ranged multi-target note:** Wiki says use ST bar + chinchompas (no separate multi ability list). No extra ability names.

---

## 3. Magic

| ability name | record id | engine map | engine spec? | notes |
|--------------|-----------|------------|--------------|-------|
| Greater Sunshine | `magic:greater-sunshine` | `greater_sunshine` | **yes** | ST. |
| Sunshine | `magic:sunshine` | `sunshine` | **yes** | `repl` + **multi** BiS uses **base** Sunshine (not Greater). |
| Tsunami | `magic:tsunami` | `tsunami` | **yes** | ST, multi, manual. |
| Greater Concentrated Blast | `magic:greater-concentrated-blast` | `greater_concentrated_blast` | **yes** | ST, multi, manual. |
| Concentrated Blast | `magic:concentrated-blast` | `concentrated_blast` | **yes** | `repl`. |
| Asphyxiate | `magic:asphyxiate` | `asphyxiate` | **yes** | ST + manual. |
| Combust | `magic:combust` | `combust` | **yes** | ST + manual. |
| Omnipower | `magic:omnipower` | `omnipower` | **yes** | ST, multi, manual. |
| Smoke Tendrils | `magic:smoke-tendrils` | `smoke_tendrils` | **yes** | ST + manual. |
| Sonic Wave | `magic:sonic-wave` | `sonic_wave` | **yes** | ST + manual. |
| Wild Magic | `magic:wild-magic` | `wild_magic` | **yes** | ST, multi, manual. |
| Dragon Breath | `magic:dragon-breath` | `dragon_breath` | **yes** | ST, multi, manual. |
| Greater Chain | `magic:greater-chain` | `greater_chain` | **yes** | **multi** only (not ST Revo++). |
| Chain | `magic:chain` | `chain` | **yes** | `repl` for Greater Chain; also **lvl** bars. |
| Magma Tempest | `magic:magma-tempest` | `magma_tempest` | **yes** | **multi** (omit if unowned). |
| Corruption Blast | `magic:corruption-blast` | `corruption_blast` | **yes** | **multi** + **manual** keybind slot. |
| Magic (ability) | `magic:magic-attack` | `magic_attack` | **yes** | **manual** auto basic (`name` in JSON: `"Magic"`). |

**Magic multi bar (wiki):** Sunshine, Tsunami, Greater Chain, Omnipower, Magma Tempest, Corruption Blast, Greater Concentrated Blast, Dragon Breath, Wild Magic — **all engine-mapped**. Multi bar itself is **not** in `revolution-bars.json`.

---

## 4. Necromancy

| ability name | record id | engine map | engine spec? | notes |
|--------------|-----------|------------|--------------|-------|
| Conjure Undead Army | **missing** | — | **no** | ST + multi + manual. Bar slot `abilityId: null`. Only prose in `NECROMANCY_EFFECTS` (`conjures`). **GAP — unmodelled bar slot.** |
| Conjure Vengeful Ghost | **missing** | — | **no** | ST + multi + lvl. `abilityId: null`. **GAP.** |
| Conjure Skeleton Warrior | **missing** | — | **no** | ST + multi + lvl. `abilityId: null`. **GAP.** |
| Conjure Putrid Zombie | **missing** | — | **no** | Multi + lvl. No bar record. **GAP.** |
| Conjure Phantom Guardian | **missing** | — | **no** | Wiki optional for hard content; no bar record. **GAP.** |
| Death Skulls | `necromancy:death-skulls` | `death_skulls` | **yes** | ST + multi + manual. ST model: 3×225–275%. |
| Living Death | `necromancy:living-death` | `living_death` | **yes** | ST + manual. Buff ultimate (`hits: []`). |
| Soul Sap | `necromancy:soul-sap` | `soul_sap` | **yes** | ST, multi, manual, lvl. |
| Touch of Death | `necromancy:touch-of-death` | `touch_of_death` | **yes** | ST, multi, manual, lvl. |
| Sacrifice | `shared:sacrifice` | **—** | **no** | ST necro + multi low-cost. Record adapter only. |
| Volley of Souls | `necromancy:volley-of-souls` | `volley_of_souls` | **yes*** | ST + multi (>10k). *Factory `volleyOfSouls(n)` — not a static array entry; map + factory produce AbilitySpec. |
| Finger of Death | `necromancy:finger-of-death` | `finger_of_death` | **yes** | ST, multi, manual, lvl. |
| Bloat | `necromancy:bloat` | `bloat` | **yes** | ST + multi + manual + lvl. |
| Blood Siphon | `necromancy:blood-siphon` | `blood_siphon` | **yes** | Multi primary. Solo engine = **finisher only** (channel AoE unmodelled — `blood_siphon_aoe` effects note). |
| Spectral Scythe | `necromancy:spectral-scythe` | `spectral_scythe` | **yes** | Multi main damage + manual. Cast 1 in map; cast 2/3 exist as `spectral_scythe_2` / `_3` **without** record-id maps. |
| Soul Strike | `necromancy:soul-strike` | `soul_strike` | **yes** | Multi (<10k + high-cost conjure bar). Primary-target model; splash unmodelled. |
| Necromancy (ability) | `necromancy:necromancy` | `necromancy_basic` | **yes** | Multi + manual auto (`name`: `"Necromancy"`). |
| Split Soul | **missing** | — | **no** | **manual** endgame keybind. No `abilities.json` record, no map, no AbilitySpec. **GAP.** |
| Command Vengeful Ghost | **missing** | — | **no** | **manual** keybind. Effects-only (`command_vengeful_ghost` — Haunted, no damage band). No record id. **GAP for bar modelling** (buff-only is intentional for damage engine). |
| Command Skeleton Warrior | `necromancy:command-skeleton-warrior` | `command_skeleton_warrior` | **yes** | **manual** keybind. Engine burst modelled; rage scale is effects note. |
| Command Putrid Zombie | `necromancy:command-putrid-zombie` | `command_putrid_zombie` | **yes** | Not on BiS ST bar; command exists in engine. |
| Command Phantom Guardian | `necromancy:command-phantom-guardian` | `command_phantom_guardian` | **yes** | Base 0 Valour band; stack scale via helper. |

---

## 5. Shared / auto-attacks (cross-style)

| ability name | record id | engine map | engine spec? | notes |
|--------------|-----------|------------|--------------|-------|
| Sacrifice | `shared:sacrifice` | **—** | **no** | On ranged ST, necro ST, melee multi. **Record-only** path (70% fixed). Works for Revo sim via adapter; no style-native engine spec. |
| Attack | `melee:attack` | `attack` | **yes** | Manual melee. |
| Ranged ability | `ranged:attack` | `ranged_attack` | **yes** | Manual ranged. |
| Magic ability | `magic:magic-attack` | `magic_attack` | **yes** | Manual magic. |
| Necromancy ability | `necromancy:necromancy` | `necromancy_basic` | **yes** | Manual + multi necro. |

---

## 6. Gaps that leave bar slots unmodelled

These fail `resolveBarSlot` → `modelledBy: "unmodelled"` (or cannot be stored as bar slots with an `abilityId`).

| Gap | Appears on | Severity | Why unmodelled |
|-----|------------|----------|----------------|
| **Conjure Undead Army** | ST necro Revo++ (slot 1), multi high-cost, manual | **Critical for necro ST** | `abilityId: null`; no record; no AbilitySpec (summon setup, not damage cast). |
| **Conjure Vengeful Ghost** | ST necro, multi, lvl | **Critical** | same |
| **Conjure Skeleton Warrior** | ST necro, multi, lvl | **Critical** | same |
| **Conjure Putrid Zombie** | multi high-cost, lvl | **High** (multi) | no record / no AbilitySpec |
| **Conjure Phantom Guardian** | wiki optional | Medium | same |
| **Split Soul** | manual endgame necro | **High for manual bar** | no record, no map, no AbilitySpec (incantation-style buff) |
| **Command Vengeful Ghost** | manual endgame necro | Medium | no record; effects-only (no damage band) — bar cannot resolve to a castable damage spec |
| Wiki **multi-target bars** as whole records | all styles | Product/data | Only ST BiS bars live in `revolution-bars.json`; multi bars not expanded there (abilities themselves mostly OK for magic/melee) |
| **Sacrifice** engine gap | ranged ST, necro ST, melee multi | Low–medium | Still **record-modelled** (not unmodelled) if `shared:sacrifice` is set; missing engine parity / shared AbilitySpec only |

### Near-gaps (modelled but incomplete for true multi/rotation)

| Item | Status |
|------|--------|
| Blood Siphon multi channel | Engine solo finisher only |
| Spectral Scythe multi-cast ladder | Cast 1 mapped; 2/3 need separate ids / state |
| Soul Strike splash | Primary only |
| Death Skulls bounce | Single-target 3-hit model |
| Volley of Souls | Requires soul-count factory at resolve time |
| Living Death / Sunshine / Death's Swiftness | Engine buff specs; zero direct damage hits |
| Adaptive Strike | Needs bar `setup` (DW vs 2H); no single engine id on the record map |

---

## 7. Coverage summary (unique wiki BiS + multi + manual + repl names)

| Bucket | Count | Full engine path (map + AbilitySpec) | Record-only | Unmodelled / missing record |
|--------|------:|--------------------------------------:|------------:|----------------------------:|
| Melee (incl. Punish, Attack, Fury, Sacrifice) | 15 | 14 | 1 (Sacrifice) | 0 |
| Ranged (incl. Ranged auto, replacements) | 13 | 12 | 1 (Sacrifice) | 0 |
| Magic (incl. multi-only + Magic auto) | 17 | 17 | 0 | 0 |
| Necromancy (incl. conjures, commands, Split Soul) | 22 | 13* | 1 (Sacrifice) | **8** (5 conjures + Split Soul + Command VG; Conjure Phantom optional) |

\*Volley counted as engine via factory; Command Skeleton counted yes; Command VG no.

### Canonical ST Revo++ bars in `revolution-bars.json`

| Bar id | Slots | Unmodelled slots |
|--------|------:|------------------|
| `melee-dual-wield` | 10 | 0 |
| `melee-two-handed` | 10 | 0 |
| `ranged` | 10 | 0 (Sacrifice = record) |
| `magic` | 10 | 0 |
| `necromancy` | 11 | **3** Conjure* with `abilityId: null` (Undead Army, Vengeful Ghost, Skeleton Warrior) |

Necro ST is the only shipped bar with hard unmodelled slots today.

---

## 8. Recommended fill order (for later work — not done in this audit)

1. Decide product model for **Conjures**: records with zero damage + state machine vs keep null and skip in Revo sim (document skip).  
2. Add **Split Soul** record (and engine buff-only spec if rotation cares about the debuff).  
3. Optionally map **Sacrifice** → shared engine AbilitySpec for parity (today record adapter is enough for sim).  
4. Expand `revolution-bars.json` with wiki **multi** bars once conjure/Sacrifice policy is fixed (magic multi is already fully engine-covered).  
5. Wire **Spectral Scythe** cast 2/3 and **Command Vengeful Ghost** into bar resolution if manual/endgame bars become first-class.

---

*Generated by read-only coverage audit. Did not edit `src/` or `data/combat/revolution-bars.json`.*
