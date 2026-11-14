// Litt JavaScript for statussiden. Siden virker fullt ut uten.
// 1. Knapp for lyst/mørkt tema (valget lagres lokalt i nettleseren, ingen cookie).
// 2. Sier fra når en nyere status er publisert (leser /versjon.json hvert minutt mens fanen er synlig).
(function () {
  "use strict";
  var root = document.documentElement;

  function currentTheme() {
    var t = root.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function initThemeToggle() {
    var btn = document.querySelector("[data-theme-toggle]");
    if (!btn) return;
    function label() {
      var dark = currentTheme() === "dark";
      btn.textContent = dark ? "Lyst tema" : "Mørkt tema";
    }
    btn.hidden = false;
    label();
    btn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("nitd_theme", next); } catch (e) {}
      label();
    });
  }

  function initVersionCheck() {
    var notice = document.querySelector("[data-version-notice]");
    var version = root.getAttribute("data-version");
    if (!notice || !version || !window.fetch) return;
    var shown = false;

    function show() {
      if (shown) return;
      shown = true;
      var p = document.createElement("p");
      p.textContent = "Statusen er oppdatert siden du åpnet siden.";
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = "Last inn på nytt";
      b.addEventListener("click", function () { window.location.reload(); });
      notice.appendChild(p);
      notice.appendChild(b);
    }

    function check() {
      if (shown || document.visibilityState !== "visible") return;
      fetch("/versjon.json", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.version && d.version !== version) show(); })
        .catch(function () {});
    }

    setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
  }

  // Viser hvor lenge siden statusen ble kontrollert, og varsler hvis den er eldre enn 4 timer.
  function initAge() {
    var el = document.querySelector("[data-checked]");
    if (!el) return;
    var checked = Date.parse(el.getAttribute("data-checked"));
    var out = el.querySelector("[data-age]");
    var stale = document.querySelector("[data-stale]");
    if (isNaN(checked) || !out) return;
    function update() {
      var min = Math.max(0, Math.round((Date.now() - checked) / 60000));
      var text;
      if (min < 1) text = "nå nettopp";
      else if (min < 60) text = "for " + min + (min === 1 ? " minutt" : " minutter") + " siden";
      else {
        var h = Math.floor(min / 60);
        text = "for " + h + (h === 1 ? " time" : " timer") + " siden";
      }
      out.textContent = " (" + text + ")";
      if (stale) {
        var old = min >= 240;
        stale.hidden = !old;
        if (old) stale.textContent = "Statusen er ikke kontrollert de siste fire timene. Kontakt oss på 69 81 10 00 ved driftsproblemer.";
      }
    }
    update();
    setInterval(update, 60000);
  }

  function init() { initThemeToggle(); initVersionCheck(); initAge(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
