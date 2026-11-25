(() => {
  "use strict";

  const client = window.pictaSupabase;
  const prices = new Intl.NumberFormat("es-BO", { style: "currency", currency: "BOB" });
  const shipping = 2500;
  const cartKey = "picta.cart.v1";
  const recentKey = "picta.cart.recent.v1";
  const maxBooklets = 10;
  const amounts = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 2 });
  const formats = {
    digital: { label: "Picta Digital", image: "assets/productos/picta-esencial.webp", action: "Activar mi acceso", suffix: " / mes" },
    fisico: { label: "Picta Físico", image: "assets/cuadernillo/mi-diario-visual.webp", action: "Pedir mi cuadernillo" }
  };

  const packageNames = ["Mi mundo", "Mi universo", "A mi medida"];
  const packageCounts = [10, 25, 50];
  const packagePrices = { personalizado: [3900, 8900, 16900], fisico: [7900, 14900, 24900] };

  function packagesFor(format) {
    if (!Object.hasOwn(packagePrices, format)) return [];
    return packageCounts.map((quantity, index) => ({
      quantity, name: packageNames[index], cents: packagePrices[format][index]
    }));
  }

  async function catalog() {
    if (!client) throw new Error("Supabase no está disponible.");
    const { data, error } = await client.from("productos")
      .select("id, formato, nombre, descripcion, precio_centavos, destacado")
      .eq("activo", true)
      .eq("destacado", true)
      .in("formato", ["digital", "fisico"])
      .order("id");
    if (error) throw error;
    return data;
  }

  async function digitalExpiry(userId) {
    if (!userId) return 0;
    const { data, error } = await client.from("picta_accesos").select("vence_en").eq("cliente_id", userId).maybeSingle();
    if (error) throw error;
    return Date.parse(data?.vence_en) || 0;
  }

  function validSku(value) {
    return typeof value === "string" && /^(digital|fisico(-(10|25|50))?)$/.test(value);
  }

  function readCart() {
    try {
      const saved = JSON.parse(localStorage.getItem(cartKey) || "{}");
      return Object.fromEntries(Object.entries(saved).filter(([sku, count]) =>
        validSku(sku) && Number.isInteger(count) && count >= 1 && count <= maxBooklets &&
        (sku === "fisico" || count === 1)));
    } catch {
      return {};
    }
  }

  function writeCart(cart) {
    localStorage.setItem(cartKey, JSON.stringify(cart));
    window.dispatchEvent(new Event("picta:cart"));
  }

  function takeRecentCartItems() {
    try {
      const items = JSON.parse(sessionStorage.getItem(recentKey) || "[]");
      sessionStorage.removeItem(recentKey);
      return Array.isArray(items) ? items.filter(validSku) : [];
    } catch {
      return [];
    }
  }

  function addCartItems(cart, entries) {
    const added = [];
    for (const [sku, count] of entries) {
      if (sku !== "fisico" && cart[sku]) continue;
      cart[sku] = (cart[sku] || 0) + count;
      added.push(sku);
    }
    if (!added.length) return false;
    writeCart(cart);
    try {
      const recent = new Set([...takeRecentCartItems(), ...added]);
      sessionStorage.setItem(recentKey, JSON.stringify([...recent]));
    } catch { /* Cart entries remain available without the recent marker. */ }
    return true;
  }

  async function payment(body) {
    if (!client) throw new Error("servicio_no_disponible");
    const { data, error } = await client.functions.invoke("picta-pago", { body });
    if (error) {
      const details = await error.context?.json?.().catch(() => null);
      throw new Error(details?.error || "servicio_no_disponible");
    }
    return data;
  }

  window.pictaShop = {
    catalog, digitalExpiry, formats, packagesFor, shipping, validSku, payment, readCart, writeCart, takeRecentCartItems, maxBooklets,
    money: (cents) => prices.format(cents / 100)
  };

  const placements = [...document.querySelectorAll("[data-store-format]")].map((element) => ({
    element,
    format: element.dataset.storeFormat,
    name: element.querySelector("[data-store-name]"),
    amount: element.querySelector("[data-store-price]"),
    order: element.querySelector("[data-cart-link]"),
    status: element.querySelector("[data-store-status]"),
    retry: element.querySelector("[data-retry-catalog]")
  }));
  if (!placements.length) return;

  for (const cost of document.querySelectorAll("[data-store-shipping]")) {
    cost.textContent = "Bs " + amounts.format(shipping / 100);
  }

  function showCartFeedback(container, message, success = true) {
    const feedback = container.querySelector(".product-cart-feedback");
    feedback.dataset.tone = success ? "success" : "error";
    feedback.querySelector("[data-cart-feedback]").textContent = message;
    feedback.querySelector("a").hidden = !success;
  }

  function configureProductOrder(form) {
    const sku = form.dataset.productOrder;
    const quantity = form.elements.namedItem("cantidad");
    const choices = form.elements.namedItem("extra");
    const noExtra = form.querySelector('input[name="extra"][value=""]');
    const extras = [...form.querySelectorAll('input[name="extra"]:not([value=""])')];
    const total = form.querySelector("[data-product-total]");
    const accessLabel = form.querySelector("[data-digital-access]");
    const buy = form.querySelector("[data-cart-link]");
    const digitalTotal = form.querySelector("[data-digital-total]");
    const boards = form.querySelector("[data-digital-boards]");
    const minus = form.querySelector('[data-quantity-step="-1"]');
    const plus = form.querySelector('[data-quantity-step="1"]');
    const packs = new Map(packagesFor(sku)
      .map((pack) => [sku + "-" + pack.quantity, pack]));
    let unitPrice;
    let expiry = 0;
    let checkingAccess = Boolean(boards && client);

    function updateTotal(cart = readCart()) {
      const active = expiry > Date.now();
      const count = quantity ? quantity.valueAsNumber : (active || cart.digital ? 0 : 1);
      const valid = Number.isInteger(count) && count >= (quantity ? 1 : 0) && count <= maxBooklets;
      if (quantity) {
        minus.disabled = valid && count <= 1;
        plus.disabled = valid && count >= maxBooklets;
      }
      const extraPrice = cart[choices?.value] ? 0 : (packs.get(choices?.value)?.cents ?? 0);
      if (boards) {
        accessLabel.textContent = checkingAccess ? "Consultando tu acceso…" : active ? "Ya tienes acceso activo" :
          cart.digital ? "Acceso en tu carrito" : "1 acceso digital";
        boards.hidden = !active;
        digitalTotal.hidden = active || checkingAccess;
        buy.hidden = checkingAccess || active || !Number.isInteger(unitPrice);
      }
      total.textContent = Number.isInteger(unitPrice) && valid ? prices.format((unitPrice * count + extraPrice) / 100) : "—";
    }

    function syncExtras() {
      const cart = readCart();
      for (const extra of extras) {
        const inCart = Boolean(cart[extra.value]);
        if (inCart && extra.checked) noExtra.checked = true;
        extra.disabled = inCart;
        extra.parentElement.querySelector("[data-extra-in-cart]").hidden = !inCart;
      }
      quantity?.setCustomValidity("");
      updateTotal(cart);
    }

    form.addEventListener("input", () => {
      quantity?.setCustomValidity("");
      updateTotal();
    });

    if (quantity) {
      form.addEventListener("click", (event) => {
        const step = event.target.closest("[data-quantity-step]");
        if (!step) return;
        quantity.setCustomValidity("");
        if (!quantity.validity.valid) quantity.value = 1;
        else if (step === plus) quantity.stepUp();
        else quantity.stepDown();
        updateTotal();
      });
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!Number.isInteger(unitPrice) || checkingAccess || expiry > Date.now()) return;
      const cart = readCart();
      const count = quantity ? quantity.valueAsNumber : 1;
      if (quantity && (cart.fisico || 0) + count > maxBooklets) {
        quantity.setCustomValidity("Puedes tener hasta " + maxBooklets + " cuadernillos en el carrito.");
        quantity.reportValidity();
        return;
      }
      const selected = choices?.value;
      const pack = !cart[selected] ? packs.get(selected) : undefined;
      const alreadyDigital = !quantity && Boolean(cart.digital);
      try {
        const entries = [[sku, count]];
        if (pack) entries.push([selected, 1]);
        addCartItems(cart, entries);
      } catch {
        showCartFeedback(form, "No pudimos guardar tu selección. Intenta de nuevo.", false);
        return;
      }
      form.reset();
      syncExtras();
      let message;
      if (quantity) {
        message = count === 1 && !pack ? "Se agregó un cuadernillo a tu carrito."
          : "Se agregaron " + count + (count === 1 ? " cuadernillo" : " cuadernillos") +
            (pack ? " y el extra «" + pack.name + "»" : "") + " a tu carrito.";
      } else message = alreadyDigital ? "Picta Esencial ya está en tu carrito." : "Picta Esencial se agregó a tu carrito.";
      showCartFeedback(form, message);
    });

    window.addEventListener("pageshow", syncExtras);
    window.addEventListener("storage", syncExtras);
    syncExtras();

    return {
      setAccess(value, checking = false) {
        expiry = value;
        checkingAccess = checking;
        updateTotal();
      },
      setPrice(value) {
        unitPrice = value;
        updateTotal();
      },
      selectExtra(value) {
        const extra = extras.find((option) => option.value === value);
        if (extra && !extra.disabled) extra.checked = true;
        updateTotal();
      }
    };
  }

  const productOrders = new Map([...document.querySelectorAll("[data-product-order]")]
    .map((form) => [form.dataset.productOrder, configureProductOrder(form)]));

  if (client && productOrders.has("digital")) {
    const order = productOrders.get("digital");
    let accessVersion = 0;
    let refreshTimer;
    let currentUser;
    async function updateAccess() {
      const version = ++accessVersion;
      const owner = currentUser;
      clearTimeout(refreshTimer);
      const expires = await digitalExpiry(owner).catch(() => 0);
      if (version !== accessVersion || owner !== currentUser) return;
      order.setAccess(expires);
      if (expires > Date.now()) refreshTimer = setTimeout(updateAccess, Math.min(2147483647, expires - Date.now() + 50));
    }
    client.auth.onAuthStateChange((_, session) => {
      if (currentUser === (session?.user?.id || null)) return;
      currentUser = session?.user?.id || null;
      order.setAccess(0, Boolean(currentUser));
      setTimeout(updateAccess, 0);
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && currentUser) void updateAccess(); });
    window.addEventListener("pageshow", ({ persisted }) => { if (persisted && currentUser) void updateAccess(); });
  }

  for (const link of document.querySelectorAll("[data-product-extra]")) {
    link.addEventListener("click", (event) => {
      if (event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const extra = link.dataset.productExtra;
      productOrders.get(extra.split("-")[0])?.selectExtra(extra);
    });
  }

  function renderProduct(placement, product) {
    const { element, name, amount, order, status, retry } = placement;
    if (product) {
      name.textContent = product.nombre;
      amount.textContent = amounts.format(product.precio_centavos / 100);
    }
    amount.closest(".picta-format-price").hidden = !product;
    if (!order) return;

    order.hidden = !product;
    productOrders.get(placement.format)?.setPrice(product?.precio_centavos);
    if (!product) {
      status.textContent = "Este producto no está disponible para pedidos.";
      return;
    }

    status.textContent = "";
    if (document.activeElement === retry) order.focus();
  }

  let loading = false;

  async function loadStore() {
    if (loading) return;
    loading = true;
    for (const { retry, status } of placements) {
      if (!retry) continue;
      retry.setAttribute("aria-disabled", "true");
      status.textContent = "Consultando disponibilidad…";
    }

    try {
      const products = await catalog();
      for (const placement of placements) {
        const product = products.find((item) => item.destacado && item.formato === placement.format);
        renderProduct(placement, product);
        if (!placement.retry) continue;
        if (document.activeElement === placement.retry) placement.status.focus();
        placement.retry.hidden = true;
      }
    } catch {
      for (const { retry, status } of placements) {
        if (!retry) continue;
        status.textContent = "No pudimos consultar la disponibilidad. El precio mostrado es de referencia.";
        retry.disabled = false;
        retry.hidden = false;
        retry.removeAttribute("aria-disabled");
      }
    } finally {
      loading = false;
    }
  }

  for (const { retry } of placements) {
    retry?.addEventListener("click", loadStore);
  }
  void loadStore();
})();
