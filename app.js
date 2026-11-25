(() => {
  const hero = document.querySelector('#inicio');
  const toggle = hero?.querySelector('.hero-wave-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const paused = hero.toggleAttribute('data-wave-paused');
    toggle.setAttribute('aria-pressed', String(paused));
  });
  hero.setAttribute('data-wave-ready', '');
  toggle.hidden = false;
})();

(() => {
  const guide = document.querySelector('#guia');
  if (!guide) return;

  const links = guide.querySelectorAll('#colecciones a[href^="#ejemplo-"]');
  const examples = new Map(Array.from(guide.querySelectorAll('.guide-example'), (example) => [example.id, example]));
  const defaultId = examples.keys().next().value;
  const status = guide.querySelector('#guide-status');
  let currentId;

  function showExample(id, animate = false) {
    const selected = examples.get(id);
    if (!selected || id === currentId) return;

    currentId = id;
    for (const [key, example] of examples) {
      example.hidden = key !== id;
      example.classList.toggle('is-revealed', key === id && animate);
    }
    for (const link of links) {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    if (animate) status.textContent = selected.querySelector('h3').textContent;
  }

  guide.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#ejemplo-"]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    showExample(link.hash.slice(1), true);
  });

  function syncExample() {
    const id = location.hash.slice(1);
    if (examples.has(id)) showExample(id);
    else if (id === 'guia' || !currentId) showExample(defaultId);
  }
  window.addEventListener('hashchange', syncExample);
  syncExample();
})();

(() => {
  const trial = document.querySelector('.board-trial');
  if (!trial) return;

  const slots = [...trial.querySelectorAll('.board-trial-slot')];
  const picker = trial.querySelector('#board-trial-choices');
  const progress = trial.querySelector('.board-trial-progress');
  const status = trial.querySelector('#board-trial-status');
  const done = trial.querySelector('.board-trial-done');
  let activeSlot;

  function closePicker() {
    picker.hidden = true;
    activeSlot.setAttribute('aria-expanded', 'false');
    activeSlot.focus();
    activeSlot = undefined;
  }

  function updateProgress(completed = false) {
    const remaining = slots.filter((slot) => slot.classList.contains('essentials-slot')).length;
    done.disabled = remaining > 0;
    done.setAttribute('aria-pressed', String(completed));
    if (completed) status.textContent = '¡Rutina lista!';
    else if (remaining === 0) status.textContent = 'Marca la rutina como lista.';
    else status.textContent = remaining === 1 ? '1 ficha por agregar' : '2 fichas por agregar';
  }

  for (const slot of slots) {
    slot.disabled = false;
    slot.addEventListener('click', () => {
      if (slot === activeSlot) {
        closePicker();
        return;
      }

      activeSlot?.setAttribute('aria-expanded', 'false');
      activeSlot = slot;
      slot.setAttribute('aria-expanded', 'true');
      picker.hidden = false;
      picker.querySelector('button').focus();
    });
  }
  progress.hidden = false;
  picker.addEventListener('click', (event) => {
    const choice = event.target.closest('button');
    if (!choice) return;

    const label = choice.querySelector('span').textContent;
    const position = slots.indexOf(activeSlot) + 2;
    activeSlot.replaceChildren(...Array.from(choice.children, (child) => child.cloneNode(true)));
    activeSlot.classList.replace('essentials-slot', 'essentials-tile');
    activeSlot.setAttribute('aria-label', `Cambiar ficha ${position}: ${label}`);
    closePicker();
    updateProgress();
  });
  trial.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeSlot) closePicker();
  });
  done.addEventListener('click', () => {
    if (activeSlot) {
      closePicker();
      done.focus();
    }
    updateProgress(done.getAttribute('aria-pressed') === 'false');
  });
})();

function initializeProductGallery(gallery) {
  const thumbnails = gallery.querySelector('.booklet-thumbnails');
  const tiles = Array.from(thumbnails.querySelectorAll('button'));
  const image = gallery.querySelector('.booklet-image-frame > img');
  const caption = gallery.querySelector('.booklet-caption [role="status"]');
  const controls = gallery.querySelector('.booklet-controls');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;

  function selectPage(index) {
    if (index === active) return;
    tiles[active].setAttribute('aria-pressed', 'false');
    active = index;
    const tile = tiles[active];
    const label = tile.querySelector('span').textContent.trim();
    const source = tile.querySelector('img');
    image.setAttribute('width', source.getAttribute('width'));
    image.setAttribute('height', source.getAttribute('height'));
    image.src = source.getAttribute('src');
    image.alt = tile.dataset.imageAlt || 'Lámina ' + label;
    caption.querySelector('strong').textContent = label;
    caption.querySelector('span').textContent = (active + 1) + ' de ' + tiles.length;
    tile.setAttribute('aria-pressed', 'true');

    const bounds = tile.getBoundingClientRect();
    const rail = thumbnails.getBoundingClientRect();
    if (bounds.top < rail.top || bounds.bottom > rail.bottom) {
      thumbnails.scrollTo({
        top: thumbnails.scrollTop + bounds.top - rail.top - (rail.height - bounds.height) / 2,
        behavior: reducedMotion.matches ? 'instant' : 'smooth',
      });
    }
  }

  for (const [index, tile] of tiles.entries()) {
    tile.addEventListener('click', () => selectPage(index));
  }
  controls.addEventListener('click', (event) => {
    const button = event.target.closest('[data-booklet-step]');
    if (!button) return;
    selectPage((active + Number(button.dataset.bookletStep) + tiles.length) % tiles.length);
  });
  controls.hidden = false;
}

document.querySelectorAll('.booklet-gallery, .digital-preview').forEach(initializeProductGallery);
