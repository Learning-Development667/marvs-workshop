/* The reference card: a printed strip of known colours that goes in the photo.
   The app compares how the camera recorded each patch with what the patch
   really is, and uses the difference to correct the surface colour. Until a
   printed card exists, the app lets the technician slide a virtual one in.

   Two rows, as on the card in the feasibility report:
   - a grey row, white down to mid grey (phones lose the dark end), which corrects
     brightness and white balance;
   - a colour row, which corrects the colour shifts greys cannot show, and gives
     each photo an accuracy check.

   PROVISIONAL. The values below are what the patches are designed to be. Unless
   the card is printed by a colour-managed professional printer and every patch is
   measured afterwards, the print will not match these values, and that printer
   error carries into every corrected reading. Measured values go here. */
(function (global) {
  "use strict";
  var C = global.MarvColour;

  var CARD = {
    id: "MM-REF-1",
    status: "Provisional design, not yet printed professionally or measured.",
    // Lightest first. truth = sRGB the patch is designed to be.
    patches: [
      { name: "N1", truth: [244, 244, 244] },
      { name: "N2", truth: [226, 226, 226] },
      { name: "N3", truth: [207, 207, 207] },
      { name: "N4", truth: [188, 188, 188] },
      { name: "N5", truth: [169, 169, 169] },
      { name: "N6", truth: [150, 150, 150] },
      { name: "N7", truth: [131, 131, 131] },
      { name: "N8", truth: [113, 113, 113] }
    ],
    // The colour row, one under each grey: spread round the colour wheel at the
    // middling strength repair colours tend to have.
    colours: [
      { name: "Red",    truth: [176, 64, 66] },
      { name: "Orange", truth: [214, 130, 52] },
      { name: "Yellow", truth: [222, 196, 60] },
      { name: "Green",  truth: [86, 150, 82] },
      { name: "Teal",   truth: [40, 136, 150] },
      { name: "Blue",   truth: [64, 84, 160] },
      { name: "Purple", truth: [134, 86, 156] },
      { name: "Beige",  truth: [196, 160, 128] }
    ],
    mark: [19, 41, 75]           // the end marks, Crow Black Blue
  };
  var ROW = 1.15, GAP = 0.12;    // patch height and the gap between rows, as parts of the patch spacing

  function geometry(a, b) {
    var len = Math.hypot(b.x - a.x, b.y - a.y), pitch = len / (CARD.patches.length + 1);
    return { len: len, pitch: pitch, nx: -(b.y - a.y) / len, ny: (b.x - a.x) / len };
  }
  // Centres of the grey patches along the line from end mark A to end mark B.
  function patchCentres(a, b) {
    var n = CARD.patches.length;
    return CARD.patches.map(function (p, i) {
      var t = (i + 1) / (n + 1);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    });
  }
  // Centres of the colour patches, one row over, on side +1 or -1 of the grey row.
  function colourCentres(a, b, side) {
    var g = geometry(a, b), off = g.pitch * (ROW + GAP) * side;
    return patchCentres(a, b).map(function (c) { return { x: c.x + g.nx * off, y: c.y + g.ny * off }; });
  }
  // Is a point on the card? Signed distance across the card, allowing for the colour row's side.
  function covers(a, b, p, side) {
    if (!(a && b)) return false;
    var g = geometry(a, b), t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (g.len * g.len);
    if (t < -0.12 || t > 1.12) return false;
    var d = ((p.x - a.x) * g.nx + (p.y - a.y) * g.ny) / g.pitch, pad = 0.55;
    if (!side) return Math.abs(d) < ROW + GAP + ROW / 2 + pad;
    d *= side;
    return d > -ROW / 2 - pad && d < ROW + GAP + ROW / 2 + pad;
  }
  // Side of the square sampled inside each patch, in image pixels.
  function sampleSize(a, b) {
    return Math.max(4, Math.round(geometry(a, b).pitch * 0.42));
  }
  function readSquare(ctx, cx, cy, size) {
    var half = Math.floor(size / 2);
    var x0 = Math.max(0, Math.round(cx) - half), y0 = Math.max(0, Math.round(cy) - half);
    var w = Math.min(ctx.canvas.width - x0, size), h = Math.min(ctx.canvas.height - y0, size);
    if (w <= 0 || h <= 0) return [0, 0, 0];
    var d = ctx.getImageData(x0, y0, w, h).data, px = [];
    var step = Math.max(1, Math.floor(Math.sqrt(w * h / 900)));     // cap the work on big patches
    for (var y = 0; y < h; y += step) for (var x = 0; x < w; x += step) { var i = (y * w + x) * 4; px.push([d[i], d[i + 1], d[i + 2]]); }
    return C.trimmedMean(px);
  }
  function chroma(rgb) { var l = C.rgbToLab(rgb); return Math.hypot(l[1], l[2]); }
  /* Read the card out of a photo and fit the camera correction. The colour row is
     on whichever side of the greys shows more colour, so it does not matter which
     end of the card was tapped first. */
  function lum(rgb) { return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]; }
  function readCard(ctx, a, b) {
    var size = sampleSize(a, b);
    var seen = patchCentres(a, b).map(function (c) { return readSquare(ctx, c.x, c.y, size); });
    // The greys run light to dark from end A. If they read the other way, the ends were tapped
    // in reverse: swap them, and report the colour row's side for the ends as they were tapped.
    var flipped = lum(seen[0]) < lum(seen[seen.length - 1]);
    if (flipped) { var t = a; a = b; b = t; seen.reverse(); }
    var best = null;
    [1, -1].forEach(function (side) {
      var cs = colourCentres(a, b, side).map(function (c) { return readSquare(ctx, c.x, c.y, size); });
      var score = cs.reduce(function (s, rgb) { return s + chroma(rgb); }, 0);
      if (!best || score > best.score) best = { side: side, seen: cs, score: score };
    });
    var greys = CARD.patches.map(function (p, i) { return { seen: seen[i], truth: p.truth }; });
    var colours = best.score / CARD.colours.length > 8
      ? CARD.colours.map(function (p, i) { return { seen: best.seen[i], truth: p.truth }; })
      : null;                                                         // no colour row found: greys only
    var fit = C.fitFull(greys, colours);
    var side = colours ? best.side * (flipped ? -1 : 1) : 0;
    return { seen: seen, coloursSeen: best.seen, side: side, flipped: flipped, fit: fit, size: size };
  }

  // Draw the card onto a canvas, from end mark A to end mark B, colour row on side +1.
  function draw(ctx, a, b) {
    var n = CARD.patches.length, g = geometry(a, b), pitch = g.pitch, len = g.len;
    var ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save();
    ctx.translate(a.x, a.y); ctx.rotate(ang);
    var pad = pitch * 0.32, h = pitch * ROW, gap = pitch * GAP;
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = pitch * 0.25; ctx.shadowOffsetY = pitch * 0.08;
    ctx.fillStyle = "#fbfbf9";
    ctx.fillRect(-pitch / 2 - pad, -h / 2 - pad, len + pitch + pad * 2, h * 2 + gap + pad * 2);
    ctx.shadowColor = "transparent";
    function sq(i, row, rgb) { ctx.fillStyle = "rgb(" + rgb.join(",") + ")"; ctx.fillRect(i * pitch - pitch / 2 + 1, -h / 2 + row * (h + gap), pitch - 2, h); }
    sq(0, 0, CARD.mark); sq(n + 1, 0, CARD.mark);
    CARD.patches.forEach(function (p, i) { sq(i + 1, 0, p.truth); });
    CARD.colours.forEach(function (p, i) { sq(i + 1, 1, p.truth); });
    ctx.fillStyle = "#fbfbf9";
    [0, n + 1].forEach(function (i) { ctx.beginPath(); ctx.arc(i * pitch, 0, pitch * 0.16, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  global.MarvCard = { CARD: CARD, geometry: geometry, patchCentres: patchCentres, colourCentres: colourCentres, covers: covers, sampleSize: sampleSize, readSquare: readSquare, readCard: readCard, draw: draw };
})(window);
