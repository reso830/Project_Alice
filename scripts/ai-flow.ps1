param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("spec", "req-review", "implement", "implement-next", "check-implementation", "check-next", "next-phase", "create-pr", "claude-pr-review", "codex-pr-review")]
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
New-Item -ItemType Directory -Force -Path $BootstrapLogDir | Out-Null

$script:FeatureSlug = $FeatureName
$script:SpecDir = $null
$script:FeatureId = $null
$script:LogDir = $null
$script:PhaseStatePath = $null

function Resolve-OptionalPath {
    param([string]$PathValue)

    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return "None provided."
    }

    $Candidate = $PathValue
    if (!(Test-Path $Candidate)) {
        $Candidate = Join-Path $Root $PathValue
    }

    if (!(Test-Path $Candidate)) {
        throw "File not found: $PathValue"
    }

    return (Resolve-Path $Candidate).Path
}

function Get-CurrentBranch {
    return (git branch --show-current).Trim()
}

function Find-SpeckitSpecDir {
    param([string]$RequestedName)

    $SpecsRoot = Join-Path $Root "specs"
    if (!(Test-Path $SpecsRoot)) {
        throw "specs directory not found. Let Speckit create it first with /speckit.specify."
    }

    $CurrentBranch = Get-CurrentBranch
    $Candidates = @()

    if ($CurrentBranch -match '^\d{3}-.+') {
        $Candidates += Join-Path $SpecsRoot $CurrentBranch
    }

    if ($RequestedName -match '^\d{3}-.+') {
        $Candidates += Join-Path $SpecsRoot $RequestedName
    } else {
        $Candidates += Join-Path $SpecsRoot $RequestedName
        $Candidates += Get-ChildItem -Path $SpecsRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match "^\d{3}-$([regex]::Escape($RequestedName))$" } |
            ForEach-Object { $_.FullName }
    }

    foreach ($Candidate in $Candidates | Select-Object -Unique) {
        if ((Test-Path $Candidate) -and (Test-Path (Join-Path $Candidate "spec.md"))) {
            return (Resolve-Path $Candidate).Path
        }
    }

    $LatestSpec = Get-ChildItem -Path $SpecsRoot -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^\d{3}-.+' -and (Test-Path (Join-Path $_.FullName "spec.md")) } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($null -ne $LatestSpec) {
        return $LatestSpec.FullName
    }

    throw "Could not resolve Speckit feature directory for '$RequestedName'. Run the spec action first or pass the numbered feature name."
}

function Initialize-FeatureContext {
    param([switch]$AllowMissingSpec)

    if ($AllowMissingSpec) {
        $script:SpecDir = Join-Path $Root "logs/ai-flow/$FeatureName"
        $script:FeatureId = $FeatureName
        $script:LogDir = $script:SpecDir
        $script:PhaseStatePath = Join-Path $script:SpecDir ".ai-phase"
        New-Item -ItemType Directory -Force -Path $script:LogDir | Out-Null
        return
    }

    $script:SpecDir = Find-SpeckitSpecDir -RequestedName $FeatureName
    $script:FeatureId = Split-Path $script:SpecDir -Leaf
    $script:LogDir = Join-Path $script:SpecDir "logs"
    $script:PhaseStatePath = Join-Path $script:SpecDir ".ai-phase"
    New-Item -ItemType Directory -Force -Path $script:LogDir | Out-Null
}

