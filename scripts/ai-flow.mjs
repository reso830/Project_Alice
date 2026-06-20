#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const promptDir = path.join(root, 'scripts', 'prompts');
const bootstrapLogDir = path.join(root, 'logs', 'ai-flow');
const tempPromptDir = path.join(bootstrapLogDir, 'prompts');
const autoWorktreeRoot = path.join(path.dirname(root), `${path.basename(root)}.worktrees`, 'ai-flow');

fs.mkdirSync(bootstrapLogDir, { recursive: true });
fs.mkdirSync(tempPromptDir, { recursive: true });

const validActions = new Set([
  'spec',
  'req-review',
  'next-phase',
  'implement',
  'implement-next',
  'implement-auto',
  'implement-next-auto',
  'mark-implemented',
  'check-implementation',
  'check-next',
  'create-pr',
  'claude-pr-review',
  'codex-pr-review',
  'run-all',
]);

const positional = [];
const options = {
  phase: 0,
  baseBranch: 'main',
  designDoc: '',
  draft: false,
  skipApproval: false,
};

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  const next = () => process.argv[++i] ?? '';
  if (arg === '--phase' || arg === '-Phase') options.phase = Number(next());
  else if (arg === '--base-branch' || arg === '-BaseBranch') options.baseBranch = next();
  else if (arg === '--design-doc' || arg === '-DesignDoc') options.designDoc = next();
  else if (arg === '--draft' || arg === '-Draft') options.draft = true;
  else if (arg === '--skip-approval' || arg === '-SkipApproval') options.skipApproval = true;
  else positional.push(arg);
}

const [action, featureName, featureBrief = ''] = positional;
if (!validActions.has(action) || !featureName) {
  console.error('Usage: node scripts/ai-flow.mjs <action> <feature-name> [feature-brief] [--phase N] [--design-doc path] [--skip-approval]');
  process.exit(1);
}

let specDir = '';
let featureId = '';
let logDir = '';
let phaseStatePath = '';
let readinessPath = '';
let workflowPath = '';

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function humanTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function resolveCommand(cmd) {
  if (process.platform !== 'win32') return cmd;
  const known = {
    git: 'C:\\Program Files\\Git\\cmd\\git.exe',
    gh: 'C:\\Program Files\\GitHub CLI\\gh.exe',
    claude: path.join(process.env.USERPROFILE ?? '', '.local', 'bin', 'claude.exe'),
    codex: path.join(process.env.APPDATA ?? '', 'npm', 'codex.cmd'),
  };
  return known[cmd] && fs.existsSync(known[cmd]) ? known[cmd] : cmd;
}

function run(cmd, args, { cwd = root, logFile = '', allowFail = false } = {}) {
  const resolvedCmd = resolveCommand(cmd);
  const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolvedCmd);
  const result = spawnSync(resolvedCmd, args, { cwd, encoding: 'utf8', shell: needsShell });
  const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (out) process.stdout.write(out);
  if (logFile) fs.appendFileSync(logFile, out);
  if (!allowFail && result.status !== 0) {
    const detail = result.error ? ` (${result.error.message})` : '';
    const message = `${cmd} ${args.join(' ')} failed with exit code ${result.status}${detail}`;
    if (logFile && !out) fs.appendFileSync(logFile, `${message}\n`);
    throw new Error(message);
  }
  return { code: result.status ?? 0, out };
}

function git(args, cwd = root, opts = {}) {
  return run('git', args, { cwd, ...opts }).out.trim();
}

function resolveOptionalPath(value) {
  if (!value) return 'None provided.';
  const direct = path.resolve(value);
  const fromRoot = path.resolve(root, value);
  if (fs.existsSync(direct)) return direct;
  if (fs.existsSync(fromRoot)) return fromRoot;
  throw new Error(`File not found: ${value}`);
}

function currentBranch() {
  return git(['branch', '--show-current']);
}

function getBootstrapFeatureId() {
  if (/^\d{3}-.+/.test(featureName)) return featureName;
  const specsRoot = path.join(root, 'specs');
  let nextNum = 1;
  if (fs.existsSync(specsRoot)) {
    for (const entry of fs.readdirSync(specsRoot, { withFileTypes: true })) {
      const m = entry.isDirectory() && entry.name.match(/^(\d{3})-/);
      if (m) nextNum = Math.max(nextNum, Number(m[1]) + 1);
    }
  }
  return `${String(nextNum).padStart(3, '0')}-${featureName}`;
}

function findSpecDir(requestedName) {
  const specsRoot = path.join(root, 'specs');
  if (!fs.existsSync(specsRoot)) throw new Error('specs directory not found.');
  const candidates = [];
  candidates.push(path.join(specsRoot, requestedName));
  if (!/^\d{3}-.+/.test(requestedName)) {
    for (const entry of fs.readdirSync(specsRoot, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name === `${entry.name.slice(0, 4)}${requestedName}` && /^\d{3}-/.test(entry.name)) {
        candidates.push(path.join(specsRoot, entry.name));
      }
    }
  }
  const branch = currentBranch();
  if (/^\d{3}-.+/.test(branch)) candidates.push(path.join(specsRoot, branch));
  for (const candidate of [...new Set(candidates)]) {
    if (fs.existsSync(path.join(candidate, 'spec.md'))) return path.resolve(candidate);
  }
  throw new Error(`Could not resolve Speckit feature directory for '${requestedName}'.`);
}

