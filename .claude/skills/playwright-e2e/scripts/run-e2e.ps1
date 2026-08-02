[CmdletBinding()]
param(
    [int]$Port = 0,
    [ValidateRange(1, 64)]
    [int]$Workers = 1,
    [string[]]$Test = @()
)

$ErrorActionPreference = "Stop"

if ($Port -ne 0 -and ($Port -lt 1024 -or $Port -gt 65535)) {
    throw "Port must be between 1024 and 65535."
}

$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..\..\..")).Path
$playwright = Join-Path $repo "node_modules\.bin\playwright.cmd"
$lock = Join-Path $repo ".next\dev\lock"
$candidates = if ($Port) { @($Port) } else { @(3100) + @(3102..3110) }

if (-not (Test-Path -LiteralPath $playwright)) {
    throw "Playwright is not installed. Run npm install first."
}

function Get-ListenerPids([int]$Candidate) {
    @(Get-NetTCPConnection -State Listen -LocalPort $Candidate -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique)
}

function Test-EquilibriumServer([int]$Candidate) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Candidate/combat" -TimeoutSec 3 -UseBasicParsing
        $response.StatusCode -eq 200 -and $response.Content -match "EQUILIBRIUM"
    }
    catch {
        $false
    }
}

$selectedPort = $null
$server = $null
$stdout = $null
$stderr = $null
$previousPort = $env:PLAYWRIGHT_PORT
$previousWorkers = $env:PLAYWRIGHT_WORKERS
$exitCode = 1

foreach ($candidate in $candidates) {
    if ((Get-ListenerPids $candidate).Count -and (Test-EquilibriumServer $candidate)) {
        $selectedPort = $candidate
        break
    }
}

if ($null -eq $selectedPort) {
    if (Test-Path -LiteralPath $lock) {
        throw "A Next dev lock exists for this checkout, but no candidate port serves Equilibrium. Stop or reuse that server before running E2E."
    }

    foreach ($candidate in $candidates) {
        if ((Get-ListenerPids $candidate).Count -eq 0) {
            $selectedPort = $candidate
            break
        }
    }

    if ($null -eq $selectedPort) {
        throw "No E2E port is free. Tried: $($candidates -join ', ')."
    }
}

try {
    if (-not (Test-EquilibriumServer $selectedPort)) {
        $tag = "rs3-equilibrium-e2e-$PID-$selectedPort"
        $stdout = Join-Path ([IO.Path]::GetTempPath()) "$tag.stdout.log"
        $stderr = Join-Path ([IO.Path]::GetTempPath()) "$tag.stderr.log"
        $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
        $server = Start-Process -FilePath $npm -ArgumentList @("run", "dev", "--", "--port", $selectedPort) -WorkingDirectory $repo -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
        $deadline = [DateTime]::UtcNow.AddSeconds(120)

        while (-not (Test-EquilibriumServer $selectedPort)) {
            if ($server.HasExited) {
                $log = @(Get-Content -LiteralPath $stdout, $stderr -Tail 40 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
                throw "Next dev exited before port $selectedPort became ready.`n$log"
            }
            if ([DateTime]::UtcNow -ge $deadline) {
                throw "Next dev did not become ready on port $selectedPort within 120 seconds."
            }
            Start-Sleep -Milliseconds 500
        }
    }

    $ownership = if ($server) { "started" } else { "reused" }
    Write-Host "Playwright server: http://127.0.0.1:$selectedPort ($ownership)"
    $env:PLAYWRIGHT_PORT = [string]$selectedPort
    $env:PLAYWRIGHT_WORKERS = [string]$Workers
    & $playwright test @Test
    $exitCode = $LASTEXITCODE
}
finally {
    $cleanupFailed = $false

    if ($null -eq $previousPort) {
        Remove-Item Env:PLAYWRIGHT_PORT -ErrorAction SilentlyContinue
    }
    else {
        $env:PLAYWRIGHT_PORT = $previousPort
    }
    if ($null -eq $previousWorkers) {
        Remove-Item Env:PLAYWRIGHT_WORKERS -ErrorAction SilentlyContinue
    }
    else {
        $env:PLAYWRIGHT_WORKERS = $previousWorkers
    }

    if ($server) {
        foreach ($listenerId in @(Get-ListenerPids $selectedPort)) {
            $listener = Get-CimInstance Win32_Process -Filter "ProcessId=$listenerId" -ErrorAction SilentlyContinue
            if ($listener.CommandLine -notlike "*$repo*") {
                $cleanupFailed = $true
                continue
            }
            & taskkill.exe /PID $listenerId /T /F *> $null
        }
        & taskkill.exe /PID $server.Id /T /F *> $null
        $cleanupDeadline = [DateTime]::UtcNow.AddSeconds(5)
        while ((Get-ListenerPids $selectedPort).Count -and [DateTime]::UtcNow -lt $cleanupDeadline) {
            Start-Sleep -Milliseconds 100
        }
        $cleanupFailed = $cleanupFailed -or (Get-ListenerPids $selectedPort).Count -gt 0
        if (-not $cleanupFailed) {
            Write-Host "Stopped Playwright server on port $selectedPort."
        }
    }

    foreach ($path in @($stdout, $stderr)) {
        if ($path -and (Test-Path -LiteralPath $path)) {
            Remove-Item -LiteralPath $path -Force
        }
    }

    if ($cleanupFailed) {
        throw "Failed to stop the Playwright server on port $selectedPort."
    }
}

exit $exitCode
