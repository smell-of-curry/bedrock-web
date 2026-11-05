// Resolve server RawText using the resource packs the player already accepted.
export function parseLanguage(text) {
  const language = Object.create(null);
  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf("=");
    if (at <= 0 || line.startsWith("#")) continue;
    language[line.slice(0, at).trim()] = line.slice(at + 1).split("\t")[0].replace(/\\n|~LINEBREAK~/g, "\n");
  }
  return language;
}

export function translateText(value, language = {}, depth = 0) {
  if (depth > 20) return "";
  const visit = (part) => translateText(part, language, depth + 1);
  if (typeof value === "string") {
    if (value.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.rawtext || parsed.translate || parsed.text !== undefined) return visit(parsed);
      } catch {}
    }
    return Object.hasOwn(language, value) ? language[value] : value;
  }
  if (!value || typeof value !== "object") return String(value ?? "");
  if (Array.isArray(value.rawtext)) return value.rawtext.map(visit).join("");
  if (typeof value.text === "string") return value.text;
  if (typeof value.translate === "string") {
    const args = Array.isArray(value.with) ? value.with.map(visit) : (value.with?.rawtext || []).map(visit);
    let next = 0;
    const template = Object.hasOwn(language, value.translate) ? language[value.translate] : value.translate;
    return template.replace(/%%|%([1-9])(?:\$[a-z])?|%s/g, (token, index) => {
      if (token === "%%") return "%";
      const at = index ? Number(index) - 1 : next++;
      if (index) next = Math.max(next, at + 1);
      return args[at] ?? token;
    });
  }
  return "";
}

export async function loadLanguage() {
  const language = Object.assign(Object.create(null), { "gui.yes": "Yes", "gui.no": "No", "gui.ok": "OK", "gui.cancel": "Cancel" });
  const response = await fetch("/packs", { signal: AbortSignal.timeout(10000) });
  if (!response.ok) return language;
  const packs = (await response.json()).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const tables = await Promise.all(packs.map(async (pack) => {
    try {
      const result = await fetch(`/pack/${encodeURIComponent(pack.id)}/texts/en_US.lang`, { signal: AbortSignal.timeout(10000) });
      return result.ok ? parseLanguage(await result.text()) : {};
    } catch { return {}; }
  }));
  return Object.assign(language, ...tables);
}