function initializeFeatureContext({ allowMissingSpec = false } = {}) {
  if (allowMissingSpec) {
    featureId = getBootstrapFeatureId();
    specDir = path.join(root, 'logs', 'ai-flow', featureId);
    logDir = specDir;
  } else {
    specDir = findSpecDir(featureName);
    featureId = path.basename(specDir);
    logDir = path.join(specDir, 'logs');
  }
  phaseStatePath = path.join(specDir, '.ai-phase');
  readinessPath = path.join(specDir, '.ai-requirements-ready');
  workflowPath = path.join(specDir, 'ai-workflow.md');
  fs.mkdirSync(logDir, { recursive: true });
}

function loadPrompt(templateName, { phase = 0, specDirOverride = specDir, workflowPathOverride = workflowPath } = {}) {
  const templatePath = path.join(promptDir, `${templateName}.md`);
  if (!fs.existsSync(templatePath)) throw new Error(`Prompt template not found: ${templatePath}`);
  let prompt = fs.readFileSync(templatePath, 'utf8');
  const replacements = {
    '{{FEATURE_NAME}}': featureName,
    '{{FEATURE_ID}}': featureId || featureName,
    '{{SPEC_DIR}}': specDirOverride || 'Speckit will create the feature directory.',
    '{{FEATURE_BRIEF}}': resolveOptionalPath(featureBrief),
    '{{DESIGN_DOC}}': resolveOptionalPath(options.designDoc),
    '{{PHASE}}': String(phase).padStart(2, '0'),
    '{{BASE_BRANCH}}': options.baseBranch,
    '{{AI_WORKFLOW}}': workflowPathOverride || 'Not created yet.',
  };
  for (const [key, value] of Object.entries(replacements)) prompt = prompt.split(key).join(value);
  return prompt;
}

function writePromptFile(prompt, toolName) {
  const safeFeature = featureName.replace(/[^a-zA-Z0-9_.-]/g, '-');
  const promptPath = path.join(tempPromptDir, `${safeFeature}-${toolName}-${randomUUID().replace(/-/g, '')}.md`);
  fs.writeFileSync(promptPath, prompt, 'utf8');
  return promptPath;
}

function newLogPath(baseName) {
  return path.join(logDir, `${baseName}-${timestamp()}.log`);
}

function runClaude(prompt, logFile, allowedTools = 'Write,Edit,Read,Bash,Glob,Grep') {
  console.log('Running Claude...');
  fs.writeFileSync(logFile, '');
  const promptPath = writePromptFile(prompt, 'claude');
  const runnerPrompt = `Read and follow the full instructions in this local prompt file: ${promptPath}`;
  run('claude', ['-p', runnerPrompt, '--allowedTools', allowedTools], { logFile });
}

function runCodex(prompt, logFile, { sandbox = 'read-only', cwd = root } = {}) {
  console.log('Running Codex...');
  fs.writeFileSync(logFile, '');
  const promptPath = writePromptFile(prompt, 'codex');
  const runnerPrompt = `Read and follow the full instructions in this local prompt file: ${promptPath}`;
  run('codex', ['exec', '--sandbox', sandbox, '--cd', cwd, runnerPrompt], { logFile });
}

function requireApproval(message) {
  if (options.skipApproval) {
    console.log(`Skipping approval gate: ${message}`);
    return;
  }
  console.log(`\n${message}`);
  console.log('Set --skip-approval for non-interactive automation, or rerun after confirming manually.');
  process.exit(1);
}

function ensureWorkflow() {
  if (!workflowPath || fs.existsSync(workflowPath)) return;
  const content = `# AI Workflow Log: ${featureId}

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
- Token columns are cumulative per action row and are populated from token counts emitted in Claude/Codex CLI logs when available.
- Agents must read this file before reviewing or implementing.
- User notes and accepted resolutions are authoritative unless they conflict with the project constitution.
- Finding states: \`New\`, \`Resolved\`, \`Accepted\`.
- \`Resolved\` means a corrective change was made. \`Accepted\` means the user accepted the item as non-blocking or intentionally declined a change.
- Finding severity labels: \`CRITICAL\`, \`MAJOR\`, \`MINOR\`, \`INFO\`.
- \`CRITICAL\`: app-breaking issue or major constitution conflict. Current phase cannot proceed.
- \`MAJOR\`: app-breaking or major bug. Must be resolved before moving forward.
- \`MINOR\`: non-breaking issue that can still cause problems, including UI/UX. Must be resolved before moving forward.
- \`INFO\`: FYI based on findings. Non-blocking unless the user decides otherwise.
- Implementation statuses: \`NOT_STARTED\`, \`IN_PROGRESS\`, \`PENDING_REVIEW\`, \`READY\`, \`NOT_READY\`, \`BLOCKED\`.
- Append new review entries. Do not remove prior review history.

## Spec

Status: NOT_STARTED

### Notes

- Pending.

## Req-Review

Status: NOT_STARTED

### Instructions

At the start of req-review, Claude inspects this section for standing findings and user responses. If there are \`New\` findings, Claude addresses them in the requirements artifacts unless the user marked them \`Accepted\` or provided an override. After that, Claude and Codex perform review passes.

### Findings

This table tracks active blocking findings only. Advisory notes from \`Ready\` reviews are kept in Review History.

| ID | Severity | State | Finding | Raised By | Resolution |
|---:|---|---|---|---|---|

### User Notes

Add responses here.

## Implementation

### Instructions

Before implementing a phase, inspect this file for standing findings. Address \`New\` findings for the current phase unless the user marked them \`Accepted\`.

## Phase 01

Status: NOT_STARTED

### Findings

| ID | Severity | State | Finding | Raised By | Resolution |
|---:|---|---|---|---|---|

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

`;
  fs.writeFileSync(workflowPath, content, 'utf8');
}

