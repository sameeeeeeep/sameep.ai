// ../../../../../packages/protocol/dist/version.js
var PROVIDER_GLOBAL = "claude";

// ../../../../../packages/protocol/dist/errors.js
var BYOPErrorCode = {
  /** User rejected the connect/consent request. (≈ 4001) */
  USER_REJECTED: 4001,
  /** Origin is not connected / has no grant for this method. (≈ 4100) */
  UNAUTHORIZED: 4100,
  /** Method exists but the origin's scope doesn't cover it (model/tool not granted). */
  SCOPE_EXCEEDED: 4110,
  /** A per-action write consent was denied by the user. */
  CONSENT_DENIED: 4120,
  /** Budget or rate limit hit (tokens/day or calls/min). */
  BUDGET_EXCEEDED: 4290,
  /** Unknown method. (≈ 4200) */
  UNSUPPORTED_METHOD: 4200,
  /** Bad params. (≈ -32602) */
  INVALID_PARAMS: -32602,
  /** The sidekick daemon is not installed / not reachable. The SDK maps this to its
   *  "install the sidekick" fallback. */
  PROVIDER_UNAVAILABLE: 4900,
  /** Backend error (model/tool failed for a non-policy reason). */
  BACKEND_ERROR: 4500
};

// ../../../../../packages/sdk/dist/connect-chip.js
function rungFromError(e) {
  if (e?.code !== BYOPErrorCode.PROVIDER_UNAVAILABLE)
    return null;
  return e?.data?.reason === "unpaired" ? { kind: "unpaired" } : { kind: "unreachable" };
}
var CHROME_STORE_URL = "https://chromewebstore.google.com/detail/injmjolmnekmahlnackakiamjepegagb";
var RELAY_DMG_URL = "https://github.com/sameeeeeeep/switchboard/releases/latest/download/Relay.dmg";
var STYLE = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
.chip, .btn { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; border: 0;
  font-size: 13px; font-weight: 600; line-height: 1; border-radius: 10px; }
/* The canonical connect lockup \u2014 the SAME mark + wordmark on every wrapp, so users recognize
   "Connect Switchboard" the way they knew the MetaMask button. Dark pill, lime glyph, locked in
   the shadow root so a host app can't restyle it away. */
