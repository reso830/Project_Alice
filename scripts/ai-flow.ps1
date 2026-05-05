param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("spec", "req-review", "implement", "implement-next", "check-implementation", "check-next", "next-phase", "create-pr", "claude-pr-review", "codex-pr-review", "run-all")]
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
New-Item -ItemType Directory -Force -Path $BootstrapLogDir | Out-Null
New-Item -ItemType Directory -Force -Path $TempPromptDir | Out-Null

$script:FeatureSlug = $FeatureName
$script:SpecDir = $null
$script:FeatureId = $null
$script:LogDir = $null
$script:PhaseStatePath = $null
$script:ReadinessPath = $null

function Resolve-OptionalPath {
    param([string]$PathValue)

    if ([string]::IsNullOrWhiteSpace($PathValue)) { return "None provided." }
    $Candidate = $PathValue
    if (!(Test-Path $Candidate)) { $Candidate = Join-Path $Root $PathValue }
    if (!(Test-Path $Candidate)) { throw "File not found: $PathValue" }
    return (Resolve-Path $Candidate).Path
}

function Get-CurrentBranch { return (git branch --show-current).Trim() }

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
        $script:SpecDir = Join-Path $Root "logs/ai-flow/$FeatureName"
        $script:FeatureId = $FeatureName
        $script:LogDir = $script:SpecDir
        $script:PhaseStatePath = Join-Path $script:SpecDir ".ai-phase"
        $script:ReadinessPath = Join-Path $script:SpecDir ".ai-requirements-ready"
        New-Item -ItemType Directory -Force -Path $script:LogDir | Out-Null
        return
    }

    $script:SpecDir = Find-SpeckitSpecDir -RequestedName $FeatureName
    $script:FeatureId = Split-Path $script:SpecDir -Leaf
    $script:LogDir = Join-Path $script:SpecDir "logs"
    $script:PhaseStatePath = Join-Path $script:SpecDir ".ai-phase"
    $script:ReadinessPath = Join-Path $script:SpecDir ".ai-requirements-ready"
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
    return $Prompt
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
    param([string]$Prompt, [string]$LogFile)
    Write-Host "Running Claude..." -ForegroundColor Cyan
    $PromptPath = Write-PromptFile -Prompt $Prompt -ToolName "claude"
    $RunnerPrompt = "Read and follow the full instructions in this local prompt file: $PromptPath"
    & claude -p $RunnerPrompt 2>&1 | Tee-Object -FilePath $LogFile
    $ExitCode = $LASTEXITCODE
    if ($ExitCode -ne 0) { throw "Claude failed with exit code $ExitCode. See log: $LogFile. Prompt file: $PromptPath" }
}

