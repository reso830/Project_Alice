param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("spec", "req-review", "implement", "implement-next", "implement-auto", "implement-next-auto", "mark-implemented", "check-implementation", "check-next", "next-phase", "create-pr", "claude-pr-review", "codex-pr-review", "run-all")]
    [string]$Action,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$FeatureName,

    [Parameter(Position = 2)]
    [string]$FeatureBrief = "",

    [string]$DesignDoc = "",

    [int]$Phase = 0,

    [string]$BaseBranch = "main",

    [switch]$Draft,

    [switch]$SkipApproval
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/.."
$PromptDir = Join-Path $Root "scripts/prompts"
$BootstrapLogDir = Join-Path $Root "logs/ai-flow"
$TempPromptDir = Join-Path $Root "logs/ai-flow/prompts"
$AutoWorktreeRoot = Join-Path (Split-Path $Root -Parent) "$((Split-Path $Root -Leaf)).worktrees/ai-flow"
New-Item -ItemType Directory -Force -Path $BootstrapLogDir | Out-Null
New-Item -ItemType Directory -Force -Path $TempPromptDir | Out-Null

$script:FeatureSlug = $FeatureName
$script:SpecDir = $null
$script:FeatureId = $null
$script:LogDir = $null
$script:PhaseStatePath = $null
$script:ReadinessPath = $null
$script:WorkflowPath = $null

function Resolve-OptionalPath {
    param([string]$PathValue)

    if ([string]::IsNullOrWhiteSpace($PathValue)) { return "None provided." }
    $Candidate = $PathValue
    if (!(Test-Path $Candidate)) { $Candidate = Join-Path $Root $PathValue }
    if (!(Test-Path $Candidate)) { throw "File not found: $PathValue" }
    return (Resolve-Path $Candidate).Path
}

function Get-CurrentBranch { return (git branch --show-current).Trim() }

function Get-BootstrapFeatureId {
    if ($FeatureName -match '^\d{3}-.+') { return $FeatureName }

    $SpecsRoot = Join-Path $Root "specs"
    $NextNum = 1
    if (Test-Path $SpecsRoot) {
        $Existing = Get-ChildItem -Path $SpecsRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^\d{3}-' } |
            ForEach-Object { [int]($_.Name -replace '^(\d{3})-.*', '$1') }
        if ($Existing) { $NextNum = [int](($Existing | Measure-Object -Maximum).Maximum + 1) }
    }

    return ("{0:D3}-{1}" -f $NextNum, $FeatureName)
}

function Find-SpeckitSpecDir {
    param([string]$RequestedName)

    $SpecsRoot = Join-Path $Root "specs"
    if (!(Test-Path $SpecsRoot)) { throw "specs directory not found. Let Speckit create it first with /speckit.specify." }

    $Candidates = @()
    if ($RequestedName -match '^\d{3}-.+') {
        $Candidates += Join-Path $SpecsRoot $RequestedName
    } else {
        $Candidates += Join-Path $SpecsRoot $RequestedName
        $Candidates += Get-ChildItem -Path $SpecsRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match "^\d{3}-$([regex]::Escape($RequestedName))$" } |
            ForEach-Object { $_.FullName }
    }
    $CurrentBranch = Get-CurrentBranch
    if ($CurrentBranch -match '^\d{3}-.+') { $Candidates += Join-Path $SpecsRoot $CurrentBranch }

    foreach ($Candidate in $Candidates | Select-Object -Unique) {
        if ((Test-Path $Candidate) -and (Test-Path (Join-Path $Candidate "spec.md"))) { return (Resolve-Path $Candidate).Path }
    }

    throw "Could not resolve Speckit feature directory for '$RequestedName'. Verify the feature name matches a directory under specs/ or pass the full numbered name (e.g. 005-my-feature)."
}

function Initialize-FeatureContext {
    param([switch]$AllowMissingSpec)

    if ($AllowMissingSpec) {
        $script:FeatureId = Get-BootstrapFeatureId
        $script:SpecDir = Join-Path $Root "logs/ai-flow/$script:FeatureId"
        $script:LogDir = $script:SpecDir
        $script:PhaseStatePath = Join-Path $script:SpecDir ".ai-phase"
        $script:ReadinessPath = Join-Path $script:SpecDir ".ai-requirements-ready"
        $script:WorkflowPath = Join-Path $script:SpecDir "ai-workflow.md"
        New-Item -ItemType Directory -Force -Path $script:LogDir | Out-Null
        return
    }

    $script:SpecDir = Find-SpeckitSpecDir -RequestedName $FeatureName
    $script:FeatureId = Split-Path $script:SpecDir -Leaf
    $script:LogDir = Join-Path $script:SpecDir "logs"
    $script:PhaseStatePath = Join-Path $script:SpecDir ".ai-phase"
    $script:ReadinessPath = Join-Path $script:SpecDir ".ai-requirements-ready"
    $script:WorkflowPath = Join-Path $script:SpecDir "ai-workflow.md"
    New-Item -ItemType Directory -Force -Path $script:LogDir | Out-Null
}

function Load-Prompt {
    param([string]$TemplateName, [string]$FeatureBrief = "", [string]$DesignDoc = "", [int]$Phase = 0)
    $TemplatePath = Join-Path $PromptDir "$TemplateName.md"
    if (!(Test-Path $TemplatePath)) { throw "Prompt template not found: $TemplatePath" }

    $Prompt = Get-Content $TemplatePath -Raw
    $Prompt = $Prompt.Replace("{{FEATURE_NAME}}", $FeatureName)
    $Prompt = $Prompt.Replace("{{FEATURE_ID}}", $(if ($script:FeatureId) { $script:FeatureId } else { $FeatureName }))
    $Prompt = $Prompt.Replace("{{SPEC_DIR}}", $(if ($script:SpecDir) { $script:SpecDir } else { "Speckit will create the feature directory." }))
    $Prompt = $Prompt.Replace("{{FEATURE_BRIEF}}", (Resolve-OptionalPath $FeatureBrief))
    $Prompt = $Prompt.Replace("{{DESIGN_DOC}}", (Resolve-OptionalPath $DesignDoc))
    $Prompt = $Prompt.Replace("{{PHASE}}", ("{0:D2}" -f $Phase))
    $Prompt = $Prompt.Replace("{{BASE_BRANCH}}", $BaseBranch)
    $Prompt = $Prompt.Replace("{{AI_WORKFLOW}}", $(if ($script:WorkflowPath) { $script:WorkflowPath } else { "Not created yet." }))
    return $Prompt
}

function New-LogPath {
    param([string]$BaseName)
    $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    return (Join-Path $script:LogDir "$BaseName-$Timestamp.log")
}

function Write-PromptFile {
    param([string]$Prompt, [string]$ToolName)
    $SafeFeature = $FeatureName -replace '[^a-zA-Z0-9_.-]', '-'
    $FileName = "{0}-{1}-{2}.md" -f $SafeFeature, $ToolName, ([guid]::NewGuid().ToString("N"))
    $PromptPath = Join-Path $TempPromptDir $FileName
    Set-Content -Path $PromptPath -Value $Prompt -Encoding UTF8
    return (Resolve-Path $PromptPath).Path
}

