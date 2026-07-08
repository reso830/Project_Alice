param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [switch]$PrepareOnly,
  [switch]$SelfTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-NpmCommand {
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($null -ne $npm) {
    return $npm.Source
  }

  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($null -ne $npm) {
    return $npm.Source
  }

  throw 'npm was not found on PATH. Install Node.js 20.19 or later, then try again.'
}

function Start-AliceProcess {
  param(
    [string]$Name,
    [string]$Command,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [System.Collections.IDictionary]$Environment = @{}
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $Command
  # Use the .Arguments string, not .ArgumentList: the latter only exists on
  # PowerShell 7 / .NET Core, and this launcher runs under powershell.exe
  # (Windows PowerShell 5.1 / .NET Framework) via Start-Alice-Dev.cmd and
  # `npm run alice`, where .ArgumentList is absent. Every call site passes
  # whitespace-free tokens (e.g. 'run', 'server:dev'), so a plain join is safe.
  $startInfo.Arguments = ($Arguments -join ' ')
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.CreateNoWindow = $true

  # StartInfo.EnvironmentVariables inherits the parent environment; overrides
  # here win over Vite's .env files (a value already in process.env takes
  # precedence), so we can force local mode without touching any file on disk.
  foreach ($key in $Environment.Keys) {
    $startInfo.EnvironmentVariables[$key] = [string]$Environment[$key]
  }

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  $process.EnableRaisingEvents = $true

  [void]$process.Start()

  $stdout = Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -MessageData $Name -Action {
    if ($EventArgs.Data) {
      Write-Host "[$($Event.MessageData)] $($EventArgs.Data)"
    }
  }
  $stderr = Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -MessageData $Name -Action {
    if ($EventArgs.Data) {
      Write-Host "[$($Event.MessageData)] $($EventArgs.Data)"
    }
  }

  $process.BeginOutputReadLine()
  $process.BeginErrorReadLine()

  [pscustomobject]@{
    Name = $Name
    Process = $process
    Subscriptions = @($stdout, $stderr)
  }
}

function Get-DescendantProcessIds {
  param([int]$ParentProcessId)

  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentProcessId" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    Get-DescendantProcessIds -ParentProcessId ([int]$child.ProcessId)
    [int]$child.ProcessId
  }
}

function Stop-AliceProcessTree {
  param([object[]]$ProcessEntries)

  foreach ($entry in $ProcessEntries) {
    foreach ($subscription in $entry.Subscriptions) {
      Unregister-Event -SubscriptionId $subscription.Id -ErrorAction SilentlyContinue
      Remove-Job -Id $subscription.Id -Force -ErrorAction SilentlyContinue
    }
  }

  foreach ($entry in $ProcessEntries) {
    $process = $entry.Process
    if ($process.HasExited) {
      continue
    }

    $processIds = @(Get-DescendantProcessIds -ParentProcessId $process.Id) + $process.Id
    foreach ($processId in $processIds) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

$ProjectRoot = (Resolve-Path $ProjectRoot).Path

# Vite auto-loads .env.local and exposes VITE_SUPABASE_* to the browser bundle,
# which would flip the frontend into hosted-auth mode against a local backend.
# Starting the Vite dev server with these cleared keeps the frontend local
# without moving or deleting the developer's .env.local (it is left untouched).
# The backend (npm run server:dev) is always local regardless of .env.local; to
# run the full hosted stack locally use `npm run server:dev:hosted` + `npm run dev`.
$FrontendLocalEnv = [ordered]@{
  'VITE_SUPABASE_URL'      = ''
  'VITE_SUPABASE_ANON_KEY' = ''
}

if ($PrepareOnly) {
  Write-Host 'Frontend will start in local mode with these overrides (your .env.local is untouched):'
  foreach ($key in $FrontendLocalEnv.Keys) {
    Write-Host "  $key=$($FrontendLocalEnv[$key])"
  }
  Write-Host 'Preparation complete. Skipping server startup because -PrepareOnly was provided.'
  exit 0
}

if ($SelfTest) {
  # Exercise the real Start-AliceProcess path (argument passing + env override +
  # process start + teardown) with a short-lived node probe instead of the dev
  # servers, so a regression to .ArgumentList (absent on PS 5.1) is caught. The
  # probe reports the VITE_ vars it actually receives; the output path is passed
  # via env (not an argument) to avoid any quoting concerns.
  $node = Get-Command node -ErrorAction SilentlyContinue
  if ($null -eq $node) {
    throw 'node was not found on PATH for -SelfTest.'
  }

  $probeScript = Join-Path $ProjectRoot '.selftest-probe.js'
  $probeOutput = Join-Path $ProjectRoot '.selftest-output.txt'
  @(
    "const fs = require('fs');",
    "const url = process.env.VITE_SUPABASE_URL === undefined ? 'unset' : process.env.VITE_SUPABASE_URL;",
    "fs.writeFileSync(process.env.ALICE_SELFTEST_OUT, 'VITE_SUPABASE_URL=[' + url + ']');"
  ) -join "`n" | Set-Content -LiteralPath $probeScript -Encoding UTF8

  $probeEnv = [ordered]@{}
  foreach ($key in $FrontendLocalEnv.Keys) { $probeEnv[$key] = $FrontendLocalEnv[$key] }
  $probeEnv['ALICE_SELFTEST_OUT'] = $probeOutput

  $probe = Start-AliceProcess -Name 'selftest' -Command $node.Source -Arguments @('.selftest-probe.js') -WorkingDirectory $ProjectRoot -Environment $probeEnv
  try {
    $probe.Process.WaitForExit()
    if (Test-Path -LiteralPath $probeOutput) {
      Write-Host ("SelfTest: " + (Get-Content -LiteralPath $probeOutput -Raw).Trim())
    }
    else {
      throw 'SelfTest: probe process produced no output.'
    }
  }
  finally {
    Stop-AliceProcessTree -ProcessEntries @($probe)
    Remove-Item -LiteralPath $probeScript -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $probeOutput -Force -ErrorAction SilentlyContinue
  }
  exit 0
}

$npmCommand = Resolve-NpmCommand
$processes = @()

Write-Host 'Starting Alice local development mode...'
Write-Host 'Backend:  http://localhost:3001'
Write-Host 'Frontend: http://localhost:5173'
Write-Host 'Press Ctrl+C or close this window to stop Alice.'

try {
  $processes += Start-AliceProcess -Name 'backend' -Command $npmCommand -Arguments @('run', 'server:dev') -WorkingDirectory $ProjectRoot
  $processes += Start-AliceProcess -Name 'frontend' -Command $npmCommand -Arguments @('run', 'dev') -WorkingDirectory $ProjectRoot -Environment $FrontendLocalEnv

  while ($true) {
    foreach ($entry in $processes) {
      if ($entry.Process.WaitForExit(250)) {
        Write-Host "$($entry.Name) exited with code $($entry.Process.ExitCode). Stopping Alice..."
        exit $entry.Process.ExitCode
      }
    }
  }
}
finally {
  Stop-AliceProcessTree -ProcessEntries $processes
  Write-Host 'Alice local development processes stopped.'
}
