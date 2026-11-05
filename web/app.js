import { attachForms } from "./forms.js";
let stopForms = () => {};
const $ = (id) => document.getElementById(id);
function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
let settings = {
  name: "WebPlayer",
  relay: location.origin,
  sensitivity: 0.15,
  authentication: "xbox",
  ...load("bw-settings", {}),
};
let saved = load("bw-servers", []);
if (!Array.isArray(saved)) saved = [];
let key = sessionStorage.getItem("bw-key") || "",
  selected = null,
  active = false;
const directory = [
  {
    label: "PokéBedrock",
    host: "play.pokebedrock.com",
    port: 19132,
    description:
      "Pokémon adventures in Minecraft Bedrock. This is the primary public-server compatibility target.",
    auth: true,
  },
  {
    label: "The Hive",
    host: "geo.hivebedrock.network",
    port: 19132,
    description:
      "Minigames and multiplayer adventures. Xbox authentication is required.",
    auth: true,
  },
  {
    label: "CubeCraft",
    host: "mco.cubecraft.net",
    port: 19132,
    description:
      "A community of minigames, challenges and multiplayer worlds. Xbox authentication is required.",
    auth: true,
  },
  {
    label: "Lifeboat",
    host: "play.lbsg.net",
    port: 19132,
    description:
      "Explore multiplayer game modes with friends. Xbox authentication is required.",
    auth: true,
  },
  {
    label: "Mineville",
    host: "play.inpvp.net",
    port: 19132,
    description:
      "Discover community experiences. Xbox authentication is required.",
    auth: true,
  },
];
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 9000);
}
function select(s) {
  selected = s;
  render();
  $("server-title").textContent = s.label;
  $("server-address").textContent = `${s.host}:${s.port}`;
  $("server-kind").textContent = s.auth
    ? "Directory entry · Xbox sign-in required"
    : "Saved custom server";
  $("description").textContent =
    s.description ||
    "Connect to your own Bedrock Dedicated Server and explore its live world in your browser.";
  $("support").textContent = s.auth
    ? "Uses Microsoft device-code sign-in. Public-server compatibility is experimental and has not yet been verified."
    : "Microsoft sign-in is enabled by default. Use offline mode only for a private test server that explicitly supports it.";
  $("join").disabled = false;
  $("join").textContent = s.auth ? "Sign in & join →" : "Join server →";
  $("remove").hidden = !!s.auth;
}
function render() {
  for (const [id, list] of [
    ["custom", saved],
    ["featured", directory],
  ]) {
    $(id).replaceChildren();
    for (const s of list) {
      const b = document.createElement("button");
      b.className = "server" + (selected === s ? " selected" : "");
      const icon = document.createElement("span");
      icon.className = "icon";
      icon.textContent = s.label.slice(0, 1);
      const text = document.createElement("span");
      text.textContent = s.label;
      const sub = document.createElement("small");
      sub.textContent = s.auth ? "XBOX AUTH REQUIRED" : `${s.host}:${s.port}`;
      text.append(sub);
      b.append(icon, text);
      b.onclick = () => select(s);
      $(id).append(b);
    }
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent =
        "Your adventures start here. Add a server to get connected.";
      $(id).append(p);
    }
  }
}
$("play").onclick = () => {
  $("home").hidden = true;
  $("servers").hidden = false;
  select(saved[0] || directory[0]);
};
document.querySelector(".back").onclick = () => {
  $("home").hidden = false;
  $("servers").hidden = true;
};
$("add").onclick = () => $("server-dialog").showModal();
$("server-form").onsubmit = (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const s = {
    label: f.get("label").trim(),
    host: f.get("host").trim(),
    port: Number(f.get("port")),
  };
  if (!/^[a-zA-Z0-9:][a-zA-Z0-9.:-]*$/.test(s.host))
    return toast("Use a hostname or IP address, without a URL prefix.");
  saved.push(s);
  localStorage.setItem("bw-servers", JSON.stringify(saved));
  $("server-dialog").close();
  e.target.reset();
  select(s);
};
$("remove").onclick = () => {
  saved = saved.filter((s) => s !== selected);
  localStorage.setItem("bw-servers", JSON.stringify(saved));
  select(saved[0] || directory[0]);
};
function showSettings() {
  const f = $("settings-form");
  for (const [n, v] of Object.entries({ ...settings, key }))
    if (f.elements[n]) f.elements[n].value = v;
  $("settings-dialog").showModal();
}
$("settings").onclick = showSettings;
$("settings-form").onsubmit = (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const relay = new URL(f.get("relay"));
  if (
    !["http:", "https:"].includes(relay.protocol) ||
    relay.username ||
    relay.password
  )
    return toast("Relay must be an HTTP or HTTPS URL without credentials.");
  settings = {
    name: f.get("name"),
    relay: relay.origin,
    sensitivity: Number(f.get("sensitivity")),
    authentication: f.get("authentication"),
  };
  key = f.get("key");
  localStorage.setItem("bw-settings", JSON.stringify(settings));
  sessionStorage.setItem("bw-key", key);
  $("settings-dialog").close();
  toast("Settings saved");
};
for (const b of document.querySelectorAll("[data-close]"))
  b.onclick = () => b.closest("dialog").close();
