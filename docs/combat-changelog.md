# Combat mechanics changelog — RuneScape 3, pre-Mar 2024 → 24 Jul 2026

Internal technical reference for the combat engine. Covers every officially documented change to
combat *mechanics* from the pre-March-2024 model to the current date. Content additions (bosses,
quests) are only noted when they introduced player-facing mechanics, abilities, or gear with new
mechanics. Pure drop-rate, XP, and cosmetic changes are omitted.

**Status date:** 26 Jul 2026. Update this file when new combat patches land — do not treat
2 Mar 2026 as the final state.

## Conventions and sourcing

- Dates are game-update dates. One game tick = 0.6 s. "AD" = ability damage. Percentages are
  ability damage unless stated otherwise. "AVG" = average of a damage range as published by Jagex.
- Primary sources are `runescape.wiki` `Update:` pages, which are verbatim mirrors of the official
  Jagex news posts on `secure.runescape.com` (the wiki pages link the originals). Where an official
  URL was independently confirmed it is listed too. Supporting mechanics pages (Hit chance, Ability
  damage, Critical strike, Adrenaline, Combat Style Modernisation) are cited with their oldid or
  with the date they were fetched.
- The RS Analysis paper ([rs-analysis.xyz/pdf/2024.001.pdf](https://rs-analysis.xyz/pdf/2024.001.pdf),
  dated 5 Jan 2024) documents the pre-2024/2024 state experimentally; used as context only.
- Anything that could not be verified is marked **UNVERIFIED** here and collected in §10. No date,
  number, or mechanic in this file is guessed.

## Anchor facts from AGENTS.md — verification result

| Spec claim | Result | Source |
|---|---|---|
| Post-Mar-2024 accuracy scales damage instead of binary hit/miss (70% accuracy → full connect, 70% damage) | **Verified** (system named "damage potential"; 70% hit chance → every hit deals 70% damage) | [Update:RuneScape – Combat Update](https://runescape.wiki/w/Update:RuneScape_-_Combat_Update), 4 Mar 2024 |
| Base crit damage reaches +50% at level 90 post-Mar-2024 | **Verified** (base crit damage 10% at lvl 1, +5% per 10 levels, 50% at 90; base crit chance separately 10%) | [Update:Combat Update & Thok's Smashing Buffs](https://runescape.wiki/w/Update:Combat_Update_%26_Thok%27s_Smashing_Buffs-_This_Week_In_RuneScape), 4 Mar 2024; [Critical strike](https://runescape.wiki/w/Critical_strike), fetched 24 Jul 2026 |
| 2026 DPL = `145 × 2.5 × ln(1 + 0.6×level/145) / ln(1.6)` | **Verified** (verbatim in the official patch notes; introduced in beta 6 Feb 2026, live 2 Mar 2026) | [Update:Patch Notes: Part 1 – Combat Style Modernisation](https://runescape.wiki/w/Update:Patch_Notes:_Part_1_-_Combat_Style_Modernisation), 2 Mar 2026 |
| Ordinary basics generate 9% adrenaline (was 8%) | **Verified** (all styles incl. Defence/Constitution; parity with Necromancy) | Same, 2 Mar 2026 |
| Fundamental attack timing standardized to ~3 ticks | **Verified, stronger:** exactly 3 ticks (1.8 s) for *all* weapons of all styles; weapon speed removed from tooltips | [Combat Style Modernisation](https://runescape.wiki/w/Combat_Style_Modernisation), 2 Mar 2026 |
| 9 Mar 2026 equipment damage-bonus realignment to tier | **Verified** (armour bonuses trimmed, esp. T92+; jewellery/pocket/cape bonuses raised; applied to necromancy and hybrid gear) | [Update:Combat Style Refinements & March Marketplace Drop](https://runescape.wiki/w/Update:Combat_Style_Refinements_%26_March_Marketplace_Drop), 9 Mar 2026 |

---

## 1. Pre-March-2024 baseline

State of the game immediately before the 4 Mar 2024 update. Necromancy had launched on
7 Aug 2023 and already used the "modern" patterns the other styles were later migrated to.

### 1.1 Accuracy — binary hit/miss (Melee/Ranged/Magic)

- Hit chance was a **binary roll**: each attack either connected for its rolled damage or missed
  entirely ("splashing" for magic).
  ([Hit chance, rev. 28 Oct 2023](https://runescape.wiki/w/Hit_chance?oldid=36224270))
- Formula: `hit chance = affinity × (accuracy / target armour) + additive modifiers`, capped at
  100%. Player accuracy `= f(skill level) + 2.5·f(weapon tier)` with
  `f(x) = x³/1250 + 4x + 40`; target armour `= armour stat + f(Defence level)`.
  (Same source.)
- A **minimum 25% hit chance** was required to damage an NPC at all; below that, every attack
  missed. (Minimum 25% → 1% noted in the 4 Mar 2024 patch notes,
  [Update:RuneScape – Combat Update](https://runescape.wiki/w/Update:RuneScape_-_Combat_Update).)
- Offensive ultimates and special attacks carried **hidden additive hit-chance buffs** (e.g. +25%
  for offensive ultimates). (Hit chance, rev. 28 Oct 2023; removal noted in the 4 Mar 2024 patch
  notes.)
- **Necromancy exception:** from launch (7 Aug 2023) necromancy already scaled damage by hit
  chance between 25% and 100% instead of rolling binary misses; below 25% it still missed.
  (Hit chance, rev. 28 Oct 2023; RS Analysis paper §2.2/§6, 5 Jan 2024.)

### 1.2 Ability damage — linear 2.5 × level

([Ability damage, rev. 30 Dec 2023](https://runescape.wiki/w/Ability_damage?oldid=36266864))

- Main-hand: `⌊2.5 × level⌋ + ⌊9.6 × tier + style bonus⌋`. Off-hand: half of the main-hand
  formula, floored. Dual-wield total = MH + OH (a sum, not an average).
- Two-handed: melee/ranged added `⌊4.8 × tier + 0.5 × bonus⌋` to the MH formula; magic used
  `⌊2.5L⌋ + ⌊1.25L⌋ + ⌊14.4 × tier + 1.5 × bonus⌋`.
- Magic weapon term capped by spell tier; ranged capped by ammo tier.
- The level term was exactly **2.5 × level** — linear, no taper.
- Temporarily boosted levels granted extra damage ("damage per level", +4 per boosted level split
  across fixed/variable rolls; not for necromancy). (Same revision; RS Analysis §4.2.1.)

### 1.3 Critical strikes — natural/forced, no crit-damage stat

([Critical strike, rev. 12 Dec 2023](https://runescape.wiki/w/Critical_strike?oldid=36257122))

- Two kinds: **natural** crits (any damage roll landing ≥ 95% of the attack's maximum) and
  **forced** crits (effects like Biting, Erethdor's grimoire, Kal'gerion familiar, Fury,
  Concentrated Blast forcing the roll into 95–100% of max; 66–100% in PvP).
- No universal base crit chance for the triangle styles; natural crit probability was an artefact
  of each ability's damage range (worked example ≈ 7.2%). No separate "critical strike damage"
  stat — a crit simply meant a near-max roll.
- **Necromancy** differed: 10% base (forced) crit chance, no natural crits, and a crit-damage
  modifier scaling with Necromancy level up to **+75% at level 120**.
  (Same revision; RS Analysis §6. When necromancy was moved onto the shared 50%-at-90 table used
  today is **UNVERIFIED** — see §10.)
- Meteor Strike / Incendiary Shot / Tsunami: for 30 s after use, each crit generated 10%
  adrenaline.
- Bleeds could never crit; channelled hits under Greater Barge could. (Same in both revisions.)

### 1.4 Adrenaline and ability categories

([Adrenaline, rev. 10 Jan 2024](https://runescape.wiki/w/Adrenaline?oldid=36273287))

- Categories: **Basic / Threshold / Ultimate**. Basics generated **+8%**. Thresholds required ≥ 50%
  adrenaline and drained **15%**. Ultimates required and drained 100% (exceptions: Tsunami to 40%
  via Incite Fear; Deadshot/Omnipower/Overpower to 60% via igneous capes; Ultimatums perk).
- Auto-attacks generated adrenaline: MH +2%, OH +1%, 2H +3% (magic 2H always +2%; ranged 2H
  alternated +2/+3); only on damaging hits.
- Out of combat: −5% per 2 ticks after 10 s. Eating food: −10%. Special attacks cost weapon-specific
  adrenaline (ring of vigour reduced cost by 10%).

### 1.5 Weapon speeds and auto-attacks

- Weapon speed classes: fastest 4 ticks (2.4 s), fast 5 ticks (3.0 s), average 6 ticks (3.6 s);
  12-tick dark bow as outlier. ([Attack rate](https://runescape.wiki/w/Attack_rate), historical
  table, fetched 24 Jul 2026.)
- Auto-attacks existed as separate swings between abilities (no GCD), with a 0–100% damage range
  before the 2024 update. (RS Analysis §5; 4 Mar 2024 patch notes.)
- Whether weapon damage values were normalized against speed (slower weapons hitting harder per
  swing) is **UNVERIFIED** from the fetched pages — speeds and the auto-attack formula are
  documented, the normalization is never stated explicitly.

### 1.6 Hit caps

- General damage cap **10,000** per hit; crits capped at 12,000 (15,000 with Erethdor's grimoire);
  Shatter/Onslaught crits 30,000; Tuska's Wrath 15,000; Icy Tempest raised its cap 30%.
  (Critical strike, rev. 12 Dec 2023; 10,000 cap confirmed by the 4 Mar 2024 patch notes.)

### 1.7 Affinities

- Default monster affinities: 90 specific weakness / 65 weak style / 55 neutral (necromancy always
  used this "neutral/same" value) / 45 strong style; some bosses hard-coded lower.
  (Hit chance, rev. 28 Oct 2023; [Affinity](https://runescape.wiki/w/Affinity), fetched 24 Jul
  2026 — note this page still shows the old defaults, see §10.)
- Affinity debuffs stacked additively to +10 max (Quake +2, Statius's warhammer +5, dragon hatchet
  +3, barrelchest anchor +4, bone dagger +2, Bandos book +3). (Same sources.)

### 1.8 Necromancy resources (as launched 7 Aug 2023)

- **Necrosis** ([page](https://runescape.wiki/w/Necrosis), fetched 24 Jul 2026): max 12 stacks.
  Touch of Death +4; necromancy auto-attack under Living Death +2; occultist's ring 10% chance +2.
  Consumed by Finger of Death (−10% adrenaline cost per stack, up to 6 stacks) and Death Grasp
  special (+40% damage per stack, consumes all).
- **Residual Soul** ([page](https://runescape.wiki/w/Residual_Soul), fetched 24 Jul 2026): cap 3
  (+2 with soulbound lantern). Generated by Soul Sap (per target hit), Spectral Scythe (25% per
  target), later Zorgoth's soul ring (5% per necromancy hit, 22 Apr 2024) and Devourer's Guard's
  Soul Reave (4 stacks → next basic generates 1). Consumed by Soul Strike (1 at a time, AoE stun),
  Volley of Souls (all stacks, 135–165% each), Soul Crush special. Decay after 6 s out of combat.
- **Conjures** (Skeleton Warrior, Vengeful Ghost, Putrid Zombie; Phantom Guardian added
  2 Sep 2024): summoned spirits with Command abilities; conjured spirits cannot crit.
  ([Critical strike](https://runescape.wiki/w/Critical_strike), fetched 24 Jul 2026.)

---

## 2. 4 Mar 2024 — Core Combat Update

Sources: [Update:Combat Update & Thok's Smashing Buffs – TWIR](https://runescape.wiki/w/Update:Combat_Update_%26_Thok%27s_Smashing_Buffs-_This_Week_In_RuneScape)
(4 Mar 2024) and the detailed post [Update:RuneScape – Combat Update](https://runescape.wiki/w/Update:RuneScape_-_Combat_Update)
(published 1 Mar 2024, live 4 Mar). Beta-tested from Nov 2023. Follow-up fixes:
[Update:March Patch Week](https://runescape.wiki/w/Update:March_Patch_Week_-_This_Week_In_RuneScape) (11 Mar 2024).

### Accuracy → Damage Potential

- Binary hit/miss removed for Melee/Ranged/Magic vs NPCs. Hit chance now scales damage: **70% hit
  chance → every attack connects for 70% damage.** Jagex framed it as "accuracy impacts damage
  rather than chance to hit, removing splashing". The wiki documents the system under the name
  **damage potential**. (Both update pages, 4 Mar 2024; [Hit chance](https://runescape.wiki/w/Hit_chance),
  fetched 24 Jul 2026.)
- Minimum hit chance to damage an NPC reduced **25% → 1%**; below 1% all attacks miss. Hit chance
  above 100% is capped — no benefit beyond 100%. (Patch notes; current Hit chance page.)
- **PvP keeps the binary model** (full damage or zero). (Current Hit chance page.)
- Hidden ultimate/special-attack hit-chance buffs removed. (Patch notes.)
- Many damage sources bypass hit chance entirely (Crackling, Aftershock, poison, conjured spirits,
  Split Soul, Sunshine/ZGS ground damage, blood reaver). (Current Hit chance page.)
- No documented minimum-damage floor beyond the 1% cutoff (**UNVERIFIED**).

### Critical strikes modernised (Melee/Ranged/Magic)

- New model: **base crit chance 10%**; crits multiply the rolled hit by a crit-damage bonus that
  starts at **+10% at level 1** and rises **+5% per 10 levels to +50% at level 90** (melee uses
  Strength). Example given: 2,000 → 3,000 at level 90. (Both update pages;
  [Critical strike, rev. 4 Mar 2024](https://runescape.wiki/w/Critical_strike?oldid=36315288).)
- Guaranteed-crit abilities (Shadow Tendrils, Smoke Tendrils) rebalanced to account for the new
  base crit chance. Crit-adrenaline of Meteor Strike / Incendiary Shot / Tsunami reduced
  **10% → 8%** per crit. (Patch notes.)
- Combat dummies' "max hit" mode now guarantees crits. (Patch notes.)

### Damage cap

- **10,000 → 30,000** per hit. Item effects that raised or interacted with the old cap were
  removed or replaced. Wiki trivia attributes the 30,000 ceiling to an engine hitsplat limit
  (Mod Sponge). (Patch notes; Critical strike, rev. 4 Mar 2024.)

### Ability damage and rolls

- Core formulas (§1.2) unchanged; the **boosted-level damage-per-level** bonus was removed and
  ability damage ranges rebalanced upward to compensate — ranges narrowed at equal or higher
  average (e.g. Sacrifice 20–100% → ~55–65%). Published average increases include Slice 95→105%,
  Assault 525.6→560%, Rapid Fire 451.2→560%, Asphyxiate 451.2→480%, Magma Tempest 96→220%.
  (Patch notes; Ability damage, rev. 4 Mar 2024, differs from the Dec 2023 revision only by the
  removed DPL paragraph.)
- Linked damage rolls removed (Snapshot, Greater Ricochet, Snipe + nightmare gauntlets); bleeds
  (Dismember, Fragmentation Shot, Combust) lost their skewed roll-max behaviour. (Patch notes;
  RS Analysis §7.10 for the old behaviour.)

### Adrenaline / abilities

- Core economy unchanged (basics +8%, thresholds −15%, ultimates 100%) — not mentioned in either
  update page.
- Surge, Dive, Escape: no longer generate adrenaline, castable during GCD, reclassified from
  'Basic Abilities' to 'Abilities'. (Patch notes.)
- Mobile perk / Shadow's Grace no longer halve Barge/Greater Barge/Bladed Dive adrenaline;
  Vestments of havoc adrenaline bonus made melee-only. (Patch notes.)
- ~50 special attacks re-costed/re-ranged (e.g. Zuriel's staff 100→50%, hand cannon 50→35%).
  Leng swords fully reworked (Primordial Ice, Icy Tempest). Ruby bolts redesigned (20%-of-HP proc
  → +25–125% AD). (Patch notes.)
- Fury/Greater Fury reworked: Fury single hit, +25% crit chance to the next melee ability,
  cooldown 5.4→15 s; Greater Fury makes the next melee ability within 15 s a guaranteed crit.
  Sever cooldown 15→5 s. (Patch notes.)
- Berserk: additive → multiplicative. Metamorphosis 62→66% (PvP 31→33%). Dragon battleaxe spec
  additive → multiplicative. (Patch notes.)
- Equilibrium **aura** redesigned: +12% ability damage but the player cannot crit. The Equilibrium
  **perk** became +0.5% AD per rank and was renamed **Eruptive**. (Patch notes. Note: the perk
  name "Equilibrium" was reused for a new perk on 9 Mar 2026 — see §6.)
- Channelled abilities: dedicated channel bar, casting out of range runs into range, melee
  channels allow movement in range. (Patch notes.)
- New "PvP Damage Effectiveness" scaling per ability (e.g. Volley of Souls 55%, Death Grasp 40%).
  (Patch notes.)
- ~35 quest bosses with abnormally low base hit chances raised to the standard values (HP buffed
  to compensate). (Patch notes.)

### Style-specific

- **Necromancy was the template, not a target**: only PvP-effectiveness values, moonstone economy,
  and minor fixes. No changes to Necrosis, Residual Souls, or conjures. (Both update pages.)
- Weapon speeds untouched. Auto-attack damage range changed **0–100% → 20–100%**. (Patch notes.)
- 11 Mar 2024 follow-ups: legacy-mode auto/special attacks were far too strong (hotfixed);
  Instability spec cooldown exploit fixed; Metamorphosis was reducing PvP damage (fixed);
  Corruption Blast spreading fix. ([March Patch Week](https://runescape.wiki/w/Update:March_Patch_Week_-_This_Week_In_RuneScape), 11 Mar 2024.)

---

## 3. 2024–2025 patches (11 Mar 2024 – Nov 2025)

Chronological; only mechanical changes. Sources are the wiki `Update:` pages linked per entry.
Over this whole window the combat skills stayed capped at 99 and the ability-damage level term
stayed linear — the [Ability damage](https://runescape.wiki/w/Ability_damage) history shows no DPL
change between Oct 2016 and 2 Mar 2026.

**2024**

- 25 Mar — Cannibal fruit corrected to boost accuracy, not magic damage; Eldritch crossbow's Split
  Soul no longer lets the next auto-attack bypass range limits; Shadow Tendrils made to work with
  hexhunter bow + Wen arrows. ([Cookbook And Progression Wrapup](https://runescape.wiki/w/Update:Cookbook_And_Progression_Wrapup_Update_-_This_Week_In_RuneScape))
- 2 Apr — Cerberus Juvenile's distance damage-reduction retuned for the damage-potential system
  (flat 500 per tile of distance from 500, was 500 + 500/tile). ([Easter Patch Week](https://runescape.wiki/w/Update:Easter_Patch_Week_-_This_Week_In_RuneScape))
- 22 Apr — **Zorgoth's soul ring** (Requiem for a Dragon): Soul Spring passive — necromancy hits
  have a 5% chance to generate 1 Residual Soul. ([Update](https://runescape.wiki/w/Update:Requiem_For_a_Dragon_Launch_-_This_Week_In_RuneScape); [ring page](https://runescape.wiki/w/Zorgoth%27s_soul_ring))
- 29 Apr — Kalphite King affinity fix (ranged form had been incorrectly weaker to ranged than
  melee). ([April Patch Week](https://runescape.wiki/w/Update:April_Patch_Week_-_This_Week_In_RuneScape))
- 28 May — Zorgoth's soul ring: consumption abilities (Soul Strike, Volley of Souls) can trigger
  Soul Spring even at max Residual Souls. ([Osseous Launch](https://runescape.wiki/w/Update:Osseous_Launch_-_This_Week_In_RuneScape))
- 30 May — T95 magic dual-wield beta (three candidate set effects trialled; Magma Tempest, Sonic
  Wave, Concentrated Blast temporarily dual-wieldable). ([T95 Magic Dual Wield Beta](https://runescape.wiki/w/Update:T95_Magic_Dual_Wield_Beta))
- 22 Jul — **Sanctum of Rebirth**: Roar of Awakening + Ode to Deceit (T95 magic dual wield) with
  *Song of Destruction* — DoT abilities build up to 100 Essence Corruption stacks (30 s); 1+
  stacks: 30% chance for DoTs to deal all hits instantly and remove their cooldown; 10+: bonus
  magic damage (stacks×3 + Magic level); 25+: basics generate +1% adrenaline per tick for 3.6 s;
  set(2): DoTs +30%. New special **Soulfire** (35% adrenaline, 45 s CD; 130–160% hit plus six
  170–200% burn hits; grants Conflagrate). Also Scripture of Amascut (Contagion DoT godbook) and
  the Divine Rage prayer. ([Update](https://runescape.wiki/w/Update:Sanctum_of_Rebirth_:_New_Boss_Dungeon); [Soulfire](https://runescape.wiki/w/Soulfire); [Song of Destruction](https://runescape.wiki/w/Template:Song_of_Destruction))
- 29 Jul — Sanctum bosses: an accuracy miscalculation introduced the previous week was corrected.
  Soulfire PvP effectiveness 50→30%. ([Summer Double XP](https://runescape.wiki/w/Update:Summer_Double_XP_-_This_Week_In_RuneScape))
- 5 Aug — Scripture of Amascut's DoT now uses the correct style's damage. ([Summer Sanctum Patch Week](https://runescape.wiki/w/Update:Summer_Sanctum_Patch_Week_-_This_Week_In_RuneScape))
- 12 Aug — 110 Mining/Smithing: Primal armour (tank, T85→T90 at +5), Masterwork 2H sword (T100),
  Primal armour spikes; Abyssal armour spikes' secondary proc chance 25→100%. ([Update](https://runescape.wiki/w/Update:New_Skill_Levels:_110_Mining_%26_Smithing))
- 2 Sep — **Phantom Guardian**: defensive necromancy conjure; reduces core-type damage taken by up
  to 5% (capped); builds Valour stacks when you are attacked, spent by its Command ability.
  ([Update](https://runescape.wiki/w/Update:New_Necromancy_Conjure_-_This_Week_In_RuneScape))
- 23 Sep — **Eclipsed Soul** prayer (Gate of Elidinis): increases critical strike chance and heals
  over time on crit; requires 75 in the combat skills + Prayer. (Exact percentages not stated in
  the post — the current [Critical strike](https://runescape.wiki/w/Critical_strike) page lists
  +4% chance.) ([Update](https://runescape.wiki/w/Update:Gate_of_Elidinis_Launch_Week_-_This_Week_In_RuneScape))
- 7 Oct — Eclipsed Soul: heal refreshes per crit and survives prayer toggle-off. ([October Patch Week](https://runescape.wiki/w/Update:October_Patch_Week_-_This_Week_In_RuneScape))
- 4 Nov — Spectral Lens (Slayer-helm component adding necromancy benefits). ([Update](https://runescape.wiki/w/Update:New_Slayer_Mobs_%26_Premier_Refresh_-_This_Week_In_RuneScape))
- 25 Nov — Blood Reaver nerf: scrolls cost 12 Summoning points with a 3 s cooldown; passive no
  longer procs player on-hit effects. **Tank armour reworked to grant life-point bonuses** like
  necromancy tank gear. ([November PostJam Patch Week](https://runescape.wiki/w/Update:November_PostJam_Patch_Week_-_This_Week_In_RuneScape))
- 9 Dec — 110 Woodcutting/Fletching: Eternal magic shortbow and Primal crossbow (T85→T90 via
  upgrade), Masterwork bow (T100, launched with no passive/special — effect deferred);
  **Elder god arrows converted from level 95 to 100** with damage capped at 100 so T100 bows fully
  benefit. ([Blog](https://runescape.wiki/w/Update:110_Woodcutting_%26_Fletching_(%26_Firemaking)_-_New_Skilling_Update); [launch](https://runescape.wiki/w/Update:110_Woodcutting_and_Fletching_Launching_Today!_-_This_Week_In_RuneScape))

**2025**

- 13/17 Feb — Combat Mastery Achievements: War's Blessing tier 4 raises Adrenaline Crystal gain to
  100% per action; War's Grimoire (spellbook/prayer swap). **Wen arrows nerf: Icy Precision 3% → 2%
  damage and hit chance per stack against threshold/ultimate/special attacks.** ([Announcement](https://runescape.wiki/w/Update:Combat_Mastery_Achievements); [launch TWIR](https://runescape.wiki/w/Update:Combat_Mastery_Achievements_%26_DXP_-_This_Week_In_RuneScape))
- 24 Feb — Protect from Summoning is deactivated when Eclipsed Soul is activated. ([February Patches & DXP](https://runescape.wiki/w/Update:February_Patches_%26_DXP_-_This_Week_In_RuneScape))
- 3 Mar — 110 Runecrafting: Eternal magic wand/orb/staff (inert → Meagre T85 → Saturated T90),
  Masterwork staff (T100). ([Blog](https://runescape.wiki/w/Update:110_Runecrafting_-_New_Skilling_Update))
- 17 Mar — Crumble Undead base damage reduced to intended levels. ([Shifting Sands & March Patches](https://runescape.wiki/w/Update:Shifting_Sands_%26_March_Patches_-_This_Week_In_RuneScape))
- 27 May — **Ek-ZekKil rework**: Igneous Cleave spec replaced by **Igneous Showdown** (65%
  adrenaline, 60 s CD): marks a Flamebound Rival (+5% damage dealt to / −5% taken from them);
  new passive **Ashen Vow** — Pulverise cost 100→60%, Quake affinity debuff 2→4, Lesser Smash
  95–115→150–170%, Smash 100–120→160–180%. **Fractured Staff of Armadyl gains Surging Storm:
  +15–30% critical strike damage.** **Tectonic +1% crit chance per piece; elite tectonic +2% per
  piece.** Masterwork sword/bow/staff gain Masterworked Mending (heal 2% of damage dealt).
  ([Update](https://runescape.wiki/w/Update:Masterwork_%26_Legendary_Weapon_Improvements); [TWIR](https://runescape.wiki/w/Update:Weapon_Improvements_%26_Necromancy_Soundtrack_-_This_Week_In_RuneScape))
- 2 Jun — EZK follow-up: Igneous Showdown cost 65→50%; Ashen Vow rival bonus ±5→±12%; recasting on
  the same rival now deals 3 extra hits (avg 225% each) and refunds 15% adrenaline. ([June Patch Week](https://runescape.wiki/w/Update:June_Patch_Week_-_This_Week_In_RuneScape))
- 16 Jun — 110 Crafting: Starbloom armour (T85→T90 tank with LP); **Masterwork magic armour (T100
  power armour)**: magic damage + LP bonus + the trimmed-masterwork delay effect (each piece
  spreads 10% of incoming damage over 6 s). **Ring of Retribution**: +23 to all styles, reflects
  15% of damage taken, +12.5% damage to reflect sources. ([Blog](https://runescape.wiki/w/Update:110_Crafting_-_New_Skilling_Update); [launch](https://runescape.wiki/w/Update:110_Crafting_Launches_Today!_-_This_Week_In_RuneScape))
- 4 Aug — **Amascut**: Tumeken's resplendence (T95 magic power armour), Tumeken's Light (T95 2H
  halberd, increased reach/AoE), Devourer's Armguard (T95 MH necromancy armguard empowering
  soul-stealing), Devourer's Nexus (intensifies Vengeful Ghost); Shard of Genesis Essence returns
  for T95→T100 upgrades. ([Update](https://runescape.wiki/w/Update:New_Boss_Out_Now:_Amascut,_Goddess_of_Destruction))
- 18 Aug — Sacrifice, Devotion, Transfigure moved off the GWD1 drop table to a quest reward;
  Tuska's Wrath codex acquisition changed. (Unlock changes only, no mechanic changes.)
  ([Tuska Clean Up](https://runescape.wiki/w/Update:Tuska_Clean_Up_-_This_Week_In_RuneScape))
- 29 Sep — **Tumeken's rebalance**: Resplendence charge time 9→5.4 s; set(3) changed from
  boosting DoT damage inside Sunshine to **+1.5% crit chance per piece while inside Sunshine**;
  set(5) changed to grant **Embodiment of Light** after a full Asphyxiate channel: **+50% crit
  damage for 9 s** (was a single next-attack bonus). Tumeken's Light: Purifying Light buffs
  (Lesser 25–35→45–55%, 15→30 s; normal 35–45→65–75%), special range 1→2 tiles.
  ([Amascut Combat Masteries & QoL Runecrafting](https://runescape.wiki/w/Update:Amascut_Combat_Masteries_%26_QoL_Runecrafting_-_This_Week_In_RuneScape))
- 12 Nov — "A New Era" roadmap post announces a cross-style combat rework for 2026 (ability flow,
  adrenaline/threshold review, beta worlds) — the first official pointer to the modernisation.
  ([Update](https://runescape.wiki/w/Update:A_New_Era_For_RuneScape_Begins_January_19_2026))

---

## 4. Combat Styles Improvement betas (16 Dec 2025 – 18 Feb 2026)

Five beta posts; main page: [Combat Styles Improvement beta](https://runescape.wiki/w/Combat_Styles_Improvement_beta)
(ran 16 Dec 2025 → 2 Mar 2026, shipped as the Combat Style Modernisation). Necromancy served as
the design reference and was barely touched. Values below are **beta values** — for shipped
numbers see §5.

### 4.1 16 Dec 2025 — Ranged Beta (launch)

([Update:Combat Styles Improvements – Ranged Beta.](https://runescape.wiki/w/Update:Combat_Styles_Improvements_-_Ranged_Beta.))

- Ranged-only prototype (melee/magic mid-prototyping). Stated goals: remove the threshold ability
  type, raise the styles to 120, cut ability/keybind bloat, unify structure across styles.
- Core combat skills raised to 120 in the beta. Berserker, Maniacal, Reckless, Mahjarrat auras
  disabled.
- Fixed ability impact timings (necromancy-style), independent of weapon. New default **basic
  attack** on a 3-cycle GCD. Ranged basics generate **9% adrenaline** (live: 8%).
- All ranged attacks consume ammo; 20% break chance, unbroken ammo drops to the ground.
- Key kit changes: Snap Shot → no-cooldown spender (2×150–170%, 25% adrenaline); Snipe → 300–360%
  after 2.4 s, 60 s CD, no adrenaline gen; Piercing Shot (2×60–70%, −3 s Snipe CD per hit);
  Ricochet single-target multi-hit (AoE removed); "Splinter Shots" buff (+30% AD on-hit to all
  ranged attacks); Bombardment (300–330% + up to 9 targets, 45%); Rapid Fire (75–85%/hit every
  0.6 s, 20%); Deadshot loses its DoT (5×125–145%). Many abilities removed or hidden; **lesser
  abilities removed** outright.

### 4.2 30 Jan 2026 — Beta Update (Melee and Magic added)

([Update:Combat Styles Improvements – Beta Update](https://runescape.wiki/w/Update:Combat_Styles_Improvements_-_Beta_Update))

- Ranged: identity rebuilt around two self-buffs — **Imbue: Gales** (bonus on-hit damage) and
  **Imbue: Shadows** (adrenaline on-hit; replaces Incendiary Shot). Removals incl. Unload, Rout,
  Salt the Wound, Dazing Shot, Tight Bindings, Demoralise, Needle Strike. Ricochet reverted to
  AoE-first; hit count moved to the Greater codex; caroming disabled for it.
- Melee: removals incl. Decimate, Havoc, Smash, Slaughter, Destroy, Massacre, Cleave, Quake,
  Frenzy, Stomp and others. **Dismember becomes a 3-cast bleed line** (Dismember → Slaughter →
  Massacre recasts). **Sever → Adaptive Strike** (Decimate-like when dual-wielding, Cleave-like
  with 2H; higher adrenaline gen). **Strength ability book removed** — all melee abilities require
  Attack; Strength keeps gating weapons and feeds damage-per-level and crit damage. Pulverise's
  Ek-ZekKil effect made baseline.
- Magic: removals incl. Deep Impact, Metamorphosis, Horror, Shock, Wrack. **Runic Charge**
  replaces Wrack (no damage; empowers the next magic ability). Sonic Wave's Flow stacks become
  next-ability adrenaline-cost reductions. Concentrated Blast hit frequency unified to 0.6 s.
  Combust leaves the basic slot (long-duration burn). Dragon Breath gains bonus vs combusted
  targets. Chain's Greater effect folded into base.
- Global: basic stun at level 54 with a second charge at 70 (all four styles; necromancy later
  excluded — it keeps its soul-derived stun). Stalled abilities release on click/target-cycle.
  Solid food: Constitution scaling removed (flat heals), adrenaline cost 10→3%. Fastest/fast
  weapons get a 2 s GCD on the basic attack only (reverted in Update 3).

### 4.3 6 Feb 2026 — Beta Update 2

([Update:Combat Styles Improvements – Beta Update 2](https://runescape.wiki/w/Update:Combat_Styles_Improvements_-_Beta_Update_2))

- **Bloodlust introduced** (melee resource): stacks empower melee abilities; generated by the new
  Pressing Blow (later renamed Rend), by casting Berserk, and by Punish on sub-50% HP targets
  (latter two granting max stacks).
- Melee broad buffs (basic attack 115% AVG, Backhand 70→100, Adaptive Strike 145/150% 2H/DW,
  Punish 110, Assault 170%/hit, Pulverise 290 **and reclassed ultimate**, Chaos Roar 115);
  **Berserk nerfed ×2 → ×1.75 damage and ×1.5 → ×1.25 self-damage** to offset the new baseline
  power (Chaos Roar likewise ×2 → ×1.75). Meteor Strike becomes an ultimate (6% adrenaline per
  0.6 s, melee weapon required). Quake briefly re-enabled.
- Ranged: Imbue: Gales tuned (20.4 s CD, 6 s duration); Bombardment AoE 2 tiles; Corruption Shot
  tags instantly and no longer spreads.
- Magic: Detonate disabled; Magma Tempest buffed (25% adrenaline, 40% AVG/hit, 21 s CD);
  Concentrated Blast's crit bonus extended to the whole next "attack" (both Wild Magic hits);
  Runic-Charged Sonic Wave cost reduction 50→35% (Greater 60→45%); **Runic Charge no longer incurs
  a GCD**; Smoke Tendrils 0% adrenaline, self-damage 37.5% AD; Sanguine Charge costs HP instead of
  Blood Tithe stacks, no longer extends Combust.
- Global: stuns moved to level 31 (second charge 54). **Ultimates repriced: Overpower, Deadshot,
  Omnipower, and Death Skulls now cost 60% adrenaline** (the only explicit necromancy change in
  the whole beta). **The linear 2.5×level damage term is replaced by the logarithmic DPL curve**
  `145 × 2.5 × ln(1 + 0.6 × level/145) / ln(1.6)` — more early/mid power, identical at level 145;
  explicitly framed as compensation for aura removal alongside the 120 raise. Dual-wield basic
  attacks alternate hands (visual).

### 4.4 13 Feb 2026 — Beta Update 3

([Update:Combat Styles Improvements – Beta Update 3](https://runescape.wiki/w/Update:Combat_Styles_Improvements_-_Beta_Update_3); official post: [secure.runescape.com](https://secure.runescape.com/m=news/combat-styles-improvements---beta-update-3))

- **Launch moved from 23 Feb to 2 Mar 2026**; beta extended a week.
- **All basic attacks now fire every 3 cycles** — the 2-cycle fast-weapon GCD from 30 Jan was
  reverted; weapon speeds removed from tooltips.
- Melee: Bloodlust now comes from basic abilities; Pressing Blow renamed **Rend** (generates 2
  stacks). Punish and Chaos Roar become basics. Meteor Strike: 60% cost, 4.5% adrenaline per
  0.6 s. **Berserk: max Bloodlust +4 (total 8), generates 4 stacks on cast, basics give double
  stacks, reduces Overpower's cooldown to 9 s.** Dismember recasts formally named Slaughter/
  Massacre. Quake re-removed.
- Magic: Combust returns to basic (10×27–33%, every 1.8 s); Song of Destruction rebalanced (25→10
  bonus-damage stacks at 100→300% value; adrenaline stacks 50→25 at 0.5→1% per cycle); Exsanguinate
  stacks now buff basic-ability damage; Corruption Blast 20% adrenaline, 300% AVG; Chain becomes a
  basic.
- Ranged: **Imbue: Gales renamed Galeshot**, its buff named **Searing Winds**; Imbue: Shadows'
  buff named **Shadow Imbued** (Shadow Tendrils extends it 3.6 s). Rapid Fire 25% adrenaline and
  channel no longer interrupted by movement. Corruption Shot 90–110% initial, 20% adrenaline.
- Perks: **Lunging** → +10% flat + 3%/rank for Dismember & Combust; **Energising** → +3% + 1%/rank
  hit chance; **Caroming** repurposed (Ricochet on-hit bonus; Chain copied-damage mitigation).

### 4.5 18 Feb 2026 — Beta Update 4 (final)

([Update:Combat Styles Improvements – Beta Update 4](https://runescape.wiki/w/Update:Combat_Styles_Improvements_-_Beta_Update_4))

- Final number polish (Adaptive Strike down to 130/135%, Rend up to 150%, Pulverise 320% AVG;
  Dismember-line heals 10% of damage dealt; Flurry's Bloodlust scaling moved to the target's
  missing HP, cap 65%).
- New item effects: **Blast Diffusion boots** (basics +8% basic ability damage after Wild Magic),
  **Fleeting boots** (Piercing Shot reduces Snipe CD a further 1.2 s/hit; basic attacks also apply
  the reduction), **Splintering arrows** (Puncture: stores 1% AD per stack, pays out 50% on first
  hit then over 4 hits; 250-stack cap).
- **Defence/Constitution basics 8% → 9% adrenaline** (the literal 8→9 change; the other styles
  were already at 9% in the beta).
- Aura disable list expanded to 15 (Berserker, Maniacal, Reckless, Brawler, Runic Accuracy,
  Sharpshooter, Dark Magic, Regeneration, Aegis, Mahjarrat, Inspiration, Equilibrium, Invigorate,
  Knockout, Ancestor Spirits). 120 skillcape perks added (Attack: +2% melee hit chance; Strength:
  Dismember-line heals +2%; Magic: hexes last 2×; Ranged: 10% ammo-save chance).
- Ultimatums perk reworked (+3% + 1%/rank ultimate damage); Energising changed to flat accuracy
  (50 + 25/rank); Flanking reverted to live behaviour.

---

## 5. 2 Mar 2026 — Combat Style Modernisation

Sources: [Combat Style Modernisation](https://runescape.wiki/w/Combat_Style_Modernisation) (main
page, includes per-patch annotations) — "[M]" below; official patch notes
[Part 1](https://runescape.wiki/w/Update:Patch_Notes:_Part_1_-_Combat_Style_Modernisation) ("P1")
and [Part 2](https://runescape.wiki/w/Update:Patch_Notes:_Part_2_-_Combat_Style_Modernisation)
("P2", official URL confirmed: [secure.runescape.com/m=news/patch-notes-part-2---combat-style-modernisation](https://secure.runescape.com/m=news/patch-notes-part-2---combat-style-modernisation));
[TWIR](https://runescape.wiki/w/Update:March%27s_Month_Ahead_%26_Combat_Style_Modernisation). No
Part 3 exists. All entries dated 2 Mar 2026 unless noted.

### 5.1 Damage Per Level — logarithmic curve

- The linear `2.5 × level` term in every ability-damage formula is replaced by
  **`DPL(level) = 145 × 2.5 × ln(1 + 0.6 × level/145) / ln(1.6)`** (natural log). 145 = max
  achievable level with boosts (120 + potions); 2.5 preserves the historical scaling factor.
  (P1, verbatim; M; [Ability damage](https://runescape.wiki/w/Ability_damage) history.)
- Intent: more power at early/mid levels, tapering at the top; identical total at level 145.
  Charted values (M): level 1: 3.1 (old 2.5) · 50: 145.0 (125) · 90: 244.1 (225) · 99: 264.8
  (247.5) · 120: 310.9 (300) · 145: 362.5 (362.5).
- Applies to **all four styles including necromancy**. Weapon-tier terms (9.6 MH / 14.4 magic 2H /
  halved OH) are unchanged; the magic spell-tier and ranged ammo-tier caps still apply. The
  current Ability damage page also caps the weapon-tier term by the wielder's level
  (`min(tier, level …)`) — the date this level cap was introduced is **UNVERIFIED** (§10).

### 5.2 Accuracy / Damage Potential / affinities

- The damage-potential model itself (§2) was **not** reworked: 1–100% hit chance scales damage
  proportionally, capped at 100%, PvP stays binary. ([Hit chance](https://runescape.wiki/w/Hit_chance), fetched 24 Jul 2026.)
- **Default NPC affinities raised: Weak 65 → 70, Same/neutral 55 → 60, Strong 45 → 50** (specific
  weakness stays 90). Necromancy uses the "Same" value (now 60). Worked example: air-weak hill
  giants become magic 70 / melee 60 / ranged 50. Bosses with custom affinities mostly untouched.
  (M; P2. The [Affinity](https://runescape.wiki/w/Affinity) page still shows the old defaults as of
  24 Jul 2026 — stale; see §10.)
- Selected boss defence/affinity normalisations: GWD1 normal-mode Defence 75→60; Helwyr,
  Gregorovic, Twin Furies, Vindicta affinities 40→60; TzTok-Jad 40→55; KBD to defaults; others.
  (M; P2.)
- Accuracy formula itself unchanged: `f(x) = x³/1250 + 4x + 40`; accuracy = f(level) + 2.5·f(tier).
  (Hit chance page.)

### 5.3 Critical strikes

- Base model unchanged from 4 Mar 2024: **10% base crit chance**, crit damage **+10% at level 1 →
  +50% at level 90** (+5%/10 levels, Strength for melee), PvP crit damage at 20% effectiveness.
  Neither M nor P1/P2 documents any change to these base values on 2 Mar 2026.
  ([Critical strike](https://runescape.wiki/w/Critical_strike), fetched 24 Jul 2026.)
- Changes around crits: **Meteor Strike reworked** — no more on-crit adrenaline; now an ultimate
  costing 60% that generates 4.5% adrenaline per 0.6 s for 50 ticks and makes basics generate 1.5×
  adrenaline. **Incendiary Shot removed.** Tsunami keeps its crit-adrenaline (8% per crit, 30 s).
  Concentrated Blast now grants stacking +5% crit chance per hit (Greater +7%) applying to the
  whole **next ability** (e.g. both Wild Magic hits). Deathspore arrows moved off crits (stack per
  hit instead). Guaranteed-crit sources kept: Shadow Tendrils, Smoke Tendrils channels, Greater
  Fury's next attack. (M; P1; P2; Critical strike page.)
- DoTs still cannot crit (Bloat's initial hit can); Greater Barge'd channelled hits can.
  (Critical strike page.)

### 5.4 Adrenaline

- **All basic abilities generate 9%** (was 8% for the three old styles), matching necromancy;
  rationale: 1.8 s GCD → 3% per cycle. Some basics generate more (Adaptive Strike +12%). (P1; M;
  [Adrenaline](https://runescape.wiki/w/Adrenaline).)
- Enhanced abilities cost 0–60% depending on ability; **ultimates cost 60–100% and no longer all
  require 100%**. Some Defence/Constitution abilities keep threshold semantics. (Adrenaline page
  update history; M.)
- Food adrenaline drain 10% → 3%; food no longer scales with Constitution level. (P2; M.)
- Classic Mode: adrenaline replaced by **Special Attack Energy** (10% every 30 s); basic-attack
  abilities do not generate it. (M.)

### 5.5 Ability categories

- **Threshold type removed for melee/ranged/magic**; spenders are usable as soon as their cost is
  payable. Some Defence/Constitution abilities remain thresholds. Non-basic/non-ultimate abilities
  split into **Enhanced** (usually cost adrenaline, don't generate it) and **Utility** (Surge,
  Runic Charge…). Ability books group Basic / Enhanced / Ultimate / Utility. All "lesser" abilities
  removed. (M; P1; P2.)
- Removed abilities (M's list; P2's official list is shorter — see §10):
  - Melee: Balanced Strike, Blood Tendrils, Cleave, Decimate, Destroy, Forceful Backhand, Kick,
    Sever, Slice, Stomp, Smash, Havoc, Quake, Frenzy (+ lessers). Slaughter & Massacre became
    Dismember recasts; Cleave & Decimate merged into Adaptive Strike.
  - Ranged: Tight Bindings, Dazing Shot, Greater Dazing Shot, Demoralise, Rout, Needle Strike,
    Fragmentation Shot, Salt the Wound (+ Punctured), Unload, Incendiary Shot (+ lessers).
  - Magic: Detonate, Wrack, Wrack and Ruin, Metamorphosis, Deep Impact, Shock, Horror (+ lessers).
  - All threshold-stuns and movement-stuns removed; basic stuns kept with a second charge
    (P1/P2 tables: level 54; M's tables say 70 — §10); knockback becomes a Scare Tactics toggle.

### 5.6 Weapon timing and basic attacks

- **All weapons of all styles unified to 3-tick (1.8 s) attack speed**; speed removed from
  tooltips; per-swing weapon-damage values not adjusted (overall damage balanced via the ability
  model). Fast/average/slow speed classes are gone from the live model. (M.)
- Auto-attacks replaced by **basic attack abilities** (Attack/Magic/Ranged, necromancy-style) on
  the GCD, auto-used when nothing else is queued (toggleable in full manual). **Melee basic:
  110–130%, +9% adrenaline, +1 Bloodlust** (deliberately stronger than other styles', offsetting
  melee's range/positioning costs). **Magic and ranged basics: 90–110%, +9%.** (M; P1.)
- Magic and ranged abilities use fixed impact timings (no weapon/distance variance); AoE centres
  on the NPC's centre + size. Magic basics use the selected spell's effects; hexes moved onto the
  GCD; off-hand spellcasting removed. (P1; P2.)
- Dual-wield vs 2H: same total ability damage; DW alternation is visual only. Ability availability
  differs by weapon (Hurricane 2H-only; Flurry/Pulverise DW-only; Adaptive Strike adapts). (M.)

### 5.7 Melee

- Identity: burst + bleeds, "on next attack"/"on kill" triggers, widest 2H/DW variance. Strength
  book removed — all abilities require Attack; Strength still feeds DPL, crit damage, and weapon
  unlocks. (M; P1.)
- **Bloodlust** ([page](https://runescape.wiki/w/Bloodlust), added 2 Mar 2026): melee basics
  generate 1 stack (Rend 2; Bladed Dive none); **cap 4, raised to 8 during Berserk** (which also
  grants 4 on cast and doubles generation). Spending 4 stacks empowers: Assault (145–175% →
  185–215% per hit at release), Hurricane (adds a 3rd hit, 75–95%, to target + up to 9 enemies),
  Flurry/Greater Flurry (+1% damage per 1% of the target's missing max LP, cap +65%). Stacks
  persist until consumed.
- Bleeds: Dismember chain — Dismember (0% adrenaline, 8×25–35% every 2 ticks), Slaughter recast at
  60 (−25%, 6×80–100% every 3 ticks), Massacre recast at 75 (−25%, 110–130% + 6×100% every 4
  ticks); all three stack; each heals a share of damage dealt (10% at release — changed 9 Mar,
  §6). (M; P1.)
- Other: Assault (25%, 6 s CD, first spender); Hurricane (CD −3 s per enemy hit); Flurry stuns,
  Greater Flurry extends Berserk; **Overpower (60%, 575% AVG at release)**; Pulverise (60%, on-kill
  +50% adrenaline); **Berserk ×1.75 damage / ×1.25 self-damage** plus Bloodlust effects and
  Overpower CD to 9 s; Chaos Roar ×1.75 next ability; Backhand 2 charges; Adaptive Strike +12%
  adrenaline; Rend 2 stacks. (M; P1.)
- Special attacks: effects mostly unchanged, damage numbers mostly raised (e.g. Armadyl godsword
  360–440% → 400–480%). Zaros godsword, noxious scythe, dragon battleaxe unchanged. (M; P1.)

### 5.8 Magic

- Identity: critical strikes + burns; scripts rewritten; fixed impact timings. (M; P2.)
- **Runic Charge** ([page](https://runescape.wiki/w/Runic_Charge), added 2 Mar 2026): level 26
  Utility, 0% adrenaline, no GCD, not Revolution-triggered, 30 s CD; applies Anima Charged (15 s).
  Empowers the next: Sonic Wave → next ability −35% cost (Greater −45%); Dragon Breath → 260–310%;
  Concentrated Blast/Greater → raised crit-chance grant per hit (CSM table says +20%; the current
  Critical strike page documents the empowered grant as 5→15% / 7→17% per hit — the value and
  date of the reduction are **UNVERIFIED**, §10).
- **Rune consumption: every magic ability can consume runes, 20% chance at release** (→15% on
  9 Mar, §6). One-time activation spells (Vulnerability, Smoke Cloud) and utilities unchanged.
  (M; P2.)
- Burns: Combust 10×27–33% every 3 ticks, no movement requirement; Dragon Breath +25% vs combusted
  targets; Corruption Blast now Enhanced (20%, 100% initial + decaying hits); Magma Tempest 20%,
  40%/hit. (M; P2.)
- Crit kit at release: Wild Magic (25%, 5.4 s CD, 140% AVG/hit, 2 hits — crit buffs added 30 Mar,
  §8); Asphyxiate (25% — Channelled Might added 30 Mar, §8); Smoke Tendrils (0%, guaranteed crits,
  escalating hits); Sonic Wave −10% next ability cost (Greater −20%); Tsunami crit-adrenaline kept.
  (M; P2.)
- No magic special attacks changed at release (FSoA nerfs land 9 Mar, §6). (M.)

### 5.9 Ranged

- Identity: many small hits + on-hit effects. (M; P1.)
- **Galeshot** (58, Basic, +9%): 90–110% plus **Searing Winds** (10 ticks): every ranged hit deals
  a bonus +20% AD hit; Rapid Fire extends Searing Winds by 1 tick per hit.
- **Imbue: Shadows** (90, Enhanced, −40%): **Shadow Imbued** (50 ticks): ranged hits on your target
  generate +5% adrenaline per hit; Shadow Tendrils extends by 6 ticks.
- **Ammunition: abilities require ammo; 20% destroyed per shot at release** (→15% 9 Mar, §6),
  unbroken ammo drops to the ground (auto-returned with Animal Magnetism — which had a 10% fail
  chance until 9 Mar). Consumption rolled per shot, not per hit; chinchompas still explode by
  design; previously always-consumed ammo now 85% conserved. Replaces Elder god arrows' old 33%
  consumption. Destroy chance reducible (ranged master cape, Blightbound crossbow…). (M; P1.)
- Kit: Snap Shot (25%, no CD, 290% AVG); Snipe (Enhanced, 330% AVG, 60 s CD, 1.8 s channel);
  Piercing Shot (−2.4 s Snipe CD per hit); Ricochet (old Greater effect baseline; Greater adds 4
  hits); Bombardment (25%, 2-tile AoE, no CD); Rapid Fire (25%, can move while channelling);
  Corruption Shot (20%, instant 5-target tag, no spreading); Deadshot (60%, 4×115%, no DoT — can
  now crit and benefit from Death's Swiftness); Shadow Tendrils (0%). Death's Swiftness requirement
  85 → 76 (reworked 16 Mar, §7). Only Decimation's Locate spec changed (9 targets/1 tile →
  5 targets/3 tiles). (M; P1.)

### 5.10 Necromancy

- "Only minor changes": **Death Skulls always costs 60%** (igneous cape no longer needed);
  **Living Death reduces Death Skulls' cooldown to 17 ticks** (from 20) enabling triple Death
  Skulls without aura/potion; the necromancy basic attack now counts as a basic ability for
  Impatient and Fury of the Small. Framed as compensation for aura removal. (M; P2.)
- No changes to Necrosis, Residual Souls, conjures, or Command abilities. Necromancy benefits from
  the new DPL curve and was already level 120. (M; P1.)

### 5.11 Levels to 120, auras, skillcape perks

- **Attack, Strength, Ranged, Magic max level 99 → 120** (necromancy already 120; stated goal was
  parity). Completionist grace period runs to 20 Nov 2026. (P1; M.)
- **15 combat auras disabled/unpurchasable**: Berserker, Reckless, Maniacal, Brawler, Runic
  Accuracy, Sharpshooter, Knock Out, Ancestor Spirits, Dark Magic, Regeneration, Aegis, Mahjarrat,
  Inspiration, Equilibrium, Invigorate. Vampyrism and Penance spared pending the Aura Overhaul
  (§9). Rationale: aura power folded into core kits via the 120 raise + DPL rebalance. (M; P2.)
- New 120 skillcape perks: Attack +2% melee hit chance; Strength Dismember-line heals +2% (M's
  master-cape row says +3% — §10); Magic hexes last 2× (not Entangle/Teleblock in PvP); Ranged 10%
  ammo-save chance. (P1; M.)

### 5.12 Perks and equipment (in the 2 Mar update itself)

- Perks: **Energising** → +50 accuracy, +25/rank; **Lunging** → Dismember & Combust +10% +3%/rank;
  **Caroming** → Greater Chain copied damage +5% +5%/rank and Ricochet on-hit damage +2.5%/rank
  (→4% 9 Mar); **Ultimatums** → all ultimates +3% +1%/rank. (P2; M.)
- Equipment: Ek-ZekKil passive removed (Pulverise 60% cost now baseline; Quake/Smash effects gone
  with the abilities); **Blast Diffusion boots** → +8% basic ability damage for 6 s after Wild
  Magic; Roar of Awakening & Ode to Deceit rebalanced (Song of Destruction 25→10 stacks at 100→300%
  value; adrenaline 50→25 stacks at 0.5→1%/cycle); igneous capes no longer reduce adrenaline costs;
  Asylum surgeon's ring → 10% chance to reduce ability cost by 15%; Fleeting boots → Piercing Shot
  −1.2 s extra Snipe CD and basics also apply it; Blightbound crossbow → 25% ammo save; chinchompa
  rework (ability damage to nearby enemies, one explosion each); Splintering/Deathspore/Wen/Bik
  arrows reworked (Wen arrows +25% damage/+25% accuracy at release — →30% 9 Mar); dark bow passive
  named Darkfang (basic attack = 2×45–55%); gloves of passage now trigger from Rend. (M; P2.)

### 5.13 Classic Mode

- Legacy Mode renamed **Classic Mode**: basic-attack abilities only, attacks always every 3 ticks
  at full ability damage (DW alternation visual), Special Attack Energy instead of adrenaline, old
  Legacy damage range/buff removed. (M; P1.)

---

## 6. 9 Mar 2026 — Combat Style Refinements (incl. equipment damage rebalance)

Source (read first-hand): [Update:Combat Style Refinements & March Marketplace Drop](https://runescape.wiki/w/Update:Combat_Style_Refinements_%26_March_Marketplace_Drop),
9 Mar 2026; cross-checked against the patch annotations on [M](https://runescape.wiki/w/Combat_Style_Modernisation).
First balance pass after the modernisation.

- **New Invention perk: Equilibrium** (weapon and armour gizmos): **+10% ability damage, +1% per
  rank (11% at r1, 14% at r4), but the player cannot critically strike** (no-crit lingers 30 s
  after unequipping). Uses new **Ecliptic components** (92 Invention research) from disassembling
  Sanctum of Rebirth weapons, Tumeken/Elidinis khopeshes, Devourer's Guard, Tumeken's resplendence,
  Tumeken's Light (×2). (Post, 9 Mar 2026. Distinct from the pre-2024 perk renamed "Eruptive" in
  §2; rescaled 30 Mar, §8.)
- **Melee nerfs** (overperforming in AFK revolution and top-end PvM; averages per the post, ranges
  per M's annotations): Assault 160 → 140% AVG (145–175 → 130–150); Bloodlust Assault 200 → 180
  (185–215 → 170–190); Overpower 575 → 545 (550–600 → 520–570); igneous-cape Overpower 340 → 310
  per hit; Dismember heal 10 → 4% of damage; Slaughter 100 → 90% per 1.8 s, heal 10 → 6%; Massacre
  120 → 100% per 2.4 s, heal 10 → 12%; Flurry/Greater Flurry 70 → 65% AVG per hit.
- **Magic nerfs** (top-end Runic Charge + Concentrated Blast combo): **Fractured Staff of Armadyl
  — Lightning Surge 100 → 80% AVG (range 90–110 → 70–90)** and **passive crit-damage bonus 22.5 →
  20% AVG (+15–30% → +15–25%)**. Tumeken's resplendence — 4-piece Asphyxiate hits 75 → 65% AVG;
  5-piece crit-damage bonus 50 → 35%. (Post, 9 Mar 2026; the 70–90 range and 15–25 passive are
  confirmed by the current [Critical strike](https://runescape.wiki/w/Critical_strike) page —
  M's annotation text differs slightly, §10.)
- **Ranged**: Wen arrows' Icy Precision restored **25 → 30%** damage/accuracy; Caroming 2.5 → 4%
  per rank; **default ammo break chance 20 → 15%** with almost all ammo moved to the default
  (chinchompas now destroyed only 15% of the time); some ammo (hand cannon shot, bolt racks)
  auto-stays in the slot until a break roll fails; Ava's devices lose their 10% pickup-fail chance.
- **Rune consumption chance 20 → 15%.** (Post.)
- **Equipment damage-bonus normalisation** — the update AGENTS.md calls the 9 Mar rebalance:
  - The post: the damage-bonus formula "wasn't being adhered to at later levels"; values cleaned up
    to be consistent — **armour values came down slightly above tier 92, offset by tertiary
    equipment (jewellery, pocket slots, capes) generally increasing**. Patch-notes line: "Normalised
    Damage Bonus values for items".
  - Per M's annotations and the current [Damage bonus](https://runescape.wiki/w/Damage_bonus) page
    (fetched 24 Jul 2026): the realignment was applied across armour, rings, amulets, pocket items,
    **necromancy armour, and hybrid/all-class items**; T92+ armour lost artificially inflated
    bonuses; Essence of Finality amulet was slightly reduced (against the trend).
  - Current model per the Damage bonus page: damage bonus adds to max hit at **+1 per point with a
    single main-hand weapon, +1.5 per point dual-wielding or two-handed**. Resulting documented
    best-in-slot totals: melee 315.5, magic 281.9, ranged 281.9, necromancy 275.5 — with large
    shares now on jewellery/pocket/cape (e.g. Essence of Finality (or) +58.6, Champion's-style
    rings +34.5, igneous capes +37.1, Underworld Grimoire 4 +14.8).
- Sanctum of Rebirth drop rates retuned (weapons NM 1/50→1/75, HM 1/40→1/60; prayer/scripture
  NM 1/90→1/125, HM 1/80→1/100; Shard of Genesis Essence HM 1/80→1/75) — acquisition only.
- Bug fixes: off-GCD abilities (Surge, Dive) no longer generate adrenaline (hotfix); Bombardment
  no longer goes on cooldown after use; Blast Diffusion boots correctly apply Blast Infused to
  basic attacks; Massacre made F2P; Ice strykewyrms damageable by Combust/Corruption Blast;
  Devourer's Guard damage values corrected. (Post, 9 Mar 2026.)
- Announced (shipped 16 Mar, §7): Death's Swiftness becomes a movable self-buff.

---

## 7. 16 Mar 2026 — refinements (DailyScape Overhaul update)

Sources: [Update:DailyScape Overhaul & Free Runemetrics for Members](https://runescape.wiki/w/Update:DailyScape_Overhaul_%26_Free_Runemetrics_for_Members)
and [Update:Patch Notes: Dailyscape Overhaul](https://runescape.wiki/w/Update:Patch_Notes:_Dailyscape_Overhaul), 16 Mar 2026.

- **Death's Swiftness (and Greater) reworked**: no longer a placed area — now a mobile self-buff
  (1.5× ranged damage, 50 ticks / Greater 63 ticks); its small DoT component removed entirely.
  Planted Feet now simply adds +13 ticks (previously also removed the DoT). New VFX.
- **Surge and Escape no longer share a cooldown** except in PvP; a short anti-spam cooldown stops
  both firing on the same cycle.
- **Surge, Escape, Runic Charge, and the former-sigil abilities no longer clear stalled
  abilities.**
- **Tank-armour realignment**: life-point and damage-reduction values re-aligned to item tier
  (head/body/legs/gloves/boots/shield), fixing items whose stats didn't match their tier — e.g.
  wizard robe skirt 0 → 75 LP; primal platebody +5 1,485 → 1,350 LP. Same patch: crafted armour
  stats no longer offset — they match armour tier exactly.
- Patch notes: Flurry/Greater Flurry stun fixed; enhanced abilities can be toggled during
  revolution; salamanders consume ammo only 15% of the time; Golden Touch castable without a
  staff; FSoA tooltip fix.
- Announced future work (later shipped where noted): core Magic buff (§8), Dive/Bladed Dive split
  (§9, 7 Apr), lower-tier Equilibrium access (§8, 30 Mar), Chain timing on secondary targets (§9,
  7 Apr), Concentrated Blast animation rework.

---

## 8. 30 Mar 2026 — ability refinements (Blooming Burrow update)

Source: [Update:Blooming Burrow Returns!](https://runescape.wiki/w/Update:Blooming_Burrow_Returns!), 30 Mar 2026.

- **Asphyxiate buffed**: base damage raised (post: 120% → 130% per hit; the wiki records the live
  range as 120–140% — wording differs, §10). **Completing a full channel grants Channelled Might
  for 3.6 s: +15% magic critical strike damage.** With 5 pieces of Tumeken's resplendence,
  Channelled Might lasts 9 s at +35% crit damage — replacing the 29 Sep 2025 Embodiment of Light
  effect (§3). Full-cast damage ratio unchanged (624%).
- **Wild Magic: each hit gains +20% critical strike damage and +10% critical strike chance.**
- **Equilibrium perk**: now also obtainable at ranks 1–2 from Manufactured components; scaling
  rebalanced to **6% + 2% per rank (8/10/12/14% at r1–r4)**.
- Havenhythe boss encounter tuning (Ivar, Silverquill) — boss-specific, listed for completeness
  only.

---

## 9. Later patches (7 Apr – 24 Jul 2026)

Sources: wiki `Update:` pages linked per entry; enumerated against the full 2026 update list
([Game updates](https://runescape.wiki/w/Game_updates), fetched 24 Jul 2026).

- **7 Apr — [April Patch Week](https://runescape.wiki/w/Update:April_Patch_Week)**: **Bladed Dive
  and Dive are now separate abilities** (still sharing a cooldown). Power/hybrid armour damage
  bonuses now displayed to 1 decimal place (fractional bonuses, e.g. +27.5). Chain projectile
  timings sped up. Air/earth spells no longer stall NPC attacks. Improved channelled-ability
  tooltips.
- **13 Apr — Aura Overhaul** ([patch notes](https://runescape.wiki/w/Update:Patch_Notes:_Aura_Overhaul);
  [TWIR](https://runescape.wiki/w/Update:Aura_Overhaul_%26_April_Marketplace_Drop)): **Vampyrism
  aura → "Vampyrism" Aspect spell** (Ancient Magicks, 69 Magic; heals 5% of damage dealt, capped
  50 LP/hit, 12 min). **Penance aura → "Penance" Aspect spell** (67 Magic; restores prayer equal
  to 5% of damage received, capped 100). Aspects are one-at-a-time buffs. **Aura slot removed from
  the Worn Equipment UI; all remaining auras removed** (the 15 combat auras were already disabled
  2 Mar). Anti-poison totem now 100% poison immunity (pocket slot). Might of Het → new Totem of
  Vitality (+25% max LP, cap +1,500; totems no longer need charges or weekly swaps).
  Harmony/Corruption/Salvation prayer-restore integrated into the Sunspear. Daemonheim aura
  effects made passive.
- **20 Apr — [Game Jam QoL, Simpler Enrage Scaling & More!](https://runescape.wiki/w/Update:Game_Jam_QoL,_Simpler_Enrage_Scaling_%26_More!)**:
  Aspect spells re-castable to stack duration up to 1 h (multicast option, 5× runes); Penance moved
  to the Ancient spellbook. Free enrage selection for Telos/Arch-Glacor/Zamorak up to 4,000%.
  Limitless trigger fixed.
- **27 Apr — [Back To Our Square Roots](https://runescape.wiki/w/Update:Back_To_Our_Square_Roots)**:
  combat-visual declutter only. Necromancy conjures can no longer be targeted (movement QoL) and
  render under NPCs; Residual Soul stacks only visible to their owner. No numeric mechanics.
- **5 May — [Dye-ing to meet you!](https://runescape.wiki/w/Update:Dye-ing_to_meet_you!)**: dyes
  and fixes. Behaviour fixes worth noting: NPCs using adrenaline now correctly consume it on
  enhanced casts and can no longer use ultimates they shouldn't have; revolution with 1-tile
  weapons no longer over-chases targets. No player-facing mechanic changes.
- **11 May — Dungeoneering Remastered** ([patch notes](https://runescape.wiki/w/Update:Patch_Notes:_Dungeoneering_Remastered)):
  Ring of kinship class effects now passive (no switching); new necromancy classes (Necrolord —
  accuracy; Conjurer — longer conjures; Soulweaver — chance for necro attacks to generate Residual
  Souls). New rewards: **Chaotic grimoire (+7% crit chance when active)**; **Ruinous weapons (all
  four styles, T90 damage / T100 accuracy; Warpbane passive: +12% damage vs Creatures of
  Daemonheim — the reward table phrases it as "T100 damage", exact behaviour UNVERIFIED)**;
  necromancy gravite/chaotic armguard & lantern. In-dungeon: necromancy gear/runes added;
  mob/boss LP increased.
- **26 May — [Graphical Rendering, Boss Rates & More!](https://runescape.wiki/w/Update:Graphical_Rendering,_Boss_Rates_%26_More!)**:
  lodestone teleports usable in combat (interrupted by attacks); two ammo bind slots in DG.
- **1 Jun — [Uncover the Secrets of Amberfell](https://runescape.wiki/w/Update:Uncover_the_Secrets_of_Amberfell)**:
  combat buffs (including conjures) no longer clear on gatestone teleport.
- **29 Jun — [Chill June Patch Week](https://runescape.wiki/w/Update:Chill_June_Patch_Week)**:
  **Bloodlust stacks disabled in Classic Mode** (nothing to spend them on there); bleeds no longer
  persist after death in duels/clan wars; action bar no longer attempts abilities you only meet
  via stat boosts.
- **20 Jul — Mid-Game Rebalance** ([patch notes](https://runescape.wiki/w/Update:Patch_Notes:_Mid-Game_Rebalance);
  [launch post](https://runescape.wiki/w/Update:Mid-Game_Rebalance_is_Live!); [preview 3 Jul](https://runescape.wiki/w/Update:Mid-Game_Rebalance_Preview)):
  - **Ranged weapon re-tier**: yew bows 40→70 (members), magic 50→80, elder 60→90, maple 30→40,
    new acadia bows at 50; metal crossbows filled in (orikalkum 60, necronium 70, bane 80, elder
    rune 90) with matching new arrow/bolt tiers. **All shieldbows retired — converted to
    equivalent-tier longbows with +1 tile range** (Strykebow remains a shieldbow; dark bow's final
    state not confirmed in the post — UNVERIFIED). Bane/primal ammo creation unified with normal
    ammo.
  - **All 15 negative Invention perks removed** from the game and stripped from existing gizmos
    (combat-relevant: Antitheism, Profane, Inaccurate, Cautious, Fatiguing, Committed,
    Butterfingers, Blunted, Mediocrity, Confused).
  - Dive now unlocks at 30 Agility (quest requirement removed).
  - GWD1: killcount persists and caps at 200; faction soulstones removed. GWD2: reputation cap
    5,000→2,000; drop-rate reputation unlocks removed (everyone gets the old max-tier rates flat).
    Boss instance coin costs removed. Demonic skull removed (refunded).
  - Drop-rate changes (vampyrism gloves 1/500→1/200 on-task etc.) — acquisition only.
  - Hotfix same day: no (safe) combat inside player-owned houses.
- **Checked, no combat-mechanic changes found**: 23 Mar (Havenhythe launch — new early bosses
  Ivar/Silverquill, no player-ability changes), 12 May (marketplace), 18 May (DG hiscores), 8 Jun
  (Player Avatar), 10 Jun (marketplace), 15 Jun (Archaeology), 22 Jun (Waterbirth graphics), 6 Jul
  (Sunlight Sands), 13–14 Jul (Player-Owned Housing launch), 23 Jul (Leagues II: Equilibrium
  countdown), 24 Jul (marketplace). Announced but not shipped by 24 Jul 2026: Leagues II:
  Equilibrium (10 Aug), Havenhythe Part 2 (September), Ghrazi Blood Knights.

---

## 10. Open discrepancies and unverified items

1. **Necromancy crit damage transition**: pre-2024 necromancy had +75% crit damage at level 120
   ([Critical strike, rev. 12 Dec 2023](https://runescape.wiki/w/Critical_strike?oldid=36257122));
   the current page documents one shared table for all four styles (50% at 90, fetched 24 Jul
   2026). No fetched page dates necromancy's move onto the shared table. Treat the shared table as
   current; the transition date is unverified.
2. **Runic Charge–empowered Concentrated Blast crit grant**: the CSM main page table says +20%
   crit chance per hit; the current Critical strike page documents the empowered grant as raising
   the per-hit bonus 5→15% (Greater 7→17%). The release value and the date of any reduction are
   unverified — the Critical strike page (fetched 24 Jul 2026) should be treated as current.
3. **Asphyxiate live range**: the 30 Mar 2026 post phrases the buff as "120% → 130%"; the wiki
   records 120–140% live. Same buff, different phrasing; exact live range per the wiki.
4. **Affinity page stale**: [Affinity](https://runescape.wiki/w/Affinity) still lists 90/65/55/45
   defaults on 24 Jul 2026, contradicting the 2 Mar 2026 change (90/70/60/50) documented in the
   official patch notes and on the Hit chance page. Use 90/70/60/50.
5. **Strength 120 cape bleed heal**: +2% (P1, 2 Mar 2026) vs "+3%" (M's master-cape row).
   Unresolved; likely a patch or wiki inconsistency.
6. **Basic-stun second charge level**: 54 (P1/P2 unlock tables) vs 70 (M's per-ability tables).
7. **Removed-abilities list**: P2's official list omits Havoc, Quake, Frenzy (present on M's
   list). All three were removed/re-added/removed across the beta (§4) — M's list matches the
   beta arc; treat as removed.
8. **Weapon-tier level cap**: the current Ability damage page caps the weapon-tier term by the
   wielder's level; not present in the pre-2024 formula revisions fetched. Introduction date
   unverified.
9. **Chinchompa conservation**: M's annotation implies conservation now applies to chinchompas;
   P1's text says chinchompas always explode and are destroyed. As written, unresolved.
10. **Damage-potential damage floor**: only the 1% hit-chance cutoff is documented; no explicit
    minimum-damage floor found.
11. **PvP crit-damage effectiveness (20%)**: on the current Critical strike page, undated —
    possibly a post-2024 change.
12. **Ruinous weapons' Warpbane** (11 May 2026): "+12% damage vs Creatures of Daemonheim" (post
    body) vs "T100 damage" (reward table). Exact implemented behaviour unconfirmed.
13. **Dark bow** after the 20 Jul 2026 shieldbow retirement: the post confirms only that Strykebow
    remains a shieldbow; the dark bow's final state was not confirmed in what was read.
14. **Pre-2024 weapon-damage normalization by speed** (§1.5): never stated on fetched pages.
15. **Sourcing limits**: wiki `Update:` pages are verbatim mirrors of the Jagex posts, but
    `secure.runescape.com` originals were independently confirmed only for Part 2 of the 2 Mar
    2026 patch notes and Beta Update 3. The RS Analysis PDF was only partially machine-readable
    (extraction stopped around §8.3 of 27 pages).

---

## 26 Jul 2026 — revolution bars (engine data)

Revolution catalogue replaced wiki-only ST BiS with **PvME single-target** bars (Revo++ + Basics only per style). Multi-target omitted for simplicity. Source: [PvME Revolution Bars](https://pvme.io/pvme-guides/miscellaneous-information/revolution-bars/); config = Auto-retaliate on, Revolution on, auto-trigger Basic/Threshold/Enhanced/Ultimate, size 14, Auto Attack off.
