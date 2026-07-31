// Reading a patch file: bytes, lines, JSON, limits. Nothing here interprets or
// mutates an operation — the objects it returns are exactly what the file said,
// so validation can compare against them and the content hash means the file.
import { readFileSync } from "node:fs";
import { PATCH_LIMIT_BYTES, PATCH_LIMIT_OPERATIONS } from "../config.mjs";

export function parsePatch(path) {
  const body = readFileSync(path, "utf8");
  if (Buffer.byteLength(body) > PATCH_LIMIT_BYTES) throw new Error(`${path}: patch exceeds the 1 MiB safety limit`);
  const operations = body
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(({ text }) => text && !text.startsWith("#"))
    .map(({ line, text }) => {
      try {
        return { line, operation: JSON.parse(text) };
      } catch (error) {
        throw new Error(`${path}:${line}: ${error.message}`);
      }
    });
  if (operations.length > PATCH_LIMIT_OPERATIONS) {
    throw new Error(`${path}: patch exceeds the 1,000-operation safety limit`);
  }
  return { body, operations };
}
