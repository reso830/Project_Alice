export function formatPeso(value) {
  if (!Number.isInteger(value) || value <= 0) {
    return '';
  }

  return `\u20b1${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
}

function parseSalaryPart(value) {
  const cleaned = value
    .trim()
    .replace(/^PHP\s*/i, '')
    .replace(/^\u20b1\s*/, '');
  const match = cleaned.match(/^([\d,.]+)\s*([kK])?$/);

  if (!match) {
    return null;
  }

  const amount = Number(match[1].replace(/,/g, ''));

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.round(match[2] ? amount * 1000 : amount);
}

export function parseSalaryInput(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const [lowerBound] = value.split(/\s*-\s*/);
  return parseSalaryPart(lowerBound);
}
