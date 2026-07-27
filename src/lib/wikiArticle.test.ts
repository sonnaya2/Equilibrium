import { describe, expect, it } from "vitest";
import {
  extractDropRows,
  extractInfoboxFacts,
  processWikiHtml,
  safeWikiPage,
  stripWikiChrome,
  wikiParseApiUrl,
  type WikiDropRow,
} from "./wikiArticle";

describe("click-only wiki boundary", () => {
  it("safeWikiPage is pure resolution — no network", () => {
    // Guard: helpers used at click time must not fetch.
    expect(typeof safeWikiPage).toBe("function");
    expect(safeWikiPage("https://runescape.wiki/w/Home")?.pageTitle).toBe("Home");
  });
});

describe("safeWikiPage", () => {
  it("accepts article URLs and decodes titles", () => {
    expect(safeWikiPage("https://runescape.wiki/w/Kerapac,_the_bound")).toEqual({
      pageTitle: "Kerapac, the bound",
      pageUrl: "https://runescape.wiki/w/Kerapac%2C_the_bound",
    });
  });

  it("accepts percent-encoded apostrophes", () => {
    const got = safeWikiPage("https://runescape.wiki/w/Rasial%2C_the_First_Necromancer");
    expect(got?.pageTitle).toBe("Rasial, the First Necromancer");
  });

  it("rejects non-wiki hosts and special pages", () => {
    expect(safeWikiPage("https://example.com/w/Home")).toBeNull();
    expect(safeWikiPage("https://runescape.wiki/w/Special:Search")).toBeNull();
    expect(safeWikiPage("https://runescape.wiki/w/File:Foo.png")).toBeNull();
    expect(safeWikiPage("javascript:alert(1)")).toBeNull();
  });
});

describe("wikiParseApiUrl", () => {
  it("builds a parse action URL", () => {
    const url = wikiParseApiUrl("Arch-Glacor");
    expect(url).toContain("https://runescape.wiki/api.php?");
    expect(url).toContain("action=parse");
    expect(url).toContain("page=Arch-Glacor");
    expect(url).toContain("disableeditsection=1");
  });
});

describe("stripWikiChrome", () => {
  it("removes images, scripts, and navboxes", () => {
    const html = `
      <div class="mw-parser-output">
        <script>alert(1)</script>
        <img src="https://runescape.wiki/images/foo.png" alt="x" />
        <div class="navbox">nav</div>
        <p>Keep me</p>
      </div>`;
    const out = stripWikiChrome(html);
    expect(out).not.toMatch(/<img/i);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/navbox/i);
    expect(out).toMatch(/Keep me/);
  });
});

describe("extractInfoboxFacts", () => {
  it("reads th/td pairs and skips image rows", () => {
    const html = `
      <table class="infobox">
        <tr><th>Combat level</th><td>2000</td></tr>
        <tr><th>Image</th><td>portrait</td></tr>
        <tr><th>Weakness</th><td>None</td></tr>
      </table>`;
    expect(extractInfoboxFacts(html)).toEqual([
      { label: "Combat level", value: "2000" },
      { label: "Weakness", value: "None" },
    ]);
  });
});

