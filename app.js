(() => {
  const guide = document.querySelector('#guia');
  if (!guide) return;

  const controls = guide.querySelector('#guide-controls');
  const buttons = controls.querySelectorAll('button[aria-controls]');
  const examples = new Map(Array.from(guide.querySelectorAll('.guide-example'), (example) => [example.id, example]));
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
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.getAttribute('aria-controls') === id));
    }
    if (animate) status.textContent = selected.querySelector('h3').textContent;
  }

  controls.addEventListener('click', (event) => {
    const button = event.target.closest('button[aria-controls]');
    if (!button) return;

    const id = button.getAttribute('aria-controls');
    showExample(id, true);
    if (window.location.hash !== '#' + id) {
      history.replaceState(history.state, '', '#' + id);
    }
  });

  document.querySelector('.collection-grid').addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#ejemplo-"]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;

    showExample(link.hash.slice(1), true);
  });

  window.addEventListener('hashchange', () => showExample(window.location.hash.slice(1)));
  const initialId = window.location.hash.slice(1);
  showExample(examples.has(initialId) ? initialId : examples.keys().next().value);
  controls.hidden = false;
})();
