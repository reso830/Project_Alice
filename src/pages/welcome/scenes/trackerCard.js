// Shared tracker card used by the pipeline (scene 3) and deck (scene 5) scenes.
// Mirrors the prototype's single TrackerCard component so both scenes render
// the exact same card: accent bar, id + status badge + timestamp row,
// position/company, and a compat bar with a centered percentage label.

export function compatClass(value) {
  if (value >= 85) return 'great';
  if (value >= 65) return 'good';
  return 'low';
}

export function buildBadge(status, badgeCls) {
  const badge = document.createElement('span');
  badge.className = `tracker-card__badge tracker-card__badge--${badgeCls}`;
  badge.textContent = status;
  return badge;
}

export function buildTrackerCard({ id, status, badgeCls, upd, role, company, compat }) {
  const card = document.createElement('article');
  card.className = 'tracker-card';

  const accent = document.createElement('span');
  accent.className = 'tracker-card__accent';
  accent.setAttribute('aria-hidden', 'true');

  const row = document.createElement('div');
  row.className = 'tracker-card__row';
  const idEl = document.createElement('span');
  idEl.className = 'tracker-card__id';
  idEl.textContent = id;
  const badge = buildBadge(status, badgeCls);
  const updEl = document.createElement('span');
  updEl.className = 'tracker-card__upd';
  updEl.textContent = upd;
  row.append(idEl, badge, updEl);

  const body = document.createElement('div');
  body.className = 'tracker-card__body';
  const roleEl = document.createElement('p');
  roleEl.className = 'tracker-card__role';
  roleEl.textContent = role;
  const companyEl = document.createElement('p');
  companyEl.className = 'tracker-card__company';
  companyEl.textContent = company;
  body.append(roleEl, companyEl);

  const bar = document.createElement('span');
  bar.className = 'tracker-card__bar';
  const fill = document.createElement('span');
  fill.className = `tracker-card__bar-fill tracker-card__bar-fill--${compatClass(compat)}`;
  fill.style.width = `${compat}%`;
  const label = document.createElement('span');
  label.className = 'tracker-card__bar-label';
  label.textContent = `${compat}% compat`;
  bar.append(fill, label);

  card.append(accent, row, body, bar);
  return { card, badge };
}
