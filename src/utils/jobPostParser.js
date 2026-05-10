// Smart parser utility — extracts job application fields from raw job posting text.
// Pure module: no DOM access, no network calls, no imports from src/components/ or src/services/.

import { validateUrl } from './validate.js';

// ─── Section helpers ──────────────────────────────────────────────────────────

function looksLikeSectionHeading(line) {
  if (!line) return false;
  if (/^[A-Za-z][^\n]{0,60}:\s*$/.test(line)) return true;
  if (/^[A-Z][A-Z\s&/()'"-]{3,}$/.test(line)) return true;
  if (/^[A-Z][A-Za-z\s/&-]{2,60}$/.test(line)
    && /\b(Responsibilities|Qualifications|Requirements|Skills|Abilities|Benefits|Values)$/i.test(line)) return true;
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
      if (hl === 'responsibilities' && /^.+\s+responsibilities:?$/i.test(trimmed)) {
        startIdx = i + 1;
        break;
      }
      if (hl === 'skills' && /^skills\s*[/&]\s*(tools|abilities)/i.test(trimmed)) {
        startIdx = i + 1;
        break;
      }
      if (lower === hl || lower === `${hl}:`) {
        startIdx = i + 1;
        break;
      }
      if (lower.startsWith(`${hl}:`)) {
        firstLine = trimmed.slice(h.length + 1).trim();
        startIdx = i + 1;
        break;
      }
      // Partial prefix match — catches "What will you do as X?" style headings
      if (hl === 'what will you do' && (lower.startsWith(`${hl} `) || lower.startsWith(`${hl}?`))) {
        startIdx = i + 1;
        break;
      }
    }

    if (startIdx !== -1) break;
  }

  if (startIdx === -1) return '';

  // Collect until the next recognized section heading (no blank-line stop — let paragraph
  // selection below pick the densest content block when multiple paragraphs are present)
  const rawLines = firstLine ? [firstLine] : [];
  for (let i = startIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (looksLikeSectionHeading(trimmed)) break;
    rawLines.push(lines[i]);
  }

  const rawBody = rawLines.join('\n').trim();
  if (!rawBody) return '';

  // When multiple paragraphs exist, prefer the one with the most non-empty lines
  // (skips over intro prose to find the actual list of items)
  const paragraphs = rawBody.split(/\n[ \t]*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return rawBody;

  return paragraphs.reduce((best, para) => {
    const lineCount = para.split('\n').filter((l) => l.trim()).length;
    const bestCount = best.split('\n').filter((l) => l.trim()).length;
    return lineCount > bestCount ? para : best;
  }, '');
}

function splitSkillTokens(value) {
  return value
    .replace(/\betc\.?\b/gi, '')
    .split(/,|\band\b|\bor\b/i)
    .map((item) => item.trim())
    .map((item) => item
      .replace(/^(and|or)\s+/i, '')
      .replace(/\s+skills?$/i, '')
      .replace(/[.!?]+$/, '')
      .trim())
    .filter((item) => item && !/^(related field|other .+ tools?)$/i.test(item))
    .map((item) => (/^[a-z]/.test(item) ? `${item.charAt(0).toUpperCase()}${item.slice(1)}` : item));
}

function parseSkillLine(line) {
  const trimmed = line.trim().replace(/[.!?]+$/, '');
  if (!trimmed) return [];

  if (/^(Bachelor'?s|Bachelor’s|Master'?s|Master’s|College)\s+degree\b/i.test(trimmed)) return [];
  if (/^Proven experience\b/i.test(trimmed)) return [];

  const suchAsMatch = trimmed.match(/^Proficiency in .+ such as (.+)$/i);
  if (suchAsMatch) return splitSkillTokens(suchAsMatch[1]);

  const familiarityMatch = trimmed.match(/^Familiarity with (.+)$/i);
  if (familiarityMatch) return splitSkillTokens(familiarityMatch[1]);

  if (/certification/i.test(trimmed)) return [trimmed];

  if (/^Strong .+\bskills?$/i.test(trimmed)) {
    return splitSkillTokens(trimmed.replace(/\s+skills?$/i, ''));
  }

  if (/\bpreferred$/i.test(trimmed)) {
    return splitSkillTokens(trimmed.replace(/\bpreferred$/i, ''));
  }

  if (/[.!?]$/.test(line.trim())) {
    return [trimmed];
  }

  return splitSkillTokens(trimmed);
}

function parseListItems(body) {
  const items = [];
  for (const line of body.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^[-*•]\s+(.+)/.test(trimmed)) {
      items.push(...parseSkillLine(trimmed.replace(/^[-*•]\s+/, '').trim()));
    } else if (/^\d+[.)]\s+(.+)/.test(trimmed)) {
      items.push(...parseSkillLine(trimmed.replace(/^\d+[.)]\s+/, '').trim()));
    } else if (/[.!?]$/.test(trimmed)) {
      // Prose sentence — preserve whole item and strip trailing punctuation instead of
      // comma-splitting, which would produce fragments like "or related field"
      items.push(...parseSkillLine(trimmed));
    } else {
      items.push(...parseSkillLine(trimmed));
    }
  }
  return [...new Set(items)];
}

