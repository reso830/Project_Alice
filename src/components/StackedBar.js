import { calculateSegments } from './DonutChart.js';

export function render({
  counts,
  colors,
  labels,
  onTap = () => {},
}) {
  const bar = document.createElement('div');

  bar.className = 'stacked-bar';

  for (const segment of calculateSegments(counts)) {
    const item = document.createElement('div');

    item.className = 'stacked-bar__segment';
    item.dataset.status = segment.status;
    item.style.flexBasis = `${segment.pct}%`;
    item.style.background = colors[segment.status] ?? '#64748b';
    item.textContent = labels[segment.status] ?? segment.status;
    item.addEventListener('click', () => onTap(segment.status, segment.count, segment.pct));
    bar.append(item);
  }

  return bar;
}

export const StackedBar = { render };
