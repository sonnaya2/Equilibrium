---
name: equilibrium-poison
description: Research, plan, implement, or review player-applied RS3 weapon poison in Equilibrium. Use for weapon poison tiers, Cinderbane gloves, upgraded bone blowpipe, Laniakea's spear, Kwuarm incense, Bik arrows and Evolving Toxin, poison susceptibility, poison events, poison RNG distributions, poison attribution, or poison-related loadout and solver work.
---

# Equilibrium Poison

Model player-applied poison through the existing event-driven combat engine. Keep game facts sourced, state changes exact within a fixed horizon, and unsupported interactions explicit.

Read [references/mechanics.md](references/mechanics.md) before poison work. Recheck current official patch notes when mechanics may have changed.

## Workflow

1. Read `AGENTS.md`, `docs/combat-engine.md`, `docs/combat-model.md`, and `docs/equipment-effects.md`.
2. Inspect `git status --short` and preserve concurrent work. For an audit or plan, do not edit production files.
3. Verify mechanics in this order: current Jagex notes, current RuneScape Wiki, then PVME for behavior Jagex does not document. Label unresolved behavior instead of filling gaps.
4. Trace the complete path before changing it:
   - inputs: `src/components/combat/loadout/`, `src/components/combat/BuffsPanel.tsx`, `src/combat/model/`, solver packing and worker revival
   - equipment and ammo: `src/combat/shared/equipment.ts`, `src/combat/passives/`, `src/combat/styles/ranged/ammoModel.ts`
   - runtime: `src/combat/engine/runtime/`, resolution accounting, poison distribution, branch keys
   - output: per-ability totals, analysis sources, events, timeline, support labels
5. Reuse the queue, immutable `RotationState`, provenance capabilities, the target-owned poison distribution, and existing loadout normalization. Do not build a second poison simulator.
6. Add the smallest focused tests that prove formula, cadence, refresh, recursion, branch isolation, serialization, and attribution.

## Engine Rules

- Store poisoned-target and Evolving Toxin clocks under `RotationState.target`.
- Represent player poison as its own provenance. Never route it through Putrid Zombie metadata merely because both use event family `poison`.
- Gate trigger eligibility with a provenance capability, not ability-id lists or a global after-damage hook. Separate player hits, player bleeds/DoTs, and verified auxiliary player hits are eligible per hitsplat. Familiar attacks, conjure autos/commands, Putrid Zombie pulses, Blood Reaver passive damage, and attached riders are ineligible.
- Resolve poison application and Cinderbane continuation in the target-owned compact probability distribution. Do not clone the unrelated combat runtime or spend the global branch budget. Use one application roll; Cinderbane supplies or modifies that source and enables continuation, not a second simultaneous roll when a potion is active.
- Keep the poison damage range as expected damage. Branch only when the outcome changes future state.
- Require a finite simulation horizon for recursive Cinderbane chains. Preserve unit mass inside the poison distribution; never add an arbitrary recursion count or discard poison outcomes through global branch caps.
- Store effective tier, remaining hits, cadence, the exact conditional decay PMF, next-hit tick, and earned pending-hit carriers on the target poison state.
- An initial application earns the first poison hit two ticks later; that hit is hit 1 of the 18-hit sequence. An ordinary active refresh renews duration and decay without inventing an extra hit. A successful Cinderbane reapplication earns another +2-tick hit and resets the ordinary cadence; already-earned delayed hits survive later refreshes.
- Every Cinderbane poison hit makes the same single continuation roll. A success refreshes poison and earns another +2-tick hit, so the chain may continue recursively. Preserve this state transition; use `p / (1 - p)` only as a test oracle.
- Keep poison damage separate from ordinary ability modifiers: no crit, miss, prayer/window boost, hit cap, healing, invention proc, resource gain, or generic on-hit recursion unless a sourced exception names it.
- Poison is status damage and never triggers Abyssal Cinders or Inferno. Cinders and Big Boned are independent attached components on an attack hit; Big Boned does not attach to Cinders' 15% component. A separate Inferno hit may roll weapon poison and may host Big Boned, but it cannot re-open Cinders.
- Apply target-global poison modifiers at land time. Keep source-local tier, cadence, and gear modifiers on the applying profile.
- Keep Putrid Zombie poison behavior unchanged and separately attributed. Weapon poison, Cinderbane tier, Kwuarm, and other poison modifiers may boost its poison damage, but its attacks and pulses never create player-weapon-poison attempts.

## Data And UI

- Add equipment passive ids and source facts through dated JSONL patches, rebuild, and canonical export. Never hand-edit generated canonical data.
- Derive Cinderbane, blowpipe, and Laniakea effects from resolved equipment. Derive Bik from the ammo slot.
- Put consumable choices in loadout buffs: weapon poison tier plus integer Kwuarm potency `0 | 1 | 2 | 3 | 4`. Map potency to `0%, 2.5%, 5%, 7.5%, 10%`; do not use a binary incense toggle. Compile the tier's sourced full duration; add partial remaining duration only when a real use case requires mid-buff starts.
- Reuse the target poison-immunity control, but carry it through the resolved model, simulator, solver snapshot, and worker contract.
- Show poison source, effective tier, poison proc chance, current minimum/expected/maximum damage, applications, separate hits, decay index, current Evolving Toxin stacks, remaining poison duration, and support status from engine output. Show each damage source's attributed expected poison hits beside that source so multi-hit and recursive behavior is inspectable. Do not calculate poison in React.

## Verification

Run focused poison and parity tests first, then the affected gates:

```text
npx vitest run <focused poison tests> src/combat/engine/simulation/branchKey.test.ts
npm run test:combat
npm run audit:architecture
npm run audit:comments
npm run typecheck
```

If data records change, also run the patch rebuild/export/show workflow and `npm run audit:data`. Report browser QA honestly; do not retry a flaky harness indefinitely.

Required focused fixtures:

- all five initial tier ranges and averages
- 12.5% and Laniakea 17.5% proc branches
- first poison hit at source tick + 2, with 18 total hits at 16-tick cadence
- blowpipe half damage and 36 total hits at 8-tick cadence
- second-hit and eighteenth-hit decay, plus refresh resetting decay to 0
- Cinderbane tier increase, active-target extra hits, recursive two-tick continuation, and preservation of sibling delayed hits
- 60-second poison variants with unit poison mass and zero global poison snapshots/key work
