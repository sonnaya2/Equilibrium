import fs from "node:fs";

const doc = JSON.parse(fs.readFileSync("scraped-data/combat-consumables-pass-1.json", "utf8"));
const errors = [];
const banned = [
  "unlock the power",
  "game changer",
  "seamlessly",
  "robust solution",
  "comprehensive solution",
  "delve into",
  "revolutionize",
  "cutting edge",
  "elevate your",
  "supercharge your",
];

const checkUrls = (id, urls) => {
  if (!Array.isArray(urls) || urls.length === 0) errors.push(`${id}: missing source URLs`);
  for (const url of urls ?? []) {
    try { new URL(url); } catch { errors.push(`${id}: invalid URL ${url}`); }
  }
};

const overload = doc.overload_chain;
if (overload?.base_overload?.herblore_level !== 96) errors.push("base overload Herblore requirement drifted");
if (overload?.recipe_shop_gate?.region_hint !== "tirannwn") errors.push("Meilyr Recipe Shop must retain Tirannwn geography");
checkUrls("overload recipe shop", overload?.recipe_shop_gate?.source_urls);

const overloadById = new Map((overload?.records ?? []).map((row) => [row.id, row]));
for (const [id, level, cost] of [
  ["potion:overload-salve", 97, 800_000],
  ["potion:supreme-overload", 98, 900_000],
  ["potion:supreme-overload-salve", 99, 1_000_000],
  ["potion:elder-overload", 106, 1_200_000],
  ["potion:elder-overload-salve", 107, 1_500_000],
]) {
  const row = overloadById.get(id);
  if (!row) errors.push(`missing overload-chain row ${id}`);
  else {
    if (row.herblore_level !== level) errors.push(`${id}: expected Herblore ${level}`);
    if (row.recipe_shop_cost_coins !== cost) errors.push(`${id}: recipe-shop cost drifted`);
    if (row.recipe_unlock_required !== true) errors.push(`${id}: permanent recipe gate disappeared`);
    checkUrls(id, row.source_urls);
  }
}

const workbench = (doc.production_infrastructure ?? []).find((row) => row.id === "fort-forinthry:botanists-workbench");
if (!workbench) errors.push("missing Botanist's Workbench");
else {
  if (workbench.region_status !== "unresolved_fort_wilderness_boundary") errors.push("Botanist's Workbench must preserve Fort/Wilderness boundary ambiguity");
  const tiers = workbench.tiers?.map((row) => [row.tier, row.construction_level]) ?? [];
  if (JSON.stringify(tiers) !== JSON.stringify([[1,54],[2,78],[3,92]])) errors.push(`Botanist's Workbench tier levels drifted: ${JSON.stringify(tiers)}`);
  checkUrls(workbench.id, workbench.source_urls);
}

const adren = (doc.adrenaline ?? []).find((row) => row.id === "potion:adrenaline-renewal");
if (!adren) errors.push("missing adrenaline renewal");
else {
  const tiers = adren.recipe_tiers?.map((row) => row.herblore_level) ?? [];
  if (JSON.stringify(tiers) !== JSON.stringify([115,117,119])) errors.push(`adrenaline renewal recipe levels drifted: ${tiers.join(",")}`);
  const regular = adren.recipe_tiers?.[0]?.ingredients ?? [];
  const improved = adren.recipe_tiers?.[2]?.ingredients ?? [];
  if (!regular.some((row) => row.item === "Bottled dinosaur roar" && row.quantity === 2)) errors.push("adrenaline renewal regular dinosaur-roar quantity drifted");
  if (!improved.some((row) => row.item === "Bottled dinosaur roar" && row.quantity === 1)) errors.push("adrenaline renewal +2 dinosaur-roar quantity drifted");
  if (!String(adren.effect_summary ?? "").includes("40%")) errors.push("adrenaline renewal effect total drifted");
  checkUrls(adren.id, adren.source_urls);
}

const vuln = (doc.bombs ?? []).find((row) => row.id === "bomb:vulnerability");
if (!vuln) errors.push("missing vulnerability bomb");
else {
  const tiers = vuln.recipe_tiers?.map((row) => row.herblore_level) ?? [];
  if (JSON.stringify(tiers) !== JSON.stringify([103,105,107])) errors.push(`vulnerability-bomb recipe levels drifted: ${tiers.join(",")}`);
  const base = vuln.recipe_tiers?.[0]?.ingredients ?? [];
  const plus2 = vuln.recipe_tiers?.[2]?.ingredients ?? [];
  for (const rune of ["Soul rune", "Chaos rune"]) {
    if (!base.some((row) => row.item === rune && row.quantity === 5)) errors.push(`vulnerability bomb base ${rune} quantity drifted`);
    if (!plus2.some((row) => row.item === rune && row.quantity === 3)) errors.push(`vulnerability bomb +2 ${rune} quantity drifted`);
  }
  if (!base.some((row) => row.item === "Bottled dinosaur roar" && row.quantity === 2)) errors.push("vulnerability bomb base dinosaur-roar quantity drifted");
  if (!plus2.some((row) => row.item === "Bottled dinosaur roar" && row.quantity === 1)) errors.push("vulnerability bomb +2 dinosaur-roar quantity drifted");
  checkUrls(vuln.id, vuln.source_urls);
}

const poison = (doc.poison_stack ?? []).find((row) => row.id === "potion:weapon-poison-plus-plus-plus");
if (!poison) errors.push("missing Weapon poison+++");
else {
  if (poison.herblore_level !== 100) errors.push("Weapon poison+++ Herblore level drifted");
  if (poison.duration_minutes !== 12) errors.push("Weapon poison+++ duration drifted");
  const recipe = poison.ingredients ?? [];
  for (const ingredient of ["Weapon poison++ (3)", "Poison slime", "Primal extract"]) {
    if (!recipe.some((row) => row.item === ingredient && row.quantity === 1)) errors.push(`Weapon poison+++ missing ${ingredient}`);
  }
  checkUrls(poison.id, poison.source_urls);
}

const kwuarm = (doc.poison_stack ?? []).find((row) => row.id === "incense:kwuarm");
if (!kwuarm) errors.push("missing Kwuarm incense sticks");
else {
  if (kwuarm.firemaking_level !== 54) errors.push("Kwuarm incense current Firemaking requirement must be 54");
  if (!String(kwuarm.effect_summary ?? "").includes("2.5%") || !String(kwuarm.effect_summary ?? "").includes("10%")) errors.push("Kwuarm incense poison scaling drifted");
  if (kwuarm.incense_mechanic?.maximum_potency !== 4 || kwuarm.incense_mechanic?.overload_sticks_consumed !== 6) errors.push("incense potency/overload mechanic drifted");
  checkUrls(kwuarm.id, kwuarm.source_urls);
}

const { snapshot_date: _sd, purpose: _p, policy: _pol, ...dataRows } = doc;
const whole = JSON.stringify(dataRows).toLowerCase();
for (const phrase of banned) if (whole.includes(phrase)) errors.push(`document clanker phrase ${phrase}`);
for (const phrase of ["grand exchange price", "ge price", "profit per"] ) if (whole.includes(phrase)) errors.push(`live-price language leaked into routing data: ${phrase}`);

if (errors.length) {
  console.error("COMBAT CONSUMABLE PASS 1 AUDIT FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("COMBAT CONSUMABLE PASS 1 AUDIT OK");
}