function Run-Claude {
    param(
        [string]$Prompt,
        [string]$LogFile,
        [string]$AllowedTools = "Write,Edit,Read,Bash,Glob,Grep"
    )
    Write-Host "Running Claude..." -ForegroundColor Cyan
    $PromptPath = Write-PromptFile -Prompt $Prompt -ToolName "claude"
    $RunnerPrompt = "Read and follow the full instructions in this local prompt file: $PromptPath"
    $PreviousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & claude -p $RunnerPrompt --allowedTools $AllowedTools 2>&1 | Tee-Object -FilePath $LogFile
        $ExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }
    if ($ExitCode -ne 0) { throw "Claude failed with exit code $ExitCode. See log: $LogFile. Prompt file: $PromptPath" }
}

function Run-Codex {
    param(
        [string]$Prompt,
        [string]$LogFile,
        [ValidateSet("read-only", "workspace-write", "danger-full-access")]
        [string]$SandboxMode = "read-only",
        [string]$WorkingDirectory = $Root
    )
    Write-Host "Running Codex..." -ForegroundColor Cyan
    $PromptPath = Write-PromptFile -Prompt $Prompt -ToolName "codex"
    $RunnerPrompt = "Read and follow the full instructions in this local prompt file: $PromptPath"
    $PreviousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        & codex exec --sandbox $SandboxMode --cd $WorkingDirectory $RunnerPrompt 2>&1 | Tee-Object -FilePath $LogFile
        $ExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $PreviousErrorActionPreference
    }
    if ($ExitCode -ne 0) { throw "Codex failed with exit code $ExitCode. See log: $LogFile. Prompt file: $PromptPath" }
}

function Require-Approval {
    param([string]$Message)
    if ($SkipApproval) { Write-Host "Skipping approval gate: $Message" -ForegroundColor DarkYellow; return }
    Write-Host ""; Write-Host $Message -ForegroundColor Yellow
    $Answer = Read-Host "Continue? Type YES to proceed"
    if ($Answer -ne "YES") { Write-Host "Stopped." -ForegroundColor Red; exit 1 }
}

function Show-GitStatus { Write-Host ""; Write-Host "Current git status:" -ForegroundColor Cyan; git status --short }

function Set-RequirementsReady { param([bool]$Ready); if ($Ready) { Set-Content -Path $script:ReadinessPath -Value "READY" } else { Set-Content -Path $script:ReadinessPath -Value "NOT_READY" } }

function Get-ReviewVerdict {
    param([string]$LogFile, [string[]]$AllowedVerdicts)
    $Verdict = ""
    foreach ($Line in (Get-Content $LogFile)) {
        $Trimmed = $Line.Trim()
        if ($AllowedVerdicts -contains $Trimmed) { $Verdict = $Trimmed }
    }
    return $Verdict
}

function Get-ReviewExcerpt {
    param([string]$LogFile, [string[]]$AllowedVerdicts)
    $Lines = Get-Content $LogFile
    $StartIndex = -1
    for ($Index = 0; $Index -lt $Lines.Count; $Index++) {
        if ($AllowedVerdicts -contains $Lines[$Index].Trim()) { $StartIndex = $Index }
    }
    if ($StartIndex -lt 0) { return "_No parseable review excerpt found. See raw log._" }
    return (($Lines[$StartIndex..($Lines.Count - 1)] | Where-Object { $_ -notmatch '^tokens used$' }) -join [Environment]::NewLine).Trim()
}

function Ensure-AiWorkflow {
    if ([string]::IsNullOrWhiteSpace($script:WorkflowPath)) { return }
    if (Test-Path $script:WorkflowPath) { return }

    $Content = @"
# AI Workflow Log: $script:FeatureId

## Overview

| Action | Status | Claude Tokens | Codex Tokens | Latest Logs |
|---|---|---:|---:|---|
| Spec | NOT_STARTED |  |  |  |
| Req-Review | NOT_STARTED |  |  |  |
| Implement - Phase 01 | NOT_STARTED |  |  |  |
| Create PR | NOT_STARTED |  |  |  |
| Claude PR Review | NOT_STARTED |  |  |  |
| Codex PR Review | NOT_STARTED |  |  |  |
| User PR Review | NOT_STARTED |  |  |  |

## Instructions

- This file is the collaboration ledger for the feature.
- Raw logs are diagnostic artifacts; use this file for decisions, findings, and user responses.
- Agents must read this file before reviewing or implementing.
- User notes and accepted resolutions are authoritative unless they conflict with the project constitution.
- Finding states: ``New``, ``Resolved``, ``Accepted``.
- ``Resolved`` means a corrective change was made. ``Accepted`` means the user accepted the item as non-blocking or intentionally declined a change.
- Implementation statuses: ``NOT_STARTED``, ``IN_PROGRESS``, ``PENDING_REVIEW``, ``READY``, ``NOT_READY``, ``BLOCKED``.
- Append new review entries. Do not remove prior review history.

## Spec

Status: NOT_STARTED

### Notes

- Pending.

## Req-Review

Status: NOT_STARTED

### Instructions

At the start of req-review, Claude inspects this section for standing findings and user responses. If there are `New` findings, Claude addresses them in the requirements artifacts unless the user marked them `Accepted` or provided an override. After that, Claude and Codex perform review passes.

### Findings

This table tracks active blocking findings only. Advisory notes from `Ready` reviews are kept in Review History.

| ID | State | Finding | Raised By | Resolution |
|---:|---|---|---|---|

### User Notes

Add responses here.

## Implementation

### Instructions

Before implementing a phase, inspect this file for standing findings. Address ``New`` findings for the current phase unless the user marked them ``Accepted``.

## Phase 01

Status: NOT_STARTED

### Findings

| ID | State | Finding | Raised By | Resolution |
|---:|---|---|---|---|

## Create PR

Status: NOT_STARTED

## Claude PR Review

Status: NOT_STARTED

### Findings

| ID | State | PR Thread Link | Resolution |
|---:|---|---|---|

## Codex PR Review

Status: NOT_STARTED

### Findings

| ID | State | PR Thread Link | Resolution |
|---:|---|---|---|

## User PR Review

Status: NOT_STARTED

### Findings

| ID | State | PR Thread Link | Resolution |
|---:|---|---|---|

## Review History

"@
    Set-Content -Path $script:WorkflowPath -Value $Content -Encoding UTF8
}

function Set-AiWorkflowStatus {
    param([string]$ActionName, [string]$SectionHeading, [string]$Status)
    Ensure-AiWorkflow
    if (!(Test-Path $script:WorkflowPath)) { return }

    $Content = Get-Content -Path $script:WorkflowPath -Raw
    $EscapedAction = [regex]::Escape($ActionName)
    $Content = [regex]::Replace(
        $Content,
        "(?m)^(\| $EscapedAction \| )[^|]*( \|)",
        "`${1}$Status`${2}",
        1
    )

    $EscapedSection = [regex]::Escape($SectionHeading)
    $Content = [regex]::Replace(
        $Content,
        "(?s)(## $EscapedSection\r?\n\r?\nStatus: )[^\r\n]+",
        "`${1}$Status",
        1
    )

    Set-Content -Path $script:WorkflowPath -Value $Content -Encoding UTF8
}