async function api(path, data) {
  const r = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(data),
  });
  const result = await r.json();
  if (!r.ok || result.status === "error")
    throw Error(
      result.error || result.message || "The server rejected the action.",
    );
  return result;
}
function enterWorld(label) {
  active = true;
  $("home").hidden = true;
  $("servers").hidden = true;
  $("game").hidden = false;
  $("game-status").textContent = label;
  $("world").src =
    "/renderer/index.html?stream=" +
    encodeURIComponent(location.origin + "/stream") +
    "&camera=first";
}
async function checkSession() {
  if (!key) return;
  try {
    const state = await api("/api/status", {});
    $("resume").hidden = !state.connected;
  } catch {
    /* A Pages launcher has no relay routes. */
  }
}
$("resume").onclick = async () => {
  try {
    const session = await api("/api/resume", {});
    enterWorld(session.name);
  } catch (e) {
    toast(e.message);
  }
};
$("signout").onclick = async () => {
  try {
    await api("/api/signout", {});
    active = false;
    stopForms();
    $("world").src = "about:blank";
    $("game").hidden = true;
    $("resume").hidden = true;
    $("home").hidden = false;
    toast("Signed out of Microsoft");
  } catch (e) {
    toast(e.message);
  }
};
checkSession();
async function join() {
  if (!selected) return;
  if (!key) {
    showSettings();
    return toast("Set your personal relay URL and access key first.");
  }
  if (new URL(settings.relay).origin !== location.origin) {
    const transfer = { settings, key, server: selected };
    location.href =
      settings.relay +
      "/#connect=" +
      encodeURIComponent(JSON.stringify(transfer));
    return;
  }
  $("game").hidden = false;
  $("game-status").textContent = "Connecting to " + selected.host + "…";
  $("leave").disabled = false;
  $("sign-in").hidden = true;
  const statusPoll = setInterval(async () => {
    try {
      const status = await api("/api/status", {});
      $("sign-in").hidden = !status.challenge;
      if (status.challenge) {
        $("sign-in-code").textContent = status.challenge.code;
        $("sign-in-link").href = status.challenge.url;
        $("game-status").textContent = "Waiting for Microsoft sign-in…";
      } else {
        $("game-status").textContent = "Connecting to " + selected.host + "…";
      }
    } catch {
      /* The connect request reports the final error. */
    }
  }, 1000);
  try {
    await api("/api/connect", {
      host: selected.host,
      port: selected.port,
      name: settings.name,
      authentication: selected.auth ? "xbox" : settings.authentication,
    });
    enterWorld(selected.label);
  } catch (e) {
    $("game").hidden = true;
    $("connection-error-message").textContent = e.message;
    $("connection-error").showModal();
  } finally {
    clearInterval(statusPoll);
    $("sign-in").hidden = true;
    $("leave").disabled = false;
  }
}
$("join").onclick = join;
$("leave").onclick = async () => {
  try {
    await api("/api/disconnect", {});
    active = false;
    stopForms();
    $("resume").hidden = true;
    $("world").src = "about:blank";
    $("game").hidden = true;
    $("home").hidden = false;
  } catch (e) {
    toast(e.message);
  }
};
$("world").onload = () => {
  if (!active) return;
  const w = $("world").contentWindow,
    d = w.document,
    canvas = d.getElementById("c");
  if (!canvas) return;
  // The embedded renderer's diagnostic panel belongs to development tools.
  const overlay = d.getElementById("overlay");
  if (overlay) overlay.hidden = true;
  const keys = new Set();
  let dx = 0,
    dy = 0,
    busy = false,
    keyboardMode = false;
  const send = (name, args = {}) => api("/api/action", { name, ...args });
  const error = (e) => toast(e.message);
  stopForms();
  stopForms = attachForms({
    host: $("server-form-panel"),
    send,
    releasePointer: () => {
      d.exitPointerLock();
      reset();
    },
    onError: error,
  });
  const reset = () => {
    keys.clear();
    dx = dy = 0;
    keyboardMode = false;
  };
  d.addEventListener("pointerlockchange", () => {
    if (!d.pointerLockElement) reset();
  });
  w.addEventListener("blur", reset);
  d.addEventListener("mousemove", (e) => {
    if (d.pointerLockElement) {
      dx += e.movementX * settings.sensitivity;
      dy += e.movementY * settings.sensitivity;
    }
  });
  d.addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea,select")) return;
    if (e.code === "KeyT") {
      e.preventDefault();
      d.exitPointerLock();
      reset();
      const message = prompt("Chat message");
      if (message) send("chat", { message }).catch(error);
      return;
    }
    if (e.code === "Escape") { reset(); return; }
    if (!d.pointerLockElement && !keyboardMode) return;
    e.preventDefault();
    keys.add(e.code);
    if (e.code === "Space" && !e.repeat) send("jump").catch(error);
    if (/^Digit[1-9]$/.test(e.code))
      send("setHeldSlot", { slot: Number(e.code.slice(-1)) - 1 }).catch(error);
  });
  d.addEventListener("keyup", (e) => keys.delete(e.code));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener("mousedown", (e) => {
    if (!d.pointerLockElement && !keyboardMode) {
      const fallback = () => {
        keyboardMode = true;
        $("game-help").textContent = "Keyboard mode · WASD move · Arrow keys look · Space jump · 1–9 hotbar · T chat · Escape pause";
      };
      try { canvas.requestPointerLock()?.catch(fallback); } catch { fallback(); }
      return;
    }
    const hit = w.__viewer?.probe(
      canvas.clientWidth / 2,
      canvas.clientHeight / 2,
    );
    if (!hit) return;
    if (e.button === 0) send("breakBlock", { pos: hit.block }).catch(error);
    if (e.button === 2) {
      const distances = hit.point.flatMap((v, i) => [
        { distance: Math.abs(v - hit.block[i]), face: [4, 0, 2][i] },
        { distance: Math.abs(v - hit.block[i] - 1), face: [5, 1, 3][i] },
      ]);
      distances.sort((a, b) => a.distance - b.distance);
      send("interactWithBlock", {
        pos: hit.block,
        face: distances[0].face,
        clickPos: hit.point.map((v, i) => v - hit.block[i]),
      }).catch(error);
    }
  });
  const timer = setInterval(async () => {
    if (!active || $("world").contentWindow !== w || w.document !== d) {
      clearInterval(timer);
      return;
    }
    if (busy || (!d.pointerLockElement && !keyboardMode)) return;
    busy = true;
    const pitch = w.__viewerInternals?.store.getState().actor?.rot?.[1] ?? 0;
    const deltaRotation = [
      dx + 3 * (Number(keys.has("ArrowRight")) - Number(keys.has("ArrowLeft"))),
      Math.max(-89.9, Math.min(89.9, pitch + dy + 3 * (Number(keys.has("ArrowDown")) - Number(keys.has("ArrowUp"))))) - pitch,
    ];
    dx = dy = 0;
    try {
      await send("moveRawInput", {
        forward: keys.has("KeyW"),
        back: keys.has("KeyS"),
        left: keys.has("KeyA"),
        right: keys.has("KeyD"),
        sneak: keys.has("ShiftLeft"),
        deltaRotation,
      });
    } catch (e) {
      error(e);
    } finally {
      busy = false;
    }
  }, 50);
};
if (location.hash.startsWith("#connect=")) {
  try {
    const data = JSON.parse(decodeURIComponent(location.hash.slice(9)));
    history.replaceState(null, "", location.pathname);
    settings = { ...settings, ...data.settings, relay: location.origin };
    key = String(data.key || "");
    sessionStorage.setItem("bw-key", key);
    selected = data.server;
    join();
  } catch {
    toast("Invalid connection link");
  }
}
// Original, deterministic voxel panorama; no game artwork is redistributed.
const c = $("landscape"),
  ctx = c.getContext("2d");
