import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SummaryMetric } from "./SetupTab";

/** Renders to a string, so this needs no DOM and no browser. */
const render = (props: Parameters<typeof SummaryMetric>[0]) =>
  renderToStaticMarkup(createElement(SummaryMetric, props));

describe("SummaryMetric", () => {
  it("marks an incomplete total instead of faking a confident zero", () => {
    const html = render({ label: "Equipment Armour", value: "0", partialItems: 1 });
    expect(html).toContain('aria-label="Equipment Armour"');
    expect(html).toContain("≥ 0");
    expect(html).toContain("Partial · 1 item");
  });

  it("pluralises the partial count", () => {
    expect(render({ label: "Equipment Life", value: "12", partialItems: 2 })).toContain(
      "Partial · 2 items",
    );
  });

  it("states a complete total plainly", () => {
    const html = render({ label: "Equipment Armour", value: "1,234" });
    expect(html).toContain("1,234");
    expect(html).not.toContain("≥");
    expect(html).not.toContain("Partial");
  });
});