function Set-AiWorkflowLatestLogs {
    param([string]$ActionName, [string[]]$LogFiles)
    Ensure-AiWorkflow
    if (!(Test-Path $script:WorkflowPath)) { return }

    $LogText = ($LogFiles | Where-Object { ![string]::IsNullOrWhiteSpace($_) } | ForEach-Object {
        "``$(Resolve-Path -Path $_ -Relative)``"
    }) -join ", "

    $Content = Get-Content -Path $script:WorkflowPath -Raw
    $EscapedAction = [regex]::Escape($ActionName)
    $Content = [regex]::Replace(
        $Content,
        "(?m)^(\| $EscapedAction \| [^|]* \| [^|]* \| [^|]* \| )[^|]*( \|)$",
        "`${1}$LogText`${2}"
    )

    Set-Content -Path $script:WorkflowPath -Value $Content -Encoding UTF8
}

function Set-PhaseBlocked {
    param([int]$PhaseNumber, [string]$Reason, [string]$LogFile = "")
    Set-PhaseGate -PhaseNumber $PhaseNumber -State "BLOCKED"
    $PhaseLabel = "Phase {0:D2}" -f $PhaseNumber
    Set-AiWorkflowStatus -ActionName "Implement - $PhaseLabel" -SectionHeading $PhaseLabel -Status "BLOCKED"
    if (![string]::IsNullOrWhiteSpace($LogFile) -and (Test-Path $LogFile)) {
        Set-AiWorkflowLatestLogs -ActionName "Implement - $PhaseLabel" -LogFiles @($LogFile)
    }
    Write-Host ""
    Write-Host "$PhaseLabel marked BLOCKED: $Reason" -ForegroundColor Red
}

function Sync-AiWorkflowPhases {
    Ensure-AiWorkflow
    if (!(Test-Path $script:WorkflowPath)) { return }
    $TasksPath = Join-Path $script:SpecDir "tasks.md"
    if (!(Test-Path $TasksPath)) { return }

    $Content = Get-Content -Path $script:WorkflowPath -Raw
    foreach ($PhaseItem in (Get-PhaseHeadings)) {
        $PhaseLabel = "Phase {0:D2}" -f $PhaseItem.Number
        $ActionLabel = "Implement - $PhaseLabel"

        if ($Content -notmatch "(?m)^\| $([regex]::Escape($ActionLabel)) \|") {
            $Content = $Content -replace "(?m)^\| Create PR \|", "| $ActionLabel | NOT_STARTED |  |  |  |`r`n| Create PR |"
        }

        if ($Content -notmatch "(?m)^## $([regex]::Escape($PhaseLabel))$") {
            $PhaseSection = @"

## $PhaseLabel

Status: NOT_STARTED

### Findings

| ID | State | Finding | Raised By | Resolution |
|---:|---|---|---|---|


"@
            $Content = $Content -replace "(?m)^## Create PR$", "$PhaseSection## Create PR"
        }
    }

    Set-Content -Path $script:WorkflowPath -Value $Content -Encoding UTF8
}

function Append-AiWorkflowReview {
    param(
        [string]$ActionName,
        [string]$Reviewer,
        [string]$Verdict,
        [string]$LogFile,
        [string[]]$AllowedVerdicts
    )
    Ensure-AiWorkflow
    if (!(Test-Path $script:WorkflowPath)) { return }

    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $RelativeLog = Resolve-Path -Path $LogFile -Relative
    $Excerpt = Get-ReviewExcerpt -LogFile $LogFile -AllowedVerdicts $AllowedVerdicts
    $Entry = @"

### $Timestamp - $Reviewer $ActionName

Mode: review
Verdict: $Verdict
Raw Log: ``$RelativeLog``

``````text
$Excerpt
``````

"@
    Add-Content -Path $script:WorkflowPath -Value $Entry -Encoding UTF8
    Write-Host "AI workflow log updated: $script:WorkflowPath" -ForegroundColor Cyan
}

function Update-RequirementsReadinessFromLog {
    param([string]$LogFile)
    $Verdict = Get-ReviewVerdict -LogFile $LogFile -AllowedVerdicts @("Ready", "Not Ready")
    if ($Verdict -eq "Ready") {
        Set-RequirementsReady -Ready $true
        Write-Host "Requirements gate marked READY." -ForegroundColor Green
    } else {
        Set-RequirementsReady -Ready $false
        Write-Host "Requirements gate marked NOT_READY. Fix blockers before implementation." -ForegroundColor Red
    }
}

function Update-RequirementsReadinessFromVerdicts {
    param([string[]]$Verdicts)
    if (($Verdicts.Count -gt 0) -and !(($Verdicts | Where-Object { $_ -ne "Ready" }))) {
        Set-RequirementsReady -Ready $true
        Write-Host "Requirements gate marked READY." -ForegroundColor Green
    } else {
        Set-RequirementsReady -Ready $false
        Write-Host "Requirements gate marked NOT_READY. Fix blockers before implementation." -ForegroundColor Red
    }
}

function ConvertTo-MarkdownCell {
    param([string]$Value)
    return (($Value -replace '\r?\n', '<br>') -replace '\|', '\|').Trim()
}

