const SECTION_PATTERNS = {
  summary: /^(summary|about|profile|objective)$/i,
  experience: /^(experience|employment|work history)$/i,
  education: /^(education|academic)$/i,
  skills: /^(skills|competencies|technologies)$/i,
  certifications: /^(certif.*|license.*)$/i,
  awards: /^(award.*|honor.*|achievement.*)$/i,
  languages: /^languages?$/i,
};

const MONTHS = new Map([
  ['jan', '01'],
  ['january', '01'],
  ['feb', '02'],
  ['february', '02'],
  ['mar', '03'],
  ['march', '03'],
  ['apr', '04'],
  ['april', '04'],
  ['may', '05'],
  ['jun', '06'],
  ['june', '06'],
  ['jul', '07'],
  ['july', '07'],
  ['aug', '08'],
  ['august', '08'],
  ['sep', '09'],
  ['sept', '09'],
  ['september', '09'],
  ['oct', '10'],
  ['october', '10'],
  ['nov', '11'],
  ['november', '11'],
  ['dec', '12'],
  ['december', '12'],
]);

function createEmptyResult() {
  return {
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    city: null,
    summary: null,
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    awards: [],
    languages: [],
    links: [],
  };
}

function normalizeLines(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function getSectionName(line) {
  return Object.entries(SECTION_PATTERNS).find(([, pattern]) => pattern.test(line))?.[0] ?? null;
}

function splitSections(lines) {
  const sections = {};
  let currentSection = 'contact';

  sections[currentSection] = [];

  for (const line of lines) {
    const sectionName = getSectionName(line);

    if (sectionName) {
      currentSection = sectionName;
      sections[currentSection] = [];
      continue;
    }

    sections[currentSection].push(line);
  }

  return sections;
}

function findEmail(lines) {
  return lines.join(' ').match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i)?.[0] ?? null;
}

function findPhone(lines) {
  return lines.find((line) => {
    if (/@|https?:\/\//i.test(line)) {
      return false;
    }

    const digits = line.replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 15 && /^[+\d\s().-]+$/.test(line);
  }) ?? null;
}

function findCity(lines) {
  return lines.find((line) => {
    if (/@|https?:\/\/|linkedin\.com/i.test(line)) {
      return false;
    }

    return /^[A-Za-z][A-Za-z .'-]+,\s*[A-Za-z][A-Za-z .'-]+$/.test(line);
  }) ?? null;
}

function normalizeUrl(url) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

function parseLinks(lines) {
  const text = lines.join(' ');
  const matches = text.match(/(?:https?:\/\/)?(?:www\.)?[^\s|,;]+?\.[^\s|,;]+/gi) ?? [];

  return matches
    .filter((url) => /linkedin\.com|https?:\/\/|^www\./i.test(url))
    .map((url) => normalizeUrl(url))
    .map((url) => ({
      url,
      friendlyName: /linkedin\.com/i.test(url) ? 'LinkedIn' : 'Portfolio',
    }));
}

function parseName(lines) {
  const nameLine = lines.find((line) => {
    if (line === findPhone([line]) || line === findCity([line])) {
      return false;
    }

    return /[A-Za-z]/.test(line) && !/@|https?:\/\/|linkedin\.com/i.test(line);
  });

  if (!nameLine) {
    return { firstName: null, lastName: null };
  }

  const [firstName, ...lastParts] = nameLine.split(' ');
  return {
    firstName: firstName || null,
    lastName: lastParts.length > 0 ? lastParts.join(' ') : null,
  };
}

function parseContact(lines) {
  return {
    ...parseName(lines),
    email: findEmail(lines),
    phone: findPhone(lines),
    city: findCity(lines),
    links: parseLinks(lines),
  };
}

function normalizeDate(value) {
  const cleaned = String(value ?? '').trim().replace(/[–—]/g, '-');

  if (!cleaned) {
    return '';
  }

  if (/^(present|current|now|-)+$/i.test(cleaned)) {
    return 'PRESENT';
  }

  const numericMonthYear = cleaned.match(/^(\d{1,2})\/(\d{4})$/);
  if (numericMonthYear) {
    return `${numericMonthYear[1].padStart(2, '0')}/${numericMonthYear[2]}`;
  }

  const yearMonth = cleaned.match(/^(\d{4})-(\d{1,2})$/);
  if (yearMonth) {
    return `${yearMonth[2].padStart(2, '0')}/${yearMonth[1]}`;
  }

  const monthNameYear = cleaned.match(/^([A-Za-z]+)\.?\s+(\d{4})$/);
  if (monthNameYear) {
    const month = MONTHS.get(monthNameYear[1].toLowerCase());
    return month ? `${month}/${monthNameYear[2]}` : '';
  }

  const yearOnly = cleaned.match(/^\d{4}$/);
  if (yearOnly) {
    return `01/${cleaned}`;
  }

  return '';
}

