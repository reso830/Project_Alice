// Project_Alice — standardized icon registry
// Drop-in replacement for src/utils/icons.js
//
// System: 24x24 viewBox · stroke currentColor 2px · round caps/joins · fill none.
// Color comes from the button's `color` (currentColor) — do not hardcode fills.
// Size with CSS on `.icon` (app uses 21px optical; filters render 15px).

const SVGNS = 'http://www.w3.org/2000/svg';

// Multi-path aware factory. Pass one `d` string or an array of them.
export function createSvgIcon(paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of list) {
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
  }
  return svg;
}

// Canonical path data, keyed by semantic name.
export const ICON_PATHS = {
  // — Action buttons —
  edit:         ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z'],
  changeStatus: ['M7 8h11m0 0-3-3m3 3-3 3', 'M17 16H6m0 0 3 3m-3-3 3-3'],
  copyUrl:      ['M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5', 'M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5'],
  star:         ['M12 3.5 14.8 9l6.1.9-4.4 4.3 1 6-5.5-2.9-5.5 2.9 1-6L3.1 9l6.1-.9L12 3.5Z'],
  archive:      ['M5 8h14v11H5z', 'M4.5 8l1.3-3.2h12.4L19.5 8', 'M12 11.5v4m-2-2 2 2 2-2'],
  unarchive:    ['M5 8h14v11H5z', 'M4.5 8l1.3-3.2h12.4L19.5 8', 'M12 15.5v-4m-2 2 2-2 2 2'],
  close:        ['M6 6 18 18M18 6 6 18'],
  chevronDown:  ['m6 9 6 6 6-6'],

  // — Quick filters — (star reused from above)
  status:       ['M6 21V4m0 0h11l-2 4 2 4H6'],
  salary:       ['M3 6h18v12H3z', 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5', 'M6.5 9.5h.01', 'M17.5 14.5h.01'],
  compatibility:['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z', 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z'],
  company:      ['M3 21h18M5 21V5a2 2 0 0 1 2-2h7v18M14 8h5a2 2 0 0 1 2 2v11M9 7h1M9 11h1M9 15h1'],
  shift:        ['M12 7v5l3.5 2', 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
  workSetup:    ['M3 5h18v11H3z', 'M8 20h8M12 16v4'],
  location:     ['M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],

  // — Sort —
  sort:         ['M4 7h9M4 12h6M4 17h3', 'M17 6v12m-3.5-3.5L17 18l3.5-3.5'],
};

// Convenience builders so call sites read by name, not by path string.
export const icon = (name) => createSvgIcon(ICON_PATHS[name]);

// Back-compat shims for the two existing named helpers.
export const createArchiveIcon = () => icon('archive');
export const createClipboardIcon = () => icon('copyUrl'); // now a link glyph; rename call site to createUrlIcon when convenient
