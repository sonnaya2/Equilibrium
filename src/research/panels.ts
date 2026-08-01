import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ResearchRegion } from "./catalog";
import { researchRowMatchesRegion, type ResearchRow } from "./regionMatch";

/**
 * The /data region panels, built from SQLite rather than shipped as JSON.
 *
 * These used to be 100 files under public/data/v2/research. They are the same
 * rows, filtered the same way; the difference is that the database is the only
 * copy and the route handlers below render from it at build time.
 */

export const UNLOCK_SECTIONS = [
  "quest_unlocks",
  "ability_unlocks",
  "prayer_unlocks",
  "account_unlocks",
  "activity_unlocks",
  "equipment_models",
  "consumable_unlocks",
] as const;
export type UnlockSection = (typeof UNLOCK_SECTIONS)[number];

// Later passes added these without merging them back into the base document.
const EQUIPMENT_MODEL_SUPPLEMENTS = [
  "data/reference/progression-support-items-2026-07-25.json",
  "data/reference/progression-container-bags-2026-07-25.json",
];

export interface RegionalPanel {
  skillingActivities: ResearchRow[];
  skillingEquipment: ResearchRow[];
  combatAccounts: ResearchRow[];
  combatActivities: ResearchRow[];
  combatEquipment: ResearchRow[];
}

function open(): DatabaseSync {
  return new DatabaseSync(join(process.cwd(), ".cache/equilibrium.sqlite"), { readOnly: true });
}

// A row whose entity was retired as a duplicate is the record the survivor
// already shows, so it is left out. A row that never became an entity has no
// survivor to defer to and stays.
function sourceSection(db: DatabaseSync, file: string, section: string): ResearchRow[] {
  const pattern = new RegExp(`^\\$\\.${section}\\[(\\d+)\\]$`);
  return (
    db
      .prepare(
        `SELECT source_records.record_path, source_records.raw_json
         FROM source_records
         LEFT JOIN entities ON entities.id = source_records.entity_id
         WHERE source_records.source_file = ?
           AND (source_records.entity_id IS NULL OR entities.status <> 'removed')
         ORDER BY source_records.record_path`,
      )
      .all(file) as unknown as Array<{ record_path: string; raw_json: string }>
  )
    .map((row) => ({ index: pattern.exec(row.record_path)?.[1], raw: row.raw_json }))
    .filter((row): row is { index: string; raw: string } => row.index !== undefined)
    .sort((a, b) => Number(a.index) - Number(b.index))
    .map((row) => JSON.parse(row.raw) as ResearchRow);
}

// Supplements can restate a base row; the first stable key wins so a record
// never appears twice in one panel.
function rowKey(row: ResearchRow, index: number, prefix: string): string {
  if (row.id != null && row.id !== "") return String(row.id);
  if (typeof row.name === "string" && row.name) return `${prefix}:${row.name}`;
  if (typeof row.quest === "string" && row.quest) return `${prefix}:${row.quest}`;
  return `${prefix}:${index}`;
}

type RegionScope = Pick<ResearchRegion, "id" | "name" | "aliases">;

export function getRegionalPanel(region: RegionScope): RegionalPanel {
  const db = open();
  try {
    const skilling = sourceSection(db, "data/research/regional-skilling-unlocks.json", "records");
    const combat = sourceSection(db, "data/research/regional-combat-unlocks.json", "records");
    const inRegion = (rows: ResearchRow[], recordType: string) =>
      rows.filter((row) => row.recordType === recordType && researchRowMatchesRegion(row, region));
    return {
      skillingActivities: inRegion(skilling, "activity"),
      skillingEquipment: inRegion(skilling, "equipment"),
      combatAccounts: inRegion(combat, "account"),
      combatActivities: inRegion(combat, "activity"),
      combatEquipment: inRegion(combat, "equipment"),
    };
  } finally {
    db.close();
  }
}

export function getUnlockPanel(region: RegionScope, section: UnlockSection): ResearchRow[] {
  const db = open();
  try {
    const rows = new Map<string, ResearchRow>();
    sourceSection(db, "data/reference/progression-unlocks.json", section).forEach((row, index) =>
      rows.set(rowKey(row, index, "base"), row),
    );
    if (section === "equipment_models") {
      for (const file of EQUIPMENT_MODEL_SUPPLEMENTS) {
        sourceSection(db, file, section).forEach((row, index) =>
          rows.set(rowKey(row, index, "supplement"), row),
        );
      }
    }
    return [...rows.values()].filter((row) => researchRowMatchesRegion(row, region));
  } finally {
    db.close();
  }
}
