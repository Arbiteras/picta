(() => {
  "use strict";
  const shop = window.pictaShop;
  const client = window.pictaSupabase;
  const get = (id) => document.getElementById(id);
  const form = get("cart-checkout");
  const state = new URL(location.href);
  let cart = shop.readCart();
  const recentlyAdded = new Set();
  let products = [];
  let session;
  let digitalActive = false;
  const requested = state.searchParams.get("compra");
  let pending = /^[a-f0-9-]{36}$/i.test(requested || "") ? requested : null;
  let draftId;
  let busy = false;
  let cardAttempt;
  const cardForm = get("cart-card-form");
  const cardFields = get("cart-card-fields");
  const cardHolder = get("card-holder");
  const cardNumber = get("card-number");
  const cardExpiry = get("card-expiry");
  const cardCvc = get("card-cvc");
  const cardInputs = [cardHolder, cardNumber, cardExpiry, cardCvc];
  const notesKey = "picta.cart.notes.v1";
  const notes = new Map();
  try {
    for (const [sku, text] of Object.entries(JSON.parse(sessionStorage.getItem(notesKey) || "{}"))) {
      if (shop.validSku(sku) && typeof text === "string") notes.set(sku, text.slice(0, 600));
    }
  } catch { /* Package details can be entered again in the cart. */ }

  function storeNotes() {
    try { sessionStorage.setItem(notesKey, JSON.stringify(Object.fromEntries(notes))); } catch { /* Keep in memory. */ }
  }
  const status = get("cart-status");
  const resultStatus = get("cart-payment-status");

  const messages = {
    precio_actualizado: "Los precios cambiaron. Recarga el catálogo y revisa el nuevo total.",
    producto_no_disponible: "Un producto ya no está disponible. Revisa el carrito.",
    inicia_sesion: "Inicia sesión para continuar.",
    entrega_incompleta: "Revisa la dirección de entrega.",
    personalizacion_incompleta: "Describe qué quieres representar en cada paquete.",
    compra_no_encontrada: "No encontramos esta compra en tu cuenta.",
    pago_cerrado: "El pago ya se resolvió o venció. Consulta el estado antes de iniciar otro.",
    acceso_digital_activo: "Ya tienes Picta Esencial activo. Puedes volver al carrito y continuar con los demás productos.",
    paquete_digital_no_disponible: "Picta Digital ya se ofrece sin paquetes adicionales. Vuelve al carrito para revisar tu compra.",
  };
  const paymentLabels = { pendiente: "Pendiente de pago", pagada: "Pago confirmado",
    rechazada: "Pago rechazado", vencida: "Pago vencido" };

  function storeCart() {
    try { shop.writeCart(cart); } catch { /* The current tab can still check out. */ }
  }

  function removeActivePlan() {
    if (!digitalActive || !cart.digital) return false;
    delete cart.digital;
    draftId = undefined;
    storeCart();
    return true;
  }

  function renderCartWithAccess() {
    const removed = !pending && removeActivePlan();
    render();
    if (removed) status.textContent = "Ya tienes Picta Esencial activo. Quitamos el plan de tu carrito.";
  }

  function make(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content != null) element.textContent = content;
    return element;
  }

  function item(sku, quantity) {
    const [format, count] = sku.split("-");
    const product = products.find((row) => row.formato === format);
    if (!product) return { sku, format, name: "Producto no disponible", quantity, unavailable: true };
    const pack = shop.packagesFor(format).find((option) => String(option.quantity) === count);
    return {
      sku, format, quantity, pack,
      name: pack ? `${pack.name} · ${shop.formats[format].label}` : product.nombre,
      cents: pack?.cents ?? product.precio_centavos,
    };
  }

  function renderItem(line) {
    const row = make("li", "purchase-item");
    const heading = make("div", "purchase-row");
    const title = make("div", "purchase-item-title");
    title.append(make("strong", "", line.name));
    if (!line.unavailable && recentlyAdded.has(line.sku)) {
      title.append(make("span", "purchase-recent", "Recién agregado"));
    }
    heading.append(title);
    if (!line.unavailable) heading.append(make("strong", "", shop.money(line.cents * line.quantity)));
    const image = make("img", "purchase-thumb");
    image.src = shop.formats[line.format].image;
    image.alt = "";
    image.width = image.height = 64;
    image.dataset.format = line.format;
    const content = make("div", "purchase-item-content");
    content.append(heading);
    row.append(image, content);
    const controls = make("div", "purchase-item-controls");
    if (line.sku === "fisico" && !line.unavailable) {
      const label = make("label", "", "Cantidad");
      const input = make("input", "form-control d-inline-block");
      input.type = "number";
      input.min = 1;
      input.max = shop.maxBooklets;
      input.required = true;
      input.value = line.quantity;
      input.addEventListener("change", () => {
        if (!input.validity.valid) {
          input.reportValidity();
          input.value = line.quantity;
          return;
        }
        cart[line.sku] = input.valueAsNumber;
        draftId = undefined;
        storeCart();
        render();
        get("cart-items").querySelector('input[type="number"]')?.focus({ preventScroll: true });
      });
      label.append(input);
      controls.append(label);
    }
    const remove = make("button", "btn btn-link", "Quitar");
    remove.type = "button";
    remove.setAttribute("aria-label", "Quitar " + line.name);
    remove.addEventListener("click", () => {
      delete cart[line.sku];
      recentlyAdded.delete(line.sku);
      notes.delete(line.sku);
      storeNotes();
      draftId = undefined;
      storeCart();
      render();
      get("cart-items").querySelector("button")?.focus();
    });
    controls.append(remove);
    content.append(controls);
    if (line.pack) {
      const label = make("label", "purchase-item-note", `${line.pack.quantity} pictogramas · ¿Qué quieres representar?`);
      label.htmlFor = "cart-note-" + line.sku;
      const note = make("textarea", "form-control");
      note.id = label.htmlFor;
      note.required = true;
      note.maxLength = 600;
      note.rows = 2;
      note.placeholder = "Describe actividades en general, sin nombres ni datos personales.";
      note.value = notes.get(line.sku) || "";
      note.addEventListener("input", () => { notes.set(line.sku, note.value); storeNotes(); draftId = undefined; });
      content.append(label, note);
    }
    return row;
  }

  function totals(lines = Object.entries(cart).map(([sku, n]) => item(sku, n))) {
    const physical = lines.some((line) => line.format === "fisico" && !line.unavailable);
    const delivery = physical ? form.elements.entrega.value : null;
    const address = delivery === "envio";
    const shipping = address ? shop.shipping : 0;
    const subtotal = lines.reduce((sum, line) => sum + (line.cents || 0) * line.quantity, 0);
    get("cart-delivery-field").hidden = !physical;
    get("cart-address-field").hidden = !address;
    get("cart-address").hidden = get("cart-address").disabled = !address;
    get("cart-address").required = address;
    get("cart-shipping-line").hidden = !address;
    get("cart-subtotal").textContent = shop.money(subtotal);
    get("cart-shipping").textContent = shop.money(shipping);
    get("cart-total").textContent = shop.money(subtotal + shipping);
    return { total: subtotal + shipping, delivery };
  }

  function render() {
    if (!pending && products.length) {
      for (const sku of shop.takeRecentCartItems()) recentlyAdded.add(sku);
    }
    const lines = Object.entries(cart).map(([sku, n]) => item(sku, n));
    get("cart-items").replaceChildren(...lines.map(renderItem));
    form.hidden = Boolean(pending) || !lines.length;
    get("cart-payment").hidden = !pending;
    get("cart-login").hidden = Boolean(session);
    get("cart-submit").hidden = !session;
    get("cart-submit").disabled = busy || lines.some((line) => line.unavailable);
    if (!pending) {
      status.textContent = "";
      showStep("cart");
    }
    get("cart-empty").hidden = Boolean(pending) || Boolean(lines.length);
    totals(lines);
  }

  function showStep(step) {
    const main = get("purchase-title").closest("main");
    const changed = main.dataset.step !== step;
    main.dataset.step = step;
    const copy = {
      cart: ["Tu carrito", "Revisa tus productos y elige cómo recibirlos."],
      card: ["Finaliza tu compra", "Revisa el total y paga con tarjeta."],
      done: ["¡Gracias por tu compra!", "Tu pago quedó registrado y puedes seguir cada producto desde tu cuenta."],
    };
    const [title, description] = copy[step];
    get("purchase-title").textContent = title;
    get("purchase-lead").textContent = description;
    if (changed) window.scrollTo({ top: 0, behavior: "instant" });
  }

  function paintPayment(data) {
    const waiting = data.estado === "pendiente";
    const paid = data.estado === "pagada";
    const declined = waiting && data.resultado === "rechazado";
    const digital = data.lineas.some((line) => line.formato === "digital" && !line.paquete);
    const retiredExtra = waiting && data.lineas.some((line) => line.formato === "digital" && line.paquete);
    const blocked = waiting && digital && digitalActive;
    const physical = Boolean(data.entrega);
    const custom = data.lineas.some((line) => line.paquete);
    showStep(paid ? "done" : "card");
    resultStatus.dataset.tone = paid ? "success" : waiting && !declined && !blocked && !retiredExtra ? "" : "error";
    resultStatus.textContent = retiredExtra ? messages.paquete_digital_no_disponible : blocked ? messages.acceso_digital_activo : paid ? "Pago confirmado en sandbox" : declined
      ? "El intento anterior fue rechazado. Revisa los datos e intenta de nuevo."
      : waiting ? "" : paymentLabels[data.estado];
    get("cart-payment-summary").hidden = false;
    get("cart-payment-total").textContent = shop.money(data.total);
    const delivery = get("cart-payment-delivery");
    delivery.hidden = !physical;
    delivery.textContent = data.entrega === "envio" ? "Envío a " + data.direccion : "Recojo sin costo";
    get("cart-pay").textContent = "Pagar " + shop.money(data.total);
    const shipping = get("cart-payment-shipping");
    shipping.hidden = !data.envio;
    shipping.querySelector("dd").textContent = shop.money(data.envio);
    get("cart-payment-lines").replaceChildren(...data.lineas.map((line) => {
      const row = make("li", "purchase-row purchase-summary-line");
      row.append(make("span", "", line.nombre + (line.cantidad > 1 ? " × " + line.cantidad : "")),
        make("strong", "", shop.money(line.precio_centavos * line.cantidad)));
      return row;
    }));
    cardForm.hidden = !waiting || blocked || retiredExtra;
    get("cart-check-payment").hidden = true;
    get("cart-open-boards").hidden = !blocked && (!paid || !digital);
    get("cart-view-orders").hidden = !paid || (!physical && !digital);
    get("cart-view-requests").hidden = !paid || !custom;
    get("cart-try-again").hidden = paid;
    const fulfillment = get("cart-fulfillment");
    fulfillment.hidden = !paid;
    fulfillment.replaceChildren(...[
      digital && "Picta Esencial ya está disponible en Mis tableros.",
      physical && (data.entrega === "envio" ? "Sigue la preparación y el envío desde Mis pedidos." :
        "Consulta en Mis pedidos cuándo estará listo para recojo."),
      custom && "Sigue el diseño de tus pictogramas en Mis solicitudes."
    ].filter(Boolean).map((message) => make("li", "", message)));
    if (paid) {
      resetCardForm();
      try {
        const saved = JSON.parse(sessionStorage.getItem("picta.checkout.v1") || "null");
        if (saved?.id === data.id && saved.cart === JSON.stringify(shop.readCart())) {
          cart = {};
          storeCart();
          notes.clear();
          sessionStorage.removeItem("picta.checkout.v1");
          sessionStorage.removeItem(notesKey);
        }
      } catch { /* The confirmation is persisted independently of browser storage. */ }
      void historyList();
    }
  }

  async function checkPayment() {
    if (!pending || busy) return;
    showStep("card");
    resultStatus.textContent = "Consultando el pago…";
    try {
      paintPayment(await shop.payment({ accion: "estado", id: pending }));
    } catch (error) {
      resultStatus.dataset.tone = "error";
      resultStatus.textContent = messages[error.message] || "No pudimos consultar el pago. Intenta de nuevo.";
      get("cart-check-payment").hidden = false;
      get("cart-try-again").hidden = false;
    }
  }

  function setCardError(input, message = "") {
    const error = get(input.id + "-error");
    error.textContent = message;
    error.hidden = !message;
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }

  function resetCardForm() {
    cardForm.reset();
    for (const input of cardInputs) setCardError(input);
  }

  for (const input of cardInputs) input.addEventListener("input", () => setCardError(input));
  cardNumber.addEventListener("input", () => {
    cardNumber.value = cardNumber.value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})(?=.)/g, "$1 ");
  });
  cardExpiry.addEventListener("input", () => {
    const digits = cardExpiry.value.replace(/\D/g, "").slice(0, 4);
    cardExpiry.value = digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
  });
  cardCvc.addEventListener("input", () => {
    cardCvc.value = cardCvc.value.replace(/\D/g, "").slice(0, 4);
  });
  cardForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !pending || !session || cardForm.hidden) return;
    const [month, year] = cardExpiry.value.split("/").map(Number);
    const expiryIsValid = /^\d{2}\/\d{2}$/.test(cardExpiry.value) && month >= 1 && month <= 12 &&
      new Date(2000 + year, month, 1) > new Date();
    const checks = [
      [cardHolder, cardHolder.value.trim() !== "", "Ingresa el nombre del titular."],
      [cardNumber, /^\d{12,19}$/.test(cardNumber.value.replace(/\s/g, "")), "Ingresa entre 12 y 19 dígitos."],
      [cardExpiry, expiryIsValid, "Ingresa un mes y un año vigentes en formato MM/AA."],
      [cardCvc, /^\d{3,4}$/.test(cardCvc.value), "Ingresa 3 o 4 dígitos."]
    ];
    for (const [input, valid, message] of checks) setCardError(input, valid ? "" : message);
    const invalid = checks.find(([, valid]) => !valid);
    if (invalid) {
      invalid[0].focus();
      return;
    }
    cardAttempt ||= crypto.randomUUID();
    resetCardForm();
    busy = true;
    cardForm.setAttribute("aria-busy", "true");
    cardFields.disabled = true;
    get("cart-try-again").disabled = true;
    resultStatus.dataset.tone = "";
    resultStatus.textContent = "Procesando tu pago…";
    try {
      const data = await shop.payment({ accion: "pagar_tarjeta", id: pending, intento: cardAttempt });
      cardAttempt = undefined;
      paintPayment(data);
      if (data.estado === "pagada") get("purchase-title").focus({ preventScroll: true });
      else if (data.estado === "pendiente") get("card-holder").focus();
    } catch (error) {
      resultStatus.dataset.tone = "error";
      resultStatus.textContent = messages[error.message] || "No pudimos confirmar el pago. Intenta de nuevo o consulta el estado.";
      if (error.message === "acceso_digital_activo") {
        digitalActive = true;
        cardForm.hidden = true;
        get("cart-open-boards").hidden = false;
      } else if (error.message === "paquete_digital_no_disponible") {
        cardForm.hidden = true;
      } else get("cart-check-payment").hidden = false;
    } finally {
      busy = false;
      cardForm.removeAttribute("aria-busy");
      cardFields.disabled = false;
      get("cart-try-again").disabled = false;
    }
  });

  async function historyList() {
    if (!session) return;
    const { data, error } = await client.from("picta_compras")
      .select("id,total_centavos,estado,creado_en,vence_en").order("creado_en", { ascending: false }).limit(12);
    if (error || !data.length) return;
    get("cart-history").hidden = false;
    get("cart-history-items").replaceChildren(...data.map((purchase) => {
      const row = make("li", "purchase-item purchase-row");
      const expired = purchase.estado === "pendiente" && Date.parse(purchase.vence_en) <= Date.now();
      const label = expired ? "Pago vencido" : paymentLabels[purchase.estado];
      const link = make("a", "btn btn-outline-primary", purchase.estado === "pendiente" && !expired ? "Continuar pago" : "Ver compra");
      link.href = "?compra=" + purchase.id;
      row.append(make("span", "", `${shop.money(purchase.total_centavos)} · ${label}`), link);
      return row;
    }));
  }

  form.addEventListener("input", () => { draftId = undefined; totals(); });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy || !session || !Object.keys(cart).length) return;
    const { total, delivery } = totals();
    const lineas = Object.entries(cart).map(([sku, cantidad]) => ({ sku, cantidad, detalle: notes.get(sku) || null }));
    if (lineas.some((line) => line.sku.includes("-") && !line.detalle?.trim())) {
      status.textContent = messages.personalizacion_incompleta;
      return;
    }
    if (!globalThis.crypto?.randomUUID) {
      status.textContent = "Abre la tienda en HTTPS o localhost para iniciar el pago.";
      return;
    }
    draftId ||= crypto.randomUUID();
    busy = true;
    get("cart-submit").disabled = true;
    status.textContent = "Preparando el pago…";
    try {
      const data = await shop.payment({
        accion: "crear", id: draftId, lineas, total, entrega: delivery,
        direccion: delivery === "envio" ? get("cart-address").value : null,
      });
      pending = data.id;
      try { sessionStorage.setItem("picta.checkout.v1", JSON.stringify({ id: pending, cart: JSON.stringify(cart) })); }
      catch { /* The account can still resume payment from purchase history. */ }
      state.searchParams.set("compra", pending);
      history.replaceState(null, "", state);
      status.textContent = "";
      render();
      paintPayment(data);
      get("purchase-title").focus({ preventScroll: true });
    } catch (error) {
      if (error.message === "acceso_digital_activo") {
        digitalActive = true;
        renderCartWithAccess();
      } else status.textContent = messages[error.message] || "No pudimos iniciar el pago. Intenta de nuevo.";
    } finally {
      busy = false;
      get("cart-submit").disabled = false;
    }
  });
  get("cart-check-payment").addEventListener("click", () => checkPayment());
  get("cart-try-again").addEventListener("click", () => {
    pending = draftId = undefined;
    state.searchParams.delete("compra");
    history.replaceState(null, "", state);
    cardAttempt = undefined;
    resetCardForm();
    get("cart-payment-summary").hidden = true;
    renderCartWithAccess();
    get("purchase-title").focus({ preventScroll: true });
  });

  async function start() {
    const sku = state.searchParams.get("agregar");
    const retiredExtra = /^digital-(10|25|50)$/.test(sku || "");
    if (shop.validSku(sku)) {
      if (sku === "fisico") {
        const requestedCount = state.searchParams.get("cantidad");
        const count = /^(?:[1-9]|10)$/.test(requestedCount ?? "") ? Number(requestedCount) : 1;
        cart[sku] = Math.min(shop.maxBooklets, (cart[sku] || 0) + count);
        for (const extra of state.searchParams.getAll("extra")) {
          if (extra.startsWith("fisico-") && shop.validSku(extra)) cart[extra] = 1;
        }
      } else cart[sku] = 1;
      storeCart();
    }
    if (sku) {
      for (const param of ["agregar", "cantidad", "extra"]) state.searchParams.delete(param);
      history.replaceState(null, "", state);
    }
    const results = await Promise.allSettled([shop.catalog(), client.auth.getSession()]);
    if (results[0].status === "fulfilled") products = results[0].value;
    if (results[1].status === "fulfilled") session = results[1].value.data?.session;
    if (session && (pending || cart.digital)) digitalActive = await shop.digitalExpiry(session.user.id).catch(() => 0) > Date.now();
    renderCartWithAccess();
    if (!pending && retiredExtra) status.textContent = "Picta Digital ya se ofrece sin paquetes adicionales.";
    if (!pending && results[0].status === "rejected") status.textContent = "No pudimos cargar el catálogo. Recarga la página para intentar de nuevo.";
    if (pending && session) void checkPayment();
    if (pending && !session) {
      resultStatus.textContent = "Inicia sesión para consultar esta compra.";
      showStep("card");
      const login = get("cart-payment-login");
      login.href = "index.html?cuenta=carrito&compra=" + encodeURIComponent(pending);
      login.hidden = false;
    }
    void historyList();
  }
  void start().catch(() => { status.textContent = "No pudimos abrir el carrito. Recarga la página."; });
})();
