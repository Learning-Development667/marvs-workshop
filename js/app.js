/* Shared by every Workshop page: the version number, light or dark mode, the
   update check, and keeping the page itself from zooming. Only the 3D scenes zoom,
   inside their own picture. */
(function () {
  "use strict";
  var VERSION = "0.12", BUILT = "26 Nov 2026";
  /* Light, dark, or follow the phone. Set before the page draws so it never flashes. */
  var THEME_KEY = "marvs-workshop-theme";
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || "system"; } catch (e) { return "system"; } }
  function applyTheme(t) {
    var r = document.documentElement;
    if (t === "light" || t === "dark") r.setAttribute("data-theme", t); else r.removeAttribute("data-theme");
  }
  function setTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* not stored, still applied */ } applyTheme(t); }
  applyTheme(getTheme());
  /* Text size, for anyone who needs it larger (WCAG 1.4.4). Scales the whole page so
     the layout reflows with it, up to double size. */
  var SIZE_KEY = "marvs-workshop-text-size", SIZES = { standard: 1, larger: 1.25, largest: 1.5, double: 2 };
  function getSize() { try { var s = localStorage.getItem(SIZE_KEY); return SIZES[s] ? s : "standard"; } catch (e) { return "standard"; } }
  function applySize(s) { document.documentElement.style.zoom = SIZES[s] === 1 ? "" : String(SIZES[s]); }
  function setSize(s) { try { localStorage.setItem(SIZE_KEY, s); } catch (e) { /* not stored, still applied */ } applySize(s); }
  applySize(getSize());
  window.MarvApp = { version: VERSION, built: BUILT, getTheme: getTheme, setTheme: setTheme, getSize: getSize, setSize: setSize };
  // iPhone: an accidental pinch would zoom the whole app. Stop that; Settings has a
  // Text size control for anyone who needs everything larger.
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
  });
  function showVersion() {
    var el = document.getElementById("app-version");
    if (el) el.textContent = "Version " + VERSION + " · " + BUILT;
  }
  /* A phone keeps its saved copy of the app for a while. Ask the site which version
     is current, bypassing that copy, and offer a one-tap update if it is newer. */
  function newer(a, b) {
    var x = String(a).split("."), y = String(b).split(".");
    for (var i = 0; i < Math.max(x.length, y.length); i++) { var d = (+x[i] || 0) - (+y[i] || 0); if (d) return d > 0; }
    return false;
  }
  function checkForUpdate() {
    if (!window.fetch || location.protocol === "file:") return;
    fetch("version.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) {
        window.MarvApp.latest = v;
        document.dispatchEvent(new CustomEvent("marv-version", { detail: v }));
        if (!v || !newer(v.version, VERSION) || document.getElementById("app-update")) return;
        var bar = document.createElement("button");
        bar.type = "button"; bar.id = "app-update";
        bar.textContent = "A new version is ready (" + v.version + "). Tap to update.";
        bar.setAttribute("style", "position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));z-index:50;min-height:54px;border:2px solid #93c847;border-radius:16px;background:linear-gradient(180deg,#1f3d6b,#13294b 55%,#081220);color:#f1f8e6;font:bold 15px Verdana,'Workshop Sans',sans-serif;box-shadow:0 10px 26px rgba(0,0,0,0.35);");
        bar.addEventListener("click", function () { location.replace(location.pathname + "?v=" + encodeURIComponent(v.version) + location.hash); });
        document.body.appendChild(bar);
      })
      .catch(function () { /* offline: carry on with this copy */ });
  }
  window.MarvApp.checkForUpdate = checkForUpdate;
  function ready() { showVersion(); checkForUpdate(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();
  document.addEventListener("visibilitychange", function () { if (!document.hidden) checkForUpdate(); });
})();
