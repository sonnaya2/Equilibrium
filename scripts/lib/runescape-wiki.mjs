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