function Load-Prompt {
    param(
        [string]$TemplateName,
        [string]$FeatureBrief = "",
        [string]$DesignDoc = "",
        [int]$Phase = 0
    )

    $TemplatePath = Join-Path $PromptDir "$TemplateName.md"

    if (!(Test-Path $TemplatePath)) {
        throw "Prompt template not found: $TemplatePath"
    }

    $ResolvedFeatureBrief = Resolve-OptionalPath $FeatureBrief
    $ResolvedDesignDoc = Resolve-OptionalPath $DesignDoc
    $SpecDirForPrompt = if ($script:SpecDir) { $script:SpecDir } else { "Speckit will create the feature directory." }
    $FeatureIdForPrompt = if ($script:FeatureId) { $script:FeatureId } else { $FeatureName }

    $Prompt = Get-Content $TemplatePath -Raw
    $Prompt = $Prompt.Replace("{{FEATURE_NAME}}", $FeatureName)
    $Prompt = $Prompt.Replace("{{FEATURE_ID}}", $FeatureIdForPrompt)
    $Prompt = $Prompt.Replace("{{SPEC_DIR}}", $SpecDirForPrompt)
    $Prompt = $Prompt.Replace("{{FEATURE_BRIEF}}", $ResolvedFeatureBrief)
    $Prompt = $Prompt.Replace("{{DESIGN_DOC}}", $ResolvedDesignDoc)
    $Prompt = $Prompt.Replace("{{PHASE}}", ("{0:D2}" -f $Phase))
    $Prompt = $Prompt.Replace("{{BASE_BRANCH}}", $BaseBranch)

    return $Prompt
}

function Run-Claude {
    param([string]$Prompt, [string]$LogFile)
    Write-Host "Running Claude..." -ForegroundColor Cyan
    claude -p $Prompt | Tee-Object -FilePath $LogFile
}

function Run-Codex {
    param([string]$Prompt, [string]$LogFile)
    Write-Host "Running Codex..." -ForegroundColor Cyan
    codex exec $Prompt | Tee-Object -FilePath $LogFile
}

function Require-Approval {
    param([string]$Message)

    if ($SkipApproval) {
        Write-Host "Skipping approval gate: $Message" -ForegroundColor DarkYellow
        return
    }

    Write-Host ""
    Write-Host $Message -ForegroundColor Yellow
    $Answer = Read-Host "Continue? Type YES to proceed"
    if ($Answer -ne "YES") {
        Write-Host "Stopped." -ForegroundColor Red
        exit 1
    }
}

function Show-GitStatus {
    Write-Host ""
    Write-Host "Current git status:" -ForegroundColor Cyan
    git status --short
}

function Get-PhaseHeadings {
    $TasksPath = Join-Path $script:SpecDir "tasks.md"

    if (!(Test-Path $TasksPath)) {
        throw "tasks.md not found: $TasksPath"
    }

    $Content = Get-Content $TasksPath
    $Phases = @()

    foreach ($Line in $Content) {
        if ($Line -match '^#{1,3}\s+Phase\s+0*([0-9]+)\b(.*)$') {
            $Phases += [pscustomobject]@{ Number = [int]$Matches[1]; Title = $Line.Trim() }
        }
    }

    if ($Phases.Count -eq 0) {
        throw "No phase headings found in $TasksPath. Expected headings like: ## Phase 01: Foundation"
    }

    return $Phases | Sort-Object Number -Unique
}

function Get-CurrentPhase {
    if ($Phase -gt 0) { return $Phase }

    if (Test-Path $script:PhaseStatePath) {
        $SavedPhase = (Get-Content $script:PhaseStatePath -Raw).Trim()
        if ($SavedPhase -match '^[0-9]+$') { return [int]$SavedPhase }
    }

    $Phases = Get-PhaseHeadings
    return $Phases[0].Number
}

function Set-CurrentPhase {
    param([int]$Value)
    Set-Content -Path $script:PhaseStatePath -Value $Value
}

function Get-NextPhaseAfter {
    param([int]$Current)
    $Phases = Get-PhaseHeadings
    $Next = $Phases | Where-Object { $_.Number -gt $Current } | Select-Object -First 1
    if ($null -eq $Next) { return $null }
    return $Next.Number
}

function Show-Phases {
    $Current = Get-CurrentPhase
    $Phases = Get-PhaseHeadings

    Write-Host ""
    Write-Host "Feature directory: specs/$script:FeatureId" -ForegroundColor Cyan
    Write-Host "Detected phases:" -ForegroundColor Cyan
    foreach ($Item in $Phases) {
        $Marker = if ($Item.Number -eq $Current) { "*" } else { " " }
        Write-Host ("{0} Phase {1:D2} - {2}" -f $Marker, $Item.Number, $Item.Title)
    }
}

