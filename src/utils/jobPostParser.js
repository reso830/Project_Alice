// Smart parser utility — extracts job application fields from raw job posting text.
// Pure module: no DOM access, no network calls, no imports from src/components/ or src/services/.

import { validateUrl } from './validate.js';

// ─── Section helpers ──────────────────────────────────────────────────────────

function looksLikeSectionHeading(line) {
  if (!line) return false;
  if (/^[A-Za-z][^\n]{0,60}:\s*$/.test(line)) return true;
  if (/^[A-Z][A-Z\s&/()'"-]{3,}$/.test(line)) return true;
  return false;
}

function extractSectionBody(text, headings) {
  const lines = text.split('\n');
  let startIdx = -1;
  let firstLine = '';

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const lower = trimmed.toLowerCase();

    for (const h of headings) {
      const hl = h.toLowerCase();
      if (lower === hl || lower === `${hl}:`) {
        startIdx = i + 1;
        break;
      }
      if (lower.startsWith(`${hl}:`)) {
        firstLine = trimmed.slice(h.length + 1).trim();
        startIdx = i + 1;
        break;
      }
    }

    if (startIdx !== -1) break;
  }

  if (startIdx === -1) return '';

  const body = firstLine ? [firstLine] : [];
  for (let i = startIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (looksLikeSectionHeading(trimmed)) break;
    // Stop at the first blank line once content has been captured
    if (trimmed === '' && body.some((l) => l.trim())) break;
    body.push(lines[i]);
  }

  return body.join('\n').trim();
}

function parseListItems(body) {
  const items = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[-*•]\s+(.+)/.test(trimmed)) {
      items.push(trimmed.replace(/^[-*•]\s+/, '').trim());
    } else if (/^\d+[.)]\s+(.+)/.test(trimmed)) {
      items.push(trimmed.replace(/^\d+[.)]\s+/, '').trim());
    } else {
      items.push(...trimmed.split(',').map((s) => s.trim()).filter(Boolean));
    }
  }
  return [...new Set(items)];
}

// ─── T005 — Text-field extractors ────────────────────────────────────────────

function extractCompanyName(text) {
  const labelMatch = text.match(/(?:Company|Employer|Organization)\s*:\s*(.+)/i);
  if (labelMatch) return labelMatch[1].trim();

  const aboutMatch = text.match(/^About\s+([A-Z].+)$/im);
  if (aboutMatch) {
    const name = aboutMatch[1].trim();
    if (!/^(us|the|our|this|role|position|job)\b/i.test(name)) return name;
  }

  const atMatch = text.match(/(?:At|Join)\s+([A-Z][^,\n.]{1,50}?)(?:,|\.|\n)/);
  if (atMatch) return atMatch[1].trim();

  return '';
}

function extractJobTitle(text) {
  const labelMatch = text.match(/(?:Position|Role|Job\s+Title)\s*:\s*(.+)/i);
  if (labelMatch) return labelMatch[1].trim();

  const skipPrefixes = /^(?:Company|Employer|Organization|Location|Based\s+in|Office|City|Salary|Contact|Recruiter|Reach\s+out|Hiring\s+Manager|Responsibilities|Requirements|Skills|Qualifications|Tech\s+Stack|About|Preferred)\s*:/i;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.length < 4 || trimmed.length > 80) continue;
    if (trimmed === trimmed.toUpperCase()) continue;
    if (/^[-*•\d]/.test(trimmed)) continue;
    if (skipPrefixes.test(trimmed)) continue;
    return trimmed;
  }

  return '';
}

const RESPONSIBILITIES_HEADINGS = [
  'Responsibilities',
  "What You'll Do",
  'What you will do',
  'Role Overview',
  'Job Description',
  'Your Role',
  'Duties',
  'About the Role',
];

function extractResponsibilities(text) {
  const body = extractSectionBody(text, RESPONSIBILITIES_HEADINGS);
  if (body) return body;

  const paragraphs = text.split(/\n\s*\n/);
  let longest = '';
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length > 100 && trimmed.length > longest.length) {
      longest = trimmed;
    }
  }
  return longest;
}

function extractLocation(text) {
  const match = text.match(/(?:Location|Based\s+in|Office|City)\s*:\s*(.+)/i);
  return match ? match[1].trim() : '';
}

function extractRecruiter(text) {
  const match = text.match(/(?:Contact|Recruiter|Reach\s+out\s+to|Hiring\s+Manager)\s*:\s*(.+)/i);
  return match ? match[1].trim() : '';
}

