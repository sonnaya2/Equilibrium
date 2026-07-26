# Optional local runner (not part of product). Safe to delete.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
node --input-type=module -e "import('./scripts/lib/equipment-wiki.mjs').then(m => m.selfCheck())"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node scripts/sync-combat-equipment.mjs --min-tier=70 --style=all
exit $LASTEXITCODE
