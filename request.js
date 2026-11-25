(() => {
  "use strict";

  const get = (id) => document.getElementById(id);
  const form = get("picta-request-form");
  if (!form) return;
  const packageField = get("request-package-field");
  const packageSelect = get("request-package");
  const context = get("request-context");
  const description = get("request-description");
  const consent = get("request-consent");
  const submit = get("request-prepare");
  const feedback = get("request-feedback");
  const history = get("request-history");
  const client = window.pictaSupabase;
  const params = new URLSearchParams(location.search);
  const contact = params.get("solicitud") === "contacto";
  const fields = contact ? [description, consent] : [packageSelect, context, description, consent];
  let requestId;
  let sending = false;

  function validate(field) {
    const valid = field.validity.valid && (field !== description || Boolean(field.value.trim()));
    get(field.id + "-error").hidden = valid;
    if (valid) field.removeAttribute("aria-invalid");
    else field.setAttribute("aria-invalid", "true");
    return valid;
  }

  if (contact) {
    packageField.hidden = packageSelect.disabled = true;
    get("request-context-field").hidden = context.disabled = true;
    document.querySelector("[data-request-section-label]").textContent = "Atención de Picta";
    get("personalizacion-title").textContent = "Envíanos una consulta";
    document.querySelector("[data-request-intro]").textContent = "Cuéntanos en qué podemos ayudarte con tu compra o tu cuenta.";
    document.querySelector(".picta-request-example").hidden = true;
    form.querySelector("[data-request-form-title]").textContent = "Tu consulta";
    form.querySelector("[data-request-description-label]").textContent = "¿En qué podemos ayudarte?";
    description.placeholder = "Por ejemplo, quiero saber cuándo puedo recoger mi pedido.";
    form.querySelector(".picta-request-note").textContent = "Inicia sesión para enviar tu consulta.";
    submit.textContent = "Enviar consulta";
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href="#personalizacion"]');
      if (!link || event.button || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      location.assign("index.html#personalizacion");
    });
  } else {
    for (const { name, quantity, cents } of window.pictaShop.packagesFor("fisico")) {
      packageSelect.add(new Option(`${name} · ${quantity} fichas · ${window.pictaShop.money(cents)}`, String(quantity)));
    }
    const selected = params.get("paquete");
    if (params.get("solicitud") === "fisico" && [...packageSelect.options].some((option) => option.value === selected)) {
      packageSelect.value = selected;
    }
  }

  form.addEventListener("input", (event) => {
    if (event.target.hasAttribute("aria-invalid")) validate(event.target);
    requestId = undefined;
    feedback.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    const invalid = fields.filter((field) => !validate(field));
    if (invalid.length) {
      invalid[0].focus();
      return;
    }
    if (!contact) {
      const sku = "fisico-" + packageSelect.value;
      try {
        const previous = JSON.parse(sessionStorage.getItem("picta.cart.notes.v1") || "{}");
        previous[sku] = description.value.trim();
        sessionStorage.setItem("picta.cart.notes.v1", JSON.stringify(previous));
      } catch {
        feedback.textContent = "No se pudo conservar la descripción. Puedes escribirla en el carrito.";
        return;
      }
      window.location.assign("carrito.html?agregar=" + encodeURIComponent(sku));
      return;
    }
    sending = true;
    submit.disabled = true;
    for (const field of fields) field.disabled = true;
    feedback.textContent = "Comprobando tu cuenta…";
    try {
      if (!client) throw new Error();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        feedback.textContent = "Inicia sesión y vuelve a pulsar Enviar consulta.";
        window.pictaSignInForRequest(submit);
        return;
      }
      requestId ||= crypto.randomUUID();
      feedback.textContent = "Guardando tu solicitud…";
      const { error: insertError } = await client.from("picta_solicitudes").insert({
        id: requestId, formato: "contacto", entorno: "otro", descripcion: description.value.trim(),
        autorizado: consent.checked
      });
      if (insertError) {
        const existing = await client.from("picta_solicitudes").select("id").eq("id", requestId).maybeSingle();
        if (!existing.data) throw insertError;
      }
      form.reset();
      requestId = undefined;
      feedback.textContent = "Tu consulta quedó registrada.";
      history.hidden = false;
    } catch {
      feedback.textContent = "No pudimos guardar tu solicitud. Puedes volver a intentar.";
    } finally {
      sending = false;
      submit.disabled = false;
      for (const field of fields) field.disabled = false;
    }
  });
})();
