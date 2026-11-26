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
