/* Marv's Workshop paint mixing.
   Paint mixes by absorbing light, so colours are combined with the
   Kubelka-Munk rule the feasibility report names as the industry method:
   each colourant is turned into an absorption figure per channel, those are
   averaged by amount and weight, and the result is turned back into a colour.

   This is an APPROXIMATION. It runs on three colour channels, not a full
   spectrum, and the colours and weights below are estimates: no measured
   data exists for these colourants. It is good enough to learn which way a
   tint pushes a mix. It is not a recipe calculator. */
(function (global) {
  "use strict";
  var C = global.MarvColour || (typeof require !== "undefined" ? require("./colour.js") : null);

  /* The eleven Chroma-Chem 844 tints on the van. rgb = estimated full-strength colour.
     weight = how much a drop counts against a drop of white. White scatters a lot of
     light and the coloured pigments very little, so a little pigment tints a lot of
     white, and the strong ones (the Phthalos, black) tint the most. */
  var TINTS = [
    { id: "TWX", name: "Titanium White",      rgb: [248, 248, 244], weight: 1.0 },
    { id: "LBX", name: "Lamp Black",          rgb: [22, 22, 24],    weight: 0.06,  strong: true },
    { id: "PBX", name: "Phthalo Blue",        rgb: [14, 40, 118],   weight: 0.10,  strong: true },
    { id: "PGX", name: "Phthalo Green",       rgb: [0, 86, 62],     weight: 0.10,  strong: true },
    { id: "OYX", name: "Organic Yellow",      rgb: [247, 198, 8],   weight: 0.035 },
    { id: "MYX", name: "LF Medium Yellow",    rgb: [240, 164, 18],  weight: 0.04 },
    { id: "YOX", name: "Yellow Oxide",        rgb: [192, 138, 44],  weight: 0.10 },
    { id: "QRX", name: "Quinacridone Red",    rgb: [176, 24, 62],   weight: 0.07 },
    { id: "ROX", name: "Red Oxide",           rgb: [124, 48, 32],   weight: 0.14 },
    { id: "BUX", name: "Burnt Umber",         rgb: [74, 48, 32],    weight: 0.08 },
    { id: "QVX", name: "Quinacridone Violet", rgb: [92, 26, 100],   weight: 0.08 }
  ];
  // Primary colours for the Trainee level.
  var PRIMARIES = [
    { id: "WHITE",   name: "White",   rgb: [248, 248, 244], weight: 1.0 },
    { id: "BLACK",   name: "Black",   rgb: [22, 22, 24],    weight: 0.06, strong: true },
    { id: "CYAN",    name: "Cyan",    rgb: [0, 150, 212],   weight: 0.08 },
    { id: "MAGENTA", name: "Magenta", rgb: [208, 12, 122],  weight: 0.08 },
    { id: "YELLOW",  name: "Yellow",  rgb: [250, 216, 10],  weight: 0.05 }
  ];
  var BY_ID = {};
  TINTS.concat(PRIMARIES).forEach(function (t) { BY_ID[t.id] = t; });

  /* The four levels, as in Colour Lab. maxDiff is the largest colour difference
     (ΔE2000) that still counts as a match; scores are for a match on the first,
     second and third attempt. */
  var LEVELS = [
    { id: "trainee",    name: "Trainee",           palette: "primaries", maxDiff: 6.0, scores: [150, 100, 50],    hints: Infinity, hintCost: 10, parts: [2, 2] },
    { id: "technician", name: "Technician",        palette: "tints",     maxDiff: 4.8, scores: [300, 200, 100],   hints: 3,        hintCost: 25, parts: [2, 2] },
    { id: "senior",     name: "Senior Technician", palette: "tints",     maxDiff: 3.2, scores: [500, 350, 200],   hints: 2,        hintCost: 50, parts: [2, 3] },
    { id: "master",     name: "Master Technician", palette: "tints",     maxDiff: 1.6, scores: [1000, 700, 400],  hints: 0,        hintCost: 0,  parts: [3, 4] }
  ];
  function level(id) { return LEVELS.filter(function (l) { return l.id === id; })[0]; }
  function palette(levelId) { return level(levelId).palette === "primaries" ? PRIMARIES : TINTS; }

  function ks(r) { r = Math.max(0.004, Math.min(0.996, r)); return (1 - r) * (1 - r) / (2 * r); }
  function fromKs(k) { return 1 + k - Math.sqrt(k * k + 2 * k); }

  // mix: { tintId: drops }. Returns sRGB [r,g,b], or null for an empty mix.
  function mixColour(mix) {
    var total = 0, sum = [0, 0, 0];
    Object.keys(mix).forEach(function (id) {
      var t = BY_ID[id], drops = mix[id];
      if (!t || !(drops > 0)) return;
      var w = drops * t.weight;
      total += w;
      for (var ch = 0; ch < 3; ch++) sum[ch] += w * ks(C.srgbToLinear(t.rgb[ch]));
    });
    if (!total) return null;
    return sum.map(function (s) { return C.linearToSrgb(fromKs(s / total)); });
  }
  function drops(mix) { return Object.keys(mix).reduce(function (n, id) { return n + (mix[id] > 0 ? mix[id] : 0); }, 0); }

  // How far a mix is from the target, and whether that is a match at this level.
  function judge(mix, target, levelId) {
    var c = mixColour(mix);
    if (!c) return { diff: Infinity, match: false, percent: 0 };
    var diff = C.deltaRgb(c, target);
    return { diff: diff, match: diff <= level(levelId).maxDiff, percent: Math.max(0, Math.round(100 - diff * 2.5)), colour: c };
  }

  /* Make a job: a hidden recipe from the level's palette, and the colour it gives.
     Because the target is itself a mix, it can always be reached.
     accept(rgb) lets a scene ask for a suitable colour (pale for a bath, and so on). */
  function makeJob(levelId, accept, rand) {
    rand = rand || Math.random;
    var lv = level(levelId), pal = palette(levelId);
    var white = pal.filter(function (t) { return /white/i.test(t.name); })[0];
    var others = pal.filter(function (t) { return t !== white; });
    var best = null;
    for (var tries = 0; tries < 60; tries++) {
      var n = lv.parts[0] + Math.floor(rand() * (lv.parts[1] - lv.parts[0] + 1));
      var pool = others.slice(), recipe = {};
      for (var i = 0; i < n && pool.length; i++) {
        var t = pool.splice(Math.floor(rand() * pool.length), 1)[0];
        // Strong tints are used sparingly, as on a real job.
        recipe[t.id] = t.strong ? 1 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 5);
      }
      recipe[white.id] = Math.floor(rand() * 13);
      if (!recipe[white.id]) delete recipe[white.id];
      var rgb = mixColour(recipe);
      best = { recipe: recipe, target: rgb };
      if (!accept || accept(rgb)) break;
    }
    return best;
  }

  /* A hint: which way the mix has to move, read from the colour difference.
     It names the direction, not the answer. */
  function hint(mix, target) {
    var c = mixColour(mix);
    if (!c) return "Nothing is mixed yet. Start with the colour closest to the target, then adjust.";
    var a = C.rgbToLab(c), b = C.rgbToLab(target);
    var dL = b[0] - a[0], da = b[1] - a[1], db = b[2] - a[2];
    var moves = [
      { size: Math.abs(dL) * 1.0, text: dL > 0 ? "lighter" : "darker" },
      { size: Math.abs(da) * 1.3, text: da > 0 ? "redder" : "greener" },
      { size: Math.abs(db) * 1.3, text: db > 0 ? "yellower" : "bluer" }
    ].sort(function (x, y) { return y.size - x.size; });
    if (moves[0].size < 1.5) return "You are very close. Make the smallest change you can.";
    var second = moves[1].size > moves[0].size * 0.6 && moves[1].size > 3 ? " and a little " + moves[1].text : "";
    return "It needs to be " + moves[0].text + second + ".";
  }
  function recipeText(recipe) {
    return Object.keys(recipe).filter(function (id) { return recipe[id] > 0; })
      .sort(function (x, y) { return recipe[y] - recipe[x]; })
      .map(function (id) { return recipe[id] + " " + BY_ID[id].name; }).join(", ");
  }

  var api = { TINTS: TINTS, PRIMARIES: PRIMARIES, LEVELS: LEVELS, level: level, palette: palette, tint: function (id) { return BY_ID[id]; }, mixColour: mixColour, drops: drops, judge: judge, makeJob: makeJob, hint: hint, recipeText: recipeText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.MarvMix = api;
})(typeof window !== "undefined" ? window : globalThis);