function landscape() {
  const scale = 3;
  c.width = Math.ceil(innerWidth / scale);
  c.height = Math.ceil(innerHeight / scale);
  const W = c.width,
    H = c.height;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#77a5b2");
  sky.addColorStop(0.65, "#d3d7ac");
  sky.addColorStop(1, "#647b4c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#efeed4";
  ctx.fillRect(W * 0.76, H * 0.17, 30, 30);
  for (let layer = 0; layer < 5; layer++) {
    for (let x = 0; x < W; x += 5) {
      const y =
        H * (0.39 + layer * 0.115) +
        Math.sin(x * 0.015 + layer * 3) * 25 +
        Math.sin(x * 0.042 + layer) * 10;
      ctx.fillStyle = ["#657e72", "#526e57", "#405e42", "#345536", "#23432e"][
        layer
      ];
      ctx.fillRect(x, Math.floor(y / 5) * 5, 5, H - y + 5);
      if (layer > 1 && Math.sin(x * 7 + layer) > 0.92) {
        const ty = y - 22;
        ctx.fillStyle = "#493e2a";
        ctx.fillRect(x, ty, 5, 30);
        ctx.fillStyle = layer === 4 ? "#526b32" : "#6d8140";
        ctx.fillRect(x - 10, ty - 10, 25, 15);
        ctx.fillRect(x - 5, ty - 18, 15, 10);
      }
    }
  }
}
landscape();
addEventListener("resize", landscape);
