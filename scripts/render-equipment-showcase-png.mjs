import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const regionsData = JSON.parse(fs.readFileSync(path.join(root, "data/league/regions.json"), "utf8"));
const showcase = JSON.parse(fs.readFileSync(path.join(root, "data/combat/equipment-showcase.json"), "utf8"));
const regions = Array.isArray(regionsData) ? regionsData : regionsData.records;
const items = showcase.records || [];
const compact = new Set(["fremennik", "havenhythe", "karamja", "kandarin"]);
const colors = { misthalin: "#1261bd", havenhythe: "#735e77", karamja: "#79af14", asgarnia: "#c75b18", kandarin: "#c91e31", fremennik: "#70503e", forinthry: "#4d4f54", desert: "#d3bd08", morytania: "#08736b", tirannwn: "#079356", anachronia: "#8c4b2e" };
const width = 1460, leftWidth = 1000, sideWidth = 460, masthead = 150, gap = 8;
const heights = regions.map((region) => compact.has(region.id) ? 78 : 174);
const height = masthead + heights.reduce((sum, value) => sum + value, 0) + gap * regions.length;

const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const dataUri = (file) => fs.existsSync(file) ? `data:image/webp;base64,${fs.readFileSync(file).toString("base64")}` : null;
const iconFile = (item) => path.join(root, "public/game/combat/equipment", `${String(item.iconId || item.id).replace(/^(?:item|equipment):/, "")}.webp`);
const crestFile = (region) => path.join(root, "public/game/regions", `${region.id}.webp`);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#25100e"/><rect width="${leftWidth}" height="${masthead}" fill="#183224"/><rect x="${leftWidth}" width="${sideWidth}" height="${height}" fill="#211f19"/><text x="500" y="58" text-anchor="middle" fill="#f1e9d6" font-family="Georgia" font-size="42" font-weight="800">LEAGUES II</text><text x="500" y="88" text-anchor="middle" fill="#e0b264" font-family="Georgia" font-size="15" font-weight="700" letter-spacing="7">EQUILIBRIUM</text><text x="500" y="130" text-anchor="middle" fill="#55b574" font-family="Georgia" font-size="43" font-weight="800">Regional Unlocks</text><rect x="${leftWidth}" width="${sideWidth}" height="58" fill="#4b4537"/><text x="1230" y="35" text-anchor="middle" fill="#f1e9d6" font-family="monospace" font-size="14" font-weight="700">★ COMBO ITEM UNLOCKS ★</text>`;

let y = masthead + gap;
for (let index = 0; index < regions.length; index++) {
  const region = regions[index];
  const bandHeight = heights[index];
  const regionItems = items.filter((item) => item.regions?.includes(region.id));
  const fg = region.id === "desert" ? "#171405" : "#fff";
  svg += `<rect x="0" y="${y}" width="${leftWidth}" height="${bandHeight}" fill="${colors[region.id] || "#555"}"/><rect x="0" y="${y}" width="112" height="${bandHeight}" fill="#000" opacity=".2"/><rect x="8" y="${y + 7}" width="96" height="18" fill="#111" opacity=".72" stroke="#fff" stroke-width="2"/><text x="13" y="${y + 20}" fill="#fff" font-family="monospace" font-size="10" font-weight="800">${esc(region.name.toUpperCase())}</text>`;
  const crest = dataUri(crestFile(region));
  if (crest) svg += `<image href="${crest}" x="24" y="${y + 29}" width="64" height="${Math.max(38, bandHeight - 40)}" preserveAspectRatio="xMidYMid meet"/>`;
  svg += `<text x="105" y="${y + bandHeight - 6}" text-anchor="end" fill="${fg}" font-family="monospace" font-size="10">${regionItems.length}</text>`;
  const rows = compact.has(region.id) ? 1 : 3;
  const columns = Math.max(1, Math.ceil(regionItems.length / rows));
  const cellWidth = Math.min(38, Math.max(15, Math.floor((leftWidth - 132) / columns)));
  const rowHeight = bandHeight / rows;
  regionItems.forEach((item, itemIndex) => {
    const row = itemIndex % rows, column = Math.floor(itemIndex / rows);
    const x = 124 + column * cellWidth, iy = y + row * rowHeight;
    const icon = dataUri(iconFile(item));
    if (icon) svg += `<image href="${icon}" x="${x}" y="${iy + 4}" width="${Math.max(12, cellWidth - 4)}" height="${Math.max(12, rowHeight - 8)}" preserveAspectRatio="xMidYMid meet"/>`;
    else svg += `<text x="${x + cellWidth / 2}" y="${iy + rowHeight / 2 + 4}" text-anchor="middle" fill="#fff" font-family="monospace" font-size="8">${esc(item.name.split(/\s+/).slice(0,2).map((part)=>part[0]).join(""))}</text>`;
    if (item.memberCount > 1) svg += `<rect x="${x + Math.max(0, cellWidth - 18)}" y="${iy + rowHeight - 13}" width="18" height="11" fill="#fff" stroke="#111"/><text x="${x + Math.max(9, cellWidth - 9)}" y="${iy + rowHeight - 5}" text-anchor="middle" fill="#111" font-family="monospace" font-size="8" font-weight="800">${item.kind === "set" ? "SET" : `×${item.memberCount}`}</text>`;
  });
  y += bandHeight + gap;
}

let comboY = 82;
for (const item of items.filter((entry) => entry.regions?.length > 1)) {
  if (comboY + 48 > height - 30) break;
  const icon = dataUri(iconFile(item));
  if (icon) svg += `<image href="${icon}" x="${leftWidth + 28}" y="${comboY - 10}" width="34" height="34" preserveAspectRatio="xMidYMid meet"/>`;
  svg += `<text x="${leftWidth + 72}" y="${comboY}" fill="#e7db66" font-family="Arial" font-size="12">${esc(item.name.slice(0, 48))}</text><text x="${leftWidth + 72}" y="${comboY + 15}" fill="#c4b59a" font-family="monospace" font-size="8">${esc(item.regions.join(" + "))}</text>`;
  comboY += 45;
}
svg += `</svg>`;
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(path.join(root, "equilibrium-regional-combat-unlocks.png"));
console.log(JSON.stringify({ width, height, output: "equilibrium-regional-combat-unlocks.png" }));
