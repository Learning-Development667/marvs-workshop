/* Shared by every Workshop page: the version number, and keeping the page itself
   from zooming. Only the 3D scenes zoom, inside their own picture. */
(function () {
  "use strict";
  var VERSION = "0.8", BUILT = "26 Nov 2026";
  window.MarvApp = { version: VERSION, built: BUILT };
  // iPhone: a pinch anywhere on the page would zoom the whole app. Stop that.
  ["gesturestart", "gesturechange", "gestureend"].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); }, { passive: false });
  });
  function showVersion() {
    var el = document.getElementById("app-version");
    if (el) el.textContent = "Version " + VERSION + " · " + BUILT;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", showVersion);
  else showVersion();
})();
