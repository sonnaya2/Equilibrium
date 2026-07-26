/**
 * Apply machine patches from scraped-data/patch-*-2026-07-26.json
 * Sequential merge into catalog.json, regions.json, placeAnchors.ts
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const catalogPath = path.join(root, "data/research/catalog.json");
const leaguePath = path.join(root, "data/league/regions.json");
const anchorsPath = path.join(root, "src/map/data/placeAnchors.ts");

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const league = JSON.parse(fs.readFileSync(leaguePath, "utf8"));
let anchorsSrc = fs.readFileSync(anchorsPath, "utf8");

const patchFiles = process.argv.slice(2);
if (!patchFiles.length) {
  const dir = path.join(root, "scraped-data");
  for (const f of fs.readdirSync(dir).sort()) {
    if (/^patch-.*-2026-07-26\.json$/.test(f)) patchFiles.push(path.join(dir, f));
  }
}

function region(id) {
  const r = catalog.regions.find((x) => x.id === id);
  if (!r) throw new Error(`missing region ${id}`);
  return r;
}

function findUpgrade(r, name) {
  return r.upgrades.findIndex((u) => u.name === name);
}

function findContent(r, name) {
  return r.content.findIndex((c) => c.name === name);
}

const log = [];

function applyOp(op, patchId) {
  const tag = `${patchId}:${op.op}`;
  switch (op.op) {
    case "setAreas": {
      const r = region(op.regionId);
      r.areas = [...op.areas];
      log.push(`${tag} ${op.regionId} → ${op.areas.length} areas`);
      break;
    }
    case "mergeAreas": {
      const r = region(op.regionId);
      const set = new Set(r.areas);
      for (const a of op.areas || []) set.add(a);
      r.areas = [...set];
      log.push(`${tag} ${op.regionId} merge → ${r.areas.length}`);
      break;
    }
    case "addHardRule": {
      const r = region(op.regionId);
      if (!r.hardRules) r.hardRules = [];
      if (!r.hardRules.includes(op.rule)) r.hardRules.push(op.rule);
      log.push(`${tag} ${op.regionId}`);
      break;
    }
    case "removeUpgrade": {
      const r = region(op.regionId);
      // removeAllDuplicates: strip every same-name copy in the region
      if (op.removeAllDuplicates || op.all) {
        const before = r.upgrades.length;
        r.upgrades = r.upgrades.filter((u) => u.name !== op.name);
        log.push(`${tag} ${op.regionId} −${before - r.upgrades.length} ${op.name}`);
      } else {
        const i = findUpgrade(r, op.name);
        if (i >= 0) {
          r.upgrades.splice(i, 1);
          log.push(`${tag} ${op.regionId} − ${op.name}`);
        } else log.push(`${tag} MISS ${op.regionId} ${op.name}`);
      }
      break;
    }
    case "removeUpgradeByNameAllHosts": {
      let c = 0;
      for (const r of catalog.regions) {
        const before = r.upgrades.length;
        r.upgrades = r.upgrades.filter((u) => u.name !== op.name);
        c += before - r.upgrades.length;
      }
      log.push(`${tag} −${c} all-hosts ${op.name}`);
      break;
    }
    case "dedupeUpgradeName": {
      const r = region(op.regionId);
      const same = r.upgrades.filter((u) => u.name === op.name);
      if (same.length <= 1) {
        log.push(`${tag} ok ${op.regionId} ${op.name}`);
        break;
      }
      same.sort(
        (a, b) => String(b.detail || "").length - String(a.detail || "").length,
      );
      const keep = same[0];
      let seen = false;
      r.upgrades = r.upgrades.filter((u) => {
        if (u.name !== op.name) return true;
        if (!seen) {
          seen = true;
          Object.assign(u, keep);
          return true;
        }
        return false;
      });
      log.push(`${tag} ${op.regionId} ${op.name} kept 1 of ${same.length}`);
      break;
    }
    case "renameUpgrade": {
      const r = region(op.regionId);
      let n = 0;
      for (const u of r.upgrades) {
        if (u.name === op.from) {
          u.name = op.to;
          n++;
          if (op.set) Object.assign(u, op.set);
        }
      }
      log.push(`${tag} ${op.regionId} ${op.from} → ${op.to} (${n})`);
      break;
    }
    case "upsertUpgrade": {
      const r = region(op.regionId);
      const i = findUpgrade(r, op.upgrade.name);
      const u = { ...op.upgrade, regionId: op.upgrade.regionId || op.regionId };
      if (i >= 0) r.upgrades[i] = { ...r.upgrades[i], ...u };
      else r.upgrades.push(u);
      log.push(`${tag} ${op.regionId} ${u.name}`);
      break;
    }
    case "editUpgrade": {
      const r = region(op.regionId);
      const i = findUpgrade(r, op.name);
      if (i < 0) {
        log.push(`${tag} MISS ${op.regionId} ${op.name}`);
        break;
      }
      Object.assign(r.upgrades[i], op.set || {});
      log.push(`${tag} ${op.regionId} ${op.name}`);
      break;
    }
    case "ensureUpgradeOnHome": {
      const r = region(op.regionId);
      let i = findUpgrade(r, op.name);
      if (i < 0 && op.copyFromRegion) {
        const src = region(op.copyFromRegion);
        const j = findUpgrade(src, op.name);
        if (j >= 0) {
          r.upgrades.push({
            ...JSON.parse(JSON.stringify(src.upgrades[j])),
            regionId: op.regionId,
            ...(op.set || {}),
          });
          log.push(`${tag} copied ${op.name} → ${op.regionId}`);
          break;
        }
      }
      if (i < 0) {
        log.push(`${tag} MISSING on home ${op.regionId} ${op.name}`);
        break;
      }
      Object.assign(r.upgrades[i], op.set || {}, { regionId: op.regionId });
      log.push(`${tag} ${op.regionId} ${op.name}`);
      break;
    }
    case "moveUpgrade": {
      const from = region(op.fromRegionId);
      const to = region(op.toRegionId);
      const i = findUpgrade(from, op.name);
      if (i < 0) {
        log.push(`${tag} MISS from ${op.fromRegionId} ${op.name}`);
        break;
      }
      const [u] = from.upgrades.splice(i, 1);
      Object.assign(u, op.set || {}, { regionId: op.toRegionId });
      const j = findUpgrade(to, u.name);
      if (j >= 0) to.upgrades[j] = { ...to.upgrades[j], ...u };
      else to.upgrades.push(u);
      log.push(`${tag} ${op.fromRegionId} → ${op.toRegionId} ${op.name}`);
      break;
    }
    case "addContent": {
      const r = region(op.regionId);
      if (findContent(r, op.content.name) >= 0) {
        log.push(`${tag} skip dup ${op.content.name}`);
        break;
      }
      r.content.push(op.content);
      log.push(`${tag} ${op.regionId} + ${op.content.name}`);
      break;
    }
    case "removeContent": {
      const r = region(op.regionId);
      const i = findContent(r, op.name);
      if (i >= 0) {
        r.content.splice(i, 1);
        log.push(`${tag} ${op.regionId} − ${op.name}`);
      }
      break;
    }
    case "editContent": {
      const r = region(op.regionId);
      const i = findContent(r, op.name);
      if (i >= 0) Object.assign(r.content[i], op.set || {});
      break;
    }
    case "upsertAnchor": {
      // Handled in second pass on anchors string
      break;
    }
    case "removeAnchor": {
      break;
    }
    case "note":
    case "questRetag":
      log.push(`${tag} ${JSON.stringify(op).slice(0, 120)}`);
      break;
    default:
      log.push(`UNKNOWN op ${op.op}`);
  }
}

// Collect anchors
const anchorOps = [];

for (const file of patchFiles) {
  if (!fs.existsSync(file)) {
    console.warn("skip missing", file);
    continue;
  }
  const patch = JSON.parse(fs.readFileSync(file, "utf8"));
  const id = patch.id || path.basename(file);
  const ops = patch.ops || patch.operations || [];
  console.log("Applying", id, ops.length, "ops");
  for (const op of ops) {
    if (op.op === "upsertAnchor" || op.op === "removeAnchor") {
      anchorOps.push({ ...op, patchId: id });
      continue;
    }
    try {
      applyOp(op, id);
    } catch (e) {
      log.push(`ERR ${id} ${op.op}: ${e.message}`);
    }
  }
}

// Sync league areas from catalog
for (const rec of league.records) {
  const cat = catalog.regions.find((x) => x.id === rec.id);
  if (cat) rec.areas = [...cat.areas];
}

// Apply anchors
function upsertAnchorLine(region, area, uv) {
  const re = new RegExp(
    `\\{ region: "${region}", area: "${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}", uv: \\[[^\\]]+\\] \\},?`,
  );
  const line = `  { region: "${region}", area: "${area}", uv: [${uv[0]}, ${uv[1]}] },`;
  if (re.test(anchorsSrc)) {
    anchorsSrc = anchorsSrc.replace(re, line);
    log.push(`anchor update ${region}/${area}`);
    return;
  }
  // Insert after last anchor of same region
  const regionRe = new RegExp(
    `(\\{ region: "${region}", area: "[^"]+", uv: \\[[^\\]]+\\] \\},)\\n(?!  \\{ region: "${region}")`,
  );
  if (regionRe.test(anchorsSrc)) {
    anchorsSrc = anchorsSrc.replace(regionRe, `$1\n${line}\n`);
    log.push(`anchor insert ${region}/${area}`);
    return;
  }
  // Fallback: before closing of PLACE_ANCHORS
  anchorsSrc = anchorsSrc.replace(
    /\n\];\n\nexport const PLACES_BY_REGION/,
    `\n${line}\n];\n\nexport const PLACES_BY_REGION`,
  );
  log.push(`anchor append ${region}/${area}`);
}

function removeAnchorLine(region, area) {
  const re = new RegExp(
    `\\n\\s*\\{ region: "${region}", area: "${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}", uv: \\[[^\\]]+\\] \\},?`,
  );
  if (re.test(anchorsSrc)) {
    anchorsSrc = anchorsSrc.replace(re, "\n");
    log.push(`anchor remove ${region}/${area}`);
  }
}

for (const op of anchorOps) {
  if (op.op === "upsertAnchor") upsertAnchorLine(op.region, op.area, op.uv);
  if (op.op === "removeAnchor") removeAnchorLine(op.region, op.area);
}

// Ensure every catalog area has an anchor entry — report gaps only
const anchorAreas = new Map();
for (const m of anchorsSrc.matchAll(/region: "([^"]+)", area: "([^"]+)"/g)) {
  if (!anchorAreas.has(m[1])) anchorAreas.set(m[1], new Set());
  anchorAreas.get(m[1]).add(m[2]);
}
for (const r of catalog.regions) {
  const have = anchorAreas.get(r.id) || new Set();
  const miss = r.areas.filter((a) => !have.has(a));
  if (miss.length) log.push(`ANCHOR GAP ${r.id}: ${miss.join(", ")}`);
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
fs.writeFileSync(leaguePath, JSON.stringify(league, null, 2) + "\n");
fs.writeFileSync(anchorsPath, anchorsSrc);

console.log("\n--- log ---");
for (const line of log) console.log(line);
console.log("\nDone. Patches:", patchFiles.length);
