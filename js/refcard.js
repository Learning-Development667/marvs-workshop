/* The reference card: a printed strip of known colours that goes in the photo.
   The app compares how the camera recorded each patch with what the patch
   really is, and uses the difference to correct the surface colour. Until a
   printed card exists, the app lets the technician slide a virtual one in.

   This definition is PROVISIONAL. The values below are what the patches are
   designed to be. A real card must be measured after printing and those
   measured values put here, because a print never matches its design exactly.
   Layout follows the feasibility report: neutral patches from white down to
   mid grey only (phones lose the dark end), matt finish, a mark at each end. */
(function (global) {
  "use strict";
  var C = global.MarvColour;

  var CARD = {
    id: "MM-REF-0",
    status: "Provisional design. Not yet printed or measured.",
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
    mark: [19, 41, 75]           // the end marks, Crow Black Blue
  };

  // Centres of the patches along the line from end mark A to end mark B.
  function patchCentres(a, b) {
    var n = CARD.patches.length;
    return CARD.patches.map(function (p, i) {
      var t = (i + 1) / (n + 1);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    });
  }
  // Side of the square sampled inside each patch, in image pixels.
  function sampleSize(a, b) {
    var pitch = Math.hypot(b.x - a.x, b.y - a.y) / (CARD.patches.length + 1);
    return Math.max(4, Math.round(pitch * 0.42));
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
  // Read the card out of a photo and fit the camera correction.
  function readCard(ctx, a, b) {
    var size = sampleSize(a, b);
    var seen = patchCentres(a, b).map(function (c) { return readSquare(ctx, c.x, c.y, size); });
    var fit = C.fitCorrection(CARD.patches.map(function (p, i) { return { seen: seen[i], truth: p.truth }; }));
    return { seen: seen, fit: fit, size: size };
  }

  // Draw the card onto a canvas, from end mark A to end mark B (used for the sample photo and the print sheet).
  function draw(ctx, a, b) {
    var n = CARD.patches.length, len = Math.hypot(b.x - a.x, b.y - a.y), pitch = len / (n + 1);
    var ang = Math.atan2(b.y - a.y, b.x - a.x);
    ctx.save();
    ctx.translate(a.x, a.y); ctx.rotate(ang);
    var pad = pitch * 0.32, h = pitch * 1.15;
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = pitch * 0.25; ctx.shadowOffsetY = pitch * 0.08;
    ctx.fillStyle = "#fbfbf9";
    ctx.fillRect(-pitch / 2 - pad, -h / 2 - pad, len + pitch + pad * 2, h + pad * 2);
    ctx.shadowColor = "transparent";
    function sq(i, rgb) { ctx.fillStyle = "rgb(" + rgb.join(",") + ")"; ctx.fillRect(i * pitch - pitch / 2 + 1, -h / 2, pitch - 2, h); }
    sq(0, CARD.mark); sq(n + 1, CARD.mark);
    CARD.patches.forEach(function (p, i) { sq(i + 1, p.truth); });
    ctx.fillStyle = "#fbfbf9";
    [0, n + 1].forEach(function (i) { ctx.beginPath(); ctx.arc(i * pitch, 0, pitch * 0.16, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  }

  global.MarvCard = { CARD: CARD, patchCentres: patchCentres, sampleSize: sampleSize, readSquare: readSquare, readCard: readCard, draw: draw };
})(window);
