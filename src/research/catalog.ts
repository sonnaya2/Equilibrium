import normalizedSource from "#data/research/catalog.json";
import generatedIndex from "../../public/data/v2/research/index.json";

export type SourceKind = "runescape-wiki" | "jagex" | "rs-analysis" | "pvme" | "derived";

export interface SourceReference {
  source: SourceKind;
  url: string;
  title?: string;
  revision?: string;
  publishedAt?: string;
  verifiedAt: string;
}

export interface ResearchTrainingMethod {
  id: string;
  skill: string;
  method: string;
  levelRange: string;
  xpRate: string;
  intensity: string;
  location: string;
  requirements: string[];
  requiredUnlock: string;
  resourceSource: string;
  hardRegionRequirement: boolean;
  regionHints: string[];
  note: string;
  warning: string;
  freshness: string;
  confidence: string;
  source: SourceReference | null;
}

export interface ResearchContentRow {
  name: string;
  kind: string;
  detail: string;
  confidence: string;
  source: SourceReference | null;
}

export interface ResearchUpgrade {
  name: string;
  category: string;
  detail: string;
  requirements: string[];
  confidence: string;
  source: SourceReference | null;
  regionId?: string;
  regionHints?: string[];
  requiredRegions?: string[];
  regionRequirementType?: string;
  comboLabel?: string;
  isRegionCombo?: boolean;
}

export type ResearchRawRow = Record<string, unknown>;

export interface ResearchRegionalPanel {
  skillingActivities: ResearchRawRow[];
  skillingEquipment: ResearchRawRow[];
  combatAccounts: ResearchRawRow[];
  combatActivities: ResearchRawRow[];
  combatEquipment: ResearchRawRow[];
}

export interface ResearchPanelHrefs {
  regional: string;
  unlocks: Record<string, string>;
}

export interface ResearchRegion {
  id: string;
  name: string;
  availability: string;
  aliases: string[];
  areas: string[];
  skills: string[];
  content: ResearchContentRow[];
  upgrades: ResearchUpgrade[];
  training: ResearchTrainingMethod[];
  hardRules: string[];
  warnings: string[];
  source: SourceReference | null;
  verified: boolean;
  panelHrefs?: ResearchPanelHrefs;
}

export interface ResearchSkill {
  id: string;
  name: string;
  regions: string[];
  methods: ResearchTrainingMethod[];
}

export interface ResearchDatasetStats {
  regions: number;
  relicTiers: number;
  revealedRelicTiers: number;
  blessingTiers: number;
  revealedBlessingTiers: number;
  publishedTasks: number;
  skills: number;
  trainingMethods: number;
  regionalSkillingUnlocks?: number;
  regionalSkillingActivities?: number;
  regionalSkillingEquipment?: number;
  regionalCombatUnlocks?: number;
  regionalCombatAccounts?: number;
  regionalCombatActivities?: number;
  regionalCombatEquipment?: number;
  regionalCombatCombos?: number;
  museumCollectionMatrix?: number;
  museumCollectionUnobtainable?: number;
}

export interface ResearchSourcePolicy {
  defaultGroundTruth: SourceKind;
  explicitSourceGroundTruth: SourceKind[];
  provisionalFallback: SourceKind;
  note: string;
}

export interface ResearchCatalog {
  snapshotDate: string;
  sourcePolicy: ResearchSourcePolicy;
  coverage: Record<string, string>;
  hardRules: string[];
  datasets: ResearchDatasetStats;
  regions: ResearchRegion[];
  skills: ResearchSkill[];
}

export interface ResearchRegionSummary {
  id: string;
  name: string;
  availability: string;
  training: number;
}

export interface ResearchSkillSummary {
  id: string;
  name: string;
}

export interface ResearchCatalogIndex {
  snapshotDate: string;
  regions: ResearchRegionSummary[];
  skills: ResearchSkillSummary[];
}

interface NormalizedRegion extends Omit<ResearchRegion, "training"> {
  trainingMethodIds: string[];
}

interface NormalizedCatalog extends Omit<ResearchCatalog, "regions"> {
  regions: NormalizedRegion[];
}

export function getResearchCatalogIndex(): ResearchCatalogIndex {
  return generatedIndex as ResearchCatalogIndex;
}

export function getResearchCatalog(): ResearchCatalog {
  const source = normalizedSource as NormalizedCatalog;
  const methods = new Map<string, ResearchTrainingMethod>();

  for (const skill of source.skills) {
    for (const method of skill.methods) methods.set(method.id, method);
  }

  // Drop unresolved ids quietly — catalog.test asserts orphans empty.
  const regions = source.regions.map(({ trainingMethodIds, ...region }) => ({
    ...region,
    training: trainingMethodIds
      .map((id) => methods.get(id))
      .filter((method): method is ResearchTrainingMethod => Boolean(method)),
  }));

  // Derive array-backed counts so hand-authored dataset stats cannot lie.
  return {
    ...source,
    datasets: {
      ...source.datasets,
      regions: regions.length,
      skills: source.skills.length,
      trainingMethods: methods.size,
    },
    regions,
  };
}
