// Parses the simple legal-document markdown convention used by ./legal/*.md
// into the { title, version, disclaimer, sections } shape LegalModal.js
// consumes. Deliberately not a general markdown-to-HTML parser: every
// numbered subsection (e.g. "8.1") must be its own top-level `## ` heading,
// since LegalModal renders each section's content as plain textContent in
// a single <p> with no nested markup support.

export function parseLegalDocument(rawMarkdown) {
  const lines = rawMarkdown.split('\n');
  let title = '';
  let version = '';
  let disclaimer = '';
  const sections = [];
  let currentSection = null;
  let index = 0;

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    index += 1;
    if (!trimmed) continue;
    if (trimmed.startsWith('# ')) {
      title = trimmed.slice(2).trim();
      break;
    }
  }

  let inHeader = true;

  for (; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();

    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      inHeader = false;
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          content: currentSection.lines.join(' ').trim(),
        });
      }
      currentSection = { title: trimmed.slice(3).trim(), lines: [] };
      continue;
    }

    if (inHeader && trimmed.startsWith('Version:')) {
      version = trimmed.slice('Version:'.length).trim();
      continue;
    }

    if (inHeader && trimmed.startsWith('> ')) {
      disclaimer = trimmed.slice(2).trim();
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(trimmed);
    }
  }

  if (currentSection) {
    sections.push({
      title: currentSection.title,
      content: currentSection.lines.join(' ').trim(),
    });
  }

  if (!title || sections.length === 0) {
    throw new Error('Malformed legal document: missing title or no sections found');
  }

  return { title, version, disclaimer, sections };
}
