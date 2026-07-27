/**
 * Deliberate combat-upgrade classification for map planner counts.
 * Not a free-text word bag: bare "ring" / "cape" / "relic" / "boss" alone
 * do not qualify. Patterns are intentional and covered by unit tests.
 */

/** Positive markers — category must match at least one. */
const POSITIVE: readonly RegExp[] = [
  /\bcombat\b/i,
  /\bbis\b/i,
  /\bbest-in-slot\b/i,
  /\b(?:weapon|armou?r)s?\b/i,
  /\bpvm\b/i,
  // Style + gear pairings (Magic weapons, Necromancy power armour, …)
  /\b(?:melee|ranged|magic|necromancy)\b.+\b(?:weapon|armou?r|power|tank|dual-wield|two-handed|glove|boot|staff|bow|spear|scripture|grimoire|residual|unique|gear|equipment|cape|ring|invocation|prayer)\b/i,
  /\b(?:weapon|armou?r|power|tank|dual-wield|two-handed|glove|boot|staff|bow|spear|scripture|grimoire|residual|unique|gear|equipment)\b.+\b(?:melee|ranged|magic|necromancy)\b/i,
  // Named combat hubs / residuals from regional combat unlocks
  /\bgwd[12]\b/i,
  /\beof\b/i,
  /\bdominion\s+tower\b/i,
  /\b(?:nex|corporeal|glacor|tzekhaar)\b/i,
  /\b(?:defender|halberd|polearm|whip|chargebow|scripture|grimoire)\b/i,
  // Combat jewellery — require combat-ish context, not bare "ring"
  /\bhybrid\b.*\bring\b/i,
  /\bring\b.*\b(?:hybrid|crit|channel|combat)\b/i,
  /\bdaemonheim\s+ring\b/i,
  /\bupgraded\s+fremennik\s+ring\b/i,
  /\b(?:combat\s+cape|tzekhaar.*cape)\b/i,
  /\bboss\b.+\b(?:drop|unique|bis|residual)\b/i,
  /\b(?:drop|unique|bis|residual)\b.+\bboss\b/i,
  /\bslayer\s+(?:spear|chest|boss)\b/i,
  /\baccount\s+passive\b/i,
  /\btier-\d+/i,
  /\bmid-high\b|\bmidgame\b|\bmid-game\b|\bnear-bis\b|\bniche\s+anti-/i,
  /\bstyle-specific\b|\bstyle\s+glove\b|\bstyle\s+power\b/i,
  /\bquest-challenge\s+combat\b/i,
  /\bplayer-owned\s+farm\s+combat\b|\branch\s+out\s+of\s+time\s+combat\b/i,
];

/** Hard excludes — skilling-only rows that used to match the old word bag. */
const EXCLUDE: readonly RegExp[] = [
  /\bskilling\b(?!.*\bcombat\b)/i,
  /\b(?:firemaking|divination|thieving|hunter|herblore|runecrafting|fishing|cooking|woodcutting|farming|agility|construction|crafting|fletching|smithing|mining|invention|archaeology)\b.+\b(?:xp\s+)?ring\b/i,
  /\bring\b.+\b(?:firemaking|divination|thieving|hunter|herblore|runecrafting|fishing|cooking|woodcutting|farming|agility|skilling)\b/i,
  /\b(?:permanent\s+)?endgame\s+skilling\s+cape\b/i,
  /\bskilling\s+(?:utility\s+)?ring\b/i,
  /\bskilling\s+travel\b/i,
  /\bskilling\s+boss\b/i,
  /\barchaeology\s+monolith\b/i,
  /\bgathering\s+colony\b/i,
  /\bgatherer-relic\b/i,
  /\bresource\s+dungeon\b/i,
  /\bdungeoneering\s+(?:token|party|elite\s+skilling|resource|reward\s+gear|crafting|qol)\b/i,
  /\bherblore\s+production\s+amulet\b/i,
  /\bminigame\s+skilling\s+armour\b/i,
  /\bhunter\s+charm\s+gathering\b/i,
  /\bgathering\s+xp\s+spell\b/i,
  /\bdaemonheim\s+gathering\b/i,
];

/**
 * True when an upgrade category is deliberately classified as combat content
 * for map planner combat-unlock counts.
 */
export function isCombatUpgradeCategory(kind: string): boolean {
  const n = kind.replace(/\s+/g, " ").trim();
  if (!n) return false;
  if (EXCLUDE.some((re) => re.test(n))) return false;
  return POSITIVE.some((re) => re.test(n));
}
