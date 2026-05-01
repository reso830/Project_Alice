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
$SpecDir = Join-Path $Root "specs/$FeatureName"
$LogDir = Join-Path $SpecDir "logs"
$PromptDir = Join-Path $Root "scripts/prompts"
$PhaseStatePath = Join-Path $SpecDir ".ai-phase"

New-Item -ItemType Directory -Force -Path $SpecDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

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

function Load-Prompt {
    param(
        [string]$TemplateName,
        [string]$FeatureName,
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

    $Prompt = Get-Content $TemplatePath -Raw
    $Prompt = $Prompt.Replace("{{FEATURE_NAME}}", $FeatureName)
    $Prompt = $Prompt.Replace("{{FEATURE_BRIEF}}", $ResolvedFeatureBrief)
    $Prompt = $Prompt.Replace("{{DESIGN_DOC}}", $ResolvedDesignDoc)
    $Prompt = $Prompt.Replace("{{PHASE}}", ("{0:D2}" -f $Phase))
    $Prompt = $Prompt.Replace("{{BASE_BRANCH}}", $BaseBranch)

    return $Prompt
}

function Run-Claude {
    param(
        [string]$Prompt,
        [string]$LogFile
    )

    Write-Host "Running Claude..." -ForegroundColor Cyan
    claude -p $Prompt | Tee-Object -FilePath $LogFile
}

function Run-Codex {
    param(
        [string]$Prompt,
        [string]$LogFile
    )

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
    $TasksPath = Join-Path $SpecDir "tasks.md"

    if (!(Test-Path $TasksPath)) {
        throw "tasks.md not found: $TasksPath"
    }

    $Content = Get-Content $TasksPath
    $Phases = @()

    foreach ($Line in $Content) {
        if ($Line -match '^#{1,3}\s+Phase\s+0*([0-9]+)\b(.*)$') {
            $Phases += [pscustomobject]@{
                Number = [int]$Matches[1]
                Title = $Line.Trim()
            }
        }
    }

    if ($Phases.Count -eq 0) {
        throw "No phase headings found in specs/$FeatureName/tasks.md. Expected headings like: ## Phase 01: Foundation"
    }

    return $Phases | Sort-Object Number -Unique
}

function Get-CurrentPhase {
    if ($Phase -gt 0) {
        return $Phase
    }

    if (Test-Path $PhaseStatePath) {
        $SavedPhase = (Get-Content $PhaseStatePath -Raw).Trim()
        if ($SavedPhase -match '^[0-9]+$') {
            return [int]$SavedPhase
        }
    }

    $Phases = Get-PhaseHeadings
    return $Phases[0].Number
}

function Set-CurrentPhase {
    param([int]$Value)
    Set-Content -Path $PhaseStatePath -Value $Value
}

function Get-NextPhaseAfter {
    param([int]$Current)

    $Phases = Get-PhaseHeadings
    $Next = $Phases | Where-Object { $_.Number -gt $Current } | Select-Object -First 1

    if ($null -eq $Next) {
        return $null
    }

    return $Next.Number
}

function Show-Phases {
    $Current = Get-CurrentPhase
    $Phases = Get-PhaseHeadings

    Write-Host ""
    Write-Host "Detected phases:" -ForegroundColor Cyan
    foreach ($Item in $Phases) {
        $Marker = if ($Item.Number -eq $Current) { "*" } else { " " }
        Write-Host ("{0} Phase {1:D2} - {2}" -f $Marker, $Item.Number, $Item.Title)
    }
}

function Run-ImplementPhase {
    param([int]$SelectedPhase)

    Require-Approval "Have all requirement blockers been resolved for Phase $("{0:D2}" -f $SelectedPhase)?"

    $Prompt = Load-Prompt -TemplateName "codex-implement-phase" -FeatureName $FeatureName -Phase $SelectedPhase
    Run-Codex -Prompt $Prompt -LogFile "$LogDir/06-codex-phase-$("{0:D2}" -f $SelectedPhase).log"

    Set-CurrentPhase -Value $SelectedPhase
    Show-GitStatus
}

function Run-CheckImplementation {
    param([int]$SelectedPhase)

    Require-Approval "Have you reviewed Codex's Phase $("{0:D2}" -f $SelectedPhase) implementation diff locally?"

    $Prompt = Load-Prompt -TemplateName "claude-check-implementation" -FeatureName $FeatureName -Phase $SelectedPhase
    Run-Claude -Prompt $Prompt -LogFile "$LogDir/07-claude-check-phase-$("{0:D2}" -f $SelectedPhase).log"

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

function Get-CurrentBranch {
    return (git branch --show-current).Trim()
}

function New-PullRequest {
    $Branch = Get-CurrentBranch
    if ([string]::IsNullOrWhiteSpace($Branch)) {
        throw "Could not determine current git branch."
    }

    if ($Branch -eq $BaseBranch) {
        throw "Refusing to create a PR from $BaseBranch to itself. Checkout a feature branch first."
    }

    Require-Approval "Create a PR from $Branch into $BaseBranch?"

    $Title = "feat: $FeatureName"
    $Body = @"
## Summary

AI-assisted feature workflow for `$FeatureName`.

## Source artifacts

- `specs/$FeatureName/spec.md`
- `specs/$FeatureName/plan.md`
- `specs/$FeatureName/tasks.md`

## Review notes

Local AI workflow logs are stored under:

- `specs/$FeatureName/logs/`

## Manual testing

- [ ] Manual testing completed
- [ ] Claude PR review completed
- [ ] Codex PR review completed
"@

    git push -u origin $Branch

    $DraftFlag = if ($Draft) { "--draft" } else { "" }
    if ($Draft) {
        gh pr create --base $BaseBranch --head $Branch --title $Title --body $Body --draft
    } else {
        gh pr create --base $BaseBranch --head $Branch --title $Title --body $Body
    }
}

switch ($Action) {
    "spec" {
        if ([string]::IsNullOrWhiteSpace($FeatureBrief)) {
            throw "Feature brief path is required for the spec action. Example: ./scripts/ai-flow.ps1 spec profile-page-improvements features/profile-page-improvements.md -DesignDoc design/profile_page.md"
        }

        $SpecifyPrompt = Load-Prompt -TemplateName "claude-specify" -FeatureName $FeatureName -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc
        Run-Claude -Prompt $SpecifyPrompt -LogFile "$LogDir/01-claude-specify.log"

        $PlanPrompt = Load-Prompt -TemplateName "claude-plan" -FeatureName $FeatureName -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc
        Run-Claude -Prompt $PlanPrompt -LogFile "$LogDir/02-claude-plan.log"

        $TasksPrompt = Load-Prompt -TemplateName "claude-tasks" -FeatureName $FeatureName -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc
        Run-Claude -Prompt $TasksPrompt -LogFile "$LogDir/03-claude-tasks.log"

        $ReviewPrompt = Load-Prompt -TemplateName "claude-spec-review" -FeatureName $FeatureName -FeatureBrief $FeatureBrief -DesignDoc $DesignDoc
        Run-Claude -Prompt $ReviewPrompt -LogFile "$LogDir/04-claude-spec-review.log"

        $FirstPhase = (Get-PhaseHeadings | Select-Object -First 1).Number
        Set-CurrentPhase -Value $FirstPhase

        Show-Phases
        Show-GitStatus
        Write-Host ""
        Write-Host "Spec Kit package and Claude architect review complete." -ForegroundColor Green
        Write-Host "Review: specs/$FeatureName/spec.md, plan.md, tasks.md, and logs/04-claude-spec-review.log"
    }

    "req-review" {
        Require-Approval "Have you reviewed and accepted Claude's Spec Kit output and architect review?"

        $Prompt = Load-Prompt -TemplateName "codex-check-requirements" -FeatureName $FeatureName
        Run-Codex -Prompt $Prompt -LogFile "$LogDir/05-codex-requirements-review.log"

        Show-GitStatus
    }

    "next-phase" {
        Show-Phases
    }

    "implement" {
        $SelectedPhase = Get-CurrentPhase
        Run-ImplementPhase -SelectedPhase $SelectedPhase
    }

    "implement-next" {
        $SelectedPhase = Get-CurrentPhase
        Run-ImplementPhase -SelectedPhase $SelectedPhase
    }

    "check-implementation" {
        $SelectedPhase = Get-CurrentPhase
        Run-CheckImplementation -SelectedPhase $SelectedPhase
    }

    "check-next" {
        $SelectedPhase = Get-CurrentPhase
        Run-CheckImplementation -SelectedPhase $SelectedPhase
    }

    "create-pr" {
        New-PullRequest
    }

    "claude-pr-review" {
        Require-Approval "Is the PR open and ready for Claude final review comments?"

        $Prompt = Load-Prompt -TemplateName "claude-pr-review" -FeatureName $FeatureName -Phase (Get-CurrentPhase)
        Run-Claude -Prompt $Prompt -LogFile "$LogDir/08-claude-pr-review.log"
    }

    "codex-pr-review" {
        Require-Approval "Is the PR open and ready for Codex final review comments?"

        $Prompt = Load-Prompt -TemplateName "codex-pr-review" -FeatureName $FeatureName -Phase (Get-CurrentPhase)
        Run-Codex -Prompt $Prompt -LogFile "$LogDir/09-codex-pr-review.log"
    }
}
