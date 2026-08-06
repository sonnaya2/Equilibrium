import { secondsToTicks } from "../../core/ticks";
import { PRIMORDIAL_ICE_CAP } from "./effects";
import { FROSTBLADES_DURATION_TICKS, type CompiledLengLandTable } from "./lengRng";

export const PRIMORDIAL_ICE_DURATION_SECONDS = 120;
export const PRIMORDIAL_ICE_DURATION_TICKS = secondsToTicks(PRIMORDIAL_ICE_DURATION_SECONDS);
export const PRIMORDIAL_ICE_BINS = PRIMORDIAL_ICE_CAP + 1;

export interface LengAtom {
  readonly weight: number;
  readonly stacks: number;
  readonly stacksExpireAtTick: number;
  readonly frostbladesExpireAtTick: number;
}

export interface PrimordialIceDistribution {
  readonly atoms: readonly LengAtom[];
}

const EMPTY_ATOMS: readonly LengAtom[] = Object.freeze([
  Object.freeze({
    weight: 1,
    stacks: 0,
    stacksExpireAtTick: 0,
    frostbladesExpireAtTick: 0,
  }),
]);

function clampStacks(stacks: number): number {
  return Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, Math.floor(stacks)));
}

function atomKey(atom: Pick<LengAtom, "stacks" | "stacksExpireAtTick" | "frostbladesExpireAtTick">): string {
  return `${atom.stacks}|${atom.stacksExpireAtTick}|${atom.frostbladesExpireAtTick}`;
}

function addAtom(atoms: Map<string, LengAtom>, atom: LengAtom): void {
  if (!(atom.weight > 0)) return;
  const key = atomKey(atom);
  const existing = atoms.get(key);
  if (existing) atoms.set(key, { ...existing, weight: existing.weight + atom.weight });
  else atoms.set(key, atom);
}

function sortedAtoms(atoms: Map<string, LengAtom>): LengAtom[] {
  return [...atoms.values()].sort(
    (a, b) =>
      a.stacks - b.stacks ||
      a.stacksExpireAtTick - b.stacksExpireAtTick ||
      a.frostbladesExpireAtTick - b.frostbladesExpireAtTick,
  );
}

export function emptyPrimordialIce(): PrimordialIceDistribution {
  return { atoms: EMPTY_ATOMS };
}

export function unitPrimordialIce(
  stacks: number,
  stacksExpireAtTick = 0,
  frostbladesExpireAtTick = 0,
): PrimordialIceDistribution {
  return {
    atoms: [
      {
        weight: 1,
        stacks: clampStacks(stacks),
        stacksExpireAtTick,
        frostbladesExpireAtTick,
      },
    ],
  };
}

export function massSum(atoms: readonly LengAtom[]): number {
  let total = 0;
  for (const atom of atoms) total += atom.weight;
  return total;
}

export function expectedStacksFromAtoms(atoms: readonly LengAtom[]): number {
  let expected = 0;
  for (const atom of atoms) expected += atom.weight * atom.stacks;
  return expected;
}

export function expirePrimordialIce(
  dist: PrimordialIceDistribution,
  tick: number,
): PrimordialIceDistribution {
  const merged = new Map<string, LengAtom>();
  for (const atom of dist.atoms) {
    const stacksLive = atom.stacksExpireAtTick > tick;
    const stacks = stacksLive ? clampStacks(atom.stacks) : 0;
    addAtom(merged, {
      weight: atom.weight,
      stacks,
      stacksExpireAtTick: stacksLive && stacks > 0 ? atom.stacksExpireAtTick : 0,
      frostbladesExpireAtTick:
        atom.frostbladesExpireAtTick > tick ? atom.frostbladesExpireAtTick : 0,
    });
  }
  const atoms = sortedAtoms(merged);
  return atoms.length > 0 ? { atoms } : { atoms: [] };
}

export function activeFrostbladesMass(dist: PrimordialIceDistribution, tick: number): number {
  let active = 0;
  for (const atom of dist.atoms) {
    if (atom.frostbladesExpireAtTick > tick) active += atom.weight;
  }
  return active;
}

export function applyLengLandToDistribution(
  dist: PrimordialIceDistribution,
  table: CompiledLengLandTable,
  tick: number,
): PrimordialIceDistribution {
  const live = expirePrimordialIce(dist, tick);
  const merged = new Map<string, LengAtom>();
  for (const atom of live.atoms) {
    for (const arm of table.arms) {
      addAtom(merged, {
        weight: atom.weight * arm.weight,
        stacks: Math.min(PRIMORDIAL_ICE_CAP, atom.stacks + arm.stackAdd),
        stacksExpireAtTick:
          arm.stackAdd > 0 ? tick + PRIMORDIAL_ICE_DURATION_TICKS : atom.stacksExpireAtTick,
        frostbladesExpireAtTick:
          arm.opensFrostblades ? tick + FROSTBLADES_DURATION_TICKS : atom.frostbladesExpireAtTick,
      });
    }
  }
  const atoms = sortedAtoms(merged);
  return atoms.length > 0 ? { atoms } : { atoms: [] };
}

export function consumePrimordialIce(dist: PrimordialIceDistribution): PrimordialIceDistribution {
  const merged = new Map<string, LengAtom>();
  for (const atom of dist.atoms) {
    addAtom(merged, {
      weight: atom.weight,
      stacks: 0,
      stacksExpireAtTick: 0,
      frostbladesExpireAtTick: atom.frostbladesExpireAtTick,
    });
  }
  const atoms = sortedAtoms(merged);
  return atoms.length > 0 ? { atoms } : { atoms: [] };
}