// ─── T005 — Text-field extractors ────────────────────────────────────────────

function extractCompanyName(text) {
  const labelMatch = text.match(/^\s*(?:Company|Employer|Organization)\s*:\s*(.+)$/im);
  if (labelMatch) return labelMatch[1].trim();

  const aboutMatch = text.match(/^About\s+([A-Z].+)$/im);
  if (aboutMatch) {
    const name = aboutMatch[1].trim();
    if (!/^(us|the|our|this|role|position|job)\b/i.test(name)) return name;
  }

  const atMatch = text.match(/(?:At|Join)\s+([A-Z][^,\n.]{1,50}?)(?:,|\.|\n)/);
  if (atMatch) return atMatch[1].trim();

  const candidates = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const plainSecondLine = candidates[1] ?? '';
  if (
    plainSecondLine
    && plainSecondLine.length <= 60
    && !plainSecondLine.includes(':')
    && !/[.!?]$/.test(plainSecondLine)
    && /^[A-Z0-9]/.test(plainSecondLine)
  ) {
    return plainSecondLine;
  }

  return '';
}

function extractJobTitle(text) {
  const labelMatch = text.match(/^\s*(?:Position|Role|Job\s+Title)\s*:\s*(.+)$/im);
  if (labelMatch) return labelMatch[1].trim();

  const skipPrefixes = /^(?:Company|Employer|Organization|Location|Based\s+in|Office|City|Salary|Contact|Recruiter|Reach\s+out|Hiring\s+Manager|Responsibilities|Requirements|Skills|Qualifications|Tech\s+Stack|About|Preferred)\s*:/i;
  const sectionNounSuffix = /^(.+?)\s+(?:Responsibilities|Requirements|Qualifications|Duties|Overview|Description)s?$/i;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.length < 4 || trimmed.length > 80) continue;
    if (trimmed === trimmed.toUpperCase()) continue;
    if (/^[-*•\d]/.test(trimmed)) continue;
    if (skipPrefixes.test(trimmed)) continue;
    if (/^About the job$/i.test(trimmed)) continue;
    if (/[.!?]$/.test(trimmed)) continue;

    // Strip trailing section nouns: "Associate PM Responsibilities" → "Associate PM"
    const suffixMatch = trimmed.match(sectionNounSuffix);
    if (suffixMatch) {
      const candidate = suffixMatch[1].trim();
      if (candidate.length >= 4 && candidate.length <= 80) return candidate;
      continue;
    }

    return trimmed;
  }

  return '';
}

const RESPONSIBILITIES_HEADINGS = [
  'Responsibilities',
  "What You'll Do",
  'What you will do',
  'What will you do',
  'Role Overview',
  'Job Description',
  'Job Description and Responsibilities',
  'Job Description and Resonsibilities', // common LinkedIn typo
  'Key Responsibilities',
  'Core Responsibilities',
  'Primary Responsibilities',
  'Your Role',
  'Duties',
];

const RESPONSIBILITIES_FALLBACK_HEADINGS = [
  'About the Role',
];

function extractResponsibilities(text) {
  const body = extractSectionBody(text, RESPONSIBILITIES_HEADINGS);
  if (body) return body;

  const fallbackBody = extractSectionBody(text, RESPONSIBILITIES_FALLBACK_HEADINGS);
  if (fallbackBody) return fallbackBody;

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
