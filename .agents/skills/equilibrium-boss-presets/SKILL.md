---
name: equilibrium-boss-presets
description: Add, review, or integrate sourced RuneScape boss target presets in RS3 Equilibrium. Use for target selectors, TargetPresetRecord, targetPresetId, numeric target affinity, boss coverage manifests, loadout target migrations, or combat target catalogue work. Use after $wiki-target-research and alongside $combat-math, $combat-sim, $data-sync, and $test-maintainer when tests change.
---

# Equilibrium Boss Presets

Use this skill for the boundary between sourced NPC facts and Equilibrium's existing generic target model. Read `$wiki-target-research` first for current Wiki facts and provenance. Read `$combat-math`, `$combat-sim`, and `$data-sync` before changing their domains; read `$test-maintainer` before writing or changing Vitest or Playwright tests.

## Keep the boundary narrow

Treat a boss preset as data that materializes the same target facts a user can enter manually. Keep the generic engine as the sole combat calculation path.

Do not add boss-specific damage formulas, boss classes in the engine, phase scripts, enrage models, encounter timelines, kill-time logic, outgoing boss rotations, movement simulation, NPC incoming DPS, minions, or boss-specific Revolution decisions. Store future-facing metadata only when it is cheap and clearly marked unsupported.

Only map facts already meaningful to the current engine: Defence, base armour, exact affinity, exact weakness affinity, target size, life points when the current model consumes them, poison immunity, Demon/Dragon/Undead flags, Slayer eligibility, and useful source metadata. Do not claim support for phase immunity or other mechanics the generic model cannot express.

## Use exact numeric affinity

Refactor the canonical target calculation input from the current `AffinityKind` enum to an exact numeric affinity percentage. Preserve named defaults for UI convenience:

```ts
const DEFAULT_AFFINITIES = {
  weakness: 90,
  weak: 70,
  same: 60,
  strong: 50,
} as const;
```

The defaults are presets, not the target type. Accept arbitrary sourced values such as 55, sanitize to the engine's valid range, and preserve `targetArmour`, `targetDamagePotential`, and the existing generic accuracy path. Never emulate exact affinity with `additiveHitChance`, add a second boss formula, or create `bossDamagePotential`.

Keep sourced style profiles at the adapter boundary:

```ts
interface TargetAffinityProfile {
  melee: number;
  ranged: number;
  magic: number;
  weakness?: number | null;
}
```

Resolve one numeric value from the selected preset, current player style, manual override state, and explicitly applicable weakness or League rules. Do not push the whole profile into low-level Damage Potential calculation unless an existing seam requires it.

Resolve Necromancy through the canonical current middle/same-affinity helper. Do not invent a Wiki Necromancy column. Changing style on an untouched preset selects the new style value immediately; an explicit manual affinity override survives style changes.

Update the existing `effectiveTargetAffinity` boundary when numeric affinity is introduced. When a rule such as Demon's Mark makes a weakness applicable, use the sourced exact weakness affinity. Do not hardcode every weakness to 90 and do not set `hasApplicableWeakness` merely because a target record has a weakness; weapon, spell, or ammunition compatibility remains a separate fact.

## Model sourced records in the data platform

Follow `CombatRecordBase` and `SourceReference` conventions. Adapt names to current repository types, but preserve this shape and separation:

```ts
type TargetPresetSupport = "supported" | "provisional" | "unsupported";

interface TargetPresetRecord extends CombatRecordBase {
  category: "boss";
  encounter: string;
  aliases?: string[];
  wiki: {
    pageName: string;
    pageNameSub?: string;
    versionAnchor?: string;
    npcIds?: number[];
  };
  support: TargetPresetSupport;
  unsupportedReason?: string;
  stats: {
    defenceLevel: number | null;
    armour: number | null;
    affinities: TargetAffinityProfile | null;
    weaknessClass?: "melee" | "ranged" | "magic" | null;
    weaknessText?: string[];
    size: number | null;
    lifePoints?: number | null;
    poisonImmune?: boolean | null;
    susceptibilities?: string[];
    slayerCategories?: string[];
    undead?: boolean | null;
    demon?: boolean | null;
    dragon?: boolean | null;
  };
}
```

Use stable IDs, nullable unknown facts, complete provenance, and no executable combat logic in records. Keep support status explicit. If a phase or mode changes a target fact that the current simulator consumes, split the preset; otherwise collapse equivalent versions and record the source decision in metadata.

Use the existing source, patch, canonical, and generated-data pipeline. Do not put a large object in `TargetPanel.tsx` or create a tracked per-domain JSON authoring system. If the current convention uses a generated `#shard/combat/targets.json`, add the corresponding source document and extend the coherent catalogue path:

- combat record type and source dataset;
- `CombatDataCatalogue` dataset and `targetPresetsById` lookup;
- compiler, exports, integrity, duplicate, range, and provenance validation;
- generated source-document plumbing required by `#shard`;
- forward-only schema migration if relational/domain support is required.

Do not commit only `data/combat/targets.json` when the runtime artifact is generated. A Wiki sync utility may collect facts during development, but its output must enter the reviewable patch/ingestion workflow and never become a runtime network dependency.

## Keep adaptation and loadout state separate

Implement a small pure adapter that takes a preset and current loadout style and returns the materialized target fields. Keep `TargetPanel` focused on presentation and interaction. The adapter owns Defence, armour, numeric style affinity, exact weakness affinity where needed, size, explicit poison immunity, and explicit Demon/Dragon/Undead flags.

