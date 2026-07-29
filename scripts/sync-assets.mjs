import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";

const ROOT = process.cwd();
const SOURCE_PATH = join(ROOT, "assets/source-manifest.json");
const GENERATED_PATH = join(ROOT, "assets/manifest.generated.json");
const WIKI_API = "https://runescape.wiki/api.php";
const USER_AGENT = "EquilibriumAssetSync/1.0 (https://github.com/sonnaya2/Equilibrium)";
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
  const tokens = phrase.split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  let score = 0;
  for (const token of tokens) if (target.includes(token)) score += token.length;
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

function wikiPageTitle(canonicalPage) {
  if (!canonicalPage) return null;
  const url = new URL(canonicalPage);
  if (url.hostname !== "runescape.wiki" || !url.pathname.startsWith("/w/")) return null;
  return decodeURIComponent(url.pathname.slice(3)).replaceAll("_", " ");
}

async function imagesUsedByWikiPage(canonicalPage) {
  const title = wikiPageTitle(canonicalPage);
  if (!title) return [];

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
    const page = data?.query?.pages?.[0];
    images.push(...(page?.images ?? []));
    continuation = data?.continue?.imcontinue ?? null;
  } while (continuation && images.length < 1500);

  return images;
}

async function resolveFromCanonicalPage(entry) {
  const candidates = await imagesUsedByWikiPage(entry.canonicalPage);
  if (!candidates.length) return null;

  const terms = [entry.label, entry.search, entry.fileTitle].filter(Boolean).join(" ");
  candidates.sort((a, b) => scoreTitle(b.title, terms) - scoreTitle(a.title, terms));
  const best = candidates[0];
  if (!best || scoreTitle(best.title, terms) < 5) return null;
  return wikiFileInfo(best.title);
}

async function resolveWiki(entry) {
  let info = entry.fileTitle ? await wikiFileInfo(entry.fileTitle) : null;
  if (!info) info = await searchWikiFile(entry.search ?? entry.label ?? entry.id);
  if (!info) info = await resolveFromCanonicalPage(entry);
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

async function downloadResolved(entry, resolved) {
  const response = await get(resolved.downloadUrl, "image/*");
  const mime = response.headers.get("content-type")?.split(";")[0] || resolved.mime;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!mime?.startsWith("image/")) throw new Error(`Not an image (${mime}) for ${entry.id}`);
  if (!buffer.length) throw new Error(`Empty image for ${entry.id}`);
  if (buffer.length > (entry.maxBytes ?? MAX_BYTES))
    throw new Error(`Asset too large (${buffer.length} bytes) for ${entry.id}`);

  const relPath = `${entry.path}${extensionFor(mime, resolved.downloadUrl)}`;
  const absPath = join(ROOT, relPath);
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, buffer);

  return {
    id: entry.id,
    label: entry.label,
    category: entry.category,
    path: relPath.replaceAll("\\", "/"),
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
    copyright:
      entry.copyright ??
      "Jagex Ltd.; game media used via the RuneScape Wiki or official RuneScape site",
    attribution: entry.attribution ?? "RuneScape Wiki / Jagex",
    verifiedAt: new Date().toISOString(),
  };
}

async function syncEntry(entry) {
  try {
    const resolved =
      entry.type === "page-og" ? await resolvePageOg(entry) : await resolveWiki(entry);
    return await downloadResolved(entry, resolved);
  } catch (primaryError) {
    if (!entry.fallbackUrl) throw primaryError;
    const fallback = {
      downloadUrl: entry.fallbackUrl,
      mime: entry.fallbackMime ?? "image/png",
      sourcePage: entry.fallbackSourcePage ?? entry.fallbackUrl,
      resolvedTitle: `${entry.label} (fallback mirror)`,
    };
    const result = await downloadResolved(entry, fallback);
    return { ...result, fallbackUsed: true, primaryError: String(primaryError) };
  }
}

const source = JSON.parse(await readFile(SOURCE_PATH, "utf8"));
if (!Array.isArray(source.assets))
  throw new Error("assets/source-manifest.json must contain an assets array");

const ids = new Set();
const paths = new Set();
for (const entry of source.assets) {
  if (!entry?.id || !entry?.path) throw new Error("Every asset needs an id and path");
  if (!entry.path.startsWith("assets/") || entry.path.split("/").includes("..")) {
    throw new Error(`Asset path must stay under assets/: ${entry.path}`);
  }
  const id = entry.id.toLowerCase();
  const path = entry.path.toLowerCase();
  if (ids.has(id)) throw new Error(`Duplicate asset id: ${entry.id}`);
  if (paths.has(path)) throw new Error(`Duplicate asset path: ${entry.path}`);
  ids.add(id);
  paths.add(path);
}

if (process.argv.includes("--check")) {
  console.log(`ASSET MANIFEST OK: ${source.assets.length} unique assets`);
  process.exit(0);
}

const assets = [];
const unresolved = [];

for (const [index, entry] of source.assets.entries()) {
  process.stdout.write(`[${index + 1}/${source.assets.length}] ${entry.id} ... `);
  try {
    const result = await syncEntry(entry);
    assets.push(result);
    console.log(`${result.bytes} bytes`);
  } catch (error) {
    unresolved.push({
      id: entry.id,
      label: entry.label,
      error: String(error),
      canonicalPage: entry.canonicalPage,
    });
    console.log(`UNRESOLVED: ${error}`);
  }
  await sleep(100);
}

const generated = {
  generatedAt: new Date().toISOString(),
  sourceManifest: "assets/source-manifest.json",
  count: assets.length,
  unresolvedCount: unresolved.length,
  totalBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  assets,
  unresolved,
};

await writeFile(GENERATED_PATH, `${JSON.stringify(generated, null, 2)}\n`);
console.log(
  `\nASSET SYNC: ${assets.length}/${source.assets.length} resolved, ${unresolved.length} unresolved, ${generated.totalBytes} bytes`,
);
if (unresolved.length) process.exitCode = 2;
