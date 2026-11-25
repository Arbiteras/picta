(() => {
  "use strict";

  const client = window.pictaSupabase;
  const shop = window.pictaShop;
  const get = (id) => document.getElementById(id);
  const accountNav = get("dash-account-nav");
  const navTrack = accountNav.querySelector(".dash-tabs");
  const navScroll = accountNav.querySelector(".dash-nav-scroll");
  const accountToggle = get("dash-account-toggle");
  const accountToggleLabel = accountToggle.querySelector("strong");
  const sectionLinks = [...navTrack.querySelectorAll("[data-dash-section]")];
  const accountMenuViewport = window.matchMedia("(max-width: 630px)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let currentTab;
  const gate = get("dash-gate");
  const shell = get("dash-shell");
  const filter = get("dash-state-filter");
  const refreshOrders = get("dash-refresh-orders");
  const orderList = get("dash-order-list");
  const feedback = get("dash-feedback");
  const detail = get("dash-detail");
  const profileForm = get("dash-profile-form");
  const profileName = get("dash-profile-name");
  const avatarDialog = get("dash-avatar-dialog");
  const avatarForm = get("dash-avatar-form");
  const avatarFields = get("dash-avatar-choices");
  const avatarSave = get("dash-avatar-save");
  const avatarCancel = get("dash-avatar-cancel");
  const avatarError = get("dash-avatar-error");
  const avatars = window.pictaAvatar;
  let avatarSaving = false;
  const profileSave = get("dash-save-profile");
  const profileCancel = get("dash-cancel-profile");
  const signout = get("dash-signout");
  const signoutDialog = get("dash-signout-dialog");
  const orderColumns = "id, folio, producto_nombre, precio_unitario_centavos, cantidad, total_con_envio_centavos, estado, creado_en, sandbox, formato, entrega, envio_centavos, pago, compra_id, solicitud_id";
  const pageSize = 6;
  const number = new Intl.NumberFormat("es-BO");
  const dates = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" });
  const statusLabels = {
    pendiente: "Pendiente",
    confirmado: "Confirmado",
    en_preparacion: "En preparación",
    en_camino: "En camino",
    listo_para_recojo: "Listo para recojo",
    entregado: "Entregado",
    cancelado: "Cancelado"
  };

  const url = new URL(window.location.href);
  if (url.hash === "#catalogo" || (!url.hash && url.searchParams.has("producto"))) {
    location.replace("index.html#formatos");
    return;
  }
  let user = null;
  let initialized = false;
  let page = 0;
  let orderRequest = 0;
  let recentRequest = 0;
  let profileRequest = 0;
  let savedName = null;
  let profileSaving = false;
  const sandboxPayments = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };
  let requestVersion = 0;
  let accessVersion = 0;
  let accessTimer;
  let activeAccess = false;
  const boardsView = get("tableros");
  const fullscreenButton = get("dash-fullscreen");
  let boardFallback = false;
  let fullscreenPending = false;
  let previousBoardScroll = 0;
  let expandedBoard = false;
  let accessUntil = 0;

  function make(tag, className = "", content = "") {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = content;
    return element;
  }

  function icon(symbol) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const use = document.createElementNS(svg.namespaceURI, "use");
    svg.setAttribute("class", "icon");
    svg.setAttribute("aria-hidden", "true");
    use.setAttribute("href", "#" + symbol);
    svg.append(use);
    return svg;
  }

  function folio(order) {
    return "#" + String(order.folio).padStart(4, "0");
  }

  function stateBadge(state) {
    const badge = make("span", "dash-state", statusLabels[state] || state);
    badge.dataset.state = state;
    return badge;
  }

  async function showDetail(order) {
    get("dash-detail-title").textContent = "Pedido " + folio(order);
    get("dash-detail-date").textContent = dates.format(new Date(order.creado_en));
    const breakdown = make("dl");
    for (const [label, value] of [
      ["Cantidad", number.format(order.cantidad)],
      ["Precio unitario", shop.money(order.precio_unitario_centavos)],
      ...(order.entrega ? [["Entrega", order.entrega === "envio" ? "Envío" : "Recojo"],
        ["Envío", shop.money(order.envio_centavos)]] : []),
      ...(order.pago ? [[order.compra_id && order.sandbox ? "Pago simulado con tarjeta" : "Pago", sandboxPayments[order.pago]]] : []),
      ["Total del pedido", shop.money(order.total_con_envio_centavos)]
    ]) {
      const row = make("div");
      row.append(make("dt", "", label), make("dd", "", value));
      breakdown.append(row);
    }
    get("dash-detail-meta").replaceChildren(make("strong", "", order.producto_nombre), breakdown);
    const transit = order.entrega === "envio" ? "en_camino" : "listo_para_recojo";
    const steps = order.estado === "cancelado" ? ["cancelado"] : order.formato === "digital"
      ? ["pendiente", "confirmado"] : order.compra_id
        ? ["confirmado", "en_preparacion", transit, "entregado"]
        : ["pendiente", "confirmado", "en_preparacion", "entregado"];
    const timeline = steps.map((state, index) => {
      const step = make("li", "", state === "confirmado" && order.formato === "digital" ? "Acceso activado" : statusLabels[state]);
      if (state === order.estado) step.setAttribute("aria-current", "step");
      if (index < steps.indexOf(order.estado)) step.dataset.done = "";
      return step;
    });
    get("dash-timeline").replaceChildren(...timeline);
    const fulfillment = get("dash-detail-fulfillment");
    fulfillment.textContent = order.formato === "fisico" && order.compra_id && order.sandbox
      ? (order.solicitud_id && order.estado === "confirmado"
        ? "El pedido se prepara cuando termine el diseño. Sigue el progreso en Mis encargos."
        : "Seguimiento de una entrega de prueba.")
      : "";
    const boards = get("dash-detail-boards");
    boards.hidden = order.formato !== "digital" || order.pago !== "aprobado";
    if (!detail.open) detail.showModal();
    get("dash-detail-title").focus();
    if (order.entrega === "envio" && order.compra_id) {
      try {
        const purchase = await shop.payment({ accion: "estado", id: order.compra_id });
        if (breakdown.isConnected && detail.open && purchase.direccion) {
          const row = make("div");
          row.append(make("dt", "", "Dirección"), make("dd", "", purchase.direccion));
          breakdown.append(row);
        }
      } catch { /* Order status is available independently of the address lookup. */ }
    }
  }

  function renderOrder(order) {
    const item = make("li", "dash-order");
    const thumb = make("span", "dash-avatar");
    thumb.setAttribute("aria-hidden", "true");
    const image = shop.formats[order.formato]?.image;
    if (image) {
      const illustration = make("img");
      illustration.src = image;
      illustration.alt = "";
      thumb.dataset.format = order.formato;
      thumb.append(illustration);
    } else thumb.append(icon("dash-box"));
    const caption = make("div");
    caption.append(
      make("p", "dash-order-name", order.producto_nombre),
      make("p", "dash-secondary", folio(order) + " · " + dates.format(new Date(order.creado_en)))
    );
    const open = make("button", "btn btn-outline-primary dash-order-open", "Ver detalle");
    open.type = "button";
    open.setAttribute("aria-label", "Ver detalle del pedido " + folio(order));
    open.addEventListener("click", () => showDetail(order));
    const badge = stateBadge(order.estado);
    if (order.formato === "digital" && order.pago === "aprobado") badge.textContent = "Acceso activado";
    else if (order.estado === "pendiente" && order.pago === "rechazado") badge.textContent = "Pago rechazado";
    item.append(thumb, caption, badge, make("p", "dash-order-price", shop.money(order.total_con_envio_centavos)), open);
    return item;
  }

  function renderSummary(summary = {}) {
    for (const entry of document.querySelectorAll("[data-summary]")) {
      const value = summary[entry.dataset.summary];
      entry.textContent = value == null ? "—" : number.format(value);
    }
  }

  function ordersQuery(options) {
    return client.from("pedidos").select(orderColumns, options)
      .eq("cliente_id", user.id)
      .order("creado_en", { ascending: false })
      .order("folio", { ascending: false });
  }

  async function loadRecent() {
    if (!user) return;
    const request = ++recentRequest;
    const results = get("dash-recent-results");
    const status = get("dash-recent-status");
    const list = get("dash-recent-list");
    const empty = get("dash-recent-empty");
    const retry = get("dash-retry-recent");
    const catalog = get("dash-recent-catalog");
    results.setAttribute("aria-busy", "true");
    list.hidden = retry.hidden = catalog.hidden = true;
    empty.hidden = false;
    status.textContent = "Cargando pedidos…";
    const [orders, summary] = await Promise.all([
      ordersQuery().limit(3),
      client.rpc("resumen_mis_pedidos_picta").single()
    ]);
    if (request !== recentRequest) return;
    results.setAttribute("aria-busy", "false");
    renderSummary(summary.error ? undefined : summary.data);
    if (orders.error) {
      status.textContent = "No pudimos cargar tus pedidos.";
      retry.hidden = false;
    } else if (!orders.data.length) {
      status.textContent = "Todavía no tienes pedidos.";
      catalog.hidden = false;
    } else {
      list.replaceChildren(...orders.data.map(renderOrder));
      list.hidden = false;
      empty.hidden = true;
    }
  }

  function orderEmpty(title, message, catalogLink = false) {
    get("dash-empty-title").textContent = title;
    get("dash-empty-copy").textContent = message;
    get("dash-empty-catalog").hidden = !catalogLink;
    get("dash-order-empty").hidden = false;
  }

  async function loadOrders() {
    if (!user) return;
    const request = ++orderRequest;
    const from = page * pageSize;
    const state = filter.value;
    const results = get("dash-order-results");
    results.setAttribute("aria-busy", "true");
    refreshOrders.disabled = true;
    orderList.hidden = true;
    get("dash-order-pagination").hidden = true;
    orderEmpty("Cargando pedidos…", "");
    const base = ordersQuery({ count: "exact" }).range(from, from + pageSize - 1);
    const [orders, summary] = await Promise.all([
      state === "all" ? base : base.eq("estado", state),
      client.rpc("resumen_mis_pedidos_picta").single()
    ]);
    if (request !== orderRequest) return;
    results.setAttribute("aria-busy", "false");
    refreshOrders.disabled = false;
    renderSummary(summary.error ? undefined : summary.data);
    if (orders.error) {
      if (orders.error.code === "PGRST103" && page > 0) {
        page = 0;
        return loadOrders();
      }
      orderEmpty("No pudimos cargar tus pedidos", "Usa Actualizar para volver a intentarlo.");
      return;
    }
    const pages = Math.max(1, Math.ceil(orders.count / pageSize));
    if (page >= pages) {
      page = pages - 1;
      return loadOrders();
    }
    if (!orders.data.length) {
      if (state === "all") orderEmpty("Todavía no tienes pedidos", "Cuando completes una compra, podrás seguir su estado aquí.", true);
      else orderEmpty("No hay pedidos con este estado", "Elige otro estado para ver más pedidos.");
      return;
    }
    get("dash-order-empty").hidden = true;
    orderList.replaceChildren(...orders.data.map(renderOrder));
    orderList.hidden = false;
    get("dash-order-pagination").hidden = pages === 1;
    get("dash-page").textContent = "Página " + number.format(page + 1) + " de " + number.format(pages);
    get("dash-previous").disabled = page === 0;
    get("dash-next").disabled = page >= pages - 1;
  }

  function currentSection() {
    const name = window.location.hash.slice(1);
    if (["inicio", "pedidos", "perfil", "solicitudes", "tableros"].includes(name)) return name;
    return "inicio";
  }

  function syncAccountOverflow() {
    accountNav.toggleAttribute("data-more-tabs", navScroll.scrollLeft + navScroll.clientWidth < navScroll.scrollWidth - 2);
  }

  function positionAccountTab(animate = false) {
    if (!currentTab || accountNav.hidden || accountMenuViewport.matches || !navTrack.clientWidth) return;
    navTrack.style.setProperty("--nav-pill-x", currentTab.offsetLeft + "px");
    navTrack.style.setProperty("--nav-pill-width", currentTab.offsetWidth + "px");
    navTrack.setAttribute("data-indicator-ready", "");
    syncAccountOverflow();
    const left = currentTab.offsetLeft;
    const right = left + currentTab.offsetWidth;
    if (left < navScroll.scrollLeft + 4 || right > navScroll.scrollLeft + navScroll.clientWidth - 4) {
      navScroll.scrollTo({
        left: left - (navScroll.clientWidth - currentTab.offsetWidth) / 2,
        behavior: animate && !reduceMotion.matches ? "smooth" : "instant",
      });
    }
  }

  const navObserver = new ResizeObserver(() => positionAccountTab());
  navObserver.observe(navScroll);
  navObserver.observe(navTrack);
  navScroll.addEventListener("scroll", syncAccountOverflow, { passive: true });
  document.fonts.ready.then(() => positionAccountTab());

  function accountMenuIsOpen() {
    return accountToggle.getAttribute("aria-expanded") === "true";
  }

  function setAccountMenuOpen(open) {
    accountToggle.setAttribute("aria-expanded", String(open));
  }

  accountToggle.addEventListener("click", () => setAccountMenuOpen(!accountMenuIsOpen()));
  accountMenuViewport.addEventListener("change", () => {
    setAccountMenuOpen(false);
    positionAccountTab();
  });

  function changeSection(focusHeading = false) {
    setAccountMenuOpen(false);
    if (location.hash === "#catalogo") {
      location.replace("index.html#formatos");
      return;
    }
    if (detail.open) detail.close();
    if (!user) {
      setLoginDestination();
      return;
    }
    const view = currentSection();
    if (view !== "perfil" && avatarDialog.open && !avatarSaving) avatarDialog.close();
    if (view !== "tableros") {
      const picker = get("diary-picker");
      if (picker.open) picker.close();
      void exitBoardFullscreen();
    }
    if (view === "solicitudes") void loadRequests();
    if (view === "tableros" || view === "perfil") void loadAccess();
    orderRequest++;
    recentRequest++;
    for (const link of sectionLinks) {
      const name = link.dataset.dashSection;
      get(name).hidden = name !== view;
      if (name === view) {
        currentTab = link;
        accountToggleLabel.textContent = link.textContent.trim();
        link.setAttribute("aria-current", "page");
      } else link.removeAttribute("aria-current");
    }
    positionAccountTab(focusHeading);
    const heading = get(view).querySelector("h1");
    document.title = view === "inicio" ? heading.textContent : heading.textContent + " · Picta";
    if (focusHeading) heading.focus({ preventScroll: true });
    if (view === "inicio") void loadRecent();
    if (view === "pedidos") void loadOrders();
  }

  const requestFormats = { personalizado: "Digital personalizado", fisico: "Cuadernillo personalizado", contacto: "Consulta de contacto" };
  const requestEnvironments = { hogar: "Hogar", escuela: "Escuela", salud: "Salud", ciudad: "Ciudad", otro: "Otro" };
  const requestStates = {
    recibida: "Recibida", cotizada: "Cotizada", en_diseno: "En diseño",
    en_revision: "Lista para revisión", saldo_pendiente: "Saldo pendiente", completada: "Completada"
  };

  function renderRequest(request) {
    const item = make("li");
    const card = make("article", "dash-request");
    item.append(card);
    const selectedPackage = shop.packagesFor(request.formato).find(({ quantity }) => quantity === request.paquete_pictogramas);
    const format = requestFormats[request.formato] || "Encargo personalizado";
    const title = selectedPackage
      ? selectedPackage.name + " · " + (request.formato === "fisico" ? "Picta Físico" : "Picta Digital")
      : format;
    const date = make("time", "dash-secondary", dates.format(new Date(request.creado_en)));
    date.dateTime = request.creado_en;
    const heading = make("div", "dash-request-heading");
    heading.append(make("h3", "", title), date);
    const state = make("span", "dash-state dash-request-state", requestStates[request.estado] || "Estado no disponible");
    state.dataset.state = request.estado;
    const header = make("header", "dash-request-header");
    header.append(heading, state);
    card.append(
      header,
      make("p", "dash-request-description", request.descripcion)
    );
    if (request.formato === "contacto") return item;
    const details = make("dl", "dash-request-details");
    const fields = [];
    if (selectedPackage) fields.push(["Paquete", number.format(selectedPackage.quantity) + " pictogramas"]);
    if (requestEnvironments[request.entorno]) fields.push(["Entorno", requestEnvironments[request.entorno]]);
    if (request.cotizacion_centavos) {
      fields.push([request.compra_id ? "Pago simulado" : "Cotización anterior", shop.money(request.cotizacion_centavos)]);
    }
    for (const [label, value] of fields) {
      const field = make("div");
      field.append(make("dt", "", label), make("dd", "", value));
      details.append(field);
    }
    if (fields.length) card.append(details);
    if (request.estado === "completada" && request.formato === "personalizado" && !selectedPackage) {
      const boardsLink = make("a", "btn btn-outline-primary", "Ir a mis tableros");
      boardsLink.href = "#tableros";
      card.append(boardsLink);
    }
    return item;
  }

  async function loadRequests() {
    if (!user) return;
    const version = ++requestVersion;
    const status = get("dash-requests-status");
    const results = get("dash-requests-results");
    const list = get("dash-requests-list");
    const empty = get("dash-requests-empty");
    const failure = get("dash-requests-error");
    const retry = get("dash-retry-requests");
    const retryHadFocus = document.activeElement === retry;
    results.setAttribute("aria-busy", "true");
    retry.disabled = true;
    empty.hidden = true;
    status.textContent = "Cargando historial…";
    try {
      const { data, error } = await client.from("picta_solicitudes").select()
        .eq("cliente_id", user.id).order("creado_en", { ascending: false });
      if (version !== requestVersion) return;
      if (error) throw error;
      list.replaceChildren(...data.map(renderRequest));
      list.hidden = !data.length;
      empty.hidden = Boolean(data.length);
      failure.hidden = true;
      status.textContent = data.length ? number.format(data.length) + (data.length === 1 ? " registro" : " registros") : "Sin registros";
      if (retryHadFocus && currentSection() === "solicitudes") get("dash-requests-history-title").focus({ preventScroll: true });
    } catch {
      if (version !== requestVersion) return;
      status.textContent = "No pudimos cargar el historial.";
      failure.hidden = false;
      if (retryHadFocus && currentSection() === "solicitudes") {
        retry.disabled = false;
        retry.focus({ preventScroll: true });
      }
    } finally {
      if (version === requestVersion) {
        retry.disabled = false;
        results.setAttribute("aria-busy", "false");
      }
    }
    get("dash-requests-list").replaceChildren(...data.map(renderRequest));
    status.textContent = data.length ? "" : "Aún no tienes solicitudes.";
  }

  function syncBoardFullscreen() {
    const expanded = boardFallback || document.fullscreenElement === boardsView;
    document.body.classList.toggle("dash-board-expanded", expanded);
    boardsView.classList.toggle("board-fullscreen-fallback", boardFallback);
    fullscreenButton.setAttribute("aria-pressed", String(expanded));
    const label = boardFallback ? "Salir de vista amplia" : expanded ? "Salir de pantalla completa" : "Pantalla completa";
    fullscreenButton.setAttribute("aria-label", label);
    fullscreenButton.title = label;
    if (expanded !== expandedBoard) {
      if (expanded) {
        boardsView.scrollTop = 0;
      } else {
        window.scrollTo({ top: previousBoardScroll, behavior: "instant" });
      }
      expandedBoard = expanded;
    }
  }

  async function exitBoardFullscreen() {
    boardFallback = false;
    if (document.fullscreenElement === boardsView) {
      try { await document.exitFullscreen(); } catch { /* Reconcile with the browser state below. */ }
    }
    syncBoardFullscreen();
  }

  async function toggleBoardFullscreen() {
    if (!activeAccess || currentSection() !== "tableros" || fullscreenPending) return;
    fullscreenPending = true;
    try {
      if (expandedBoard) {
        await exitBoardFullscreen();
        return;
      }
      previousBoardScroll = window.scrollY;
      if (document.fullscreenEnabled && typeof boardsView.requestFullscreen === "function") {
        try { await boardsView.requestFullscreen(); } catch { /* The in-page view also works on tablets. */ }
      }
      if (!activeAccess || currentSection() !== "tableros") {
        await exitBoardFullscreen();
        return;
      }
      boardFallback = document.fullscreenElement !== boardsView;
      syncBoardFullscreen();
    } finally {
      fullscreenPending = false;
    }
  }

  function showBoardAccess(enabled) {
    activeAccess = enabled;
    window.pictaBoards?.setAccess(enabled ? user.id : null);
    get("dash-buy-access").hidden = enabled;
    if (!enabled) {
      void exitBoardFullscreen();
    }
  }

  async function loadAccess() {
    if (!user) return;
    const version = ++accessVersion;
    const owner = user.id;
    const status = get("dash-access-status");
    const profilePlan = get("dash-profile-plan");
    const retry = get("dash-retry-access");
    retry.hidden = true;
    status.textContent = "Consultando tu plan…";
    const { data, error } = await client.from("picta_accesos").select("formato, vence_en").eq("cliente_id", owner).maybeSingle();
    if (version !== accessVersion) return;
    clearTimeout(accessTimer);
    if (error) {
      accessUntil = 0;
      showBoardAccess(false);
      status.textContent = profilePlan.textContent = "No pudimos comprobar tu acceso.";
      retry.hidden = false;
      return;
    }
    const expires = data ? new Date(data.vence_en) : null;
    accessUntil = expires?.getTime() || 0;
    showBoardAccess(accessUntil > Date.now());
    const plan = data?.formato === "personalizado" ? "Acceso digital personalizado" : "Picta Esencial";
    status.textContent = profilePlan.textContent = activeAccess
      ? plan + " activo hasta el " + dates.format(expires) + "."
      : data ? "Tu acceso venció. Las rutinas volverán a estar disponibles al renovar." : "Activa Picta Esencial para abrir las ocho páginas de tu cuadernillo digital.";
    if (activeAccess) accessTimer = setTimeout(() => {
      if (accessUntil <= Date.now()) showBoardAccess(false);
      void loadAccess();
    }, Math.min(2147483647, accessUntil - Date.now() + 50));
  }

  function renderIdentity(name = "") {
    if (user && name) window.dispatchEvent(new CustomEvent("picta:profile", { detail: { id: user.id, name } }));
    const initial = Array.from(name || user?.email || "P")[0].toLocaleUpperCase("es-BO");
    for (const avatar of document.querySelectorAll("[data-dash-initial]")) avatar.textContent = initial;
    renderAvatar();
  }

  function selectedAvatar() {
    const id = user?.user_metadata?.picta_avatar;
    return avatars.choices.has(id) ? id : "";
  }

  function renderAvatar() {
    const image = get("dash-avatar-image");
    const src = avatars.src(selectedAvatar());
    if (src && image.getAttribute("src") !== src) image.src = src;
    image.hidden = !src;
    image.previousElementSibling.hidden = Boolean(src);
  }

  function syncAvatarForm() {
    avatarFields.disabled = avatarSaving;
    avatarCancel.disabled = avatarSaving;
    avatarSave.disabled = avatarSaving || avatarForm.elements.sticker.value === selectedAvatar();
    avatarSave.textContent = avatarSaving ? "Guardando…" : "Guardar avatar";
    avatarForm.setAttribute("aria-busy", String(avatarSaving));
  }

  function openAvatarDialog() {
    if (!user || avatarSaving) return;
    if (!avatarFields.querySelector("input")) {
      for (const [id, name] of [["", "Inicial"], ...avatars.choices]) {
        const label = make("label", "dash-avatar-choice");
        const input = make("input", "visually-hidden");
        input.type = "radio";
        input.name = "sticker";
        input.value = id;
        const tile = make("span");
        if (id) {
          const image = make("img");
          image.src = avatars.src(id);
          image.alt = "";
          image.width = image.height = 48;
          tile.append(image);
        }
        tile.append(name);
        label.append(input, tile);
        avatarFields.append(label);
      }
    }
    avatarForm.elements.sticker.value = selectedAvatar();
    avatarError.hidden = true;
    syncAvatarForm();
    avatarDialog.showModal();
    get("dash-avatar-title").focus();
  }

  async function saveAvatar(event) {
    event.preventDefault();
    if (!user || avatarSaving || avatarSave.disabled) return;
    const id = user.id;
    const sticker = avatarForm.elements.sticker.value;
    if (sticker && !avatars.choices.has(sticker)) return;
    avatarSaving = true;
    avatarError.hidden = true;
    syncAvatarForm();
    try {
      const { data, error } = await client.auth.updateUser({ data: { picta_avatar: sticker || null } });
      if (id !== user?.id) return;
      if (error || !data?.user) throw error || new Error("Avatar sin confirmar");
      user = data.user;
      renderAvatar();
      avatarDialog.close();
      get("dash-avatar-status").textContent = "Avatar actualizado.";
    } catch {
      if (id !== user?.id) return;
      avatarError.hidden = false;
      avatarError.textContent = "No pudimos guardar el avatar. Intenta de nuevo.";
    } finally {
      avatarSaving = false;
      syncAvatarForm();
      if (avatarDialog.open) avatarSave.focus();
    }
  }

  function profileDirty() {
    return savedName !== null && profileName.value.trim() !== savedName;
  }

  function warnUnsaved(event) {
    event.preventDefault();
    event.returnValue = "";
  }

  function syncProfileForm() {
    const dirty = profileDirty();
    profileName.disabled = savedName === null;
    profileName.readOnly = profileSaving;
    profileSave.disabled = profileCancel.disabled = !dirty || profileSaving;
    signout.disabled = profileSaving;
    if (dirty) window.addEventListener("beforeunload", warnUnsaved);
    else window.removeEventListener("beforeunload", warnUnsaved);
  }

  async function loadProfile() {
    if (!user) return;
    const request = ++profileRequest;
    const id = user.id;
    get("dash-retry-profile").hidden = true;
    profileForm.setAttribute("aria-busy", "true");
    get("dash-profile-error").textContent = "";
    get("dash-profile-status").textContent = "Cargando tu perfil…";
    const { data, error } = await client.from("clientes").select("nombre, correo, creado_en").eq("id", id).single();
    if (request !== profileRequest) return;
    get("dash-profile-status").textContent = "";
    profileForm.setAttribute("aria-busy", "false");
    if (error || !data) {
      get("dash-profile-error").textContent = "No pudimos cargar tu perfil.";
      get("dash-retry-profile").hidden = false;
      return;
    }
    const created = data.creado_en || user.created_at;
    get("dash-profile-date").textContent = created ? dates.format(new Date(created)) : "—";
    get("dash-profile-email").textContent = data.correo || user.email || "—";
    profileName.value = savedName = data.nombre || "";
    renderIdentity(savedName);
    syncProfileForm();
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!user || !profileDirty() || profileSaving) return;
    const nombre = profileName.value.trim();
    if (!nombre || nombre.length > 100) {
      profileName.setAttribute("aria-invalid", "true");
      get("dash-profile-name-error").hidden = false;
      profileName.focus();
      return;
    }
    const request = ++profileRequest;
    const status = get("dash-profile-status");
    const errorMessage = get("dash-profile-error");
    profileSaving = true;
    syncProfileForm();
    status.textContent = "Guardando cambios…";
    errorMessage.textContent = "";
    profileForm.setAttribute("aria-busy", "true");
    const { data, error } = await client.from("clientes").update({ nombre }).eq("id", user.id).select("nombre").single();
    if (request !== profileRequest) return;
    profileSaving = false;
    profileForm.setAttribute("aria-busy", "false");
    status.textContent = "";
    if (error || !data) {
      errorMessage.textContent = "No pudimos guardar los cambios. Vuelve a intentarlo.";
    } else {
      profileName.value = savedName = data.nombre;
      renderIdentity(savedName);
      status.textContent = "Guardamos tu nombre.";
    }
    syncProfileForm();
  }

  async function closeSession() {
    if (!user || signout.disabled) return;
    const id = user.id;
    signout.disabled = true;
    feedback.textContent = "Cerrando sesión…";
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) {
      if (user?.id === id) {
        signout.disabled = false;
        feedback.textContent = "No pudimos cerrar tu sesión. Vuelve a intentarlo.";
      }
      return;
    }
    await useSession(null);
    window.location.replace("index.html");
  }

  function setLoginDestination() {
    const loginUrl = new URL("index.html", url);
    loginUrl.searchParams.set("cuenta", currentSection());
    get("dash-login").href = loginUrl.href;
  }

  function showGate(message, { login = false, retry = false } = {}) {
    setAccountMenuOpen(false);
    shell.hidden = true;
    accountNav.hidden = true;
    navTrack.removeAttribute("data-indicator-ready");
    gate.hidden = false;
    get("dash-gate-message").textContent = message;
    get("dash-login").hidden = !login;
    get("dash-session-retry").hidden = !retry;
    setLoginDestination();
    document.title = "Mi espacio Picta";
  }

  async function useSession(session) {
    const next = session?.user || null;
    if (initialized && next?.id === user?.id) {
      user = next;
      renderAvatar();
      return;
    }
    initialized = true;
    user = next;
    if (avatarDialog.open) avatarDialog.close();
    get("dash-avatar-status").textContent = "";
    orderRequest++;
    recentRequest++;
    profileRequest++;
    requestVersion++;
    accessVersion++;
    clearTimeout(accessTimer);
    accessUntil = 0;
    showBoardAccess(false);
    get("dash-requests-list").replaceChildren();
    get("dash-requests-list").hidden = true;
    get("dash-requests-empty").hidden = true;
    get("dash-requests-error").hidden = true;
    savedName = null;
    profileSaving = false;
    profileName.value = "";
    profileName.removeAttribute("aria-invalid");
    profileForm.setAttribute("aria-busy", "false");
    get("dash-profile-name-error").hidden = true;
    get("dash-profile-status").textContent = "";
    get("dash-profile-error").textContent = "";
    get("dash-retry-profile").hidden = true;
    get("dash-profile-email").textContent = user?.email || "—";
    get("dash-profile-date").textContent = "—";
    if (signoutDialog.open) signoutDialog.close();
    syncProfileForm();
    page = 0;
    filter.value = "all";
    renderSummary();
    orderList.replaceChildren();
    get("dash-recent-list").replaceChildren();
    get("dash-detail-meta").replaceChildren();
    get("dash-detail-title").textContent = "";
    get("dash-detail-date").textContent = "";
    get("dash-timeline").replaceChildren();
    renderIdentity();
    feedback.textContent = "";
    if (detail.open) detail.close();
    if (!user) {
      showGate("Inicia sesión para acceder a tu perfil, consultar tus pedidos y explorar el catálogo.", { login: true });
      return;
    }
    gate.hidden = true;
    shell.hidden = false;
    accountNav.hidden = false;
    changeSection();
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("clave") === "actualizada") {
      feedback.textContent = "Cambiaste tu contraseña.";
      currentUrl.searchParams.delete("clave");
      history.replaceState(history.state, "", currentUrl);
    }
    void loadProfile();
  }

  async function checkSession() {
    if (!user) showGate("Estamos comprobando tu sesión.");
    const { data, error } = await client.auth.getSession();
    if (error) {
      await useSession(null);
      showGate("No pudimos comprobar tu sesión.", { login: true, retry: true });
    } else {
      await useSession(data.session);
      if (!data.session) showGate("Inicia sesión para acceder a tu perfil, consultar tus pedidos y explorar el catálogo.", { login: true });
    }
  }

  get("dash-detail-boards").addEventListener("click", () => detail.close());
  document.addEventListener("click", (event) => {
    if (accountMenuIsOpen() && !accountNav.contains(event.target)) setAccountMenuOpen(false);
    if (!user || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const link = event.target.closest('a[href^="#"]');
    if (!link || !sectionLinks.some((tab) => tab.hash === link.hash)) return;
    event.preventDefault();
    if (location.hash !== link.hash) {
      history.pushState(null, "", link.hash);
      changeSection(true);
    } else if (accountMenuIsOpen()) {
      setAccountMenuOpen(false);
      accountToggle.focus({ preventScroll: true });
    }
    document.dispatchEvent(new Event("picta:account-section"));
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  window.addEventListener("hashchange", () => changeSection(true));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && user && activeAccess && accessUntil <= Date.now()) {
      showBoardAccess(false);
      void loadAccess();
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && client) void checkSession();
  });
  filter.addEventListener("change", () => { page = 0; void loadOrders(); });
  refreshOrders.addEventListener("click", () => { void loadOrders(); });
  get("dash-previous").addEventListener("click", () => { if (page > 0) { page--; void loadOrders(); } });
  get("dash-next").addEventListener("click", () => { page++; void loadOrders(); });
  get("dash-retry-recent").addEventListener("click", () => { void loadRecent(); });
  get("dash-retry-profile").addEventListener("click", () => { void loadProfile(); });
  profileName.addEventListener("input", () => {
    profileName.removeAttribute("aria-invalid");
    get("dash-profile-name-error").hidden = true;
    get("dash-profile-status").textContent = "";
    get("dash-profile-error").textContent = "";
    syncProfileForm();
  });
  profileCancel.addEventListener("click", () => {
    profileName.value = savedName;
    profileName.dispatchEvent(new Event("input"));
    profileName.focus();
  });
  profileForm.addEventListener("submit", (event) => { void saveProfile(event); });
  get("dash-avatar-open").addEventListener("click", openAvatarDialog);
  avatarForm.addEventListener("change", syncAvatarForm);
  avatarForm.addEventListener("submit", (event) => { void saveAvatar(event); });
  avatarCancel.addEventListener("click", () => avatarDialog.close());
  avatarDialog.addEventListener("cancel", (event) => { if (avatarSaving) event.preventDefault(); });
  signout.addEventListener("click", () => {
    if (!profileDirty()) {
      void closeSession();
      return;
    }
    signoutDialog.returnValue = "";
    signoutDialog.showModal();
  });
  signoutDialog.addEventListener("close", () => {
    if (signoutDialog.returnValue === "signout") void closeSession();
  });
  get("dash-session-retry").addEventListener("click", () => { void checkSession(); });
  get("dash-retry-requests").addEventListener("click", () => { void loadRequests(); });
  get("dash-retry-access").addEventListener("click", () => { void loadAccess(); });
  fullscreenButton.addEventListener("click", () => { void toggleBoardFullscreen(); });
  document.addEventListener("fullscreenchange", syncBoardFullscreen);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.defaultPrevented && accountMenuIsOpen()) {
      event.preventDefault();
      setAccountMenuOpen(false);
      accountToggle.focus({ preventScroll: true });
      return;
    }
    if (event.key === "Escape" && boardFallback && !boardsView.querySelector("dialog[open]")) {
      void exitBoardFullscreen();
    }
  });
  detail.querySelector("[data-close-dialog]").addEventListener("click", () => detail.close());

  if (!client) {
    showGate("No pudimos conectar con tu cuenta. Vuelve a cargar la página para intentarlo otra vez.");
    return;
  }
  client.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => { void useSession(session); }, 0);
  });
})();