function Add-AiWorkflowFindingsFromReview {
    param(
        [string]$SectionHeading,
        [string]$RaisedBy,
        [string]$LogFile,
        [string[]]$AllowedVerdicts
    )
    Ensure-AiWorkflow
    if (!(Test-Path $script:WorkflowPath)) { return }

    $Excerpt = Get-ReviewExcerpt -LogFile $LogFile -AllowedVerdicts $AllowedVerdicts
    $Findings = @()
    $CurrentFinding = $null
    foreach ($Line in ($Excerpt -split '\r?\n')) {
        $Trimmed = $Line.Trim()
        if ([string]::IsNullOrWhiteSpace($Trimmed)) { continue }
        if ($AllowedVerdicts -contains $Trimmed) { continue }
        if ($Trimmed -match '^tokens used\b') { continue }

        if ($Trimmed -match '^\-\s+(.+)$') {
            if ($null -ne $CurrentFinding) { $Findings += $CurrentFinding.Trim() }
            $CurrentFinding = $Matches[1]
        } elseif ($Trimmed -match '^\d+\.\s+(.+)$') {
            if ($null -ne $CurrentFinding) { $Findings += $CurrentFinding.Trim() }
            $CurrentFinding = $Matches[1]
        } elseif ($null -ne $CurrentFinding) {
            $CurrentFinding = "$CurrentFinding $Trimmed"
        }
    }
    if ($null -ne $CurrentFinding) { $Findings += $CurrentFinding.Trim() }
    if ($Findings.Count -eq 0) { return }

    $Lines = [System.Collections.Generic.List[string]]::new()
    foreach ($Line in (Get-Content -Path $script:WorkflowPath)) { $Lines.Add($Line) }

    $SectionIndex = -1
    for ($Index = 0; $Index -lt $Lines.Count; $Index++) {
        if ($Lines[$Index] -eq "## $SectionHeading") {
            $SectionIndex = $Index
            break
        }
    }
    if ($SectionIndex -lt 0) { return }

    $TableSeparatorIndex = -1
    for ($Index = $SectionIndex + 1; $Index -lt $Lines.Count; $Index++) {
        if ($Lines[$Index] -match '^##\s+') { break }
        if ($Lines[$Index] -eq "|---:|---|---|---|---|") {
            $TableSeparatorIndex = $Index
            break
        }
    }
    if ($TableSeparatorIndex -lt 0) { return }

    $InsertIndex = $TableSeparatorIndex + 1
    while (($InsertIndex -lt $Lines.Count) -and ($Lines[$InsertIndex] -match '^\|\s*\d+\s*\|')) {
        $InsertIndex++
    }

    $ExistingRows = (($Lines | Where-Object { $_ -match '^\|\s*\d+\s*\|' }) -join "`n")
    $NextId = 1
    for ($Index = $TableSeparatorIndex + 1; $Index -lt $Lines.Count; $Index++) {
        if ($Lines[$Index] -match '^##\s+' -or $Lines[$Index] -match '^###\s+') { break }
        if ($Lines[$Index] -match '^\|\s*(\d+)\s*\|') {
            $NextId = [Math]::Max($NextId, [int]$Matches[1] + 1)
        }
    }

    $Rows = @()
    foreach ($Finding in $Findings) {
        $FindingCell = ConvertTo-MarkdownCell $Finding
        if ($ExistingRows -match [regex]::Escape($FindingCell)) { continue }
        $Rows += "| $NextId | New | $FindingCell | $RaisedBy |  |"
        $NextId++
    }
    if ($Rows.Count -eq 0) { return }

    foreach ($Row in ($Rows | Sort-Object -Descending)) {
        $Lines.Insert($InsertIndex, $Row)
    }
    Set-Content -Path $script:WorkflowPath -Value $Lines -Encoding UTF8
}

function Show-SpecReviewSummary {
    param([string]$LogFile)
    $Verdict = Get-ReviewVerdict -LogFile $LogFile -AllowedVerdicts @("Ready", "Not Ready")
    if ($Verdict -eq "Ready") {
        Write-Host "Claude spec review: READY - no blockers reported." -ForegroundColor Green
    } elseif ($Verdict -eq "Not Ready") {
        Write-Host "Claude spec review: NOT_READY - blockers or required changes were reported." -ForegroundColor Red
    } else {
        Write-Host "Claude spec review: could not parse verdict '$Verdict'. Review the log manually." -ForegroundColor Yellow
    }
    Write-Host "Spec review log: $LogFile"
}

function Assert-RequirementsReady {
    if (!(Test-Path $script:ReadinessPath)) { throw "Requirements gate not found. Run: ./scripts/ai-flow.ps1 req-review $FeatureName" }
    $State = (Get-Content $script:ReadinessPath -Raw).Trim()
    if ($State -ne "READY") { throw "Requirements are not marked READY. Resolve Codex blockers, rerun req-review, then implement. Current gate: $State" }
}

function Get-PhaseGatePath { param([int]$PhaseNumber); return (Join-Path $script:SpecDir (".ai-phase-{0:D2}-review" -f $PhaseNumber)) }
function Set-PhaseGate { param([int]$PhaseNumber, [string]$State); Set-Content -Path (Get-PhaseGatePath -PhaseNumber $PhaseNumber) -Value $State }

function Update-PhaseGateFromLog {
    param([int]$PhaseNumber, [string]$LogFile)
    $Verdict = Get-ReviewVerdict -LogFile $LogFile -AllowedVerdicts @("Pass", "Needs Changes")
    if ([string]::IsNullOrWhiteSpace($Verdict)) {
        Set-PhaseBlocked -PhaseNumber $PhaseNumber -Reason "Implementation review did not return a parseable first-line verdict." -LogFile $LogFile
        throw "Could not parse implementation review verdict. Expected first line: Pass or Needs Changes. See log: $LogFile"
    }
    if ($Verdict -eq "Pass") {
        Set-PhaseGate -PhaseNumber $PhaseNumber -State "PASS"
        Write-Host "Phase $("{0:D2}" -f $PhaseNumber) review gate marked PASS." -ForegroundColor Green
        return $true
    }

    Set-PhaseGate -PhaseNumber $PhaseNumber -State "NEEDS_CHANGES"
    Write-Host "Phase $("{0:D2}" -f $PhaseNumber) review gate marked NEEDS_CHANGES. Fix findings before advancing." -ForegroundColor Red
    return $false
}

function Get-PhaseHeadings {
    $TasksPath = Join-Path $script:SpecDir "tasks.md"
    if (!(Test-Path $TasksPath)) { throw "tasks.md not found: $TasksPath" }
    $Phases = @()
    foreach ($Line in (Get-Content $TasksPath)) {
        if ($Line -match '^#{1,3}\s+Phase\s+0*([0-9]+)\b(.*)$') { $Phases += [pscustomobject]@{ Number = [int]$Matches[1]; Title = $Line.Trim() } }
    }
    if ($Phases.Count -eq 0) { throw "No phase headings found in $TasksPath. Expected headings like: ## Phase 01: Foundation" }
    return $Phases | Sort-Object Number -Unique
}

function Assert-PhaseExists {
    param([int]$PhaseNumber)
    $KnownPhases = Get-PhaseHeadings
    if (!($KnownPhases | Where-Object { $_.Number -eq $PhaseNumber })) {
        $Available = ($KnownPhases | ForEach-Object { "{0:D2}" -f $_.Number }) -join ", "
        throw "Phase $("{0:D2}" -f $PhaseNumber) was not found in tasks.md. Available phases: $Available"
    }
}

function Get-CurrentPhase {
    if ($Phase -gt 0) {
        Assert-PhaseExists -PhaseNumber $Phase
        return $Phase
    }
    if (Test-Path $script:PhaseStatePath) {
        $SavedPhase = (Get-Content $script:PhaseStatePath -Raw).Trim()
        if ($SavedPhase -match '^[0-9]+$') {
            $SavedPhaseNumber = [int]$SavedPhase
            Assert-PhaseExists -PhaseNumber $SavedPhaseNumber
            return $SavedPhaseNumber
        }
    }
    return (Get-PhaseHeadings | Select-Object -First 1).Number
}

function Set-CurrentPhase { param([int]$Value); Set-Content -Path $script:PhaseStatePath -Value $Value }
function Get-NextPhaseAfter { param([int]$Current); $Next = Get-PhaseHeadings | Where-Object { $_.Number -gt $Current } | Select-Object -First 1; if ($null -eq $Next) { return $null }; return $Next.Number }

