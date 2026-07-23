(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const store = {
    get(key, fallback) {
      try {
        const value = localStorage.getItem(`kemos:${key}`);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(`kemos:${key}`, JSON.stringify(value));
    }
  };

  const apps = {
    welcome: { name: "Welcome", icon: "◫", description: "Get to know KEMOS" },
    gamehub: { name: "Game Hub", icon: "🎮", description: "Your games and high scores" },
    browser: { name: "KEMOS Browser", icon: "🌐", description: "Search and open the web" },
    notes: { name: "Notes", icon: "📝", description: "Write ideas that save automatically" },
    calculator: { name: "Calculator", icon: "🧮", description: "Standard calculator" },
    paint: { name: "Paint", icon: "🎨", description: "Draw on a local canvas" },
    files: { name: "File Explorer", icon: "📁", description: "Browse your KEMOS files" },
    media: { name: "Media Player", icon: "▶", description: "Local ambient player" },
    clock: { name: "Clock", icon: "🕘", description: "Clock, timer, and focus sessions" },
    settings: { name: "Settings", icon: "⚙", description: "Personalize your desktop" },
    terminal: { name: "Terminal", icon: "⌨", description: "KEMOS command line" },
    store: { name: "Store", icon: "🛍", description: "Discover KEMOS apps" }
  };

  const desktopAppIds = ["gamehub", "browser", "notes", "files", "paint", "settings"];
  const taskbarPinned = ["gamehub", "browser", "files", "store"];
  const wallpapers = [
    "radial-gradient(circle at 72% 32%,rgba(116,193,255,.95) 0 7%,transparent 22%),radial-gradient(circle at 56% 56%,rgba(24,94,186,.9),transparent 33%),linear-gradient(145deg,#031735 8%,#134aa3 48%,#071634 100%)",
    "radial-gradient(circle at 35% 30%,rgba(255,150,215,.72),transparent 23%),radial-gradient(circle at 68% 65%,rgba(90,85,220,.76),transparent 32%),linear-gradient(135deg,#17144a,#72266d 52%,#181540)",
    "radial-gradient(circle at 60% 38%,rgba(95,230,181,.75),transparent 22%),radial-gradient(circle at 40% 70%,rgba(26,115,115,.8),transparent 35%),linear-gradient(145deg,#061d24,#0d4a55 50%,#071a24)",
    "linear-gradient(155deg,#141414 0 42%,#2a2a2a 42% 58%,#0c0c0c 58%)"
  ];
  const accents = ["#0078d4", "#744da9", "#d13438", "#008575", "#ca5010", "#8764b8"];

  const runtime = {
    started: false,
    z: 100,
    activeWindow: null,
    recent: store.get("recent", ["gamehub", "notes", "browser", "paint"]),
    notifications: store.get("notifications", [
      { icon: "🎮", title: "KEMOS is ready", copy: "Open Game Hub to start playing.", time: "Now" },
      { icon: "☁", title: "Local saves enabled", copy: "Guest data stays on this device.", time: "Now" }
    ]),
    focusSeconds: 0,
    focusTotal: 25 * 60,
    focusInterval: null,
    installPrompt: null
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function formatTime(date = new Date()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function formatDate(date = new Date()) {
    return date.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" });
  }

  function configureAppearance() {
    const settings = store.get("settings", { theme: "dark", accent: "#0078d4", wallpaper: 0, alignment: "center" });
    document.body.classList.toggle("light", settings.theme === "light");
    document.documentElement.style.setProperty("--accent-strong", settings.accent);
    document.documentElement.style.setProperty("--accent", settings.accent === "#0078d4" ? "#60cdff" : settings.accent);
    document.documentElement.style.setProperty("--wallpaper", wallpapers[settings.wallpaper] || wallpapers[0]);
    $("#taskbar-apps").style.justifySelf = settings.alignment === "left" ? "start" : "center";
  }

  function saveSetting(key, value) {
    const settings = store.get("settings", {});
    settings[key] = value;
    store.set("settings", settings);
    configureAppearance();
  }

  function processAuthCallback() {
    const hash = new URLSearchParams(location.hash.slice(1));
    const token = hash.get("access_token");
    if (!token) return false;
    const config = window.KEMOS_AUTH || {};
    if (!config.supabaseUrl) return false;
    fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.supabaseAnonKey
      }
    }).then(response => response.ok ? response.json() : Promise.reject(new Error("Sign-in failed")))
      .then(user => {
        store.set("session", { token, user });
        history.replaceState(null, "", location.pathname);
        startDesktop(user.user_metadata?.full_name || user.user_metadata?.user_name || user.email || "Player");
      })
      .catch(() => showLogin("Could not finish sign-in. Try again."));
    return true;
  }

  function beginOAuth(provider) {
    const config = window.KEMOS_AUTH || {};
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      $("#auth-status").textContent = "OAuth needs the public Supabase URL and anon key in auth-config.js.";
      return;
    }
    const redirect = `${location.origin}${location.pathname}`;
    location.href = `${config.supabaseUrl}/auth/v1/authorize?provider=${encodeURIComponent(provider)}&redirect_to=${encodeURIComponent(redirect)}`;
  }

  function showLogin(message) {
    $("#boot").classList.add("hidden");
    $("#desktop").classList.add("hidden");
    $("#login").classList.remove("hidden");
    if (message) $("#auth-status").textContent = message;
  }

  function startDesktop(name = "Guest") {
    $("#boot").classList.add("hidden");
    $("#login").classList.add("hidden");
    $("#desktop").classList.remove("hidden");
    $("#account-name").textContent = name;
    if (!runtime.started) {
      runtime.started = true;
      renderLaunchers();
      renderCalendar();
      renderNotifications();
      wireDesktop();
      updateClock();
      setInterval(updateClock, 1000);
      setTimeout(() => toast("KEMOS", `Welcome, ${name}. Your desktop is ready.`, "◫"), 550);
    }
    $("#desktop").focus();
  }

  function renderLaunchers() {
    $("#desktop-icons").innerHTML = desktopAppIds.map(id => shortcutHtml(id, "desktop-shortcut")).join("");
    $("#start-apps").innerHTML = Object.keys(apps).map(id => shortcutHtml(id, "start-app")).join("");
    const taskbar = $("#taskbar-apps");
    taskbar.insertAdjacentHTML("beforeend", taskbarPinned.map(id => `
      <button class="taskbar-icon app-taskbar-icon" data-app="${id}" title="${apps[id].name}">
        <span>${apps[id].icon}</span>
      </button>`).join(""));
    renderRecent();
  }

  function shortcutHtml(id, className) {
    return `<button class="${className}" data-open-app="${id}" title="${apps[id].description}">
      <span class="app-glyph">${apps[id].icon}</span>
      <span class="app-label">${apps[id].name}</span>
    </button>`;
  }

  function renderRecent() {
    $("#recommended-list").innerHTML = runtime.recent.slice(0, 4).map(id => `
      <button class="recent-item" data-open-app="${id}">
        <span class="app-glyph">${apps[id].icon}</span>
        <strong>${apps[id].name}</strong>
        <small>${apps[id].description}</small>
      </button>`).join("");
  }

  function addRecent(id) {
    runtime.recent = [id, ...runtime.recent.filter(item => item !== id)].slice(0, 6);
    store.set("recent", runtime.recent);
    renderRecent();
  }

  function renderNotifications() {
    const list = $("#notification-list");
    list.innerHTML = runtime.notifications.length ? runtime.notifications.map(note => `
      <article class="notification">
        <span>${note.icon}</span>
        <div><strong>${escapeHtml(note.title)}</strong><p>${escapeHtml(note.copy)}</p></div>
        <small>${escapeHtml(note.time)}</small>
      </article>`).join("") : `<div class="empty-state" style="height:130px">You're all caught up.</div>`;
  }

  function notify(title, copy, icon = "◫") {
    runtime.notifications.unshift({ title, copy, icon, time: "Now" });
    runtime.notifications = runtime.notifications.slice(0, 12);
    store.set("notifications", runtime.notifications);
    renderNotifications();
    toast(title, copy, icon);
  }

  function toast(title, copy, icon = "◫") {
    const item = document.createElement("article");
    item.className = "toast";
    item.innerHTML = `<span>${icon}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>`;
    $("#toast-region").append(item);
    setTimeout(() => item.remove(), 4200);
  }

  function renderCalendar() {
    const now = new Date();
    $("#calendar-month").textContent = now.toLocaleDateString([], { month: "long", year: "numeric" });
    $("#widget-date").textContent = now.toLocaleDateString([], { month: "long", day: "numeric" });
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    const headers = ["S", "M", "T", "W", "T", "F", "S"].map(day => `<strong>${day}</strong>`).join("");
    const blanks = Array(first).fill("<span></span>").join("");
    const dates = Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      return `<span class="${day === now.getDate() ? "today" : ""}">${day}</span>`;
    }).join("");
    $("#calendar-grid").innerHTML = headers + blanks + dates;
  }

  function updateClock() {
    const now = new Date();
    $("#taskbar-time").textContent = formatTime(now);
    $("#taskbar-date").textContent = formatDate(now);
    $$(".live-clock").forEach(clock => clock.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }

  function closePanels(except = null) {
    ["start-menu", "search-panel", "widgets-panel", "quick-panel", "notifications-panel", "context-menu"].forEach(id => {
      if (id !== except) $(`#${id}`).classList.add("hidden");
    });
  }

  function togglePanel(id) {
    const panel = $(`#${id}`);
    const opening = panel.classList.contains("hidden");
    closePanels(opening ? id : null);
    panel.classList.toggle("hidden", !opening);
    if (opening) {
      const input = $("input", panel);
      if (input) setTimeout(() => input.focus(), 50);
    }
  }

  function wireDesktop() {
    document.addEventListener("click", event => {
      const opener = event.target.closest("[data-open-app]");
      if (opener) {
        openApp(opener.dataset.openApp);
        closePanels();
      }
      if (!event.target.closest(".start-menu,.search-panel,.flyout,.taskbar,.context-menu") && !event.target.closest(".app-window")) {
        closePanels();
      }
    });

    $("#start-button").addEventListener("click", event => { event.stopPropagation(); togglePanel("start-menu"); });
    $("#search-button").addEventListener("click", event => { event.stopPropagation(); togglePanel("search-panel"); renderSearchResults(""); });
    $("#widgets-button").addEventListener("click", event => { event.stopPropagation(); togglePanel("widgets-panel"); });
    $("#quick-button").addEventListener("click", event => { event.stopPropagation(); togglePanel("quick-panel"); });
    $("#clock-button").addEventListener("click", event => { event.stopPropagation(); togglePanel("notifications-panel"); });
    $$("[data-close-panel]").forEach(button => button.addEventListener("click", closePanels));
    $("#clear-notifications").addEventListener("click", () => {
      runtime.notifications = [];
      store.set("notifications", []);
      renderNotifications();
    });

    $("#start-search-input").addEventListener("input", event => {
      $("#start-menu").classList.add("hidden");
      $("#search-panel").classList.remove("hidden");
      $("#global-search-input").value = event.target.value;
      renderSearchResults(event.target.value);
      $("#global-search-input").focus();
    });
    $("#global-search-input").addEventListener("input", event => renderSearchResults(event.target.value));
    $("#global-search-input").addEventListener("keydown", event => {
      if (event.key === "Enter" && event.currentTarget.value.trim()) {
        openWebSearch(event.currentTarget.value.trim());
      }
    });

    $("#desktop").addEventListener("contextmenu", event => {
      if (event.target.closest(".app-window,.taskbar,.flyout,.start-menu,.search-panel")) return;
      event.preventDefault();
      closePanels("context-menu");
      const menu = $("#context-menu");
      menu.style.left = `${Math.min(event.clientX, innerWidth - 230)}px`;
      menu.style.top = `${Math.min(event.clientY, innerHeight - 270)}px`;
      menu.classList.remove("hidden");
    });
    $("#context-menu").addEventListener("click", event => {
      const action = event.target.closest("[data-context]")?.dataset.context;
      if (action === "refresh") {
        $("#desktop-icons").animate([{ opacity: .2 }, { opacity: 1 }], { duration: 300 });
        toast("Desktop", "Refreshed.", "↻");
      }
      if (action === "new-note") {
        createNewNote();
        openApp("notes");
      }
      if (action === "wallpaper") nextWallpaper();
      closePanels();
    });

    $("#brightness").addEventListener("input", event => {
      $("#desktop").style.filter = `brightness(${event.target.value}%)`;
    });
    $("#volume").addEventListener("input", event => store.set("volume", Number(event.target.value)));
    $$(".quick-toggle").forEach(button => button.addEventListener("click", () => {
      button.classList.toggle("active");
      if (button.dataset.quick === "night") document.body.classList.toggle("night-mode", button.classList.contains("active"));
      if (button.dataset.quick === "focus" && button.classList.contains("active")) {
        openApp("clock");
        startFocus();
      }
    }));

    $("#show-desktop").addEventListener("click", () => {
      $$(".app-window").forEach(window => {
        window.classList.add("minimized");
        updateTaskbarWindow(window.dataset.appId);
      });
    });
    $("#power-button").addEventListener("click", () => {
      closePanels();
      $("#desktop").animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).onfinish = () => {
        store.set("session", null);
        showLogin("Signed out. Guest saves are still on this device.");
      };
    });

    document.addEventListener("keydown", event => {
      if ((event.metaKey || event.ctrlKey) && event.key === " ") {
        event.preventDefault();
        togglePanel("search-panel");
        renderSearchResults("");
      }
      if (event.key === "Escape") closePanels();
      if (event.altKey && event.key === "F4" && runtime.activeWindow) closeWindow(runtime.activeWindow);
    });

    window.addEventListener("beforeinstallprompt", event => {
      event.preventDefault();
      runtime.installPrompt = event;
      notify("Install KEMOS", "Install it like a desktop app from the Store.", "⬇");
    });
  }

  function renderSearchResults(query) {
    const term = query.trim().toLowerCase();
    const matches = Object.entries(apps).filter(([, app]) =>
      !term || `${app.name} ${app.description}`.toLowerCase().includes(term)
    );
    $("#search-results").innerHTML = `
      <div class="search-section-label">${term ? "Best match" : "Top apps"}</div>
      ${matches.slice(0, 8).map(([id, app]) => `
        <button class="search-result" data-open-app="${id}">
          <span class="app-glyph">${app.icon}</span>
          <span><strong>${app.name}</strong><small>${app.description}</small></span>
          <span>Open</span>
        </button>`).join("")}
      ${term ? `<div class="search-section-label">Search the web</div>
        <button class="search-result" id="web-search-result">
          <span class="app-glyph">🌐</span>
          <span><strong>Search for “${escapeHtml(query)}”</strong><small>Opens results in a new tab</small></span>
          <span>↗</span>
        </button>` : ""}`;
    $("#web-search-result")?.addEventListener("click", () => openWebSearch(query));
  }

  function openWebSearch(query) {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener,noreferrer");
    toast("KEMOS Browser", "Opened your search in a secure new tab.", "🌐");
  }

  function openApp(id, options = {}) {
    if (!apps[id] && !["snake", "pong", "tictactoe"].includes(id)) return;
    const existing = $(`.app-window[data-app-id="${id}"]`);
    if (existing) {
      existing.classList.remove("minimized");
      focusWindow(existing);
      updateTaskbarWindow(id);
      return;
    }
    const meta = apps[id] || {
      snake: { name: "Snake", icon: "🐍" },
      pong: { name: "Pong", icon: "🏓" },
      tictactoe: { name: "Tic-Tac-Toe", icon: "❎" }
    }[id];
    const fragment = $("#window-template").content.cloneNode(true);
    const windowEl = $(".app-window", fragment);
    windowEl.dataset.appId = id;
    $(".window-icon", fragment).textContent = meta.icon;
    $(".window-title strong", fragment).textContent = meta.name;
    $(".window-content", fragment).innerHTML = appMarkup(id, options);
    const offset = $$(".app-window").length % 7;
    windowEl.style.left = `${Math.max(8, (innerWidth - Math.min(860, innerWidth - 40)) / 2 + offset * 18)}px`;
    windowEl.style.top = `${Math.max(8, (innerHeight - Math.min(590, innerHeight - 80)) / 2 + offset * 13 - 16)}px`;
    $("#window-layer").append(fragment);
    const added = $(`.app-window[data-app-id="${id}"]`);
    wireWindow(added);
    wireApp(id, added);
    focusWindow(added);
    ensureTaskbarButton(id, meta);
    addRecent(apps[id] ? id : "gamehub");
  }

  function wireWindow(windowEl) {
    const titlebar = $(".titlebar", windowEl);
    let drag = null;
    titlebar.addEventListener("pointerdown", event => {
      if (event.target.closest("button") || windowEl.classList.contains("maximized")) return;
      focusWindow(windowEl);
      const rect = windowEl.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      titlebar.setPointerCapture(event.pointerId);
    });
    titlebar.addEventListener("pointermove", event => {
      if (!drag) return;
      windowEl.style.left = `${Math.max(-windowEl.offsetWidth + 100, Math.min(innerWidth - 100, event.clientX - drag.x))}px`;
      windowEl.style.top = `${Math.max(0, Math.min(innerHeight - 80, event.clientY - drag.y))}px`;
    });
    titlebar.addEventListener("pointerup", event => {
      if (!drag) return;
      drag = null;
      if (event.clientY < 8) maximizeWindow(windowEl);
      else if (event.clientX < 8) snapWindow(windowEl, "left");
      else if (event.clientX > innerWidth - 8) snapWindow(windowEl, "right");
    });
    titlebar.addEventListener("dblclick", () => maximizeWindow(windowEl));
    windowEl.addEventListener("pointerdown", () => focusWindow(windowEl));
    $$("[data-window]", windowEl).forEach(button => button.addEventListener("click", () => {
      const action = button.dataset.window;
      if (action === "close") closeWindow(windowEl);
      if (action === "minimize") minimizeWindow(windowEl);
      if (action === "maximize") maximizeWindow(windowEl);
    }));
  }

  function focusWindow(windowEl) {
    $$(".app-window").forEach(item => item.classList.remove("focused"));
    windowEl.classList.add("focused");
    windowEl.style.zIndex = ++runtime.z;
    runtime.activeWindow = windowEl;
    $$(".app-taskbar-icon").forEach(button => button.classList.toggle("active", button.dataset.app === windowEl.dataset.appId));
  }

  function minimizeWindow(windowEl) {
    windowEl.classList.add("minimized");
    if (runtime.activeWindow === windowEl) runtime.activeWindow = null;
    updateTaskbarWindow(windowEl.dataset.appId);
  }

  function maximizeWindow(windowEl) {
    if (windowEl.classList.toggle("maximized")) {
      windowEl.dataset.restore = JSON.stringify({
        left: windowEl.style.left, top: windowEl.style.top, width: windowEl.style.width, height: windowEl.style.height
      });
    } else {
      const restore = JSON.parse(windowEl.dataset.restore || "{}");
      Object.assign(windowEl.style, restore);
    }
  }

  function snapWindow(windowEl, side) {
    windowEl.classList.remove("maximized");
    windowEl.style.top = "0";
    windowEl.style.left = side === "left" ? "0" : "50%";
    windowEl.style.width = "50%";
    windowEl.style.height = "100%";
  }

  function closeWindow(windowEl) {
    const id = windowEl.dataset.appId;
    if (id === "snake" && windowEl.gameLoop) clearInterval(windowEl.gameLoop);
    if (id === "pong" && windowEl.gameFrame) cancelAnimationFrame(windowEl.gameFrame);
    windowEl.remove();
    $(`.app-taskbar-icon[data-app="${id}"]`)?.classList.remove("running", "active");
    runtime.activeWindow = null;
  }

  function ensureTaskbarButton(id, meta) {
    let button = $(`.app-taskbar-icon[data-app="${id}"]`);
    if (!button) {
      button = document.createElement("button");
      button.className = "taskbar-icon app-taskbar-icon";
      button.dataset.app = id;
      button.title = meta.name;
      button.innerHTML = `<span>${meta.icon}</span>`;
      $("#taskbar-apps").append(button);
      button.addEventListener("click", () => taskbarClick(id));
    }
    button.classList.add("running", "active");
    $$(".app-taskbar-icon").forEach(item => item.classList.toggle("active", item === button));
  }

  function updateTaskbarWindow(id) {
    const button = $(`.app-taskbar-icon[data-app="${id}"]`);
    const windowEl = $(`.app-window[data-app-id="${id}"]`);
    if (!button || !windowEl) return;
    button.classList.toggle("active", !windowEl.classList.contains("minimized") && runtime.activeWindow === windowEl);
    button.classList.add("running");
  }

  function taskbarClick(id) {
    const windowEl = $(`.app-window[data-app-id="${id}"]`);
    if (!windowEl) return openApp(id);
    if (!windowEl.classList.contains("minimized") && runtime.activeWindow === windowEl) minimizeWindow(windowEl);
    else {
      windowEl.classList.remove("minimized");
      focusWindow(windowEl);
    }
    updateTaskbarWindow(id);
  }

  function appMarkup(id) {
    const views = {
      welcome: () => `<div class="app-shell"><div class="app-body">
        <section class="hero"><span class="badge">KEMOS 1.0</span><h1>Your new game desktop.</h1><p>Built like a familiar PC, but focused on games, useful tools, and clean local saves.</p><button class="primary" data-open-app="gamehub">Open Game Hub</button></section>
        <div class="card-grid">
          <article class="card"><span>🪟</span><h3>Real desktop flow</h3><p>Drag, resize, snap, minimize, maximize, and multitask.</p></article>
          <article class="card"><span>💾</span><h3>Local saves</h3><p>Notes, settings, files, art, and scores remain on this device.</p></article>
          <article class="card"><span>📦</span><h3>Installable</h3><p>Add KEMOS to your device as a full-screen web app.</p></article>
        </div></div></div>`,
      gamehub: () => `<div class="app-shell"><div class="toolbar"><strong>Game Hub</strong><span style="flex:1"></span><span class="badge">3 games installed</span></div><div class="app-body">
        <section class="hero" style="min-height:190px"><span class="badge">FEATURED</span><h1>Play without leaving your desktop.</h1><p>Fast local games with saved high scores.</p></section>
        <div class="card-grid">
          <article class="card game-card" data-game="snake" style="--game-bg:linear-gradient(135deg,#115f4e,#50b458)"><span class="game-icon">🐍</span><h3>Snake</h3><p>High score: <b data-score="snake">${store.get("score:snake", 0)}</b></p></article>
          <article class="card game-card" data-game="pong" style="--game-bg:linear-gradient(135deg,#15366f,#4a7fe8)"><span class="game-icon">🏓</span><h3>Pong</h3><p>First to 7 wins.</p></article>
          <article class="card game-card" data-game="tictactoe" style="--game-bg:linear-gradient(135deg,#6c255c,#c34a82)"><span class="game-icon">❎</span><h3>Tic-Tac-Toe</h3><p>Two-player local match.</p></article>
        </div></div></div>`,
      browser: () => `<div class="app-shell"><div class="toolbar"><div class="browser-bar"><button title="Back">‹</button><button data-browser-home title="Home">⌂</button><input class="browser-address" placeholder="Search the web or enter an address"><button data-browser-go>Go</button></div></div>
        <div class="browser-home"><div><h1>KEMOS <span>Search</span></h1><form class="browser-search"><input placeholder="Search the web"><button>Search</button></form>
        <p style="color:var(--muted);font-size:12px">Sites open in a secure new tab because many websites block embedding.</p>
        <div class="browser-links"><button data-url="https://www.youtube.com">▶<br><small>YouTube</small></button><button data-url="https://github.com">⌘<br><small>GitHub</small></button><button data-url="https://itch.io">🎮<br><small>itch.io</small></button><button data-url="https://classroom.google.com">📚<br><small>Classroom</small></button></div></div></div></div>`,
      notes: () => notesMarkup(),
      calculator: () => `<div class="calculator"><div class="calc-display"><small class="calc-history"></small><strong class="calc-value">0</strong></div><div class="calc-grid">
        ${["C","⌫","%","÷","7","8","9","×","4","5","6","−","1","2","3","+","±","0",".","="].map(key => `<button class="${key === "=" ? "equals" : ""}" data-key="${key}">${key}</button>`).join("")}
      </div></div>`,
      paint: () => `<div class="paint-shell"><div class="toolbar paint-toolbar"><button data-paint="undo">↶ Undo</button><button data-paint="clear">Clear</button><label>Color <input type="color" value="#111111"></label><label>Size <input type="range" min="1" max="36" value="7"></label><span style="flex:1"></span><button data-paint="save">Save to Files</button><button data-paint="download">Download</button></div><div class="paint-stage"><canvas width="900" height="540"></canvas></div></div>`,
      files: () => filesMarkup(),
      media: () => `<div class="media-player"><div class="album-art">♫</div><h2>Ambient Focus</h2><p style="color:var(--muted)">KEMOS local tone generator</p><div class="media-controls"><button>↶</button><button class="play" data-media-play>▶</button><button>↷</button></div><label class="slider-row" style="width:260px"><span>◖</span><input data-media-volume type="range" min="0" max="100" value="30"></label></div>`,
      clock: () => clockMarkup(),
      settings: () => settingsMarkup(),
      terminal: () => `<div class="terminal"><div class="terminal-output">KEMOS Terminal [Version 1.0]\nType 'help' for available commands.\n\n</div><label class="terminal-input-row"><span>guest@kemos:~$</span><input autocomplete="off" autofocus></label></div>`,
      store: () => `<div class="app-shell"><div class="toolbar"><strong>KEMOS Store</strong><span style="flex:1"></span><button data-install-kemos>Install KEMOS</button></div><div class="app-body">
        <section class="store-banner"><span class="badge">ESSENTIAL</span><h1>Install KEMOS on this device</h1><p>Launch it full-screen with offline support.</p><button class="primary" data-install-kemos>Install</button></section>
        <h2>Included apps</h2><div class="card-grid">${Object.entries(apps).filter(([key]) => key !== "store").map(([, app]) => `<article class="card"><span style="font-size:28px">${app.icon}</span><h3>${app.name}</h3><p>${app.description}</p><span class="badge" style="margin-top:12px">Installed</span></article>`).join("")}</div></div></div>`,
      snake: () => `<div class="game-stage"><div class="game-hud"><strong>Score: <span data-snake-score>0</span></strong><button class="secondary" data-game-restart>Restart</button></div><canvas width="480" height="480"></canvas><small>Arrow keys or WASD to move</small></div>`,
      pong: () => `<div class="game-stage"><div class="game-hud"><strong><span data-pong-player>0</span> — <span data-pong-cpu>0</span></strong><button class="secondary" data-game-restart>Restart</button></div><canvas width="720" height="420"></canvas><small>Move with W/S or your pointer</small></div>`,
      tictactoe: () => `<div class="game-stage"><div class="game-hud"><strong data-tic-status>Player X's turn</strong><button class="secondary" data-game-restart>Restart</button></div><div class="tic-grid">${Array.from({ length: 9 }, (_, index) => `<button data-cell="${index}"></button>`).join("")}</div></div>`
    };
    return views[id] ? views[id]() : "";
  }

  function notesMarkup() {
    let notes = store.get("notes", []);
    if (!notes.length) {
      notes = [{ id: crypto.randomUUID(), title: "Welcome to Notes", body: "Your notes save automatically on this device.\n\nUse the + button to create another note.", updated: Date.now() }];
      store.set("notes", notes);
    }
    const active = store.get("activeNote", notes[0].id);
    const note = notes.find(item => item.id === active) || notes[0];
    return `<div class="notes-layout"><aside class="notes-sidebar"><button class="primary" data-note-new>＋ New note</button><div class="note-list">
      ${notes.map(item => `<button class="note-list-item ${item.id === note.id ? "active" : ""}" data-note-id="${item.id}"><strong>${escapeHtml(item.title || "Untitled")}</strong><small>${new Date(item.updated).toLocaleDateString()}</small></button>`).join("")}
      </div></aside><section class="notes-editor" data-active-note="${note.id}"><input value="${escapeHtml(note.title)}" placeholder="Title"><textarea placeholder="Start typing…">${escapeHtml(note.body)}</textarea></section></div>`;
  }

  function filesMarkup() {
    const files = store.get("files", [
      { id: "readme", name: "Welcome.txt", type: "text", content: "Welcome to your KEMOS files." },
      { id: "games", name: "Games", type: "folder" },
      { id: "pictures", name: "Pictures", type: "folder" },
      { id: "saves", name: "Saves", type: "folder" }
    ]);
    return `<div class="file-layout"><aside class="file-nav"><button class="active">⌂ Home</button><button>🖥 Desktop</button><button>📄 Documents</button><button>🖼 Pictures</button><button>⬇ Downloads</button></aside>
      <main class="file-main"><div class="toolbar" style="margin:-16px -16px 16px"><button data-file-new>＋ New text file</button><button data-file-refresh>↻</button><span style="color:var(--muted)">Home</span></div>
      <div class="file-grid">${files.map(file => `<button class="file-item" data-file-id="${file.id}"><span>${file.type === "folder" ? "📁" : file.type === "image" ? "🖼" : "📄"}</span><small>${escapeHtml(file.name)}</small></button>`).join("")}</div></main></div>`;
  }

  function clockMarkup() {
    return `<div class="clock-app"><aside class="clock-nav"><button class="active" data-clock-view="clock">🕘 Clock</button><button data-clock-view="focus">◉ Focus sessions</button><button data-clock-view="timer">⏱ Timer</button></aside>
      <main class="clock-face" data-clock-content><time class="live-clock">${new Date().toLocaleTimeString()}</time><p>${new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p></main></div>`;
  }

  function settingsMarkup() {
    const settings = store.get("settings", { theme: "dark", accent: "#0078d4", wallpaper: 0, alignment: "center" });
    return `<div class="settings-layout"><aside class="settings-nav"><h2>Settings</h2><button class="active">🎨 Personalization</button><button>◉ System</button><button>⌁ Network</button><button>👤 Accounts</button><button>♿ Accessibility</button></aside>
      <main class="settings-page"><h1>Personalization</h1>
      <div class="setting-row"><div><strong>Theme</strong><p>Choose light or dark app surfaces.</p></div><select data-setting="theme"><option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Dark</option><option value="light" ${settings.theme === "light" ? "selected" : ""}>Light</option></select></div>
      <div class="setting-row"><div><strong>Background</strong><p>Cycle through built-in KEMOS wallpapers.</p></div><button class="secondary" data-next-wallpaper>Next wallpaper</button></div>
      <div class="setting-row"><div><strong>Accent color</strong><p>Used for controls, highlights, and active apps.</p></div><div class="swatches">${accents.map(color => `<button class="swatch" data-accent="${color}" style="--swatch:${color}"></button>`).join("")}</div></div>
      <div class="setting-row"><div><strong>Taskbar alignment</strong><p>Center the icons or move them left.</p></div><select data-setting="alignment"><option value="center" ${settings.alignment === "center" ? "selected" : ""}>Center</option><option value="left" ${settings.alignment === "left" ? "selected" : ""}>Left</option></select></div>
      <div class="setting-row"><div><strong>Local storage</strong><p>Clear notes, files, settings, art, and scores from this browser.</p></div><button class="secondary" data-clear-data>Clear data</button></div>
      </main></div>`;
  }

  function wireApp(id, windowEl) {
    if (id === "gamehub") {
      $$("[data-game]", windowEl).forEach(card => card.addEventListener("click", () => openApp(card.dataset.game)));
    }
    if (id === "browser") wireBrowser(windowEl);
    if (id === "notes") wireNotes(windowEl);
    if (id === "calculator") wireCalculator(windowEl);
    if (id === "paint") wirePaint(windowEl);
    if (id === "files") wireFiles(windowEl);
    if (id === "media") wireMedia(windowEl);
    if (id === "clock") wireClock(windowEl);
    if (id === "settings") wireSettings(windowEl);
    if (id === "terminal") wireTerminal(windowEl);
    if (id === "store") $$("[data-install-kemos]", windowEl).forEach(button => button.addEventListener("click", installKemos));
    if (id === "snake") wireSnake(windowEl);
    if (id === "pong") wirePong(windowEl);
    if (id === "tictactoe") wireTicTacToe(windowEl);
  }

  function wireBrowser(windowEl) {
    const address = $(".browser-address", windowEl);
    const go = value => {
      const input = value.trim();
      if (!input) return;
      const target = /^https?:\/\//i.test(input) ? input : /^(?:[\w-]+\.)+[a-z]{2,}/i.test(input) ? `https://${input}` : `https://www.google.com/search?q=${encodeURIComponent(input)}`;
      window.open(target, "_blank", "noopener,noreferrer");
      toast("KEMOS Browser", "Opened securely in a new tab.", "🌐");
    };
    $("[data-browser-go]", windowEl).addEventListener("click", () => go(address.value));
    address.addEventListener("keydown", event => { if (event.key === "Enter") go(address.value); });
    $(".browser-search", windowEl).addEventListener("submit", event => {
      event.preventDefault();
      go($("input", event.currentTarget).value);
    });
    $$("[data-url]", windowEl).forEach(button => button.addEventListener("click", () => window.open(button.dataset.url, "_blank", "noopener,noreferrer")));
  }

  function getNotes() {
    return store.get("notes", []);
  }

  function createNewNote() {
    const notes = getNotes();
    const note = { id: crypto.randomUUID(), title: "Untitled", body: "", updated: Date.now() };
    notes.unshift(note);
    store.set("notes", notes);
    store.set("activeNote", note.id);
    const notesWindow = $(`.app-window[data-app-id="notes"]`);
    if (notesWindow) {
      $(".window-content", notesWindow).innerHTML = notesMarkup();
      wireNotes(notesWindow);
    }
  }

  function wireNotes(windowEl) {
    $("[data-note-new]", windowEl).addEventListener("click", createNewNote);
    $$("[data-note-id]", windowEl).forEach(button => button.addEventListener("click", () => {
      store.set("activeNote", button.dataset.noteId);
      $(".window-content", windowEl).innerHTML = notesMarkup();
      wireNotes(windowEl);
    }));
    const editor = $(".notes-editor", windowEl);
    const save = () => {
      const notes = getNotes();
      const note = notes.find(item => item.id === editor.dataset.activeNote);
      if (!note) return;
      note.title = $("input", editor).value || "Untitled";
      note.body = $("textarea", editor).value;
      note.updated = Date.now();
      store.set("notes", notes);
      const listItem = $(`[data-note-id="${note.id}"] strong`, windowEl);
      if (listItem) listItem.textContent = note.title;
    };
    $("input", editor).addEventListener("input", save);
    $("textarea", editor).addEventListener("input", save);
  }

  function wireCalculator(windowEl) {
    let expression = "";
    let result = "0";
    const display = $(".calc-value", windowEl);
    const history = $(".calc-history", windowEl);
    const render = () => { display.textContent = expression || result; history.textContent = expression ? result : ""; };
    $$("[data-key]", windowEl).forEach(button => button.addEventListener("click", () => {
      const key = button.dataset.key;
      if (key === "C") { expression = ""; result = "0"; }
      else if (key === "⌫") expression = expression.slice(0, -1);
      else if (key === "±") expression = expression ? `-(${expression})` : "";
      else if (key === "=") {
        try {
          const safe = expression.replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-");
          if (!/^[\d+\-*/().%\s]+$/.test(safe)) throw new Error();
          result = String(Function(`"use strict";return (${safe})`)());
          history.textContent = `${expression} =`;
          expression = result;
        } catch {
          result = "Error";
          expression = "";
        }
      } else expression += key;
      render();
    }));
  }

  function wirePaint(windowEl) {
    const canvas = $("canvas", windowEl);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    let drawing = false;
    let undo = [];
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height
      };
    };
    canvas.addEventListener("pointerdown", event => {
      undo.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      undo = undo.slice(-10);
      drawing = true;
      const p = point(event);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", event => {
      if (!drawing) return;
      const p = point(event);
      ctx.strokeStyle = $('input[type="color"]', windowEl).value;
      ctx.lineWidth = $('input[type="range"]', windowEl).value;
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    });
    canvas.addEventListener("pointerup", () => drawing = false);
    $$("[data-paint]", windowEl).forEach(button => button.addEventListener("click", () => {
      const action = button.dataset.paint;
      if (action === "clear") ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (action === "undo" && undo.length) ctx.putImageData(undo.pop(), 0, 0);
      if (action === "download") {
        const link = document.createElement("a");
        link.download = `kemos-paint-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
      if (action === "save") {
        const files = store.get("files", []);
        files.push({ id: crypto.randomUUID(), name: `Painting ${files.filter(file => file.type === "image").length + 1}.png`, type: "image", content: canvas.toDataURL() });
        store.set("files", files);
        notify("Paint", "Saved your drawing to KEMOS Files.", "🎨");
      }
    }));
  }

  function wireFiles(windowEl) {
    $("[data-file-new]", windowEl).addEventListener("click", () => {
      const name = prompt("File name", "New Text Document.txt");
      if (!name) return;
      const files = store.get("files", []);
      files.push({ id: crypto.randomUUID(), name, type: "text", content: "" });
      store.set("files", files);
      $(".window-content", windowEl).innerHTML = filesMarkup();
      wireFiles(windowEl);
    });
    $("[data-file-refresh]", windowEl).addEventListener("click", () => {
      $(".file-grid", windowEl).animate([{ opacity: .3 }, { opacity: 1 }], { duration: 250 });
    });
    $$("[data-file-id]", windowEl).forEach(button => button.addEventListener("dblclick", () => {
      const file = store.get("files", []).find(item => item.id === button.dataset.fileId);
      if (!file) return;
      if (file.type === "folder") toast("File Explorer", `${file.name} is empty.`, "📁");
      if (file.type === "text") {
        const content = prompt(file.name, file.content || "");
        if (content !== null) {
          file.content = content;
          const files = store.get("files", []).map(item => item.id === file.id ? file : item);
          store.set("files", files);
        }
      }
      if (file.type === "image") {
        const popup = window.open("", "_blank");
        if (popup) popup.document.write(`<title>${escapeHtml(file.name)}</title><img src="${file.content}" style="max-width:100%">`);
      }
    }));
  }

  function wireMedia(windowEl) {
    let audio = null;
    const button = $("[data-media-play]", windowEl);
    button.addEventListener("click", () => {
      if (!audio) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audio = new AudioContext();
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 174;
        gain.gain.value = .025;
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start();
        windowEl.audioNodes = { audio, oscillator, gain };
        button.textContent = "Ⅱ";
      } else if (audio.state === "running") {
        audio.suspend();
        button.textContent = "▶";
      } else {
        audio.resume();
        button.textContent = "Ⅱ";
      }
    });
    $("[data-media-volume]", windowEl).addEventListener("input", event => {
      if (windowEl.audioNodes) windowEl.audioNodes.gain.gain.value = Number(event.target.value) / 1200;
    });
  }

  function wireClock(windowEl) {
    $$("[data-clock-view]", windowEl).forEach(button => button.addEventListener("click", () => {
      $$("[data-clock-view]", windowEl).forEach(item => item.classList.toggle("active", item === button));
      const content = $("[data-clock-content]", windowEl);
      if (button.dataset.clockView === "clock") content.innerHTML = `<time class="live-clock">${new Date().toLocaleTimeString()}</time><p>${new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</p>`;
      if (button.dataset.clockView === "focus") {
        content.innerHTML = `<div class="focus-ring"><strong data-focus-time>${formatCountdown(runtime.focusSeconds || runtime.focusTotal)}</strong></div><h2>Focus session</h2><p>Work for 25 minutes, then take a break.</p><button class="primary" data-focus-start>${runtime.focusInterval ? "Pause" : "Start"}</button>`;
        $("[data-focus-start]", content).addEventListener("click", startFocus);
      }
      if (button.dataset.clockView === "timer") {
        content.innerHTML = `<div class="focus-ring"><strong>05:00</strong></div><h2>Quick timer</h2><button class="primary" data-quick-timer>Start 5 minutes</button>`;
        $("[data-quick-timer]", content).addEventListener("click", () => {
          runtime.focusSeconds = 5 * 60;
          runtime.focusTotal = 5 * 60;
          startFocus();
        });
      }
    }));
  }

  function formatCountdown(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function startFocus() {
    if (runtime.focusInterval) {
      clearInterval(runtime.focusInterval);
      runtime.focusInterval = null;
      toast("Focus", "Session paused.", "◉");
      return;
    }
    if (!runtime.focusSeconds) {
      runtime.focusSeconds = runtime.focusTotal;
      notify("Focus session", "Your focus session has started.", "◉");
    }
    runtime.focusInterval = setInterval(() => {
      runtime.focusSeconds--;
      const time = formatCountdown(runtime.focusSeconds);
      $$("[data-focus-time]").forEach(item => item.textContent = time);
      $$(".focus-ring").forEach(ring => ring.style.setProperty("--progress", `${100 - runtime.focusSeconds / runtime.focusTotal * 100}%`));
      $("#focus-widget-title").textContent = `${time} remaining`;
      $("#focus-widget-copy").textContent = "Keep going. KEMOS will notify you when the session ends.";
      if (runtime.focusSeconds <= 0) {
        clearInterval(runtime.focusInterval);
        runtime.focusInterval = null;
        notify("Focus complete", "Nice. Take a short break.", "✓");
      }
    }, 1000);
  }

  function wireSettings(windowEl) {
    $$("[data-setting]", windowEl).forEach(control => control.addEventListener("change", () => saveSetting(control.dataset.setting, control.value)));
    $$("[data-accent]", windowEl).forEach(button => button.addEventListener("click", () => saveSetting("accent", button.dataset.accent)));
    $("[data-next-wallpaper]", windowEl).addEventListener("click", nextWallpaper);
    $("[data-clear-data]", windowEl).addEventListener("click", () => {
      if (!confirm("Clear all KEMOS data stored in this browser?")) return;
      Object.keys(localStorage).filter(key => key.startsWith("kemos:")).forEach(key => localStorage.removeItem(key));
      location.reload();
    });
  }

  function nextWallpaper() {
    const settings = store.get("settings", {});
    saveSetting("wallpaper", ((settings.wallpaper || 0) + 1) % wallpapers.length);
    toast("Personalization", "Wallpaper changed.", "▧");
  }

  function wireTerminal(windowEl) {
    const input = $(".terminal-input-row input", windowEl);
    const output = $(".terminal-output", windowEl);
    const print = text => {
      output.textContent += `${text}\n`;
      output.scrollTop = output.scrollHeight;
    };
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      const raw = input.value.trim();
      print(`guest@kemos:~$ ${raw}`);
      input.value = "";
      const [command, ...args] = raw.split(/\s+/);
      const commands = {
        help: "Commands: help, apps, open <app>, date, clear, echo <text>, theme <dark|light>, wallpaper, whoami, about",
        apps: Object.keys(apps).join(", "),
        date: new Date().toString(),
        clear: "",
        echo: args.join(" "),
        whoami: $("#account-name").textContent,
        about: "KEMOS 1.0 — a local-first game desktop for the web."
      };
      if (command === "clear") output.textContent = "";
      else if (command === "open") {
        const id = Object.keys(apps).find(key => key === args[0]?.toLowerCase() || apps[key].name.toLowerCase() === args.join(" ").toLowerCase());
        if (id) { openApp(id); print(`Opening ${apps[id].name}...`); }
        else print("App not found.");
      } else if (command === "theme" && ["dark", "light"].includes(args[0])) {
        saveSetting("theme", args[0]);
        print(`Theme set to ${args[0]}.`);
      } else if (command === "wallpaper") {
        nextWallpaper();
        print("Wallpaper changed.");
      } else if (command in commands) print(commands[command]);
      else if (raw) print(`'${command}' is not a recognized command.`);
    });
  }

  async function installKemos() {
    if (!runtime.installPrompt) {
      toast("Install KEMOS", "Use your browser menu and choose “Install app” or “Add to Home Screen.”", "⬇");
      return;
    }
    runtime.installPrompt.prompt();
    await runtime.installPrompt.userChoice;
    runtime.installPrompt = null;
  }

  function wireSnake(windowEl) {
    const canvas = $("canvas", windowEl);
    const ctx = canvas.getContext("2d");
    const size = 24;
    let snake, direction, food, score;
    const reset = () => {
      snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
      direction = { x: 1, y: 0 };
      food = { x: 15, y: 10 };
      score = 0;
      $("[data-snake-score]", windowEl).textContent = score;
      clearInterval(windowEl.gameLoop);
      windowEl.gameLoop = setInterval(tick, 105);
    };
    const randomFood = () => {
      do food = { x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 20) };
      while (snake.some(part => part.x === food.x && part.y === food.y));
    };
    const draw = () => {
      ctx.fillStyle = "#0b1018";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f45d72";
      ctx.beginPath();
      ctx.arc(food.x * size + size / 2, food.y * size + size / 2, size * .35, 0, Math.PI * 2);
      ctx.fill();
      snake.forEach((part, index) => {
        ctx.fillStyle = index ? "#4fcf77" : "#81f09f";
        ctx.fillRect(part.x * size + 2, part.y * size + 2, size - 4, size - 4);
      });
    };
    const tick = () => {
      const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
      if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 20 || snake.some(part => part.x === head.x && part.y === head.y)) {
        clearInterval(windowEl.gameLoop);
        const high = Math.max(score, store.get("score:snake", 0));
        store.set("score:snake", high);
        notify("Snake", `Game over. Score: ${score}`, "🐍");
        return;
      }
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score++;
        $("[data-snake-score]", windowEl).textContent = score;
        randomFood();
      } else snake.pop();
      draw();
    };
    const keys = event => {
      const map = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
      const next = map[event.key];
      if (!next || (next[0] === -direction.x && next[1] === -direction.y)) return;
      direction = { x: next[0], y: next[1] };
      event.preventDefault();
    };
    windowEl.addEventListener("keydown", keys);
    windowEl.tabIndex = 0;
    windowEl.focus();
    $("[data-game-restart]", windowEl).addEventListener("click", reset);
    reset();
  }

  function wirePong(windowEl) {
    const canvas = $("canvas", windowEl);
    const ctx = canvas.getContext("2d");
    const state = { py: 170, cy: 170, bx: 360, by: 210, vx: 5, vy: 3, player: 0, cpu: 0, up: false, down: false };
    const resetBall = direction => Object.assign(state, { bx: 360, by: 210, vx: 5 * direction, vy: (Math.random() * 4 - 2) || 2 });
    const frame = () => {
      if (state.up) state.py -= 7;
      if (state.down) state.py += 7;
      state.py = Math.max(0, Math.min(340, state.py));
      state.cy += Math.sign(state.by - (state.cy + 40)) * 3.5;
      state.cy = Math.max(0, Math.min(340, state.cy));
      state.bx += state.vx;
      state.by += state.vy;
      if (state.by < 8 || state.by > 412) state.vy *= -1;
      if (state.bx < 35 && state.by > state.py && state.by < state.py + 80 && state.vx < 0) state.vx *= -1.06;
      if (state.bx > 685 && state.by > state.cy && state.by < state.cy + 80 && state.vx > 0) state.vx *= -1.06;
      if (state.bx < 0) { state.cpu++; resetBall(1); }
      if (state.bx > 720) { state.player++; resetBall(-1); }
      $("[data-pong-player]", windowEl).textContent = state.player;
      $("[data-pong-cpu]", windowEl).textContent = state.cpu;
      if (state.player >= 7 || state.cpu >= 7) {
        notify("Pong", state.player >= 7 ? "You won!" : "CPU won. Rematch?", "🏓");
        state.player = 0; state.cpu = 0;
      }
      ctx.fillStyle = "#0b1018"; ctx.fillRect(0, 0, 720, 420);
      ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(360, 0); ctx.lineTo(360, 420); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#fff"; ctx.fillRect(20, state.py, 12, 80); ctx.fillRect(688, state.cy, 12, 80);
      ctx.fillStyle = "#60cdff"; ctx.beginPath(); ctx.arc(state.bx, state.by, 8, 0, Math.PI * 2); ctx.fill();
      windowEl.gameFrame = requestAnimationFrame(frame);
    };
    const key = value => event => {
      if (["w", "W", "ArrowUp"].includes(event.key)) state.up = value;
      if (["s", "S", "ArrowDown"].includes(event.key)) state.down = value;
    };
    windowEl.addEventListener("keydown", key(true));
    windowEl.addEventListener("keyup", key(false));
    canvas.addEventListener("pointermove", event => {
      const rect = canvas.getBoundingClientRect();
      state.py = (event.clientY - rect.top) * 420 / rect.height - 40;
    });
    windowEl.tabIndex = 0;
    windowEl.focus();
    $("[data-game-restart]", windowEl).addEventListener("click", () => { state.player = 0; state.cpu = 0; resetBall(1); });
    frame();
  }

  function wireTicTacToe(windowEl) {
    let board = Array(9).fill("");
    let player = "X";
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const reset = () => {
      board = Array(9).fill("");
      player = "X";
      $$("[data-cell]", windowEl).forEach(cell => cell.textContent = "");
      $("[data-tic-status]", windowEl).textContent = "Player X's turn";
    };
    $$("[data-cell]", windowEl).forEach(cell => cell.addEventListener("click", () => {
      const index = Number(cell.dataset.cell);
      if (board[index] || wins.some(win => win.every(i => board[i] && board[i] === board[win[0]]))) return;
      board[index] = player;
      cell.textContent = player;
      const win = wins.find(combo => combo.every(i => board[i] === player));
      if (win) {
        $("[data-tic-status]", windowEl).textContent = `Player ${player} wins!`;
        win.forEach(i => $(`[data-cell="${i}"]`, windowEl).style.background = "var(--accent-strong)");
      } else if (board.every(Boolean)) $("[data-tic-status]", windowEl).textContent = "Draw game";
      else {
        player = player === "X" ? "O" : "X";
        $("[data-tic-status]", windowEl).textContent = `Player ${player}'s turn`;
      }
    }));
    $("[data-game-restart]", windowEl).addEventListener("click", () => {
      $$("[data-cell]", windowEl).forEach(cell => cell.style.background = "");
      reset();
    });
  }

  $$(".auth-button").forEach(button => button.addEventListener("click", () => beginOAuth(button.dataset.provider)));
  $("#guest-login").addEventListener("click", () => startDesktop("Guest"));
  taskbarPinned.forEach(id => {
    document.addEventListener("click", event => {
      const button = event.target.closest(`.app-taskbar-icon[data-app="${id}"]`);
      if (button) taskbarClick(id);
    });
  });
  window.addEventListener("beforeunload", () => {
    $$(".app-window").forEach(windowEl => {
      if (windowEl.audioNodes) windowEl.audioNodes.audio.close();
    });
  });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));

  configureAppearance();
  setTimeout(() => {
    if (processAuthCallback()) return;
    const session = store.get("session", null);
    if (session?.user) startDesktop(session.user.user_metadata?.full_name || session.user.email || "Player");
    else showLogin();
  }, 900);
})();
