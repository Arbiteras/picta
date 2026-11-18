(() => {
  const toggle = document.querySelector('#menu-toggle');
  const menu = document.querySelector('#main-menu');
  const narrowViewport = window.matchMedia('(max-width: 780px)');

  function setMenuOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }

  toggle.addEventListener('click', () => {
    setMenuOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  document.getElementById('account-launch').addEventListener('click', () => setMenuOpen(false));

  menu.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !narrowViewport.matches) return;

    setMenuOpen(false);
    const destination = document.getElementById(link.hash.slice(1));
    if (!destination) return;
    destination.tabIndex = -1;
    destination.focus({ preventScroll: true });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return;
    setMenuOpen(false);
    toggle.focus();
  });

  narrowViewport.addEventListener('change', () => setMenuOpen(false));
  document.documentElement.classList.add('js');
})();
