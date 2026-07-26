/** GUI design tournament ledger — concepts lab only, not product IA. */

export type ConceptStatus = "contender" | "eliminated" | "winner" | "provisional";

export type AxisScores = {
  workbenchFill: number;
  categorization: number;
  readability: number;
  gameIdentity: number;
  antiSlop: number;
  operability: number;
  consistency: number;
};

export type ConceptRecord = {
  id: string;
  name: string;
  agent: "A" | "B" | "C" | "hybrid";
  bias: string;
  round: number;
  status: ConceptStatus;
  /** Weighted total 0–10; null until CEO scores. */
  score: number | null;
  axes: AxisScores | null;
  summary: string;
  wireframes: string;
  dataTree: string[];
  ceoNotes: string[];
  mustFix: string[];
};

export const PASS_BAR = 9;
export const MAX_ROUNDS = 5;
export const DEFAULT_ROUNDS = 3;

export const AXIS_WEIGHTS = {
  workbenchFill: 20,
  categorization: 20,
  readability: 15,
  gameIdentity: 15,
  antiSlop: 15,
  operability: 10,
  consistency: 5,
} as const;

/** Points on each axis are 0–weight; total /10. */
export function scoreFromAxes(axes: AxisScores): number {
  const total =
    axes.workbenchFill +
    axes.categorization +
    axes.readability +
    axes.gameIdentity +
    axes.antiSlop +
    axes.operability +
    axes.consistency;
  return Math.round(total) / 10;
}

/**
 * Round 1 CEO scores (hard pass bar 9.0).
 * Control Surface clears on categorization + fill + consistency;
 * ship debt: denser game art (crests) when promoting to production.
 */
export const TOURNAMENT: {
  currentRound: number;
  passBar: number;
  winnerId: string | null;
  concepts: ConceptRecord[];
} = {
  currentRound: 1,
  passBar: PASS_BAR,
  winnerId: "r1-control",
  concepts: [
    {
      id: "r1-lattice",
      name: "Lattice Bench",
      agent: "A",
      bias: "Hex / carved-stone commitment; lattices as navigation",
      round: 1,
      status: "eliminated",
      score: 8.2,
      axes: {
        workbenchFill: 15,
        categorization: 16,
        readability: 13,
        gameIdentity: 14,
        antiSlop: 13,
        operability: 7,
        consistency: 4,
      },
      summary:
        "League-panel workbench: hex-rail category pickers, carved panels, full-width main stage with mount-active tabs.",
      wireframes: `OVERVIEW  [status strip full width] [systems table]
MAP       [hex pick strip] | [board fills height] | [inspector]
TASKS     [tier hexes] [filters] [table + detail]
BUILD     [Regions|Relics|Blessings|Share segments as hex row]
COMBAT    [existing 5 tabs, gem active]
DATA      [primary lattice tabs] → only active research mounts`,
      dataTree: [
        "Browse (region/skill browser)",
        "Progression",
        "Permanent unlocks",
        "Consumables",
        "Systems",
        "Crafting (Arch + Masterwork)",
        "Boundaries",
      ],
      ceoNotes: [
        "Strong RS identity — diamond rail and carved cells read league-panel.",
        "Data tabs are correct; Crafting merge is good IA.",
        "Fill is weaker: map preview works, but Build is a card garden not a stage.",
        "Operability: preview switcher is lab chrome, not product pattern.",
        "Kill: not enough head-still inspector pairing on Data; stops at 8.2.",
      ],
      mustFix: [
        "Pair table with inspector on Data",
        "Build segment must fill height like map board",
        "One shell language for all six routes",
      ],
    },
    {
      id: "r1-wartable",
      name: "War Table",
      agent: "B",
      bias: "Full-bleed board-first bones; rail + stage everywhere",
      round: 1,
      status: "eliminated",
      score: 8.7,
      axes: {
        workbenchFill: 18,
        categorization: 18,
        readability: 13,
        gameIdentity: 12,
        antiSlop: 14,
        operability: 8,
        consistency: 4,
      },
      summary:
        "Generalize the map topology: left rail categories, center stage fills the viewport, side inspector for the active record.",
      wireframes: `SHELL     left rail (route sections) | stage (flex-1) | optional inspector
OVERVIEW  rail: Status/Systems | stage: dense tables
MAP       rail: picks+filters | stage: board | inspector: region
TASKS     rail: tiers | stage: task table | inspector: task
BUILD     rail: Regions/Relics/Blessings | stage: lattice | share strip
COMBAT    rail: 5 modes | stage: calculator
DATA      rail: research categories | stage: active browser only`,
      dataTree: [
        "Browse",
        "Progression",
        "Unlocks",
        "Consumables",
        "Systems",
        "Archaeology supply",
        "Masterwork staff",
        "Boundary rules",
      ],
      ceoNotes: [
        "Best fill of the three — rail/stage/inspector is the right skeleton.",
        "Categorization is clear; inactive categories never mount.",
        "Identity is thinner: could be any dark tool without crests/hex.",
        "Readability fine; no key-number hierarchy in inspector.",
        "Kill: 8.7 — ship DNA is good, needs Control’s tree depth + Lattice art.",
      ],
      mustFix: [
        "Raise game identity (crests, hex where structural)",
        "Key figure ≥20px in inspector",
        "Keep Arch/Masterwork split or justify merge",
      ],
    },
    {
      id: "r1-control",
      name: "Control Surface",
      agent: "C",
      bias: "Pro-tool: system tree + main table + right inspector",
      round: 1,
      status: "winner",
      score: 9.1,
      axes: {
        workbenchFill: 18,
        categorization: 19,
        readability: 14,
        gameIdentity: 12,
        antiSlop: 14,
        operability: 9,
        consistency: 5,
      },
      summary:
        "Three-column control surface on every heavy route. Tree selects category, table lists records, inspector holds the selected row. Max density, shared shell.",
      wireframes: `SHELL     [tree 220] [table flex] [inspector 300] under full-width top tabs
OVERVIEW  tree: League systems | table: facts | inspector: sources
MAP       ledger as tree; board as stage; inspector stays
TASKS     tree: difficulty | table: tasks | inspector: notes
BUILD     top segments or tree; middle grids; inspector: selection
COMBAT    top tabs; three-col loadout where useful
DATA      tree = research categories; only active leaf mounts tables`,
      dataTree: [
        "Browse › Regions / Skills",
        "Progression › tracks",
        "Unlocks",
        "Consumables › types",
        "Systems",
        "Crafting › Arch / Masterwork",
        "Boundaries",
      ],
      ceoNotes: [
        "Pass 9.1 — categorization and route consistency clear the bar.",
        "Filter + three columns = head-still and mount-active-only.",
        "Key figure panel hits the 20px floor.",
        "Identity is the soft spot (12/15): production must use crests/icons, not gray tree alone.",
        "bot-audit: no hero, no glow, gem active, gold title only — PASSES.",
      ],
      mustFix: [
        "Production: inject GameIcon / region crests into tree and rows",
        "Map: do not force three columns over the board — ledger owns picks",
        "Shell: replace max-w-6xl with fluid workbench width",
      ],
    },
  ],
};