describe("extractDropRows", () => {
  it("parses Item / Quantity / Rarity columns into structured rows", () => {
    const html = `
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Coins</td><td>1–500</td><td>Always</td></tr>
        <tr><td>Fractured Staff of Armadyl</td><td>1</td><td>Very rare</td></tr>
      </table>`;
    expect(extractDropRows(html)).toEqual([
      { item: "Coins", quantity: "1–500", rarity: "Always", iconUrl: null },
      {
        item: "Fractured Staff of Armadyl",
        quantity: "1",
        rarity: "Very rare",
        iconUrl: null,
      },
    ] satisfies WikiDropRow[]);
  });

  it("accepts Name / Qty / Rate header aliases", () => {
    const html = `
      <table>
        <tr><th>Name</th><th>Qty</th><th>Rate</th></tr>
        <tr><td>Bones</td><td>1</td><td>Always</td></tr>
        <tr><td>Rune platebody</td><td>1</td><td>1/128</td></tr>
      </table>`;
    expect(extractDropRows(html)).toEqual([
      { item: "Bones", quantity: "1", rarity: "Always", iconUrl: null },
      { item: "Rune platebody", quantity: "1", rarity: "1/128", iconUrl: null },
    ]);
  });

  it("dedupes identical rows and skips empty item cells", () => {
    const html = `
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Coins</td><td>100</td><td>Common</td></tr>
        <tr><td>Coins</td><td>100</td><td>Common</td></tr>
        <tr><td></td><td>1</td><td>Rare</td></tr>
        <tr><td>Dragon bones</td><td>1</td><td>Always</td></tr>
      </table>`;
    expect(extractDropRows(html)).toEqual([
      { item: "Coins", quantity: "100", rarity: "Common", iconUrl: null },
      { item: "Dragon bones", quantity: "1", rarity: "Always", iconUrl: null },
    ]);
  });

  it("ignores tables without an Item/Name header", () => {
    const html = `
      <table>
        <tr><th>Combat level</th><th>Life points</th></tr>
        <tr><td>2000</td><td>100000</td></tr>
      </table>`;
    expect(extractDropRows(html)).toEqual([]);
  });

  it("strips tags inside cells (anchors, spans) for plain item text", () => {
    const html = `
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr>
          <td><a href="/w/Kerapac%27s_wrist_wraps">Kerapac's wrist wraps</a></td>
          <td><span>1</span></td>
          <td>1/150</td>
        </tr>
      </table>`;
    expect(extractDropRows(html)).toEqual([
      {
        item: "Kerapac's wrist wraps",
        quantity: "1",
        rarity: "1/150",
        iconUrl: null,
      },
    ]);
  });

  it("prefers title/link text and skips empty image column headers", () => {
    const html = `
      <table class="wikitable">
        <tr><th></th><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr>
          <td></td>
          <td><a href="/w/Fractured_Staff_of_Armadyl" title="Fractured Staff of Armadyl">Staff</a> (noted)</td>
          <td>1</td>
          <td>Very rare</td>
        </tr>
      </table>`;
    expect(extractDropRows(html)).toEqual([
      {
        item: "Fractured Staff of Armadyl",
        quantity: "1",
        rarity: "Very rare",
        iconUrl: null,
      },
    ]);
  });

  it("harvests live wiki icon URLs from the image column", () => {
    const html = `
      <table class="wikitable">
        <tr><th>Image</th><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr>
          <td><img src="//runescape.wiki/images/Coins_10000.png" width="30" height="30" /></td>
          <td><a href="/w/Coins" title="Coins">Coins</a></td>
          <td>1–500</td>
          <td>Always</td>
        </tr>
        <tr>
          <td><img src="https://runescape.wiki/images/thumb/Foo.png/30px-Foo.png" /></td>
          <td>Foo bar</td>
          <td>1</td>
          <td>Rare</td>
        </tr>
      </table>`;
    const rows = extractDropRows(html);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      item: "Coins",
      quantity: "1–500",
      rarity: "Always",
      iconUrl: "https://runescape.wiki/images/Coins_10000.png",
    });
    expect(rows[1]?.iconUrl).toBe(
      "https://runescape.wiki/images/thumb/Foo.png/30px-Foo.png",
    );
  });

  it("processWikiHtml keeps drop icons even though body strip removes imgs", () => {
    const html = `
      <p>A boss.</p>
      <h2>Drops</h2>
      <table class="wikitable">
        <tr><th>Image</th><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr>
          <td><img src="//runescape.wiki/images/Dragon_bones.png" /></td>
          <td>Dragon bones</td>
          <td>1</td>
          <td>Always</td>
        </tr>
      </table>
      <h2>Lore</h2>
      <p><img src="//runescape.wiki/images/should-not-matter.png" />Old story.</p>`;
    const view = processWikiHtml(html, {
      title: "Test",
      pageUrl: "https://runescape.wiki/w/Test",
    });
    expect(view.drops[0]?.iconUrl).toBe(
      "https://runescape.wiki/images/Dragon_bones.png",
    );
    expect(view.bodyHtml).not.toMatch(/img|Old story/i);
    expect(view.dropsHtml).not.toMatch(/<img/i);
  });

  it("caps at 80 unique rows", () => {
    const dataRows = Array.from({ length: 100 }, (_, i) =>
      `<tr><td>Item ${i}</td><td>1</td><td>Common</td></tr>`,
    ).join("");
    const html = `
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        ${dataRows}
      </table>`;
    expect(extractDropRows(html)).toHaveLength(80);
  });
});

