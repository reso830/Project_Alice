const SECTION_PATTERNS = {
  summary: /^(summary|about|profile|objective)$/i,
  experience: /^(professional experience|experience|work experience|employment|work history)$/i,
  education: /^(education|academic|educational attainment)$/i,
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
  for (const line of lines) {
    const scrubbed = line
      .replace(/[\w.+-]+@[\w-]+\.[a-z]{2,}/gi, ' ')
      .replace(/(?:https?:\/\/)?(?:www\.)?[^\s|,;]+?\.[^\s|,;]+/gi, ' ');
    const matches = scrubbed.match(/(?:\+?\d[\d\s().-]{5,}\d)/g) ?? [];
    const phone = matches.find((match) => {
      const digits = match.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15;
    });

    if (phone) {
      return phone.trim().replace(/\s+/g, ' ');
    }
  }

  return null;
}

function splitContactParts(lines) {
  return lines.flatMap((line) => {
    const delimiterParts = line.split(/\s*(?:[|•·])\s*/u);
    return (delimiterParts.length > 1 ? delimiterParts : [line])
      .map((part) => ({
        text: part.trim(),
        fromDelimitedLine: delimiterParts.length > 1,
      }));
  }).filter((part) => part.text);
}

function isPhoneText(value) {
  return findPhone([value]) === value.trim().replace(/\s+/g, ' ');
}

function findCity(lines, nameLine = '') {
  for (const part of splitContactParts(lines)) {
    const hadLocationLabel = /^location\s*[:|-]\s*/i.test(part.text);
    const candidate = part.text.replace(/^location\s*[:|-]\s*/i, '').trim();

    if (
      !candidate
      || candidate === nameLine
      || /@|https?:\/\/|www\.|linkedin\.com/i.test(candidate)
      || /\d/.test(candidate)
      || isPhoneText(candidate)
    ) {
      continue;
    }

    if (/^[A-Za-z][A-Za-z .'-]+,\s*[A-Za-z][A-Za-z .'-]+$/.test(candidate)) {
      return candidate;
    }

    if (hadLocationLabel || part.fromDelimitedLine) {
      if (/^[A-Za-z][A-Za-z .'-]*(?:\s+[A-Za-z][A-Za-z .'-]*){0,3}$/.test(candidate)) {
        return candidate;
      }
    }
  }

  return null;
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
    if (line === findPhone([line])) {
      return false;
    }

    return /[A-Za-z]/.test(line) && !/@|https?:\/\/|linkedin\.com/i.test(line);
  });

  if (!nameLine) {
    return { firstName: null, lastName: null };
  }

  const nameWithoutTitles = nameLine.split(',')[0].trim();
  const [firstName, ...lastParts] = nameWithoutTitles
    .split(' ')
    .filter((part) => !/^[A-Z]\.?$/i.test(part));

  return {
    firstName: firstName || null,
    lastName: lastParts.length > 0 ? lastParts.join(' ') : null,
  };
}