function Show-Phases {
    $Current = Get-CurrentPhase
    Write-Host ""; Write-Host "Feature directory: specs/$script:FeatureId" -ForegroundColor Cyan
    if (Test-Path $script:ReadinessPath) { Write-Host "Requirements gate: $((Get-Content $script:ReadinessPath -Raw).Trim())" -ForegroundColor Cyan }
    Write-Host "Detected phases:" -ForegroundColor Cyan
    foreach ($Item in (Get-PhaseHeadings)) {
        $Marker = if ($Item.Number -eq $Current) { "*" } else { " " }
        $GatePath = Get-PhaseGatePath -PhaseNumber $Item.Number
        $Gate = if (Test-Path $GatePath) { (Get-Content $GatePath -Raw).Trim() } else { "PENDING" }
        Write-Host ("{0} Phase {1:D2} [{2}] - {3}" -f $Marker, $Item.Number, $Gate, $Item.Title)
    }
}

function Get-GitDeletedPaths {
    param([string[]]$Pathspecs, [string]$RepositoryRoot = $Root)
    $Args = @("diff", "--name-status", "--")
    $Args += $Pathspecs
    $Rows = & git -C $RepositoryRoot @Args
    $DeletedPaths = @()
    foreach ($Row in $Rows) {
        if ($Row -match '^D\s+(.+)$') { $DeletedPaths += $Matches[1] }
    }
    return $DeletedPaths
}

function Test-WriteAccess {
    param([string]$DirectoryPath)
    if (!(Test-Path $DirectoryPath)) { throw "Preflight directory does not exist: $DirectoryPath" }
    $TestPath = Join-Path $DirectoryPath ".ai-flow-write-test-$([guid]::NewGuid().ToString("N")).tmp"
    try {
        Set-Content -Path $TestPath -Value "ok" -Encoding ASCII
        Remove-Item -LiteralPath $TestPath -Force
        return $true
    } catch {
        if (Test-Path $TestPath) { Remove-Item -LiteralPath $TestPath -Force -ErrorAction SilentlyContinue }
        return $false
    }
}

function Assert-AutoWorktreePreflight {
    param([string]$WorktreePath)
    $RequiredDirectories = @("src", "tests", "server", "shared", "specs/$script:FeatureId") | ForEach-Object { Join-Path $WorktreePath $_ }
    $Denied = @()
    foreach ($Directory in $RequiredDirectories) {
        if ((Test-Path $Directory) -and !(Test-WriteAccess -DirectoryPath $Directory)) {
            $Denied += $Directory
        }
    }
    if ($Denied.Count -gt 0) {
        throw "Auto worktree preflight failed. Write denied: $($Denied -join ', ')"
    }
}

function Copy-DirectoryMirror {
    param([string]$Source, [string]$Destination)
    if (!(Test-Path $Source)) { return }
    if (Test-Path $Destination) { Remove-Item -LiteralPath $Destination -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
    }
}

function Sync-AutoWorktreeInputs {
    param([string]$WorktreePath)
    $DirectoriesToMirror = @(
        "src",
        "tests",
        "server",
        "shared",
        "scripts/prompts"
    )

    foreach ($RelativeDirectory in $DirectoriesToMirror) {
        $Source = Join-Path $Root $RelativeDirectory
        $Destination = Join-Path $WorktreePath $RelativeDirectory
        Copy-DirectoryMirror -Source $Source -Destination $Destination
    }

    Copy-DirectoryMirror -Source $script:SpecDir -Destination (Join-Path $WorktreePath "specs/$script:FeatureId")
}

function New-AutoWorktree {
    param([int]$SelectedPhase)
    $SafeFeature = $script:FeatureId -replace '[^a-zA-Z0-9_.-]', '-'
    New-Item -ItemType Directory -Force -Path $AutoWorktreeRoot | Out-Null
    $WorktreePath = Join-Path $AutoWorktreeRoot "$SafeFeature-phase-$("{0:D2}" -f $SelectedPhase)-$(Get-Date -Format "yyyyMMdd-HHmmss")"

    Write-Host "Creating isolated worktree: $WorktreePath" -ForegroundColor Cyan
    $GitOutput = & git worktree add --detach $WorktreePath HEAD 2>&1
    $GitExitCode = $LASTEXITCODE
    foreach ($Line in $GitOutput) { Write-Host $Line }
    if ($GitExitCode -ne 0) { throw "git worktree add failed with exit code $GitExitCode." }

    Sync-AutoWorktreeInputs -WorktreePath $WorktreePath
    Assert-AutoWorktreePreflight -WorktreePath $WorktreePath
    return $WorktreePath
}

function Test-SameFileContent {
    param([string]$LeftPath, [string]$RightPath)
    if (!(Test-Path $LeftPath) -or !(Test-Path $RightPath)) { return $false }
    $LeftHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $LeftPath).Hash
    $RightHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $RightPath).Hash
    return $LeftHash -eq $RightHash
}

function Copy-AutoWorktreeChanges {
    param([string]$WorktreePath, [int]$SelectedPhase)
    $DiffPath = Join-Path $script:LogDir "worktree-result-$("{0:D2}" -f $SelectedPhase)-$(Get-Date -Format "yyyyMMdd-HHmmss").patch"
    & git -C $WorktreePath diff -- . ":(exclude)specs/$script:FeatureId/logs" | Set-Content -Path $DiffPath -Encoding UTF8

    $NameStatus = & git -C $WorktreePath diff --name-status -- . ":(exclude)specs/$script:FeatureId/logs"
    $Copied = @()
    foreach ($Row in $NameStatus) {
        if ($Row -notmatch '^(?<status>[A-Z])\s+(?<path>.+)$') { continue }
        $Status = $Matches["status"]
        $RelativePath = $Matches["path"]
        $WorktreeFile = Join-Path $WorktreePath $RelativePath
        $MainFile = Join-Path $Root $RelativePath

        if ($Status -eq "D") {
            throw "Auto worktree attempted to delete $RelativePath. Deletions are not copied back automatically."
        }

        if (!(Test-Path $WorktreeFile)) { continue }
        if ((Test-Path $MainFile) -and (Test-SameFileContent -LeftPath $WorktreeFile -RightPath $MainFile)) { continue }
        $MainParent = Split-Path $MainFile -Parent
        if (!(Test-Path $MainParent)) { New-Item -ItemType Directory -Force -Path $MainParent | Out-Null }
        Copy-Item -LiteralPath $WorktreeFile -Destination $MainFile -Force
        $Copied += $RelativePath
    }

    if ($Copied.Count -eq 0) {
        throw "Auto worktree completed without producing changes beyond the current main workspace state."
    }

    Write-Host "Copied auto worktree changes to main workspace:" -ForegroundColor Green
    foreach ($Path in $Copied) { Write-Host "- $Path" }
    Write-Host "Result patch retained for inspection: $DiffPath" -ForegroundColor Cyan
}

function Remove-AutoWorktree {
    param([string]$WorktreePath)
    if ([string]::IsNullOrWhiteSpace($WorktreePath) -or !(Test-Path $WorktreePath)) { return }
    $GitOutput = & git worktree remove --force $WorktreePath 2>&1
    $GitExitCode = $LASTEXITCODE
    foreach ($Line in $GitOutput) { Write-Host $Line }
    if ($GitExitCode -ne 0) {
        Write-Host "Could not remove auto worktree automatically: $WorktreePath" -ForegroundColor Yellow
    }
}