Persist the materialized target and its source identity conceptually as:

```ts
targetPresetId?: string;
target: LoadoutTarget | null;
```

Use the ID for display, reset-to-source, and modified detection. Keep enough materialized values for a saved loadout to simulate if the preset is renamed or removed. If an ID is unknown on load, retain the target and show Custom/Modified; never delete it or make simulation depend on the catalogue entry.

Bump the loadout schema for numeric affinity. Migrate legacy values deterministically: `weakness` to 90, `weak` to 70, `same` to 60, and `strong` to 50. Replace normalization that rejects a target merely because its affinity is no longer one of the old enum strings. Preserve no-target saves, manual Damage Potential, HP and race fields, poison and size fields, malformed-target safety, and unknown future or removed preset IDs.

Keep Custom first-class. Retain editable Defence, armour, affinity, additive accuracy, manual Damage Potential, HP percentage, weakness applicability, race flags, Slayer-task state, size and spatial fields, poison immunity, and incoming-hit scenario. Familiar numeric choices may remain Weakness 90, Weak 70, Neutral 60, Strong 50, and Custom, but the stored value is numeric.

## Build a compact selector

Place a searchable selector near the top of the existing Target panel. Support keyboard search, canonical names, aliases, encounter grouping, and a compact dense-game-tool layout. Do not make a giant select or add a client network request.

Useful aliases include KBD, QBD, AoD, Rax, RoTS, BSD, GWD1, GWD2, ED1, ED2, ED3, Zuk, Zammy, and Sanctum. Selecting a preset applies sourced values immediately while advanced controls remain editable. Show Modified when materialized values differ, provide Reset to Wiki values, and expose concise source or verification metadata.

## Maintain explicit coverage

Use a manifest rather than discovering scope from a broad category. The baseline families are:

- General: Giant Mole, King Black Dragon, Chaos Elemental, Kalphite Queen and Exiled Kalphite Queen, Corporeal Beast, Queen Black Dragon, Dagannoth Kings, Barrows, Rise of the Six, Flesh-hatcher Mhekarnahz, Legiones, Rex Matriarchs, Kalphite King, The Magister, Hermod, Araxxor, Araxxi, Raksha, Rasial, Solak, Vorago, Zemouregal, Vorkath, Ivar, Silverquill, and Amascut.
- God Wars: Kree'arra, General Graardor, Commander Zilyana, K'ril Tsutsaroth, Nex, Nex: Angel of Death, Helwyr, Gregorovic, Twin Furies members when profiles differ, Vindicta and Gorvek when profiles differ, and Telos.
- TzekHaar and Elder God Wars: Arch-Glacor, Kerapac, TzKal-Zuk, TzTok-Jad and distinct Jad variants, Har-Aken, TzekHaar-Aken, and other relevant TzHaar/TokHaar/TzekHaar targets. Record Croesus as explicit non-combat or unsupported coverage, never as a fake DPS target.
- Elite Dungeons: Sanctum Guardian, Masuta, Seiryu, Astellarn, Verak Lith, Black Stone Dragon, Crassian Leviathan, Taraket, and The Ambassador.
- Other encounters: Zamorak, Lord of Chaos; Vermyx, Kezalam, Nakatra; Beastmaster Durzag; and Yakamaru.
- Composite expansion: individual Dagannoth Rex/Prime/Supreme, Legio Primus through Sextus, Orikalka/Pthentraken/Rathis/Osseous, individual Barrows targets where profiles differ, Zemouregal and Vorkath separately, and Araxxor and Araxxi separately.

Treat this as intended coverage, not a substitute for Wiki canonical names or version anchors. Mark Gate of Elidinis and other skilling-only encounters unsupported rather than presenting them as offensive combat targets.

Split variants only when Defence, base armour, usable affinity, meaningful weakness affinity, poison immunity, target size, Slayer eligibility, race eligibility, or simulator-consumed life points differ. Do not split only for outgoing mechanics, phase narration, loot, or max life when the current model does not consume absolute HP. Record collapsed source versions in metadata.

## Verify by layer

Add focused tests before broad suites:

- Core: arbitrary 55, unchanged 90/70/60/50 defaults, 55 not equal to same plus additive correction, bounds, and manual Damage Potential bypass.
- Profile: exact melee/ranged/magic values, Necromancy middle-affinity behavior, style switching on an untouched preset, and manual override persistence.
- League: exact weakness forcing, existing Demon's Mark behavior, and no-League generic regression.
- Migration: all four legacy strings, retained targets, no-target saves, manual Damage Potential, race/poison/size fields, malformed targets, and unknown preset IDs.
- Data: unique IDs, provenance, valid affinity ranges, nonnegative Defence/armour, required supported fields, unique manifest resolution, and no simulator-equivalent duplicates.
- UI: canonical and alias search, selection, style switch, edit to Modified, reset, Custom mode, persistence, and reload.

Run the repository's focused combat, data, architecture, comments, typecheck, and formatting gates that match the touched areas. For browser tests, follow `$playwright-e2e` and report skipped or flaky runs accurately.

## Stop at the non-goals

Do not expand a preset task into boss mechanics, phases, enrage, unsupported immunity systems, movement, kill time, NPC incoming DPS, minions, or boss-specific Revolution behavior.
