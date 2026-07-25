const API = "https://runescape.wiki/api.php";
const USER_AGENT = "EquilibriumQuestSync/1.0 (https://github.com/sonnaya2/Equilibrium)";

export async function wikiApi(params) {
  const query = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...params,
  });
  const response = await fetch(`${API}?${query}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`RuneScape Wiki API ${response.status}`);
  return response.json();
}

export async function wikiSource(title) {
  const data = await wikiApi({
    action: "query",
    prop: "revisions",
    rvprop: "ids|timestamp|content",
    rvslots: "main",
    titles: title,
  });
  const page = data?.query?.pages?.[0];
  const revision = page?.revisions?.[0];
  const content = revision?.slots?.main?.content;
  if (!page || page.missing || !content) throw new Error(`Missing Wiki page: ${title}`);
  return { title: page.title, revid: revision.revid, timestamp: revision.timestamp, content };
}

function decodeHtml(text) {
  return String(text)
    .replace(/&#(\d+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export async function wikiRenderedText(title) {
  const data = await wikiApi({ action: "parse", page: title, prop: "text" });
  const html = data?.parse?.text;
  if (typeof html !== "string" || html.length === 0) throw new Error(`Missing rendered Wiki page: ${title}`);
  const text = decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  ).replace(/\s+/g, " ").trim();
  return { title: data.parse.title ?? title, revid: data.parse.revid ?? null, text };
}

export async function wikiSources(titles) {
  const result = new Map();
  for (let offset = 0; offset < titles.length; offset += 40) {
    const batch = titles.slice(offset, offset + 40);
    const data = await wikiApi({
      action: "query",
      prop: "revisions",
      rvprop: "ids|timestamp|content",
      rvslots: "main",
      titles: batch.join("|"),
    });
    for (const page of data?.query?.pages ?? []) {
      const revision = page?.revisions?.[0];
      const content = revision?.slots?.main?.content;
      if (!page?.title || page.missing || !content) continue;
      result.set(page.title, {
        title: page.title,
        revid: revision.revid,
        timestamp: revision.timestamp,
        content,
      });
    }
  }
  return result;
}

export async function wikiPageLinks(title) {
  const data = await wikiApi({ action: "parse", page: title, prop: "links" });
  return new Set(
    (data?.parse?.links ?? [])
      .filter((link) => link.ns === 0 && link.exists !== false)
      .map((link) => link.title),
  );
}
