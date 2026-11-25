(() => {
  const categories = [
    ['rutina', 'Rutina', [
      ['manana', 'Mañana', '01'], ['tarde', 'Tarde', '02'], ['noche', 'Noche', '03'],
      ['lavarse-manos', 'Lavarse las manos', '39'], ['vestirse', 'Vestirse', '40'],
      ['salir', 'Salir', '41'], ['jugar', 'Jugar', '42'], ['descansar', 'Descansar', '43'],
      ['cepillarse', 'Cepillarse los dientes', '45'], ['ducharse', 'Ducharse', '46'],
      ['esperar', 'Esperar', '47'], ['abrir', 'Abrir', '48'], ['cama', 'Dormir', '62'],
      ['comer', 'Comer', '67']
    ]],
    ['personas', 'Personas', [
      ['nino', 'Niño', '16'], ['nina', 'Niña', '22'], ['mama', 'Mamá', '17'],
      ['papa', 'Papá', '18'], ['abuela', 'Abuela', '25'], ['abuelo', 'Abuelo', '23'],
      ['doctora', 'Doctora', '24'], ['profesora', 'Profesora', '26'], ['amigo', 'Amigo', '27']
    ]],
    ['lugares', 'Lugares', [
      ['casa', 'Casa', '34'], ['escuela', 'Escuela', '35'], ['parque', 'Parque', '32'],
      ['hospital', 'Hospital', '33'], ['supermercado', 'Supermercado', '36'],
      ['casa-abuelos', 'Casa de los abuelos', '37'], ['bano', 'Baño', '38']
    ]],
    ['emociones', 'Emociones', [
      ['alegre', 'Alegre', '19'], ['triste', 'Triste', '20'], ['enojado', 'Enojado', '21'],
      ['nervioso', 'Nervioso', '28'], ['cansado', 'Cansado', '29'],
      ['tranquilo', 'Tranquilo', '30'], ['frustrado', 'Frustrado', '31']
    ]],
    ['comunicar', 'Comunicar', [
      ['quiero', 'Quiero', '04'], ['necesito', 'Necesito', '05'], ['me-siento', 'Me siento', '06'],
      ['no-quiero', 'No quiero', '07'], ['me-duele', 'Me duele', '08'],
      ['ayudame', 'Ayúdame', '09'], ['no', 'No', '68'], ['pedir-ayuda', 'Pedir ayuda', '69'],
      ['un-momento', 'Un momento', '70'], ['dolor', 'Siento dolor', '71']
    ]],
    ['sensorial', 'Sensorial', [
      ['mucho-ruido', 'Mucho ruido', '10'], ['olor-fuerte', 'Olor fuerte', '11'],
      ['mucha-gente', 'Mucha gente', '12'], ['tengo-calor', 'Mucho calor', '13'],
      ['tengo-frio', 'Tengo frío', '14'], ['sin-contacto', 'No quiero que me toquen', '15'],
      ['protectores-auditivos', 'Protectores auditivos', '44'],
      ['lugar-tranquilo', 'Lugar tranquilo', '49'], ['luz-fuerte', 'Luz fuerte', '72']
    ]],
    ['objetos', 'Objetos y escuela', [
      ['mochila', 'Mochila', '56'], ['examen', 'Examen', '57'], ['cuaderno', 'Cuaderno', '58'],
      ['recreo', 'Recreo', '59'], ['dibujar', 'Dibujar', '60'], ['libro', 'Libro', '61'],
      ['celular', 'Celular', '50'], ['tv', 'TV', '51'], ['juguete', 'Juguete', '52'],
      ['ropa', 'Ropa', '53'], ['zapatos', 'Zapatos', '54'], ['pelota', 'Pelota', '55']
    ]],
    ['alimentos', 'Alimentos', [
      ['agua', 'Agua', '63'], ['leche', 'Leche', '64'], ['saltena', 'Salteña', '65'],
      ['majadito', 'Majadito', '66']
    ]]
  ];

  const stickers = new Map(categories.flatMap(([category, , cards]) =>
    cards.map(([id, label, file]) => [id, { label, file, category }])
  ));

  const demoCards = new Set(['vestirse', 'cepillarse', 'comer', 'mochila', 'escuela', 'recreo',
    'casa', 'supermercado', 'agua', 'saltena', 'alegre', 'triste', 'dolor', 'pedir-ayuda', 'descansar']);
  const sensoryCards = ['mucho-ruido', 'olor-fuerte', 'mucha-gente', 'tengo-calor', 'tengo-frio', 'sin-contacto'];
  const boards = {
    day: {
      title: 'Mi día', hint: 'Elige qué haces en la mañana, la tarde y la noche.', slots: 5,
      rows: [['Mañana', 'yellow', 'manana'], ['Tarde', 'sky', 'tarde'], ['Noche', 'lilac', 'noche']]
    },
    phrases: {
      title: 'Yo comunico', hint: 'Elige un pictograma para completar tu mensaje.', slots: 1,
      rows: [['Quiero', 'yellow', 'quiero'], ['Necesito', 'mint', 'necesito'], ['Me siento', 'pink', 'me-siento']]
    },
    say: {
      title: 'Puedo decir', hint: 'Señala una expresión o agrega un pictograma.', slots: 1,
      rows: [['No quiero', 'lilac', 'no-quiero'], ['Me duele', 'pink', 'me-duele'], ['Ayúdame', 'mint', 'ayudame']]
    },
    sensory: {
      title: 'Algo me molesta', hint: 'Señala o toca lo que te incomoda.', rows: []
    }
  };

  const storagePrefix = 'picta.pictogramas.v2.';
  const legacyPrefix = 'picta.stickers.v1.';
  const workspace = document.getElementById('sticker-workspace');
  if (!workspace) return;
  const privateBoard = workspace.hasAttribute('data-private-board');
  if (privateBoard) {
    boards.day.starter = [
      ['cepillarse', 'ducharse', 'vestirse', 'saltena', 'escuela'],
      ['casa', 'lavarse-manos', 'comer', 'descansar', 'jugar'],
      ['tv', 'cama'],
    ];
    Object.assign(boards, {
      people: {
        title: 'Personas y emociones', hint: 'Elige una ficha para usarla o mueve las fichas de cada grupo.',
        slots: 9, columns: 3, rows: [['Personas', 'sky'], ['Emociones', 'lilac']],
        starter: [
          ['nino', 'nina', 'mama', 'papa', 'abuela', 'abuelo', 'doctora', 'profesora', 'amigo'],
          ['alegre', 'triste', 'enojado', 'nervioso', 'cansado', 'tranquilo', 'frustrado'],
        ],
      },
      care: {
        title: 'Cuidado', hint: 'Organiza aquí las fichas de higiene, descanso y cuidado.',
        slots: 18, columns: 6, rows: [['Cuidado', 'sky']],
      },
      collection: {
        title: 'Comunicar, alimentos y lugares', hint: 'Elige fichas del banco y colócalas en su grupo.',
        slots: 6, columns: 6, rows: [['Comunicar', 'sky'], ['Alimentos', 'yellow'], ['Lugares', 'mint']],
      },
      school: {
        title: 'Escuela, juguetes y objetos', hint: 'Organiza las fichas para la escuela y el juego.',
        slots: 6, columns: 6, rows: [['Escuela', 'sky'], ['Juguetes y objetos', 'lilac']],
      },
    });
  }
  const search = document.getElementById('sticker-search');
  const searchClear = document.createElement('button');
  searchClear.type = 'button';
  searchClear.className = 'btn btn-link';
  searchClear.textContent = 'Limpiar búsqueda';
  searchClear.hidden = true;
  search.after(searchClear);
  const undo = document.getElementById('sticker-undo');
  const clear = document.getElementById('sticker-clear');
  const clearDialog = document.getElementById('sticker-clear-dialog');
  const save = document.getElementById('sticker-save');
  const saveStatus = document.getElementById('diary-save-status');
  const pendingPages = new Map();
  let saveFailed = false;
  let owner = null;
  let loading = false;
  let saving = false;
  let saveReady = false;
  let accessVersion = 0;
  let selectedDiscomfort = null;
  const previous = {};
  const bank = document.getElementById('sticker-bank');
  const bankPanel = bank.closest('.sticker-bank');
  const picker = document.getElementById('diary-picker');
  const pickerTrigger = workspace.querySelector('[data-diary-bank]');
  const pickerRemove = picker?.querySelector('[data-diary-remove]');
  let pickerSlot = null;
  const count = document.getElementById('sticker-count');
  const picked = document.getElementById('sticker-picked');
  const showSlots = document.getElementById('sticker-show-slots');
  const filters = document.createElement('div');
  const emptyBank = document.createElement('p');
  const cancelSelectionButton = document.createElement('button');
  const boardTitle = document.getElementById('sticker-board-title');
  const rows = document.getElementById('sticker-rows');
  const status = document.getElementById('sticker-status');
  const returnButton = document.getElementById('sticker-return');
  const modeButtons = [...workspace.querySelectorAll('[data-sticker-mode]')];
  const pageButtons = [...workspace.querySelectorAll('[data-diary-step]')];
  const pageNumber = document.getElementById('diary-page-number');
  const pageRail = document.getElementById('diary-pages');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const checkIcon = '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>';
  const plusIcon = '<svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg>';

  function isAvailable(id) {
    return stickers.has(id) && (owner ? Number(stickers.get(id).file) >= 16 : demoCards.has(id));
  }

  function normalizeBoard(key, saved) {
    const board = boards[key];
    return board.rows.map((_, rowIndex) => {
      const savedRow = saved?.[rowIndex];
      const cards = Array.from({ length: board.slots }, (_, slot) => {
        const id = saved === undefined ? board.starter?.[rowIndex]?.[slot] : savedRow?.cards?.[slot];
        return isAvailable(id) ? id : null;
      });
      return { cards, done: key === 'day' && cards.some(Boolean) && savedRow?.done === true };
    });
  }

  function loadBoard(key) {
    if (!privateBoard) {
      try {
        const saved = JSON.parse(localStorage.getItem(storagePrefix + key));
        if (saved) return normalizeBoard(key, saved);
        if (key === 'day') return normalizeBoard(key, JSON.parse(localStorage.getItem(legacyPrefix + key)));
        const phrases = JSON.parse(localStorage.getItem(legacyPrefix + 'phrases'));
        if (key === 'phrases') return normalizeBoard(key, [phrases?.[0], phrases?.[1]]);
        if (key === 'say') return normalizeBoard(key, [phrases?.[3], phrases?.[2]]);
      } catch {
        return normalizeBoard(key);
      }
    }
    return normalizeBoard(key);
  }

  const state = Object.fromEntries(Object.keys(boards).map((key) => [key, loadBoard(key)]));
  let mode = 'day';
  let category = 'all';
  let selection = null;
  let drag = null;
  let dropTarget = null;
  let suppressDragClick = false;

  function cardContent(id) {
    const { label, file } = stickers.get(id);
    const wide = label.length >= 9;
    return `<span class="sticker-paper${wide ? ' sticker-paper-wide' : ''}"><img src="assets/pictograms/${file}.webp" alt="" loading="lazy" decoding="async" draggable="false"><span class="sticker-caption">${label}</span></span>`;
  }

  filters.className = 'segmented-controls sticker-filters';
  filters.setAttribute('role', 'group');
  filters.setAttribute('aria-label', 'Filtrar pictogramas por categoría');
  const visibleCategories = privateBoard ? categories : categories.filter(([, , cards]) =>
    cards.some(([id]) => demoCards.has(id))
  );
  filters.innerHTML = [['all', picker ? 'Todas' : 'Todos'], ...visibleCategories].map(([id, label]) => {
    const file = picker && categories.find(([key]) => key === id)?.[2].find(([, , file]) => Number(file) >= 16)?.[2];
    const image = file ? `<img src="assets/pictograms/${file}.webp" width="24" height="24" alt="">` : '';
    return `<button type="button" data-sticker-category="${id}" aria-controls="sticker-bank" aria-pressed="${id === category}">${image}${label}</button>`;
  }).join('');
  bank.before(filters);
  const categoryButtons = filters.querySelectorAll('[data-sticker-category]');

  emptyBank.className = 'sticker-bank-empty';
  emptyBank.textContent = 'No encontramos pictogramas. Prueba con otra palabra o categoría.';
  bank.after(emptyBank);

  cancelSelectionButton.type = 'button';
  cancelSelectionButton.className = 'btn btn-link sticker-cancel';
  cancelSelectionButton.textContent = 'Cancelar selección';
  showSlots?.after(cancelSelectionButton);

  bank.innerHTML = Array.from(stickers, ([id, { label }]) => `
    <li class="sticker-bank-space">
      <button class="sticker-card" type="button" data-sticker="${id}" aria-label="${label}" aria-pressed="false">${cardContent(id)}</button>
    </li>`).join('');
  const bankButtons = new Map(Array.from(bank.querySelectorAll('button'), (button) => [button.dataset.sticker, button]));

  function renderBoard() {
    const board = boards[mode];
    const index = modeButtons.findIndex((button) => button.dataset.stickerMode === mode);
    if (pageNumber) pageNumber.textContent = (index + 1) + ' de ' + modeButtons.length;
    for (const button of pageButtons) {
      button.disabled = Number(button.dataset.diaryStep) < 0 ? index <= 0 : index >= modeButtons.length - 1;
    }
    boardTitle.textContent = board.title;
    status.textContent = privateBoard && mode !== 'sensory' ? 'Toca una casilla para elegir su ficha.' : board.hint;
    bankPanel.hidden = mode === 'sensory';
    workspace.querySelector('.sticker-layout').classList.toggle('sticker-layout-sensory', mode === 'sensory');
    rows.className = `sticker-rows sticker-rows-${mode}`;
    rows.classList.toggle('diary-sheets', Boolean(board.columns));
    rows.classList.toggle('diary-sheets-split', board.columns === 3);
    rows.style.setProperty('--diary-columns', board.columns || 1);
    rows.innerHTML = mode === 'sensory' ? sensoryCards.map((id) =>
      `<button type="button" class="sticker-card sticker-sensory-card" data-discomfort="${id}" aria-pressed="${selectedDiscomfort === id}">${cardContent(id)}</button>`).join('')
      : board.rows.map(([label, tone, phrase], row) => {
        const doneButton = mode === 'day' ? `<button class="sticker-done" type="button" data-done="${row}">${checkIcon} Listo</button>` : '';
        return `
      <div class="sticker-row sticker-tone-${tone}" role="group" aria-labelledby="sticker-row-${row}">
        <h4 class="sticker-row-label" id="sticker-row-${row}">${mode === 'day'
          ? `<img src="assets/pictograms/${stickers.get(phrase).file}.webp" alt="" width="320" height="320"><span>${label}</span>`
          : phrase ? `<button class="sticker-card sticker-fixed-phrase" type="button" data-phrase="${phrase}">${cardContent(phrase)}</button>` : label}</h4>
        <div class="sticker-slots">
          ${Array.from({ length: board.slots }, (_, slot) => `<button class="sticker-slot" type="button" data-row="${row}" data-slot="${slot}"></button>`).join('')}
          ${privateBoard ? doneButton : ''}
        </div>
        ${privateBoard ? '' : doneButton}
      </div>`;
      }).join('');
    modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.stickerMode === mode)));
    if (privateBoard) rows.scrollTop = 0;
    if (pageRail) revealActivePage();
    refresh();
  }

  function revealActivePage() {
    const active = pageRail.querySelector('[aria-pressed="true"]');
    if (!active) return;
    const page = active.getBoundingClientRect();
    const rail = pageRail.getBoundingClientRect();
    if (page.top < rail.top) pageRail.scrollTop += page.top - rail.top;
    else if (page.bottom > rail.bottom) pageRail.scrollTop += page.bottom - rail.bottom;
  }

  function slotLocation(button) {
    return { row: Number(button.dataset.row), slot: Number(button.dataset.slot) };
  }

  function refreshBank() {
    const fold = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const term = fold(search.value.trim());
    searchClear.hidden = !search.value;
    let available = 0;
    for (const [id, button] of bankButtons) {
      const inCategory = category === 'all' || stickers.get(id).category === category;
      const visible = inCategory && isAvailable(id) && fold(stickers.get(id).label).includes(term);
      button.parentElement.hidden = !visible;
      button.setAttribute('aria-pressed', String(selection?.id === id));
      if (visible) available += 1;
    }
    const availability = `${available} ${available === 1 ? 'disponible' : 'disponibles'}`;
    count.textContent = availability;
    bank.hidden = available === 0;
    emptyBank.hidden = available > 0;
    return availability;
  }

  function refresh() {
    refreshBank();
    if (picked) {
      picked.textContent = selection ? `Elegiste: ${stickers.get(selection.id).label}` : '';
      picked.hidden = !selection;
    }
    cancelSelectionButton.hidden = !selection;
    if (pickerTrigger) pickerTrigger.disabled = loading || !saveReady;

    for (const button of rows.querySelectorAll('[data-slot]')) {
      const { row, slot } = slotLocation(button);
      const id = state[mode][row].cards[slot];
      if (button.dataset.content !== (id || '')) {
        button.dataset.content = id || '';
        button.innerHTML = id ? cardContent(id) : plusIcon;
      }
      button.classList.toggle('sticker-card', Boolean(id));
      if (picker) button.disabled = loading || !saveReady;
      button.setAttribute('aria-label', `${boards[mode].rows[row][0]}, casilla ${slot + 1}, ${id ? stickers.get(id).label : 'vacía'}`);
      if (id) button.setAttribute('aria-pressed', String(selection?.row === row && selection?.slot === slot));
      else button.removeAttribute('aria-pressed');
    }

    for (const button of rows.querySelectorAll('[data-done]')) {
      const row = Number(button.dataset.done);
      const { cards, done } = state[mode][row];
      button.disabled = !cards.some(Boolean) || Boolean(picker && (loading || !saveReady));
      button.setAttribute('aria-pressed', String(done));
      button.setAttribute('aria-label', `${boards[mode].rows[row][0]}, listo`);
      button.closest('.sticker-row').classList.toggle('is-done', done);
    }

    workspace.classList.toggle('has-sticker-selection', Boolean(selection));
    if (returnButton) returnButton.hidden = selection?.row == null;
    undo.hidden = mode === 'sensory' || Boolean(picker && !previous[mode]);
    undo.disabled = !previous[mode] || loading;
    if (clear) {
      clear.hidden = mode === 'sensory';
      clear.disabled = !state[mode].some((row) => row.cards.some(Boolean)) || loading;
    }
    if (save) {
      save.hidden = !owner || !saveFailed;
      save.disabled = !saveReady || loading || saving;
    }
  }

  function commit(message) {
    selection = null;
    refresh();
    try {
      if (!privateBoard) localStorage.setItem(storagePrefix + mode, JSON.stringify(state[mode]));
      status.textContent = message;
      if (privateBoard && saveReady) {
        pendingPages.set(mode, structuredClone(state[mode]));
        window.addEventListener('beforeunload', warnUnsavedPages);
        void savePages();
      }
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
    const same = selection?.id === source.id && selection?.row === source.row && selection?.slot === source.slot;
    selection = same ? null : source;
    refresh();
    if (!selection) status.textContent = 'Selección cancelada.';
    else if (source.row == null) status.textContent = `${stickers.get(source.id).label}. Elige una casilla.`;
    else status.textContent = `${stickers.get(source.id).label}. Elige otra casilla o devuélvelo al banco.`;
  }

  function pressSticker(button) {
    if (reduceMotion.matches || button.parentElement.hidden) return;
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
    remember();
    const replaced = destination.cards[target.slot];

    if (origin) {
      origin.cards[source.slot] = replaced;
      origin.done = false;
    }
    destination.cards[target.slot] = source.id;
    destination.done = false;
    commit(`${stickers.get(source.id).label} en ${boards[mode].rows[target.row][0]}, casilla ${target.slot + 1}.`);
    if (!reduceMotion.matches && window.pictaMotion) {
      const stamp = document.createElement('span');
      const layer = document.createElement('span');
      stamp.className = 'picta-motion sticker-placement-stamp';
      stamp.dataset.lottie = 'assets/motion/sticker-colocado.json';
      stamp.setAttribute('aria-hidden', 'true');
      layer.className = 'picta-motion-layer';
      stamp.append(layer);
      button.append(stamp);
      void window.pictaMotion.play(stamp).finally(() => stamp.remove());
    }
  }

  function returnCard(source) {
    remember();
    const row = state[mode][source.row];
    row.cards[source.slot] = null;
    row.done = false;
    commit(`${stickers.get(source.id).label} volvió al banco.`);
    if (!picker) pressSticker(bankButtons.get(source.id));
  }

  function focusFirstSlot() {
    const slot = rows.querySelector('[data-content=""]') || rows.querySelector('[data-slot]');
    if (!slot) return;
    slot.focus({ preventScroll: true });
    slot.scrollIntoView({ block: 'nearest' });
  }

  showSlots?.addEventListener('click', focusFirstSlot);
  function openPicker(slot = null) {
    if (loading || !saveReady || picker.open) return;
    selection = null;
    pickerSlot = slot;
    category = 'all';
    for (const filter of categoryButtons) filter.setAttribute('aria-pressed', String(filter.dataset.stickerCategory === category));
    search.value = '';
    search.closest('details').open = false;
    pickerRemove.hidden = !slot?.dataset.content;
    refresh();
    picker.showModal();
    bank.scrollTop = 0;
    picker.querySelector('h3').focus();
  }

  if (picker) {
    pickerTrigger.addEventListener('click', () => openPicker());
    picker.querySelector('[data-diary-close]').addEventListener('click', () => picker.close());
    pickerRemove.addEventListener('click', () => {
      if (!pickerSlot?.dataset.content) return;
      const slot = pickerSlot;
      picker.close();
      returnCard(sourceFor(slot));
      slot.focus();
    });
    picker.addEventListener('close', () => { if (!picker.open) pickerSlot = null; });
  }
  search.addEventListener('input', refreshBank);
  searchClear.addEventListener('click', () => {
    search.value = '';
    refreshBank();
    search.focus();
  });

  function remember() {
    previous[mode] = structuredClone(state[mode]);
  }

  undo.addEventListener('click', () => {
    if (!previous[mode]) return;
    state[mode] = previous[mode];
    delete previous[mode];
    commit('Se deshizo el último cambio.');
  });

  clear?.addEventListener('click', () => {
    clearDialog.returnValue = '';
    clearDialog.showModal();
  });
  clearDialog?.addEventListener('close', () => {
    if (clearDialog.returnValue !== 'clear' || mode === 'sensory') return;
    remember();
    state[mode] = normalizeBoard(mode, []);
    commit('Tablero limpio.');
  });

  if (privateBoard) {
    window.pictaBoards = {
      async setAccess(nextOwner) {
        if (nextOwner === owner && (!owner || loading || saveReady)) return;
        const version = ++accessVersion;
        owner = nextOwner;
        saving = false;
        saveReady = false;
        saveFailed = false;
        pendingPages.clear();
        window.removeEventListener('beforeunload', warnUnsavedPages);
        saveStatus.hidden = true;
        loading = Boolean(owner);
        selection = null;
        selectedDiscomfort = null;
        workspace.hidden = !owner;
        if (loading) workspace.setAttribute('aria-busy', 'true');
        else workspace.removeAttribute('aria-busy');
        clearDrag();
        if (picker?.open) picker.close();
        for (const key of Object.keys(boards)) {
          delete previous[key];
          state[key] = normalizeBoard(key);
        }
        if (!owner) mode = 'day';
        renderBoard();
        if (!owner) return;
        status.textContent = 'Cargando tus páginas…';
        try {
          const { data, error } = await window.pictaSupabase.from('picta_rutinas').select('tablero, casillas').eq('cliente_id', nextOwner);
          if (error) throw error;
          if (version !== accessVersion) return;
          for (const { tablero, casillas } of data) {
            if (Object.hasOwn(boards, tablero)) state[tablero] = normalizeBoard(tablero, casillas);
          }
          saveReady = true;
          status.textContent = mode === 'sensory' ? boards[mode].hint : 'Toca una casilla para elegir su ficha.';
        } catch {
          if (version === accessVersion) status.textContent = 'No pudimos cargar tus rutinas. Recarga la página para reintentar.';
        } finally {
          if (version === accessVersion) {
            loading = false;
            workspace.removeAttribute('aria-busy');
            refresh();
          }
        }
      }
    };

    save.addEventListener('click', () => { void savePages(); });
  }

  function warnUnsavedPages(event) {
    event.preventDefault();
    event.returnValue = '';
  }

  async function savePages() {
    if (!owner || !saveReady || saving || loading || !pendingPages.size) return;
    const client = window.pictaSupabase;
    const version = accessVersion;
    const id = owner;
    saving = true;
    saveFailed = false;
    refresh();
    saveStatus.hidden = false;
    saveStatus.textContent = 'Guardando…';
    try {
      while (version === accessVersion && pendingPages.size) {
        const [board, snapshot] = pendingPages.entries().next().value;
        const update = () => client.from('picta_rutinas').update({ casillas: snapshot })
          .eq('cliente_id', id).eq('tablero', board).select('tablero').maybeSingle();
        let result = await update();
        if (result.error) throw result.error;
        if (!result.data && version === accessVersion) {
          result = await client.from('picta_rutinas').insert({ tablero: board, casillas: snapshot });
          if (result.error?.code === '23505' && version === accessVersion) result = await update();
          if (result.error) throw result.error;
        }
        if (pendingPages.get(board) === snapshot) pendingPages.delete(board);
      }
      if (version === accessVersion) {
        window.removeEventListener('beforeunload', warnUnsavedPages);
        saveStatus.textContent = 'Guardado';
      }
    } catch {
      if (version === accessVersion) {
        saveFailed = true;
        saveStatus.textContent = 'Faltan cambios por guardar.';
      }
    } finally {
      if (version === accessVersion) {
        saving = false;
        refresh();
      }
    }
  }

  filters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-sticker-category]');
    if (!button || button.dataset.stickerCategory === category) return;
    clearDrag();
    category = button.dataset.stickerCategory;
    for (const filter of categoryButtons) {
      filter.setAttribute('aria-pressed', String(filter === button));
    }
    bank.scrollTop = 0;
    const availability = refreshBank();
    if (picker) return;
    const selected = selection ? ` Elegiste: ${stickers.get(selection.id).label}.` : '';
    status.textContent = `${button.textContent}: ${availability}.${selected}`;
  });

  function cancelSelection() {
    if (!selection) return;
    const source = selection;
    selection = null;
    refresh();
    status.textContent = 'Selección cancelada.';
    const sourceButton = source.row == null ? bankButtons.get(source.id)
      : rows.querySelector(`[data-row="${source.row}"][data-slot="${source.slot}"]`);
    const focusTarget = pickerTrigger || (sourceButton.closest('[hidden]') ? filters.querySelector('[aria-pressed="true"]') : sourceButton);
    focusTarget.focus();
  }

  cancelSelectionButton.addEventListener('click', cancelSelection);

  function changePage(nextMode) {
    if (!nextMode || nextMode === mode || loading) return false;
    const oldIndex = modeButtons.findIndex((button) => button.dataset.stickerMode === mode);
    const newIndex = modeButtons.findIndex((button) => button.dataset.stickerMode === nextMode);
    mode = nextMode;
    selection = null;
    renderBoard();
    if (pageRail && !reduceMotion.matches) {
      const offset = newIndex > oldIndex ? '14px' : '-14px';
      rows.animate([{ opacity: .6, transform: `translateX(${offset})` }, { opacity: 1, transform: 'none' }],
        { duration: 220, easing: 'cubic-bezier(.2,.7,.2,1)' });
    }
    return true;
  }

  if (pageRail) {
    new ResizeObserver(revealActivePage).observe(pageRail);
    const sheet = rows.closest('.live-board-sheet');
    let swipeStart = null;
    const displacement = (touch) => ({ x: touch.clientX - swipeStart.clientX, y: touch.clientY - swipeStart.clientY });
    const horizontalSwipe = (delta, threshold) => Math.abs(delta.x) >= threshold && Math.abs(delta.x) >= Math.abs(delta.y) * 1.6;
    sheet.addEventListener('touchstart', (event) => {
      swipeStart = event.touches.length === 1 ? event.touches[0] : null;
    }, { passive: true });
    sheet.addEventListener('touchmove', (event) => {
      if (event.touches.length !== 1) {
        swipeStart = null;
        return;
      }
      if (swipeStart && event.cancelable && horizontalSwipe(displacement(event.touches[0]), 12)) event.preventDefault();
    }, { passive: false });
    sheet.addEventListener('touchcancel', () => { swipeStart = null; });
    sheet.addEventListener('touchend', (event) => {
      const touch = Array.from(event.changedTouches).find((point) => point.identifier === swipeStart?.identifier);
      if (!touch) return;
      const delta = displacement(touch);
      swipeStart = null;
      if (!horizontalSwipe(delta, 55)) return;
      if (event.cancelable) event.preventDefault();
      const index = modeButtons.findIndex((button) => button.dataset.stickerMode === mode);
      const next = modeButtons[index + (delta.x < 0 ? 1 : -1)];
      changePage(next?.dataset.stickerMode);
    }, { passive: false });
  }

  workspace.addEventListener('click', (event) => {
    if (suppressDragClick && event.detail > 0) {
      suppressDragClick = false;
      event.preventDefault();
      return;
    }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.discomfort) {
      selectedDiscomfort = button.dataset.discomfort;
      for (const item of rows.querySelectorAll('[data-discomfort]')) item.setAttribute('aria-pressed', String(item === button));
      status.textContent = stickers.get(selectedDiscomfort).label;
      return;
    }
    if (button.dataset.phrase) {
      status.textContent = stickers.get(button.dataset.phrase).label;
      return;
    }
    if (loading || (picker && !saveReady)) return;
    const currentIndex = modeButtons.findIndex((item) => item.dataset.stickerMode === mode);
    const nextMode = button.dataset.stickerMode ||
      (button.hasAttribute('data-diary-step') ? modeButtons[currentIndex + Number(button.dataset.diaryStep)]?.dataset.stickerMode : null);
    if (nextMode) {
      changePage(nextMode);
    } else if (button.dataset.sticker) {
      if (picker?.open) {
        const slot = pickerSlot;
        picker.close();
        if (slot) {
          placeCard(sourceFor(button), slot);
          slot.focus({ preventScroll: true });
        } else {
          selectCard(sourceFor(button));
          focusFirstSlot();
        }
        return;
      }
      selectCard(sourceFor(button));
      if (selection && event.detail === 0) focusFirstSlot();
    } else if (button.dataset.slot != null) {
      const source = sourceFor(button);
      const target = slotLocation(button);
      if (selection && (selection.row !== target.row || selection.slot !== target.slot)) placeCard(selection, button);
      else if (picker) openPicker(button);
      else if (source) selectCard(source);
      else status.textContent = 'Elige un pictograma del banco primero.';
    } else if (button.dataset.done != null) {
      const index = Number(button.dataset.done);
      const row = state[mode][index];
      remember();
      row.done = !row.done;
      commit(`${boards[mode].rows[index][0]} ${row.done ? 'marcada como lista' : 'vuelve a estar pendiente'}.`);
      if (privateBoard && !reduceMotion.matches) {
        const check = button.querySelector('.icon');
        for (const animation of check.getAnimations()) animation.cancel();
        if (row.done) {
          check.animate([
            { strokeDasharray: '28', strokeDashoffset: '28', transform: 'scale(.85)' },
            { strokeDasharray: '28', strokeDashoffset: '0', transform: 'scale(1.18)', offset: .72 },
            { strokeDasharray: '28', strokeDashoffset: '0', transform: 'scale(1)' }
          ], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
        }
      }
    } else if (button === returnButton && selection?.row != null) {
      const { row, slot } = selection;
      returnCard(selection);
      rows.querySelector(`[data-row="${row}"][data-slot="${slot}"]`).focus();
    }
  });

  workspace.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || picker?.open) return;
    if (drag) {
      clearDrag();
      return;
    }
    cancelSelection();
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
    preview.className = privateBoard ? 'sticker-in-hand' : 'sticker-in-hand sticker-demo-drag';
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
    if (loading || picker || mode === 'sensory') return;
    if (drag) return;
    suppressDragClick = false;
    const button = target.closest('[data-sticker], [data-slot][data-content]:not([data-content=""])');
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
    if (privateBoard) return;
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
  if (!privateBoard) workspace.hidden = false;
})();
