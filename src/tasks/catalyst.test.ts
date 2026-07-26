import { describe, expect, it } from "vitest";
import { catalystRecordsPassIntegrity, parseCatalystTasksHtml } from "./catalyst";

const HTML = `
<table><tbody><tr><th>Tier</th><th>Total tasks</th></tr><tr><td>Easy</td><td>229</td></tr></tbody></table>
<table class="wikitable sortable">
  <tbody>
    <tr><th>Locality</th><th>Task</th><th>Information</th><th>Requirements</th><th>Pts</th><th>Comp%</th></tr>
    <tr>
      <td><a>Anachronia</a></td>
      <td>Complete the base camp tutorial on Anachronia.</td>
      <td>Complete the Anachronia base camp tutorial.</td>
      <td>N/A</td>
      <td><span>10</span></td>
      <td>61.5%</td>
    </tr>
    <tr>
      <td>Wilderness: General</td>
      <td>Equip an Eldritch Crossbow.</td>
      <td>Equip an eldritch crossbow.</td>
      <td>92 Ranged, 96 Fletching</td>
      <td>400</td>
      <td>&lt;0.1%</td>
    </tr>
  </tbody>
</table>`;

describe("parseCatalystTasksHtml", () => {
  it("normalizes Catalyst rows and keeps completion-rate qualifiers", () => {
    const records = parseCatalystTasksHtml(HTML);

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      name: "Complete the base camp tutorial on Anachronia.",
      tier: "easy",
      points: 10,
      region: "Anachronia",
      catalystCompletionRate: 61.5,
      sourceLeague: "catalyst",
      testingOnly: true,
    });
    expect(records[1]).toMatchObject({
      tier: "master",
      points: 400,
      requirements: "92 Ranged, 96 Fletching",
      catalystCompletionRate: 0.1,
      catalystCompletionRateQualifier: "<",
    });
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
