/**
 * Fetch RuneScape Wiki art into .asset-cache/raw/ only (never public/).
 * Promote with import-sources.mjs; never run during a build.
 * Usage: node scripts/assets/fetch-sources.mjs <id...> | --missing
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { loadCatalog } from "./catalog.mjs";

const ROOT = process.cwd();
const CACHE = join(ROOT, ".asset-cache/raw");
const MANIFEST = join(ROOT, ".asset-cache/fetched.json");
const WIKI_API = "https://runescape.wiki/api.php";
const USER_AGENT = "EquilibriumAssetSync/2.0 (+https://runescape.wiki; fan tool asset sync)";
const MAX_BYTES = 8 * 1024 * 1024;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function extensionFor(mime, url) {
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  const fromUrl = extname(new URL(url).pathname).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(fromUrl) ? fromUrl : ".bin";
}

async function get(url, accept = "*/*") {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": USER_AGENT, Accept: accept },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response;
}

async function wikiFileInfo(title) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|mime|size|sha1",
    titles: title.startsWith("File:") ? title : `File:${title}`,
    origin: "*",
  });
  const data = await (await get(`${WIKI_API}?${params}`, "application/json")).json();
  const page = data?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!page || page.missing || !info?.url) return null;
  return { title: page.title, ...info };
}

function scoreTitle(title, terms) {
  const target = title.toLowerCase();
  const phrase = terms.toLowerCase();
  let score = 0;
  for (const token of phrase.split(/[^a-z0-9]+/).filter((t) => t.length > 2)) {
    if (target.includes(token)) score += token.length;
  }
  if (target.includes(phrase)) score += 100;
  if (/\.png$/i.test(title)) score += 5;
  if (/icon|inventory|task|relic|trophy|lodestone/i.test(title)) score += 3;
  return score;
}

async function searchWikiFile(terms) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    list: "search",
    srnamespace: "6",
    srlimit: "20",
    srsearch: terms,
    origin: "*",
  });
  const data = await (await get(`${WIKI_API}?${params}`, "application/json")).json();
  const candidates = data?.query?.search ?? [];
  candidates.sort((a, b) => scoreTitle(b.title, terms) - scoreTitle(a.title, terms));
  for (const candidate of candidates) {
    const info = await wikiFileInfo(candidate.title);
    if (info) return info;
  }
  return null;
}

async function imagesUsedByWikiPage(canonicalPage) {
  if (!canonicalPage) return [];
  const url = new URL(canonicalPage);
  if (url.hostname !== "runescape.wiki" || !url.pathname.startsWith("/w/")) return [];
  const title = decodeURIComponent(url.pathname.slice(3)).replaceAll("_", " ");

  const images = [];
  let continuation = null;
  do {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "images",
      imlimit: "500",
      titles: title,
      origin: "*",
    });
    if (continuation) params.set("imcontinue", continuation);
    const data = await (await get(`${WIKI_API}?${params}`, "application/json")).json();
    images.push(...(data?.query?.pages?.[0]?.images ?? []));
    continuation = data?.continue?.imcontinue ?? null;
  } while (continuation && images.length < 1500);
  return images;
}

async function resolveWiki(entry) {
  let info = entry.fileTitle ? await wikiFileInfo(entry.fileTitle) : null;
  if (!info) info = await searchWikiFile(entry.search ?? entry.label ?? entry.id);
  if (!info) {
    const candidates = await imagesUsedByWikiPage(entry.canonicalPage);
    const terms = [entry.label, entry.search, entry.fileTitle].filter(Boolean).join(" ");
    candidates.sort((a, b) => scoreTitle(b.title, terms) - scoreTitle(a.title, terms));
    const best = candidates[0];
    if (best && scoreTitle(best.title, terms) >= 5) info = await wikiFileInfo(best.title);
  }
  if (!info) throw new Error(`No RuneScape Wiki file resolved for ${entry.id}`);
  return {
    downloadUrl: info.url,
    mime: info.mime,
    sourcePage: `https://runescape.wiki/w/${encodeURIComponent(info.title.replaceAll(" ", "_"))}`,
    resolvedTitle: info.title,
    sourceWidth: info.width,
    sourceHeight: info.height,
    sourceSha1: info.sha1,
  };
}

