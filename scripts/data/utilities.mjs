import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { ROOT } from "./config.mjs";

export const slash = (value) => value.replaceAll("\\", "/");
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const slugify = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "unnamed";

// Key-sorted serialisation: every hash, parity check and export byte-comparison
// depends on two equal values producing the same string.
export const stableJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export const jsonLine = (value) => `${stableJson(value)}\n`;
export const asArray = (value) => (Array.isArray(value) ? value : value == null ? [] : [value]);
export const scalar = (value, fallback = "") =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : fallback;
export const parseBoolean = (value) =>
  value === true || String(value).toLowerCase() === "yes"
    ? 1
    : value === false || String(value).toLowerCase() === "no"
      ? 0
      : null;

export function walkFiles(directory, predicate) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walkFiles(path, predicate) : predicate(path) ? [path] : [];
    })
    .sort((a, b) => slash(relative(ROOT, a)).localeCompare(slash(relative(ROOT, b))));
}

// Write through a temporary sibling so an interrupted run never leaves a
// half-written artifact that the next byte-comparison would accept.
export function atomicWrite(path, body) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  rmSync(temporary, { force: true });
  writeFileSync(temporary, body);
  rmSync(path, { force: true });
  renameSync(temporary, path);
}

export function boundedPrint(value, maxBytes) {
  const body = typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(body) <= maxBytes) {
    process.stdout.write(body);
    return;
  }
  const suffix = `\n... truncated at ${maxBytes} bytes; narrow the query or raise --max-bytes.\n`;
  process.stdout.write(`${body.slice(0, Math.max(0, maxBytes - Buffer.byteLength(suffix)))}${suffix}`);
}
