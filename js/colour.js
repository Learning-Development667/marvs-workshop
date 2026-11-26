/* Marv's Workshop colour maths.
   Colour difference is measured in CIELAB with the ΔE2000 formula, as the
   feasibility report recommends. Photo correction follows the report's best
   model: fit a gain and a gamma per channel to the reference card's neutral patches,
   using only the part of the ladder the camera has kept apart. */
(function (global) {
  "use strict";

  function srgbToLinear(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function linearToSrgb(v) { v = Math.max(0, Math.min(1, v)); return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); }

  function rgbToLab(rgb) {
    var r = srgbToLinear(rgb[0]), g = srgbToLinear(rgb[1]), b = srgbToLinear(rgb[2]);
    var x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
    var y = (0.2126729 * r + 0.7151522 * g + 0.0721750 * b);
    var z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    var fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  // ΔE2000 (Sharma, Wu and Dalal). Checked against their published test pairs.
  function deltaE(l1, l2) {
    var L1 = l1[0], a1 = l1[1], b1 = l1[2], L2 = l2[0], a2 = l2[1], b2 = l2[2];
    var rad = Math.PI / 180, deg = 180 / Math.PI;
    var C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
    var G = 0.5 * (1 - Math.sqrt(Math.pow(Cm, 7) / (Math.pow(Cm, 7) + Math.pow(25, 7))));
    var a1p = (1 + G) * a1, a2p = (1 + G) * a2;
    var C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
    var h1p = (C1p === 0) ? 0 : (Math.atan2(b1, a1p) * deg + 360) % 360;
    var h2p = (C2p === 0) ? 0 : (Math.atan2(b2, a2p) * deg + 360) % 360;
    var dLp = L2 - L1, dCp = C2p - C1p, dhp = 0;
    if (C1p * C2p !== 0) {
      dhp = h2p - h1p;
      if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360;
    }
    var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2 * rad);
    var Lpm = (L1 + L2) / 2, Cpm = (C1p + C2p) / 2, hpm = h1p + h2p;
    if (C1p * C2p !== 0) {
      if (Math.abs(h1p - h2p) <= 180) hpm = (h1p + h2p) / 2;
      else hpm = (h1p + h2p < 360) ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    }
    var T = 1 - 0.17 * Math.cos((hpm - 30) * rad) + 0.24 * Math.cos(2 * hpm * rad) + 0.32 * Math.cos((3 * hpm + 6) * rad) - 0.20 * Math.cos((4 * hpm - 63) * rad);
    var dTheta = 30 * Math.exp(-Math.pow((hpm - 275) / 25, 2));
    var Rc = 2 * Math.sqrt(Math.pow(Cpm, 7) / (Math.pow(Cpm, 7) + Math.pow(25, 7)));
    var Sl = 1 + (0.015 * Math.pow(Lpm - 50, 2)) / Math.sqrt(20 + Math.pow(Lpm - 50, 2));
    var Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T;
    var Rt = -Math.sin(2 * dTheta * rad) * Rc;
    return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh));
  }
  function deltaRgb(a, b) { return deltaE(rgbToLab(a), rgbToLab(b)); }

  /* Fit a camera correction from the reference card.
     patches: [{ seen: [r,g,b], truth: [r,g,b] }] for the neutral ladder, lightest first.
     Returns { apply(rgb) -> rgb, used, total, kind }.
     The ladder is walked from white downwards and cut off where the camera has
     flattened it, because a correction fitted to patches the camera could not
     tell apart does more harm than good. */
  function fitCorrection(patches) {
    var eps = 1e-4;
    var seenLin = patches.map(function (p) { return p.seen.map(srgbToLinear); });
    var trueLin = patches.map(function (p) { return p.truth.map(srgbToLinear); });
    // Walk down the ladder: keep a patch while it is clearly darker than the one before.
    var keep = [0];
    for (var i = 1; i < patches.length; i++) {
      var prev = seenLin[keep[keep.length - 1]], cur = seenLin[i];
      var lp = 0.2127 * prev[0] + 0.7152 * prev[1] + 0.0722 * prev[2];
      var lc = 0.2127 * cur[0] + 0.7152 * cur[1] + 0.0722 * cur[2];
      var tp = trueLin[keep[keep.length - 1]], tc = trueLin[i];
      var expected = (0.2127 * tc[0] + 0.7152 * tc[1] + 0.0722 * tc[2]) / Math.max(eps, 0.2127 * tp[0] + 0.7152 * tp[1] + 0.0722 * tp[2]);
      // The step should fall by at least a third of what the card says it should.
      if (lc / Math.max(eps, lp) > 1 - (1 - expected) / 3) break;
      keep.push(i);
    }
    var fits = [0, 1, 2].map(function (ch) {
      if (keep.length < 3) {
        // Too little to fit a curve: white balance from the lightest patch only.
        return { gain: trueLin[0][ch] / Math.max(eps, seenLin[0][ch]), gamma: 1 };
      }
      // Least squares on log(true) = log(gain) + gamma * log(seen).
      var n = keep.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
      keep.forEach(function (k) {
        var x = Math.log(Math.max(eps, seenLin[k][ch])), y = Math.log(Math.max(eps, trueLin[k][ch]));
        sx += x; sy += y; sxx += x * x; sxy += x * y;
      });
      var den = n * sxx - sx * sx;
      var gamma = Math.abs(den) < 1e-9 ? 1 : (n * sxy - sx * sy) / den;
      gamma = Math.max(0.4, Math.min(2.5, gamma));
      var gain = Math.exp((sy - gamma * sx) / n);
      return { gain: gain, gamma: gamma };
    });
    return {
      used: keep.length, total: patches.length, kind: keep.length < 3 ? "white balance only" : "gain and gamma",
      fits: fits,
      apply: function (rgb) {
        return [0, 1, 2].map(function (ch) {
          var v = Math.max(eps, srgbToLinear(rgb[ch]));
          return linearToSrgb(fits[ch].gain * Math.pow(v, fits[ch].gamma));
        });
      }
    };
  }

  /* Average a patch of pixels the way the report's test rig did: discard the
     darkest and lightest fifth, so dust, texture and glints do not skew it. */
  function trimmedMean(pixels) {
    if (!pixels.length) return [0, 0, 0];
    var sorted = pixels.slice().sort(function (a, b) { return (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]); });
    var cut = Math.floor(sorted.length * 0.2), mid = sorted.slice(cut, sorted.length - cut);
    if (!mid.length) mid = sorted;
    var s = [0, 0, 0];
    mid.forEach(function (p) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; });
    return s.map(function (v) { return v / mid.length; });
  }

  function toHex(rgb) { return "#" + rgb.map(function (v) { return ("0" + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); }).join(""); }
  function fromHex(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }

  /* Second step, from the card's colour patches: a 3 by 3 colour matrix in linear
     light that corrects the shifts greys cannot show, such as a phone boosting
     saturation or nudging hues. It is pulled gently towards "no change" so a few
     patches cannot twist it. pairs: [{ x: [r,g,b], y: [r,g,b] }] in linear light. */
  function inv3(m) {
    var a = m[0][0], b = m[0][1], c = m[0][2], d = m[1][0], e = m[1][1], f = m[1][2], g = m[2][0], h = m[2][1], i = m[2][2];
    var A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc;
    if (Math.abs(det) < 1e-12) return null;
    return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
            [B / det, (a * i - c * g) / det, -(a * f - c * d) / det],
            [Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
  }
  function fitMatrix(pairs, lambda) {
    lambda = lambda == null ? 0.05 : lambda;
    var XX = [[lambda, 0, 0], [0, lambda, 0], [0, 0, lambda]], YX = [[lambda, 0, 0], [0, lambda, 0], [0, 0, lambda]];
    pairs.forEach(function (p) {
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) { XX[r][c] += p.x[r] * p.x[c]; YX[r][c] += p.y[r] * p.x[c]; }
    });
    var inv = inv3(XX);
    if (!inv) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    var M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) for (var k = 0; k < 3; k++) M[r][c] += YX[r][k] * inv[k][c];
    return M;
  }
  function applyMatrix(M, lin) {
    return [0, 1, 2].map(function (r) { return M[r][0] * lin[0] + M[r][1] * lin[1] + M[r][2] * lin[2]; });
  }
  /* The whole correction: greys first (fitCorrection), then the colour matrix.
     greys: [{ seen, truth }] lightest first. colours: [{ seen, truth }].
     check = how far the card's own colour patches land from their true values when
     each one is left out of the fit in turn: an honest guide to this photo's accuracy. */
  function fitFull(greys, colours, lambda) {
    var base = fitCorrection(greys);
    if (!colours || colours.length < 3) return Object.assign({}, base, { matrix: null, check: null });
    function pairsOf(list) {
      return list.map(function (p) { return { x: base.apply(p.seen).map(srgbToLinear), y: p.truth.map(srgbToLinear) }; });
    }
    var all = pairsOf(greys.concat(colours));
    var M = fitMatrix(all, lambda);
    var errs = colours.map(function (c, j) {
      var others = pairsOf(greys.concat(colours.filter(function (o, k) { return k !== j; })));
      var Mj = fitMatrix(others, lambda);
      var out = applyMatrix(Mj, base.apply(c.seen).map(srgbToLinear)).map(linearToSrgb);
      return deltaRgb(out, c.truth);
    });
    var check = errs.reduce(function (s, e) { return s + e; }, 0) / errs.length;
    return {
      used: base.used, total: base.total, kind: base.kind + ", then colour", fits: base.fits, matrix: M, check: check, checkWorst: Math.max.apply(null, errs),
      greyOnly: base.apply,
      apply: function (rgb) { return applyMatrix(M, base.apply(rgb).map(srgbToLinear)).map(linearToSrgb); }
    };
  }

  var api = { rgbToLab: rgbToLab, deltaE: deltaE, deltaRgb: deltaRgb, fitCorrection: fitCorrection, fitMatrix: fitMatrix, fitFull: fitFull, trimmedMean: trimmedMean, toHex: toHex, fromHex: fromHex, srgbToLinear: srgbToLinear, linearToSrgb: linearToSrgb };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.MarvColour = api;
})(typeof window !== "undefined" ? window : globalThis);