function updateOverviewRow(actionName, updater) {
  const lines = fs.readFileSync(workflowPath, 'utf8').split(/\r?\n/);
  const index = lines.findIndex((line) => {
    const cells = line.split('|');
    return cells.length >= 6 && cells[1]?.trim() === actionName;
  });
  if (index < 0) return lines.join('\n');
  const cells = lines[index].split('|');
  updater(cells);
  lines[index] = cells.join('|');
  return lines.join('\n');
}

function setWorkflowStatus(actionName, sectionHeading, status) {
  ensureWorkflow();
  let content = updateOverviewRow(actionName, (cells) => {
    cells[2] = ` ${status} `;
  });
  const escapedSection = sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  content = content.replace(new RegExp(`(## ${escapedSection}\\r?\\n\\r?\\nStatus: )[^\\r\\n]+`, 's'), `$1${status}`);
  fs.writeFileSync(workflowPath, content, 'utf8');
}

function setWorkflowLatestLogs(actionName, logFiles) {
  ensureWorkflow();
  const logText = logFiles.filter(Boolean).map((file) => `\`${path.relative(root, file).replaceAll(path.sep, '/')}\``).join(', ');
  const content = updateOverviewRow(actionName, (cells) => {
    cells[5] = ` ${logText} `;
  });
  fs.writeFileSync(workflowPath, content, 'utf8');
}

function numberFromTokenText(value) {
  return Number(value.replaceAll(',', ''));
}

function parseTokenCountFromLog(logFile) {
  if (!logFile || !fs.existsSync(logFile)) return 0;
  const text = fs.readFileSync(logFile, 'utf8');
  const candidates = [];
  const patterns = [
    /token\s+usage\s*[:=]\s*([\d,]+)/gi,
    /tokens\s+used\s*[:=]?\s*([\d,]+)/gi,
    /total\s+tokens\s*[:=]?\s*([\d,]+)/gi,
    /([\d,]+)\s+tokens?\s+used/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) candidates.push(numberFromTokenText(match[1]));
  }

  if (candidates.length > 0) return candidates.at(-1);

  const input = text.match(/input\s+tokens?\s*[:=]?\s*([\d,]+)/i);
  const output = text.match(/output\s+tokens?\s*[:=]?\s*([\d,]+)/i);
  if (input || output) {
    return (input ? numberFromTokenText(input[1]) : 0) + (output ? numberFromTokenText(output[1]) : 0);
  }

  return 0;
}

function formatTokenCount(value) {
  return value > 0 ? value.toLocaleString('en-US') : '';
}

function setWorkflowTokens(actionName, { claudeLogs, codexLogs } = {}) {
  ensureWorkflow();
  const claudeTotal = Array.isArray(claudeLogs) ? claudeLogs.reduce((sum, file) => sum + parseTokenCountFromLog(file), 0) : null;
  const codexTotal = Array.isArray(codexLogs) ? codexLogs.reduce((sum, file) => sum + parseTokenCountFromLog(file), 0) : null;
  const content = updateOverviewRow(actionName, (cells) => {
    if (claudeTotal !== null) cells[3] = ` ${formatTokenCount(claudeTotal)} `;
    if (codexTotal !== null) cells[4] = ` ${formatTokenCount(codexTotal)} `;
  });
  fs.writeFileSync(workflowPath, content, 'utf8');
}

