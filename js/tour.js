/* The first-run tour of the home screen. It runs once, after the loading screen,
   and is remembered once finished or skipped. Settings can start it again
   (index.html#tour). One step at a time: the part of the screen being explained is
   lit and the rest dimmed, with Back, Next and Skip tour on every step. */
(function () {
  "use strict";
  var KEY = "marvs-workshop-tour-done";
  var STEPS = [
    { title: "Welcome to Marv's Workshop", text: "A quick tour of where everything is. It takes about half a minute, and you can skip it at any time.", target: null },
    { title: "Marv's Photo Match", text: "On the job. Photograph the damage with the reference card beside it to read its true colour, mix to it, or find which van tints to use.", target: 'a.door[href="photo.html"]' },
    { title: "Marv's Colour Lab", text: "Sharpen your eye. Mix repairs on 3D scenes until they disappear, at four levels, with a leaderboard.", target: 'a.door[href="play.html"]' },
    { title: "Marv's Mix Bench", text: "At the van. Scale a recipe to the amount you need, measure tints too light to weigh, and fix a mix that is off.", target: 'a.door[href="bench.html"]' },
    { title: "Settings", text: "Light or dark mode, bigger text, and video guides for every part of the app. You can take this tour again from there.", target: "a.cog" },
    { title: "Updates", text: "When a new version is ready, a bar appears at the bottom of the screen. Tap it to update. That's the tour.", target: "#app-version" }
  ];
  function done() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
  function remember() { try { localStorage.setItem(KEY, "1"); } catch (e) { /* will show again next time */ } }
  function offset(el) {                       // position in page units, unaffected by the text-size setting
    var x = 0, y = 0, w = el.offsetWidth, h = el.offsetHeight;
    for (var n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x: x, y: y, w: w, h: h };
  }
  var layer, spot, card, step = 0, lastFocus = null;
  function build() {
    layer = document.createElement("div"); layer.className = "tour";
    spot = document.createElement("div"); spot.className = "tour-spot";
    card = document.createElement("div"); card.className = "tour-card";
    card.setAttribute("role", "dialog"); card.setAttribute("aria-modal", "true"); card.setAttribute("aria-labelledby", "tour-title"); card.setAttribute("aria-describedby", "tour-text");
    card.innerHTML =
      '<p class="tour-count" id="tour-count"></p>' +
      '<h2 id="tour-title" tabindex="-1"></h2>' +
      '<p id="tour-text"></p>' +
      '<div class="tour-buttons"><button type="button" class="btn-quiet" id="tour-back">Back</button><button type="button" class="btn-main" id="tour-next">Next</button></div>' +
      '<button type="button" class="tour-skip" id="tour-skip">Skip tour</button>';
    layer.appendChild(spot); layer.appendChild(card); document.body.appendChild(layer);
    card.querySelector("#tour-back").addEventListener("click", function () { show(step - 1); });
    card.querySelector("#tour-next").addEventListener("click", function () { if (step >= STEPS.length - 1) end(); else show(step + 1); });
    card.querySelector("#tour-skip").addEventListener("click", end);
    document.addEventListener("keydown", keys);
    window.addEventListener("resize", place);
  }
  function keys(e) {
    if (!layer) return;
    if (e.key === "Escape") { e.preventDefault(); end(); }
    if (e.key === "Tab") {                     // keep the keyboard inside the tour card
      var f = Array.prototype.filter.call(card.querySelectorAll("button"), function (b) { return !b.hidden && !b.disabled; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  function place() {
    if (!layer) return;
    var s = STEPS[step], el = s.target && document.querySelector(s.target);
    layer.style.height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) + "px";
    if (!el) {
      spot.hidden = true; layer.classList.add("dim");
      card.style.top = (window.scrollY / (parseFloat(document.documentElement.style.zoom) || 1) + 120) + "px";
      return;
    }
    layer.classList.remove("dim"); spot.hidden = false;
    var r = offset(el), pad = 8;
    spot.style.left = (r.x - pad) + "px"; spot.style.top = (r.y - pad) + "px";
    spot.style.width = (r.w + pad * 2) + "px"; spot.style.height = (r.h + pad * 2) + "px";
    var below = r.y + r.h + pad + 14;
    var vh = window.innerHeight / (parseFloat(document.documentElement.style.zoom) || 1), sy = window.scrollY / (parseFloat(document.documentElement.style.zoom) || 1);
    var cardH = card.offsetHeight || 220;
    card.style.top = (below + cardH > sy + vh - 10 && r.y - cardH - pad - 14 > sy ? r.y - cardH - pad - 14 : below) + "px";
  }
  function show(i) {
    step = Math.max(0, Math.min(STEPS.length - 1, i));
    var s = STEPS[step];
    card.querySelector("#tour-count").textContent = "Step " + (step + 1) + " of " + STEPS.length;
    card.querySelector("#tour-title").textContent = s.title;
    card.querySelector("#tour-text").textContent = s.text;
    card.querySelector("#tour-back").hidden = step === 0;
    card.querySelector("#tour-next").textContent = step === 0 ? "Start the tour" : step === STEPS.length - 1 ? "Finish" : "Next";
    var el = s.target && document.querySelector(s.target);
    if (el) el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setTimeout(function () { place(); card.querySelector("#tour-title").focus({ preventScroll: true }); }, el ? 380 : 30);
    place();
  }
  function start() {
    if (layer) return;
    lastFocus = document.activeElement;
    build(); show(0);
  }
  function end() {
    remember();
    document.removeEventListener("keydown", keys); window.removeEventListener("resize", place);
    if (layer) layer.remove(); layer = null;
    if (location.hash === "#tour") { try { history.replaceState(null, "", location.pathname); } catch (e) { /* fine */ } }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  // Start once the loading screen has gone, or straight away if it is not showing.
  function begin() {
    var forced = location.hash === "#tour";
    if (done() && !forced) return;
    var sp = document.getElementById("splash");
    var showing = sp && sp.className.indexOf("skip") === -1;
    if (!showing) { start(); return; }
    var go = function () { sp.removeEventListener("animationend", onEnd); start(); };
    var onEnd = function (e) { if (e.target === sp) go(); };
    sp.addEventListener("animationend", onEnd);
    sp.addEventListener("click", function () { setTimeout(go, 380); }, { once: true });
  }
  window.MarvTour = { start: start };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", begin); else begin();
  window.addEventListener("hashchange", function () { if (location.hash === "#tour") start(); });
})();