function parseContact(lines) {
  const name = parseName(lines);
  const nameLine = [name.firstName, name.lastName].filter(Boolean).join(' ');

  return {
    ...name,
    email: findEmail(lines),
    phone: findPhone(lines),
    city: findCity(lines, nameLine),
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

  const yearMonthName = cleaned.match(/^(\d{4})\s+([A-Za-z]+)\.?$/);
  if (yearMonthName) {
    const month = MONTHS.get(yearMonthName[2].toLowerCase());
    return month ? `${month}/${yearMonthName[1]}` : '';
  }

  const yearOnly = cleaned.match(/^\d{4}$/);
  if (yearOnly) {
    return `01/${cleaned}`;
  }

  return '';
}

const DATE_TOKEN_PATTERN = String.raw`(?:\d{1,2}/\d{4}|\d{4}-\d{1,2}|[A-Za-z]+\.?\s+\d{4}|\d{4}\s+[A-Za-z]+\.?|\d{4}|present|current|now)`;
const DATE_RANGE_PATTERN = new RegExp(`(${DATE_TOKEN_PATTERN})\\s*(?:-|to)\\s*(${DATE_TOKEN_PATTERN})`, 'i');
const TRAILING_DATE_PATTERN = new RegExp(`\\b(${DATE_TOKEN_PATTERN})$`, 'i');

function findDateRange(line) {
  const normalizedLine = String(line ?? '').replace(/[\u2013\u2014]/g, '-');
  const match = normalizedLine.match(DATE_RANGE_PATTERN);

  if (!match) {
    return null;
  }

  const start = normalizeDate(match[1]);
  const end = normalizeDate(match[2]);

  if (!start || !end) {
    return null;
  }

  return {
    matchText: match[0],
    range: {
      dateStarted: start === 'PRESENT' ? '' : start,
      dateEnded: end === 'PRESENT' ? '' : end,
      currentWork: end === 'PRESENT',
    },
  };
}

function parseDateRange(line) {
  return findDateRange(line)?.range ?? null;
}

function findTrailingDate(line) {
  const match = String(line ?? '').trim().match(TRAILING_DATE_PATTERN);

  if (!match) {
    return null;
  }

  const normalizedDate = normalizeDate(match[1]);
  return normalizedDate && normalizedDate !== 'PRESENT'
    ? { matchText: match[1], date: normalizedDate }
    : null;
}

function removeDateRange(line, dateRangeText) {
  return String(line ?? '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(dateRangeText, '')
    .replace(/[,\s–—|-]+$/g, '')
    .trim();
}

function isBulletLine(line) {
  return /^[•*,-]\s*/u.test(line);
}

function isIgnoredExperienceLine(line) {
  return /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line);
}

function shouldJoinWrappedLine(previousLine, line) {
  if (!previousLine || !line || isBulletLine(line)) {
    return false;
  }

  return !/[.!?:;)]$/.test(previousLine) && /^[a-z(]/.test(line);
}

function joinWrappedLines(lines) {
  return lines.reduce((paragraphs, line) => {
    const previous = paragraphs.at(-1);

    if (shouldJoinWrappedLine(previous, line)) {
      paragraphs[paragraphs.length - 1] = `${previous} ${line}`;
    } else {
      paragraphs.push(line);
    }

    return paragraphs;
  }, []).join('\n');
}

function joinParagraphLines(lines) {
  return lines.join(' ');
}

function parseExperience(lines) {
  const cleanLines = lines.filter((line) => !isIgnoredExperienceLine(line));
  const entries = [];
  let currentCompany = '';

  for (let index = 0; index < cleanLines.length; index += 1) {
    const dateRange = findDateRange(cleanLines[index]);

    if (!dateRange) {
      continue;
    }

    const prefix = removeDateRange(cleanLines[index], dateRange.matchText);
    const nextLine = cleanLines[index + 1] ?? '';
    const nextLineRange = findDateRange(nextLine);
    let company = '';
    let role = '';
    let responsibilitiesStart = index + 1;

    if (prefix && nextLineRange) {
      currentCompany = prefix;
      continue;
    }

    if (prefix && nextLine && !nextLineRange && !isBulletLine(nextLine)) {
      currentCompany = prefix;
      company = prefix;
      role = nextLine;
      responsibilitiesStart = index + 2;
    } else if (prefix && currentCompany) {
      company = currentCompany;
      role = prefix;
    } else if (prefix) {
      currentCompany = prefix;
      continue;
    } else {
      company = cleanLines[index - 2] ?? currentCompany;
      role = cleanLines[index - 1] ?? '';
    }

    const responsibilities = [];
    for (let lineIndex = responsibilitiesStart; lineIndex < cleanLines.length; lineIndex += 1) {
      if (findDateRange(cleanLines[lineIndex])) {
        break;
      }

      responsibilities.push(cleanLines[lineIndex]);
    }

    entries.push({
      company,
      role,
      responsibilities: joinWrappedLines(responsibilities),
      ...dateRange.range,
    });
  }

  return entries.filter((entry) => entry.company || entry.role);
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

  const degreeFirst = /\b(bachelor|master|doctor|degree|science|engineering|arts|business)\b/i.test(detailLines[0] ?? '');

  return [{
    university: degreeFirst ? (detailLines[1] ?? '') : (detailLines[0] ?? ''),
    degreeMajor: degreeFirst ? (detailLines[0] ?? '') : (detailLines[1] ?? ''),
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

  const bulletEntries = lines
    .filter(isBulletLine)
    .map((line) => line.replace(/^[•*,-]\s*/u, '').trim())
    .filter(Boolean);

  if (bulletEntries.length > 1 && bulletEntries.length === lines.length) {
    return bulletEntries.map((line) => parseCertificationLine(line));
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

function parseCertificationLine(line) {
  const dateRange = findDateRange(line);
  const singleDate = dateRange ? null : findTrailingDate(line);
  const withoutDates = dateRange
    ? removeDateRange(line, dateRange.matchText)
    : removeDateRange(line, singleDate?.matchText ?? '');
  const [namePart, ...issuerParts] = withoutDates
    .replace(/[,\s]+$/g, '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    name: namePart ?? '',
    issuingBody: issuerParts.join(', '),
    issuanceDate: dateRange?.range.dateStarted ?? singleDate?.date ?? '',
    expiryDate: dateRange?.range.dateEnded ?? '',
  };
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
    details: joinWrappedLines(detailLines.slice(2)),
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
    summary: sections.summary ? joinParagraphLines(sections.summary) || null : null,
    experience: parseExperience(sections.experience ?? []),
    education: parseEducation(sections.education ?? []),
    skills: parseSkills(sections.skills ?? []),
    certifications: parseCertifications(sections.certifications ?? []),
    awards: parseAwards(sections.awards ?? []),
    languages: parseLanguages(sections.languages ?? []),
  };
}
