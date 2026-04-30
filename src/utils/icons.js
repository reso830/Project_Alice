export function createSvgIcon(pathData) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);

  return svg;
}

export function createClipboardIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  rect.setAttribute('x', '8');
  rect.setAttribute('y', '8');
  rect.setAttribute('width', '12');
  rect.setAttribute('height', '12');
  rect.setAttribute('rx', '2');
  path.setAttribute('d', 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2');

  for (const element of [rect, path]) {
    element.setAttribute('fill', 'none');
    element.setAttribute('stroke', 'currentColor');
    element.setAttribute('stroke-width', '2');
    element.setAttribute('stroke-linecap', 'round');
    element.setAttribute('stroke-linejoin', 'round');
  }

  svg.append(rect, path);
  return svg;
}