function parseDateRange(line) {
  const normalizedLine = String(line ?? '').replace(/[\u2013\u2014]/g, '-');
  const parts = normalizedLine.split(/\s+(?:-|to)\s+/i);

  if (parts.length < 2) {
    return null;
  }

  const start = normalizeDate(parts[0]);
  const end = normalizeDate(parts.slice(1).join(' - '));
  const currentWork = end === 'PRESENT';

  return {
    dateStarted: start === 'PRESENT' ? '' : start,
    dateEnded: currentWork ? '' : end,
    currentWork,
  };
}

function parseExperience(lines) {
  const dateLines = lines
    .map((line, index) => ({ line, index, range: parseDateRange(line) }))
    .filter((entry) => entry.range);

  return dateLines.map((entry, dateLineIndex) => {
    const nextDateIndex = dateLines[dateLineIndex + 1]?.index ?? lines.length;
    const responsibilityEnd = dateLines[dateLineIndex + 1]
      ? Math.max(entry.index, nextDateIndex - 3)
      : lines.length - 1;
    const responsibilities = lines.slice(entry.index + 1, responsibilityEnd + 1).join('\n');

    return {
      company: lines[entry.index - 2] ?? '',
      role: lines[entry.index - 1] ?? '',
      responsibilities,
      ...entry.range,
    };
  });
}

function parseEducation(lines) {
  if (lines.length === 0) {
    return [];
  }

  const yearIndex = lines.findIndex((line) => /\b\d{4}\b/.test(line));
  const yearCompleted = yearIndex === -1 ? '' : (lines[yearIndex].match(/\b\d{4}\b/g)?.at(-1) ?? '');
  const detailLines = yearIndex === -1 ? lines : lines.filter((_, index) => index !== yearIndex);

  if (detailLines.length === 0 && !yearCompleted) {
    return [];
  }

  return [{
    university: detailLines[0] ?? '',
    degreeMajor: detailLines[1] ?? '',
    yearCompleted,
  }];
}

function parseSkills(lines) {
  return lines
    .join('\n')
    .split(/[,|•\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function parseCertifications(lines) {
  if (lines.length === 0) {
    return [];
  }

  const dateIndex = lines.findIndex((line) => parseDateRange(line));
  const range = dateIndex === -1 ? null : parseDateRange(lines[dateIndex]);
  const detailLines = dateIndex === -1 ? lines : lines.filter((_, index) => index !== dateIndex);
  const name = detailLines[0] ?? '';

  if (!name) {
    return [];
  }

  return [{
    name,
    issuingBody: detailLines[1] ?? '',
    issuanceDate: range?.dateStarted ?? '',
    expiryDate: range?.dateEnded ?? '',
  }];
}

function parseAwards(lines) {
  if (lines.length === 0) {
    return [];
  }

  const dateIndex = lines.findIndex((line) => {
    const normalizedDate = normalizeDate(line);
    return normalizedDate && normalizedDate !== 'PRESENT';
  });
  const date = dateIndex === -1 ? '' : normalizeDate(lines[dateIndex]);
  const detailLines = dateIndex === -1 ? lines : lines.filter((_, index) => index !== dateIndex);
  const awardName = detailLines[0] ?? '';

  if (!awardName) {
    return [];
  }

  return [{
    awardName,
    issuingBody: detailLines[1] ?? '',
    date,
    details: detailLines.slice(2).join('\n'),
  }];
}

function parseLanguages(lines) {
  return lines.map((line) => {
    const proficiency = line.match(/\b(beginner|intermediate|professional|fluent|native|advanced)\b/i)?.[1];
    const language = line
      .replace(/\b(beginner|intermediate|professional|fluent|native|advanced)\b/ig, '')
      .replace(/[-:,()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      language,
      proficiency: mapProficiency(proficiency),
    };
  }).filter((entry) => entry.language);
}

function mapProficiency(value) {
  if (!value) {
    return 'Intermediate';
  }

  const normalized = value.toLowerCase();
  if (normalized === 'beginner') return 'Beginner';
  if (normalized === 'professional') return 'Professional';
  if (normalized === 'fluent' || normalized === 'native') return 'Fluent';
  return 'Intermediate';
}

export function parseResumeText(text) {
  const lines = normalizeLines(text);

  if (lines.length === 0) {
    return createEmptyResult();
  }

  const sections = splitSections(lines);
  const contact = parseContact(sections.contact ?? []);

  return {
    ...createEmptyResult(),
    ...contact,
    summary: sections.summary?.join('\n') || null,
    experience: parseExperience(sections.experience ?? []),
    education: parseEducation(sections.education ?? []),
    skills: parseSkills(sections.skills ?? []),
    certifications: parseCertifications(sections.certifications ?? []),
    awards: parseAwards(sections.awards ?? []),
    languages: parseLanguages(sections.languages ?? []),
  };
}
