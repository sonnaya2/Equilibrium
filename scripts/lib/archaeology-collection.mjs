import { wikiSource } from "./runescape-wiki.mjs";

function field(content, name) {
  const match = content.match(new RegExp(`^\\|\\s*${name}\\s*=\\s*(.*?)\\s*$`, "im"));
  return match?.[1]?.trim() ?? null;
}

function stripWiki(text) {
  if (text == null) return null;
  return String(text)
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/\{\{!\}\}/g, "|")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function archaeologyLevel(page, title) {
  const archlevelRaw = field(page.content, "archlevel") ?? field(page.content, "level");
  const archlevel = archlevelRaw == null ? null : Number.parseInt(stripWiki(archlevelRaw), 10);
  if (!Number.isFinite(archlevel)) {
    throw new Error(`Could not parse Archaeology collection level from ${title} (revision ${page.revid})`);
  }
  return archlevel;
}

export async function wikiArchaeologyCollectionLevel(title) {
  const page = await wikiSource(title);
  return {
    title,
    archlevel: archaeologyLevel(page, title),
    revid: page.revid,
    timestamp: page.timestamp,
    url: page.url,
    content: page.content,
  };
}

export async function wikiArchaeologyCollection(title) {
  const page = await wikiSource(title);
  const archlevel = archaeologyLevel(page, title);
  const collector = stripWiki(field(page.content, "collector"));
  const first = stripWiki(field(page.content, "first"));
  const reward = stripWiki(field(page.content, "reward"));

  if (!collector) throw new Error(`Could not parse Archaeology collection collector from ${title}`);
  if (first == null) throw new Error(`Could not parse Archaeology collection first reward from ${title}`);
  if (reward == null) throw new Error(`Could not parse Archaeology collection recurring reward from ${title}`);

  return {
    title,
    archlevel,
    collector,
    first,
    reward,
    revid: page.revid,
    timestamp: page.timestamp,
    url: page.url,
    content: page.content,
  };
}
