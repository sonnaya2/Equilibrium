/** GUI design tournament ledger — concepts lab only, not product IA. */

export type ConceptStatus = "contender" | "eliminated" | "winner" | "provisional";

export type ConceptAgent =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "hybrid";

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
  agent: ConceptAgent;
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
export const MAX_ROUNDS = 6;
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
 * GUI tournament ledger through R4 production lanes.
 *
 * R1 Control Surface (9.1) remains layout DNA (tree · table · inspector).
 * R2–R3 never cleared the 9.0 pass bar; closest is Hybrid Full at 8.9.
 * Tournament winnerId stays null until a later round hits ≥9 (or production
 * acceptance closes the 0.1 gap). Production color ship after R3 guidance
 * landed in app/globals.css (@theme surface ladder + parch micro + .data-table).
 */
export const TOURNAMENT: {
  currentRound: number;
  passBar: number;
  winnerId: string | null;
  layoutDnaId: string;
  concepts: ConceptRecord[];
} = {
  currentRound: 4,
  passBar: PASS_BAR,
  winnerId: null,
  layoutDnaId: "r1-control",
  concepts: [
    // ── Round 1 · shell ──────────────────────────────────────────────
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
        "Three-column control surface on every heavy route. Tree selects category, table lists records, inspector holds the selected row. Max density, shared shell. Still layout DNA for all later rounds.",
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
        "R2–R4: remains layout DNA even while tournament winnerId is null (color rounds under 9).",
      ],
      mustFix: [
        "Production: inject GameIcon / region crests into tree and rows",
        "Map: do not force three columns over the board — ledger owns picks",
        "Shell: replace max-w-6xl with fluid workbench width",
      ],
    },

    // ── Round 2 · color / readability ────────────────────────────────
    {
      id: "r2-parchment",
      name: "Parchment Lift",
      agent: "D",
      bias: "Ink-first: lift parch ramp, leave stone grounds almost untouched",
      round: 2,
      status: "eliminated",
      score: 6.9,
      axes: {
        workbenchFill: 12,
        categorization: 13,
        readability: 11,
        gameIdentity: 10,
        antiSlop: 14,
        operability: 6,
        consistency: 3,
      },
      summary:
        "Keep warm stone grounds; lift the whole parch ink ramp so muted labels clear contrast without blue chrome or pink. Fixture mock only — proposal ink inline.",
      wireframes: `DATA      [tabs] [table + thin inspector] + lab swatch strip
SHELL     incomplete — no tree rail; two-column stage only
SHIP MAP  five @theme parch lines (smallest production risk)`,
      dataTree: ["Data tabs only (no system tree)", "Fixture rows", "Before/after swatch strip (lab)"],
      ceoNotes: [
        "Ship path is the best of the three (five @theme parch lines) — smallest production risk.",
        "Smallest visible readability win on primary body; lifts quiet end more than the scan end.",
        "Swatch strip is good lab evidence, bad workbench fill.",
        "Secondary table ink still treats region/tier as muted row.",
        "Eliminated: not enough shell, not enough scan lift, not a 9-candidate.",
      ],
      mustFix: [
        "Restore full tree · table · inspector shell; drop or collapse swatch strip from the work stage",
        "Pair any parch lift with zebra + sticky opaque thead (Wiki Dense table law)",
        "Secondary table cells use body-secondary ink (parch-100), not muted mid steps",
      ],
    },
    {
      id: "r2-raised",
      name: "Raised Bench",
      agent: "E",
      bias: "Surface-first: lift panels under existing parch; void stays dark",
      round: 2,
      status: "contender",
      score: 8.4,
      axes: {
        workbenchFill: 17,
        categorization: 18,
        readability: 12,
        gameIdentity: 10,
        antiSlop: 14,
        operability: 8,
        consistency: 5,
      },
      summary:
        "Full Control Surface shell with raised stage/rail so parch punches. Correct diagnosis (brown-on-brown is ground), but mid-stage overshoots toward SaaS desk.",
      wireframes: `SHELL     tree | stage (table on raised fill) | inspector
DATA      full CS tree · filter · sticky thead · selection outline
SURFACES  void #0d0a07 | stage #32291e | raised #3a3024 (too warm for ship)`,
      dataTree: [
        "Route TREE (Control Surface depth)",
        "Data leaves mount-active",
        "Filter + table + inspector",
      ],
      ceoNotes: [
        "Best overall shell of round 2; inherits Control Surface DNA correctly.",
        "Correct problem statement: raise the bench under existing parch rather than bleaching text first.",
        "Identity soft spot is real — overshot mid-brown can fail still looks like RS3.",
        "Readability strong but Wiki Dense type/zebra beats it on pure table scan.",
        "Contender, not winner: 8.4 is honest; needs hybrid readability law + dialed surface stops.",
      ],
      mustFix: [
        "Pull stage/rail hexes back so void and rails stay league-dark; meter contrast",
        "Adopt Wiki Dense table law: 15px body, 12px bright headers, zebra or hairline, sticky opaque head",
        "Map surfaces into @theme (stone reassignment or bench-*); no production inline hex",
        "Inject GameIcon / region crests into tree and rows",
      ],
    },
    {
      id: "r2-wiki",
      name: "Wiki Dense",
      agent: "F",
      bias: "Type + table law: 15px body, zebra, sticky opaque head, existing tokens",
      round: 2,
      status: "contender",
      score: 7.9,
      axes: {
        workbenchFill: 16,
        categorization: 13,
        readability: 14,
        gameIdentity: 11,
        antiSlop: 14,
        operability: 7,
        consistency: 4,
      },
      summary:
        "RuneScape Wiki dark-mode move on Control Surface skeleton: higher body luminance roles, zebra, 15px data, 12px labels. Best pure scan of R2; incomplete tree.",
      wireframes: `SHELL     three columns; type-scale legend is lab chrome
TABLE     15px parch-50 body · 12px parch-100 headers · zebra 900/950
THEAD     sticky opaque · gem selection outline · key ≥20px`,
      dataTree: [
        "Four Data tabs (incomplete vs CS tree)",
        "Decorative tree leaves (not fully wired)",
        "Dense fixture table",
      ],
      ceoNotes: [
        "Wins the readability axis cleanly; table law ships regardless of topology winner.",
        "Does not invent a second palette — re-applies production parch/stone with better roles.",
        "Categorization and tree interactivity underbaked relative to Raised Bench.",
        "Type-scale legend is good lab pedagogy; product would omit it.",
        "Stops short of 9: shell completeness and game art density still soft.",
      ],
      mustFix: [
        "Wire full Control Surface system tree; mount-active-only leaves",
        "Promote zebra + sticky + 15px body into .data-table / globals as the readability contract",
        "Crests/icons in dense rows; keep void dark if hybridizing with Raised Bench surfaces",
      ],
    },

    // ── Round 3 · hybrid ─────────────────────────────────────────────
    {
      id: "r3-stage",
      name: "Hybrid Stage",
      agent: "G",
      bias: "Stage-only lift + Wiki Dense; rail stays dark; best desk-discipline",
      round: 3,
      status: "contender",
      score: 8.1,
      axes: {
        workbenchFill: 16.5,
        categorization: 15.5,
        readability: 12.5,
        gameIdentity: 11,
        antiSlop: 13.5,
        operability: 7.5,
        consistency: 4.5,
      },
      summary:
        "Raised Bench shell with only the table stage lifted; rail stays darker than stage. Wiki Dense type law + partial crests. Right diagnosis, under-built proof.",
      wireframes: `SHELL     tree (dark rail) | stage #201a12 under table | inspector
DATA      filter · tabs · tree · row select (Data-only surface)
CRESTS    row + inspector; only 2 tree crests`,
      dataTree: [
        "Route TREE (structure complete)",
        "No region subtree",
        "Leaf switch cosmetic (same fixture table)",
      ],
      ceoNotes: [
        "Right diagnosis, under-built proof — lift only the table stage is correct surface strategy.",
        "Stage #201a12 under-delivers scan — move toward Full’s #231c14 without raising the rail.",
        "Dark rail is binding law (#14100b–#1c1711); do not re-raise rails to R2 desk fills.",
        "Crest debt half-paid — rows yes, tree almost no.",
        "Micro parch ramp is the production default — safer than Ink’s larger bleach.",
      ],
      mustFix: [
        "Raise stage toward #231c14 (not #201a12) while keeping rail #14100b–#1c1711",
        "Crest density: region tree + every region-bearing row",
        "Add Build segment proof or defer to Full ship path",
      ],
    },
    {
      id: "r3-ink",
      name: "Hybrid Ink",
      agent: "H",
      bias: "Ink-first + full CS + crests; production-dark stone; no mid-brown stage",
      round: 3,
      status: "contender",
      score: 8.5,
      axes: {
        workbenchFill: 15.5,
        categorization: 18.5,
        readability: 11.5,
        gameIdentity: 13.5,
        antiSlop: 13,
        operability: 8.5,
        consistency: 4.5,
      },
      summary:
        "Production-dark stone, bright parch ramp, full Control Surface, all 11 region crests in tree. Best categorization/art density; void still holds table text.",
      wireframes: `SHELL     tree (11-region subtree) | void-held table | inspector
DATA      richest interactivity; region-scoped filter
BUILD     no lattice / picks demo`,
      dataTree: [
        "Full route TREE",
        "11-region subtree on Data/Build/Map leaves",
        "Region-scoped filter",
      ],
      ceoNotes: [
        "Best categorization and crest density — steal the region tree wholesale for production.",
        "Ink-first cannot win alone; R2 Parchment Lift already died at 6.9.",
        "Secondary-cell law is correct — parch-100 for region/note; never parch-300 as body.",
        "Proposal parch slightly chalk-adjacent at #f3ebd9 — prefer Full micro body with strong secondary.",
        "Useful as a partial donor, not a ship winner — pair tree/crests with Full’s surface ladder.",
      ],
      mustFix: [
        "Add stage under dense data — ink alone already failed R2 at 6.9",
        "Do not ship as ink-only @theme patch",
        "Keep secondary-cell parch-100 law; adopt Full/Stage surface ladder",
      ],
    },
    {
      id: "r3-full",
      name: "Hybrid Full",
      agent: "I",
      bias: "One system: surface + ink + type + crests + Data⇄Build; closest to ship",
      round: 3,
      status: "contender",
      score: 8.9,
      axes: {
        workbenchFill: 18.5,
        categorization: 17.5,
        readability: 13.5,
        gameIdentity: 12.5,
        antiSlop: 13,
        operability: 9.5,
        consistency: 4.5,
      },
      summary:
        "Hybrid brief assembled: Control Surface shell, dialed stage under table, Wiki Dense law, crests, Data⇄Build. Closest to ship at 8.9 (0.1 under bar). R4 ships this DNA into production, not another mock fork.",
      wireframes: `SHELL     tree 220 | stage #231c14 under table | inspector ~300
DATA⇄BUILD segment strip · filter · picks N/3 · Build lattice height
SURFACES  void #0d0a07 · rail #1c1711 · stage #231c14 · raised (dial to #2a2218)`,
      dataTree: [
        "Data primary strip + filtered tree",
        "Build Regions | Relics | Blessings | Share",
        "Mount-active leaf (fixture-static catalog debt)",
      ],
      ceoNotes: [
        "Wins the hybrid brief — only concept that proves Data and Build under one void/shell/gem law with a real stage panel.",
        "Readability is the R3 ceiling: stage + Wiki Dense + secondary bright cells.",
        "Raised fill one step too warm (#2c241a) — dial to #2a2218 to close the 0.1 identity gap.",
        "Tree identity incomplete: row crests paid; leaf crests mostly placeholders — Ink solved 11-region tree.",
        "Ship this DNA, not another mock — promote tokens + .data-table + crests in one PR.",
      ],
      mustFix: [
        "Dial raised from #2c241a → #2a2218; keep stage #231c14 or micro-drop to #221b13 if desk-brown",
        "Pay tree crest debt (not only name-cell crests + empty 14px boxes)",
        "Ship via @theme + .data-table — no permanent inline H palette",
        "Mount-active must change real content, not only leaf label on same FIXTURE table",
      ],
    },

    // ── Round 4 · production lanes (scores pending) ──────────────────
    {
      id: "r4-data",
      name: "Data scan lane",
      agent: "J",
      bias: "Production polish: ResearchBrowser / ResearchSection size + zebra ladder",
      round: 4,
      status: "contender",
      score: null,
      axes: null,
      summary:
        "Production lane — Data route research surfaces only. 15px body, 12px headers, zebra odd rows, parch-50/100 ladder. No workbench mount changes. CEO scores not filed yet.",
      wireframes: `DATA      ResearchBrowser tables · ResearchSection shells
LAW       15px body parch-50 · secondary parch-100 · thead 12px · zebra
SCOPE     no DataWorkbench host changes; no new tokens`,
      dataTree: [
        "ResearchBrowser method + content tables",
        "ResearchSection shared shell (Slayer, Invention, …)",
        "PermanentUnlock + Progression custom shells",
      ],
      ceoNotes: [
        "Placeholder entry — r4/scores.json not ready.",
        "Notes: src/concepts/r4/agent-j-notes.md",
      ],
      mustFix: [
        "Await CEO scoring against production after token ship",
        "Confirm mount-active leaves remount real catalogs (open R3 debt)",
      ],
    },
    {
      id: "r4-combat-tasks",
      name: "Combat + Tasks ink",
      agent: "K",
      bias: "Production polish: Combat tabs + Task records ink/size floors",
      round: 4,
      status: "contender",
      score: null,
      axes: null,
      summary:
        "Production lane — Combat + Tasks ink only. Data ≥14px parch-50/100; labels parch-100; no layout redesign. CEO scores not filed yet.",
      wireframes: `COMBAT    Quick · Build · Analysis · Rotation · Revolution ink floors
TASKS     filter chips · description · requirements meta
SHARED    NumberField label/input ladder`,
      dataTree: [
        "Combat tabs (5)",
        "TaskRecords",
        "NumberField shared",
      ],
      ceoNotes: [
        "Placeholder entry — r4/scores.json not ready.",
        "Notes: src/concepts/r4/agent-k-notes.md",
      ],
      mustFix: [
        "Await CEO scoring",
        "Keep CombatTabs gem-active pattern unchanged",
      ],
    },
    {
      id: "r4-shell",
      name: "Shell + Build + Map",
      agent: "L",
      bias: "Production polish: Nav, Build planner, Map DOM rail/inspector, Overview",
      round: 4,
      status: "contender",
      score: null,
      axes: null,
      summary:
        "Production lane — shell contrast on Nav, Build, Map ledger/inspector, Overview. Secondary body off parch-400/500 onto 100/300. No three.js. CEO scores not filed yet.",
      wireframes: `NAV       inactive links parch-100 (active gem)
BUILD     segments · lattice captions · inspector dt
MAP DOM   RegionLedger + RegionInspector (no canvas)`,
      dataTree: [
        "Nav six links (frozen names)",
        "BuildPlanner Regions/Relics/Blessings/Share",
        "RegionLedger + RegionInspector",
        "Overview status strip",
      ],
      ceoNotes: [
        "Placeholder entry — r4/scores.json not ready.",
        "Notes: src/concepts/r4/agent-l-notes.md",
        "Frozen e2e strings preserved (EQUILIBRIUM, Clear picks, 0/3).",
      ],
      mustFix: [
        "Await CEO scoring",
        "Do not break Playwright-frozen accessible names",
      ],
    },
  ],
};
