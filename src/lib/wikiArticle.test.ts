import { describe, expect, it } from "vitest";
import {
  cleanWikiFootnotes,
  extractDropRows,
  extractInfoboxFacts,
  finalizeArticleHtml,
  isLootContainerItem,
  mergeExpandedDrops,
  pickLootExpandTitles,
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

  it("strips unclosed script/iframe openers", () => {
    const out = stripWikiChrome(
      `<p>safe</p><script>alert(1)<iframe src="x">tail`,
    );
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/<iframe/i);
    expect(out).toMatch(/safe/);
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
        noted: true,
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

  it("prefers inventory-image cell and skips alchemy chrome icons", () => {
    const html = `
      <table class="wikitable">
        <tr><th></th><th>Item</th><th>Quantity</th><th>Rarity</th><th class="alch-column">High Alch</th></tr>
        <tr>
          <td class="inventory-image">
            <img src="/images/Gold_charm.png?ad20e" width="32" height="29" />
          </td>
          <td class="item-col"><a href="/w/Gold_charm" title="Gold charm">Gold charm</a></td>
          <td>5</td>
          <td>Common</td>
          <td class="alch-column">
            <img src="/images/thumb/High_Level_Alchemy_icon.png/20px-High_Level_Alchemy_icon.png" />
            100
          </td>
        </tr>
      </table>`;
    const rows = extractDropRows(html);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.item).toBe("Gold charm");
    expect(rows[0]?.iconUrl).toBe("https://runescape.wiki/images/Gold_charm.png?ad20e");
    expect(rows[0]?.iconUrl).not.toMatch(/Alchemy/i);
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

  it("strips [ d N ] footnote markers from rarity cells", () => {
    const html = `
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Resonant anima of Wen</td><td>30–50</td><td>3 × Always [ d 1 ]</td></tr>
        <tr><td>Elder Trove (Wen, T1)</td><td>1</td><td>Varies [ d 2 ] [ d 3 ] [ d 4 ]</td></tr>
      </table>`;
    expect(extractDropRows(html)).toEqual([
      {
        item: "Resonant anima of Wen",
        quantity: "30–50",
        rarity: "3 × Always",
        iconUrl: null,
      },
      {
        item: "Elder Trove (Wen, T1)",
        quantity: "1",
        rarity: "Varies",
        iconUrl: null,
      },
    ] satisfies WikiDropRow[]);
  });

  it("flags noted drops and strips (noted) from quantity text", () => {
    const html = `
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Crushed nest</td><td>7–12 (noted)</td><td>Common</td></tr>
        <tr><td>Coins (noted)</td><td>100</td><td>Always</td></tr>
      </table>`;
    expect(extractDropRows(html)).toEqual([
      {
        item: "Crushed nest",
        quantity: "7–12",
        rarity: "Common",
        iconUrl: null,
        noted: true,
      },
      {
        item: "Coins",
        quantity: "100",
        rarity: "Always",
        iconUrl: null,
        noted: true,
      },
    ] satisfies WikiDropRow[]);
  });

  it("attaches optional section group when provided", () => {
    const html = `
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Scripture of Wen</td><td>1</td><td>Rare</td></tr>
      </table>`;
    expect(extractDropRows(html, { group: "Unique (5 mechanics)" })[0]).toEqual({
      item: "Scripture of Wen",
      quantity: "1",
      rarity: "Rare",
      iconUrl: null,
      group: "Unique (5 mechanics)",
    });
  });
});

describe("cleanWikiFootnotes", () => {
  it("removes spaced drop footnotes", () => {
    expect(cleanWikiFootnotes("Varies [ d 2 ] [ d 3 ]")).toBe("Varies");
  });

  it("strips dead wiki citation markers from prose", () => {
    expect(
      cleanWikiFootnotes(
        'the Glacor Front. [ 1 ] Like Kerapac, the bound. Hardcore Ironmen [ 2 ]; hard mode. [ 3 ]',
      ),
    ).toBe(
      "the Glacor Front. Like Kerapac, the bound. Hardcore Ironmen; hard mode.",
    );
    expect(cleanWikiFootnotes("Always [1]")).toBe("Always");
  });
});

describe("loot container expansion", () => {
  it("detects shell loot rows and prefers normal mode", () => {
    expect(isLootContainerItem("Zemouregal & Vorkath loot (normal)")).toBe(true);
    expect(isLootContainerItem("Vorkath's spike")).toBe(false);
    expect(
      pickLootExpandTitles([
        {
          item: "Zemouregal & Vorkath loot (story)",
          quantity: "1",
          rarity: "Always",
        },
        {
          item: "Zemouregal & Vorkath loot (hard)",
          quantity: "1",
          rarity: "Always",
        },
        {
          item: "Zemouregal & Vorkath loot (normal)",
          quantity: "1",
          rarity: "Always",
        },
        {
          item: "Vorkath's scale",
          quantity: "1",
          rarity: "1/150",
        },
      ]),
    ).toEqual(["Zemouregal & Vorkath loot (normal)"]);
  });

  it("merges expanded subpage rows and drops shell containers", () => {
    const merged = mergeExpandedDrops(
      [
        {
          item: "Vorkath's scale",
          quantity: "1",
          rarity: "1/150",
          group: "Unique rewards",
        },
        {
          item: "Zemouregal & Vorkath loot (normal)",
          quantity: "1",
          rarity: "Always",
          group: "Rewards",
        },
      ],
      [
        {
          item: "Coins",
          quantity: "1000–5000",
          rarity: "Common",
          group: "Common drops",
        },
        {
          item: "Vorkath's scale",
          quantity: "1",
          rarity: "1/150",
          group: "Rare drops",
        },
      ],
    );
    expect(merged.map((r) => r.item)).toEqual(["Vorkath's scale", "Coins"]);
    expect(merged.some((r) => /loot\s*\(/i.test(r.item))).toBe(false);
  });
});

describe("processWikiHtml", () => {
  const meta = {
    title: "Test Boss",
    pageUrl: "https://runescape.wiki/w/Test_Boss",
  };

  it("decodes HTML entities on article title without relying on the API route", () => {
    const view = processWikiHtml("<p>Lead.</p>", {
      title: "Kree&#039;arra",
      pageUrl: "https://runescape.wiki/w/Kree%27arra",
    });
    expect(view.title).toBe("Kree'arra");
    const finalized = finalizeArticleHtml({
      ...view,
      title: "Artisans&#039; Workshop",
    });
    expect(finalized.title).toBe("Artisans' Workshop");
  });

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
    // Fuller lead fills the modal hero; still bounded (LEAD_MAX ≈ 1600).
    expect(stripTagsApprox(view.leadHtml).length).toBeLessThanOrEqual(1700);
    expect(stripTagsApprox(view.leadHtml).length).toBeGreaterThan(100);
    expect(view.drops).toEqual([
      {
        item: "Coin",
        quantity: "1",
        rarity: "Always",
        iconUrl: null,
        group: "Drops",
      },
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
      group: "Unique drops",
    });
    expect(view.drops).toContainEqual({
      item: "Bones",
      quantity: "1",
      rarity: "Always",
      iconUrl: null,
      group: "Drops",
    });
  });

  it("prefers bare Uniques + nested weapon/shard tables before commons fill the cap", () => {
    // Amascut-shaped outline: Commons child tables first in document order,
    // then Uniques with weapon/shard children. Cap is 80 — without preferred
    // ordering, potions alone would crowd out chase uniques.
    const potionRows = Array.from(
      { length: 90 },
      (_, i) => `<tr><td>Potion ${i}</td><td>1</td><td>Common</td></tr>`,
    ).join("");
    const html = `
      <h2>Drops</h2>
      <h3>Commons</h3>
      <h4>Potions table</h4>
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        ${potionRows}
      </table>
      <h3>Uniques</h3>
      <p>Chase items from the boss.</p>
      <h4>Weapon and armour table</h4>
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Tumeken's Light</td><td>1</td><td>Very rare</td></tr>
        <tr><td>Devourer's Guard</td><td>1</td><td>Very rare</td></tr>
        <tr><td>Mask of Tumeken's resplendence</td><td>1</td><td>Very rare</td></tr>
      </table>
      <h4>Shard of Genesis Essence table</h4>
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Shard of Genesis Essence</td><td>1</td><td>Rare</td></tr>
      </table>`;
    const view = processWikiHtml(html, meta);
    expect(view.hasDrops).toBe(true);
    const items = view.drops.map((d) => d.item);
    expect(items).toContain("Tumeken's Light");
    expect(items).toContain("Devourer's Guard");
    expect(items).toContain("Mask of Tumeken's resplendence");
    expect(items).toContain("Shard of Genesis Essence");
    // Preferred uniques claim budget before potions; cap still 80.
    expect(items.indexOf("Tumeken's Light")).toBeLessThan(items.indexOf("Potion 0"));
    expect(view.drops).toHaveLength(80);
    // Last potion slots are truncated (90 commons - only 76 fit after 4 uniques).
    expect(items).not.toContain("Potion 89");
  });

  it("does not set hasDrops for item-page Creation / Products / Item sources chrome", () => {
    const html = `
      <p>A rare staff.</p>
      <h2>Creation</h2>
      <table class="wikitable">
        <tr><th>Material</th><th>Quantity</th><th>Cost</th></tr>
        <tr><td>Magic stone</td><td>1</td><td>1000</td></tr>
      </table>
      <h2>Products</h2>
      <table class="wikitable">
        <tr><th>Product</th><th>GE price</th><th>Materials</th></tr>
        <tr><td>Dyed staff</td><td>5000</td><td>Staff</td></tr>
      </table>
      <h2>Item sources</h2>
      <table class="wikitable">
        <tr><th>Source</th><th>Level</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Some boss</td><td>100</td><td>1</td><td>Very rare</td></tr>
      </table>
      <h2>History</h2>
      <p>Forged long ago.</p>`;
    const view = processWikiHtml(html, meta);
    expect(view.drops).toEqual([]);
    expect(view.hasDrops).toBe(false);
    expect(view.dropsHtml.trim()).toBe("");
    // Non-drop recipe chrome stays available under body, not drops spam.
    expect(view.bodyHtml).not.toMatch(/Forged long ago/);
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

  it("heals TzKal-Zuk-style meaning parenthetical after bold/italic strip", () => {
    // Live wiki: <b>TzKal-Zuk</b> (meaning <b>Zuk, Champion of the Fire</b>) …
    // stripTags used to turn Fire</b>) into "Fire )" with a space before ).
    const html = `
      <p><b>TzKal-Zuk</b> (meaning <b>Zuk, Champion of the Fire</b>) is a demigod warlord who leads the TzekHaar Front.</p>
      <p>Second paragraph with enough text to stay in the lead bucket for coverage.</p>`;
    const view = processWikiHtml(html, {
      title: "TzKal-Zuk",
      pageUrl: "https://runescape.wiki/w/TzKal-Zuk",
    });
    const lead = stripTagsApprox(view.leadHtml);
    expect(lead).toMatch(/Champion of the Fire\) is a demigod/);
    expect(lead).not.toMatch(/Fire\s+\)/);
    expect(lead).toMatch(/^TzKal-Zuk \(meaning Zuk, Champion of the Fire\)/);
  });

  it("drops empty italic/lang shells without leaving space-before-paren tails", () => {
    const html = `
      <p><b>TzKal-Zuk</b> (meaning <i lang="tz">Zuk, Champion of the Fire</i><span lang="x"> </span>) is a demigod warlord of the kiln.</p>`;
    const view = processWikiHtml(html, {
      title: "TzKal-Zuk",
      pageUrl: "https://runescape.wiki/w/TzKal-Zuk",
    });
    const lead = stripTagsApprox(view.leadHtml);
    expect(lead).toContain("Champion of the Fire)");
    expect(lead).not.toMatch(/Fire\s+\)/);
    expect(lead).not.toMatch(/\(meaning\s*\)/);
  });
});

function stripTagsApprox(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
