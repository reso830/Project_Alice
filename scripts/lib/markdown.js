export function escapeMarkdownCell(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r\n?|\n/g, '<br>')
    .trim();
}