function Run-Codex {
    param([string]$Prompt, [string]$LogFile)
    Write-Host "Running Codex..." -ForegroundColor Cyan
    $PromptPath = Write-PromptFile -Prompt $Prompt -ToolName "codex"
    $RunnerPrompt = "Read and follow the full instructions in this local prompt file: $PromptPath"
    & codex exec $RunnerPrompt 2>&1 | Tee-Object -FilePath $LogFile
    $ExitCode = $LASTEXITCODE
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

function Update-RequirementsReadinessFromLog {
    param([string]$LogFile)
    $Content = Get-Content $LogFile -Raw
    if ($Content -match '(?im)^\s*(1\.\s*)?Ready\s*(\r?\n|$)' -and $Content -notmatch '(?im)^\s*(1\.\s*)?Not\s+Ready\s*(\r?\n|$)') {
        Set-RequirementsReady -Ready $true
        Write-Host "Requirements gate marked READY." -ForegroundColor Green
    } else {
        Set-RequirementsReady -Ready $false
        Write-Host "Requirements gate marked NOT_READY. Fix blockers before implementation." -ForegroundColor Red
    }
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
    $Content = Get-Content $LogFile -Raw
    if ($Content -match '(?im)^\s*(1\.\s*)?Pass\s*(\r?\n|$)' -and $Content -notmatch '(?im)^\s*(1\.\s*)?Needs\s+Changes\s*(\r?\n|$)') {
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

function Get-CurrentPhase {
    if ($Phase -gt 0) { return $Phase }
    if (Test-Path $script:PhaseStatePath) {
        $SavedPhase = (Get-Content $script:PhaseStatePath -Raw).Trim()
        if ($SavedPhase -match '^[0-9]+$') { return [int]$SavedPhase }
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

function Run-ImplementPhase {
    param([int]$SelectedPhase)
    Assert-RequirementsReady
    Set-PhaseGate -PhaseNumber $SelectedPhase -State "PENDING_REVIEW"
    Require-Approval "Have all requirement blockers been resolved for Phase $("{0:D2}" -f $SelectedPhase)?"
    $Prompt = Load-Prompt -TemplateName "codex-implement-phase" -Phase $SelectedPhase
    Run-Codex -Prompt $Prompt -LogFile "$script:LogDir/06-codex-phase-$("{0:D2}" -f $SelectedPhase).log"
    Set-CurrentPhase -Value $SelectedPhase
    Show-GitStatus
}

function Run-CheckImplementation {
    param([int]$SelectedPhase)
    Require-Approval "Have you reviewed Codex's Phase $("{0:D2}" -f $SelectedPhase) implementation diff locally?"
    $Prompt = Load-Prompt -TemplateName "claude-check-implementation" -Phase $SelectedPhase
    $ReviewLog = "$script:LogDir/07-claude-check-phase-$("{0:D2}" -f $SelectedPhase).log"
    Run-Claude -Prompt $Prompt -LogFile $ReviewLog
    $Passed = Update-PhaseGateFromLog -PhaseNumber $SelectedPhase -LogFile $ReviewLog
    if (!$Passed) { Show-GitStatus; throw "Phase $("{0:D2}" -f $SelectedPhase) did not pass Claude review. Fix findings, rerun implementation/fixes, then rerun check-next." }
    $NextPhase = Get-NextPhaseAfter -Current $SelectedPhase
    if ($null -ne $NextPhase) { Set-CurrentPhase -Value $NextPhase; Write-Host ""; Write-Host "Next phase set to Phase $("{0:D2}" -f $NextPhase)." -ForegroundColor Green }
    else { Write-Host ""; Write-Host "No remaining phases detected." -ForegroundColor Green }
    Show-GitStatus
}

function New-PullRequest {
    $Branch = Get-CurrentBranch
    if ([string]::IsNullOrWhiteSpace($Branch)) { throw "Could not determine current git branch." }
    if ($Branch -eq $BaseBranch) { throw "Refusing to create a PR from $BaseBranch to itself. Checkout a feature branch first." }
    Require-Approval "Create a PR from $Branch into $BaseBranch?"
    $Title = "feat: $script:FeatureId"
    $Body = @"
## Summary

AI-assisted Speckit workflow for `$script:FeatureId`.

## Source artifacts

- `specs/$script:FeatureId/spec.md`
- `specs/$script:FeatureId/plan.md`
- `specs/$script:FeatureId/tasks.md`

Additional Speckit artifacts, when generated:

- `specs/$script:FeatureId/research.md`
- `specs/$script:FeatureId/data-model.md`
- `specs/$script:FeatureId/quickstart.md`
- `specs/$script:FeatureId/checklists/`
- `specs/$script:FeatureId/contracts/`

## Review notes

Local AI workflow logs are stored under:

- `specs/$script:FeatureId/logs/`

## Manual testing

- [ ] Manual testing completed
- [ ] Claude PR review completed
- [ ] Codex PR review completed
"@
    git push -u origin $Branch
    if ($Draft) { gh pr create --base $BaseBranch --head $Branch --title $Title --body $Body --draft }
    else { gh pr create --base $BaseBranch --head $Branch --title $Title --body $Body }
}

switch ($Action) {
    "spec" {
        if ([string]::IsNullOrWhiteSpace($FeatureBrief)) { throw "Feature brief path is required. Example: ./scripts/ai-flow.ps1 spec profile-page-improvements features/profile-page-improvements.md -DesignDoc design/profile_page.md" }
        Initialize-FeatureContext -AllowMissingSpec
        Run-Claude -Prompt (Load-Prompt -TemplateName "claude-specify" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc) -LogFile "$BootstrapLogDir/$FeatureName-01-claude-specify.log"
        Initialize-FeatureContext
        Run-Claude -Prompt (Load-Prompt -TemplateName "claude-plan" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc) -LogFile "$script:LogDir/02-claude-plan.log"
        Initialize-FeatureContext
        Run-Claude -Prompt (Load-Prompt -TemplateName "claude-tasks" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc) -LogFile "$script:LogDir/03-claude-tasks.log"
        Initialize-FeatureContext
        Run-Claude -Prompt (Load-Prompt -TemplateName "claude-spec-review" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc) -LogFile "$script:LogDir/04-claude-spec-review.log"
        Set-RequirementsReady -Ready $false
        Set-CurrentPhase -Value ((Get-PhaseHeadings | Select-Object -First 1).Number)
        Show-Phases; Show-GitStatus
        Write-Host ""; Write-Host "Speckit package and Claude architect review complete." -ForegroundColor Green
        Write-Host "Review: specs/$script:FeatureId and logs/04-claude-spec-review.log"
    }
    "req-review" {
        Initialize-FeatureContext
        Require-Approval "Have you reviewed and accepted Claude's Speckit output and architect review?"
        $ReviewLog = "$script:LogDir/05-codex-requirements-review.log"
        Run-Codex -Prompt (Load-Prompt -TemplateName "codex-check-requirements") -LogFile $ReviewLog
        Update-RequirementsReadinessFromLog -LogFile $ReviewLog
        Show-GitStatus
    }
    "next-phase" { Initialize-FeatureContext; Show-Phases }
    "implement" { Initialize-FeatureContext; Run-ImplementPhase -SelectedPhase (Get-CurrentPhase) }
    "implement-next" { Initialize-FeatureContext; Run-ImplementPhase -SelectedPhase (Get-CurrentPhase) }
    "check-implementation" { Initialize-FeatureContext; Run-CheckImplementation -SelectedPhase (Get-CurrentPhase) }
    "check-next" { Initialize-FeatureContext; Run-CheckImplementation -SelectedPhase (Get-CurrentPhase) }
    "create-pr" { Initialize-FeatureContext; New-PullRequest }
    "claude-pr-review" { Initialize-FeatureContext; Require-Approval "Is the PR open and ready for Claude final review comments?"; Run-Claude -Prompt (Load-Prompt -TemplateName "claude-pr-review" -Phase (Get-CurrentPhase)) -LogFile "$script:LogDir/08-claude-pr-review.log" }
    "codex-pr-review" { Initialize-FeatureContext; Require-Approval "Is the PR open and ready for Codex final review comments?"; Run-Codex -Prompt (Load-Prompt -TemplateName "codex-pr-review" -Phase (Get-CurrentPhase)) -LogFile "$script:LogDir/09-codex-pr-review.log" }
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
                Write-Host "Phase $("{0:D2}" -f $SelectedPhase) already PASS — skipping." -ForegroundColor DarkYellow
                continue
            }
            Set-CurrentPhase -Value $SelectedPhase
            Write-Host ""; Write-Host "=== Phase $("{0:D2}" -f $SelectedPhase) ===" -ForegroundColor Cyan
            Run-ImplementPhase -SelectedPhase $SelectedPhase
            Run-CheckImplementation -SelectedPhase $SelectedPhase
        }
        Write-Host ""; Write-Host "All phases complete." -ForegroundColor Green
        Show-GitStatus
    }
}
