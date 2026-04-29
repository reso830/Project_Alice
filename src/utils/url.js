export function getSafeExternalHref(url) {
  if (!url) {
    return '#';
  }

  try {
    const parsed = new URL(url);

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    return '#';
  }

  return '#';
}