.btn { padding: 9px 15px 9px 11px; background: #12151C; color: #E8EDF4; border: 1px solid #2C3444; }
.btn.connect:hover { background: #161B24; border-color: #3A4A18; }
.btn.get { color: #C3CAD6; border-color: #262C38; }
.btn.get:hover { color: #E8EDF4; border-color: #3A4353; }
.btn .arr { color: #6E7C90; font-weight: 500; margin-left: -2px; }
/* The Switchboard mark: lime rounded square with the top-right notch (matches the side-panel brand).
   Muted to slate when the sidekick isn't installed yet \u2014 the mark "lights up" once you can connect. */
.glyph { position: relative; width: 16px; height: 16px; border-radius: 5px; background: #C8F250;
  box-shadow: 0 0 12px rgba(200,242,80,.45); flex: none; }
.glyph::after { content: ""; position: absolute; top: 4px; right: 4px; width: 4px; height: 4px;
  border-radius: 50%; background: #0A0C10; }
.btn.get .glyph { background: #6E7C90; box-shadow: none; }
.wrap { position: relative; display: inline-block; }
.chip { background: #1A1F29; border: 1px solid #262C38; padding: 6px 10px 6px 7px; color: #E8EDF4; }
.chip:hover { border-color: #3A4353; }
.av { width: 26px; height: 26px; border-radius: 7px; background: #C8F250; color: #0A0C10; display: grid;
  place-items: center; font-weight: 700; font-size: 12px; overflow: hidden; flex: none; }
.av img { width: 100%; height: 100%; object-fit: cover; }
.who { display: flex; flex-direction: column; gap: 3px; min-width: 0; text-align: left; }
.who .hi { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.who .proj { font-size: 10.5px; font-weight: 500; color: #99A3B7; white-space: nowrap; }
.caret { color: #6E7C90; font-size: 9px; margin-left: 2px; }
.menu { position: absolute; top: calc(100% + 6px); right: 0; z-index: 2147483000; width: 232px;
  background: #1A1F29; border: 1px solid #262C38; border-radius: 12px; padding: 7px;
  box-shadow: 0 18px 40px -20px rgba(0,0,0,.7); }
.menu .lbl { padding: 8px 10px 6px; font-size: 10px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; color: #6E7C90; }
.menu .proj-row { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 8px;
  background: #20262F; cursor: pointer; border: 0; width: 100%; color: #E8EDF4; font-size: 13px; font-weight: 600; }
.menu .proj-row:hover { background: #262d38; }
.menu .proj-row .go { margin-left: auto; color: #C8F250; font-size: 11px; font-weight: 600; }
.menu .sep { height: 1px; background: #262C38; margin: 6px 4px; }
.menu .item { display: block; width: 100%; text-align: left; padding: 8px 10px; border: 0; border-radius: 8px;
  background: transparent; color: #B4BECE; font-size: 13px; font-weight: 500; cursor: pointer; }
.menu .item:hover { background: #20262F; color: #E8EDF4; }
.menu .foot { padding: 8px 10px 4px; font-size: 11px; font-weight: 500; color: #6E7C90; line-height: 1.4; }
/* Setup-ladder pills (sidekick asleep / unpaired): quiet and informative, never red \u2014 nothing is
   broken. Amber only while the daemon is unreachable; the glyph stays muted until it's reachable. */
.dot { width: 7px; height: 7px; border-radius: 50%; background: #E8B84B; flex: none;
  box-shadow: 0 0 8px rgba(232,184,75,.45); }
.menu .body { padding: 8px 10px 2px; font-size: 12px; font-weight: 500; color: #B4BECE; line-height: 1.45; }
`;
function mountConnect(target, opts = {}) {
  const installUrl = opts.installUrl ?? "https://thelastprompt.ai/switchboard/";
  const host = document.createElement("div");
  host.style.display = "inline-block";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  root.append(style);
  const mount = document.createElement("div");
  root.append(mount);
  target.append(host);
  let state = { kind: "booting" };
  let menuOpen = false;
  let destroyed = false;
  let relay2 = null;
  let seq = 0;
  let wasConnected = false;
  let lastProjectKey;
  let sessionDisconnected = false;
  const onDocClick = (e) => {
    if (menuOpen && !host.contains(e.target)) {
      menuOpen = false;
      render2();
    }
  };
  document.addEventListener("click", onDocClick);
  const initEvent = `${PROVIDER_GLOBAL}#initialized`;
  let lateWatching = false;
  const onLateInit = () => {
    lateWatching = false;
    window.removeEventListener(initEvent, onLateInit);
    if (!destroyed)
      void refresh();
  };
  function watchForLateProvider() {
    if (lateWatching || destroyed)
      return;
    lateWatching = true;
    window.addEventListener(initEvent, onLateInit);
  }
  function el2(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls)
      n.className = cls;
    if (text != null)
      n.textContent = text;
    return n;
  }
  async function refresh() {
    const my = ++seq;
    const r = await whenRelayReady(2500, { installUrl });
    if (destroyed || my !== seq)
      return;
    if (!(r instanceof Relay)) {
      watchForLateProvider();
      state = { kind: "not-installed", installUrl };
      return render2();
    }
    relay2 = r;
    subscribe(r);
    const h = await r.health();
    if (destroyed || my !== seq)
      return;
    if (h && !h.reachable) {
      state = { kind: "unreachable", appMissing: h.installedHere === false };
      emitTransition(false);
      return render2();
    }
    if (h && !h.paired) {
      state = { kind: "unpaired" };
      emitTransition(false);
      return render2();
    }
    let permErr = null;
    const grant = sessionDisconnected ? null : await r.permissions().catch((e) => {
      permErr = e;
      return null;
    });
    if (destroyed || my !== seq)
      return;
    if (!grant) {
      const rung = !h ? rungFromError(permErr) : null;
      if (rung) {
        state = rung;
        emitTransition(false);
        return render2();
      }
      state = { kind: "disconnected", relay: r };
      emitTransition(false);
      return render2();
    }
    const wantsContext = opts.context !== "none";
    const [user, project] = await Promise.all([
      r.identity(),
      wantsContext ? r.context.active().catch(() => null) : Promise.resolve(null)
    ]);
    if (destroyed || my !== seq)
      return;
    const wasAlreadyConnected = wasConnected;
    state = { kind: "connected", relay: r, user, project };
    emitTransition(true);
    const projKey = project ? project.id ?? project.name : null;
    if (wasAlreadyConnected && lastProjectKey !== void 0 && projKey !== lastProjectKey)
      opts.onProjectChange?.(project);
    lastProjectKey = projKey;
    render2();
  }
  function emitTransition(connected) {
    if (connected === wasConnected)
      return;
    wasConnected = connected;
    if (connected && relay2)
      opts.onConnect?.(relay2);
    else if (!connected)
      opts.onDisconnect?.();
  }
  let subscribed = false;
  function subscribe(r) {
    if (subscribed)
      return;
    subscribed = true;
    r.on("permissionsChanged", () => {
      void refresh();
    });
    r.on("disconnect", () => {
      void refresh();
    });
    r.on("health", () => {
      void refresh();
    });
  }
  async function doConnect() {
    if (!relay2)
      return;
    try {
      sessionDisconnected = false;
      await relay2.connect(opts.scope);
      await refresh();
    } catch (e) {
      const err = e;
      if (err?.code !== BYOPErrorCode.PROVIDER_UNAVAILABLE)
        return;
      await refresh();
      if (state.kind === "disconnected") {
        const rung = rungFromError(err);
        if (rung) {
          state = rung;
          emitTransition(false);
          render2();
        }
      }
    }
  }
  async function doPick() {
    if (!relay2)
      return;
    menuOpen = false;
    render2();
    await relay2.context.pick().catch(() => null);
    await refresh();
  }
  async function doDisconnect() {
    if (!relay2)
      return;
    menuOpen = false;
    sessionDisconnected = true;
    await relay2.disconnect().catch(() => {
    });
    await refresh();
  }
  function render2() {
    if (destroyed)
      return;
    mount.textContent = "";
    if (state.kind === "booting")
      return;
    if (state.kind === "not-installed") {
      const url = state.installUrl;
      const wrap2 = el2("div", "wrap");
      const b = el2("button", "btn get");
      b.append(el2("span", "glyph"), el2("span", void 0, "Get Switchboard"), el2("span", "arr", "\u2197"));
      b.onclick = (e) => {
        e.stopPropagation();
        menuOpen = !menuOpen;
        render2();
      };
      wrap2.append(b);
      if (menuOpen) {
        const menu = el2("div", "menu");
        menu.append(el2("div", "body", "Two parts: the Chrome extension, then Relay for Mac."));
        const store = el2("button", "item", "1 \xB7 Add to Chrome \u2197");
        store.onclick = () => {
          menuOpen = false;
          render2();
          window.open(CHROME_STORE_URL, "_blank", "noopener");
        };
        const guide = el2("button", "item", "2 \xB7 Get Relay for Mac \u2197");
        guide.onclick = () => {
          menuOpen = false;
          render2();
          window.open(url, "_blank", "noopener");
        };
        menu.append(store, guide);
        wrap2.append(menu);
      }
      mount.append(wrap2);
      return;
    }
    if (state.kind === "unreachable") {
      const appMissing = state.appMissing === true;
      const wrap2 = el2("div", "wrap");
      const b = el2("button", "btn get");
      b.append(el2("span", "glyph"), el2("span", void 0, appMissing ? "Get Relay for Mac" : "Your sidekick is asleep"), el2("span", appMissing ? "arr" : "dot", appMissing ? "\u2197" : void 0), ...appMissing ? [] : [el2("span", "caret", "\u25BE")]);
      b.onclick = (e) => {
        e.stopPropagation();
        menuOpen = !menuOpen;
        render2();
      };
      wrap2.append(b);
      if (menuOpen) {
        const menu = el2("div", "menu");
        if (appMissing) {
          menu.append(el2("div", "body", "Extension \u2713 \u2014 now the other half: Relay, the Mac app that holds your Claude."));
          const dl = el2("button", "item", "Download Relay.dmg \u2197");
          dl.onclick = () => {
            menuOpen = false;
            render2();
            window.open(RELAY_DMG_URL, "_blank", "noopener");
          };
          menu.append(dl, el2("div", "sep"));
        } else {
          menu.append(el2("div", "body", "Open the Relay menubar app to wake it."));
          const retry = el2("button", "item", "Retry");
          retry.onclick = () => {
            menuOpen = false;
            render2();
            void refresh();
          };
          menu.append(retry, el2("div", "sep"));
        }
        const setup = el2("button", "item", "New here? Full setup \u2197");
        setup.onclick = () => {
          menuOpen = false;
          render2();
          window.open(installUrl, "_blank", "noopener");
        };
        menu.append(setup);
        wrap2.append(menu);
      }
      mount.append(wrap2);
      return;
    }
    if (state.kind === "unpaired") {
      const wrap2 = el2("div", "wrap");
      const b = el2("button", "btn connect");
      b.append(el2("span", "glyph"), el2("span", void 0, "Almost there \u2014 pair in the side panel"), el2("span", "caret", "\u25BE"));
      b.onclick = (e) => {
        e.stopPropagation();
        menuOpen = !menuOpen;
        render2();
      };
      wrap2.append(b);
      if (menuOpen) {
        const menu = el2("div", "menu");
        menu.append(el2("div", "body", "Click the Switchboard icon in your Chrome toolbar and paste your pairing token."));
        const retry = el2("button", "item", "Retry");
        retry.onclick = () => {
          menuOpen = false;
          render2();
          void refresh();
        };
        menu.append(retry);
        wrap2.append(menu);
      }
      mount.append(wrap2);
      return;
    }
    if (state.kind === "disconnected") {
      const b = el2("button", "btn connect");
      b.append(el2("span", "glyph"), el2("span", void 0, "Connect Switchboard"));
      b.onclick = doConnect;
      mount.append(b);
      return;
    }
    const { user, project } = state;
    const rawName = user?.name?.trim();
    const collides = !!rawName && !!project?.name && rawName.toLowerCase() === project.name.toLowerCase();
    const name = !rawName || collides ? "there" : rawName;
    const wrap = el2("div", "wrap");
    const chip = el2("button", "chip");
    const av = el2("div", "av");
    if (user?.avatar) {
      const img = el2("img");
      img.src = user.avatar;
      img.alt = name;
      av.append(img);
    } else
      av.textContent = name.charAt(0).toUpperCase();
    const wantsContext = opts.context !== "none";
    const who = el2("div", "who");
    who.append(el2("div", "hi", `Hi ${name}`));
    who.append(el2("div", "proj", wantsContext ? project ? project.name : "No context lent" : "Connected"));
    chip.append(av, who, el2("span", "caret", "\u25BE"));
    chip.onclick = (e) => {
      e.stopPropagation();
      menuOpen = !menuOpen;
      render2();
    };
    wrap.append(chip);
    if (menuOpen) {
      const menu = el2("div", "menu");
      if (wantsContext) {
        menu.append(el2("div", "lbl", "Working on"));
        const row = el2("button", "proj-row");
        row.append(el2("span", void 0, project ? project.name : "Choose a context"));
        row.append(el2("span", "go", project ? "Switch \u25B8" : "Choose \u25B8"));
        row.onclick = doPick;
        menu.append(row, el2("div", "sep"));
      }
      const dc = el2("button", "item", "Disconnect this app");
      dc.onclick = doDisconnect;
      menu.append(dc);
      menu.append(el2("div", "foot", "Connectors, budgets & activity live in the Switchboard toolbar panel."));
      wrap.append(menu);
    }
    mount.append(wrap);
  }
  render2();
  void refresh();
  return {
    refresh: () => void refresh(),
    destroy: () => {
      destroyed = true;
      document.removeEventListener("click", onDocClick);
      window.removeEventListener(initEvent, onLateInit);
      host.remove();
    }
  };
}

// ../../../../../packages/sdk/dist/index.js
var Relay = class {
  provider;
  constructor(provider) {
    this.provider = provider;
  }
  get version() {
    return this.provider.version;
  }
  capabilities() {
    return this.provider.request({ method: "claude_capabilities" });
  }
  connect(scope) {
    return this.provider.request({ method: "claude_connect", params: scope });
  }
  /** Drop this app's connection for the current page session. The grant persists (a later connect()
   *  won't reprompt) — this is "disconnect from this tab", not "revoke". Full revoke lives in the panel. */
  disconnect() {
    return this.provider.request({ method: "claude_disconnect" });
  }
  permissions() {
    return this.provider.request({ method: "claude_permissions" });
  }
  /** The setup-ladder snapshot (reachable/paired/connected), answered by the EXTENSION from its
   *  own state — never the daemon — so it resolves fast (<1s) in every degraded state, including
   *  the ones where every other method would hang. Resolves null when the extension is too old to
   *  know `claude_health` (or its worker is unreachable): callers MUST treat null as "unknown"
   *  and fall back to probing permissions() exactly as before — that skew guard is load-bearing
   *  while store users run an older extension against newer app bundles. */
  health() {
    const answer = this.provider.request({ method: "claude_health" }).catch(() => null);
    const timer = new Promise((resolve) => setTimeout(() => resolve(null), 1500));
    return Promise.race([answer, timer]);
  }
  /** The paired user's public identity (name/avatar), or null if unavailable. Convenience over
   *  capabilities().user — what the connect chip greets with ("Hi Sameep"). */
  identity() {
    return this.capabilities().then((c) => c.user ?? null).catch(() => null);
  }
  /** Synthesize speech ON-DEVICE via a local model/engine (no cloud, no connector, no credits).
   *  Returns audio as a playable data: URL, or null if no local TTS is available.
   *
   *    const clip = await relay.speak("hey, it's Maya");
   *    if (clip) new Audio(clip.audio).play();
   */
  speak(text, opts) {
    return this.provider.request({ method: "claude_speak", params: { text, voice: opts?.voice } }).catch(() => null);
  }
  listTools() {
    return this.provider.request({ method: "claude_listTools" }).then((r) => r.tools);
  }
  callTool(name, args) {
    const call = { name, arguments: args };
    return this.provider.request({ method: "claude_callTool", params: call });
  }
  complete(params) {
    return this.provider.request({ method: "claude_complete", params });
  }
  /** Streamed completion as an async iterator of deltas. Ends after a `done`/`error` delta. */
  async *stream(params) {
    const { streamId } = await this.provider.request({ method: "claude_stream", params });
    const queue = [];
    let notify = null;
    let ended = false;
    const handler = (payload) => {
      const p = payload;
      if (p.streamId !== streamId)
        return;
      queue.push(p);
      if (p.type === "done" || p.type === "error")
        ended = true;
      notify?.();
    };
    this.provider.on("delta", handler);
    try {
      while (true) {
        if (queue.length === 0) {
          if (ended)
            break;
          await new Promise((r) => notify = r);
          notify = null;
          continue;
        }
        yield queue.shift();
      }
    } finally {
      this.provider.removeListener("delta", handler);
    }
  }
  on(event, handler) {
    this.provider.on(event, handler);
  }
  /**
   * Per-origin local storage — a private on-disk key/value store for this app, plus `bind` to point
   * it at a real folder the user picks. Values are opaque strings (store JSON). Isolated per origin;
   * reads are free, writes need the site not to be read-only, and `bind` prompts for the exact path.
   *
   *   await relay.storage.set("workspace", JSON.stringify(data));
   *   const raw = await relay.storage.get("workspace");
   *   await relay.storage.bind("~/Documents/Projects/brandbrain/.data"); // existing files appear as records
   */
  get storage() {
    const req = (params) => this.provider.request({ method: "claude_storage", params });
    return {
      get: (key) => req({ op: "get", key }).then((r) => r.value ?? null),
      set: (key, value) => req({ op: "set", key, value }).then(() => void 0),
      delete: (key) => req({ op: "delete", key }).then((r) => r.ok),
      list: () => req({ op: "list" }).then((r) => r.keys ?? []),
      info: () => req({ op: "info" }).then((r) => r.info),
      /** Point this app's store at a real folder (triggers a path-consent click). */
      bind: (path) => req({ op: "bind", path }).then((r) => r.info),
      /** Open a NATIVE folder chooser on the daemon's machine (macOS today). The user picking a
       *  folder in an OS dialog that names this origin IS the path consent, so a successful pick
       *  comes back already bound. Resolves undefined on cancel or when no native picker exists —
       *  keep a typed-path `bind` as the fallback UI. */
      pick: (reason) => req({ op: "pick", reason }).then((r) => r.info).catch(() => void 0)
    };
  }
  /**
   * Shared, cross-app context — your portable brand knowledge. Publish a whole context; read the one
   * the user selected for this app; or open the picker. Selection happens in the side panel, so an
   * app only ever receives the context the user chose to lend it — never the whole library.
   *
   *   await relay.context.publish({ name: "Aamras", kind: "brand", data: brand });
   *   const active = await relay.context.active();   // the brand the user loaded for this app, or null
   */
  get context() {
    const req = (params) => this.provider.request({ method: "claude_context", params });
    return {
      publish: (context) => req({ op: "publish", context }).then((r) => r.id),
      list: () => req({ op: "list" }).then((r) => r.contexts ?? []),
      active: () => req({ op: "active" }).then((r) => r.context ?? null),
      pick: () => req({ op: "pick" }).then((r) => r.context ?? null),
      /** Read ONE context listed via `list()` in full, and make it this app's selection. Needs the
       *  kind granted at connect (ScopeRequest.contextKinds) — powers in-app brand dropdowns. */
      use: (id) => req({ op: "use", id }).then((r) => r.context ?? null)
    };
  }
};
var DEFAULT_INSTALL_URL = "https://thelastprompt.ai/switchboard/";
function getRelay(opts) {
  const provider = globalThis[PROVIDER_GLOBAL];
  if (provider?.isRelay)
    return new Relay(provider);
  return { installed: false, installUrl: opts?.installUrl ?? DEFAULT_INSTALL_URL };
}
function whenRelayReady(timeoutMs = 3e3, opts) {
  const now = getRelay(opts);
  if (now instanceof Relay)
    return Promise.resolve(now);
  return new Promise((resolve) => {
    const onInit = () => {
      cleanup();
      resolve(getRelay(opts));
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve({ installed: false, installUrl: opts?.installUrl ?? DEFAULT_INSTALL_URL });
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener(`${PROVIDER_GLOBAL}#initialized`, onInit);
    }
    window.addEventListener(`${PROVIDER_GLOBAL}#initialized`, onInit);
  });
}

// src/kit/livestore.js
var ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,96}$/;
var safeId = (id) => ID_RE.test(String(id)) ? String(id) : null;
function collection(relay2, name) {
  if (!relay2?.storage) throw new Error("collection(relay, name): relay.storage is required");
  const prefix = String(name).replace(/[^A-Za-z0-9]/g, "") || "rec";
  const keyOf = (id) => `${prefix}-${id}`;
  const idOf = (key) => key.slice(prefix.length + 1);
  const mine = (key) => key.startsWith(prefix + "-") && !!safeId(idOf(key));
  return {
    /** All records as `[{ id, ...record }]`. Re-reads the whole set — a record that vanished since
     *  last call simply isn't here; one that appeared is. Order is by id (stable across members). */
    async all() {
      let keys = [];
      try {
        keys = await relay2.storage.list();
      } catch {
        return [];
      }
      const ids = keys.filter(mine).map(idOf).sort();
      const out = await Promise.all(ids.map(async (id) => {
        try {
          const raw = await relay2.storage.get(keyOf(id));
          if (raw == null) return null;
          return { id, ...JSON.parse(raw) };
        } catch {
          return null;
        }
      }));
      return out.filter(Boolean);
    },
    async get(id) {
      const sid = safeId(id);
      if (!sid) return null;
      try {
        const raw = await relay2.storage.get(keyOf(sid));
        return raw == null ? null : { id: sid, ...JSON.parse(raw) };
      } catch {
        return null;
      }
    },
    /** Upsert one record. The stored value never includes `id` (it's in the filename). */
    async put(id, record) {
      const sid = safeId(id);
      if (!sid) throw new Error("collection.put: invalid id");
      const { id: _drop, ...body } = record || {};
      await relay2.storage.set(keyOf(sid), JSON.stringify(body));
      return sid;
    },
    async remove(id) {
      const sid = safeId(id);
      if (!sid) return false;
      try {
        return await relay2.storage.delete(keyOf(sid));
      } catch {
        return false;
      }
    },
    key: keyOf
  };
}
function mountLive(relay2, reload, opts = {}) {
  const throttleMs = opts.throttleMs ?? 1500;
  let last = 0;
  let inflight = null;
  let stopped = false;
  const run = () => {
    if (inflight) return inflight;
    last = Date.now();
    inflight = Promise.resolve().then(() => reload()).catch((e) => {
      try {
        opts.onError?.(e);
      } catch {
      }
    }).finally(() => {
      inflight = null;
    });
    return inflight;
  };
  const throttled = () => {
    if (stopped || !relay2) return;
    if (Date.now() - last < throttleMs) return;
    void run();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") throttled();
  };
  document.addEventListener("visibilitychange", onVisible);
  try {
    relay2?.on?.("permissionsChanged", throttled);
  } catch {
  }
  return {
    /** Force a reload now, ignoring the throttle (shares any in-flight read). */
    reloadNow: () => run(),
    /** Unwire — call on teardown. */
    stop: () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      try {
        relay2?.removeListener?.("permissionsChanged", throttled);
      } catch {
      }
    }
  };
}

// src/autopilot.js
var APP = {
  id: "autopilot",
  name: "Autopilot",
  installUrl: "https://thelastprompt.ai/switchboard/",
  scope: {
    reason: "Autopilot \u2014 drafts and re-drafts the operating slate for the companies you bring it",
    models: ["sonnet"],
    tools: [],
    // Autopilot RUNS whatever you already have. brandbrain publishes `brand`, ideabrain publishes
    // `idea`, Bank + the store's pointer publish `brand`/`project` — all four are companies to
    // operate. Narrowing this to ["brand"] would re-narrow the app to D2C and break the
    // ideabrain → run graduation, which is the whole point of the verb.
    contextKinds: ["brand", "project", "idea"]
  },
  usesContext: "single"
};
var $ = (id) => document.getElementById(id);
var el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
var uid = () => Math.random().toString(36).slice(2, 9);
var msg = (e) => String(e?.message || e).slice(0, 160);
var esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
var toastT = null;
function toast(text, err) {
  clearTimeout(toastT);
  let t = document.querySelector(".toast");
  if (!t) {
    t = el("div", "toast");
    document.body.append(t);
  }
  t.className = "toast" + (err ? " err" : "");
  t.textContent = text;
  toastT = setTimeout(() => t.remove(), 3200);
}
var relay = null;
var notInstalled = false;
var brand = null;
var wired = false;
var live = null;
mountConnect($("chip-dock"), {
  scope: APP.scope,
  context: APP.usesContext,
  installUrl: APP.installUrl,
  onConnect: (r) => {
    relay = r;
    wire(r);
    void onReady();
  },
  onDisconnect: () => {
    relay = null;
    render();
  },
  onProjectChange: () => {
    void syncContext();
  }
});
(async () => {
  const r = await whenRelayReady(2e3, { installUrl: APP.installUrl });
  if (r && "connect" in r) {
    const grant = await r.permissions().catch(() => null);
    if (grant) {
      relay = r;
      wire(r);
      void onReady();
      return;
    }
  } else if (r && r.installed === false) notInstalled = true;
  render();
})();
function wire(r) {
  if (wired) return;
  wired = true;
  r.on("permissionsChanged", () => void syncContext());
  live = mountLive(r, reloadState);
}
var hydrated = false;
async function onReady() {
  await syncContext();
  if (!hydrated) {
    hydrated = true;
    await loadState();
  }
  render();
  autostart();
  void discoverTools().then(() => render()).catch(() => {
  });
}
async function reloadState() {
  if (!relay) return;
  await loadState();
  render();
}
async function syncContext() {
  if (!relay) return;
  if (APP.usesContext === "single") brand = await relay.context.active().catch(() => null);
  render();
}
var companies = null;
var cos = [];
var activeId = null;
async function loadState() {
  if (!companies) companies = collection(relay, "autopilot-co");
  const stored = await companies.all();
  const byId = new Map(stored.map((c) => [c.id, c]));
  for (const c of cos) if (!byId.has(c.id) || drafting.has(c.id)) byId.set(c.id, c);
  cos = [...byId.values()].sort((a, b) => (a.at || 0) - (b.at || 0));
  if (!cos.some((c) => c.id === activeId)) activeId = cos[0]?.id || null;
}
var saveFails = 0;
async function saveCo(co) {
  if (!companies || !co) return;
  co.at = co.at || Date.now();
  try {
    await companies.put(co.id, co);
    saveFails = 0;
  } catch (e) {
    if (++saveFails >= 2) {
      saveFails = 0;
      toast("Couldn't save to disk \u2014 your work is on screen but not written. " + msg(e), true);
    }
  }
}
function parseJsonArray(text) {
  const t = String(text || "").replace(/```[a-z]*\n?/gi, "").trim();
  const s = t.indexOf("["), e = t.lastIndexOf("]");
  if (s === -1 || e <= s) return null;
  try {
    const a = JSON.parse(t.slice(s, e + 1));
    return Array.isArray(a) ? a : null;
  } catch {
    return null;
  }
}
function researching(status) {
  const r = el("div", "researching");
  r.append(el("div", "scan"), el("span", null, status || "working\u2026"));
  return r;
}
function ghostGrid() {
  const grid = el("div", "grid ghost");
  const COLS = [
    ["COMPANY", "identity, the live site, revenue and runway"],
    ["OPERATIONS", "the day's tasks, the decision slate, the log"],
    ["GROWTH", "ads, social and outreach \u2014 drafted, never sent"],
    ["STRATEGY", "a CEO that reads the board and answers you"]
  ];
  for (const [head, sub] of COLS) {
    const c = el("div", "col");
    c.append(el("div", "chead", head));
    const card = el("div", "card ghostcard");
    card.append(el("div", "gline w70"), el("div", "gline w45"), el("div", "gsub", sub));
    c.append(card, el("div", "card ghostcard mini"));
    grid.append(c);
  }
  return grid;
}
function entryChooser() {
  const wrap = el("div", "cock dormant");
  const call = el("div", "dormcall");
  call.append(el("div", "dormline", "A company that runs itself."));
  const opts = el("div", "entryopts");
  const own = el("button", "entryopt own");
  own.append(el("div", "eo-t", "\u26A1 Start your own"), el("div", "eo-d", "Bring a brand, a product or an idea \u2014 runs on your own Claude"));
  own.onclick = () => {
    const b = document.querySelector("#chip-dock button");
    if (b) b.click();
  };
  const ex = el("button", "entryopt");
  ex.append(el("div", "eo-t", "\u{1F3B2} Explore an example"), el("div", "eo-d", "Watch a real company already running \u2014 no sign-in"));
  ex.onclick = () => loadPreview(PRESETS[Math.floor(Math.random() * PRESETS.length)]);
  opts.append(own, ex);
  call.append(opts);
  wrap.append(call, ghostGrid());
  return wrap;
}
function previewBanner(co) {
  const bar = el("div", "previewbar");
  const l = el("div", "pvl");
  l.append(el("span", "pvdot"), el("span", "pvtxt"));
  l.querySelector(".pvtxt").append(el("b", null, "Live preview \u2014 " + co.name + ". "), document.createTextNode(relay ? "Nothing here is running yet; make it yours to operate it on your Claude." : "Connect your Claude to run this yourself, or start your own."));
  const r = el("div", "pvr");
  const another = el("button", "pvghost", "\u21BB another example");
  another.onclick = () => anotherPreview();
  const adopt = el("button", "pvprimary", relay ? "Make it mine \u2192" : "Connect your Claude \u2192");
  adopt.onclick = () => relay ? void adoptPreset(co) : (document.querySelector("#chip-dock button") || {}).click?.();
  const exit = el("button", "pvghost", "\u2715");
  exit.onclick = () => {
    previewing = false;
    previewCo = null;
    render();
  };
  r.append(another, adopt, exit);
  bar.append(l, r);
  return bar;
}
function disconnectedBar() {
  const bar = el("div", "previewbar warn");
  const l = el("div", "pvl");
  l.append(el("span", "pvdot"), el("span", "pvtxt"));
  l.querySelector(".pvtxt").append(el("b", null, "Switchboard disconnected. "), document.createTextNode("Your board is safe and read-only \u2014 reconnect to keep operating. Autopilot is paused."));
  const r = el("div", "pvr");
  const rc = el("button", "pvprimary", "Reconnect \u2192");
  rc.onclick = () => (document.querySelector("#chip-dock button") || {}).click?.();
  r.append(rc);
  bar.append(l, r);
  return bar;
}
var MODES = {
  auto: { tag: "Auto", note: "Drafts and previews only \u2014 nothing leaves this machine." },
  approve: { tag: "Needs you", note: "Irreversible, costs money, or faces the public. It stages; you tap go." },
  manual: { tag: "Yours", note: "Only you can do this one, out in the real world." }
};
var SPEC = [
  {
    id: "voice",
    label: "Voice",
    axis: "HOW IT TALKS, AND TO WHOM",
    deps: [],
    inherit: "voice",
    ask: "3 distinct voices this company could speak in. Each must create a genuinely DIFFERENT relationship with the customer \u2014 not three shades of friendly.",
    fields: '"label":<2-4 words>,"text":<one sentence on the relationship it creates>,"lines":[<exactly 3 sentences written IN that voice, as this company would actually say them>]'
  },
  {
    id: "angle",
    label: "Ad angle",
    axis: "WHAT THE AD IS ACTUALLY ABOUT",
    deps: ["voice"],
    ask: "3 ad angles. Each must answer a DIFFERENT objection a real buyer actually has. Write every line in the chosen voice.",
    fields: '"label":<2-4 words naming the angle>,"text":<the headline>,"body":<one sentence of body copy>,"cta":<2-3 word call to action>'
  },
  {
    id: "channel",
    label: "Channel",
    axis: "WHERE IT RUNS, AND WHY THERE",
    deps: ["angle"],
    ask: "3 places to run this angle. Each must be somewhere this specific buyer already is \u2014 say why there, and what it actually costs in effort to start.",
    fields: '"label":<the channel>,"text":<why this buyer is there>,"body":<what it takes to start \u2014 concrete effort, not money>'
  },
  {
    id: "next",
    label: "Next move",
    axis: "WHAT WIDENS THE COMPANY",
    deps: [],
    ask: "3 next moves that would widen the company \u2014 a new product, format, segment or surface. Each must be a specific named thing, not a category.",
    fields: '"label":<what kind of move it is, 2-3 words>,"text":<the move itself, specific and named>,"body":<one sentence on why now>'
  }
];
var SPEC_BY_ID = Object.fromEntries(SPEC.map((s) => [s.id, s]));
function decision(s) {
  return {
    id: s.id,
    label: s.label,
    axis: s.axis,
    deps: s.deps.slice(),
    options: [],
    draftedId: null,
    chosenId: null,
    chosenAt: null,
    stale: false,
    inherited: null
  };
}
function draft(d) {
  const rec = d.options.find((o) => o.rec) || d.options[0];
  d.draftedId = rec ? rec.id : null;
  d.stale = false;
  return d;
}
var optOf = (d) => d.options.find((o) => o.id === d.chosenId) || null;
var shownOf = (d) => optOf(d) || d.options.find((o) => o.id === d.draftedId) || d.options[0] || null;
var isChosen = (d, o) => d.chosenId === o.id;
var isDrafted = (d, o) => !d.chosenId && d.draftedId === o.id;
var clock = () => (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5);
async function choose(co, d, optId) {
  if (guardWrite(co)) return;
  if (d.chosenId === optId) return;
  d.chosenId = optId;
  d.chosenAt = clock();
  d.stale = false;
  const o = optOf(d);
  logLine(co, "you chose " + (o ? o.label : "an option") + " for " + d.label.toLowerCase(), "done", d.id);
  const stale = markStale(co, d.id);
  await saveCo(co);
  render();
  if (stale.length) await restream(co, stale);
}
async function unchoose(co, d) {
  d.chosenId = null;
  d.chosenAt = null;
  const stale = markStale(co, d.id);
  await saveCo(co);
  render();
  if (stale.length) await restream(co, stale);
}
async function ownOption(co, d, text) {
  const o = { id: "own" + uid(), label: text.slice(0, 60), text: "", own: true };
  d.options.push(o);
  logLine(co, "you wrote your own " + d.label.toLowerCase(), "done", d.id);
  await choose(co, d, o.id);
}
function markStale(co, changedId) {
  const out = [];
  for (const d of Object.values(co.decisions)) {
    if (!d.deps.includes(changedId)) continue;
    d.stale = true;
    if (d.chosenId && !d.options.some((o) => o.id === d.chosenId)) d.chosenId = null;
    out.push(d.id, ...markStale(co, d.id));
  }
  return out;
}
async function restream(co, ids) {
  for (const id of ids) {
    const d = co.decisions[id];
    if (!d) continue;
    try {
      await genOptions(co, id, "restream");
    } catch (e) {
      d.error = msg(e);
    }
    await saveCo(co);
    render();
  }
  logLine(co, "restreamed " + ids.length + " decision" + (ids.length === 1 ? "" : "s") + " downstream", "run", ids[0]);
  await saveCo(co);
  render();
}
var estimateTokens = (s) => Math.ceil(String(s || "").length / 4);
function spend(co, n, area, estimated) {
  co.tokens.spent += n;
  co.tokens.by[area] = (co.tokens.by[area] || 0) + n;
  if (estimated) co.tokens.estimated = true;
}
function logLine(co, text, state, target) {
  co.log.unshift({ t: text, s: state, target, at: clock() });
  co.log = co.log.slice(0, 14);
}
async function completeCounted(prompt, maxTokens) {
  const res = await relay.complete({ prompt, model: "sonnet", maxTokens: maxTokens || 1400 });
  const u = res?.usage;
  const text = res?.text || "";
  const tokens = u ? (u.inputTokens || 0) + (u.outputTokens || 0) : estimateTokens(prompt) + estimateTokens(text);
  return { text, tokens, estimated: !u };
}
function groundingBlock(co) {
  const parts = [];
  if (co.oneLine) parts.push(co.name + " \u2014 " + co.oneLine);
  else parts.push(co.name);
  const inh = co.inherited || {};
  for (const [k, v] of Object.entries(inh)) {
    if (v == null || v === "") continue;
    if ((co.overridden || []).includes(k)) continue;
    const flat = Array.isArray(v) ? v.filter((x) => typeof x === "string").join(", ") : typeof v === "string" ? v : "";
    if (flat) parts.push(k + ": " + flat.slice(0, 400));
  }
  return "The company:\n" + parts.join("\n");
}
async function genOptions(co, id, reason) {
  const s = SPEC_BY_ID[id];
  const d = co.decisions[id];
  if (!s || !d) return;
  d.busy = true;
  d.error = null;
  render();
  const upstream = s.deps.map((dep) => {
    const ud = co.decisions[dep];
    if (!ud) return "";
    if (ud.inherited) return `${ud.label} is "${ud.inherited.value}" \u2014 inherited, treat as settled.`;
    const uo = shownOf(ud);
    return uo ? `${ud.label} is "${uo.label}" \u2014 ${uo.text || ""}`.trim() : "";
  }).filter(Boolean);
  const prompt = [
    "You are Autopilot. You operate a real company and propose its next decisions.",
    groundingBlock(co),
    upstream.length ? "Already decided \u2014 obey these exactly:\n" + upstream.join("\n") : "",
    "Propose " + s.ask,
    `Return ONLY a JSON array of 3 objects \u2014 no prose, no fences. Each: {${s.fields},"recommended":<true for exactly one>}`,
    "Ground every option in the company above. If you don't know a fact, say what you'd need instead \u2014 never invent a metric, a customer, a price or a result."
  ].filter(Boolean).join("\n\n");
  try {
    const { text, tokens, estimated } = await completeCounted(prompt);
    spend(co, tokens, reason === "restream" ? "restream" : "draft", estimated);
    const arr = parseJsonArray(text);
    if (!arr || !arr.length) throw new Error("no options came back \u2014 try again");
    const own = d.options.filter((o) => o.own);
    const machine = arr.slice(0, 4).map((o) => ({
      id: uid(),
      label: String(o.label || "Option").slice(0, 60),
      text: String(o.text || "").slice(0, 400),
      body: o.body ? String(o.body).slice(0, 400) : "",
      cta: o.cta ? String(o.cta).slice(0, 40) : "",
      lines: Array.isArray(o.lines) ? o.lines.slice(0, 3).map((l) => String(l).slice(0, 240)) : null,
      rec: !!o.recommended
    }));
    if (!machine.some((o) => o.rec)) machine[0].rec = true;
    d.options = machine.concat(own);
    draft(d);
  } catch (e) {
    d.error = msg(e);
  } finally {
    d.busy = false;
  }
}
var PALETTE = ["#2f6b45", "#2b4a7a", "#6b3f2f", "#4a2f6b", "#6b2f4a", "#2f5f6b"];
var slugOf = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || uid();
var KINDS = {
  // physical:true → ships real goods (has a supply chain); absent → digital (nothing to source/ship).
  brand: { label: "BRAND", deployNoun: "landing page", deployVerb: "Build the site", offerNoun: "product", econ: "sales", physical: true, host: (s) => s + ".site" },
  product: { label: "PRODUCT", deployNoun: "product site", deployVerb: "Build the site", offerNoun: "product", econ: "sales", host: (s) => s + ".app" },
  wrapp: { label: "WRAPP", deployNoun: "wrapp", deployVerb: "Ship the wrapp", offerNoun: "the wrapp", econ: "usage", host: (s) => s + ".sameep.ai" }
};
var KIND_OF = { brand: "brand", company: "brand", project: "product", idea: "product", product: "product", wrapp: "wrapp" };
var resolveKind = (raw) => KIND_OF[String(raw || "").toLowerCase()] || "brand";
var kindCfg = (co) => KINDS[co && co.kind] || KINDS.brand;
var AUTONOMY_LANES = [
  { id: "decide", label: "Decide the slate", note: "pick the recommended voice, angle, channel and next move" },
  { id: "product", label: "Draft the product", note: "shape a first paid offer from the context" },
  { id: "site", label: "Draft the site", note: "write the landing copy \u2014 publishing still waits for you" },
  { id: "social", label: "Draft social", note: "write launch posts in the company's voice" },
  { id: "outreach", label: "Draft outreach", note: "write cold emails to the first buyers" },
  { id: "plan", label: "Plan & report", note: "review the board and post what moved and what's next" }
];
var DEFAULT_POLICY = Object.fromEntries(AUTONOMY_LANES.map((l) => [l.id, true]));
function newCompany(cfg) {
  const kind = resolveKind(cfg.kind);
  const co = {
    id: cfg.id,
    name: cfg.name,
    kind,
    kindLabel: KINDS[kind].label,
    oneLine: cfg.oneLine || "",
    ctxId: cfg.ctxId || null,
    ctxName: cfg.ctxName || null,
    inherited: cfg.inherited || {},
    glyph: (cfg.name || "?").trim().charAt(0).toUpperCase(),
    color: PALETTE[Math.abs(hashOf(cfg.id)) % PALETTE.length],
    ink: "#EAF2E4",
    tokens: { spent: 0, budget: 2e6, by: {}, estimated: false },
    // ---- the OS state: everything a company runs on, beyond its decisions. All of it derives
    // from the slate or from an explicit human action — nothing here is invented data.
    site: cfg.domain ? { host: cfg.domain, live: false } : null,
    // `revenue` for sales kinds, `uses`/`payout` for usage (wrapp) kinds. null = "not connected".
    metrics: { revenue: null, traffic: null, uses: null, payout: null },
    tasks: [],
    // { id, title, detail, state: queued|running|done|blocked, recurring, at }
    posts: [],
    // social drafts: { id, channel, text, state: draft|staged|posted, at, ref }
    inbox: [],
    // outreach drafts: { id, to, subject, body, state, at, ref }
    chat: [],
    // CEO thread: { id, who: ceo|you, text, at }
    autotweet: false,
    // when true, a generated post stages instead of sitting as a silent draft
    // AUTONOMY: off by default. Turning it on IS the authorizing human act — thereafter the CEO
    // advances the company on its own for everything REVERSIBLE (deciding, drafting, planning).
    // Anything that leaves the machine still stages for the daemon's per-action consent; autonomy
    // never widens to irreversible sends. `cursor` remembers what the loop did last so it advances
    // instead of repeating.
    auto: { on: false, cursor: 0, at: 0 },
    policy: { ...DEFAULT_POLICY },
    // the autonomy line — which reversible lanes the CEO runs unattended
    log: [],
    decisions: {},
    at: Date.now()
  };
  for (const s of SPEC) co.decisions[s.id] = decision(s);
  for (const s of SPEC) {
    if (!s.inherit) continue;
    const v = co.inherited[s.inherit];
    if (typeof v === "string" && v.trim()) {
      co.decisions[s.id].inherited = { from: cfg.ctxName || cfg.name, value: v.trim() };
    }
  }
  return co;
}
function hashOf(s) {
  let h = 0;
  const t = String(s || "");
  for (let i = 0; i < t.length; i++) h = h * 31 + t.charCodeAt(i) | 0;
  return h;
}
var CO = () => cos.find((c) => c.id === activeId) || null;
function inheritFrom(ctx) {
  const d = ctx.data || {};
  const keep = ["voice", "positioning", "audience", "oneLine", "summary", "state", "category", "priceRange", "domain"];
  const out = {};
  for (const k of keep) if (typeof d[k] === "string" && d[k].trim()) out[k] = d[k].trim();
  for (const k of ["palette", "products", "stack", "roadmap"]) {
    if (Array.isArray(d[k]) && d[k].length) out[k] = d[k].filter((x) => typeof x === "string");
  }
  return out;
}
var OPT = (o) => ({ id: "p-" + Math.abs(hashOf(JSON.stringify(o))).toString(36).slice(0, 7), rec: true, ...o });
function presetCo(p) {
  const co = newCompany({ id: "preset-" + slugOf(p.name), name: p.name, kind: p.kind, oneLine: p.oneLine });
  const set = (id, opt) => {
    const d = co.decisions[id];
    d.options = [OPT(opt)];
    d.chosenId = d.options[0].id;
    d.draftedId = d.options[0].id;
    d.chosenAt = "09:04";
  };
  set("voice", p.voice);
  set("angle", p.angle);
  set("channel", p.channel);
  set("next", p.next);
  if (p.product) co.product = { ...p.product, drafted: true, live: false, at: "09:12" };
  if (p.site) co.site = { host: p.site.host, drafted: true, live: false, html: null };
  co.posts = (p.posts || []).map((text, i) => ({ id: "pp" + i, channel: "social", text, state: "draft", at: "09:20" }));
  co.log = [
    { t: "drafted the launch posts", s: "done", at: "09:20", target: null },
    { t: p.product ? "drafted the product \u2014 " + p.product.name : "built the " + kindCfg(co).deployNoun, s: "done", at: "09:12", target: null },
    { t: "decided the slate \u2014 voice, angle, channel and the next move", s: "done", at: "09:04", target: null },
    { t: "invented " + p.name + " and started running it", s: "run", at: "09:00", target: null }
  ];
  co.preset = true;
  return co;
}
var PRESETS = [
  presetCo({
    name: "Brightwool",
    kind: "brand",
    oneLine: "Merino dryer balls that cut drying time and kill static \u2014 plastic-free laundry for busy homes.",
    voice: { label: "Practical & warm", text: "Talks to a tired parent like a neighbour who's tried everything.", lines: ["Softer laundry, shorter loads, zero plastic.", "Toss three in, skip the dryer sheet, get your evening back.", "Spun from a single fleece \u2014 compostable when they're finally done."] },
    angle: { label: "Time, not virtue", text: "Cut ~25% off every dryer load", body: "Lead with the minutes saved, not the eco-halo \u2014 the planet win is the bonus.", cta: "Shorten a load" },
    channel: { label: "Instagram Reels", text: "Tired parents scroll Reels after bedtime; a 15-second before/after lands.", body: "Film three loads on your phone, post the timer side-by-side \u2014 no budget, one evening." },
    next: { label: "Product line", text: "A refill scent kit (essential-oil drops) so the balls become a repeat purchase.", body: "Turns a one-time buy into a subscription with no new tooling." },
    product: { name: "Brightwool Trio", price: 24, blurb: "Three XL Merino dryer balls that shave ~25% off dryer time and replace a thousand dryer sheets." },
    site: { host: "brightwool.site" },
    posts: ["The dryer-sheet aisle is a scam. Three wool balls, one fleece, a thousand loads. \u23F1\uFE0F down ~25%.", "Before: 68 min. After: 51 min. Same dryer, same clothes, minus the plastic.", "Your towels don't need fabric softener. They need air. That's the whole trick."]
  }),
  presetCo({
    name: "Feedback Fox",
    kind: "product",
    oneLine: "Turns your app-store and support reviews into one ranked action list every Monday.",
    voice: { label: "Blunt operator", text: "Speaks to a solo founder with no time \u2014 signal only, no fluff.", lines: ["Your reviews already told you what to fix. We just ranked it.", "One list. Monday. Sorted by revenue at risk.", "Stop reading 400 reviews \u2014 read the five that matter."] },
    angle: { label: "Churn you can see", text: "The five fixes keeping people from paying", body: "Frame it as revenue-at-risk, not sentiment \u2014 founders act on money, not stars.", cta: "See your list" },
    channel: { label: "Indie Hackers + X", text: "Solo founders live in build-in-public threads; a weekly 'top 5 fixes' teardown travels.", body: "Post one real teardown of a public app's reviews a week \u2014 pure reach, no ad spend." },
    next: { label: "New surface", text: "A Slack digest so the list lands where the team already argues about priorities.", body: "Lifts it from a solo tool to a team ritual, where it meets the decision." },
    product: { name: "Fox Weekly", price: 19, blurb: "A $19/mo Monday digest: your reviews across App Store, Play and support, ranked by revenue at risk." },
    site: { host: "feedbackfox.app" },
    posts: ["You don't have a product problem. You have a 'nobody read the reviews' problem.", "400 reviews \u2192 5 fixes \u2192 ranked by the revenue they're bleeding. Every Monday, 9am.", "We read your one-star reviews so you can go build. This week's top fix \u{1F447}"]
  }),
  presetCo({
    name: "Comet Replies",
    kind: "wrapp",
    oneLine: "A tiny web tool that drafts on-brand support replies from your ten best answers.",
    voice: { label: "Calm & exact", text: "Sounds like your best support rep on a good day \u2014 kind, precise, never robotic.", lines: ["Same answer, your voice, in three seconds.", "It learns from your ten best replies, not a generic script.", "You approve every word before it sends."] },
    angle: { label: "Backlog to zero", text: "Clear the queue without sounding like a bot", body: "Sell the empty inbox and the kept voice \u2014 the fear is generic AND slow.", cta: "Draft a reply" },
    channel: { label: "Product Hunt + support ops", text: "Support leads swap macros in Slack/Discord groups; a free tool spreads there.", body: "Launch on PH, seed the support-ops communities \u2014 one good day carries it." },
    next: { label: "New surface", text: "A Gmail / Help Scout side-panel so it drafts where tickets already live.", body: "Removes the copy-paste \u2014 the wrapp becomes invisible infrastructure." },
    product: null,
    site: { host: "comet" },
    posts: ["Support replies that sound like you, not a 2019 chatbot. Ten examples in, done.", "Your queue at 40. Your queue at 0. Same voice the whole way down.", "We don't write your replies. We write YOUR reply, in your words, and wait for your yes."]
  }),
  presetCo({
    name: "Cellar Society",
    kind: "brand",
    oneLine: "A monthly natural-wine club: three low-intervention bottles for people bored of supermarket wine.",
    voice: { label: "Insider, unstuffy", text: "A sommelier friend who hates wine snobbery and texts you the good stuff.", lines: ["Three bottles a month, zero lectures, no scores out of 100.", "Made by people, not factories \u2014 you'll taste it by bottle two.", "If a bottle's a miss, tell us; the next box learns."] },
    angle: { label: "Anti-supermarket", text: "Wine that tastes like someone made it", body: "Position against the boring grocery shelf, not other clubs \u2014 the enemy is sameness.", cta: "Taste the first box" },
    channel: { label: "Instagram + dinner-party word of mouth", text: "The buyer hosts; a beautiful box on the table is the ad. Reels of the pour + a referral bottle.", body: "Film the unboxing and a pour; give a free bottle for every friend who joins." },
    next: { label: "Product line", text: "A 'cellar starter' six-pack with a fridge-magnet pairing guide, built for gifting.", body: "Opens the gifting occasion \u2014 the highest-intent, highest-margin buyer." },
    product: { name: "The First Box", price: 45, blurb: "Three low-intervention bottles picked to your taste, $45/month, cancel anytime, misses replaced free." },
    site: { host: "cellarsociety.site" },
    posts: ["Supermarket wine is engineered to taste the same in every bottle. We picked the opposite.", "Three bottles. Real people made them. No scores, no snobbery, no plonk.", "Bottle one you'll like. Bottle two you'll get it. Bottle three you'll cancel your other wine."]
  })
];
var previewing = false;
var previewCo = null;
function loadPreview(preset) {
  previewCo = structuredClone(preset);
  previewCo.preview = true;
  previewing = true;
  creating = false;
  portfolio = false;
  pane = null;
  render();
}
function anotherPreview() {
  const pool = PRESETS.filter((p) => !previewCo || p.id !== previewCo.id);
  loadPreview(pool[Math.floor(Math.random() * pool.length)] || PRESETS[0]);
}
async function adoptPreset(src) {
  if (!relay) {
    promptConnect("Connect your Claude to make " + src.name + " yours and run it.");
    return;
  }
  const co = structuredClone(src);
  co.id = slugOf(src.name) + "-" + uid().slice(0, 4);
  co.preset = false;
  co.preview = false;
  co.owned = true;
  co.at = Date.now();
  cos.push(co);
  activeId = co.id;
  previewing = false;
  previewCo = null;
  creating = false;
  logLine(co, "made " + co.name + " yours \u2014 it's on your Claude now, edit anything", "run", null);
  await saveCo(co);
  render();
}
function guardWrite(co) {
  if (co && co.preview) {
    void adoptPreset(co);
    return true;
  }
  if (!relay) {
    promptConnect("Switchboard is disconnected \u2014 reconnect to keep operating.");
    return true;
  }
  return false;
}
function promptConnect(m) {
  toast(m, false);
  const b = document.querySelector("#chip-dock button");
  if (b) {
    try {
      b.focus();
    } catch {
    }
  }
}
async function seedFromContext() {
  const inherited = inheritFrom(brand);
  const co = newCompany({
    id: slugOf(brand.id || brand.name),
    name: brand.name || "Company",
    kind: brand.kind || "company",
    // resolveKind maps brand/project/idea/wrapp → a venture kind
    oneLine: inherited.oneLine || inherited.summary || inherited.positioning || "",
    ctxId: brand.id,
    ctxName: brand.name,
    inherited
  });
  if (cos.some((c) => c.id === co.id || c.ctxId && c.ctxId === co.ctxId)) {
    activeId = cos.find((c) => c.id === co.id || c.ctxId && c.ctxId === co.ctxId).id;
    creating = false;
    render();
    toast("You're already running " + co.name + " \u2014 switched to it.");
    return;
  }
  cos.push(co);
  activeId = co.id;
  creating = false;
  logLine(co, "picked up " + co.name + " from your lent context", "done", null);
  await saveCo(co);
  render();
  await draftSlate(co);
}
async function seedFromLine(line, kind) {
  const m = line.match(/^\s*([^\u2014\u2013\-:|]{2,40}?)\s*[\u2014\u2013\-:|]\s*(.+)$/);
  const name = (m ? m[1] : line).trim().slice(0, 40);
  const oneLine = (m ? m[2] : line).trim();
  const co = newCompany({ id: slugOf(name) + "-" + uid().slice(0, 4), name, oneLine, kind: kind || "brand" });
  cos.push(co);
  activeId = co.id;
  creating = false;
  logLine(co, "seeded a " + kindCfg(co).label.toLowerCase() + " from one line", "done", null);
  await saveCo(co);
  render();
  await draftSlate(co);
}
var drafting = /* @__PURE__ */ new Set();
async function draftSlate(co) {
  if (!co || drafting.has(co.id)) return;
  drafting.add(co.id);
  try {
    const chain = (async () => {
      for (const id of ["voice", "angle", "channel"]) {
        const d = co.decisions[id];
        if (d.inherited) {
          d.stale = false;
          continue;
        }
        await genOptions(co, id, "draft");
        await saveCo(co);
        render();
      }
    })();
    const solo = (async () => {
      await genOptions(co, "next", "draft");
      await saveCo(co);
      render();
    })();
    await Promise.all([chain, solo]);
    logLine(co, "drafted the operating slate \u2014 nothing chosen yet", "run", null);
  } finally {
    drafting.delete(co.id);
    await saveCo(co);
    render();
  }
}
var toolNames = null;
async function discoverTools() {
  if (toolNames) return toolNames;
  try {
    const t = await relay.listTools();
    toolNames = (t || []).map((x) => String(x.name || x).toLowerCase());
  } catch {
    toolNames = [];
  }
  return toolNames;
}
var LANE_MATCH = {
  social: /tweet|twitter|\bx_|social|post_to|linkedin/i,
  inbox: /create_draft|gmail|mail|email|draft|outreach/i,
  ads: /\bad(s|_|-)|campaign|adset|boost/i,
  site: /deploy|publish|website|pages|vercel|netlify/i,
  payments: /stripe|payment|checkout|charge|invoice|billing/i,
  usage: /analytics|usage|meter|plausible|posthog|umami|events/i
};
async function toolForLane(lane) {
  const names = await discoverTools();
  const rx = LANE_MATCH[lane];
  if (lane === "inbox") {
    const draft2 = names.find((n) => /create_draft|draft/i.test(n));
    if (draft2) return draft2;
    return names.find((n) => rx.test(n) && !/send/i.test(n)) || null;
  }
  return names.find((n) => rx.test(n)) || null;
}
var LANES = [
  { lane: "site", label: "Site / deploy", what: "publish the page or ship the wrapp to a subdomain" },
  { lane: "social", label: "Social", what: "post to X / LinkedIn" },
  { lane: "inbox", label: "Inbox", what: "send outreach email" },
  { lane: "ads", label: "Ads", what: "launch an ad campaign" },
  { lane: "payments", label: "Payments", what: "charge for a product (sales ventures)" },
  { lane: "usage", label: "Usage", what: "meter uses \u2192 Spotify-style rev-share (wrapps)" }
];
function laneLive(lane) {
  if (!toolNames) return null;
  return toolNames.find((n) => LANE_MATCH[lane].test(n)) || false;
}
async function runMove(co, move) {
  if (guardWrite(co)) return;
  if (move.mode === "manual") return;
  if (move.mode === "auto") {
    if (move.lane === "social") await genPost(co, move);
    else if (move.lane === "inbox") await genOutreach(co, move);
    return;
  }
  const tool = move.lane ? await toolForLane(move.lane) : null;
  const verb = move.verb || "sending", doneVerb = move.doneVerb || "ran";
  if (!tool) {
    logLine(co, "staged \u201C" + move.n + "\u201D \u2014 no " + (move.lane || "connector") + " connected yet", "run", null);
    toast("Staged \u2014 connect a " + (move.lane || "tool") + " in the Switchboard panel to do it for real.");
    await saveCo(co);
    render();
    return;
  }
  logLine(co, verb + " \u201C" + move.n + "\u201D via " + tool + "\u2026", "run", null);
  await saveCo(co);
  render();
  try {
    const res = await relay.callTool(tool, move.args || {});
    logLine(co, doneVerb + " \u201C" + move.n + "\u201D \u2014 done", "done", null);
    if (move.postId) {
      const p = co.posts.find((x) => x.id === move.postId);
      if (p) {
        p.state = "posted";
        p.ref = res?.ref || res?.id || null;
      }
    }
    if (move.mailId) {
      const m = co.inbox.find((x) => x.id === move.mailId);
      if (m) {
        m.state = "drafted";
        m.ref = res?.id || res?.ref || null;
      }
    }
    if (move.lane === "site" && co.site) {
      co.site.live = true;
      co.site.url = res?.url || "https://" + co.site.host;
    }
    if (move.lane === "payments" && co.product) {
      co.product.live = true;
      co.metrics.revenue = co.metrics.revenue ?? 0;
    }
    if (move.lane === "usage") {
      co.usageLive = true;
      co.metrics.uses = co.metrics.uses ?? 0;
      co.metrics.payout = co.metrics.payout ?? 0;
    }
    toast("Done \u2014 " + move.n);
  } catch (e) {
    logLine(co, "\u201C" + move.n + "\u201D didn't go through \u2014 " + msg(e), "run", null);
    toast(msg(e), true);
  }
  await saveCo(co);
  render();
}
function movesFor(co) {
  const out = [];
  const angle = optOf(co.decisions.angle);
  const channel = optOf(co.decisions.channel);
  const next = optOf(co.decisions.next);
  const named = (o) => (o.label || o.text || "").trim();
  const stated = (o) => (o.text || o.label || "").trim();
  if (angle) out.push({ id: "creative", n: "Draft the creative for \u201C" + named(angle) + "\u201D", mode: "auto", lane: "social" });
  if (angle && channel) out.push({
    id: "run",
    n: "Run \u201C" + named(angle) + "\u201D on " + named(channel),
    mode: "approve",
    lane: "ads",
    args: { angle: named(angle), channel: named(channel), body: angle?.body || "" }
  });
  if (angle) out.push({ id: "outreach", n: "Email leads about \u201C" + named(angle) + "\u201D", mode: "auto", lane: "inbox" });
  if (next) out.push({ id: "widen", n: stated(next), mode: "manual" });
  return out;
}
var runningTasks = /* @__PURE__ */ new Set();
var failedTasks = /* @__PURE__ */ new Map();
function tasksFor(co) {
  const T = [];
  const kc = kindCfg(co);
  for (const s of SPEC) {
    const d = co.decisions[s.id];
    if (d && !d.chosenId && !d.inherited && d.options.length)
      T.push({ id: "decide-" + s.id, title: "Decide " + s.label.toLowerCase(), detail: d.options.length + " options drafted \u2014 pick one", status: "pending", act: { kind: "decide", id: s.id } });
  }
  if (kc.econ === "sales" && (!co.product || !co.product.drafted)) T.push({ id: "gen-product", title: "Shape the product", detail: "a first paid offer, from your context + angle", status: "pending", act: { kind: "product" } });
  if (!co.site || !co.site.drafted) T.push({ id: "gen-site", title: kc.deployVerb, detail: "generate the " + kc.deployNoun + " from the context", status: "pending", act: { kind: "site" } });
  if ((co.posts || []).length < 3) T.push({ id: "gen-post", title: "Draft the launch social", detail: "posts in the company's voice", status: "pending", act: { kind: "post" } });
  if ((co.inbox || []).length < 2) T.push({ id: "gen-outreach", title: "Draft outreach", detail: "cold emails to your first " + (kc.econ === "usage" ? "users" : "buyers"), status: "pending", act: { kind: "outreach" } });
  for (const m of movesFor(co).filter((m2) => m2.mode === "approve")) T.push({ id: "move-" + m.id, title: m.n, detail: MODES.approve.note, status: "staged", move: m, act: { kind: "move", move: m } });
  T.push({ id: "daily-plan", title: "Daily company planning", detail: "the CEO reviews the board and queues the day", status: "recurring", act: { kind: "plan" } });
  return T.map((t) => runningTasks.has(t.id) ? { ...t, status: "running" } : failedTasks.has(t.id) ? { ...t, status: "failed", err: failedTasks.get(t.id) } : t);
}
function tasksDone(co) {
  const D = [];
  for (const s of SPEC) {
    const d = co.decisions[s.id];
    if (d && (d.chosenId || d.inherited)) D.push({ id: "done-" + s.id, title: "Decided " + s.label.toLowerCase(), detail: (optOf(d) || {}).label || (d.inherited || {}).value || "", status: "done" });
  }
  if (co.site && co.site.drafted) D.push({ id: "done-site", title: kindCfg(co).econ === "usage" ? "Shipped the wrapp" : "Built the site", detail: co.site.host || "", status: "done" });
  if (co.product && co.product.drafted) D.push({ id: "done-product", title: "Shaped the product", detail: co.product.name || "", status: "done" });
  if ((co.posts || []).length) D.push({ id: "done-posts", title: "Drafted the launch social", detail: co.posts.length + " posts", status: "done" });
  if ((co.inbox || []).length) D.push({ id: "done-inbox", title: "Drafted outreach", detail: co.inbox.length + " emails", status: "done" });
  return D;
}
async function runTask(co, task) {
  if (guardWrite(co)) return;
  const a = task.act;
  if (!a) return;
  runningTasks.add(task.id);
  failedTasks.delete(task.id);
  render();
  try {
    if (a.kind === "decide") {
      const d = co.decisions[a.id];
      if (d && d.options.length) await autoChoose(co, d);
    } else if (a.kind === "product") await genProduct(co);
    else if (a.kind === "site") await genSite(co);
    else if (a.kind === "post") await genPost(co, { lane: "social" });
    else if (a.kind === "outreach") await genOutreach(co, { lane: "inbox" });
    else if (a.kind === "move") await runMove(co, a.move);
    else if (a.kind === "plan") await ceoProactive(co);
  } catch (e) {
    failedTasks.set(task.id, msg(e));
  } finally {
    runningTasks.delete(task.id);
    await saveCo(co);
    render();
  }
}
async function ceoSay(co, text) {
  if (guardWrite(co)) return;
  const you = { id: uid(), who: "you", text: text.trim(), at: clock() };
  co.chat.push(you);
  await saveCo(co);
  render();
  const chosen = SPEC.map((s) => {
    const d = co.decisions[s.id];
    const o = optOf(d);
    return o ? s.label + ": " + o.label : d.inherited ? s.label + ": " + d.inherited.value : null;
  }).filter(Boolean);
  const recent = co.chat.slice(-6).map((m) => (m.who === "you" ? "Founder" : "You (CEO)") + ": " + m.text).join("\n");
  const prompt = [
    "You are the operating CEO of " + co.name + ". You speak to the founder as a trusted partner \u2014 direct, concrete, no fluff, first person.",
    groundingBlock(co),
    chosen.length ? "Decided so far:\n" + chosen.join("\n") : "Nothing decided yet.",
    "Recent thread:\n" + (recent || "(new)"),
    "Reply to the founder's last message in 2-4 sentences. Propose concrete next moves this company could actually make. Never invent a metric, a customer, a price, or a result \u2014 if you'd need data, say what you'd need."
  ].join("\n\n");
  try {
    const { text: reply, tokens, estimated } = await completeCounted(prompt, 500);
    spend(co, tokens, "ceo", estimated);
    co.chat.push({ id: uid(), who: "ceo", text: reply.trim(), at: clock() });
  } catch (e) {
    co.chat.push({ id: uid(), who: "ceo", text: "Couldn't reach your Claude just now \u2014 " + msg(e), at: clock() });
  }
  await saveCo(co);
  render();
}
async function genPost(co, move) {
  if (guardWrite(co)) return;
  const angle = optOf(co.decisions.angle) || shownOf(co.decisions.angle);
  const prompt = [
    "You are running social for " + co.name + ".",
    groundingBlock(co),
    angle ? "The angle to lead with: " + (angle.label || "") + " \u2014 " + (angle.text || "") : "",
    "Write ONE post (under 260 chars) in this company's voice. No hashtags unless they're natural. Return only the post text."
  ].filter(Boolean).join("\n\n");
  try {
    const { text, tokens, estimated } = await completeCounted(prompt, 300);
    spend(co, tokens, "social", estimated);
    const p = { id: uid(), channel: "x", text: text.trim().slice(0, 280), state: co.autotweet ? "staged" : "draft", at: clock() };
    co.posts.unshift(p);
    co.posts = co.posts.slice(0, 8);
    logLine(co, co.autotweet ? "drafted + staged a post" : "drafted a post \u2014 yours to send", "done", null);
  } catch (e) {
    logLine(co, "couldn't draft a post \u2014 " + msg(e), "run", null);
  }
  await saveCo(co);
  render();
}
async function genOutreach(co, move) {
  if (guardWrite(co)) return;
  const angle = optOf(co.decisions.angle) || shownOf(co.decisions.angle);
  const aud = (co.inherited || {}).audience || "";
  const prompt = [
    "You are doing cold outreach for " + co.name + ".",
    groundingBlock(co),
    aud ? "Who to reach: " + aud : "",
    angle ? "Lead with the angle: " + (angle.label || "") : "",
    `Write ONE short cold email \u2014 a subject line and 3-4 sentence body \u2014 this company could send to a prospect. Return as JSON: {"subject":..., "body":...}. Never invent the recipient's name or a fake result.`
  ].filter(Boolean).join("\n\n");
  try {
    const { text, tokens, estimated } = await completeCounted(prompt, 400);
    spend(co, tokens, "inbox", estimated);
    let subject = "Quick note", body = text.trim();
    const j = text.indexOf("{");
    if (j !== -1) {
      try {
        const o = JSON.parse(text.slice(j, text.lastIndexOf("}") + 1));
        subject = o.subject || subject;
        body = o.body || body;
      } catch {
      }
    }
    const m = { id: uid(), to: aud ? "(a " + aud.split(/[,.]/)[0].trim() + ")" : "(a prospect)", subject, body, state: "draft", at: clock() };
    co.inbox.unshift(m);
    co.inbox = co.inbox.slice(0, 8);
    logLine(co, "drafted outreach \u2014 yours to send", "done", null);
  } catch (e) {
    logLine(co, "couldn't draft outreach \u2014 " + msg(e), "run", null);
  }
  await saveCo(co);
  render();
}
async function genSite(co) {
  if (guardWrite(co)) return;
  if (co.site && co.site.busy) return;
  const kc = kindCfg(co);
  const host = co.site && co.site.host || kc.host(slugOf(co.name));
  co.site = { ...co.site || {}, host, busy: true };
  logLine(co, kc.econ === "usage" ? "building the wrapp's entry\u2026" : "building the site\u2026", "run", null);
  render();
  const voice = optOf(co.decisions.voice) || (co.decisions.voice.inherited ? { label: co.decisions.voice.inherited.value } : null);
  const angle = optOf(co.decisions.angle) || shownOf(co.decisions.angle);
  const pal = co.inherited && co.inherited.palette || [];
  const wrappBrief = kc.econ === "usage" ? "You are building the entry screen for a WRAPP \u2014 a single-purpose app that runs on the visitor's own Claude via Switchboard (they bring the compute; there is no signup and no charge). Make the ONE thing it does obvious, with a single primary action to start. It will live at " + host + "." : "You are building the launch landing page for " + co.name + ".";
  const prompt = [
    wrappBrief,
    groundingBlock(co),
    voice ? "Voice: " + (voice.label || "") : "",
    angle ? "Lead with the angle: " + (angle.label || "") + " \u2014 " + (angle.text || "") : "",
    pal.length ? "Palette to use: " + pal.join(", ") : "",
    "Return ONE self-contained HTML document \u2014 inline <style> only, no external assets, no <script>. A real, tasteful single screen: a headline, a subhead, ONE clear primary action, and 3 short points. Dark, modern, generous spacing. Ground every word in the company above \u2014 never invent a metric, a customer, a price, or a testimonial. Return ONLY the HTML, starting with <!doctype html>."
  ].filter(Boolean).join("\n\n");
  try {
    const { text, tokens, estimated } = await completeCounted(prompt, 2200);
    spend(co, tokens, "site", estimated);
    let html = text.replace(/```[a-z]*\n?/gi, "").trim();
    const lo = html.toLowerCase();
    if (!lo.includes("<html") && !lo.includes("<!doctype") && !lo.includes("<body")) {
      html = '<!doctype html><meta charset=utf-8><body style="margin:0;font:16px/1.6 system-ui;background:#0A0C10;color:#E8EDF4;display:grid;place-items:center;min-height:100vh;text-align:center;padding:40px"><div style="max-width:560px"><h1 style="font:700 2.2rem/1.1 system-ui;letter-spacing:-.02em">' + esc(co.name) + '</h1><p style="color:#B4BECE">' + esc(co.oneLine || "") + '</p><a style="display:inline-block;margin-top:18px;background:#C8F250;color:#0A0C10;font-weight:600;padding:11px 20px;border-radius:10px;text-decoration:none">Get started</a><p style="color:#6E7C90;font:12px/1.6 monospace;margin-top:26px">' + esc(html.slice(0, 240)) + "</p></div>";
    }
    co.site = { host, html, live: false, drafted: true, at: clock() };
    logLine(co, "drafted the site \u2014 preview it, then publish when you're ready", "done", null);
  } catch (e) {
    co.site.busy = false;
    logLine(co, "couldn't build the site \u2014 " + msg(e), "run", null);
  }
  await saveCo(co);
  render();
}
async function genProduct(co) {
  if (guardWrite(co)) return;
  if (co.product && co.product.busy) return;
  co.product = { ...co.product || {}, busy: true };
  logLine(co, "shaping the product\u2026", "run", null);
  render();
  const angle = optOf(co.decisions.angle) || shownOf(co.decisions.angle);
  const prompt = [
    "You are defining the first paid offer for " + co.name + ".",
    groundingBlock(co),
    angle ? "It should line up with the angle you're running: " + (angle.label || "") : "",
    'Propose ONE concrete first product to sell \u2014 a specific named offer at a specific price. Return JSON: {"name":<the offer, 2-5 words>, "price":<a realistic number in USD>, "blurb":<one sentence on exactly what the buyer gets>}. Never invent a result, a testimonial, or a customer count.'
  ].filter(Boolean).join("\n\n");
  try {
    const { text, tokens, estimated } = await completeCounted(prompt, 400);
    spend(co, tokens, "product", estimated);
    let p = { name: co.name + " \u2014 first offer", price: 0, blurb: "" };
    const j = text.indexOf("{");
    if (j !== -1) {
      try {
        const o = JSON.parse(text.slice(j, text.lastIndexOf("}") + 1));
        p = { name: String(o.name || p.name).slice(0, 60), price: Math.max(0, Math.round(Number(o.price) || 0)), blurb: String(o.blurb || "").slice(0, 160) };
      } catch {
      }
    }
    co.product = { ...p, drafted: true, live: false, at: clock() };
    logLine(co, "drafted the product \u2014 " + p.name + (p.price ? " \xB7 $" + p.price : ""), "done", null);
  } catch (e) {
    co.product.busy = false;
    logLine(co, "couldn't shape the product \u2014 " + msg(e), "run", null);
  }
  await saveCo(co);
  render();
}
var ticking = /* @__PURE__ */ new Set();
var autoTimer = null;
var AUTO_MS = 9e3;
var anyAuto = () => cos.some((c) => c.auto && c.auto.on);
function ensureAutoLoop() {
  if (relay && anyAuto() && !autoTimer) autoTimer = setInterval(() => void tickAll(), AUTO_MS);
  if ((!relay || !anyAuto()) && autoTimer) {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}
async function tickAll() {
  if (!relay) return;
  for (const co of cos) {
    if (!co.auto || !co.auto.on || ticking.has(co.id) || drafting.has(co.id)) continue;
    ticking.add(co.id);
    try {
      await autoTick(co);
    } catch (e) {
      logLine(co, "autopilot hit a snag \u2014 " + msg(e), "run", null);
      await saveCo(co);
      render();
    } finally {
      ticking.delete(co.id);
    }
  }
}
async function runTheRoute(co) {
  if (!co) return;
  const anyDrafted = Object.values(co.decisions).some((d) => d.options.length || d.inherited);
  if (!anyDrafted) await draftSlate(co);
  for (const s of SPEC) {
    const d = co.decisions[s.id];
    if (!d || d.inherited || d.chosenId || !d.options.length) continue;
    await autoChoose(co, d);
  }
  if (co.auto) co.auto.on = true;
  logLine(co, "AI ran the route \u2014 the slate's decided and autopilot has it. Steer by re-choosing anything.", "run", null);
  await saveCo(co);
  render();
  ensureAutoLoop();
}
async function letAiRunIt() {
  const input = document.querySelector(".bindrow input");
  const v = input ? input.value.trim() : "";
  if (v) await seedFromLine(v, seedKind);
  else if (brand) await seedFromContext();
  else return;
  await runTheRoute(CO());
}
async function startRandom() {
  const preset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
  if (relay) await adoptPreset(preset);
  else loadPreview(preset);
}
async function autoChoose(co, d) {
  const rec = d.options.find((o) => o.rec) || d.options[0];
  if (!rec) return false;
  d.chosenId = rec.id;
  d.chosenAt = clock();
  d.stale = false;
  logLine(co, "CEO chose " + rec.label + " for " + d.label.toLowerCase(), "done", d.id);
  const stale = markStale(co, d.id);
  await saveCo(co);
  render();
  if (stale.length) await restream(co, stale);
  return true;
}
async function ceoProactive(co) {
  const chosen = SPEC.map((s) => {
    const o = optOf(co.decisions[s.id]);
    return o ? s.label + ": " + o.label : null;
  }).filter(Boolean);
  const prompt = [
    "You are the operating CEO of " + co.name + ", running it while the founder is away.",
    groundingBlock(co),
    chosen.length ? "Decided so far:\n" + chosen.join("\n") : "",
    "Post a SHORT proactive status (1-2 sentences, first person) on what you just moved on and what's next. Never invent a metric, customer, price, or result."
  ].filter(Boolean).join("\n\n");
  try {
    const { text, tokens, estimated } = await completeCounted(prompt, 300);
    spend(co, tokens, "ceo", estimated);
    co.chat.push({ id: uid(), who: "ceo", text: text.trim(), at: clock() });
  } catch {
  }
  await saveCo(co);
  render();
}
async function autoTick(co) {
  if (co.tokens.spent >= co.tokens.budget) {
    co.auto.on = false;
    ensureAutoLoop();
    logLine(co, "autopilot paused \u2014 out of runway this week. Fund more to keep it moving.", "run", null);
    toast(co.name + " paused \u2014 out of runway. Fund it to continue.");
    await saveCo(co);
    render();
    return;
  }
  const P = co.policy || DEFAULT_POLICY;
  const open = P.decide !== false ? SPEC.map((s) => co.decisions[s.id]).find((d) => d && !d.chosenId && !d.inherited && d.options.length && !d.busy) : null;
  if (open) {
    await autoChoose(co, open);
    co.auto.at = Date.now();
    return;
  }
  const salesKind = kindCfg(co).econ === "sales";
  const beats = [
    async () => {
      if (P.product !== false && salesKind && (!co.product || !co.product.drafted)) {
        await genProduct(co);
        return true;
      }
      return false;
    },
    async () => {
      if (P.site !== false && (!co.site || !co.site.drafted)) {
        await genSite(co);
        return true;
      }
      return false;
    },
    async () => {
      if (P.social !== false && co.posts.length < 3) {
        await genPost(co, { lane: "social" });
        return true;
      }
      return false;
    },
    async () => {
      if (P.outreach !== false && co.inbox.length < 2) {
        await genOutreach(co, { lane: "inbox" });
        return true;
      }
      return false;
    },
    async () => {
      if (P.plan !== false) {
        await ceoProactive(co);
        return true;
      }
      return false;
    }
  ];
  for (let i = 0; i < beats.length; i++) {
    if (await beats[(co.auto.cursor + i) % beats.length]()) {
      co.auto.cursor = (co.auto.cursor + i + 1) % beats.length;
      co.auto.at = Date.now();
      return;
    }
  }
  co.auto.at = Date.now();
}
var coldOpened = false;
function autostart() {
  if (!relay || coldOpened || cos.length) return;
  if (!brand || !brand.name) return;
  coldOpened = true;
  void seedFromContext();
}
var pane = null;
var creating = false;
var portfolio = false;
function render() {
  const hero = $("hero"), view = $("view");
  if (!hero || !view) return;
  hero.hidden = true;
  view.textContent = "";
  document.body.classList.toggle("preview", previewing);
  if (previewing && previewCo) {
    document.body.classList.add("cock-on");
    view.append(previewBanner(previewCo), cockpit(previewCo));
    renderPane(previewCo);
    return;
  }
  if (!relay && cos.length) {
    document.body.classList.add("cock-on");
    view.append(disconnectedBar(), cockpit(CO() || cos[0]));
    renderPane(CO() || cos[0]);
    ensureAutoLoop();
    return;
  }
  const co = CO();
  const board = !!(relay && cos.length);
  document.body.classList.toggle("cock-on", board || !relay);
  if (!relay) {
    view.append(entryChooser());
    return;
  }
  if (!cos.length || creating) {
    view.append(startBox());
    return;
  }
  if (portfolio) {
    view.append(portfolioView());
    ensureAutoLoop();
    return;
  }
  view.append(cockpit(co));
  renderPane(co);
  ensureAutoLoop();
}
function portfolioView() {
  const wrap = el("div", "port");
  const head = el("div", "porthead");
  const ht = el("div");
  ht.append(el("h2", "porttitle", "Companies"));
  ht.append(el("div", "portsub", cos.length + " compan" + (cos.length === 1 ? "y" : "ies") + " \xB7 " + cos.filter((c) => c.auto && c.auto.on).length + " on autopilot"));
  head.append(ht);
  const add = el("button", "primary", "+ New company");
  add.onclick = () => {
    creating = true;
    portfolio = false;
    render();
  };
  head.append(add);
  wrap.append(head);
  const tiles = el("div", "porttiles");
  tiles.append(portTile("Companies", String(cos.length)));
  tiles.append(portTile("On autopilot", String(cos.filter((c) => c.auto && c.auto.on).length)));
  const anyRev = cos.some((c) => c.metrics && typeof c.metrics.revenue === "number");
  const rev = cos.reduce((s, c) => s + (c.metrics && typeof c.metrics.revenue === "number" ? c.metrics.revenue : 0), 0);
  tiles.append(portTile("Revenue MTD", anyRev ? "$" + rev : "\u2014 not connected", !anyRev));
  const spent = cos.reduce((s, c) => s + (c.tokens?.spent || 0), 0);
  tiles.append(portTile("Runway spent", fmtTok(spent)));
  wrap.append(tiles);
  const table = el("div", "porttable");
  const hr = el("div", "ptrow pthead");
  hr.append(el("div", null, "Company"), el("div", null, "Status"), el("div", null, "Decisions"), el("div", null, "Revenue MTD"), el("div", null, "Site"));
  table.append(hr);
  for (const c of cos) table.append(portRow(c));
  wrap.append(table);
  return wrap;
}
function portTile(label, value, na) {
  const t = el("div", "ptile");
  t.append(el("div", "ptlabel", label));
  t.append(el("div", "ptvalue" + (na ? " na" : ""), value));
  return t;
}
function portRow(c) {
  const r = el("button", "ptrow ptco");
  const who = el("div", "ptwho");
  const logo = el("div", "ptlogo", c.glyph);
  logo.style.background = c.color;
  logo.style.color = c.ink;
  const nm = el("div");
  nm.append(el("div", "ptname", c.name), el("div", "ptkind", c.kindLabel));
  who.append(logo, nm);
  const decided = Object.values(c.decisions || {}).filter((d) => d.chosenId || d.inherited).length;
  const status = c.auto && c.auto.on ? el("span", "ptstat on", "\u25CF Autopilot") : drafting.has(c.id) ? el("span", "ptstat run", "drafting") : el("span", "ptstat", "paused");
  const rev = c.metrics && typeof c.metrics.revenue === "number" ? "$" + c.metrics.revenue : el("span", "na", "\u2014 not connected");
  const site = c.site && c.site.live ? el("span", "ptsite on", c.site.host) : c.site && c.site.drafted ? el("span", "ptsite draft", "drafted") : el("span", "na", "no site");
  const revCell = typeof rev === "string" ? el("div", null, rev) : (() => {
    const d = el("div");
    d.append(rev);
    return d;
  })();
  const siteCell = el("div");
  siteCell.append(site);
  const decCell = el("div", null, decided + " / " + SPEC.length);
  const statCell = el("div");
  statCell.append(status);
  r.append(who, statCell, decCell, revCell, siteCell);
  r.onclick = () => {
    activeId = c.id;
    portfolio = false;
    pane = null;
    render();
  };
  return r;
}
function connectorsChip() {
  const b = el("button", "connchip");
  const live2 = LANES.filter((l) => laneLive(l.lane)).length;
  const known = toolNames != null;
  b.append(el("span", "cbolt", "\u26A1"));
  b.append(el("span", "cbtxt", known ? live2 + "/" + LANES.length + " lanes live" : "connectors"));
  b.onclick = () => {
    pane = { kind: "connectors" };
    render();
  };
  return b;
}
function connectorsPane(body) {
  body.append(el("h3", "ptitle", "Connectors"));
  body.append(el("div", "fundnote", "Autopilot drafts everything on its own, but a send only leaves the machine through a connector you've wired in Switchboard \u2014 and even then, each send asks for your go. This is the map."));
  if (toolNames == null) {
    body.append(researching("checking what's connected\u2026"));
    void discoverTools().then(() => render());
    return;
  }
  for (const l of LANES) {
    const tool = laneLive(l.lane);
    const row = el("div", "connrow");
    row.append(el("span", "conndot" + (tool ? " on" : "")));
    const mid = el("div", "connmid");
    mid.append(el("div", "connlabel", l.label));
    mid.append(el("div", "connwhat", l.what));
    row.append(mid);
    row.append(el("span", "connstate" + (tool ? " on" : ""), tool ? "live" : "not connected"));
    body.append(row);
  }
  body.append(el("div", "honest ember", "\u25CF Nothing here is a number we made up. A lane is 'live' only if the daemon actually reports a matching connected tool for this origin \u2014 otherwise every move on that lane stays staged, and Autopilot never pretends it sent."));
}
function autonomyChip(co) {
  const P = co.policy || DEFAULT_POLICY;
  const n = AUTONOMY_LANES.filter((l) => P[l.id] !== false).length;
  const b = el("button", "autonchip");
  b.append(el("span", "autonico", "\u2699"), el("span", null, "Autonomy " + n + "/" + AUTONOMY_LANES.length));
  b.onclick = () => {
    pane = { kind: "autonomy" };
    render();
  };
  return b;
}
function autoToggle(co) {
  const b = el("button", "autobtn" + (co.auto && co.auto.on ? " on" : ""));
  b.append(el("span", "autodot"), el("span", "autolab", co.auto && co.auto.on ? "Autopilot on" : "Autopilot off"));
  b.onclick = async () => {
    if (guardWrite(co)) return;
    co.auto.on = !co.auto.on;
    logLine(co, co.auto.on ? "you handed " + co.name + " to autopilot \u2014 the CEO takes it from here" : "you took the wheel back \u2014 autopilot paused", "run", null);
    await saveCo(co);
    render();
    ensureAutoLoop();
  };
  return b;
}
var seedKind = "brand";
function startBox() {
  const box = el("div", "start");
  const hero = el("button", "startbig");
  hero.append(el("span", "bolt", "\u{1F3B2}"), el("span", null, "Explore a random idea"));
  hero.onclick = () => void startRandom();
  box.append(hero);
  box.append(el("div", "herohint", "One tap \u2014 a ready-made company (already through the flow) lands on your board, yours to operate on your own Claude."));
  if (brand) box.append(el("div", "ctx", "or pick up your lent context \u2014 " + brand.name));
  box.append(el("div", "or", "or bring your own"));
  const picker = el("div", "kindpick");
  for (const [k, cfg] of Object.entries(KINDS)) {
    const b = el("button", "kindopt" + (seedKind === k ? " on" : ""));
    b.append(el("span", "kn", cfg.label.toLowerCase()));
    b.append(el("span", "kd", k === "wrapp" ? "a subdomain product \xB7 earns by usage" : k === "product" ? "an app \xB7 earns by sales" : "a brand \xB7 earns by sales"));
    b.onclick = () => {
      seedKind = k;
      render();
    };
    picker.append(b);
  }
  box.append(picker);
  const row = el("div", "bindrow");
  const input = el("input");
  input.placeholder = seedKind === "wrapp" ? "one line \u2014 what should the wrapp do?" : "one line \u2014 what is the " + KINDS[seedKind].label.toLowerCase() + "?";
  const go = () => {
    const v = input.value.trim();
    if (v) void seedFromLine(v, seedKind);
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });
  const btn = el("button", "primary", brand ? "Pick it up" : "Start it");
  btn.onclick = () => {
    if (brand && !input.value.trim()) void seedFromContext();
    else go();
  };
  row.append(input, btn);
  box.append(row);
  const fast = el("button", "runit");
  fast.append(el("span", "bolt", "\u26A1"), el("span", null, "Let AI run what I brought"));
  fast.onclick = () => void letAiRunIt();
  box.append(fast);
  box.append(el("div", "hint", brand ? "\u201CPick it up\u201D drops you into the slate to decide each call yourself; \u201CLet AI run what I brought\u201D decides the whole route and starts operating." : "Type a one-liner, or lend a brand, project or idea from the Switchboard panel \u2014 then \u201CStart it\u201D to decide each call yourself, or \u201CLet AI run what I brought\u201D to have it operate. (Or just tap Explore a random idea above.)"));
  if (creating && cos.length) {
    const back = el("button", "act", "\u2190 back to " + (CO()?.name || "the board"));
    back.onclick = () => {
      creating = false;
      render();
    };
    box.append(back);
  }
  setTimeout(() => input.focus(), 30);
  return box;
}
function cockpit(co) {
  const wrap = el("div", "cock");
  const top = el("div", "top");
  const tabs = el("div", "cosw");
  for (const c of cos) {
    const b = el("button", "cotab" + (c.id === activeId ? " on" : ""));
    const cl = el("span", "cl", c.glyph);
    cl.style.background = c.color;
    cl.style.color = c.ink;
    const nm = el("span");
    nm.append(el("span", "cn", c.name), el("br"), el("span", "ck", c.kindLabel));
    b.append(cl, nm);
    b.onclick = () => {
      activeId = c.id;
      creating = false;
      pane = null;
      render();
    };
    tabs.append(b);
  }
  const add = el("button", "cotab add", "+ New company");
  add.onclick = () => {
    creating = true;
    pane = null;
    render();
  };
  tabs.append(add);
  const allBtn = el("button", "cotab port", "\u25F1 Companies");
  allBtn.onclick = () => {
    portfolio = true;
    pane = null;
    render();
  };
  tabs.prepend(allBtn);
  top.append(tabs, connectorsChip(), co ? autonomyChip(co) : el("span"), co ? autoToggle(co) : el("span"), tokenMeter(co));
  wrap.append(top);
  if (!co) return wrap;
  const grid = el("div", "grid");
  grid.append(companyCol(co), opsCol(co), growthCol(co), strategyCol(co));
  wrap.append(grid);
  return wrap;
}
function companyCol(co) {
  const c = el("div", "col");
  c.append(el("div", "chead", "COMPANY"));
  const idc = el("div", "card");
  const idrow = el("div", "idrow");
  const logo = el("div", "idlogo", co.glyph);
  logo.style.background = co.color;
  logo.style.color = co.ink;
  const who = el("div");
  who.append(el("h3", null, co.name));
  who.append(el("div", "ck", co.kindLabel + (co.ctxName ? " \xB7 lent from " + co.ctxName : "")));
  idrow.append(logo, who);
  idc.append(idrow);
  if (co.oneLine) idc.append(el("p", "blurb", co.oneLine));
  const kc = kindCfg(co);
  const site = el("div", "siteline");
  if (co.site && co.site.drafted) {
    site.append(el("span", "dot" + (co.site.live ? " on" : " draft")));
    site.append(el("span", "sitehost", co.site.host), el("span", "sitestate", co.site.busy ? "building\u2026" : co.site.live ? "live" : "drafted"));
    const pv = el("button", "sitebtn", "Preview");
    pv.onclick = () => {
      pane = { kind: "site" };
      render();
    };
    site.append(pv);
  } else {
    site.append(el("span", "dot"), el("span", "sitestate", co.site && co.site.busy ? "building\u2026" : "no " + kc.deployNoun + " yet"));
    const build = el("button", "sitebtn", kc.deployVerb);
    build.onclick = () => void genSite(co);
    site.append(build);
  }
  idc.append(site);
  const kv = el("div", "kvs");
  kv.append(kvRow("Decisions yours", Object.values(co.decisions).filter((d) => d.chosenId).length + " of " + SPEC.length));
  if (kc.econ === "usage") {
    kv.append(kvRow("Uses MTD", co.metrics.uses == null ? "\u2014 not connected" : String(co.metrics.uses), co.metrics.uses == null));
    kv.append(kvRow("Est. rev-share", co.metrics.payout == null ? "\u2014 not connected" : "$" + co.metrics.payout, co.metrics.payout == null));
  } else {
    kv.append(kvRow("Revenue MTD", co.metrics.revenue == null ? "\u2014 not connected" : "$" + co.metrics.revenue, co.metrics.revenue == null));
    kv.append(kvRow("Traffic", co.metrics.traffic == null ? "\u2014 not connected" : String(co.metrics.traffic), co.metrics.traffic == null));
  }
  idc.append(kv);
  const fund = el("button", "fundbtn", "Fund runway");
  fund.onclick = () => {
    pane = { kind: "tokens" };
    render();
  };
  idc.append(fund);
  idc.append(el("div", "fundnote", "runway is capacity to work on your own Claude \u2014 not a subscription, no key ever leaves you"));
  c.append(idc);
  c.append(productCard(co));
  if (kindCfg(co).physical) {
    c.append(supplyCard(co));
    c.append(morCard());
  } else if (kindCfg(co).econ === "usage") c.append(gameCard(co));
  else c.append(morCard());
  const stillInherited = Object.entries(co.inherited || {}).filter(([k]) => !(co.overridden || []).includes(k));
  if (stillInherited.length) {
    const ic = el("div", "card");
    ic.append(cardTitle("Inherited", "not re-decided"));
    for (const [k, v] of stillInherited) {
      const flat = Array.isArray(v) ? v.join(", ") : String(v);
      if (!flat) continue;
      const r = el("div", "inh");
      r.append(el("span", "ik", k), el("span", "iv", flat.slice(0, 90)));
      ic.append(r);
    }
    ic.append(el("div", "fundnote", "came from the brandbrain / ideabrain context you lent \u2014 Autopilot doesn't ask again"));
    c.append(ic);
  }
  return c;
}
function productCard(co) {
  const c = el("div", "card");
  const usage = kindCfg(co).econ === "usage";
  const p = co.product;
  if (usage) {
    c.append(cardTitle("Rev-share", co.usageLive ? "meter on" : "the money path"));
    c.append(el("div", "prodblurb", "The wrapp earns like a song on Spotify: pro members pay one sub, and you're paid from the pool by how much your wrapp gets used \u2014 no charge to the visitor, who runs it on their own Claude."));
    if (co.usageLive) {
      c.append(el("div", "fundnote", "usage meter connected \u2014 the Uses / rev-share lines above fill only from real, metered usage"));
    } else {
      const b = el("button", "growbtn", "Connect usage meter");
      b.onclick = () => void runMove(co, { mode: "approve", lane: "usage", n: "Connect the usage meter for " + co.name, args: { host: co.site?.host } });
      c.append(b);
      c.append(el("div", "fundnote", "a gated move \u2014 needs a usage/analytics connector and your go. Nothing here is a made-up number."));
    }
    return c;
  }
  c.append(cardTitle("Product", p && p.live ? "payments on" : p && p.drafted ? "drafted" : "the money path"));
  if (p && p.drafted) {
    const box = el("div", "prod");
    const top = el("div", "prodtop");
    top.append(el("div", "prodname", p.name));
    if (p.price) top.append(el("div", "prodprice", "$" + p.price));
    box.append(top);
    if (p.blurb) box.append(el("div", "prodblurb", p.blurb));
    c.append(box);
    if (p.live) {
      c.append(el("div", "fundnote", "payments connected \u2014 the revenue line above fills only when a real sale lands"));
    } else {
      const b = el("button", "growbtn", "Set up payments");
      b.onclick = () => void runMove(co, { mode: "approve", lane: "payments", n: "Set up payments for " + p.name, args: { name: p.name, price: p.price } });
      c.append(b);
      c.append(el("div", "fundnote", "a gated move \u2014 needs a payments connector and your go. Autopilot never charges on its own."));
    }
  } else {
    c.append(el("div", "empty", "No product yet. Autopilot shapes one from your context and the angle you're running."));
    const b = el("button", "growbtn ghost", p && p.busy ? "shaping\u2026" : "Draft a product");
    b.onclick = () => void genProduct(co);
    c.append(b);
  }
  return c;
}
function supplyCard(co) {
  const c = el("div", "card");
  c.append(cardTitle("Supply", "the spine software can't copy"));
  c.append(el("div", "supplynote", "We hold the supply. Your small run rides the platform's pooled minimum \u2014 so it gets a real run's price."));
  const stages = el("div", "spine");
  for (const name of ["Sourced", "Co-pack", "Fulfil", "Ship"]) {
    const s = el("div", "spinestage");
    s.append(el("span", "sdot"), el("span", "sname", name));
    stages.append(s);
  }
  c.append(stages);
  const pool = el("div", "pool");
  const ph = el("div", "poolhead");
  ph.append(el("span", null, "Shared MOQ pool"), el("b", null, "\u2014 not connected"));
  pool.append(ph);
  pool.append(el("div", "poolnote", "Your run alone would miss the minimum; pooled across brands on the platform it clears one \u2014 that's your price. The modeled fill appears once you connect a supplier, never a made-up number."));
  c.append(pool);
  const kv = el("div", "kvs");
  kv.append(kvRow("Fulfilment", "\u2014 connect a 3PL", true));
  kv.append(kvRow("On hand", "\u2014 not connected", true));
  c.append(kv);
  c.append(el("div", "fundnote", "The spine is real; live inventory fills in once you connect a fulfilment provider \u2014 never a made-up count."));
  return c;
}
function morCard() {
  const c = el("div", "card mor");
  const head = el("div", "morhead");
  head.append(el("span", "morshield", "\u25C8"), el("span", null, "MERCHANT OF RECORD"));
  c.append(head);
  c.append(el("div", "morbody", "Switchboard is the entity of record \u2014 tax, returns and compliance sit with the platform. You own and direct the brand."));
  return c;
}
function gameMilestones(co) {
  const decided = Object.values(co.decisions).filter((d) => d.chosenId || d.inherited).length;
  return [
    { label: "Company decided \xB7 " + decided + "/" + SPEC.length, done: decided >= SPEC.length },
    { label: co.site && co.site.live ? "Shipped \xB7 " + co.site.host : "Ship the wrapp" + (co.site && co.site.drafted ? " \xB7 drafted" : ""), done: !!(co.site && co.site.live), staged: !!(co.site && co.site.drafted) },
    { label: "First user", done: (co.metrics.uses || 0) > 0, locked: co.metrics.uses == null },
    { label: "First rev-share $", done: (co.metrics.payout || 0) > 0, locked: co.metrics.payout == null }
  ];
}
function gameCard(co) {
  const c = el("div", "card game");
  const ms = gameMilestones(co);
  const level = ms.filter((m) => m.done).length;
  const NAMES = ["Seed", "Sprout", "Traction", "Scaling", "Live"];
  c.append(cardTitle("Grow", "level " + level + " \xB7 " + NAMES[Math.min(level, 4)]));
  c.append(el("div", "gamenote", "Feed it your own tokens and it builds itself toward launch \u2014 pour a trickle and it moves one beat at a time, pour a tank and it works ahead of you."));
  const fuel = el("div", "fuel");
  const fh = el("div", "fuelhead");
  fh.append(el("span", null, "\u26FD Fuel \xB7 your tokens"), el("b", null, fmtTok(co.tokens.spent) + " / " + fmtTok(co.tokens.budget)));
  fuel.append(fh);
  const bar = el("div", "fuelbar");
  const i = el("i");
  i.style.width = Math.min(100, co.tokens.spent / co.tokens.budget * 100) + "%";
  bar.append(i);
  fuel.append(bar);
  c.append(fuel);
  const feed = el("button", "growbtn", "\u26FD Feed it more fuel");
  feed.onclick = () => {
    pane = { kind: "tokens" };
    render();
  };
  c.append(feed);
  const ladder = el("div", "ladder");
  for (const m of ms) {
    const r = el("div", "mile" + (m.done ? " done" : m.staged ? " staged" : m.locked ? " locked" : ""));
    r.append(el("span", "mdot", m.done ? "\u2713" : ""), el("span", "mlab", m.label));
    if (m.locked) r.append(el("span", "mtag", "needs a meter"));
    else if (m.staged) r.append(el("span", "mtag", "staged"));
    ladder.append(r);
  }
  c.append(ladder);
  c.append(el("div", "fundnote", "The money wins light up only from a real usage meter \u2014 never a made-up user or dollar."));
  return c;
}
function opsCol(co) {
  const c = el("div", "col");
  c.append(el("div", "chead", "OPERATIONS"));
  const lc = el("div", "card");
  lc.append(cardTitle("Live operating log", drafting.has(co.id) ? "working\u2026" : "this company"));
  if (!co.log.length) lc.append(el("div", "empty", "Nothing yet."));
  for (const l of co.log.slice(0, 9)) {
    const r = el("div", "l" + (l.s === "run" ? " run" : ""));
    r.append(el("span", "g", l.s === "run" ? "\u27F3" : "\u2713"), el("span", null, l.t), el("time", null, l.at));
    lc.append(r);
  }
  c.append(lc);
  const tc = el("div", "card");
  const tasks = tasksFor(co);
  const th = el("div", "cthead");
  th.append(cardTitle("Tasks", tasks.filter((t) => t.status === "staged").length + " staged"));
  const manage = el("button", "taskmanage", "Manage \u2192");
  manage.onclick = () => {
    pane = { kind: "tasks" };
    render();
  };
  th.append(manage);
  tc.append(th);
  for (const t of tasks.slice(0, 5)) tc.append(taskRow(co, t));
  c.append(tc);
  c.append(docsCard(co));
  const dc = el("div", "card");
  dc.append(cardTitle("The slate", drafting.has(co.id) ? "drafting\u2026" : "choose any"));
  for (const s of SPEC) dc.append(decRow(co, co.decisions[s.id]));
  c.append(dc);
  return c;
}
function taskRow(co, t) {
  const r = el("div", "task");
  r.append(el("span", "tstate s-" + t.status));
  const mid = el("div", "tmid");
  mid.append(el("div", "ttitle", t.title));
  if (t.err) mid.append(el("div", "tdetail err", t.err));
  else if (t.detail) mid.append(el("div", "tdetail", t.detail));
  r.append(mid);
  if (t.status === "running") r.append(el("span", "ttag", "running\u2026"));
  else if (t.act && t.status !== "recurring") {
    const b = el("button", "tgo" + (t.status === "staged" ? " go" : ""), t.status === "staged" ? "Go" : "Run now");
    b.onclick = (e) => {
      e.stopPropagation();
      void runTask(co, t);
    };
    r.append(b);
  } else {
    r.append(el("span", "ttag", t.status));
  }
  return r;
}
var taskTab = "pending";
function tasksPane(body, co) {
  body.append(el("h3", "ptitle", "Tasks"));
  const live2 = tasksFor(co), done = tasksDone(co);
  const groups = {
    pending: live2.filter((t) => t.status === "pending" || t.status === "running"),
    staged: live2.filter((t) => t.status === "staged"),
    recurring: live2.filter((t) => t.status === "recurring"),
    done,
    failed: live2.filter((t) => t.status === "failed")
  };
  const tabs = el("div", "ttabs");
  for (const [k, label] of [["pending", "Pending"], ["staged", "Staged"], ["recurring", "Recurring"], ["done", "Done"], ["failed", "Failed"]]) {
    const n = groups[k].length;
    if (k === "failed" && !n) continue;
    const b = el("button", "ttab" + (taskTab === k ? " on" : ""));
    b.append(el("span", null, label));
    if (n) b.append(el("span", "tcount", String(n)));
    b.onclick = () => {
      taskTab = k;
      render();
    };
    tabs.append(b);
  }
  body.append(tabs);
  const list = groups[taskTab] || [];
  if (!list.length) {
    body.append(el("div", "empty", "Nothing here."));
    return;
  }
  for (const t of list) {
    const card = el("div", "taskcard");
    const top = el("div", "taskcardtop");
    top.append(el("div", "ttitle", t.title));
    if (t.act && t.status !== "recurring" && t.status !== "done") {
      const b = el("button", "tgo" + (t.status === "staged" ? " go" : ""), t.status === "running" ? "running\u2026" : t.status === "staged" ? "Go \u2192" : "Run now");
      if (t.status !== "running") b.onclick = () => void runTask(co, t);
      top.append(b);
    } else {
      top.append(el("span", "ttag", t.status));
    }
    card.append(top);
    if (t.detail) card.append(el("div", "tdetail" + (t.status === "failed" ? " err" : ""), t.err || t.detail));
    body.append(card);
  }
}
function docsFor(co) {
  const D = [];
  const ceo = (co.chat || []).filter((m) => m.who === "ceo");
  if (ceo.length) D.push({ id: "briefing", title: "Briefing log", tag: "DAILY", body: ceo.map((m) => m.at + " \u2014 " + m.text).join("\n\n") });
  if (co.site && co.site.drafted) D.push({ id: "site", title: kindCfg(co).econ === "usage" ? "The wrapp" : "Landing page", tag: "ARTIFACT", site: true });
  if (co.product && co.product.drafted) D.push({ id: "product", title: "Product brief", tag: "ARTIFACT", body: co.product.name + (co.product.price ? " \xB7 $" + co.product.price : "") + "\n\n" + (co.product.blurb || "") });
  (co.posts || []).forEach((p, i) => D.push({ id: "post-" + p.id, title: "Social post " + (i + 1), tag: "ARTIFACT", body: p.text }));
  (co.inbox || []).forEach((m) => D.push({ id: "mail-" + m.id, title: m.subject || "Outreach", tag: "ARTIFACT", body: "To: " + m.to + "\n\n" + m.body }));
  return D;
}
function docsCard(co) {
  const docs = docsFor(co);
  const c = el("div", "card");
  const h = el("div", "cthead");
  h.append(cardTitle("Documents", docs.length ? docs.length + " artifacts" : "none yet"));
  if (docs.length > 4) {
    const v = el("button", "taskmanage", "View all \u2192");
    v.onclick = () => {
      pane = { kind: "docs" };
      render();
    };
    h.append(v);
  }
  c.append(h);
  if (!docs.length) {
    c.append(el("div", "empty", "The clone's artifacts land here as it works \u2014 briefings, the site, posts, outreach."));
    return c;
  }
  for (const d of docs.slice(0, 4)) c.append(docRow(co, d));
  return c;
}
function docRow(co, d) {
  const r = el("button", "docrow");
  r.append(el("span", "docname", d.title), el("span", "doctag", d.tag));
  r.onclick = () => {
    if (d.site) pane = { kind: "site" };
    else pane = { kind: "doc", docId: d.id };
    render();
  };
  return r;
}
function docsPane(body, co) {
  body.append(el("h3", "ptitle", "Documents"));
  const docs = docsFor(co);
  if (!docs.length) {
    body.append(el("div", "empty", "Nothing yet."));
    return;
  }
  for (const d of docs) body.append(docRow(co, d));
}
function docPane(body, co) {
  const d = docsFor(co).find((x) => x.id === pane.docId);
  if (!d) {
    body.append(el("div", "empty", "Not found."));
    return;
  }
  body.append(el("h3", "ptitle", d.title));
  body.append(el("div", "kicker", d.tag + " \xB7 drafted by the clone"));
  body.append(el("pre", "doctext", d.body || ""));
}
function growthCol(co) {
  const c = el("div", "col");
  c.append(el("div", "chead", "GROWTH"));
  const angle = optOf(co.decisions.angle) || shownOf(co.decisions.angle);
  const runMoveObj = movesFor(co).find((m) => m.id === "run");
  const ac = el("div", "card");
  ac.append(cardTitle("Ads", angle ? "ready" : "choose an angle"));
  if (angle) {
    const ad = el("div", "adprev");
    ad.append(el("div", "adkick", "SAMPLE AD \xB7 " + co.name));
    ad.append(el("div", "adhead", angle.text || angle.label));
    if (angle.body) ad.append(el("div", "adbody", angle.body));
    if (angle.cta) ad.append(el("span", "adcta", angle.cta));
    ac.append(ad);
    if (runMoveObj) {
      const b = el("button", "growbtn", "Set up ads");
      b.onclick = () => void runMove(co, runMoveObj);
      ac.append(b);
    }
  } else {
    ac.append(el("div", "empty", "Pick an ad angle in the slate and a preview appears here."));
  }
  c.append(ac);
  const sc = el("div", "card");
  const at = el("div", "cthead");
  at.append(cardTitle("Social", co.posts.length ? co.posts.length + " drafts" : "none yet"));
  const tog = el("button", "toggle" + (co.autotweet ? " on" : ""), co.autotweet ? "Auto-post: on" : "Auto-post: off");
  tog.onclick = async () => {
    co.autotweet = !co.autotweet;
    await saveCo(co);
    render();
  };
  sc.append(at, tog);
  const draftBtn = el("button", "growbtn ghost", "Draft a post");
  draftBtn.onclick = () => void genPost(co, { lane: "social" });
  sc.append(draftBtn);
  for (const p of co.posts.slice(0, 4)) {
    const pr = el("div", "post");
    pr.append(el("div", "ptext", p.text));
    const foot = el("div", "pfoot");
    foot.append(el("span", "ptag s-" + p.state, p.state));
    if (p.state !== "posted") {
      const send = el("button", "psend", "Post");
      send.onclick = () => void runMove(co, { mode: "approve", lane: "social", n: "Post to social", postId: p.id, args: { text: p.text } });
      foot.append(send);
    }
    pr.append(foot);
    sc.append(pr);
  }
  c.append(sc);
  const ic = el("div", "card");
  ic.append(cardTitle("Inbox", co.inbox.length ? co.inbox.length + " drafts" : "outreach"));
  const outBtn = el("button", "growbtn ghost", "Draft outreach");
  outBtn.onclick = () => void genOutreach(co, { lane: "inbox" });
  ic.append(outBtn);
  for (const m of co.inbox.slice(0, 3)) {
    const mr = el("div", "mail");
    mr.append(el("div", "msubj", m.subject));
    mr.append(el("div", "mto", "to " + m.to));
    mr.append(el("div", "mbody", m.body.slice(0, 140)));
    const foot = el("div", "pfoot");
    foot.append(el("span", "ptag s-" + m.state, m.state === "drafted" ? "in Gmail" : m.state));
    if (m.state !== "drafted") {
      const draft2 = el("button", "psend", "Draft in Gmail");
      draft2.onclick = () => void runMove(co, { mode: "approve", lane: "inbox", n: m.subject || "outreach", mailId: m.id, verb: "drafting", doneVerb: "drafted", args: { subject: m.subject, body: m.body } });
      foot.append(draft2);
    } else if (m.ref) {
      const open = el("a", "psend", "Open in Gmail");
      open.href = "https://mail.google.com/mail/u/0/#drafts";
      open.target = "_blank";
      open.rel = "noopener";
      foot.append(open);
    }
    mr.append(foot);
    ic.append(mr);
  }
  if (co.inbox.length) ic.append(el("div", "fundnote", "\u201CDraft in Gmail\u201D creates a real draft \u2014 it never sends. You send it yourself from Gmail."));
  c.append(ic);
  return c;
}
function strategyCol(co) {
  const c = el("div", "col");
  c.append(el("div", "chead", "STRATEGY"));
  const cc = el("div", "card chatcard");
  const head = el("div", "chathead");
  const badge = el("div", "ceobadge", co.glyph);
  badge.style.background = co.color;
  badge.style.color = co.ink;
  head.append(badge, el("div", "ceoname", "Your CEO"), el("div", "ceosub", "runs " + co.name));
  cc.append(head);
  const thread = el("div", "thread");
  if (!co.chat.length) thread.append(el("div", "empty", "Ask your CEO what to do next \u2014 or type /plan, /post, /outreach, /ship."));
  for (const m of co.chat.slice(-12)) {
    const b = el("div", "msg " + (m.who === "you" ? "me" : "ceo"));
    b.append(el("div", "mbub", m.text), el("time", null, m.at));
    thread.append(b);
  }
  cc.append(thread);
  const row = el("div", "chatrow");
  const input = el("input");
  input.placeholder = "Message your CEO, or / for commands";
  const send = async () => {
    const v = input.value.trim();
    if (!v) return;
    input.value = "";
    await ceoCommand(co, v);
    const th = document.querySelector(".thread");
    if (th) th.scrollTop = th.scrollHeight;
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void send();
  });
  const btn = el("button", "chatsend", "\u2192");
  btn.onclick = () => void send();
  row.append(input, btn);
  cc.append(row);
  cc.append(el("div", "canvasnote", "Drop an intent \u2014 it becomes queued work."));
  const chipsRow = el("div", "canvaschips");
  for (const ch of canvasChips(co)) {
    const b = el("button", "chip", ch.label);
    b.onclick = async () => {
      co.chat.push({ id: uid(), who: "you", text: ch.label, at: clock() });
      logLine(co, "you: " + ch.label, "run", null);
      await saveCo(co);
      render();
      await ch.run();
    };
    chipsRow.append(b);
  }
  cc.append(chipsRow);
  c.append(cc);
  return c;
}
function canvasChips(co) {
  const post = { label: "Draft social", run: () => genPost(co, { lane: "social" }) };
  const out = { label: "Draft outreach", run: () => genOutreach(co, { lane: "inbox" }) };
  if (kindCfg(co).econ === "usage") return [post, out, { label: co.site && co.site.drafted ? "Rebuild the wrapp" : "Ship the wrapp", run: () => genSite(co) }];
  return [post, out, { label: co.product && co.product.drafted ? "Rebuild the site" : "Shape the product", run: () => co.product && co.product.drafted ? genSite(co) : genProduct(co) }];
}
async function ceoCommand(co, text) {
  if (guardWrite(co)) return;
  const cmd = text.toLowerCase();
  if (cmd === "/post") return genPost(co, { lane: "social" });
  if (cmd === "/outreach") return genOutreach(co, { lane: "inbox" });
  if (cmd === "/ship") {
    const m = movesFor(co).find((x) => x.mode === "approve");
    if (m) return runMove(co, m);
    toast("Nothing staged to ship \u2014 choose an angle and a channel first.");
    return;
  }
  if (cmd === "/plan") return ceoSay(co, "Review the board and tell me the 3 highest-leverage moves for today.");
  return ceoSay(co, text);
}
function cardTitle(t, more) {
  const d = el("div", "ct");
  d.append(el("span", null, t));
  if (more) d.append(el("span", "more", more));
  return d;
}
function kvRow(k, v, na) {
  const r = el("div", "kv");
  r.append(el("span", null, k), el("b", na ? "na" : null, v));
  return r;
}
var stateTag = (d) => d.inherited ? ["t-inh", "Inherited"] : d.chosenId ? ["t-done", "Yours"] : d.stale ? ["t-run", "Restreamed"] : d.busy ? ["t-run", "Drafting"] : d.options.length ? ["t-pend", "Drafted"] : ["t-pend", "\u2014"];
function decRow(co, d) {
  const o = shownOf(d);
  const b = el("button", "row");
  b.append(el("div", "rname", d.label + (o ? " \xB7 " + o.label : d.inherited ? " \xB7 " + d.inherited.value.slice(0, 40) : "")));
  const meta = el("div", "rmeta");
  const [cls, txt] = stateTag(d);
  meta.append(el("span", "tag " + cls, txt));
  meta.append(el("span", null, d.error ? d.error : d.busy ? "drafting\u2026" : d.inherited ? "inherited \xB7 tap to see" : d.chosenId ? "locked " + d.chosenAt + " \xB7 tap to see" : d.options.length + " options"));
  b.append(meta);
  b.onclick = () => {
    pane = { kind: d.id };
    render();
  };
  return b;
}
function renderPane(co) {
  let host = $("pane");
  if (!host) {
    host = el("aside");
    host.id = "pane";
    document.body.append(host);
  }
  host.textContent = "";
  host.classList.toggle("open", !!pane);
  if (!pane || !co) return;
  const head = el("div", "phead");
  const isTok = pane.kind === "tokens";
  const isSite = pane.kind === "site";
  const isConn = pane.kind === "connectors";
  const isTasks = pane.kind === "tasks";
  const isDocs = pane.kind === "docs" || pane.kind === "doc";
  const isAuto = pane.kind === "autonomy";
  const d = isTok || isSite || isConn || isTasks || isDocs || isAuto ? null : co.decisions[pane.kind];
  head.append(el("div", "pkind", isTok ? "RUNWAY" : isSite ? "THE SITE" : isConn ? "CONNECTORS" : isTasks ? "TASKS" : isDocs ? "DOCUMENTS" : isAuto ? "THE AUTONOMY LINE" : d ? d.axis : ""));
  const close = el("button", "pclose", "\u2715");
  close.onclick = () => {
    pane = null;
    render();
  };
  head.append(close);
  host.append(head);
  const body = el("div", "pbody");
  host.append(body);
  if (isTok) {
    tokensPane(body, co);
    return;
  }
  if (isSite) {
    sitePane(body, co);
    return;
  }
  if (isConn) {
    connectorsPane(body);
    return;
  }
  if (isAuto) {
    autonomyPane(body, co);
    return;
  }
  if (isTasks) {
    tasksPane(body, co);
    return;
  }
  if (pane.kind === "docs") {
    docsPane(body, co);
    return;
  }
  if (pane.kind === "doc") {
    docPane(body, co);
    return;
  }
  if (!d) return;
  slate(body, co, d);
}
function autonomyPane(body, co) {
  const P = co.policy || (co.policy = { ...DEFAULT_POLICY });
  body.append(el("h3", "ptitle", "What " + co.name + "'s CEO does on its own"));
  body.append(el("div", "psub", "These run unattended \u2014 on the timer while this tab is open, and while it's closed once the runner's on. Flip any off and the CEO leaves it for you."));
  const list = el("div", "autolist");
  for (const lane of AUTONOMY_LANES) {
    const on = P[lane.id] !== false;
    const row = el("button", "autorow" + (on ? " on" : ""));
    const mid = el("div", "automid");
    mid.append(el("div", "autolab", lane.label), el("div", "autonote", lane.note));
    const sw = el("span", "autosw" + (on ? " on" : ""));
    row.append(mid, sw);
    row.onclick = async () => {
      if (guardWrite(co)) return;
      P[lane.id] = !on;
      await saveCo(co);
      render();
      pane = { kind: "autonomy" };
      renderPane(co);
    };
    list.append(row);
  }
  body.append(list);
  body.append(el("div", "autolocktitle", "Always waits for you"));
  const locked = el("div", "autolocked");
  for (const [lab, note] of [["Publish the site", "the draft goes live only when you say"], ["Send a post", "nothing posts to a channel on its own"], ["Send an email", "outreach drafts; you press send"], ["Take payment", "no charge without your setup + tap"]]) {
    const r = el("div", "autolockrow");
    r.append(el("span", "autolockico", "\u{1F512}"), (() => {
      const m = el("div");
      m.append(el("div", "autolab", lab), el("div", "autonote", note));
      return m;
    })());
    locked.append(r);
  }
  body.append(locked);
  body.append(el("div", "fundnote", "Reversible work can be automated; anything that leaves the machine can't. That line never moves \u2014 it's the whole promise."));
}
function sitePane(body, co) {
  body.append(el("h3", "ptitle", co.name + " \u2014 the site"));
  if (!co.site || !co.site.html) {
    body.append(el("div", "empty", "No site drafted yet. Autopilot builds it from your context and the angle you're running."));
    const b = el("button", "growbtn", "Build it now");
    b.onclick = () => void genSite(co);
    body.append(b);
    return;
  }
  body.append(el("div", "kicker", co.site.host + " \xB7 " + (co.site.live ? "live" : "drafted locally \u2014 not public")));
  const frame = el("iframe", "siteframe");
  frame.setAttribute("sandbox", "");
  frame.setAttribute("title", co.name + " preview");
  frame.srcdoc = co.site.html;
  body.append(frame);
  if (co.site.live) {
    body.append(el("div", "picknote", "published " + (co.site.at || "") + " \xB7 " + (co.site.url || "https://" + co.site.host)));
  } else {
    const pub = el("button", "growbtn", "Publish \u2014 make it live");
    pub.onclick = () => void runMove(co, { mode: "approve", lane: "site", n: "Publish " + co.site.host, args: { host: co.site.host, html: co.site.html } });
    body.append(pub);
    body.append(el("div", "fundnote", "Preview is local. Publishing is a gated move \u2014 it needs a deploy connector and your go; nothing is public until then."));
  }
  const re = el("button", "act", "\u21BA rebuild the page");
  re.onclick = () => void genSite(co);
  body.append(re);
}
function slate(body, co, d) {
  body.append(el("h3", "ptitle", d.label));
  if (d.inherited) {
    const box = el("div", "inhbox");
    box.append(el("div", "kicker", "inherited from " + d.inherited.from));
    box.append(el("div", "inhval", d.inherited.value));
    box.append(el("div", "fundnote", "This came with the context you lent. Autopilot treats it as settled and writes everything downstream to match."));
    const take = el("button", "act", "decide it here instead");
    take.onclick = async () => {
      const key = SPEC_BY_ID[d.id]?.inherit;
      if (key) co.overridden = [.../* @__PURE__ */ new Set([...co.overridden || [], key])];
      d.inherited = null;
      await saveCo(co);
      render();
      await genOptions(co, d.id, "draft");
      await saveCo(co);
      render();
    };
    box.append(take);
    body.append(box);
    return;
  }
  if (d.stale) body.append(el("div", "stalenote", "\u25CF restreamed \u2014 an upstream decision changed, so these were rewritten"));
  if (d.busy) body.append(researching("drafting options\u2026"));
  if (d.error) {
    body.append(el("div", "err", d.error));
    const again = el("button", "act", "try again");
    again.onclick = async () => {
      await genOptions(co, d.id, "draft");
      await saveCo(co);
      render();
    };
    body.append(again);
  }
  for (const o of d.options) body.append(optionCard(co, d, o));
  const hatch = el("div", "optrow own");
  hatch.append(el("div", "on2", "none of these \u2014 say what you'd do instead"));
  hatch.append(el("div", "op", "it becomes a real option, indistinguishable from the drafted ones."));
  const row = el("div", "hatchrow");
  const input = el("input");
  input.placeholder = "describe what you'd do\u2026";
  const go = async () => {
    const v = input.value.trim();
    if (!v) return;
    input.value = "";
    await ownOption(co, d, v);
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") void go();
  });
  const btn = el("button", "hatchgo", "use this");
  btn.onclick = () => void go();
  row.append(input, btn);
  hatch.append(row);
  body.append(hatch);
  if (d.chosenId) {
    body.append(el("div", "sec", "YOUR PICK"));
    body.append(el("div", "picknote", "locked at " + d.chosenAt + " \xB7 by you"));
    const un = el("button", "unbtn", "unlock \u2014 go back to drafted");
    un.onclick = () => void unchoose(co, d);
    body.append(un);
  }
  if (!d.busy && d.options.length) {
    const re = el("button", "act", "\u21BA redraft these");
    re.onclick = async () => {
      await genOptions(co, d.id, "draft");
      await saveCo(co);
      render();
    };
    body.append(re);
  }
}
function optionCard(co, d, o) {
  const chosen = isChosen(d, o), drafted = isDrafted(d, o);
  const card = el("button", "optrow" + (chosen ? " chosen" : "") + (drafted ? " drafted" : ""));
  if (o.rec && !chosen) card.append(el("span", "rec draft", "RECOMMENDED"));
  if (chosen) card.append(el("span", "rec live", "\u2713 CHOSEN BY YOU"));
  card.append(el("div", "ol", o.label));
  if (o.text) card.append(el("div", "on2", o.text));
  if (o.body) card.append(el("div", "op", o.body));
  if (o.cta) card.append(el("div", "octa", o.cta));
  if (o.lines && o.lines.length) {
    const w = el("div", "olines");
    for (const l of o.lines) w.append(el("div", "oline", "\u201C" + l + "\u201D"));
    card.append(w);
  }
  if (drafted) card.append(el("div", "draftnote", "drafted by autopilot \xB7 tap to make it yours"));
  card.onclick = () => void choose(co, d, o.id);
  return card;
}
var fmtTok = (n) => n >= 1e6 ? (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n);
function tokenMeter(co) {
  const w = el("div", "tokmeter");
  if (!co) return w;
  const tl = el("div", "tl");
  tl.append(el("span", null, "TOKENS THIS WEEK"), el("b", null, fmtTok(co.tokens.spent) + " / " + fmtTok(co.tokens.budget)));
  w.append(tl);
  const bar = el("div", "tokbar");
  const areas = [["draft", "#C8F250"], ["restream", "#E9954A"]];
  for (const [k, col] of areas) {
    const pct = (co.tokens.by[k] || 0) / co.tokens.budget * 100;
    if (pct > 0.2) {
      const i = el("i");
      i.style.width = Math.min(100, pct) + "%";
      i.style.background = col;
      bar.append(i);
    }
  }
  w.append(bar);
  w.onclick = () => {
    pane = { kind: "tokens" };
    render();
  };
  return w;
}
function tokensPane(body, co) {
  body.append(el("h3", "ptitle", "Fund this company with real runway"));
  body.append(el("div", "fundsub", "Works while you sleep \u2014 runway is your CEO's working money, spent on your own Claude."));
  const left = Math.max(0, co.tokens.budget - co.tokens.spent);
  const big = el("div", "tokbig");
  big.append(el("div", "tokn", fmtTok(left)));
  big.append(el("div", "toklab", "runway left \xB7 " + fmtTok(co.tokens.spent) + " of " + fmtTok(co.tokens.budget) + " used this week"));
  body.append(big);
  const PER_OP = 26e3;
  body.append(el("div", "fundest", "\u2248 " + Math.round(left / PER_OP) + " more moves of runway \u2014 a decision or a draft is about " + fmtTok(PER_OP) + " tokens"));
  body.append(el("div", "sec", "WHAT THE RUNWAY BUYS"));
  const inc = el("div", "includes");
  for (const t of [
    "Runs on your own Claude \u2014 no key ever leaves you",
    "The whole operating loop: decide, draft, stage, report",
    "The site / wrapp and any connectors you wire",
    "Auto top-up keeps it working when the week runs low"
  ]) {
    const r = el("div", "incl");
    r.append(el("span", "incheck", "\u2713"), el("span", null, t));
    inc.append(r);
  }
  body.append(inc);
  body.append(el("div", "sec", "CHOOSE THE RUNWAY"));
  const tiers = el("div", "tiers");
  for (const [n, v, note] of [
    ["Trickle", 5e5, "keeps one thing moving at a time"],
    ["Steady", 2e6, "a full week of drafting and revising"],
    ["Push", 5e6, "it works ahead of you \u2014 expect more staged than you can read"]
  ]) {
    const t = el("div", "tier" + (v === co.tokens.budget ? " on" : ""));
    t.append(el("span", "tl", n), el("span", "ta", fmtTok(v) + "/wk"), el("span", "tp", note));
    t.onclick = async () => {
      co.tokens.budget = v;
      await saveCo(co);
      render();
    };
    tiers.append(t);
  }
  body.append(tiers);
  const atRow = el("div", "cthead");
  atRow.style.marginTop = "12px";
  atRow.append(el("span", "fundsub", "Auto top-up \u2014 keep going when runway runs low"));
  const at = el("button", "toggle" + (co.autoTopup ? " on" : ""), co.autoTopup ? "On" : "Off");
  at.onclick = async () => {
    co.autoTopup = !co.autoTopup;
    await saveCo(co);
    render();
  };
  atRow.append(at);
  body.append(atRow);
  body.append(el(
    "div",
    "honest",
    "Not a subscription. Runway is capacity to work \u2014 it runs as fast as you fund it, on your own Claude, and stops when you stop."
  ));
  body.append(el(
    "div",
    "honest ember",
    co.tokens.estimated ? "\u25CF Some of these are ESTIMATES \u2014 your backend didn't report usage for every call, so they're counted at ~4 characters per token and marked, not quietly rounded." : "\u25CF Tokens are the only real number here \u2014 from the broker's own usage counts. Revenue/usage stay \u201Cnot connected\u201D rather than drawing numbers that don't exist."
  ));
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pane) {
    pane = null;
    render();
  }
});
render();
//# sourceMappingURL=autopilot.js.map
