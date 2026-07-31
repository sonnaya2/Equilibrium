// data/canonical/*.jsonl -> plain records, with each collection's declared
// defaults filled in. Nothing here interprets a record: a canonical line already
// says what it is, so reading is parsing plus defaults and nothing else.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_ROOT, COLLECTIONS, COLLECTION_BY_NAME, collectionDefaults } from "./schema.mjs";

// One record per line, so a parse failure can name the exact line the author
// has to open.
export function readCollectionRecords(name, root = CANONICAL_ROOT) {
  const collection = COLLECTION_BY_NAME.get(name);
  if (!collection) throw new Error(`Unknown canonical collection: ${name}`);
  const path = join(root, collection.file);
  if (!existsSync(path)) return [];
  const defaults = collectionDefaults(collection);
  const lines = readFileSync(path, "utf8").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line, index) => {
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`${collection.file}:${index + 1}: invalid JSON: ${error.message}`);
    }
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`${collection.file}:${index + 1}: line is not a JSON object`);
    }
    return { ...defaults, ...record };
  });
}

export const readCanonical = (root = CANONICAL_ROOT) =>
  new Map(COLLECTIONS.map((collection) => [collection.name, readCollectionRecords(collection.name, root)]));
