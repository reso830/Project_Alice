function parseYear(value) {
  const year = Number.parseInt(value, 10);

  return Number.isNaN(year) ? null : year;
}

function parseMonthYear(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^(\d{2})\/(\d{4})$/);

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const year = Number(match[2]);

  if (month < 1 || month > 12) {
    return null;
  }

  return year * 100 + month;
}

function compareNullableDesc(left, right) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right - left;
}

export function sortEducation(entries) {
  return [...entries].sort((left, right) => (
    compareNullableDesc(parseYear(left?.yearCompleted), parseYear(right?.yearCompleted))
  ));
}

export function sortExperience(entries) {
  return [...entries].sort((left, right) => {
    if (left?.currentWork === true && right?.currentWork !== true) {
      return -1;
    }

    if (right?.currentWork === true && left?.currentWork !== true) {
      return 1;
    }

    const endedComparison = compareNullableDesc(
      parseMonthYear(left?.dateEnded),
      parseMonthYear(right?.dateEnded),
    );

    if (endedComparison !== 0) {
      return endedComparison;
    }

    return compareNullableDesc(
      parseMonthYear(left?.dateStarted),
      parseMonthYear(right?.dateStarted),
    );
  });
}
