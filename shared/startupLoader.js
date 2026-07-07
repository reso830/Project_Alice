export const STARTUP_LOADER_START_MARKER = '<!-- STARTUP-LOADER:START -->';
export const STARTUP_LOADER_END_MARKER = '<!-- STARTUP-LOADER:END -->';

export function stripStartupLoaderMarkup(html) {
  const start = html.indexOf(STARTUP_LOADER_START_MARKER);
  const end = html.indexOf(STARTUP_LOADER_END_MARKER);
  if (start === -1 || end === -1 || end < start) {
    return html;
  }
  return `${html.slice(0, start)}${html.slice(end + STARTUP_LOADER_END_MARKER.length)}`;
}
