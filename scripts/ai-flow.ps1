param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("spec", "req-review", "implement", "check-implementation", "claude-pr-review", "codex-pr-review")]
    [string]$Action,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$FeatureName,

    [Parameter(Position = 2)]
    [string]$FeatureBrief = "",

    [string]$DesignDoc = "",

    [int]$Phase = 1,

    [switch]$SkipApproval
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path "$PSScriptRoot/.."
$SpecDir = Join-Path $Root "specs/$FeatureName"
$LogDir = Join-Path $SpecDir "logs"
$PromptDir = Join-Path $Root "scripts/prompts"

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

    "implement" {
        Require-Approval "Have all requirement blockers been resolved for Phase $("{0:D2}" -f $Phase)?"

        $Prompt = Load-Prompt -TemplateName "codex-implement-phase" -FeatureName $FeatureName -Phase $Phase
        Run-Codex -Prompt $Prompt -LogFile "$LogDir/06-codex-phase-$("{0:D2}" -f $Phase).log"

        Show-GitStatus
    }

    "check-implementation" {
        Require-Approval "Have you reviewed Codex's Phase $("{0:D2}" -f $Phase) implementation diff locally?"

        $Prompt = Load-Prompt -TemplateName "claude-check-implementation" -FeatureName $FeatureName -Phase $Phase
        Run-Claude -Prompt $Prompt -LogFile "$LogDir/07-claude-check-phase-$("{0:D2}" -f $Phase).log"

        Show-GitStatus
    }

    "claude-pr-review" {
        Require-Approval "Is the PR open and ready for Claude final review comments?"

        $Prompt = Load-Prompt -TemplateName "claude-pr-review" -FeatureName $FeatureName
        Run-Claude -Prompt $Prompt -LogFile "$LogDir/08-claude-pr-review.log"
    }

    "codex-pr-review" {
        Require-Approval "Is the PR open and ready for Codex final review comments?"

        $Prompt = Load-Prompt -TemplateName "codex-pr-review" -FeatureName $FeatureName
        Run-Codex -Prompt $Prompt -LogFile "$LogDir/09-codex-pr-review.log"
    }
}