/* Suggest a mix for a colour: which colourants, and how many parts of each.
   Builds the mix a part at a time, always adding the part that brings it closest,
   then tidies it by trying to take a part out or move a part from one colourant
   to another. Uses the same estimated colourant data as the game, so it is a
   starting point to test by eye, not a formulation. */
(function (global) {
  "use strict";
  var M = global.MarvMix, C = global.MarvColour || (typeof require !== "undefined" ? require("./colour.js") : null);
  function diff(mix, target) { var c = M.mixColour(mix); return c ? C.deltaRgb(c, target) : Infinity; }
  function clone(m) { var o = {}; for (var k in m) if (m[k] > 0) o[k] = m[k]; return o; }
  function count(m) { return Object.keys(m).filter(function (k) { return m[k] > 0; }).length; }
  function suggest(target, paletteName, opts) {
    opts = opts || {};
    var pal = (paletteName === "primaries" ? M.PRIMARIES : M.TINTS).map(function (t) { return t.id; });
    var white = pal[0], maxColours = opts.maxColours || 5;
    function d(w) { var c = M.mixColour(w); return c ? C.deltaRgb(c, target) : Infinity; }
    // Pattern search on amounts: nudge each colourant up or down, keep what helps, shrink the nudge.
    function polish(w) {
      var best = d(w), step = 0.6;
      for (var it = 0; it < 160 && step > 0.02; it++) {
        var moved = false;
        for (var k in w) {
          [1 + step, 1 / (1 + step)].forEach(function (f) {
            var t = clone(w); t[k] = w[k] * f; var e = d(t);
            if (e < best - 1e-7) { w = t; best = e; moved = true; }
          });
        }
        if (!moved) step *= 0.5;
      }
      return { w: w, e: best };
    }
    // Start from white with each colourant, and from pairs of colourants with white.
    var starts = [], others = pal.slice(1);
    others.forEach(function (a) { var s0 = {}; s0[white] = 6; s0[a] = 1; starts.push(s0); var s1 = {}; s1[a] = 1; starts.push(s1); });
    others.forEach(function (a, i) { others.slice(i + 1).forEach(function (b) { var s2 = {}; s2[white] = 6; s2[a] = 1; s2[b] = 1; starts.push(s2); }); });
    var best = null;
    starts.forEach(function (s0) { var r = polish(s0); if (!best || r.e < best.e) best = r; });
    // Widen: let every colourant in at a trace and polish again, then drop the ones that add little.
    var wide = clone(best.w); pal.forEach(function (id) { if (!wide[id]) wide[id] = 0.02; });
    var r2 = polish(wide); if (r2.e < best.e) best = r2;
    for (;;) {
      var ids = Object.keys(best.w); if (ids.length <= 1) break;
      var cand = null;
      ids.forEach(function (id) { var t = clone(best.w); delete t[id]; var r = polish(t); if (!cand || r.e < cand.e) cand = r; });
      if (ids.length > maxColours || cand.e < best.e + 0.35) best = cand; else break;
    }
    // Whole parts. A colourant needing less than one part in 300 is left out as a trace.
    var total = Object.keys(best.w).reduce(function (n, k) { return n + best.w[k]; }, 0);
    for (var tk in best.w) if (best.w[tk] / total < 1 / 300 && Object.keys(best.w).length > 1) delete best.w[tk];
    var minW = Math.min.apply(null, Object.keys(best.w).map(function (k) { return best.w[k]; }));
    var pick = null;
    [1, 2, 3, 4, 5, 6, 8].forEach(function (scale) {
      var parts = {}; for (var k in best.w) parts[k] = Math.max(1, Math.round(best.w[k] / minW * scale));
      var e = d(parts);
      if (!pick || e < pick.e - 0.3) pick = { parts: parts, e: e };
    });
    var colour = M.mixColour(pick.parts);
    return { recipe: pick.parts, colour: colour, diff: pick.e, percent: Math.max(0, Math.round(100 - pick.e * 2.5)) };
  }

  // A plain description of a colour, such as "light warm grey" or "dark muted blue".
  function describe(rgb) {
    var lab = C.rgbToLab(rgb), L = lab[0], a = lab[1], b = lab[2], ch = Math.hypot(a, b);
    var h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360;
    var light = L > 88 ? "very light" : L > 70 ? "light" : L > 45 ? "mid" : L > 25 ? "dark" : "very dark";
    if (ch < 6) return (L > 93 ? "off-white" : L < 12 ? "near black" : light + " grey");
    if (ch < 14) return light + " " + (a < -3 && Math.abs(b) < -a ? "green-grey" : b < -3 ? "blue-grey" : b > 3 || a > 3 ? "warm grey" : "grey");
    var hue = h < 20 ? "pink" : h < 45 ? "red" : h < 70 ? "orange" : h < 100 ? "yellow" : h < 150 ? "green" : h < 200 ? "teal" : h < 260 ? "blue" : h < 315 ? "purple" : "pink";
    if ((hue === "orange" || hue === "red") && L < 50) hue = "brown";
    if (hue === "yellow" && L < 60) hue = "olive";
    if ((hue === "orange" || hue === "yellow") && L > 65 && ch < 32) return light + " beige";
    return light + " " + (ch < 30 ? "muted " : "") + hue;
  }
  M.suggest = suggest;
  M.describe = describe;
})(typeof window !== "undefined" ? window : globalThis);