function Assert-ImplementAutoSucceeded {
    param([int]$SelectedPhase, [string]$LogFile, [string[]]$DeletedBefore, [string]$RepositoryRoot = $Root)

    $LogContent = Get-Content -Path $LogFile -Raw
    if ($LogContent -match '(?im)^\*\*Blocked\*\*|^\s*Blocked\s*$|could not complete|environment is refusing') {
        Set-PhaseBlocked -PhaseNumber $SelectedPhase -Reason "Codex auto implementation reported a blocked state." -LogFile $LogFile
        throw "Codex auto implementation reported BLOCKED. See log: $LogFile"
    }

    $DeletedAfter = Get-GitDeletedPaths -Pathspecs @("src", "tests", "server", "shared") -RepositoryRoot $RepositoryRoot
    $NewDeleted = @($DeletedAfter | Where-Object { $DeletedBefore -notcontains $_ })
    if ($NewDeleted.Count -gt 0) {
        Set-PhaseBlocked -PhaseNumber $SelectedPhase -Reason "Auto implementation introduced deleted source/test files: $($NewDeleted -join ', ')" -LogFile $LogFile
        throw "Auto implementation introduced deleted source/test files: $($NewDeleted -join ', ')"
    }
}

function Show-ImplementationPacket {
    param([int]$SelectedPhase)
    Assert-RequirementsReady
    Ensure-AiWorkflow
    Sync-AiWorkflowPhases
    Set-PhaseGate -PhaseNumber $SelectedPhase -State "IN_PROGRESS"
    Set-AiWorkflowStatus -ActionName "Implement - Phase $("{0:D2}" -f $SelectedPhase)" -SectionHeading "Phase $("{0:D2}" -f $SelectedPhase)" -Status "IN_PROGRESS"
    Set-CurrentPhase -Value $SelectedPhase
    $Prompt = Load-Prompt -TemplateName "codex-implement-phase" -Phase $SelectedPhase
    $PromptPath = Write-PromptFile -Prompt $Prompt -ToolName "active-codex-implement"
    Write-Host ""
    Write-Host "Phase $("{0:D2}" -f $SelectedPhase) is ready for implementation in this active Codex session." -ForegroundColor Green
    Write-Host ""
    Write-Host "Implementation packet:" -ForegroundColor Cyan
    Write-Host "- Workflow: $script:WorkflowPath"
    Write-Host "- Tasks: $(Join-Path $script:SpecDir "tasks.md")"
    Write-Host "- Plan: $(Join-Path $script:SpecDir "plan.md")"
    Write-Host "- Spec: $(Join-Path $script:SpecDir "spec.md")"
    Write-Host "- Prompt: $PromptPath"
    Write-Host ""
    Write-Host "After the active Codex session implements Phase $("{0:D2}" -f $SelectedPhase), run:" -ForegroundColor Cyan
    Write-Host "./scripts/ai-flow.ps1 mark-implemented $FeatureName -Phase $SelectedPhase"
    Show-Phases
}

function Mark-ImplementationPendingReview {
    param([int]$SelectedPhase)
    Ensure-AiWorkflow
    Sync-AiWorkflowPhases
    Set-PhaseGate -PhaseNumber $SelectedPhase -State "PENDING_REVIEW"
    Set-AiWorkflowStatus -ActionName "Implement - Phase $("{0:D2}" -f $SelectedPhase)" -SectionHeading "Phase $("{0:D2}" -f $SelectedPhase)" -Status "PENDING_REVIEW"
    Set-CurrentPhase -Value $SelectedPhase
    Write-Host "Phase $("{0:D2}" -f $SelectedPhase) marked PENDING_REVIEW." -ForegroundColor Green
    Show-GitStatus
}

function Run-ImplementPhaseAuto {
    param([int]$SelectedPhase)
    Assert-RequirementsReady
    Ensure-AiWorkflow
    Sync-AiWorkflowPhases
    Set-PhaseGate -PhaseNumber $SelectedPhase -State "IN_PROGRESS"
    Set-AiWorkflowStatus -ActionName "Implement - Phase $("{0:D2}" -f $SelectedPhase)" -SectionHeading "Phase $("{0:D2}" -f $SelectedPhase)" -Status "IN_PROGRESS"
    Require-Approval "Run child Codex auto implementation for Phase $("{0:D2}" -f $SelectedPhase) inside an isolated git worktree?"
    $ImplementationLog = New-LogPath -BaseName "06-codex-phase-$("{0:D2}" -f $SelectedPhase)"
    $WorktreePath = $null
    try {
        $WorktreePath = New-AutoWorktree -SelectedPhase $SelectedPhase
        $MainSpecDir = $script:SpecDir
        $MainWorkflowPath = $script:WorkflowPath
        $script:SpecDir = Join-Path $WorktreePath "specs/$script:FeatureId"
        $script:WorkflowPath = Join-Path $script:SpecDir "ai-workflow.md"
        $Prompt = Load-Prompt -TemplateName "codex-implement-phase" -Phase $SelectedPhase
        $script:SpecDir = $MainSpecDir
        $script:WorkflowPath = $MainWorkflowPath
        $DeletedBefore = Get-GitDeletedPaths -Pathspecs @("src", "tests", "server", "shared") -RepositoryRoot $WorktreePath
        Run-Codex -Prompt $Prompt -LogFile $ImplementationLog -SandboxMode "workspace-write" -WorkingDirectory $WorktreePath
        Assert-ImplementAutoSucceeded -SelectedPhase $SelectedPhase -LogFile $ImplementationLog -DeletedBefore $DeletedBefore -RepositoryRoot $WorktreePath
        Copy-AutoWorktreeChanges -WorktreePath $WorktreePath -SelectedPhase $SelectedPhase
        Remove-AutoWorktree -WorktreePath $WorktreePath
    } catch {
        if ($null -ne $MainSpecDir) { $script:SpecDir = $MainSpecDir }
        if ($null -ne $MainWorkflowPath) { $script:WorkflowPath = $MainWorkflowPath }
        if (![string]::IsNullOrWhiteSpace($WorktreePath)) {
            Write-Host "Auto worktree retained for inspection: $WorktreePath" -ForegroundColor Yellow
        }
        Set-PhaseBlocked -PhaseNumber $SelectedPhase -Reason $_.Exception.Message -LogFile $ImplementationLog
        throw
    }
    Set-AiWorkflowLatestLogs -ActionName "Implement - Phase $("{0:D2}" -f $SelectedPhase)" -LogFiles @($ImplementationLog)
    Set-AiWorkflowStatus -ActionName "Implement - Phase $("{0:D2}" -f $SelectedPhase)" -SectionHeading "Phase $("{0:D2}" -f $SelectedPhase)" -Status "PENDING_REVIEW"
    Set-CurrentPhase -Value $SelectedPhase
    Show-GitStatus
}

