import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "equilibrium-region-equipment.html");
let html = fs.readFileSync(file, "utf8");
const compact = ':is([data-region="fremennik"], [data-region="havenhythe"], [data-region="karamja"], [data-region="kandarin"])';

html = html.replace('.region-band[data-region="fremennik"] { --region-bg: #70503e; min-height: 78px; }', '.region-band[data-region="fremennik"] { --region-bg: #70503e; }');
if (!html.includes(`.region-band${compact} { min-height: 78px; }`)) {
  html = html.replace('.region-band[data-region="anachronia"] { --region-bg: #8c4b2e; }', `.region-band[data-region="anachronia"] { --region-bg: #8c4b2e; }\n    .region-band${compact} { min-height: 78px; }`);
}
html = html.replace('.region-band[data-region="fremennik"] .region-crest', `.region-band${compact} .region-crest`);
html = html.replace('.region-band[data-region="fremennik"] .region-identity', `.region-band${compact} .region-identity`);
html = html.replace('.region-band[data-region="fremennik"] .region-items', `.region-band${compact} .region-items`);
html = html.replace('.region-band[data-region="fremennik"] { min-height: 70px; }', `.region-band${compact} { min-height: 70px; }`);

if (!html.includes('.item-fallback {')) {
  html = html.replace(
    '    .item-button img { max-width: 32px; max-height: 32px; object-fit: contain; filter: drop-shadow(0 1px 1px rgba(0,0,0,.2)); }',
    `    .item-button img { max-width: 32px; max-height: 32px; object-fit: contain; filter: drop-shadow(0 1px 1px rgba(0,0,0,.2)); }\n    .item-fallback { width: 30px; height: 30px; display: grid; place-items: center; color: rgba(255,255,255,.9); background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.42); font: 800 9px/1 var(--mono); }`,
  );
}

if (!html.includes('const compactRegions = new Set')) {
  html = html.replace(/(const regionColors = \{[\s\S]*?\n      \};)/, '$1\n\n      const compactRegions = new Set(["fremennik", "havenhythe", "karamja", "kandarin"]);');
}
html = html.replaceAll('region.id === "fremennik" ? 1 : 3', 'compactRegions.has(region.id) ? 1 : 3');
html = html.replaceAll('region.id === "fremennik" ? 78 : 174', 'compactRegions.has(region.id) ? 78 : 174');
html = html.replace('if (!path) return `<span aria-hidden="true">${escapeHtml(initials(item.name))}</span>`;', 'if (!path) return `<span class="item-fallback" aria-label="No local icon">${escapeHtml(initials(item.name))}</span>`;');
html = html.replace('state.items = records.filter((item) => item?.id && item?.iconId && iconsData.includes(slugFromId(item.iconId)));', 'state.items = records.filter((item) => item?.id);');
html = html.replaceAll('data-item-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)}">', 'data-item-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.name)}" title="${escapeHtml(item.name)}">');
html = html.replaceAll('${item.memberCount > 1 ? `<span class="member-count">×${item.memberCount}</span>` : ""}', '${item.memberCount > 1 ? `<span class="member-count">${item.kind === "set" ? "SET" : `×${item.memberCount}`}</span>` : ""}');
html = html.replace('PNG export also requires the repository to be served over http://localhost.', 'Choose the three JSON files when opening the HTML directly. The PNG button downloads the generated PNG beside this file.');

html = html.replace(/      async function savePng\(\) \{[\s\S]*?\n      \}\n\n      elements\.search\.addEventListener/, `      async function savePng() {
        elements.savePng.disabled = true;
        elements.savePng.textContent = "Downloading…";
        const link = document.createElement("a");
        link.href = "./equilibrium-regional-combat-unlocks.png";
        link.download = "equilibrium-regional-combat-unlocks.png";
        document.body.append(link);
        link.click();
        link.remove();
      }

      elements.search.addEventListener`);

fs.writeFileSync(file, html.endsWith("\n") ? html : `${html}\n`);
console.log(JSON.stringify({ file, bytes: Buffer.byteLength(html), compactRegions: 4, generatedPngDownload: html.includes("equilibrium-regional-combat-unlocks.png") }, null, 2));