// ─── T006 — Enum extractors ───────────────────────────────────────────────────

function extractWorkSetup(text) {
  const patterns = [
    { re: /\bon-site\b|\bonsite\b|\bin-office\b/i, value: 'On-site' },
    { re: /\bhybrid\b/i, value: 'Hybrid' },
    { re: /\bremote\b/i, value: 'Remote' },
    { re: /\bfield\b/i, value: 'Field' },
  ];

  let firstValue = '';
  let firstIndex = Infinity;

  for (const { re, value } of patterns) {
    const match = text.match(re);
    if (match && match.index < firstIndex) {
      firstIndex = match.index;
      firstValue = value;
    }
  }

  return firstValue;
}

function extractShift(text) {
  const patterns = [
    { re: /\bday\s+shift\b/i, value: 'Day' },
    { re: /\bmid[\s-]shift\b/i, value: 'Mid' },
    { re: /\bnight\s+shift\b/i, value: 'Night' },
    { re: /\bflexible\b/i, value: 'Flexible' },
  ];

  let firstValue = '';
  let firstIndex = Infinity;

  for (const { re, value } of patterns) {
    const match = text.match(re);
    if (match && match.index < firstIndex) {
      firstIndex = match.index;
      firstValue = value;
    }
  }

  return firstValue;
}

// ─── T007 — Salary extractor ──────────────────────────────────────────────────

function extractSalary(text) {
  const pattern = /(₱|PHP|USD|\$)\s*([\d,]+)(?:\s*[-–—to]+\s*(?:₱|PHP|USD|\$)?\s*([\d,]+))?(?:\s*(per\s+month|\/mo|monthly|per\s+year|\/yr|annually|annual|yearly))?/i;
  const match = text.match(pattern);
  if (!match) return null;

  const lower = parseInt(match[2].replace(/,/g, ''), 10);
  if (!Number.isInteger(lower) || lower <= 0) return null;

  const period = (match[4] ?? '').toLowerCase();

  if (/per\s+month|\/mo|monthly/.test(period)) return lower * 12;
  if (/per\s+year|\/yr|annually|annual|yearly/.test(period)) return lower;

  return lower > 20000 ? lower : lower * 12;
}

// ─── T008 — URL and skills extractors ────────────────────────────────────────

function extractUrl(text) {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) return '';
  const cleaned = match[0].replace(/[.,;:!?)"'\]]+$/, '');
  return validateUrl(cleaned) === null ? cleaned : '';
}

const SKILLS_HEADINGS = [
  'Required Skills',
  'Skills',
  'Qualifications',
  'Requirements',
  'Tech Stack',
  'Technologies',
  'Tools',
];

const PREFERRED_HEADINGS = [
  'Preferred Skills',
  'Nice to Have',
  'Bonus',
  'Preferred Qualifications',
];

function extractSkills(text) {
  const body = extractSectionBody(text, SKILLS_HEADINGS);
  return body ? parseListItems(body) : [];
}

function extractPreferredSkills(text) {
  const body = extractSectionBody(text, PREFERRED_HEADINGS);
  return body ? parseListItems(body) : [];
}

// ─── T009 — Public entry point ────────────────────────────────────────────────

/**
 * @param {string} text
 * @returns {Partial<ApplicationRecord>}
 */
export function parseJobPost(text) {
  if (!text || text.trim().length < 20) {
    return {
      companyName: '',
      jobTitle: '',
      responsibilities: '',
      location: '',
      workSetup: '',
      shift: '',
      salary: null,
      jobPostingUrl: '',
      skills: [],
      preferredSkills: [],
      recruiter: '',
      compat: Math.floor(Math.random() * 101),
    };
  }

  const preferred = extractPreferredSkills(text);
  const required = extractSkills(text);
  const allSkills = [...new Set([...required, ...preferred])];

  return {
    companyName: extractCompanyName(text),
    jobTitle: extractJobTitle(text),
    responsibilities: extractResponsibilities(text),
    location: extractLocation(text),
    workSetup: extractWorkSetup(text),
    shift: extractShift(text),
    salary: extractSalary(text),
    jobPostingUrl: extractUrl(text),
    skills: allSkills,
    preferredSkills: preferred,
    recruiter: extractRecruiter(text),
    compat: Math.floor(Math.random() * 101),
  };
}
