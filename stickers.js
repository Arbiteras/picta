(() => {
  const stickers = new Map([
    ['casa', 'Casa'], ['escuela', 'Escuela'], ['supermercado', 'Supermercado'],
    ['casa-abuelos', 'Casa de los abuelos'], ['mochila', 'Mochila'], ['examen', 'Examen'],
    ['cuaderno', 'Cuaderno'], ['nino', 'Niño'], ['mama', 'Mamá'], ['papa', 'Papá'],
    ['abuela', 'Abuela'], ['abuelo', 'Abuelo'], ['profesora', 'Profesora'], ['amigo', 'Amigo'],
    ['celular', 'Celular'], ['tv', 'TV'], ['juguete', 'Juguete'], ['libro', 'Libro'],
    ['ropa', 'Ropa'], ['zapatos', 'Zapatos'], ['cama', 'Cama']
  ]);

  const boards = {
    day: {
      title: 'Mi día', hint: 'Elige qué haces en la mañana, la tarde y la noche.', slots: 6,
      rows: [['Mañana', 'yellow'], ['Tarde', 'mint'], ['Noche', 'indigo']]
    },
    phrases: {
      title: 'Armar frases', hint: 'Completa una frase con uno o dos stickers.', slots: 2,
      rows: [['Yo quiero', 'yellow'], ['Necesito', 'mint'], ['Me duele', 'pink'], ['No quiero', 'lilac']]
    }
  };

  const storagePrefix = 'picta.stickers.v1.';
  const workspace = document.getElementById('sticker-workspace');
  const bank = document.getElementById('sticker-bank');
  const bankPanel = bank.closest('.sticker-bank');
  const count = document.getElementById('sticker-count');
  const picked = document.getElementById('sticker-picked');
  const showSlots = document.getElementById('sticker-show-slots');
  const boardTitle = document.getElementById('sticker-board-title');
  const rows = document.getElementById('sticker-rows');
  const status = document.getElementById('sticker-status');
  const returnButton = document.getElementById('sticker-return');
  const modeButtons = workspace.querySelectorAll('[data-sticker-mode]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const checkIcon = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>';
  const plusIcon = '<svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg>';

  function loadBoard(key) {
    const board = boards[key];
    const empty = board.rows.map(() => ({ cards: Array(board.slots).fill(null), done: false }));
    try {
      const saved = JSON.parse(localStorage.getItem(storagePrefix + key));
      if (!Array.isArray(saved)) return empty;
      const used = new Set();
      return empty.map((row, rowIndex) => {
        const savedRow = saved[rowIndex];
        if (!Array.isArray(savedRow?.cards)) return row;
        const cards = row.cards.map((_, slotIndex) => {
          const id = savedRow.cards[slotIndex];
          if (!stickers.has(id) || used.has(id)) return null;
          used.add(id);
          return id;
        });
        return { cards, done: key === 'day' && cards.some(Boolean) && savedRow.done === true };
      });
    } catch {
      return empty;
    }
  }

  const state = { day: loadBoard('day'), phrases: loadBoard('phrases') };
  let mode = 'day';
  let selection = null;
  let drag = null;
  let dropTarget = null;
  let suppressDragClick = false;

  function cardContent(id) {
    const label = id === 'supermercado' ? 'Super<wbr>mercado' : stickers.get(id);
    const wide = id === 'casa-abuelos' || id === 'supermercado';
    return `<span class="sticker-paper${wide ? ' sticker-paper-wide' : ''}"><img src="assets/stickers/${id}.png" alt="" decoding="async" draggable="false"><span class="sticker-caption">${label}</span></span>`;
  }

  bank.innerHTML = Array.from(stickers, ([id]) => `
    <li class="sticker-bank-space">
      <button class="sticker-card" type="button" data-sticker="${id}" aria-label="${stickers.get(id)}" aria-pressed="false">${cardContent(id)}</button>
    </li>`).join('');
  const bankButtons = new Map(Array.from(bank.querySelectorAll('button'), (button) => [button.dataset.sticker, button]));

  function renderBoard() {
    const board = boards[mode];
    boardTitle.textContent = board.title;
    status.textContent = board.hint;
    rows.className = `sticker-rows sticker-rows-${mode}`;
    rows.innerHTML = board.rows.map(([label, tone], row) => `
      <div class="sticker-row sticker-tone-${tone}" role="group" aria-labelledby="sticker-row-${row}">
        <h4 class="sticker-row-label" id="sticker-row-${row}">${label}</h4>
        <div class="sticker-slots">
          ${Array.from({ length: board.slots }, (_, slot) => `<button class="sticker-slot" type="button" data-row="${row}" data-slot="${slot}"></button>`).join('')}
        </div>
        ${mode === 'day' ? `<button class="sticker-done" type="button" data-done="${row}">${checkIcon} Listo</button>` : ''}
      </div>`).join('');
    modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.stickerMode === mode)));
    refresh();
  }

  function slotLocation(button) {
    return { row: Number(button.dataset.row), slot: Number(button.dataset.slot) };
  }

  function refresh() {
    const used = new Set(state[mode].flatMap((row) => row.cards).filter(Boolean));
    count.textContent = `${stickers.size - used.size} disponibles`;
    picked.textContent = selection ? 'Elegiste: ' + stickers.get(selection.id) : '';
    for (const [id, button] of bankButtons) {
      button.hidden = used.has(id);
      button.parentElement.classList.toggle('is-vacant', button.hidden);
      button.setAttribute('aria-pressed', String(selection?.id === id));
    }

    for (const button of rows.querySelectorAll('[data-slot]')) {
      const { row, slot } = slotLocation(button);
      const id = state[mode][row].cards[slot];
      if (button.dataset.content !== (id || '')) {
        button.dataset.content = id || '';
        button.innerHTML = id ? cardContent(id) : plusIcon;
      }
      button.classList.toggle('sticker-card', Boolean(id));
      button.setAttribute('aria-label', `${boards[mode].rows[row][0]}, casilla ${slot + 1}, ${id ? stickers.get(id) : 'vacía'}`);
      if (id) button.setAttribute('aria-pressed', String(selection?.id === id));
      else button.removeAttribute('aria-pressed');
    }

    for (const button of rows.querySelectorAll('[data-done]')) {
      const row = Number(button.dataset.done);
      const { cards, done } = state[mode][row];
      button.disabled = !cards.some(Boolean);
      button.setAttribute('aria-pressed', String(done));
      button.setAttribute('aria-label', `${boards[mode].rows[row][0]}, listo`);
      button.closest('.sticker-row').classList.toggle('is-done', done);
    }

    workspace.classList.toggle('has-sticker-selection', Boolean(selection));
    returnButton.hidden = selection?.row == null;
  }

  function commit(message) {
    selection = null;
    refresh();
    try {
      localStorage.setItem(storagePrefix + mode, JSON.stringify(state[mode]));
      status.textContent = message;
    } catch {
      status.textContent = `${message} Los cambios se conservan mientras esta página siga abierta.`;
    }
  }

  function sourceFor(button) {
    if (button.dataset.sticker) return { id: button.dataset.sticker };
    const location = slotLocation(button);
    const id = state[mode][location.row].cards[location.slot];
    return id ? { ...location, id } : null;
  }

  function selectCard(source) {
    selection = selection?.id === source.id ? null : source;
    refresh();
    if (!selection) status.textContent = 'Selección cancelada.';
    else if (source.row == null) status.textContent = `${stickers.get(source.id)}. Elige una casilla.`;
    else status.textContent = `${stickers.get(source.id)}. Elige otra casilla o devuélvelo al banco.`;
  }

  function pressSticker(button) {
    if (reduceMotion.matches) return;
    const paper = button.querySelector('.sticker-paper');
    const tilt = getComputedStyle(paper).getPropertyValue('--sticker-tilt');
    paper.animate([
      { transform: 'translateY(-4px) rotate(-5deg) scale(1.13)' },
      { transform: `rotate(${tilt}) scale(1.04, .91)`, offset: .46 },
      { transform: `rotate(${tilt})` }
    ], { duration: 300, easing: 'cubic-bezier(.2,.7,.2,1)' });
  }

  function placeCard(source, button) {
    const target = slotLocation(button);
    const origin = source.row == null ? null : state[mode][source.row];
    const destination = state[mode][target.row];
    if (origin === destination && source.slot === target.slot) return;
    const previous = destination.cards[target.slot];

    if (origin) {
      origin.cards[source.slot] = previous;
      origin.done = false;
    }
    destination.cards[target.slot] = source.id;
    destination.done = false;
    commit(`${stickers.get(source.id)} en ${boards[mode].rows[target.row][0]}, casilla ${target.slot + 1}.`);
    pressSticker(button);
  }

  function returnCard(source) {
    const row = state[mode][source.row];
    row.cards[source.slot] = null;
    row.done = false;
    commit(`${stickers.get(source.id)} volvió al banco.`);
    pressSticker(bankButtons.get(source.id));
  }

  function focusFirstSlot() {
    const slot = rows.querySelector('[data-content=""]') || rows.querySelector('[data-slot]');
    slot.focus({ preventScroll: true });
    slot.scrollIntoView({ block: 'nearest' });
  }

  showSlots.addEventListener('click', focusFirstSlot);

  workspace.addEventListener('click', (event) => {
    if (suppressDragClick && event.detail > 0) {
      suppressDragClick = false;
      event.preventDefault();
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.stickerMode) {
      if (button.dataset.stickerMode === mode) return;
      mode = button.dataset.stickerMode;
      selection = null;
      renderBoard();
    } else if (button.dataset.sticker) {
      selectCard(sourceFor(button));
      if (selection && event.detail === 0) focusFirstSlot();
    } else if (button.dataset.slot != null) {
      const source = sourceFor(button);
      if (selection && selection.id !== source?.id) placeCard(selection, button);
      else if (source) selectCard(source);
      else status.textContent = 'Elige un sticker del banco primero.';
    } else if (button.dataset.done != null) {
      const index = Number(button.dataset.done);
      const row = state[mode][index];
      row.done = !row.done;
      commit(`${boards[mode].rows[index][0]} ${row.done ? 'marcada como lista' : 'vuelve a estar pendiente'}.`);
    } else if (button === returnButton && selection?.row != null) {
      const { row, slot } = selection;
      returnCard(selection);
      rows.querySelector(`[data-row="${row}"][data-slot="${slot}"]`).focus();
    }
  });

  workspace.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (drag) {
      clearDrag();
      return;
    }
    if (!selection) return;
    const source = selection;
    selection = null;
    refresh();
    status.textContent = 'Selección cancelada.';
    const sourceButton = source.row == null ? bankButtons.get(source.id)
      : rows.querySelector(`[data-row="${source.row}"][data-slot="${source.slot}"]`);
    sourceButton.focus();
  });

  function highlightDrop(target) {
    if (dropTarget === target) return;
    dropTarget?.classList.remove('is-drop-target');
    dropTarget = target;
    dropTarget?.classList.add('is-drop-target');
  }

  function clearDrag() {
    if (!drag) return;
    window.clearTimeout(drag.timer);
    window.cancelAnimationFrame(drag.frame);
    drag.preview?.remove();
    drag.button.classList.remove('is-peeling');
    document.body.classList.remove('sticker-is-dragging');
    highlightDrop(null);
    drag = null;
  }

  function paintDrag() {
    const x = drag.x - drag.offsetX;
    const y = drag.y - drag.offsetY;
    drag.preview.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    const hit = document.elementFromPoint(drag.x, drag.y);
    const slot = hit?.closest('.sticker-slot');
    if (slot && slot !== drag.button && rows.contains(slot)) highlightDrop(slot);
    else if (drag.source.row != null && bankPanel.contains(hit)) highlightDrop(bankPanel);
    else highlightDrop(null);
  }

  function scrollDuringDrag() {
    drag.frame = window.requestAnimationFrame(scrollDuringDrag);
    if (Math.abs(drag.y - drag.startY) < 7) return;
    const bounds = workspace.getBoundingClientRect();
    const bottom = window.innerHeight - 76;
    const top = 132;
    const down = drag.y > bottom && bounds.bottom > window.innerHeight;
    const up = drag.y < top && bounds.top < top;
    if (down || up) {
      const distance = down ? drag.y - bottom : drag.y - top;
      window.scrollBy({ top: Math.round(distance * .2), behavior: 'instant' });
      paintDrag();
    }
  }

  function liftSticker() {
    const bounds = drag.button.getBoundingClientRect();
    const preview = document.createElement('div');
    preview.className = 'sticker-in-hand';
    preview.setAttribute('aria-hidden', 'true');
    preview.style.width = `${bounds.width}px`;
    preview.style.height = `${bounds.height}px`;
    preview.append(drag.button.querySelector('.sticker-paper').cloneNode(true));
    const touch = drag.kind === 'touch';
    drag.offsetX = touch ? bounds.width / 2 : drag.startX - bounds.left;
    drag.offsetY = touch ? bounds.height * .89 : drag.startY - bounds.top;
    drag.preview = preview;
    suppressDragClick = true;
    drag.button.classList.add('is-peeling');
    document.body.classList.add('sticker-is-dragging');
    document.body.append(preview);
    paintDrag();
    drag.frame = window.requestAnimationFrame(scrollDuringDrag);
  }

  function prepareDrag(target, kind, id, x, y) {
    if (drag) return;
    suppressDragClick = false;
    const button = target.closest('.sticker-card');
    if (!button) return;
    drag = { button, source: sourceFor(button), kind, id, startX: x, startY: y, x, y };
    if (kind === 'touch') drag.timer = window.setTimeout(liftSticker, 200);
  }

  function moveDrag(x, y) {
    drag.x = x;
    drag.y = y;
    if (!drag.preview) {
      const moved = Math.hypot(x - drag.startX, y - drag.startY) >= 7;
      if (!moved) return;
      if (drag.kind === 'touch') {
        clearDrag();
        return;
      }
      liftSticker();
      return;
    }
    paintDrag();
  }

  function finishDrag(x, y) {
    const { source, preview, startX, startY, kind } = drag;
    if (preview) moveDrag(x, y);
    const target = dropTarget;
    clearDrag();
    if (!preview) return;
    if (target === bankPanel) returnCard(source);
    else if (target) {
      placeCard(source, target);
      target.focus({ preventScroll: true });
    } else if (kind === 'touch' && Math.hypot(x - startX, y - startY) < 7) selectCard(source);
  }

  workspace.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary) return;
    prepareDrag(event.target, 'pointer', event.pointerId, event.clientX, event.clientY);
  });

  window.addEventListener('pointermove', (event) => {
    if (drag?.kind !== 'pointer' || drag.id !== event.pointerId) return;
    if (!(event.buttons & 1)) clearDrag();
    else moveDrag(event.clientX, event.clientY);
  });

  window.addEventListener('pointerup', (event) => {
    if (drag?.kind === 'pointer' && drag.id === event.pointerId) finishDrag(event.clientX, event.clientY);
  });

  window.addEventListener('pointercancel', (event) => {
    if (drag?.kind === 'pointer' && drag.id === event.pointerId) clearDrag();
  });

  workspace.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) {
      if (drag?.kind === 'touch') clearDrag();
      return;
    }
    const touch = event.changedTouches[0];
    prepareDrag(event.target, 'touch', touch.identifier, touch.clientX, touch.clientY);
  }, { passive: true });

  workspace.addEventListener('touchmove', (event) => {
    if (drag?.kind !== 'touch') return;
    const touch = Array.from(event.changedTouches).find((point) => point.identifier === drag.id);
    if (!touch) return;
    if (drag.preview && event.cancelable) event.preventDefault();
    moveDrag(touch.clientX, touch.clientY);
  }, { passive: false });

  workspace.addEventListener('touchend', (event) => {
    if (drag?.kind !== 'touch') return;
    const touch = Array.from(event.changedTouches).find((point) => point.identifier === drag.id);
    if (!touch) return;
    if (drag.preview && event.cancelable) event.preventDefault();
    finishDrag(touch.clientX, touch.clientY);
  });

  workspace.addEventListener('touchcancel', () => {
    if (drag?.kind === 'touch') clearDrag();
  });

  workspace.addEventListener('contextmenu', (event) => {
    if (drag?.kind === 'touch' || event.sourceCapabilities?.firesTouchEvents) {
      if (event.target.closest('.sticker-card')) event.preventDefault();
    }
  });

  window.addEventListener('blur', clearDrag);

  window.addEventListener('storage', (event) => {
    for (const key of Object.keys(boards)) {
      if (event.key && event.key !== storagePrefix + key) continue;
      state[key] = loadBoard(key);
      if (key === mode) {
        selection = null;
        clearDrag();
        refresh();
        status.textContent = 'Tablero actualizado desde otra pestaña.';
      }
    }
  });

  renderBoard();
  workspace.hidden = false;
})();
