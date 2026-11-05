/** Accessible interaction surface for server forms while native JSON UI is rendered by upstream. */
export function attachForms({ host, send, releasePointer, onError }) {
  let stopped = false,
    busy = false,
    current = "",
    submitting = false;
  const clean = (value) => String(value ?? "").replace(/§./g, "");
  function element(tag, text) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = clean(text);
    return el;
  }
  async function submit(name, args) {
    if (submitting) return;
    submitting = true;
    for (const b of host.querySelectorAll("button")) b.disabled = true;
    try {
      await send(name, args);
      current = "";
      host.hidden = true;
    } catch (e) {
      onError(e);
      for (const b of host.querySelectorAll("button")) b.disabled = false;
    } finally {
      submitting = false;
    }
  }
  function button(text, name, args) {
    const b = element("button", text);
    b.type = "button";
    b.onclick = () => submit(name, args);
    return b;
  }
  function render(form) {
    releasePointer();
    host.replaceChildren();
    host.hidden = false;
    host.append(element("h2", form.title || "Server menu"));
    if (form.type === "menu")
      form.buttons?.forEach((b, index) =>
        host.append(button(b.text, "clickFormButton", { index })),
      );
    else if (form.type === "modal") {
      host.append(
        button(form.button1, "modalFormRespond", { response: true }),
        button(form.button2, "modalFormRespond", { response: false }),
      );
    } else if (form.type === "custom") {
      const fields = [];
      for (const [index, item] of (form.content || []).entries()) {
        if (item.type === "label") {
          host.append(element("p", item.text));
          continue;
        }
        const label = element("label", item.text);
        let input;
        if (item.type === "dropdown" || item.type === "step_slider") {
          input = element("select");
          (item.options || []).forEach((text, i) => {
            const option = element("option", text);
            option.value = String(i);
            input.append(option);
          });
          input.value = String(item.defaultIndex ?? 0);
        } else {
          input = element("input");
          input.type =
            item.type === "toggle"
              ? "checkbox"
              : item.type === "slider"
                ? "range"
                : "text";
          if (item.type === "toggle") input.checked = Boolean(item.default);
          else if (item.type === "slider") {
            input.min = String(item.min ?? 0);
            input.max = String(item.max ?? 100);
            input.step = String(item.step ?? 1);
            input.value = String(item.default ?? item.min ?? 0);
          } else {
            input.value = String(item.default ?? "");
            input.placeholder = clean(item.placeholder);
          }
        }
        label.append(input);
        host.append(label);
        fields.push({ index, item, input });
      }
      const apply = element("button", "Submit");
      apply.className = "primary";
      apply.onclick = () =>
        submit("customFormRespond", {
          options: fields.map(({ index, item, input }) => ({
            index,
            value:
              item.type === "toggle"
                ? input.checked
                : ["slider", "dropdown", "step_slider"].includes(item.type)
                  ? Number(input.value)
                  : input.value,
          })),
        });
      host.append(apply);
    } else host.append(element("p", "This form type is not supported yet."));
    host.append(button("Close", "dismissForm", {}));
  }
  async function poll() {
    if (stopped || busy || submitting) return;
    busy = true;
    try {
      const result = await send("getForm");
      if (stopped) return;
      const form = result.data;
      const next = form ? JSON.stringify(form) : "";
      if (next !== current) {
        current = next;
        if (form) render(form);
        else host.hidden = true;
      }
    } catch (e) {
      if (!stopped) onError(e);
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(poll, 600);
  poll();
  return () => {
    stopped = true;
    clearInterval(timer);
    host.hidden = true;
    host.replaceChildren();
  };
}
