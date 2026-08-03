import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolveRewardIcon, presentContentRewards } from './dataContentPresentation';
import { dataEntityIconPath, upgradeIconPath } from './gameArt';
import { resolveRewardIconLabel } from './rewardIconAliases';
import { contentRewardsFull } from './researchRewards';
import { readFileSync } from 'node:fs';

const PUBLIC = join(process.cwd(), 'public');
const CATALOG_FILE = 'data/research/catalog.json';
const canonical = (name: string) =>
  readFileSync(join(process.cwd(), 'data/canonical/provenance', name), 'utf8')
    .split('\n').filter(Boolean).map((line) => JSON.parse(line));

function reconstructCatalog(): any {
  const document = canonical('source-documents.jsonl').find(({ path }) => path === CATALOG_FILE);
  const catalog = structuredClone(document.skeleton);
  const records = canonical('source-records.jsonl')
    .filter(({ sourceFile }) => sourceFile === CATALOG_FILE)
    .sort((a, b) => String(a.recordPath).localeCompare(String(b.recordPath), 'en'));
  for (const { recordPath, record } of records) {
    const tokens = [...String(recordPath).matchAll(/\.([^.[\]]+)|\[(\d+)\]/g)].map((match) =>
      match[1] === undefined ? Number(match[2]) : match[1],
    );
    let target = catalog as any;
    for (const token of tokens.slice(0, -1)) target = target[token];
    target[tokens.at(-1)!] = record;
  }
  return catalog;
}

describe('salve amulet icons', () => {
  it('reward + entity resolve to salve amulet inventory, never elder-overload-salve', () => {
    const equip = '/game/combat/equipment/salve-amulet-e.webp';
    expect(resolveRewardIconLabel('Salve amulet (e)')).toBe(equip);
    expect(resolveRewardIcon('Salve amulet (e)')).toBe(equip);
    expect(resolveRewardIcon('Salve amulet')).toBe(equip);
    expect(resolveRewardIcon('Salve amulet (e)')).not.toMatch(/elder-overload/);
    expect(dataEntityIconPath({ name: 'Abandoned Mine salve shard mining' })).toBe(equip);
    expect(dataEntityIconPath({ name: 'Salve amulet (e)' })).toBe(equip);
    expect(dataEntityIconPath({ name: 'Salve amulet (base)' })).toMatch(/salve-amulet\.webp$/);
    expect(existsSync(join(PUBLIC, equip.replace(/^\//, '')))).toBe(true);
  });

  it('morytania Abandoned Mine reward chip is salve amulet (e) equip art', () => {
    const cat = reconstructCatalog();
    const mory = cat.regions.find((r: any) => r.id === 'morytania');
    const row = [...mory.content, ...mory.upgrades].find(
      (r: any) => r.name === 'Abandoned Mine salve shard mining',
    );
    expect(row).toBeTruthy();
    const full = contentRewardsFull(row, mory.upgrades);
    const presented = presentContentRewards(full, 8);
    expect(full).toBe('Salve amulet (e)');
    expect(presented.icons[0]?.src).toBe('/game/combat/equipment/salve-amulet-e.webp');
    expect(presented.icons[0]?.src).not.toMatch(/elder-overload/);
  });
});
