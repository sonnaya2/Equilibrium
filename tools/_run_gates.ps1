# Local gate: typecheck + unit tests. From repo root:
#   pwsh tools/_run_gates.ps1
$ErrorActionPreference = "Continue"
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host "==== npx tsc --noEmit ===="
npx tsc --noEmit --pretty false
$tsc = $LASTEXITCODE
Write-Host "tsc_exit=$tsc"
Write-Host "==== npm test ===="
npm test
$test = $LASTEXITCODE
Write-Host "test_exit=$test"
exit $(if ($tsc -ne 0) { $tsc } elseif ($test -ne 0) { $test } else { 0 })