describe("processWikiHtml", () => {
  const meta = {
    title: "Test Boss",
    pageUrl: "https://runescape.wiki/w/Test_Boss",
  };

  it("promotes drop sections and caps lead waffle", () => {
    const long =
      "This is a very long introductory paragraph that keeps explaining lore and history and more lore beyond what a player needs when they only want the drops. ".repeat(
        4,
      );
    const html = `
      <div class="mw-parser-output">
        <p>${long}</p>
        <p>Second paragraph still waffle about ancient history and more.</p>
        <h2><span class="mw-headline">Drops</span></h2>
        <table class="wikitable">
          <tr><th>Item</th><th>Rarity</th><th>Quantity</th></tr>
          <tr><td>Coin</td><td>Always</td><td>1</td></tr>
        </table>
        <h2><span class="mw-headline">Strategy</span></h2>
        <p>Stand here and pray there for three paragraphs of guide content.</p>
        <h2><span class="mw-headline">Trivia</span></h2>
        <p>Named after a sandwich.</p>
        <img src="https://runescape.wiki/images/drop.png" />
      </div>`;

    const view = processWikiHtml(html, meta);
    expect(view.hasDrops).toBe(true);
    expect(view.dropsHtml).toMatch(/Coin|Rarity|Always/i);
    expect(view.dropsHtml).not.toMatch(/<img/i);
    expect(view.bodyHtml).not.toMatch(/Strategy|Trivia|sandwich/i);
    expect(stripTagsApprox(view.leadHtml).length).toBeLessThanOrEqual(560);
    expect(view.drops).toEqual([
      { item: "Coin", quantity: "1", rarity: "Always", iconUrl: null },
    ]);
  });

  it("fills structured drops from preferred unique/main sections first", () => {
    const html = `
      <h2>Drops</h2>
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Bones</td><td>1</td><td>Always</td></tr>
      </table>
      <h2>Unique drops</h2>
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Staff of Armadyl</td><td>1</td><td>Very rare</td></tr>
      </table>`;
    const view = processWikiHtml(html, meta);
    expect(view.hasDrops).toBe(true);
    // Preferred unique section is parsed before the generic Drops section.
    expect(view.drops[0]).toEqual({
      item: "Staff of Armadyl",
      quantity: "1",
      rarity: "Very rare",
      iconUrl: null,
    });
    expect(view.drops).toContainEqual({
      item: "Bones",
      quantity: "1",
      rarity: "Always",
      iconUrl: null,
    });
  });

  it("strips location/lore chrome sections while keeping Drops", () => {
    const html = `
      <p>A place with things to kill.</p>
      <h2>Drops</h2>
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Bones</td><td>1</td><td>Always</td></tr>
      </table>
      <h2>Points of interest</h2>
      <p>Fountain and bank.</p>
      <h2>Monsters</h2>
      <p>Goblin list.</p>
      <h2>Mobs</h2>
      <p>Mob table.</p>
      <h2>Bosses</h2>
      <p>Big bosses.</p>
      <h2>Minibosses</h2>
      <p>Mini bosses.</p>
      <h2>Map</h2>
      <p>Map embed.</p>
      <h2>Lore</h2>
      <p>Ancient lore text.</p>
      <h2>Credits</h2>
      <p>Thanks contributors.</p>
      <h2>Spotlight</h2>
      <p>Featured spotlight.</p>
      <h2>Getting there</h2>
      <p>Teleport route A.</p>
      <h2>Getting There</h2>
      <p>Teleport route B.</p>`;
    const view = processWikiHtml(html, meta);
    expect(view.drops.some((d) => d.item === "Bones")).toBe(true);
    expect(view.hasDrops).toBe(true);
    expect(view.bodyHtml).not.toMatch(
      /Fountain|Goblin list|Mob table|Big bosses|Mini bosses|Map embed|Ancient lore|Thanks contributors|Featured spotlight|Teleport route/i,
    );
    expect(view.bodyHtml).not.toMatch(
      /Points of interest|Monsters|Mobs|Bosses|Minibosses|\bMap\b|Lore|Credits|Spotlight|Getting there|Getting There/i,
    );
  });

  it("strips achievements, hard/normal mode, money making, boss pet/log", () => {
    const html = `
      <p>Kerapac is an EGWD boss.</p>
      <h2>Drops</h2>
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Coins</td><td>1</td><td>Always</td></tr>
      </table>
      <h2>Achievements</h2>
      <p>Do not show this waffle.</p>
      <h2>Hard mode</h2>
      <p>Hard mode guide.</p>
      <h2>Money making guide</h2>
      <p>GP per hour.</p>
      <h2>Normal mode</h2>
      <p>Normal guide.</p>
      <h2>Boss Pet</h2>
      <p>Pet drop.</p>
      <h2>Boss Log</h2>
      <p>Log slots.</p>
      <h2>Senntisten achievements</h2>
      <p>City tasks.</p>
      <h2>History</h2>
      <p>Lore.</p>`;
    const view = processWikiHtml(html, meta);
    expect(view.drops.some((d) => d.item === "Coins")).toBe(true);
    expect(view.bodyHtml).not.toMatch(
      /waffle|Hard mode|GP per hour|Normal guide|Pet drop|Log slots|City tasks|Lore/i,
    );
    expect(view.bodyHtml).not.toMatch(/Achievements|Money making|Boss Pet|Boss Log|Senntisten/i);
  });

  it("returns lead + art-side facts without inventing drops", () => {
    const html = `
      <table class="infobox">
        <tr><th>Location</th><td>Varrock</td></tr>
      </table>
      <p>A quiet dig site east of the city.</p>
      <h2>History</h2>
      <p>Founded long ago.</p>`;
    const view = processWikiHtml(html, meta);
    expect(view.hasDrops).toBe(false);
    expect(view.drops).toEqual([]);
    expect(view.facts).toEqual([{ label: "Location", value: "Varrock" }]);
    expect(view.leadHtml).toMatch(/dig site/i);
    expect(view.bodyHtml).not.toMatch(/Founded long ago/);
  });

  it("strips wiki images from every bucket", () => {
    const html = `
      <p>Hello <img src="https://runescape.wiki/x.png" alt="no" /></p>
      <h2>Drops</h2>
      <p><img src="https://runescape.wiki/y.png" /></p>
      <table><tr><td>Loot</td><td class="rarity">Common</td></tr></table>`;
    const view = processWikiHtml(html, meta);
    expect(view.leadHtml).not.toMatch(/<img/i);
    expect(view.dropsHtml).not.toMatch(/<img/i);
    expect(view.bodyHtml).not.toMatch(/<img/i);
  });
});

function stripTagsApprox(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
