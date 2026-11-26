/* The reference card as a PDF, for a professional printer or for saving.
   Built here on the phone, with no library and no internet: the patches are
   drawn as exact vector shapes in millimetres, so the file prints at true size.

   Page 1 is the sheet of three cards, with a 100 mm line to check the print
   was not scaled. Page 2 lists every patch's designed value, for the printer
   to print to and to measure against. */
(function (global) {
  "use strict";
  var K = global.MarvCard, C = global.MarvColour;

  var PT = 72 / 25.4, PAGE_W = 210, PAGE_H = 297, LEFT = 15;
  function n(v) { return (Math.round(v * 100) / 100).toString(); }
  function x(mm) { return n(mm * PT); }
  function y(mm) { return n((PAGE_H - mm) * PT); }       // measured down from the top of the page
  function ascii(s) {                                    // the built-in PDF fonts: plain characters only
    return String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
      .replace(/×/g, "x").replace(/[^\x20-\x7e]/g, "").replace(/([\\()])/g, "\\$1");
  }
  function fill(rgb) { return n(rgb[0] / 255) + " " + n(rgb[1] / 255) + " " + n(rgb[2] / 255) + " rg\n"; }
  function rect(l, t, w, h, rgb) { return fill(rgb) + x(l) + " " + y(t + h) + " " + n(w * PT) + " " + n(h * PT) + " re f\n"; }
  function outline(l, t, w, h, grey, width) {
    return n(grey) + " G " + n(width * PT) + " w " + x(l) + " " + y(t + h) + " " + n(w * PT) + " " + n(h * PT) + " re S\n";
  }
  function circle(cx, cy, r, rgb) {
    var k = 0.5523 * r, s = fill(rgb);
    function p(a, b) { return x(a) + " " + y(b) + " "; }
    s += p(cx + r, cy) + "m\n";
    s += p(cx + r, cy - k) + p(cx + k, cy - r) + p(cx, cy - r) + "c\n";
    s += p(cx - k, cy - r) + p(cx - r, cy - k) + p(cx - r, cy) + "c\n";
    s += p(cx - r, cy + k) + p(cx - k, cy + r) + p(cx, cy + r) + "c\n";
    s += p(cx + k, cy + r) + p(cx + r, cy + k) + p(cx + r, cy) + "c\nf\n";
    return s;
  }
  function text(l, baseline, size, str, bold, rgb) {
    return "BT " + fill(rgb || [34, 34, 34]) + "/" + (bold ? "F2" : "F1") + " " + size + " Tf " + x(l) + " " + y(baseline) + " Td (" + ascii(str) + ") Tj ET\n";
  }
  // Wrap to a rough character count: Helvetica averages about half its size per character.
  function para(l, top, size, str, widthMm, bold) {
    var per = Math.floor(widthMm * PT / (size * 0.52)), words = str.split(" "), lines = [], line = "";
    words.forEach(function (w) {
      if ((line + " " + w).trim().length > per) { lines.push(line); line = w; } else line = (line + " " + w).trim();
    });
    if (line) lines.push(line);
    var s = "", lead = size * 1.4 / PT;
    lines.forEach(function (ln, i) { s += text(l, top + size / PT + i * lead, size, ln, bold); });
    return { ops: s, bottom: top + lines.length * lead };
  }

  /* One card, the same layout as the printable sheet on screen: 168 mm wide, a 4 mm
     white border, ten columns, a grey row (end mark, eight greys, end mark) above a
     colour row (blank, eight colours, blank). */
  var CARD_W = 168, PAD = 4, ROW_GAP = 1.6, COL = (CARD_W - 2 * PAD) / 10, SIDE = 0.15;
  var CELL_W = COL - 2 * SIDE, CELL_H = CELL_W * 5 / 4, CARD_H = 2 * PAD + 2 * CELL_H + ROW_GAP;
  function card(l, t) {
    var s = rect(l, t, CARD_W, CARD_H, [255, 255, 255]) + outline(l, t, CARD_W, CARD_H, 0.79, 0.25);
    var top = K.CARD.patches.map(function (p) { return { rgb: p.truth }; });
    top.unshift({ rgb: K.CARD.mark, mark: true }); top.push({ rgb: K.CARD.mark, mark: true });
    var bottom = K.CARD.colours.map(function (p) { return { rgb: p.truth }; });
    bottom.unshift(null); bottom.push(null);
    [top, bottom].forEach(function (row, r) {
      var rt = t + PAD + r * (CELL_H + ROW_GAP);
      row.forEach(function (c, i) {
        if (!c) return;
        var cl = l + PAD + i * COL + SIDE;
        s += rect(cl, rt, CELL_W, CELL_H, c.rgb);
        if (c.mark) s += circle(cl + CELL_W / 2, rt + CELL_H / 2, CELL_W * 0.15, [255, 255, 255]);
      });
    });
    return s;
  }

  function pageOne(version) {
    var s = text(LEFT, 21, 15, "Magicman reference card " + K.CARD.id, true, [19, 41, 75]);
    s += text(LEFT, 27.5, 9.5, "Print at 100% (actual size) on matt paper or card. Do not scale to fit. Cut out one card along its grey edge.");
    s += text(LEFT, 32.5, 7.5, "Why three cards? Three fit on one sheet. You only need one in each photo; the others are spares, for a second van or for when one gets dirty.", false, [100, 100, 100]);
    var t = 38;
    for (var i = 0; i < 3; i++) {
      s += card(LEFT, t);
      s += text(LEFT, t + CARD_H + 4.5, 8, "Magicman reference card " + K.CARD.id + ". Keep flat, clean and out of sunlight.", false, [85, 85, 85]);
      t += CARD_H + 14;
    }
    // A scale check: if this line is not 100 mm long, the print was scaled.
    var ly = t + 6;
    s += "0.07 0.16 0.29 RG " + n(0.5 * PT) + " w " + x(LEFT) + " " + y(ly) + " m " + x(LEFT + 100) + " " + y(ly) + " l S\n";
    s += x(LEFT) + " " + y(ly - 2.5) + " m " + x(LEFT) + " " + y(ly + 2.5) + " l S " + x(LEFT + 100) + " " + y(ly - 2.5) + " m " + x(LEFT + 100) + " " + y(ly + 2.5) + " l S\n";
    s += text(LEFT, ly + 7, 9, "Size check: this line should measure exactly 100 mm. If it does not, the card was scaled and will not read correctly.");
    s += text(LEFT, 284, 7.5, "Marv's Workshop " + version + ". Colours are sRGB. Design values, not yet measured: printer error applies until the print is measured.", false, [110, 110, 110]);
    return s;
  }

  function pageTwo(version) {
    var W = PAGE_W - 2 * LEFT, s = text(LEFT, 21, 15, "Patch values for the printer", true, [19, 41, 75]);
    var p = para(LEFT, 27, 9.5, "The app expects every patch to be exactly the colour listed below. Any difference in the print is added to every colour the app reads, so the card needs to be printed and checked properly:", W);
    s += p.ops;
    var steps = [
      "1. Print this file colour-managed, treating the colours as sRGB, at 100% (actual size) on matt, uncoated paper or card.",
      "2. Measure every patch with a spectrophotometer and record its CIE L*a*b* values, noting the illuminant used (D50 or D65).",
      "3. Send the measurements to the Marv's Workshop team. They replace the design values in the app, which takes the printer's error out of every reading.",
      "4. Reprint and re-measure for each new batch of cards, as printers drift."
    ];
    var top = p.bottom + 2.5;
    steps.forEach(function (st) { var q = para(LEFT + 3, top, 9.5, st, W - 3); s += q.ops; top = q.bottom + 1.2; });

    // The table: swatch, patch, row, sRGB, hex, L*a*b* (D65).
    top += 5;
    var cols = [LEFT, LEFT + 14, LEFT + 40, LEFT + 68, LEFT + 106, LEFT + 132];
    var heads = ["", "Patch", "Row", "sRGB (R, G, B)", "Hex", "CIE L* a* b* (D65)"];
    heads.forEach(function (h, i) { s += text(cols[i], top, 8.5, h, true, [19, 41, 75]); });
    top += 2.5;
    s += "0.6 G " + n(0.3 * PT) + " w " + x(LEFT) + " " + y(top) + " m " + x(LEFT + W) + " " + y(top) + " l S\n";
    var rows = [{ name: "End marks", row: "Grey row, ends", truth: K.CARD.mark }]
      .concat(K.CARD.patches.map(function (q) { return { name: q.name, row: "Grey", truth: q.truth }; }))
      .concat(K.CARD.colours.map(function (q) { return { name: q.name, row: "Colour", truth: q.truth }; }));
    rows.forEach(function (r) {
      var lab = C.rgbToLab(r.truth), rt = top + 1.4;
      s += rect(LEFT, rt, 9, 6, r.truth) + outline(LEFT, rt, 9, 6, 0.79, 0.2);
      var base = rt + 4.3;
      s += text(cols[1], base, 8.5, r.name) + text(cols[2], base, 8.5, r.row);
      s += text(cols[3], base, 8.5, r.truth.join(", ")) + text(cols[4], base, 8.5, C.toHex(r.truth).toUpperCase());
      s += text(cols[5], base, 8.5, lab.map(function (v) { var t = v.toFixed(1); return t === "-0.0" ? "0.0" : t; }).join("   "));
      top = rt + 7.4;
    });
    s += text(LEFT, 284, 7.5, "Marv's Workshop " + version + ". Card " + K.CARD.id + ". " + K.CARD.status, false, [110, 110, 110]);
    return s;
  }

  // Put the pieces into a PDF file: two fonts, two pages, and the byte offsets that tie them together.
  function build(version) {
    var pages = [pageOne(version), pageTwo(version)], objs = [];
    objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    var kids = pages.map(function (_, i) { return (5 + i * 2) + " 0 R"; }).join(" ");
    objs[2] = "<< /Type /Pages /Kids [" + kids + "] /Count " + pages.length + " >>";
    objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    pages.forEach(function (ops, i) {
      var po = 5 + i * 2;
      objs[po] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + x(PAGE_W) + " " + n(PAGE_H * PT) + "] " +
        "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + (po + 1) + " 0 R >>";
      objs[po + 1] = "<< /Length " + ops.length + " >>\nstream\n" + ops + "endstream";
    });
    var info = objs.length;
    objs[info] = "<< /Title (Magicman reference card " + ascii(K.CARD.id) + ") /Creator (Marv's Workshop " + ascii(version) + ") >>";
    var out = "%PDF-1.4\n", offsets = [];
    for (var i = 1; i < objs.length; i++) { offsets[i] = out.length; out += i + " 0 obj\n" + objs[i] + "\nendobj\n"; }
    var xref = out.length;
    out += "xref\n0 " + objs.length + "\n0000000000 65535 f \n";
    for (i = 1; i < objs.length; i++) out += ("0000000000" + offsets[i]).slice(-10) + " 00000 n \n";
    out += "trailer\n<< /Size " + objs.length + " /Root 1 0 R /Info " + info + " 0 R >>\nstartxref\n" + xref + "\n%%EOF\n";
    return out;                                          // plain ASCII, so characters are bytes
  }

  var api = { build: build, fileName: "magicman-reference-card-" + K.CARD.id + ".pdf" };
  global.MarvCardPdf = api;
})(typeof window !== "undefined" ? window : this);
