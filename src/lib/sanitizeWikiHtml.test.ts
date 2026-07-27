import { describe, expect, it } from "vitest";
import { sanitizeWikiHtml, WIKI_HTML_SANITIZE_POLICY } from "./sanitizeWikiHtml";
import { finalizeArticleHtml, processWikiHtml } from "./wikiArticle";

describe("sanitizeWikiHtml — attacks", () => {
  it("strips script tags", () => {
    const out = sanitizeWikiHtml(`<p>ok</p><script>alert(1)</script>`);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/alert/);
    expect(out).toMatch(/ok/);
  });

  it("strips unclosed script openers", () => {
    const out = sanitizeWikiHtml(`<p>safe</p><script>alert(1)`);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/alert/);
    expect(out).toMatch(/safe/);
  });

  it("strips inline onclick handlers", () => {
    const out = sanitizeWikiHtml(`<p onclick="alert(1)">click</p>`);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/alert/);
    expect(out).toMatch(/click/);
  });

  it("strips javascript: URLs", () => {
    const out = sanitizeWikiHtml(`<a href="javascript:alert(1)">x</a>`);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/alert/);
  });

  it("strips encoded dangerous URLs", () => {
    const out = sanitizeWikiHtml(
      `<a href="java&#115;cript:alert(1)">x</a><a href="&#106;avascript:alert(2)">y</a>`,
    );
    expect(out).not.toMatch(/javascript/i);
    expect(out).not.toMatch(/alert/);
  });

  it("handles malformed nested tags without leaking script", () => {
    const out = sanitizeWikiHtml(
      `<div><p><script>evil()</script></p><b>ok</b><iframe src="x"></div>`,
    );
    expect(out).not.toMatch(/script/i);
    expect(out).not.toMatch(/iframe/i);
    expect(out).not.toMatch(/evil/);
    expect(out).toMatch(/ok/);
  });

  it("removes iframe and object elements", () => {
    const out = sanitizeWikiHtml(
      `<p>a</p><iframe src="https://evil.test"></iframe><object data="x"></object>`,
    );
    expect(out).not.toMatch(/iframe/i);
    expect(out).not.toMatch(/object/i);
    expect(out).toMatch(/>a</);
  });

  it("strips style tags, inline style, svg, math, forms, media", () => {
    const out = sanitizeWikiHtml(`
      <style>.x{color:red}</style>
      <p style="color:red">prose</p>
      <svg onload="alert(1)"></svg>
      <math></math>
      <form action="https://evil.test"><input name="x"></form>
      <video src="x"></video>
      <img src="https://runescape.wiki/images/x.png" alt="x">
    `);
    expect(out).not.toMatch(/<style/i);
    expect(out).not.toMatch(/style=/i);
    expect(out).not.toMatch(/<svg/i);
    expect(out).not.toMatch(/math/i);
    expect(out).not.toMatch(/form/i);
    expect(out).not.toMatch(/video/i);
    expect(out).not.toMatch(/<img/i);
    expect(out).toMatch(/prose/);
  });

  it("restricts links to https and adds safe rel/target", () => {
    const out = sanitizeWikiHtml(
      `<a href="https://runescape.wiki/w/Home">wiki</a>
       <a href="http://insecure.test">no</a>
       <a href="https://example.com/page">ext</a>`,
    );
    expect(out).toMatch(/href="https:\/\/runescape\.wiki\/w\/Home"/);
    expect(out).toMatch(/rel="noreferrer noopener"/);
    expect(out).toMatch(/target="_blank"/);
    expect(out).not.toMatch(/http:\/\/insecure/);
  });
});

describe("sanitizeWikiHtml — valid wiki fragments", () => {
  it("preserves tables, lists, paragraphs, emphasis, and links", () => {
    const html = `
      <p>Lead <strong>bold</strong> and <em>italic</em>.</p>
      <ul><li>One</li><li>Two</li></ul>
      <table class="wikitable">
        <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
        <tr><td>Coins</td><td>100</td><td>Always</td></tr>
      </table>
      <a href="/w/Coins">Coins</a>
    `;
    const out = sanitizeWikiHtml(html);
    expect(out).toMatch(/Lead/);
    expect(out).toMatch(/<strong>/);
    expect(out).toMatch(/<em>/);
    expect(out).toMatch(/<ul>/);
    expect(out).toMatch(/<table/);
    expect(out).toMatch(/Coins/);
    expect(out).toMatch(/Always/);
    expect(out).toMatch(/href="https:\/\/runescape\.wiki\/w\/Coins"/);
  });

  it("preserves ordinary RuneScape Wiki article fragments through processWikiHtml", () => {
    const raw = `
      <div class="mw-parser-output">
        <p>The <b>Arch-Glacor</b> is a boss in the Elder God Wars Dungeon.</p>
        <h2><span class="mw-headline">Drops</span></h2>
        <table class="wikitable">
          <tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr>
          <tr><td><a href="/w/Frozen_core_of_Leng" title="Frozen core of Leng">Frozen core of Leng</a></td><td>1</td><td>Rare</td></tr>
        </table>
        <script>document.cookie</script>
        <p onclick="steal()">extra</p>
      </div>
    `;
    const view = finalizeArticleHtml(
      processWikiHtml(raw, {
        title: "Arch-Glacor",
        pageUrl: "https://runescape.wiki/w/Arch-Glacor",
      }),
    );
    expect(view.leadHtml).toMatch(/Arch-Glacor|boss|Elder God Wars/i);
    expect(view.leadHtml).not.toMatch(/script|onclick|steal|cookie/i);
    expect(view.drops.length).toBeGreaterThan(0);
    expect(view.drops[0]?.item).toMatch(/Frozen core/i);
    expect(view.bodyHtml + view.dropsHtml + view.leadHtml).not.toMatch(
      /<script|javascript:|onclick=/i,
    );
  });
});

describe("sanitize policy", () => {
  it("documents allowed tags and https-only links", () => {
    expect(WIKI_HTML_SANITIZE_POLICY.allowedTags).toContain("table");
    expect(WIKI_HTML_SANITIZE_POLICY.allowedTags).toContain("a");
    expect(WIKI_HTML_SANITIZE_POLICY.forbiddenTags).toContain("script");
    expect(WIKI_HTML_SANITIZE_POLICY.linkSchemes).toEqual(["https"]);
  });
});
