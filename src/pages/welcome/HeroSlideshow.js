const ROTATION_MS = 5000;

let _timer = null;
let _root = null;

function prefersReducedMotion() {
  if (typeof globalThis.matchMedia !== 'function') {
    return false;
  }
  try {
    return globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

function buildCard(slide, isPrimary) {
  const card = document.createElement('div');
  card.className = 'hero-slideshow__card';
  if (isPrimary) {
    card.classList.add('hero-slideshow__card--primary');
  }

  const img = document.createElement('img');
  img.src = slide.src;
  img.alt = slide.alt ?? '';
  card.append(img);

  return card;
}

function buildPlaceholder() {
  const placeholder = document.createElement('div');
  placeholder.className = 'hero-slideshow__placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  return placeholder;
}

export function mount(container, { slides = [] } = {}) {
  if (_root) {
    unmount();
  }

  _root = document.createElement('div');
  _root.className = 'hero-slideshow';

  if (!Array.isArray(slides) || slides.length === 0) {
    _root.append(buildPlaceholder());
    container.append(_root);
    return;
  }

  const reducedMotion = prefersReducedMotion();
  const visibleSlides = reducedMotion ? slides.slice(0, 1) : slides;
  const cards = visibleSlides.map((slide, index) => buildCard(slide, index === 0));
  _root.append(...cards);
  container.append(_root);

  if (reducedMotion || cards.length < 2) {
    return;
  }

  let activeIndex = 0;
  _timer = setInterval(() => {
    cards[activeIndex].classList.remove('hero-slideshow__card--primary');
    activeIndex = (activeIndex + 1) % cards.length;
    cards[activeIndex].classList.add('hero-slideshow__card--primary');
  }, ROTATION_MS);
}

export function unmount() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  if (_root) {
    _root.remove();
    _root = null;
  }
}

export const HeroSlideshow = { mount, unmount };
