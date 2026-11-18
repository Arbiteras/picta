(() => {
  "use strict";

  const dialog = document.getElementById("account-dialog");
  const launch = document.getElementById("account-launch");
  const get = (id) => document.getElementById(id);
  const title = get("account-title");
  const description = get("account-description");
  const alert = get("account-error");
  const status = get("account-status");
  const form = get("account-auth-form");
  const profile = get("account-profile");
  const name = get("account-name");
  const email = get("account-email");
  const password = get("account-password");
  const profileName = get("profile-name");
  const submit = get("account-submit");
  const save = get("account-save");
  const links = get("account-links");
  const switchCopy = get("account-switch-copy");
  const switchButton = get("account-switch");
  const resend = get("account-resend");
  const retry = get("account-retry");
  const logout = get("account-logout");
  const togglePassword = get("account-password-toggle");
  const forgot = dialog.querySelector(".account-forgot");
  const close = dialog.querySelector(".account-close");
  const inputs = [name, email, password, profileName];
  const buttons = [...dialog.querySelectorAll("button")];

  const views = {
    login: ["Iniciar sesión", "Entra a tu cuenta Picta con tu correo.", "Iniciar sesión", "register", "¿Primera vez en Picta?"],
    register: ["Crear cuenta", "Regístrate con tu nombre, correo y contraseña para entrar a Picta.", "Crear cuenta", "login", "¿Ya tienes una cuenta?"],
    recover: ["Recuperar contraseña", "Te enviaremos un enlace para elegir una contraseña nueva.", "Enviar enlace", "login"],
    resend: ["Reenviar confirmación", "Solicita un enlace nuevo para verificar tu correo electrónico.", "Enviar confirmación", "login"],
    reset: ["Nueva contraseña", "Elige una contraseña para volver a entrar a tu cuenta Picta.", "Guardar contraseña"],
    confirmation: ["Revisa tu correo", "Si hay una confirmación pendiente, busca el enlace de Picta en tu bandeja de entrada o en correo no deseado.", "", "login"],
    recoverSent: ["Revisa tu correo", "Si el correo está asociado a una cuenta, recibirás un enlace para recuperar tu contraseña.", "", "login"],
    account: ["Mi cuenta", "Consulta tus datos y actualiza tu nombre."],
    loading: ["Mi cuenta", "Estamos comprobando tu sesión."],
    unavailable: ["Cuenta no disponible", "No pudimos conectar el acceso a Picta. Vuelve a intentarlo más tarde."]
  };
  const errors = {
    invalid_credentials: "Revisa tu correo y contraseña e inténtalo de nuevo.",
    email_not_confirmed: "Confirma tu correo antes de iniciar sesión. Puedes pedir un enlace nuevo.",
    user_already_exists: "Ya hay una cuenta con este correo. Inicia sesión o recupera tu contraseña.",
    email_exists: "Ya hay una cuenta con este correo. Inicia sesión o recupera tu contraseña.",
    weak_password: "Elige una contraseña más segura que cumpla los requisitos.",
    same_password: "Elige una contraseña distinta de la anterior.",
    over_email_send_rate_limit: "Espera un momento antes de pedir otro correo.",
    over_request_rate_limit: "Espera un momento antes de volver a intentarlo.",
    email_address_not_authorized: "El servicio de correo de Picta todavía no puede enviar mensajes a esta dirección.",
    email_address_invalid: "Escribe un correo electrónico válido.",
    otp_expired: "El enlace venció. Solicita uno nuevo.",
    session_not_found: "Tu sesión venció. Vuelve a iniciar sesión."
  };

  const pageUrl = new URL(window.location.href);
  const hashParams = new URLSearchParams(pageUrl.hash.slice(1));
  const callbackType = hashParams.has("access_token") ? hashParams.get("type") : null;
  const linkError = hashParams.get("error_code") || pageUrl.searchParams.get("error_code");
  const canUseLinks = pageUrl.protocol === "https:" ||
    (pageUrl.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(pageUrl.hostname));
  const redirectUrl = pageUrl.origin + pageUrl.pathname;
  const client = dialog.dataset.supabaseKey && window.supabase?.createClient(
    dialog.dataset.supabaseUrl, dialog.dataset.supabaseKey, {
      auth: { flowType: "implicit" },
      global: {
        fetch: (url, options) => {
          const signal = AbortSignal.timeout(16000);
          return fetch(url, {
            ...options,
            signal: options?.signal ? AbortSignal.any([options.signal, signal]) : signal
          });
        }
      }
    }
  );

  let mode = "loading";
  let session = null;
  let initialized = !client;
  let recovering = false;
  let working = false;
  let profileRequest = 0;
  let profileReady = false;

  function setPasswordVisible(visible) {
    password.type = visible ? "text" : "password";
    togglePassword.textContent = visible ? "Ocultar" : "Mostrar";
    togglePassword.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
  }

  function fieldError(field, message = "") {
    const note = get(field.id + "-error");
    note.hidden = !message;
    if (message) {
      note.textContent = message;
      field.setAttribute("aria-invalid", "true");
    } else {
      field.removeAttribute("aria-invalid");
    }
  }

  function validate(field) {
    let message = "";
    if (field === name || field === profileName) {
      if (!field.value.trim() || !field.validity.valid) message = "Escribe un nombre de hasta 100 caracteres.";
    } else if (field === email) {
      if (!field.validity.valid) message = "Escribe un correo electrónico válido.";
    } else if (!field.value) {
      message = "Escribe tu contraseña.";
    } else if (mode !== "login" && [...field.value].length < 8) {
      message = "Usa al menos 8 caracteres.";
    }
    fieldError(field, message);
    return !message;
  }

  function showMode(next, focus = true) {
    mode = next;
    const [heading, copy, action, alternate, prompt] = views[next];
    const newPassword = next === "register" || next === "reset";
    title.textContent = heading;
    description.textContent = copy;
    alert.textContent = status.textContent = "";
    password.value = "";
    setPasswordVisible(false);
    inputs.forEach((field) => fieldError(field));
    form.hidden = !action;
    profile.hidden = true;
    submit.querySelector("span").textContent = action || "";
    name.closest("[data-account-field]").hidden = next !== "register";
    email.closest("[data-account-field]").hidden = next === "reset";
    password.closest("[data-account-field]").hidden = !newPassword && next !== "login";
    for (const field of [name, email, password]) {
      field.disabled = field.closest("[data-account-field]").hidden;
    }
    email.autocomplete = newPassword ? "email" : "username";
    password.autocomplete = newPassword ? "new-password" : "current-password";
    get("account-password-label").textContent = next === "reset" ? "Nueva contraseña" : "Contraseña";
    get("account-password-help").hidden = !newPassword;
    forgot.hidden = next !== "login";
    switchCopy.hidden = !prompt;
    switchCopy.textContent = prompt || "";
    switchButton.hidden = !alternate;
    switchButton.textContent = alternate === "login" && !prompt ? "Volver a iniciar sesión" : views[alternate]?.[0] || "";
    switchButton.dataset.accountMode = alternate || "";
    resend.hidden = next !== "confirmation";
    retry.hidden = true;
    logout.hidden = next !== "account" && next !== "reset";
    updateLinks();
    dialog.scrollTop = 0;
    if (focus && dialog.open) title.focus({ preventScroll: true });
  }

  function updateLinks() {
    links.hidden = [switchButton, resend, retry, logout].every((button) => button.hidden);
  }

  function defaultMode() {
    if (!client) return "unavailable";
    if (!initialized) return "loading";
    if (recovering && session) return "reset";
    return session ? "account" : "login";
  }

  function openAccount(next = defaultMode()) {
    showMode(next, false);
    if (!dialog.open) dialog.showModal();
    title.focus({ preventScroll: true });
    if (next === "account") void loadProfile();
  }

  async function loadProfile() {
    const user = session?.user;
    if (!user || !dialog.open || mode !== "account") return;
    const request = ++profileRequest;
    profileReady = false;
    profile.hidden = true;
    retry.hidden = true;
    updateLinks();
    alert.textContent = "";
    status.textContent = "Cargando tu perfil…";

    try {
      const { data, error } = await client.from("clientes").select("nombre, correo").eq("id", user.id).single();
      if (request !== profileRequest || mode !== "account" || !dialog.open || session?.user.id !== user.id) return;
      if (error) throw error;
      get("profile-email").textContent = data.correo || user.email || "";
      profileName.value = data.nombre || "";
      profileReady = true;
      profile.hidden = false;
    } catch {
      if (request !== profileRequest || mode !== "account" || !dialog.open) return;
      alert.textContent = "No pudimos cargar tu perfil. Intenta volver a cargarlo.";
      retry.hidden = false;
      updateLinks();
    }
    status.textContent = "";
  }

  function renderSession() {
    launch.querySelector("span").textContent = session ? "Mi cuenta" : "Iniciar sesión";
  }

  async function run(button, pendingLabel, task) {
    if (working) return;
    const originalMode = mode;
    const label = button.querySelector("span") || button;
    const previousLabel = label.textContent;
    working = true;
    alert.textContent = status.textContent = "";
    label.textContent = pendingLabel;
    buttons.forEach((item) => { item.disabled = true; });
    inputs.forEach((field) => { field.readOnly = true; });
    try {
      await task();
    } catch (error) {
      if (error.code === "email_not_confirmed" && mode === "login") {
        resend.hidden = false;
        updateLinks();
      }
      alert.textContent = errors[error.code] || (navigator.onLine
        ? "No pudimos completar la acción. Intenta de nuevo."
        : "Revisa tu conexión a internet y vuelve a intentarlo.");
    } finally {
      if (button !== submit || mode === originalMode) label.textContent = previousLabel;
      buttons.forEach((item) => { item.disabled = false; });
      inputs.forEach((field) => { field.readOnly = false; });
      working = false;
    }
  }

  dialog.addEventListener("click", (event) => {
    const next = event.target.closest("[data-account-mode]")?.dataset.accountMode;
    if (next && !working) showMode(next);
  });
  launch.addEventListener("click", () => openAccount());
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", (event) => { if (working) event.preventDefault(); });
  dialog.addEventListener("close", () => {
    profileRequest++;
    profileReady = false;
    form.reset();
    profile.reset();
    get("profile-email").textContent = "";
    launch.focus({ preventScroll: true });
  });
  togglePassword.addEventListener("click", () => setPasswordVisible(password.type === "password"));
  retry.addEventListener("click", () => { void loadProfile(); });
  for (const field of inputs) {
    field.addEventListener("input", () => {
      if (field.hasAttribute("aria-invalid")) validate(field);
    });
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (working || !client) return;
    const invalid = [name, email, password].filter((field) => !field.disabled && !validate(field));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    const address = email.value.trim();
    const secret = password.value;
    const action = mode;
    if (["resend", "recover"].includes(action) && !canUseLinks) {
      alert.textContent = "Abre la página desde su dirección web para recibir enlaces por correo. Para probarla en este equipo, usa http://localhost:3000.";
      return;
    }

    void run(submit, "Un momento…", async () => {
      let result;
      if (action === "login") {
        result = await client.auth.signInWithPassword({ email: address, password: secret });
      } else if (action === "register") {
        result = await client.auth.signUp({
          email: address,
          password: secret,
          options: {
            data: { nombre: name.value.trim() },
            emailRedirectTo: canUseLinks ? redirectUrl : undefined
          }
        });
      } else if (action === "recover") {
        result = await client.auth.resetPasswordForEmail(address, { redirectTo: redirectUrl });
      } else if (action === "resend") {
        result = await client.auth.resend({ type: "signup", email: address, options: { emailRedirectTo: redirectUrl } });
      } else if (action === "reset") {
        result = await client.auth.updateUser({ password: secret });
      }
      if (result.error) throw result.error;

      if (action === "reset" || result.data.session) {
        session = result.data.session || session;
        recovering = false;
        renderSession();
        showMode("account");
        await loadProfile();
        if (action === "reset" && profileReady) status.textContent = "Cambiaste tu contraseña.";
      } else {
        showMode(action === "recover" ? "recoverSent" : "confirmation");
      }
    });
  });

  profile.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!profileReady || !session || working) return;
    if (!validate(profileName)) {
      profileName.focus();
      return;
    }
    const id = session.user.id;
    const nombre = profileName.value.trim();
    void run(save, "Guardando…", async () => {
      const { data, error } = await client.from("clientes").update({ nombre }).eq("id", id).select("nombre").single();
      if (error) throw error;
      profileName.value = data.nombre;
      status.textContent = "Guardamos tu nombre.";
    });
  });

  logout.addEventListener("click", () => {
    void run(logout, "Cerrando sesión…", async () => {
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      session = null;
      recovering = false;
      form.reset();
      renderSession();
      showMode("login");
      status.textContent = "Cerraste tu sesión.";
    });
  });

  launch.hidden = false;
  if (!client) return;
  client.auth.onAuthStateChange((event, current) => {
    const previousUser = session?.user.id;
    const firstEvent = !initialized;
    session = current;
    initialized = true;
    if (event === "PASSWORD_RECOVERY" || (firstEvent && callbackType === "recovery" && session)) recovering = true;
    if (event === "SIGNED_OUT") recovering = false;
    renderSession();
    // Let the auth callback release its lock before loading the account.
    if (firstEvent && linkError) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.hash = "";
      for (const key of ["error", "error_code", "error_description"]) cleanUrl.searchParams.delete(key);
      history.replaceState(history.state, "", cleanUrl);
      openAccount(defaultMode());
      alert.textContent = errors[linkError] || "El enlace es inválido o venció. Solicita otro desde la ventana de cuenta.";
    } else if (event === "PASSWORD_RECOVERY" || (firstEvent && callbackType && session)) {
      window.setTimeout(() => openAccount(), 0);
    } else if (!working && dialog.open && (mode === "loading" || previousUser !== current?.user.id)) {
      window.setTimeout(() => {
        if (dialog.open && !working) openAccount();
      }, 0);
    }
  });
})();
