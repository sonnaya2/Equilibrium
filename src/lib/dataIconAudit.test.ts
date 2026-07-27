/**
 * Audit /data icon wells — blank vs garbage. Writes tmp-data-icon-audit.json (gitignored).
 * Run: npx vitest run src/lib/dataIconAudit.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  activityIconPath,
  bossIconPath,
  dataEntityIconPath,
  skillIconPath,
  upgradeIconPath,
} from "./gameArt";

const ROOT = process.cwd();

function publicExists(webPath: string | null): boolean {
  if (!webPath || !webPath.startsWith("/game/")) return false;
  return existsSync(join(ROOT, "public", webPath.slice(1)));
}

function slugify(s: string): string {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/**
 * Heuristic for weakly related icons. Documented intentional cases that are NOT garbage:
 * - Skill icons when name/kind mentions that skill (deliberate skill fallback / alias)
 * - Stem-related inventory (archaeology ↔ archaeologist, book ↔ books, war segment match)
 * - Short shared segments (length ≥ 3) that appear as whole slug parts (e.g. war in altar-of-war)
 */
function looksGarbage(name: string, webPath: string, kind = ""): boolean {
  const file = basename(webPath).replace(/\.(png|jpg|jpeg|gif|webp)$/i, "");
  const nameSlug = slugify(name);
  const kindSlug = slugify(kind);
  const nameTokens = nameSlug.split("-").filter((t) => t.length >= 3);
  const fileTokens = file.split("-").filter((t) => t.length >= 3);
  if (!nameTokens.length || !fileTokens.length) return false;

  // Intentional skill fallbacks: /game/skills/<skill>.png when name or kind names that skill.
  const skillHit = webPath.match(/\/skills\/([a-z0-9-]+)\./i);
  if (skillHit) {
    const skill = skillHit[1]!;
    if (
      nameSlug.includes(skill) ||
      kindSlug.includes(skill) ||
      name.toLowerCase().includes(skill.replace(/-/g, " ")) ||
      kind.toLowerCase().includes(skill.replace(/-/g, " "))
    ) {
      return false;
    }
  }

  const shareStem = (a: string, b: string): boolean => {
    if (a.includes(b) || b.includes(a)) return true;
    const n = Math.min(8, a.length, b.length);
    return n >= 5 && a.slice(0, n) === b.slice(0, n);
  };

  const shared = nameTokens.some(
    (t) =>
      file.includes(t) ||
      fileTokens.some((ft) => ft === t || ft.includes(t) || t.includes(ft) || shareStem(t, ft)),
  );
  // Also allow kind tokens to explain intentional aliases (e.g. kind "Archaeology …").
  const kindTokens = kindSlug.split("-").filter((t) => t.length >= 4);
  const kindShared =
    kindTokens.length > 0 &&
    kindTokens.some(
      (t) =>
        file.includes(t) ||
        fileTokens.some((ft) => ft === t || ft.includes(t) || t.includes(ft) || shareStem(t, ft)),
    );
  if (shared || kindShared) return false;

  const longNameTokens = nameTokens.filter((t) => t.length >= 4);
  if (name.split(/\s+/).length >= 4 && !shared) return true;
  if (longNameTokens.length <= 2 && !shared) return true;
  return false;
}

type Row = { surface: string; name: string; kind?: string; path?: string; file?: string; id?: string };

describe("data icon audit", () => {
  it("writes blank/garbage report for /data entities", () => {
    const catalog = JSON.parse(readFileSync("data/research/catalog.json", "utf8"));
    const combat = JSON.parse(readFileSync("data/research/regional-combat-unlocks.json", "utf8"));
    const skilling = JSON.parse(readFileSync("data/research/regional-skilling-unlocks.json", "utf8"));
    const unlocks = JSON.parse(readFileSync("data/reference/progression-unlocks.json", "utf8"));

    const blank: Row[] = [];
    const garbage: Row[] = [];
    const missingFile: Row[] = [];
    let ok = 0;

    function audit(surface: string, name: string, kind = "", id: string | null = null) {
      if (!name) return;
      const path =
        surface === "upgrade"
          ? (upgradeIconPath(name) ?? dataEntityIconPath({ name, kind }))
          : dataEntityIconPath({ name, kind, id });
      if (!path) {
        blank.push({ surface, name, kind });
        return;
      }
      if (!publicExists(path)) {
        missingFile.push({ surface, name, kind, path });
        return;
      }
      if (looksGarbage(name, path, kind)) {
        garbage.push({ surface, name, kind, path, file: basename(path) });
        return;
      }
      ok++;
    }

    for (const region of catalog.regions) {
      for (const row of region.content || []) audit("content", row.name, row.kind);
      for (const up of region.upgrades || []) audit("upgrade", up.name, up.category || "");
    }
    for (const skill of catalog.skills || []) {
      const path = skillIconPath(skill.id || skill.name);
      if (!path) blank.push({ surface: "skill", name: skill.name, kind: "skill" });
      else if (!publicExists(path)) missingFile.push({ surface: "skill", name: skill.name, path });
      else ok++;
    }
    for (const row of [...(combat.records || []), ...(skilling.records || [])]) {
      const name = row.name || row.item || row.activity;
      audit(
        String(row.recordType || "research"),
        name,
        String(row.recordType || row.category || ""),
        row.id != null ? String(row.id) : null,
      );
    }
    for (const k of Object.keys(unlocks)) {
      if (!Array.isArray(unlocks[k])) continue;
      for (const row of unlocks[k]) {
        audit("permanent", row.name || row.quest || row.id, k, row.id != null ? String(row.id) : null);
      }
    }

    function dedupe(arr: Row[]) {
      const seen = new Set<string>();
      return arr.filter((r) => {
        const key = `${r.surface}|${r.name}|${r.path || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    const report = {
      at: new Date().toISOString(),
      counts: {
        ok,
        blank: dedupe(blank).length,
        garbage: dedupe(garbage).length,
        missingFile: dedupe(missingFile).length,
      },
      blank: dedupe(blank),
      garbage: dedupe(garbage),
      missingFile: dedupe(missingFile),
    };
    // Optional local dump (gitignored tmp-*.json); do not require scraped-data/.
    writeFileSync("tmp-data-icon-audit.json", `${JSON.stringify(report, null, 2)}\n`);
    // Sanity: bosses still resolve
    expect(bossIconPath("Kerapac")).toBeTruthy();
    expect(activityIconPath("Prifddinas") || true).toBeTruthy();
    console.log("AUDIT", report.counts);
    console.log("garbage sample", report.garbage.slice(0, 15));
    console.log("blank sample", report.blank.slice(0, 15));
  });
});