function Run-CheckImplementation {
    param([int]$SelectedPhase)
    Ensure-AiWorkflow
    Sync-AiWorkflowPhases
    Require-Approval "Have you reviewed Codex's Phase $("{0:D2}" -f $SelectedPhase) implementation diff locally?"
    $Prompt = Load-Prompt -TemplateName "claude-check-implementation" -Phase $SelectedPhase
    $ReviewLog = New-LogPath -BaseName "07-claude-check-phase-$("{0:D2}" -f $SelectedPhase)"
    Run-Claude -Prompt $Prompt -LogFile $ReviewLog -AllowedTools "Read,Bash,Glob,Grep"
    $PhaseVerdict = Get-ReviewVerdict -LogFile $ReviewLog -AllowedVerdicts @("Pass", "Needs Changes")
    $Passed = Update-PhaseGateFromLog -PhaseNumber $SelectedPhase -LogFile $ReviewLog
    $PhaseStatus = if ($PhaseVerdict -eq "Pass") { "READY" } else { "NOT_READY" }
    Set-AiWorkflowStatus -ActionName "Implement - Phase $("{0:D2}" -f $SelectedPhase)" -SectionHeading "Phase $("{0:D2}" -f $SelectedPhase)" -Status $PhaseStatus
    $ExistingImplementationLogs = @()
    $WorkflowContent = Get-Content -Path $script:WorkflowPath -Raw
    $ActionLabel = "Implement - Phase $("{0:D2}" -f $SelectedPhase)"
    $ActionMatch = [regex]::Match($WorkflowContent, "(?m)^\| $([regex]::Escape($ActionLabel)) \| [^|]* \| [^|]* \| [^|]* \| (?<logs>[^|]*) \|$")
    if ($ActionMatch.Success) {
        $ExistingImplementationLogs = [regex]::Matches($ActionMatch.Groups["logs"].Value, '`([^`]+)`') | ForEach-Object { $_.Groups[1].Value }
    }
    Set-AiWorkflowLatestLogs -ActionName $ActionLabel -LogFiles @($ExistingImplementationLogs + $ReviewLog)
    Append-AiWorkflowReview -ActionName "Implementation Review Phase $("{0:D2}" -f $SelectedPhase)" -Reviewer "Claude" -Verdict $PhaseVerdict -LogFile $ReviewLog -AllowedVerdicts @("Pass", "Needs Changes")
    if (!$Passed) { Show-GitStatus; throw "Phase $("{0:D2}" -f $SelectedPhase) did not pass Claude review. Fix findings, rerun implementation/fixes, then rerun check-next." }
    $NextPhase = Get-NextPhaseAfter -Current $SelectedPhase
    if ($null -ne $NextPhase) { Set-CurrentPhase -Value $NextPhase; Write-Host ""; Write-Host "Next phase set to Phase $("{0:D2}" -f $NextPhase)." -ForegroundColor Green }
    else { Write-Host ""; Write-Host "No remaining phases detected." -ForegroundColor Green }
    Show-GitStatus
}

function New-PullRequest {
    Ensure-AiWorkflow
    $Branch = Get-CurrentBranch
    if ([string]::IsNullOrWhiteSpace($Branch)) { throw "Could not determine current git branch." }
    if ($Branch -eq $BaseBranch) { throw "Refusing to create a PR from $BaseBranch to itself. Checkout a feature branch first." }
    Require-Approval "Create a PR from $Branch into $BaseBranch?"
    $Title = "feat: $script:FeatureId"
    $Body = @"
## Summary

AI-assisted Speckit workflow for ``$script:FeatureId``.

## Source artifacts

- ``specs/$script:FeatureId/spec.md``
- ``specs/$script:FeatureId/plan.md``
- ``specs/$script:FeatureId/tasks.md``
- ``specs/$script:FeatureId/ai-workflow.md``

Additional Speckit artifacts, when generated:

- ``specs/$script:FeatureId/research.md``
- ``specs/$script:FeatureId/data-model.md``
- ``specs/$script:FeatureId/quickstart.md``
- ``specs/$script:FeatureId/checklists/``
- ``specs/$script:FeatureId/contracts/``

## Review notes

Local AI workflow logs are stored under:

- ``specs/$script:FeatureId/logs/``

## Manual testing

- [ ] Manual testing completed
- [ ] Claude PR review completed
- [ ] Codex PR review completed
"@
    git push -u origin $Branch
    if ($LASTEXITCODE -ne 0) { throw "git push failed with exit code $LASTEXITCODE." }
    if ($Draft) { gh pr create --base $BaseBranch --head $Branch --title $Title --body $Body --draft }
    else { gh pr create --base $BaseBranch --head $Branch --title $Title --body $Body }
    if ($LASTEXITCODE -ne 0) { throw "gh pr create failed with exit code $LASTEXITCODE." }
    Set-AiWorkflowStatus -ActionName "Create PR" -SectionHeading "Create PR" -Status "READY"
}

function Run-ClaudePrReview {
    Ensure-AiWorkflow
    Require-Approval "Is the PR open and ready for Claude final review comments?"
    $ReviewLog = New-LogPath -BaseName "08-claude-pr-review"
    Run-Claude -Prompt (Load-Prompt -TemplateName "claude-pr-review" -Phase (Get-CurrentPhase)) -LogFile $ReviewLog
    $Verdict = Get-ReviewVerdict -LogFile $ReviewLog -AllowedVerdicts @("Pass", "Needs Changes")
    $Status = if ($Verdict -eq "Pass") { "READY" } else { "NOT_READY" }
    Set-AiWorkflowStatus -ActionName "Claude PR Review" -SectionHeading "Claude PR Review" -Status $Status
    Set-AiWorkflowLatestLogs -ActionName "Claude PR Review" -LogFiles @($ReviewLog)
    Append-AiWorkflowReview -ActionName "PR Review" -Reviewer "Claude" -Verdict $Verdict -LogFile $ReviewLog -AllowedVerdicts @("Pass", "Needs Changes")
}

function Run-CodexPrReview {
    Ensure-AiWorkflow
    Require-Approval "Is the PR open and ready for Codex final review comments?"
    $ReviewLog = New-LogPath -BaseName "09-codex-pr-review"
    Run-Codex -Prompt (Load-Prompt -TemplateName "codex-pr-review" -Phase (Get-CurrentPhase)) -LogFile $ReviewLog
    $Verdict = Get-ReviewVerdict -LogFile $ReviewLog -AllowedVerdicts @("Pass", "Needs Changes")
    $Status = if ($Verdict -eq "Pass") { "READY" } else { "NOT_READY" }
    Set-AiWorkflowStatus -ActionName "Codex PR Review" -SectionHeading "Codex PR Review" -Status $Status
    Set-AiWorkflowLatestLogs -ActionName "Codex PR Review" -LogFiles @($ReviewLog)
    Append-AiWorkflowReview -ActionName "PR Review" -Reviewer "Codex" -Verdict $Verdict -LogFile $ReviewLog -AllowedVerdicts @("Pass", "Needs Changes")
}