function getPhaseHeadings() {
  const tasksPath = path.join(specDir, 'tasks.md');
  if (!fs.existsSync(tasksPath)) throw new Error(`tasks.md not found: ${tasksPath}`);
  const phases = [];
  for (const line of fs.readFileSync(tasksPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^##\s+Phase\s+(\d+)\b(.*)$/i);
    if (m) phases.push({ number: Number(m[1]), title: line.trim() });
  }
  if (phases.length === 0) throw new Error('No phases found in tasks.md.');
  return phases.sort((a, b) => a.number - b.number);
}

function syncWorkflowPhases() {
  ensureWorkflow();
  let content = fs.readFileSync(workflowPath, 'utf8');
  for (const phase of getPhaseHeadings()) {
    const phaseLabel = `Phase ${String(phase.number).padStart(2, '0')}`;
    const actionLabel = `Implement - ${phaseLabel}`;
    if (!new RegExp(`^\\| ${actionLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\|`, 'm').test(content)) {
      content = content.replace(/^(\| Create PR \|)/m, `| ${actionLabel} | NOT_STARTED |  |  |  |\n$1`);
    }
    if (!new RegExp(`^## ${phaseLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm').test(content)) {
      const section = `\n## ${phaseLabel}\n\nStatus: NOT_STARTED\n\n### Findings\n\n| ID | Severity | State | Finding | Raised By | Resolution |\n|---:|---|---|---|---|---|\n\n`;
      content = content.replace(/^## Create PR$/m, `${section}## Create PR`);
    }
  }
  fs.writeFileSync(workflowPath, content, 'utf8');
}

function setRequirementsReady(ready) {
  fs.writeFileSync(readinessPath, ready ? 'READY\n' : 'NOT_READY\n', 'utf8');
}

function assertRequirementsReady() {
  if (!fs.existsSync(readinessPath)) throw new Error(`Requirements gate not found. Run req-review first.`);
  const state = fs.readFileSync(readinessPath, 'utf8').trim();
  if (state !== 'READY') throw new Error(`Requirements are not marked READY. Current gate: ${state}`);
}

function phaseGatePath(phase) {
  return path.join(specDir, `.ai-phase-${String(phase).padStart(2, '0')}-review`);
}

function setPhaseGate(phase, state) {
  fs.writeFileSync(phaseGatePath(phase), `${state}\n`, 'utf8');
}

function setCurrentPhase(phase) {
  fs.writeFileSync(phaseStatePath, `${phase}\n`, 'utf8');
}

function getCurrentPhase() {
  const phases = getPhaseHeadings();
  const exists = (n) => phases.some((phase) => phase.number === n);
  if (options.phase > 0) {
    if (!exists(options.phase)) throw new Error(`Phase ${options.phase} not found in tasks.md.`);
    return options.phase;
  }
  if (fs.existsSync(phaseStatePath)) {
    const saved = Number(fs.readFileSync(phaseStatePath, 'utf8').trim());
    if (Number.isInteger(saved) && exists(saved)) return saved;
  }
  return phases[0].number;
}

function showPhases() {
  const current = getCurrentPhase();
  console.log(`\nFeature directory: specs/${featureId}`);
  if (fs.existsSync(readinessPath)) console.log(`Requirements gate: ${fs.readFileSync(readinessPath, 'utf8').trim()}`);
  console.log('Detected phases:');
  for (const phase of getPhaseHeadings()) {
    const gatePath = phaseGatePath(phase.number);
    const gate = fs.existsSync(gatePath) ? fs.readFileSync(gatePath, 'utf8').trim() : 'PENDING';
    console.log(`${phase.number === current ? '*' : ' '} Phase ${String(phase.number).padStart(2, '0')} [${gate}] - ${phase.title}`);
  }
}

function getReviewVerdict(logFile, allowedVerdicts) {
  if (!fs.existsSync(logFile)) return '';
  let verdict = '';
  for (const line of fs.readFileSync(logFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (allowedVerdicts.includes(trimmed)) verdict = trimmed;
  }
  return verdict;
}

function getReviewExcerpt(logFile, allowedVerdicts) {
  const lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
  let start = -1;
  lines.forEach((line, idx) => {
    if (allowedVerdicts.includes(line.trim())) start = idx;
  });
  if (start < 0) return '_No parseable review excerpt found. See raw log._';
  return lines.slice(start).filter((line) => !/^tokens used$/i.test(line.trim())).join('\n').trim();
}

function appendWorkflowReview(actionName, reviewer, verdict, logFile, allowedVerdicts) {
  ensureWorkflow();
  const entry = `
### ${humanTimestamp()} - ${reviewer} ${actionName}

Mode: review
Verdict: ${verdict}
Raw Log: \`${path.relative(root, logFile).replaceAll(path.sep, '/')}\`

\`\`\`text
${getReviewExcerpt(logFile, allowedVerdicts)}
\`\`\`

`;
  fs.appendFileSync(workflowPath, entry, 'utf8');
  console.log(`AI workflow log updated: ${workflowPath}`);
}

function appendWorkflowNote(actionName, reviewer, verdict, logFile, note) {
  ensureWorkflow();
  const entry = `
### ${humanTimestamp()} - ${reviewer} ${actionName}

Mode: review
Verdict: ${verdict}
Raw Log: \`${path.relative(root, logFile).replaceAll(path.sep, '/')}\`

\`\`\`text
${note}
\`\`\`

`;
  fs.appendFileSync(workflowPath, entry, 'utf8');
  console.log(`AI workflow log updated: ${workflowPath}`);
}

function markdownCell(value) {
  return value.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|').trim();
}

function normalizeSeverity(value) {
  const upper = value.toUpperCase();
  if (['CRITICAL', 'P0', 'BLOCKER', 'BLOCKING'].includes(upper)) return 'CRITICAL';
  if (['MAJOR', 'P1', 'HIGH'].includes(upper)) return 'MAJOR';
  if (['MINOR', 'P2', 'MEDIUM', 'LOW'].includes(upper)) return 'MINOR';
  if (['INFO', 'INFORMATIONAL', 'ADVISORY', 'FYI', 'NOTE', 'P3'].includes(upper)) return 'INFO';
  return 'MINOR';
}

function parseFindingSeverity(finding) {
  const patterns = [
    /^\s*\[?(CRITICAL|MAJOR|MINOR|INFO|P0|P1|P2|P3|HIGH|MEDIUM|LOW|ADVISORY|INFORMATIONAL|FYI|NOTE|BLOCKER|BLOCKING)\]?\s*[:\-–—]?\s*(.+)$/i,
    /^\s*`(CRITICAL|MAJOR|MINOR|INFO|P0|P1|P2|P3|HIGH|MEDIUM|LOW|ADVISORY|INFORMATIONAL|FYI|NOTE|BLOCKER|BLOCKING)`\s*[:\-–—]?\s*(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = finding.match(pattern);
    if (match) return { severity: normalizeSeverity(match[1]), text: match[2].trim() };
  }
  return { severity: 'MINOR', text: finding.trim() };
}

function addFindingsFromReview(sectionHeading, raisedBy, logFile, allowedVerdicts) {
  const excerpt = getReviewExcerpt(logFile, allowedVerdicts);
  const findings = [];
  let current = '';
  for (const line of excerpt.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || allowedVerdicts.includes(trimmed) || /^tokens used\b/i.test(trimmed)) continue;
    if (/^token usage\s*:/i.test(trimmed)) continue;
    if (/^-{3,}$/.test(trimmed)) continue;
    const heading = trimmed.match(/^\**\s*(CRITICAL|MAJOR|MINOR|INFO)(?:[-\s]*\d+)?\s*[:\-–—]\s*(.+?)\s*\**$/i);
    if (heading) {
      if (current) findings.push(current.trim());
      current = `${heading[1].toUpperCase()}: ${heading[2]}`;
      continue;
    }
    const bullet = trimmed.match(/^(?:-|\d+\.)\s+(.+)$/);
    if (bullet) {
      if (current) findings.push(current.trim());
      current = bullet[1];
    } else if (current) {
      current += ` ${trimmed}`;
    }
  }
  if (current) findings.push(current.trim());
  if (findings.length === 0) return;

  const lines = fs.readFileSync(workflowPath, 'utf8').split(/\r?\n/);
  const sectionIndex = lines.findIndex((line) => line === `## ${sectionHeading}`);
  if (sectionIndex < 0) return;
  const separatorIndex = lines.findIndex((line, idx) => idx > sectionIndex && (line === '|---:|---|---|---|---|' || line === '|---:|---|---|---|---|---|'));
  if (separatorIndex < 0) return;
  let insertIndex = separatorIndex + 1;
  let nextId = 1;
  while (insertIndex < lines.length && /^\|\s*\d+\s*\|/.test(lines[insertIndex])) {
    const id = Number(lines[insertIndex].match(/^\|\s*(\d+)/)?.[1] ?? 0);
    nextId = Math.max(nextId, id + 1);
    insertIndex++;
  }
  const existing = lines.join('\n');
  const rows = [];
  for (const finding of findings) {
    const parsed = parseFindingSeverity(finding);
    const cell = markdownCell(parsed.text);
    if (existing.includes(cell)) continue;
    rows.push(`| ${nextId++} | ${parsed.severity} | New | ${cell} | ${raisedBy} |  |`);
  }
  if (rows.length === 0) return;
  lines.splice(insertIndex, 0, ...rows);
  fs.writeFileSync(workflowPath, lines.join('\n'), 'utf8');
}

function setPhaseBlocked(phase, reason, logFile = '') {
  setPhaseGate(phase, 'BLOCKED');
  const phaseLabel = `Phase ${String(phase).padStart(2, '0')}`;
  setWorkflowStatus(`Implement - ${phaseLabel}`, phaseLabel, 'BLOCKED');
  if (logFile && fs.existsSync(logFile)) setWorkflowLatestLogs(`Implement - ${phaseLabel}`, [logFile]);
  console.log(`\n${phaseLabel} marked BLOCKED: ${reason}`);
}

function testWriteAccess(dir) {
  if (!fs.existsSync(dir)) throw new Error(`Preflight directory does not exist: ${dir}`);
  const testPath = path.join(dir, `.ai-flow-write-test-${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(testPath, 'ok');
    fs.rmSync(testPath, { force: true });
    return true;
  } catch {
    try { fs.rmSync(testPath, { force: true }); } catch {}
    return false;
  }
}

function copyDirectoryMirror(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true, verbatimSymlinks: true });
}

function newAutoWorktree(selectedPhase) {
  fs.mkdirSync(autoWorktreeRoot, { recursive: true });
  const safeFeature = featureId.replace(/[^a-zA-Z0-9_.-]/g, '-');
  const worktreePath = path.join(autoWorktreeRoot, `${safeFeature}-phase-${String(selectedPhase).padStart(2, '0')}-${timestamp()}`);
  console.log(`Creating isolated worktree: ${worktreePath}`);
  git(['worktree', 'add', '--detach', worktreePath, 'HEAD']);

  for (const rel of ['src', 'tests', 'server', 'shared', path.join('scripts', 'prompts')]) {
    copyDirectoryMirror(path.join(root, rel), path.join(worktreePath, rel));
  }
  copyDirectoryMirror(specDir, path.join(worktreePath, 'specs', featureId));

  const denied = [];
  for (const rel of ['src', 'tests', 'server', 'shared', path.join('specs', featureId)]) {
    const dir = path.join(worktreePath, rel);
    if (fs.existsSync(dir) && !testWriteAccess(dir)) denied.push(dir);
  }
  if (denied.length > 0) throw new Error(`Auto worktree preflight failed. Write denied: ${denied.join(', ')}`);
  return worktreePath;
}

function fileHash(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function copyAutoWorktreeChanges(worktreePath, selectedPhase) {
  const diffPath = path.join(logDir, `worktree-result-${String(selectedPhase).padStart(2, '0')}-${timestamp()}.patch`);
  const diff = git(['-C', worktreePath, 'diff', '--', '.', `:(exclude)specs/${featureId}/logs`]);
  fs.writeFileSync(diffPath, diff, 'utf8');
  const nameStatus = git(['-C', worktreePath, 'diff', '--name-status', '--', '.', `:(exclude)specs/${featureId}/logs`]);
  const copied = [];
  for (const row of nameStatus.split(/\r?\n/).filter(Boolean)) {
    const m = row.match(/^([A-Z])\s+(.+)$/);
    if (!m) continue;
    const [, status, rel] = m;
    if (status === 'D') throw new Error(`Auto worktree attempted to delete ${rel}. Deletions are not copied back automatically.`);
    const worktreeFile = path.join(worktreePath, rel);
    const mainFile = path.join(root, rel);
    if (!fs.existsSync(worktreeFile) || fs.statSync(worktreeFile).isDirectory()) continue;
    if (fs.existsSync(mainFile) && fileHash(worktreeFile) === fileHash(mainFile)) continue;
    fs.mkdirSync(path.dirname(mainFile), { recursive: true });
    fs.copyFileSync(worktreeFile, mainFile);
    copied.push(rel);
  }
  if (copied.length === 0) throw new Error('Auto worktree completed without producing changes beyond the current main workspace state.');
  console.log('Copied auto worktree changes to main workspace:');
  copied.forEach((file) => console.log(`- ${file}`));
  console.log(`Result patch retained for inspection: ${diffPath}`);
}

function removeAutoWorktree(worktreePath) {
  if (!worktreePath || !fs.existsSync(worktreePath)) return;
  run('git', ['worktree', 'remove', '--force', worktreePath], { allowFail: true });
}

function gitDeletedPaths(cwd) {
  const out = git(['diff', '--name-status', '--', 'src', 'tests', 'server', 'shared'], cwd);
  return out.split(/\r?\n/).filter((row) => /^D\s+/.test(row)).map((row) => row.replace(/^D\s+/, ''));
}

function assertAutoSucceeded(phase, logFile, deletedBefore, cwd) {
  const log = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
  if (/^\*\*Blocked\*\*|^\s*Blocked\s*$|could not complete|environment is refusing/im.test(log)) {
    setPhaseBlocked(phase, 'Codex auto implementation reported a blocked state.', logFile);
    throw new Error(`Codex auto implementation reported BLOCKED. See log: ${logFile}`);
  }
  const deletedAfter = gitDeletedPaths(cwd);
  const newDeleted = deletedAfter.filter((file) => !deletedBefore.includes(file));
  if (newDeleted.length > 0) {
    setPhaseBlocked(phase, `Auto implementation introduced deleted source/test files: ${newDeleted.join(', ')}`, logFile);
    throw new Error(`Auto implementation introduced deleted source/test files: ${newDeleted.join(', ')}`);
  }
}

function runImplementAuto(selectedPhase) {
  assertRequirementsReady();
  ensureWorkflow();
  syncWorkflowPhases();
  setPhaseGate(selectedPhase, 'IN_PROGRESS');
  const phaseLabel = `Phase ${String(selectedPhase).padStart(2, '0')}`;
  setWorkflowStatus(`Implement - ${phaseLabel}`, phaseLabel, 'IN_PROGRESS');
  requireApproval(`Run child Codex auto implementation for ${phaseLabel} inside an isolated git worktree?`);
  const implementationLog = newLogPath(`06-codex-phase-${String(selectedPhase).padStart(2, '0')}`);
  let worktreePath = '';
  try {
    worktreePath = newAutoWorktree(selectedPhase);
    const worktreeSpecDir = path.join(worktreePath, 'specs', featureId);
    const worktreeWorkflowPath = path.join(worktreeSpecDir, 'ai-workflow.md');
    const prompt = loadPrompt('codex-implement-phase', {
      phase: selectedPhase,
      specDirOverride: worktreeSpecDir,
      workflowPathOverride: worktreeWorkflowPath,
    });
    const deletedBefore = gitDeletedPaths(worktreePath);
    runCodex(prompt, implementationLog, { sandbox: 'workspace-write', cwd: worktreePath });
    assertAutoSucceeded(selectedPhase, implementationLog, deletedBefore, worktreePath);
    copyAutoWorktreeChanges(worktreePath, selectedPhase);
    removeAutoWorktree(worktreePath);
  } catch (error) {
    if (worktreePath) console.log(`Auto worktree retained for inspection: ${worktreePath}`);
    setPhaseBlocked(selectedPhase, error.message, implementationLog);
    throw error;
  }
  setWorkflowLatestLogs(`Implement - ${phaseLabel}`, [implementationLog]);
  setWorkflowStatus(`Implement - ${phaseLabel}`, phaseLabel, 'PENDING_REVIEW');
  setPhaseGate(selectedPhase, 'PENDING_REVIEW');
  setWorkflowTokens(`Implement - ${phaseLabel}`, { codexLogs: [implementationLog] });
  setCurrentPhase(selectedPhase);
  showGitStatus();
}

function showImplementationPacket(selectedPhase) {
  assertRequirementsReady();
  ensureWorkflow();
  syncWorkflowPhases();
  setPhaseGate(selectedPhase, 'IN_PROGRESS');
  const phaseLabel = `Phase ${String(selectedPhase).padStart(2, '0')}`;
  setWorkflowStatus(`Implement - ${phaseLabel}`, phaseLabel, 'IN_PROGRESS');
  setCurrentPhase(selectedPhase);
  const promptPath = writePromptFile(loadPrompt('codex-implement-phase', { phase: selectedPhase }), 'active-codex-implement');
  console.log(`\n${phaseLabel} is ready for implementation in this active Codex session.`);
  console.log('\nImplementation packet:');
  console.log(`- Workflow: ${workflowPath}`);
  console.log(`- Tasks: ${path.join(specDir, 'tasks.md')}`);
  console.log(`- Plan: ${path.join(specDir, 'plan.md')}`);
  console.log(`- Spec: ${path.join(specDir, 'spec.md')}`);
  console.log(`- Prompt: ${promptPath}`);
  console.log(`\nNo child agent was run. After implementing ${phaseLabel}, run:`);
  console.log(`node scripts/ai-flow.mjs mark-implemented ${featureName} --phase ${selectedPhase}`);
  showPhases();
}

function markImplemented(selectedPhase) {
  ensureWorkflow();
  syncWorkflowPhases();
  const phaseLabel = `Phase ${String(selectedPhase).padStart(2, '0')}`;
  setPhaseGate(selectedPhase, 'PENDING_REVIEW');
  setWorkflowStatus(`Implement - ${phaseLabel}`, phaseLabel, 'PENDING_REVIEW');
  setCurrentPhase(selectedPhase);
  console.log(`${phaseLabel} marked PENDING_REVIEW.`);
  showGitStatus();
}

function runCheckImplementation(selectedPhase) {
  ensureWorkflow();
  syncWorkflowPhases();
  requireApproval(`Have you reviewed Codex's Phase ${String(selectedPhase).padStart(2, '0')} implementation diff locally?`);
  const reviewLog = newLogPath(`07-claude-check-phase-${String(selectedPhase).padStart(2, '0')}`);
  runClaude(loadPrompt('claude-check-implementation', { phase: selectedPhase }), reviewLog, 'Read,Bash,Glob,Grep');
  const verdict = getReviewVerdict(reviewLog, ['Pass', 'Needs Changes']);
  if (!verdict) {
    setPhaseBlocked(selectedPhase, 'Implementation review did not return a parseable first-line verdict.', reviewLog);
    throw new Error(`Could not parse implementation review verdict. Expected first line: Pass or Needs Changes. See log: ${reviewLog}`);
  }
  const phaseLabel = `Phase ${String(selectedPhase).padStart(2, '0')}`;
  const status = verdict === 'Pass' ? 'READY' : 'NOT_READY';
  setPhaseGate(selectedPhase, verdict === 'Pass' ? 'PASS' : 'NEEDS_CHANGES');
  setWorkflowStatus(`Implement - ${phaseLabel}`, phaseLabel, status);
  setWorkflowLatestLogs(`Implement - ${phaseLabel}`, [reviewLog]);
  setWorkflowTokens(`Implement - ${phaseLabel}`, { claudeLogs: [reviewLog] });
  appendWorkflowReview(`Implementation Review ${phaseLabel}`, 'Claude', verdict, reviewLog, ['Pass', 'Needs Changes']);
  if (verdict !== 'Pass') throw new Error(`${phaseLabel} did not pass Claude review.`);
  const next = getPhaseHeadings().find((phase) => phase.number > selectedPhase);
  if (next) setCurrentPhase(next.number);
  showGitStatus();
}

function showGitStatus() {
  console.log('\nCurrent git status:');
  run('git', ['status', '--short'], { allowFail: true });
}

function updateRequirementsReadyFromVerdicts(verdicts) {
  const ready = verdicts.length > 0 && verdicts.every((v) => v === 'Ready');
  setRequirementsReady(ready);
  console.log(`Requirements gate marked ${ready ? 'READY' : 'NOT_READY'}.`);
}

function runReqReview() {
  ensureWorkflow();
  syncWorkflowPhases();
  const addressLog = newLogPath('04-claude-address-req-review');
  runClaude(loadPrompt('claude-address-req-review'), addressLog);
  const claudeLog = newLogPath('05-claude-requirements-review');
  runClaude(loadPrompt('claude-spec-review'), claudeLog);
  const claudeVerdict = getReviewVerdict(claudeLog, ['Ready', 'Not Ready']);
  console.log(`Claude requirements review verdict: ${claudeVerdict || 'unparseable'}`);
  appendWorkflowReview('Requirements Review', 'Claude', claudeVerdict, claudeLog, ['Ready', 'Not Ready']);
  addFindingsFromReview('Req-Review', 'Claude', claudeLog, ['Ready', 'Not Ready']);
  const codexLog = newLogPath('06-codex-requirements-review');
  try {
    runCodex(loadPrompt('codex-check-requirements'), codexLog);
  } catch (error) {
    const note = `Codex requirements review failed before producing a parseable verdict.\n\n${error.message}`;
    appendWorkflowNote('Requirements Review', 'Codex', 'Not Ready', codexLog, note);
    updateRequirementsReadyFromVerdicts([claudeVerdict, 'Not Ready']);
    setWorkflowStatus('Req-Review', 'Req-Review', 'NOT_READY');
    setWorkflowLatestLogs('Req-Review', [addressLog, claudeLog, codexLog]);
    setWorkflowTokens('Req-Review', { claudeLogs: [addressLog, claudeLog], codexLogs: [codexLog] });
    showGitStatus();
    throw error;
  }
  const codexVerdict = getReviewVerdict(codexLog, ['Ready', 'Not Ready']);
  console.log(`Codex requirements review verdict: ${codexVerdict || 'unparseable'}`);
  appendWorkflowReview('Requirements Review', 'Codex', codexVerdict, codexLog, ['Ready', 'Not Ready']);
  addFindingsFromReview('Req-Review', 'Codex', codexLog, ['Ready', 'Not Ready']);
  updateRequirementsReadyFromVerdicts([claudeVerdict, codexVerdict]);
  const status = claudeVerdict === 'Ready' && codexVerdict === 'Ready' ? 'READY' : 'NOT_READY';
  console.log(`Overall Req-Review gate: ${status}`);
  setWorkflowStatus('Req-Review', 'Req-Review', status);
  setWorkflowLatestLogs('Req-Review', [addressLog, claudeLog, codexLog]);
  setWorkflowTokens('Req-Review', { claudeLogs: [addressLog, claudeLog], codexLogs: [codexLog] });
  showGitStatus();
}

function runSpec() {
  if (!featureBrief) throw new Error('Feature brief path is required for spec action.');
  initializeFeatureContext({ allowMissingSpec: true });
  const specifyLog = path.join(bootstrapLogDir, `${featureName}-01-claude-specify-${timestamp()}.log`);
  runClaude(loadPrompt('claude-specify'), specifyLog);
  initializeFeatureContext();
  ensureWorkflow();
  const planLog = newLogPath('02-claude-plan');
  runClaude(loadPrompt('claude-plan'), planLog);
  initializeFeatureContext();
  ensureWorkflow();
  const tasksLog = newLogPath('03-claude-tasks');
  runClaude(loadPrompt('claude-tasks'), tasksLog);
  initializeFeatureContext();
  ensureWorkflow();
  syncWorkflowPhases();
  setWorkflowStatus('Spec', 'Spec', 'READY');
  setWorkflowLatestLogs('Spec', [specifyLog, planLog, tasksLog]);
  setWorkflowTokens('Spec', { claudeLogs: [specifyLog, planLog, tasksLog] });
  setRequirementsReady(false);
  setCurrentPhase(getPhaseHeadings()[0].number);
  showPhases();
  showGitStatus();
  console.log('\nSpeckit package complete. Next: run req-review.');
}

function createPr() {
  ensureWorkflow();
  const branch = currentBranch();
  if (!branch || branch === options.baseBranch) throw new Error(`Refusing to create PR from ${branch || '<unknown>'} to ${options.baseBranch}.`);
  requireApproval(`Create a PR from ${branch} into ${options.baseBranch}?`);
  const body = `## Summary

AI-assisted Speckit workflow for \`${featureId}\`.

## Source artifacts

- \`specs/${featureId}/spec.md\`
- \`specs/${featureId}/plan.md\`
- \`specs/${featureId}/tasks.md\`
- \`specs/${featureId}/ai-workflow.md\`

## Review notes

Local AI workflow logs are stored under:

- \`specs/${featureId}/logs/\`

## Manual testing

- [ ] Manual testing completed
- [ ] Claude PR review completed
- [ ] Codex PR review completed
`;
  run('git', ['push', '-u', 'origin', branch]);
  const args = ['pr', 'create', '--base', options.baseBranch, '--head', branch, '--title', `feat: ${featureId}`, '--body', body];
  if (options.draft) args.push('--draft');
  run('gh', args);
  setWorkflowStatus('Create PR', 'Create PR', 'READY');
}

function runPrReview(reviewer) {
  ensureWorkflow();
  requireApproval(`Is the PR open and ready for ${reviewer} final review comments?`);
  const isClaude = reviewer === 'Claude';
  const log = newLogPath(isClaude ? '08-claude-pr-review' : '09-codex-pr-review');
  const prompt = loadPrompt('pr-review', { phase: getCurrentPhase() });
  if (isClaude) runClaude(prompt, log);
  else runCodex(prompt, log);
  const verdict = getReviewVerdict(log, ['Pass', 'Needs Changes']);
  const actionName = `${reviewer} PR Review`;
  setWorkflowStatus(actionName, actionName, verdict === 'Pass' ? 'READY' : 'NOT_READY');
  setWorkflowLatestLogs(actionName, [log]);
  setWorkflowTokens(actionName, isClaude ? { claudeLogs: [log] } : { codexLogs: [log] });
  appendWorkflowReview('PR Review', reviewer, verdict, log, ['Pass', 'Needs Changes']);
}

try {
  if (action === 'spec') {
    runSpec();
  } else {
    initializeFeatureContext();
    if (action === 'req-review') runReqReview();
    else if (action === 'next-phase') { ensureWorkflow(); syncWorkflowPhases(); showPhases(); }
    else if (action === 'implement' || action === 'implement-next') showImplementationPacket(getCurrentPhase());
    else if (action === 'implement-auto' || action === 'implement-next-auto') runImplementAuto(getCurrentPhase());
    else if (action === 'mark-implemented') markImplemented(getCurrentPhase());
    else if (action === 'check-implementation' || action === 'check-next') runCheckImplementation(getCurrentPhase());
    else if (action === 'create-pr') createPr();
    else if (action === 'claude-pr-review') runPrReview('Claude');
    else if (action === 'codex-pr-review') runPrReview('Codex');
    else if (action === 'run-all') {
      assertRequirementsReady();
      options.skipApproval = true;
      for (const phase of getPhaseHeadings()) {
        if (fs.existsSync(phaseGatePath(phase.number)) && fs.readFileSync(phaseGatePath(phase.number), 'utf8').trim() === 'PASS') continue;
        setCurrentPhase(phase.number);
        runImplementAuto(phase.number);
        runCheckImplementation(phase.number);
      }
    }
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
