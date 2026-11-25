(() => {
  "use strict";

  const header = document.querySelector("[data-picta-header]");
  if (!header) return;
  document.documentElement.classList.add("js");
  const page = header.dataset.pictaHeader;
  const store = page === "store";
  const storeLink = (section) => (store ? "" : "index.html") + "#" + section;
  const wordmark = '<a href="' + storeLink("inicio") + '" class="wordmark" aria-label="Picta, inicio">' +
    '<span class="picta-motion wordmark-motion" data-lottie="assets/motion/logo/lottie.json" aria-hidden="true">' +
    '<img class="picta-motion-static" src="assets/picta-wordmark.webp" alt="" width="640" height="157">' +
    '<span class="picta-motion-layer"></span></span></a>';
  const logoReturnKey = "picta.logo-return";
  const sections = [
    ["formatos", "Productos"], ["guia", "Cómo usar Picta"], ["stickers", "Probar"], ["personalizacion", "Personalización"],
  ];
  const accountIcon = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg>';
  const avatarChoices = new Map([
    ["16", "Niño"], ["22", "Niña"], ["19", "Alegre"], ["30", "Tranquilo"],
    ["42", "Jugar"], ["34", "Casa"], ["52", "Juguete"], ["55", "Pelota"],
    ["56", "Mochila"], ["60", "Dibujar"], ["61", "Libro"], ["65", "Salteña"]
  ]);
  const avatarSrc = (id) => avatarChoices.has(id) ? `assets/pictograms/${id}.webp` : "";
  window.pictaAvatar = { choices: avatarChoices, src: avatarSrc };
  const accountContent = '<span class="account-avatar" aria-hidden="true">' + accountIcon +
    '<img alt="" width="32" height="32" hidden></span><span data-account-label></span>';
  const accountAttributes = 'class="account-launch" id="account-launch" aria-label="Mi cuenta" data-account-pending';
  const loginLink = page === "cart" ? "index.html?cuenta=carrito" : "index.html?cuenta=inicio";
  const cartUrl = new URL(location.href);
  const order = cartUrl.searchParams.get("compra");
  const returnLink = page === "cart" && /^[a-f0-9-]{36}$/i.test(order || "") ? "&compra=" + encodeURIComponent(order) : "";
  const accountHref = page === "cart" ? "dashboard.html#inicio" : loginLink;
  const account = store
    ? '<button ' + accountAttributes + ' type="button" aria-haspopup="dialog" aria-controls="account-dialog">' + accountContent + '</button>'
    : '<a ' + accountAttributes + ' href="' + accountHref + '"' +
      (page === "account" ? ' aria-current="page"' : "") + '>' + accountContent + '</a>';

  header.insertAdjacentHTML('afterbegin', '<div class="container-fluid picta-container header-inner">' +
    wordmark +
    '<button class="menu-toggle icon-button" id="menu-toggle" type="button" aria-controls="main-menu" aria-expanded="false" aria-label="Abrir menú">' +
    '<svg class="icon icon-menu" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg></button>' +
    '<nav id="main-menu" class="header-nav" aria-label="Navegación principal">' +
    sections.map(([id, label]) => '<a href="' + storeLink(id) + '">' + label + '</a>').join("") + '</nav>' +
    '<div class="header-actions"><a class="header-cart" href="carrito.html" aria-label="Carrito"' +
    (page === "cart" ? ' aria-current="page"' : "") + '>' +
    '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 3.5H5l2.7 11.2a1.5 1.5 0 0 0 1.5 1.1h8a1.5 1.5 0 0 0 1.5-1.1l1.8-7.5H6.2"/><circle cx="9.5" cy="20" r="1"/><circle cx="17.5" cy="20" r="1"/></svg>' +
    '<span class="header-cart-count" aria-hidden="true" hidden></span></a>' + account + '</div></div>');

  function renderFooter() {
    const footer = document.querySelector("[data-picta-footer]");
    if (!footer) return;
    const contact = "index.html?solicitud=contacto#personalizacion";
    const groups = [
      ["Tienda", [[storeLink("formatos"), "Productos"], [storeLink("personalizacion"), "Personalización"], ["carrito.html", "Carrito"]]],
      ["Recursos", [[storeLink("guia"), "Guía de uso"], [storeLink("stickers"), "Probar el tablero"]]],
      ["Cuenta y ayuda", [["dashboard.html#inicio", "Mi cuenta"], ["dashboard.html#pedidos", "Mis pedidos"],
        [storeLink("preguntas"), "Preguntas frecuentes"]]],
    ];

    footer.innerHTML = '<div class="container-fluid picta-container footer-wrap"><div class="footer-top"><div class="footer-brand">' +
      wordmark +
      '<p>¿Tienes dudas sobre tu compra o acceso?</p>' +
      '<a class="footer-contact" href="' + contact + '">Enviar consulta <span aria-hidden="true">↗</span></a></div>' +
      '<nav class="footer-links" aria-label="Enlaces de Picta">' + groups.map(([heading, links]) =>
        '<div class="footer-group"><h2>' + heading + '</h2><ul>' + links.map(([href, label]) =>
          '<li><a href="' + href + '">' + label + '</a></li>').join("") + '</ul></div>').join("") + '</nav></div>' +
      '<div class="footer-bottom"><span>© 2026 PICTA</span><span>Santa Cruz de la Sierra, Bolivia</span></div></div>';
  }

  const headerLogo = header.querySelector(".wordmark-motion");
  function playLogo() {
    void window.pictaMotion?.play(headerLogo, { restart: true });
  }

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a.wordmark");
    if (!link || event.defaultPrevented || event.button || event.ctrlKey || event.metaKey ||
      event.altKey || event.shiftKey) return;
    if (store) {
      playLogo();
    } else {
      try {
        sessionStorage.setItem(logoReturnKey, String(Date.now()));
      } catch { /* The link still works without session storage. */ }
    }
  });

  const cart = header.querySelector(".header-cart");
  const countBadge = cart.querySelector(".header-cart-count");
  function updateCount() {
    let count = 0;
    try {
      const items = JSON.parse(localStorage.getItem("picta.cart.v1") || "{}");
      for (const [sku, quantity] of Object.entries(items)) {
        if (/^(digital|fisico(-(10|25|50))?)$/.test(sku) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 10) {
          count += quantity;
        }
      }
    } catch { /* The cart link works without local storage. */ }
    countBadge.hidden = !count;
    countBadge.textContent = count;
    cart.setAttribute("aria-label", count ? 'Carrito, ' + count + (count === 1 ? ' artículo' : ' artículos') : "Carrito");
  }
  updateCount();
  window.addEventListener("storage", updateCount);
  window.addEventListener("picta:cart", updateCount);
  window.addEventListener("pageshow", updateCount);

  const launch = document.getElementById("account-launch");
  const label = launch.querySelector("[data-account-label]");
  const avatarImage = launch.querySelector(".account-avatar img");
  const avatarIcon = launch.querySelector(".account-avatar .icon");
  const profileKey = "picta.header-profile.v1";
  let profile;
  let currentUser;
  let initialized = false;
  let profileVersion = 0;

  try {
    const saved = JSON.parse(sessionStorage.getItem(profileKey) || "null");
    if (typeof saved?.id === "string" && typeof saved.name === "string") profile = saved;
  } catch { /* The avatar retains its space until the session loads. */ }

  function paintName(name, signedIn, avatar) {
    if (launch.hasAttribute("data-recovery")) return;
    const text = name || (signedIn ? "Mi cuenta" : "Iniciar sesión");
    if (label.textContent !== text) label.textContent = text;
    launch.setAttribute("aria-label", name ? "Mi cuenta, " + name : text);
    launch.removeAttribute("data-account-pending");
    const src = avatarSrc(avatar);
    if (src && avatarImage.getAttribute("src") !== src) avatarImage.src = src;
    avatarImage.hidden = !src;
    avatarIcon.toggleAttribute("hidden", Boolean(src));
  }

  function setProfile(name, user) {
    const avatar = user?.user_metadata?.picta_avatar;
    profile = user ? { id: user.id, name: typeof name === "string" ? name.trim() : "", avatar: avatarChoices.has(avatar) ? avatar : null } : undefined;
    try {
      if (profile) sessionStorage.setItem(profileKey, JSON.stringify(profile));
      else sessionStorage.removeItem(profileKey);
    } catch { /* The current page can still display the name. */ }
    paintName(profile?.name, Boolean(user), profile?.avatar);
  }

  if (profile) paintName(profile.name, true, profile.avatar);

  function bindAccount() {
    const client = window.pictaSupabase;
    if (!client) {
      setProfile("", null);
      return;
    }
    client.auth.onAuthStateChange((_, session) => {
      const user = session?.user || null;
      if (initialized && user?.id === currentUser?.id) {
        const previousAvatar = currentUser?.user_metadata?.picta_avatar;
        currentUser = user;
        if (user && previousAvatar !== user.user_metadata?.picta_avatar) {
          setProfile(profile?.id === user.id ? profile.name : user.user_metadata?.nombre, user);
        }
        return;
      }
      initialized = true;
      currentUser = user;
      const version = ++profileVersion;
      if (!user) {
        setProfile("", null);
        if (!store) launch.href = loginLink + returnLink;
        return;
      }
      if (profile?.id !== user.id) {
        label.textContent = "";
        avatarImage.hidden = true;
        avatarIcon.removeAttribute("hidden");
        launch.setAttribute("aria-label", "Mi cuenta");
        launch.setAttribute("data-account-pending", "");
      }
      if (!store) launch.href = page === "account" ? "#inicio" : "dashboard.html#inicio";
      window.setTimeout(async () => {
        let name = user.user_metadata?.nombre;
        try {
          const { data } = await client.from("clientes").select("nombre").eq("id", user.id).maybeSingle();
          if (data?.nombre) name = data.nombre;
        } catch { /* The account link works while the profile loads. */ }
        if (version === profileVersion) setProfile(name || (profile?.id === user.id ? profile.name : ""), user);
      }, 0);
    });
  }
  window.addEventListener("picta:profile", (event) => {
    if (!currentUser || event.detail.id !== currentUser.id) return;
    profileVersion++;
    setProfile(event.detail.name, currentUser);
  });
  window.addEventListener("picta:account-label", () => paintName(profile?.name, Boolean(currentUser), profile?.avatar));
  document.addEventListener("DOMContentLoaded", () => {
    renderFooter();
    bindAccount();
    if (store) {
      try {
        const requestedAt = Number(sessionStorage.getItem(logoReturnKey));
        sessionStorage.removeItem(logoReturnKey);
        if (location.hash === "#inicio" && Date.now() - requestedAt < 15000) playLogo();
      } catch { /* Navigation works without session storage. */ }
    }
  }, { once: true });
})();