switch ($Action) {
    "spec" {
        if ([string]::IsNullOrWhiteSpace($FeatureBrief)) { throw "Feature brief path is required. Example: ./scripts/ai-flow.ps1 spec profile-page-improvements features/profile-page-improvements.md -DesignDoc design/profile_page.md" }
        Initialize-FeatureContext -AllowMissingSpec
        Run-Claude -Prompt (Load-Prompt -TemplateName "claude-specify" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc) -LogFile (Join-Path $BootstrapLogDir "$FeatureName-01-claude-specify-$(Get-Date -Format "yyyyMMdd-HHmmss").log")
        Initialize-FeatureContext
        Ensure-AiWorkflow
        Run-Claude -Prompt (Load-Prompt -TemplateName "claude-plan" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc) -LogFile (New-LogPath -BaseName "02-claude-plan")
        Initialize-FeatureContext
        Ensure-AiWorkflow
        Run-Claude -Prompt (Load-Prompt -TemplateName "claude-tasks" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc) -LogFile (New-LogPath -BaseName "03-claude-tasks")
        Initialize-FeatureContext
        Ensure-AiWorkflow
        Sync-AiWorkflowPhases
        Set-AiWorkflowStatus -ActionName "Spec" -SectionHeading "Spec" -Status "READY"
        Set-RequirementsReady -Ready $false
        Set-CurrentPhase -Value ((Get-PhaseHeadings | Select-Object -First 1).Number)
        Show-Phases; Show-GitStatus
        Write-Host ""; Write-Host "Speckit package complete." -ForegroundColor Green
        Write-Host "Next: run req-review to execute Claude and Codex requirements reviews."
    }
    "req-review" {
        Initialize-FeatureContext
        Ensure-AiWorkflow
        Sync-AiWorkflowPhases
        $ClaudeAddressLog = New-LogPath -BaseName "04-claude-address-req-review"
        Run-Claude -Prompt (Load-Prompt -TemplateName "claude-address-req-review" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc) -LogFile $ClaudeAddressLog

        $ClaudeReviewLog = New-LogPath -BaseName "05-claude-requirements-review"
        Run-Claude -Prompt (Load-Prompt -TemplateName "claude-spec-review" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc) -LogFile $ClaudeReviewLog
        Show-SpecReviewSummary -LogFile $ClaudeReviewLog
        $ClaudeReqVerdict = Get-ReviewVerdict -LogFile $ClaudeReviewLog -AllowedVerdicts @("Ready", "Not Ready")
        Append-AiWorkflowReview -ActionName "Requirements Review" -Reviewer "Claude" -Verdict $ClaudeReqVerdict -LogFile $ClaudeReviewLog -AllowedVerdicts @("Ready", "Not Ready")
        if ($ClaudeReqVerdict -eq "Not Ready") {
            Add-AiWorkflowFindingsFromReview -SectionHeading "Req-Review" -RaisedBy "Claude" -LogFile $ClaudeReviewLog -AllowedVerdicts @("Ready", "Not Ready")
        }

        $CodexReviewLog = New-LogPath -BaseName "06-codex-requirements-review"
        Run-Codex -Prompt (Load-Prompt -TemplateName "codex-check-requirements") -LogFile $CodexReviewLog
        $CodexReqVerdict = Get-ReviewVerdict -LogFile $CodexReviewLog -AllowedVerdicts @("Ready", "Not Ready")
        Append-AiWorkflowReview -ActionName "Requirements Review" -Reviewer "Codex" -Verdict $CodexReqVerdict -LogFile $CodexReviewLog -AllowedVerdicts @("Ready", "Not Ready")
        if ($CodexReqVerdict -eq "Not Ready") {
            Add-AiWorkflowFindingsFromReview -SectionHeading "Req-Review" -RaisedBy "Codex" -LogFile $CodexReviewLog -AllowedVerdicts @("Ready", "Not Ready")
        }

        Update-RequirementsReadinessFromVerdicts -Verdicts @($ClaudeReqVerdict, $CodexReqVerdict)
        $ReqStatus = if (($ClaudeReqVerdict -eq "Ready") -and ($CodexReqVerdict -eq "Ready")) { "READY" } else { "NOT_READY" }
        Set-AiWorkflowStatus -ActionName "Req-Review" -SectionHeading "Req-Review" -Status $ReqStatus
        Set-AiWorkflowLatestLogs -ActionName "Req-Review" -LogFiles @($ClaudeAddressLog, $ClaudeReviewLog, $CodexReviewLog)
        Show-GitStatus
    }
    "next-phase" { Initialize-FeatureContext; Ensure-AiWorkflow; Sync-AiWorkflowPhases; Show-Phases }
    "implement" { Initialize-FeatureContext; Show-ImplementationPacket -SelectedPhase (Get-CurrentPhase) }
    "implement-next" { Initialize-FeatureContext; Show-ImplementationPacket -SelectedPhase (Get-CurrentPhase) }
    "implement-auto" { Initialize-FeatureContext; Run-ImplementPhaseAuto -SelectedPhase (Get-CurrentPhase) }
    "implement-next-auto" { Initialize-FeatureContext; Run-ImplementPhaseAuto -SelectedPhase (Get-CurrentPhase) }
    "mark-implemented" { Initialize-FeatureContext; Mark-ImplementationPendingReview -SelectedPhase (Get-CurrentPhase) }
    "check-implementation" { Initialize-FeatureContext; Run-CheckImplementation -SelectedPhase (Get-CurrentPhase) }
    "check-next" { Initialize-FeatureContext; Run-CheckImplementation -SelectedPhase (Get-CurrentPhase) }
    "create-pr" { Initialize-FeatureContext; New-PullRequest }
    "claude-pr-review" { Initialize-FeatureContext; Run-ClaudePrReview }
    "codex-pr-review" { Initialize-FeatureContext; Run-CodexPrReview }
    "run-all" {
        Initialize-FeatureContext
        Assert-RequirementsReady
        $SkipApproval = [switch]$true
        $AllPhases = Get-PhaseHeadings
        Write-Host ""; Write-Host "Running all phases for $script:FeatureId ($($AllPhases.Count) phase(s) detected)." -ForegroundColor Cyan
        foreach ($PhaseItem in $AllPhases) {
            $SelectedPhase = $PhaseItem.Number
            $GatePath = Get-PhaseGatePath -PhaseNumber $SelectedPhase
            if ((Test-Path $GatePath) -and ((Get-Content $GatePath -Raw).Trim() -eq "PASS")) {
                Write-Host "Phase $("{0:D2}" -f $SelectedPhase) already PASS - skipping." -ForegroundColor DarkYellow
                continue
            }
            Set-CurrentPhase -Value $SelectedPhase
            Write-Host ""; Write-Host "=== Phase $("{0:D2}" -f $SelectedPhase) ===" -ForegroundColor Cyan
            Run-ImplementPhaseAuto -SelectedPhase $SelectedPhase
            Run-CheckImplementation -SelectedPhase $SelectedPhase
        }
        Write-Host ""; Write-Host "All phases complete." -ForegroundColor Green
        Show-GitStatus
    }
}
