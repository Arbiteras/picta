(function () {
  "use strict";

  const form = document.getElementById("picta-request-form");
  if (!form) return;

  const format = document.getElementById("request-format");
  const context = document.getElementById("request-context");
  const description = document.getElementById("request-description");
  const fields = [format, context, description];
  const result = document.getElementById("picta-request-result");
  const resultTitle = document.getElementById("request-result-title");
  const resultFormat = document.getElementById("request-result-format");
  const resultContext = document.getElementById("request-result-context");
  const resultDescription = document.getElementById("request-result-description");
  let summary = "";

  function validate(field) {
    const valid = field.value.trim().length > 0 && field.validity.valid;
    document.getElementById(field.id + "-error").hidden = valid;
    if (valid) {
      field.removeAttribute("aria-invalid");
    } else {
      field.setAttribute("aria-invalid", "true");
    }
    return valid;
  }

  function clearResult() {
    result.hidden = true;
    resultFormat.textContent = "";
    resultContext.textContent = "";
    resultDescription.textContent = "";
    summary = "";
  }

  for (const link of document.querySelectorAll("[data-request-format]")) {
    link.addEventListener("click", function () {
      if (format.value !== link.dataset.requestFormat) {
        format.value = link.dataset.requestFormat;
        format.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
  }

  form.addEventListener("input", function (event) {
    const field = event.target;
    if (field.hasAttribute("aria-invalid")) validate(field);
    if (!result.hidden) clearResult();
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const invalidFields = fields.filter(function (field) {
      return !validate(field);
    });

    if (invalidFields.length > 0) {
      invalidFields[0].focus();
      return;
    }

    const formatLabel = format.selectedOptions[0].textContent;
    const contextLabel = context.selectedOptions[0].textContent;
    const descriptionText = description.value.trim();

    resultFormat.textContent = formatLabel;
    resultContext.textContent = contextLabel;
    resultDescription.textContent = descriptionText;
    summary = [
      "PICTA · Resumen de personalización",
      "",
      "Formato: " + formatLabel,
      "Entorno: " + contextLabel,
      "",
      "Lo que quieres representar",
      descriptionText,
      ""
    ].join("\n");

    result.hidden = false;
    resultTitle.focus();
  });

  document.getElementById("request-download").addEventListener("click", function () {
    if (!summary) return;

    const url = URL.createObjectURL(new Blob([summary], { type: "text/plain;charset=utf-8" }));
    const download = document.createElement("a");
    download.href = url;
    download.download = "picta-resumen.txt";
    document.body.append(download);
    download.click();
    download.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  });

  document.getElementById("request-prepare").disabled = false;
})();
