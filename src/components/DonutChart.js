const SVG_NS = 'http://www.w3.org/2000/svg';

function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = (angleDeg - 90) * (Math.PI / 180);

  return {
    x: cx + (radius * Math.cos(angleRad)),
    y: cy + (radius * Math.sin(angleRad)),
  };
}

function arcPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function exactPercentages(items, total) {
  const raw = items.map((item) => {
    const exact = (item.count / total) * 100;
    return {
      ...item,
      pct: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  let remaining = 100 - raw.reduce((sum, item) => sum + item.pct, 0);

  return raw
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => b.remainder - a.remainder)
    .map((item) => {
      if (remaining > 0) {
        remaining -= 1;
        return { ...item, pct: item.pct + 1 };
      }
      return item;
    })
    .sort((a, b) => a.index - b.index)
    .map((item) => ({
      status: item.status,
      count: item.count,
      pct: item.pct,
    }));
}

export function calculateSegments(counts = {}) {
  const items = Object.entries(counts)
    .filter(([, count]) => Number(count) > 0)
    .map(([status, count]) => ({ status, count: Number(count) }));
  const total = items.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return [];
  }

  let cursor = 0;

  return exactPercentages(items, total).map((item) => {
    const sweep = (item.count / total) * 360;
    const segment = {
      ...item,
      startAngle: cursor,
      endAngle: cursor + sweep,
    };

    cursor += sweep;
    return segment;
  });
}

function createPath({ status, pct, startAngle, endAngle }, colors, cx, outerRadius, innerRadius, onHover) {
  const path = document.createElementNS(SVG_NS, 'path');

  path.setAttribute('d', arcPath(cx, cx, outerRadius, innerRadius, startAngle, endAngle));
  path.setAttribute('fill', colors[status] ?? '#64748b');
  path.dataset.status = status;
  path.addEventListener('mouseover', (event) => onHover(status, path, pct, event));
  path.addEventListener('mousemove', (event) => onHover(status, path, pct, event));

  return path;
}

export function render({
  counts,
  colors,
  labels,
  size = 160,
  holeRatio = 0.55,
  onHover = () => {},
}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const cx = size / 2;
  const outerRadius = size / 2;
  const innerRadius = outerRadius * holeRatio;
  const paths = [];

  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Application status breakdown');
  svg.classList.add('donut-chart');

  for (const segment of calculateSegments(counts)) {
    const parts = segment.startAngle === 0 && segment.endAngle === 360
      ? [
        { ...segment, startAngle: 0, endAngle: 180 },
        { ...segment, startAngle: 180, endAngle: 360 },
      ]
      : [segment];

    for (const part of parts) {
      const path = createPath(part, colors, cx, outerRadius, innerRadius, onHover);

      path.setAttribute('aria-label', `${labels[segment.status] ?? segment.status} ${segment.pct}%`);
      paths.push(path);
      svg.append(path);
    }
  }

  svg.addEventListener('mouseleave', () => onHover(null, null, 0, null));

  function update(hoveredStatus) {
    for (const path of paths) {
      path.style.opacity = !hoveredStatus || path.dataset.status === hoveredStatus ? '1' : '0.4';
    }
  }

  return { el: svg, update };
}

export const DonutChart = { render };
