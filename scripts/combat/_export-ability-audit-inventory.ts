/**
 * Seed reports/ability-mechanics-audit/inventory.json from ABILITY_REGISTRY.
 * Run: npx tsx scripts/combat/_export-ability-audit-inventory.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ABILITY_REGISTRY } from "../../src/combat/abilities/registry";
import type { AbilityHit } from "../../src/combat/pipeline/calculateAbility";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function hitSummary(hits: readonly AbilityHit[]) {
  return hits.map((h) => ({
    minPct: h.band.minPct,
    maxPct: h.band.maxPct,
    tickOffset: h.tickOffset ?? null,
    critEligible: h.critEligible !== false,
    dot: h.dot === true,
    bleedId: h.bleedId ?? null,
  }));
}

const abilities = ABILITY_REGISTRY.map((e) => {
  const s = e.spec;
  const ext = s as {
    bloodlustGain?: number;
    enables?: string;
    recastOf?: string;
    derivedHits?: unknown;
    source?: { url?: string; verifiedAt?: string };
  };
  return {
    engineId: e.engineId,
    name: s.name,
    style: e.style,
    category: e.category,
    recordId: e.recordId,
    linkKind: e.linkKind,
    castStage: e.castStage ?? null,
    replacementGroup: e.replacementGroup ?? null,
    cooldownGroup: e.cooldownGroup ?? null,
    supportStatus: e.support.status,
    supportNote: e.support.note ?? null,
    solverEligibleDefault: e.solverEligibleDefault,
    basicAttack: s.basicAttack === true || s.autoAttack === true,
    offGcd: s.offGcd === true,
    weaponSpecial: s.weaponSpecial === true,
    adrenaline: {
      gain: s.adrenaline?.gain ?? null,
      cost: s.adrenaline?.cost ?? null,
    },
    cooldownSeconds: s.cooldownSeconds ?? null,
    channelTicks: s.channelTicks ?? null,
    weaponRequirement: s.weaponRequirement ?? null,
    requiredPassiveAnyOf: s.requiredPassiveAnyOf ?? null,
    requiredEquipmentAnyOf: s.requiredEquipmentAnyOf ?? null,
    stateEffect: s.stateEffect ?? null,
    appliesEffect: s.appliesEffect ?? null,
    area: s.area ?? null,
    guaranteedCrit: s.guaranteedCrit === true,
    bleedDurationExtension: s.bleedDurationExtension ?? null,
    bloodlustGain: ext.bloodlustGain ?? null,
    enables: ext.enables ?? null,
    recastOf: ext.recastOf ?? null,
    hasDerivedHits: ext.derivedHits != null,
    hits: hitSummary(s.hits),
    hitCount: s.hits.length,
    sourceUrl: ext.source?.url ?? null,
    verifiedAt: ext.source?.verifiedAt ?? null,
    audit: {
      staticStatus: "pending" as const,
      runtimeStatus: "pending" as const,
      parityStatus: "pending" as const,
      notes: [] as string[],
    },
  };
});

const byStyle = abilities.reduce(
  (acc, a) => {
    acc[a.style] = (acc[a.style] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

const support = abilities.reduce(
  (acc, a) => {
    const k = String(a.supportStatus);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>,
);

const inventory = {
  generatedAt: new Date().toISOString(),
  headSha: process.env.GIT_HEAD || null,
  note: "Seed from ABILITY_REGISTRY. audit.* starts pending; update per finding file.",
  counts: {
    total: abilities.length,
    byStyle,
    support,
    solverEligibleDefault: abilities.filter((a) => a.solverEligibleDefault).length,
  },
  abilities,
};

const outDir = path.join(root, "reports/ability-mechanics-audit");
fs.mkdirSync(path.join(outDir, "findings"), { recursive: true });
fs.writeFileSync(path.join(outDir, "inventory.json"), JSON.stringify(inventory, null, 2) + "\n");
console.log(
  `[OK] inventory ${inventory.counts.total} abilities support=${JSON.stringify(support)} solverEligible=${inventory.counts.solverEligibleDefault}`,
);
