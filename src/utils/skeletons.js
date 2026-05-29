function skeletonLine(modifier = '', hidden = false) {
  const line = document.createElement('span');

  line.className = `skeleton-line${modifier ? ` skeleton-line--${modifier}` : ''}`;
  if (hidden) {
    line.setAttribute('aria-hidden', 'true');
  }
  return line;
}

export function buildApplicationListSkeleton() {
  const wrap = document.createElement('div');

  wrap.className = 'loading-skeleton loading-skeleton--applications';
  wrap.setAttribute('aria-busy', 'true');
  wrap.setAttribute('aria-live', 'polite');
  wrap.setAttribute('aria-label', 'Loading applications');

  for (let index = 0; index < 3; index += 1) {
    const card = document.createElement('div');

    card.className = 'skeleton-card';
    card.setAttribute('aria-hidden', 'true');
    card.append(
      Object.assign(document.createElement('span'), { className: 'skeleton-line skeleton-line--short' }),
      Object.assign(document.createElement('span'), { className: 'skeleton-line skeleton-line--title' }),
      Object.assign(document.createElement('span'), { className: 'skeleton-line' }),
    );
    wrap.append(card);
  }

  return wrap;
}

export function buildProfileSkeleton() {
  const wrap = document.createElement('div');
  const hero = document.createElement('section');
  const apps = document.createElement('section');
  const profile = document.createElement('section');

  wrap.className = 'loading-skeleton loading-skeleton--profile';
  hero.className = 'section-card skeleton-section';
  apps.className = 'section-card skeleton-section';
  profile.className = 'section-card skeleton-section';
  wrap.setAttribute('aria-busy', 'true');
  wrap.setAttribute('aria-live', 'polite');
  wrap.setAttribute('aria-label', 'Loading profile');
  hero.append(skeletonLine('title', true), skeletonLine('medium', true));
  apps.append(skeletonLine('short', true), skeletonLine('', true), skeletonLine('medium', true));
  profile.append(
    skeletonLine('short', true),
    skeletonLine('title', true),
    skeletonLine('', true),
    skeletonLine('medium', true),
  );
  wrap.append(hero, apps, profile);

  return wrap;
}

export function buildCalendarSkeleton() {
  const grid = document.createElement('div');
  const panel = document.createElement('div');

  grid.className = 'calendar-skeleton calendar-skeleton__grid';
  panel.className = 'calendar-skeleton calendar-skeleton__panel';
  grid.setAttribute('aria-busy', 'true');
  grid.setAttribute('aria-live', 'polite');
  grid.setAttribute('aria-label', 'Loading calendar');
  panel.setAttribute('aria-busy', 'true');
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('aria-label', 'Loading calendar action panel');

  for (let index = 0; index < 42; index += 1) {
    const cell = document.createElement('div');

    cell.className = 'calendar-skeleton__cell';
    cell.append(skeletonLine('short'));
    grid.append(cell);
  }

  for (const width of ['short', 'medium', '']) {
    const row = document.createElement('div');

    row.className = 'calendar-skeleton__row';
    row.append(skeletonLine(width), skeletonLine(), skeletonLine('medium'));
    panel.append(row);
  }

  return { grid, panel };
}

export function buildProfileEditSkeleton() {
  const wrap = document.createElement('div');

  wrap.className = 'loading-skeleton profile-edit-skeleton';
  wrap.setAttribute('aria-busy', 'true');
  wrap.setAttribute('aria-live', 'polite');
  wrap.setAttribute('aria-label', 'Loading profile editor');

  for (let index = 0; index < 3; index += 1) {
    const section = document.createElement('section');

    section.className = 'section-card skeleton-section';
    section.append(skeletonLine('title'), skeletonLine('medium'), skeletonLine());
    wrap.append(section);
  }

  return wrap;
}

export function buildProfileAppsSkeleton() {
  const wrap = document.createElement('div');

  wrap.className = 'loading-skeleton profile-apps-skeleton';
  wrap.setAttribute('aria-busy', 'true');
  wrap.setAttribute('aria-live', 'polite');
  wrap.setAttribute('aria-label', 'Loading applications');

  for (let index = 0; index < 4; index += 1) {
    wrap.append(skeletonLine(index === 0 ? 'title' : 'medium'));
  }

  return wrap;
}