async function resolvePageOg(entry) {
  const html = await (await get(entry.pageUrl, "text/html")).text();
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!match) throw new Error(`No og:image found on ${entry.pageUrl}`);
  const downloadUrl = new URL(match[1].replaceAll("&amp;", "&"), entry.pageUrl).href;
  const head = await get(downloadUrl);
  return {
    downloadUrl,
    mime: head.headers.get("content-type")?.split(";")[0] ?? "application/octet-stream",
    sourcePage: entry.pageUrl,
    resolvedTitle: entry.label,
  };
}

async function download(entry, resolved) {
  const response = await get(resolved.downloadUrl, "image/*");
  const mime = response.headers.get("content-type")?.split(";")[0] || resolved.mime;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!mime?.startsWith("image/")) throw new Error(`Not an image (${mime}) for ${entry.id}`);
  if (!buffer.length) throw new Error(`Empty image for ${entry.id}`);
  if (buffer.length > (entry.maxBytes ?? MAX_BYTES)) {
    throw new Error(`Asset too large (${buffer.length} bytes) for ${entry.id}`);
  }

  const ext = extensionFor(mime, resolved.downloadUrl);
  const cached = join(CACHE, entry.id, `source${ext}`);
  await mkdir(join(CACHE, entry.id), { recursive: true });
  await writeFile(cached, buffer);

  return {
    id: entry.id,
    label: entry.label,
    cachePath: `.asset-cache/raw/${entry.id}/source${ext}`,
    canonicalPath: entry.path,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    mime,
    canonicalPage: entry.canonicalPage,
    sourcePage: resolved.sourcePage,
    downloadUrl: resolved.downloadUrl,
    resolvedTitle: resolved.resolvedTitle,
    sourceWidth: resolved.sourceWidth,
    sourceHeight: resolved.sourceHeight,
    sourceSha1: resolved.sourceSha1,
    attribution: entry.attribution ?? "RuneScape Wiki / Jagex",
    fetchedAt: new Date().toISOString(),
  };
}

const catalog = await loadCatalog();
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const wantMissing = process.argv.includes("--missing");

/** Catalog paths carry no extension - any known image extension counts as present. */
const hasLocalFile = (entry) =>
  [".webp", ".png", ".jpg", ".jpeg", ".gif"].some((ext) => existsSync(join(ROOT, entry.path + ext)));

let queue;
if (args.length) {
  const wanted = new Set(args.map((a) => a.toLowerCase()));
  queue = catalog.assets.filter((entry) => wanted.has(entry.id.toLowerCase()));
  const unknown = [...wanted].filter(
    (id) => !catalog.assets.some((entry) => entry.id.toLowerCase() === id),
  );
  if (unknown.length) {
    console.error(`Unknown asset id(s): ${unknown.join(", ")}`);
    process.exit(1);
  }
} else if (wantMissing) {
  queue = catalog.assets.filter((entry) => !hasLocalFile(entry));
} else {
  console.error(
    "Refusing to re-fetch the whole catalog. Pass explicit asset ids, or --missing.\n" +
      "Bulk re-downloads are how optimized art gets clobbered by raw upstream copies.",
  );
  process.exit(1);
}

if (!queue.length) {
  console.log("ASSET FETCH: nothing to do");
  process.exit(0);
}

const fetched = [];
const unresolved = [];
for (const [index, entry] of queue.entries()) {
  process.stdout.write(`[${index + 1}/${queue.length}] ${entry.id} ... `);
  try {
    const resolved =
      entry.type === "page-og" ? await resolvePageOg(entry) : await resolveWiki(entry);
    const result = await download(entry, resolved);
    fetched.push(result);
    console.log(`${result.bytes} bytes -> ${result.cachePath}`);
  } catch (error) {
    unresolved.push({ id: entry.id, label: entry.label, error: String(error) });
    console.log(`UNRESOLVED: ${error}`);
  }
  await sleep(100);
}

await mkdir(join(ROOT, ".asset-cache"), { recursive: true });
const previous = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : { assets: [] };
const merged = new Map(previous.assets.map((a) => [a.id, a]));
for (const asset of fetched) merged.set(asset.id, asset);
await writeFile(
  MANIFEST,
  `${JSON.stringify({ assets: [...merged.values()], unresolved }, null, 2)}\n`,
);

console.log(`\nASSET FETCH: ${fetched.length} cached, ${unresolved.length} unresolved`);
console.log("Promote with: npm run art:import -- <asset-id>...");
if (unresolved.length) process.exitCode = 2;
