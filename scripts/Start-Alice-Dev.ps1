param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [switch]$PrepareOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Disable-EnvLocal {
  param([string]$Root)

  $envPath = Join-Path $Root '.env.local'
  if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    Write-Host 'No .env.local file found; local mode is clear.'
    return
  }

  $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $candidateName = ".env.local.disabled-$timestamp"
  $candidatePath = Join-Path $Root $candidateName
  $suffix = 2

  while (Test-Path -LiteralPath $candidatePath) {
    $candidateName = ".env.local.disabled-$timestamp-$suffix"
    $candidatePath = Join-Path $Root $candidateName
    $suffix += 1
  }

  Move-Item -LiteralPath $envPath -Destination $candidatePath
  Write-Host "Renamed .env.local to $candidateName so Alice starts in local mode."
}

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
    [string]$WorkingDirectory
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $Command
  foreach ($argument in $Arguments) {
    [void]$startInfo.ArgumentList.Add($argument)
  }
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.CreateNoWindow = $true

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
Disable-EnvLocal -Root $ProjectRoot

if ($PrepareOnly) {
  Write-Host 'Preparation complete. Skipping server startup because -PrepareOnly was provided.'
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
  $processes += Start-AliceProcess -Name 'frontend' -Command $npmCommand -Arguments @('run', 'dev') -WorkingDirectory $ProjectRoot

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
