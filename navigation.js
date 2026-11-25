function initializePictaNavigation() {
  const toggle = document.querySelector('#menu-toggle');
  const menu = document.querySelector('#main-menu');
  if (!toggle || !menu) return;
  const header = toggle.closest('.site-header');
  const store = header.dataset.pictaHeader === 'store';
  const links = new Map(Array.from(menu.querySelectorAll('a[href^="#"]'), (link) => [link.hash.slice(1), link]));
  const sectionAliases = new Map([
    ['inicio', 'formatos'], ['cuadernillo', 'formatos'], ['acceso-digital', 'formatos'],
    ['preguntas', 'personalizacion'], ['contacto', 'personalizacion'],
  ]);
  const sections = [...document.querySelectorAll('main > section[id], #contacto')];
  const narrowViewport = window.matchMedia('(max-width: 1000px)');
  let activeLink;
  let frame = 0;
  let turnAt = Math.max(0, window.scrollY);
  let hidden = false;
  let anchorScrollUntil = 0;
  let resizeTimer;

  function setMenuOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    scheduleUpdate();
  }

  function menuIsOpen() {
    return toggle.getAttribute('aria-expanded') === 'true';
  }

  function setHeaderHidden(next) {
    if (next === hidden) return;
    hidden = next;
    turnAt = Math.max(0, window.scrollY);
    header.classList.toggle('is-scroll-hidden', hidden);
  }

  function setActiveLink(next) {
    if (next !== activeLink) {
      activeLink?.removeAttribute('aria-current');
      activeLink = next;
    }
    activeLink?.setAttribute('aria-current', 'location');
  }

  function updateNavigation() {
    frame = 0;
    const y = Math.max(0, window.scrollY);
    const height = header.offsetHeight;
    const probe = Math.min(height + 36, window.innerHeight - 1);
    const visible = sections.find((section) => {
      const bounds = section.getBoundingClientRect();
      return bounds.top <= probe && bounds.bottom > probe;
    });
    const anchor = performance.now() < anchorScrollUntil && document.getElementById(location.hash.slice(1));
    const detail = store && document.querySelector('main > .shop-detail:target');
    const current = detail?.id || (anchor ? anchor.closest('main > section[id], #contacto')?.id || visible?.id : visible?.id);
    const next = store ? links.get(sectionAliases.get(current) || current || 'formatos') : null;

    setActiveLink(next);
    if (resizeTimer || y <= height + 12 || performance.now() < anchorScrollUntil || menuIsOpen() ||
      header.querySelector(':focus-visible, .dash-account-toggle[aria-expanded="true"]')) {
      setHeaderHidden(false);
      turnAt = y;
    } else if (hidden) {
      turnAt = Math.max(turnAt, y);
      if (turnAt - y >= 12) setHeaderHidden(false);
    } else {
      turnAt = Math.min(turnAt, y);
      if (y - turnAt >= 22) setHeaderHidden(true);
    }
  }

  function scheduleUpdate() {
    if (!frame) frame = window.requestAnimationFrame(updateNavigation);
  }

  toggle.addEventListener('click', () => setMenuOpen(!menuIsOpen()));
  header.querySelector('.header-actions').addEventListener('click', () => setMenuOpen(false));
  header.querySelector('.header-cart').addEventListener('click', (event) => {
    if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (header.dataset.pictaHeader === 'cart' && !location.search && !location.hash) {
      event.preventDefault();
      updateAfterAnchor();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  });

  document.addEventListener('click', (event) => {
    if (!event.button && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey &&
      event.target.closest('a.wordmark')) {
      setMenuOpen(false);
      if (store) updateAfterAnchor();
    }
    if (menuIsOpen() && (!header.contains(event.target) || event.target.closest('.dash-account-nav'))) {
      setMenuOpen(false);
    }
  });

  menu.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (store) {
      setActiveLink(link);
      updateAfterAnchor();
    }
    if (!narrowViewport.matches) return;

    setMenuOpen(false);
    const destination = store ? document.getElementById(link.hash.slice(1)) : null;
    if (!destination) return;
    const heading = destination.querySelector('h1, h2') || destination;
    heading.tabIndex = -1;
    window.requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menuIsOpen()) return;
    setMenuOpen(false);
    toggle.focus();
  });

  header.addEventListener('focusin', () => {
    setHeaderHidden(false);
    turnAt = Math.max(0, window.scrollY);
  });
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', () => {
    header.setAttribute('data-resizing', '');
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = undefined;
      header.removeAttribute('data-resizing');
      turnAt = Math.max(0, window.scrollY);
      scheduleUpdate();
    }, 155);
    scheduleUpdate();
  });
  function updateAfterAnchor() {
    // Keep the controls visible while the browser finishes an anchor jump.
    anchorScrollUntil = performance.now() + 1600;
    setHeaderHidden(false);
    scheduleUpdate();
  }

  function resumeScrollTracking() {
    anchorScrollUntil = 0;
    scheduleUpdate();
  }
  for (const event of ['wheel', 'touchmove']) {
    window.addEventListener(event, resumeScrollTracking, { passive: true });
  }
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key) && !header.contains(event.target)) {
      resumeScrollTracking();
    }
  });
  window.addEventListener('pointerdown', (event) => {
    if (event.clientX >= document.documentElement.clientWidth) resumeScrollTracking();
  }, { passive: true });
  window.addEventListener('hashchange', updateAfterAnchor);
  document.addEventListener('picta:account-section', updateAfterAnchor);
  window.addEventListener('pageshow', () => {
    if (window.location.hash) updateAfterAnchor();
    else scheduleUpdate();
  });
  document.fonts.ready.then(scheduleUpdate);
  narrowViewport.addEventListener('change', () => setMenuOpen(false));
  activeLink = menu.querySelector('[aria-current="location"]');
  if (window.location.hash) anchorScrollUntil = performance.now() + 1600;
  updateNavigation();
  menu.setAttribute('data-navigation-ready', '');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePictaNavigation, { once: true });
} else initializePictaNavigation();