function Run-ImplementPhase {
    param([int]$SelectedPhase)
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
    Run-Claude -Prompt $Prompt -LogFile "$script:LogDir/07-claude-check-phase-$("{0:D2}" -f $SelectedPhase).log"

    $NextPhase = Get-NextPhaseAfter -Current $SelectedPhase
    if ($null -ne $NextPhase) {
        Set-CurrentPhase -Value $NextPhase
        Write-Host ""
        Write-Host "Next phase set to Phase $("{0:D2}" -f $NextPhase)." -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "No remaining phases detected." -ForegroundColor Green
    }
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
    if ($Draft) {
        gh pr create --base $BaseBranch --head $Branch --title $Title --body $Body --draft
    } else {
        gh pr create --base $BaseBranch --head $Branch --title $Title --body $Body
    }
}

switch ($Action) {
    "spec" {
        if ([string]::IsNullOrWhiteSpace($FeatureBrief)) {
            throw "Feature brief path is required. Example: ./scripts/ai-flow.ps1 spec profile-page-improvements features/profile-page-improvements.md -DesignDoc design/profile_page.md"
        }

        Initialize-FeatureContext -AllowMissingSpec
        $SpecifyPrompt = Load-Prompt -TemplateName "claude-specify" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc
        Run-Claude -Prompt $SpecifyPrompt -LogFile "$BootstrapLogDir/$FeatureName-01-claude-specify.log"

        Initialize-FeatureContext
        $PlanPrompt = Load-Prompt -TemplateName "claude-plan" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc
        Run-Claude -Prompt $PlanPrompt -LogFile "$script:LogDir/02-claude-plan.log"

        Initialize-FeatureContext
        $TasksPrompt = Load-Prompt -TemplateName "claude-tasks" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc
        Run-Claude -Prompt $TasksPrompt -LogFile "$script:LogDir/03-claude-tasks.log"

        Initialize-FeatureContext
        $ReviewPrompt = Load-Prompt -TemplateName "claude-spec-review" -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc
        Run-Claude -Prompt $ReviewPrompt -LogFile "$script:LogDir/04-claude-spec-review.log"

        $FirstPhase = (Get-PhaseHeadings | Select-Object -First 1).Number
        Set-CurrentPhase -Value $FirstPhase
        Show-Phases
        Show-GitStatus
        Write-Host ""
        Write-Host "Speckit package and Claude architect review complete." -ForegroundColor Green
        Write-Host "Review: specs/$script:FeatureId and logs/04-claude-spec-review.log"
    }

    "req-review" { Initialize-FeatureContext; Require-Approval "Have you reviewed and accepted Claude's Speckit output and architect review?"; $Prompt = Load-Prompt -TemplateName "codex-check-requirements"; Run-Codex -Prompt $Prompt -LogFile "$script:LogDir/05-codex-requirements-review.log"; Show-GitStatus }
    "next-phase" { Initialize-FeatureContext; Show-Phases }
    "implement" { Initialize-FeatureContext; Run-ImplementPhase -SelectedPhase (Get-CurrentPhase) }
    "implement-next" { Initialize-FeatureContext; Run-ImplementPhase -SelectedPhase (Get-CurrentPhase) }
    "check-implementation" { Initialize-FeatureContext; Run-CheckImplementation -SelectedPhase (Get-CurrentPhase) }
    "check-next" { Initialize-FeatureContext; Run-CheckImplementation -SelectedPhase (Get-CurrentPhase) }
    "create-pr" { Initialize-FeatureContext; New-PullRequest }
    "claude-pr-review" { Initialize-FeatureContext; Require-Approval "Is the PR open and ready for Claude final review comments?"; $Prompt = Load-Prompt -TemplateName "claude-pr-review" -Phase (Get-CurrentPhase); Run-Claude -Prompt $Prompt -LogFile "$script:LogDir/08-claude-pr-review.log" }
    "codex-pr-review" { Initialize-FeatureContext; Require-Approval "Is the PR open and ready for Codex final review comments?"; $Prompt = Load-Prompt -TemplateName "codex-pr-review" -Phase (Get-CurrentPhase); Run-Codex -Prompt $Prompt -LogFile "$script:LogDir/09-codex-pr-review.log" }
}
