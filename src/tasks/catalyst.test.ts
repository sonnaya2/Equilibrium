import { describe, expect, it } from "vitest";
import {
  applyCompletionRates,
  catalystRecordsPassIntegrity,
  loadCatalystSnapshot,
  parseCatalystTasksHtml,
} from "./catalyst";
import { mapCatalystLocality } from "./regionMap";

const HTML = `
<table><tbody><tr><th>Tier</th><th>Total tasks</th></tr><tr><td>Easy</td><td>229</td></tr></tbody></table>
<table class="wikitable sortable">
  <tbody>
    <tr><th>Locality</th><th>Task</th><th>Information</th><th>Requirements</th><th>Pts</th><th>Comp%</th></tr>
    <tr id="462" data-taskid="462" data-tbz-area-for-filtering="anachronia" data-tasktier="Easy">
      <td><span title="Anachronia"><img alt="Anachronia" src="/x.png" /></span></td>
      <td>Complete the base camp tutorial on Anachronia.</td>
      <td>Complete the Anachronia base camp tutorial.</td>
      <td>N/A</td>
      <td><span>10</span></td>
      <td>61.5%</td>
    </tr>
    <tr id="900" data-taskid="900" data-tbz-area-for-filtering="wilderness" data-tasktier="Master">
      <td><span title="Wilderness: General"><img alt="Wilderness: General" src="/y.png" /></span></td>
      <td>Equip an Eldritch Crossbow.</td>
      <td>Equip an eldritch crossbow.</td>
      <td>92 Ranged, 96 Fletching</td>
      <td>400</td>
      <td>&lt;0.1%</td>
    </tr>
    <tr id="12" data-taskid="12" data-tbz-area-for-filtering="global" data-tasktier="Easy">
      <td><span title="Global"><img alt="Global" src="/g.png" /></span></td>
      <td>Reach total level 100.</td>
      <td>Reach total level 100.</td>
      <td>N/A</td>
      <td>10</td>
      <td>88%</td>
    </tr>
  </tbody>
</table>`;

describe("mapCatalystLocality", () => {
  it("maps wiki area codes onto Equilibrium regions", () => {
    expect(mapCatalystLocality("anachronia")).toBe("anachronia");
    expect(mapCatalystLocality("elves")).toBe("tirannwn");
    expect(mapCatalystLocality("wilderness")).toBe("forinthry");
    expect(mapCatalystLocality("um")).toBe("misthalin");
    expect(mapCatalystLocality("fort")).toBe("misthalin");
    expect(mapCatalystLocality("global")).toBe("global");
    expect(mapCatalystLocality("not-a-place")).toBeUndefined();
  });
});

describe("parseCatalystTasksHtml", () => {
  it("reads task ids, locality attrs, and completion-rate qualifiers", () => {
    const records = parseCatalystTasksHtml(HTML);

    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({
      name: "Complete the base camp tutorial on Anachronia.",
      tier: "easy",
      points: 10,
      id: "wiki:462",
      wikiTaskId: 462,
      localityKey: "anachronia",
      localityLabel: "Anachronia",
      regionId: "anachronia",
      region: "Anachronia",
      catalystCompletionRate: 61.5,
      sourceLeague: "catalyst",
      testingOnly: true,
    });
    expect(records[1]).toMatchObject({
      tier: "master",
      points: 400,
      wikiTaskId: 900,
      localityKey: "wilderness",
      regionId: "forinthry",
      region: "Wilderness",
      requirements: "92 Ranged, 96 Fletching",
      catalystCompletionRate: 0.1,
      catalystCompletionRateQualifier: "<",
    });
    expect(records[2]).toMatchObject({
      wikiTaskId: 12,
      regionId: "global",
      region: "Global",
    });
  });
});

describe("applyCompletionRates", () => {
  it("overlays live module rates by wikiTaskId", () => {
    const base = parseCatalystTasksHtml(HTML);
    const live = applyCompletionRates(base, { t462: 70.2, t900: 0.05, t12: 91 });
    expect(live[0].catalystCompletionRate).toBe(70.2);
    expect(live[1].catalystCompletionRate).toBe(0.05);
    expect(live[1].catalystCompletionRateQualifier).toBe("<");
    expect(live[2].catalystCompletionRate).toBe(91);
    expect(live[2].catalystCompletionRateQualifier).toBeUndefined();
  });

  it("leaves snapshot rates when completion is missing", () => {
    const base = parseCatalystTasksHtml(HTML);
    const same = applyCompletionRates(base, null);
    expect(same[0].catalystCompletionRate).toBe(61.5);
  });

  it("keeps the <0.1 qualifier when the live module rounds the rate to zero", () => {
    const base = parseCatalystTasksHtml(HTML);
    const live = applyCompletionRates(base, { t900: 0 });
    expect(live[1].catalystCompletionRate).toBe(0);
    expect(live[1].catalystCompletionRateQualifier).toBe("<");
  });
});

describe("catalystRecordsPassIntegrity", () => {
  it("accepts counts at or above 90% of expected", () => {
    expect(catalystRecordsPassIntegrity(1117, 1117)).toBe(true);
    expect(catalystRecordsPassIntegrity(1006, 1117)).toBe(true);
  });

  it("rejects truncated scrapes", () => {
    expect(catalystRecordsPassIntegrity(1005, 1117)).toBe(false);
    expect(catalystRecordsPassIntegrity(2, 1117)).toBe(false);
  });
});

describe("loadCatalystSnapshot", () => {
  it("loads the static snapshot with integrity", () => {
    const result = loadCatalystSnapshot();
    expect(result.error).toBeUndefined();
    expect(result.fromSnapshot).toBe(true);
    expect(result.records.length).toBeGreaterThanOrEqual(1006);
    expect(result.records.every((r) => r.sourceLeague === "catalyst")).toBe(true);
    expect(result.records.every((r) => r.testingOnly === true)).toBe(true);
  });

  it("carries wiki task ids and Equilibrium region tags", () => {
    const { records } = loadCatalystSnapshot();
    expect(records.every((r) => typeof r.wikiTaskId === "number")).toBe(true);
    expect(records.every((r) => typeof r.regionId === "string")).toBe(true);
    expect(records.some((r) => r.regionId === "global")).toBe(true);
    expect(records.some((r) => r.regionId === "anachronia")).toBe(true);
  });
});
