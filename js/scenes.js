/* Marv's Workshop scene kit.
   Each scene is a small 3D model of something Magicman repairs. One material
   (the "paint") takes whatever colour the game sets, and a repair patch sits on
   that surface in the colour of the player's mix. Needs THREE (r147),
   THREE.RoundedBoxGeometry and THREE.RoomEnvironment loaded first. */
(function (global) {
  "use strict";
  var THREE = global.THREE;
  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  function rb(w, h, d, r) { return new THREE.RoundedBoxGeometry(w, h, d, 4, r == null ? 0.006 : r); }
  function std(color, rough, metal) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.6 : rough, metalness: metal || 0, envMapIntensity: metal ? 1.1 : 0.42 });
  }

  var texCache = {};
  function brickTexture() {
    if (texCache.brick) return texCache.brick;
    var c = document.createElement("canvas"); c.width = 512; c.height = 512;
    var x = c.getContext("2d");
    x.fillStyle = "#cfc8ba"; x.fillRect(0, 0, 512, 512);
    var rows = 8, bh = 512 / rows, bw = 128, seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var r = 0; r < rows; r++) {
      var off = (r % 2) * bw / 2;
      for (var i = -1; i < 5; i++) {
        var t = rnd();
        var R = Math.round(150 + t * 34), G = Math.round(84 + t * 22), B = Math.round(62 + t * 16);
        x.fillStyle = "rgb(" + R + "," + G + "," + B + ")";
        x.fillRect(i * bw + off + 4, r * bh + 4, bw - 8, bh - 8);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    texCache.brick = tex;
    return tex;
  }
  function woodTexture() {
    if (texCache.wood) return texCache.wood;
    var c = document.createElement("canvas"); c.width = 512; c.height = 512;
    var x = c.getContext("2d");
    x.fillStyle = "#b08a62"; x.fillRect(0, 0, 512, 512);
    var seed = 11;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var p = 0; p < 4; p++) {
      x.fillStyle = "rgba(" + (150 + Math.round(rnd() * 30)) + "," + (118 + Math.round(rnd() * 20)) + "," + (84 + Math.round(rnd() * 16)) + ",0.55)";
      x.fillRect(0, p * 128, 512, 126);
      for (var g = 0; g < 26; g++) {
        x.strokeStyle = "rgba(90,62,38," + (0.05 + rnd() * 0.09) + ")";
        x.lineWidth = 1 + rnd() * 1.5;
        var y = p * 128 + rnd() * 126;
        x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(170, y + rnd() * 8 - 4, 340, y + rnd() * 8 - 4, 512, y + rnd() * 6 - 3); x.stroke();
      }
      x.fillStyle = "rgba(60,40,24,0.5)"; x.fillRect(0, p * 128 + 126, 512, 2);
      x.fillRect(Math.round(rnd() * 400) + 50, p * 128, 2, 126);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    texCache.wood = tex;
    return tex;
  }

  // ── A small builder so scene code stays readable ──
  function Kit() {
    this.group = new THREE.Group();
    this.paint = new THREE.MeshPhysicalMaterial({ color: "#888888", roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.4, envMapIntensity: 0.6 });
    this.patchMat = new THREE.MeshStandardMaterial({ color: "#999999", roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    this.steel = std("#c6cacf", 0.22, 1);
    this.white = std("#f4f2ed", 0.55);
    this.glass = new THREE.MeshStandardMaterial({ color: "#9fb6c2", roughness: 0.06, metalness: 0.85, envMapIntensity: 1.5 });
    this.spots = [];
    this.surfaces = {};
  }
  Kit.prototype.add = function (geo, material, x, y, z, noFit) {
    var m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    if (noFit) m.userData.noFit = true;
    this.group.add(m);
    return m;
  };
  Kit.prototype.box = function (w, h, d, material, x, y, z, r) { return this.add(rb(w, h, d, r), material, x, y, z); };
  Kit.prototype.bar = function (len, x, y, z, vertical, radius) {
    var m = this.add(new THREE.CylinderGeometry(radius || 0.007, radius || 0.007, len, 20), this.steel, x, y, z);
    if (!vertical) m.rotation.z = Math.PI / 2;
    return m;
  };
  // An irregular blob laid on a surface. facing: "front" (vertical face toward +z) or "up".
  // Register a second surface that a damage spot can sit on (a worktop, a frame, a top).
  Kit.prototype.surface = function (name, material) { this.surfaces[name] = { mat: material, def: material.color.clone() }; return material; };
  Kit.prototype.addPatch = function (x, y, z, size, facing, label, surface) {
    var shape = new THREE.Shape(), n = 28;
    for (var i = 0; i <= n; i++) {
      var a = i / n * Math.PI * 2;
      var r = size * (1 + 0.17 * Math.sin(a * 3 + 1) + 0.09 * Math.sin(a * 7 + 0.4));
      var px = Math.cos(a) * r * 1.3, py = Math.sin(a) * r;
      if (i) shape.lineTo(px, py); else shape.moveTo(px, py);
    }
    var m = new THREE.Mesh(new THREE.ShapeGeometry(shape), this.patchMat);
    m.position.set(x, y, z);
    if (facing === "up") m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    this.group.add(m);
    if (facing === "side") m.rotation.y = Math.PI / 2;
    m.visible = false;
    this.spots.push({ mesh: m, label: label || ("Spot " + (this.spots.length + 1)), surface: surface || "paint" });
    return m;
  };
  Kit.prototype.wall = function (w, h, material, z, yBase) {
    var m = this.add(new THREE.PlaneGeometry(w, h), material, 0, (yBase || 0) + h / 2, z, true);
    m.castShadow = false;
    return m;
  };
  Kit.prototype.brickWall = function (w, h, z) {
    var tex = brickTexture().clone(); tex.needsUpdate = true;
    tex.repeat.set(w / 0.92, h / 0.6);
    return this.wall(w, h, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, envMapIntensity: 0.35 }), z);
  };
  // A framed (shaker-style) panel made of a back slab and four rails.
  Kit.prototype.shaker = function (x, y, z, w, h, rail, material) {
    var t = 0.02, m = material || this.paint;
    this.box(w, h, t * 0.6, m, x, y, z, 0.003);
    this.box(w, rail, t, m, x, y + h / 2 - rail / 2, z + 0.006);
    this.box(w, rail, t, m, x, y - h / 2 + rail / 2, z + 0.006);
    this.box(rail, h, t, m, x - w / 2 + rail / 2, y, z + 0.006);
    this.box(rail, h, t, m, x + w / 2 - rail / 2, y, z + 0.006);
  };

  // ── Scenes ──
  var SCENES = {};

  SCENES.kitchen = {
    name: "Kitchen units", area: "Kitchen", blurb: "Painted shaker doors and drawer fronts",
    floor: "wood", view: [0.5, 0.32, 1], sample: "#383e42",
    build: function (k) {
      k.wall(9, 3, std("#e6e1d8", 0.95), -0.33);
      k.box(2.72, 0.47, 0.006, std("#b9bab5", 0.9), 0, 1.14, -0.327, 0.002);
      var tile = std("#f3f2ee", 0.22);
      for (var i = 0; i < 9; i++) for (var j = 0; j < 3; j++) k.box(0.296, 0.146, 0.012, tile, -1.2 + i * 0.3, 0.99 + j * 0.15, -0.322, 0.004);
      k.box(2.4, 0.72, 0.56, k.white, 0, 0.51, 0);
      k.box(2.4, 0.15, 0.5, std("#2b2e31", 0.6), 0, 0.075, -0.03);
      k.box(2.46, 0.04, 0.62, k.surface("top", std("#e9e4da", 0.3)), 0, 0.89, 0.01, 0.008);
      var fw = 0.594;
      [-0.9, -0.3, 0.9].forEach(function (x) { k.shaker(x, 0.51, 0.29, fw, 0.714, 0.07); });
      k.shaker(0.3, 0.4035, 0.29, fw, 0.501, 0.07);
      k.shaker(0.3, 0.774, 0.29, fw, 0.188, 0.045);
      k.bar(0.16, -0.66, 0.74, 0.335, true); k.bar(0.16, -0.54, 0.74, 0.335, true); k.bar(0.16, 0.66, 0.74, 0.335, true);
      k.bar(0.16, 0.3, 0.80, 0.335, false); k.bar(0.16, 0.3, 0.57, 0.335, false);
      k.addPatch(-0.9, 0.48, 0.2965, 0.07, "front", "Left-hand door");
      k.addPatch(0.12, 0.774, 0.2965, 0.028, "front", "Drawer front");
      k.addPatch(0.6, 0.9112, 0.12, 0.06, "up", "Worktop", "top");
    }
  };

  SCENES.worktop = {
    name: "Worktop", area: "Kitchen", blurb: "A chip near the front edge of a kitchen worktop",
    floor: "wood", view: [0.42, 0.78, 1], sample: "#4c4a44",
    build: function (k) {
      k.wall(9, 3, std("#e6e1d8", 0.95), -0.33);
      k.box(2.2, 0.72, 0.56, k.white, 0, 0.51, 0);
      k.box(2.2, 0.15, 0.5, std("#3a3d40", 0.6), 0, 0.075, -0.03);
      var door = k.surface("doors", std("#fbfaf7", 0.4));
      [-0.825, -0.275, 0.275, 0.825].forEach(function (x) {
        k.box(0.544, 0.714, 0.018, door, x, 0.51, 0.289, 0.004);
        k.bar(0.2, x, 0.80, 0.312, false);
      });
      k.box(2.26, 0.04, 0.63, k.paint, 0, 0.89, 0.012, 0.01);
      k.box(2.26, 0.1, 0.02, k.paint, 0, 0.96, -0.293, 0.006);
      // hob
      k.box(0.58, 0.008, 0.5, std("#16181a", 0.12), 0.55, 0.914, 0.0, 0.003);
      [[0.42, -0.11], [0.68, -0.11], [0.42, 0.12], [0.68, 0.12]].forEach(function (p) {
        var ring = k.add(new THREE.TorusGeometry(0.075, 0.004, 8, 40), std("#5b5f63", 0.4, 0.6), p[0], 0.919, p[1]);
        ring.rotation.x = Math.PI / 2; ring.castShadow = false;
      });
      // sink
      k.box(0.5, 0.01, 0.42, k.steel, -0.6, 0.913, 0.0, 0.004);
      k.box(0.42, 0.012, 0.34, std("#8d9297", 0.35, 1), -0.6, 0.915, 0.0, 0.004);
      k.bar(0.26, -0.6, 1.04, -0.2, true, 0.012);
      var spout = k.bar(0.16, -0.6, 1.16, -0.13, true, 0.01); spout.rotation.x = Math.PI / 2;
      k.addPatch(-0.02, 0.9112, 0.2, 0.06, "up", "Front edge");
      k.addPatch(-0.2, 0.96, -0.2818, 0.03, "front", "Upstand");
      k.addPatch(0.275, 0.45, 0.2992, 0.06, "front", "Cupboard door", "doors");
    }
  };

  SCENES.bath = {
    name: "Bath", area: "Bathroom", blurb: "A chip on a coloured bath",
    floor: "tile", view: [0.5, 0.6, 1], sample: "#c9b896",
    build: function (k) {
      k.wall(9, 3, std("#b4bbbb", 0.9), -0.42);
      var tile = std("#e9eeee", 0.2);
      for (var i = 0; i < 22; i++) for (var j = 0; j < 9; j++) { var tb = k.box(0.396, 0.296, 0.012, tile, -4.2 + i * 0.4, 0.15 + j * 0.3, -0.412, 0.004); tb.userData.noFit = true; tb.castShadow = false; }
      var L = 1.7, D = 0.72, H = 0.54, t = 0.07;
      k.box(L, H, t, k.paint, 0, H / 2, D / 2 - t / 2, 0.02);
      k.box(L, H, t, k.paint, 0, H / 2, -D / 2 + t / 2, 0.02);
      k.box(t, H, D, k.paint, -L / 2 + t / 2, H / 2, 0, 0.02);
      k.box(t, H, D, k.paint, L / 2 - t / 2, H / 2, 0, 0.02);
      k.box(L - 0.04, 0.05, D - 0.04, k.paint, 0, 0.13, 0, 0.01);
      // rolled rim
      k.box(L + 0.03, 0.045, t + 0.04, k.paint, 0, H, D / 2 - t / 2, 0.02);
      k.box(L + 0.03, 0.045, t + 0.04, k.paint, 0, H, -D / 2 + t / 2, 0.02);
      k.box(t + 0.04, 0.045, D + 0.03, k.paint, -L / 2 + t / 2, H, 0, 0.02);
      k.box(t + 0.06, 0.045, D + 0.03, k.paint, L / 2 - t / 2, H, 0, 0.02);
      // taps
      [-0.1, 0.1].forEach(function (z) {
        k.bar(0.12, L / 2 - t / 2, H + 0.08, z, true, 0.013);
        var s = k.bar(0.12, L / 2 - t / 2 - 0.05, H + 0.13, z, false, 0.011);
        k.add(new THREE.SphereGeometry(0.02, 16, 12), k.steel, L / 2 - t / 2, H + 0.15, z);
      });
      k.addPatch(-0.25, 0.3, D / 2 + 0.0012, 0.055, "front", "Front panel");
      k.addPatch(0.3, H + 0.0237, D / 2 - t / 2, 0.03, "up", "Rim");
      k.addPatch(L / 2 + 0.0012, 0.28, 0.05, 0.05, "side", "End panel");
    }
  };

  SCENES.door = {
    name: "Internal door", area: "Doors", blurb: "A knock on a painted panel door",
    floor: "wood", view: [0.46, 0.12, 1], sample: "#8c9c92",
    build: function (k) {
      var w = 0.762, h = 1.981, z = 0.0;
      k.wall(9, 3.2, std("#ddd6ca", 0.95), -0.04);
      // skirting and architrave
      var sk1 = k.box(4, 0.12, 0.018, k.white, -2.47, 0.06, -0.03), sk2 = k.box(4, 0.12, 0.018, k.white, 2.47, 0.06, -0.03); sk1.userData.noFit = sk2.userData.noFit = true;
      k.box(0.07, h + 0.07, 0.03, k.white, -w / 2 - 0.045, (h + 0.07) / 2, -0.02);
      k.box(0.07, h + 0.07, 0.03, k.white, w / 2 + 0.045, (h + 0.07) / 2, -0.02);
      k.box(w + 0.16, 0.07, 0.03, k.white, 0, h + 0.045, -0.02);
      // door leaf: slab plus stiles and rails, giving four recessed panels
      k.box(w, h, 0.03, k.paint, 0, h / 2, z, 0.003);
      var st = 0.11, t = 0.016, zz = z + 0.02;
      k.box(st, h, t, k.paint, -w / 2 + st / 2, h / 2, zz); k.box(st, h, t, k.paint, w / 2 - st / 2, h / 2, zz);
      k.box(w, 0.12, t, k.paint, 0, h - 0.06, zz);
      k.box(w, 0.2, t, k.paint, 0, 0.1, zz);
      k.box(w, 0.16, t, k.paint, 0, 0.92, zz);
      k.box(0.1, h, t, k.paint, 0, h / 2, zz);
      // lever handle
      k.box(0.045, 0.16, 0.008, k.steel, w / 2 - 0.055, 1.0, zz + 0.012, 0.004);
      k.bar(0.12, w / 2 - 0.105, 1.02, zz + 0.045, false, 0.009);
      var neck = k.bar(0.04, w / 2 - 0.055, 1.02, zz + 0.03, true, 0.009); neck.rotation.x = Math.PI / 2;
      k.surface("trim", k.white);
      k.addPatch(-0.2, 0.55, 0.0162, 0.06, "front", "Lower panel");
      k.addPatch(0.2, 1.45, 0.0162, 0.06, "front", "Upper panel");
      k.addPatch(-w / 2 - 0.045, 1.3, -0.0038, 0.022, "front", "Architrave", "trim");
    }
  };

  SCENES.frontdoor = {
    name: "Front door", area: "Doors", blurb: "A scuff on a composite front door",
    floor: "paving", view: [-0.44, 0.1, 1], sample: "#1f3a2b",
    build: function (k) {
      var w = 0.9, h = 2.05, fr = 0.07;
      k.brickWall(9, 3.4, -0.06);
      // frame and threshold
      k.box(fr, h + fr, 0.07, k.white, -w / 2 - fr / 2, (h + fr) / 2, -0.01);
      k.box(fr, h + fr, 0.07, k.white, w / 2 + fr / 2, (h + fr) / 2, -0.01);
      k.box(w + 2 * fr, fr, 0.07, k.white, 0, h + fr / 2, -0.01);
      k.box(w + 2 * fr + 0.1, 0.04, 0.16, std("#9aa0a6", 0.5, 0.6), 0, 0.02, 0.03);
      // leaf
      k.box(w, h - 0.02, 0.044, k.paint, 0, h / 2 + 0.01, 0.0, 0.004);
      // three glazed squares
      [1.62, 1.34, 1.06].forEach(function (y) {
        k.box(0.2, 0.2, 0.012, k.steel, -0.2, y, 0.022, 0.004);
        k.box(0.165, 0.165, 0.012, k.glass, -0.2, y, 0.026, 0.003);
      });
      // long bar handle, letterplate, cylinder
      k.bar(1.2, 0.3, 1.1, 0.07, true, 0.014);
      [1.6, 0.6].forEach(function (y) { var s = k.bar(0.06, 0.3, y, 0.045, true, 0.008); s.rotation.x = Math.PI / 2; });
      k.box(0.28, 0.07, 0.01, k.steel, -0.05, 0.72, 0.026, 0.004);
      k.add(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 24), k.steel, 0.3, 0.95, 0.03).rotation.x = Math.PI / 2;
      k.surface("trim", k.white);
      k.addPatch(-0.12, 0.4, 0.0235, 0.065, "front", "Lower door");
      k.addPatch(0.1, 1.3, 0.0235, 0.05, "front", "Beside the handle");
      k.addPatch(-w / 2 - fr / 2, 1.1, 0.0262, 0.022, "front", "Frame", "trim");
    }
  };

  SCENES.window = {
    name: "Window frame", area: "Windows", blurb: "A mark on a coloured uPVC frame",
    floor: "paving", view: [0.48, 0.16, 1], sample: "#383e42",
    build: function (k) {
      var w = 1.5, h = 1.15, y0 = 0.95, fr = 0.075, z = 0.0;
      k.brickWall(9, 3.4, -0.05);
      // outer frame
      k.box(w, fr, 0.07, k.paint, 0, y0 + h - fr / 2, z); k.box(w, fr, 0.07, k.paint, 0, y0 + fr / 2, z);
      k.box(fr, h, 0.07, k.paint, -w / 2 + fr / 2, y0 + h / 2, z); k.box(fr, h, 0.07, k.paint, w / 2 - fr / 2, y0 + h / 2, z);
      k.box(fr, h, 0.07, k.paint, 0, y0 + h / 2, z);
      // two sashes with glass
      [-1, 1].forEach(function (s) {
        var cx = s * (w / 4 - fr / 4 + 0.0), sw = w / 2 - fr * 1.5, sh = h - fr * 2, sf = 0.05, zz = z + 0.02;
        k.box(sw, sf, 0.05, k.paint, cx, y0 + fr + sh - sf / 2, zz); k.box(sw, sf, 0.05, k.paint, cx, y0 + fr + sf / 2, zz);
        k.box(sf, sh, 0.05, k.paint, cx - sw / 2 + sf / 2, y0 + fr + sh / 2, zz); k.box(sf, sh, 0.05, k.paint, cx + sw / 2 - sf / 2, y0 + fr + sh / 2, zz);
        k.box(sw - sf * 2 + 0.01, sh - sf * 2 + 0.01, 0.01, k.glass, cx, y0 + fr + sh / 2, zz, 0.002);
        k.box(0.03, 0.11, 0.02, k.white, cx - s * (sw / 2 - sf / 2), y0 + fr + sh / 2, zz + 0.035, 0.006);
      });
      // sill
      k.box(w + 0.14, 0.035, 0.2, k.paint, 0, y0 - 0.0175, 0.06, 0.008);
      k.addPatch(-0.42, y0 + fr / 2, z + 0.0362, 0.028, "front", "Bottom rail");
      k.addPatch(0.35, y0 + 0.0012, 0.105, 0.035, "up", "Sill");
      k.addPatch(0, y0 + 0.75, z + 0.0362, 0.02, "front", "Centre post");
    }
  };

  SCENES.drawers = {
    name: "Chest of drawers", area: "Furniture", blurb: "A dent in painted furniture",
    floor: "wood", view: [0.55, 0.4, 1], sample: "#6b7f8c",
    build: function (k) {
      var w = 0.9, h = 0.82, d = 0.45, base = 0.14;
      k.wall(9, 3, std("#d9d3c8", 0.95), -0.3);
      k.box(9, 0.12, 0.018, k.white, 0, 0.06, -0.29).userData.noFit = true;
      var oak = new THREE.MeshStandardMaterial({ color: "#c9a57a", roughness: 0.55 });
      k.box(w, h, d, k.paint, 0, base + h / 2, 0, 0.012);
      k.box(w + 0.04, 0.028, d + 0.03, k.surface("top", std("#c9a57a", 0.5)), 0, base + h + 0.014, 0.005, 0.008);
      var fh = (h - 0.05) / 4;
      for (var i = 0; i < 4; i++) {
        var y = base + 0.025 + fh / 2 + i * fh;
        k.box(w - 0.05, fh - 0.014, 0.018, k.paint, 0, y, d / 2 + 0.004, 0.006);
        [-0.22, 0.22].forEach(function (x) {
          k.add(new THREE.SphereGeometry(0.019, 20, 14), std("#b08d57", 0.3, 0.9), x, y, d / 2 + 0.03);
        });
      }
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
        k.add(new THREE.CylinderGeometry(0.022, 0.014, base, 16), oak, s[0] * (w / 2 - 0.06), base / 2, s[1] * (d / 2 - 0.06));
      });
      k.addPatch(0.22, base + 0.025 + fh * 2.5, d / 2 + 0.0135, 0.05, "front", "Drawer front");
      k.addPatch(-0.12, base + h + 0.0292, 0.03, 0.06, "up", "Top", "top");
      k.addPatch(w / 2 + 0.0012, base + 0.45, 0, 0.06, "side", "Side panel");
    }
  };

  SCENES.garage = {
    name: "Garage door", area: "Doors", blurb: "A scrape on a sectional garage door",
    floor: "paving", view: [0.4, 0.14, 1], sample: "#383e42",
    build: function (k) {
      var w = 2.4, h = 2.1, n = 4, sh = h / n;
      k.brickWall(10, 3.6, -0.08);
      k.box(w, h, 0.02, std("#15171a", 0.8), 0, h / 2, -0.03, 0.002);
      k.box(0.09, h + 0.09, 0.1, k.white, -w / 2 - 0.045, (h + 0.09) / 2, -0.03);
      k.box(0.09, h + 0.09, 0.1, k.white, w / 2 + 0.045, (h + 0.09) / 2, -0.03);
      k.box(w + 0.18, 0.09, 0.1, k.white, 0, h + 0.045, -0.03);
      for (var i = 0; i < n; i++) {
        var y = sh / 2 + i * sh;
        k.box(w, sh - 0.012, 0.04, k.paint, 0, y, 0, 0.006);
        [-1, 0, 1].forEach(function (r) { k.box(w - 0.06, 0.02, 0.012, k.paint, 0, y + r * sh * 0.27, 0.022, 0.005); });
      }
      k.box(0.16, 0.03, 0.02, std("#1b1d1f", 0.4), 0, sh * 1.5, 0.04, 0.008);
      k.surface("trim", k.white);
      k.addPatch(-0.55, sh * 0.5 + 0.07, 0.0212, 0.09, "front", "Bottom section");
      k.addPatch(0.5, sh * 3.5 + 0.07, 0.0212, 0.08, "front", "Top section");
      k.addPatch(-w / 2 - 0.045, 1.0, 0.0212, 0.028, "front", "Frame", "trim");
    }
  };

  // ── More materials and helpers ──
  function tileTexture(tileHex, groutHex) {
    var key = "tile" + tileHex + groutHex;
    if (texCache[key]) return texCache[key];
    var c = document.createElement("canvas"); c.width = 256; c.height = 256;
    var x = c.getContext("2d");
    x.fillStyle = groutHex; x.fillRect(0, 0, 256, 256);
    x.fillStyle = tileHex; x.fillRect(4, 4, 248, 248);
    var g = x.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, "rgba(255,255,255,0.10)"); g.addColorStop(1, "rgba(0,0,0,0.06)");
    x.fillStyle = g; x.fillRect(4, 4, 248, 248);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.encoding = THREE.sRGBEncoding;
    texCache[key] = tex; return tex;
  }
  function marbleTexture() {
    if (texCache.marble) return texCache.marble;
    var c = document.createElement("canvas"); c.width = 512; c.height = 512;
    var x = c.getContext("2d");
    x.fillStyle = "#ece8e1"; x.fillRect(0, 0, 512, 512);
    var seed = 23;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 16; i++) {
      x.strokeStyle = "rgba(96,92,90," + (0.08 + rnd() * 0.22) + ")";
      x.lineWidth = 0.6 + rnd() * 3.2;
      var y = rnd() * 512, dy = rnd() * 240 - 120;
      x.beginPath(); x.moveTo(-10, y);
      x.bezierCurveTo(140, y + dy * 0.2 + rnd() * 50, 330, y + dy * 0.7 - rnd() * 50, 522, y + dy);
      x.stroke();
    }
    for (var j = 0; j < 5; j++) {
      x.strokeStyle = "rgba(170,140,90," + (0.08 + rnd() * 0.1) + ")";
      x.lineWidth = 1 + rnd() * 2;
      var y2 = rnd() * 512;
      x.beginPath(); x.moveTo(-10, y2); x.bezierCurveTo(160, y2 - 60, 350, y2 + 80, 522, y2 + rnd() * 80 - 40); x.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.encoding = THREE.sRGBEncoding;
    texCache.marble = tex; return tex;
  }
  function seaTexture() {
    if (texCache.sea) return texCache.sea;
    var c = document.createElement("canvas"); c.width = 256; c.height = 256;
    var x = c.getContext("2d");
    var sky = x.createLinearGradient(0, 0, 0, 140);
    sky.addColorStop(0, "#7fbfe6"); sky.addColorStop(1, "#d9eef8");
    x.fillStyle = sky; x.fillRect(0, 0, 256, 140);
    var sea = x.createLinearGradient(0, 140, 0, 256);
    sea.addColorStop(0, "#2a7fae"); sea.addColorStop(1, "#0d4470");
    x.fillStyle = sea; x.fillRect(0, 140, 256, 116);
    x.strokeStyle = "rgba(255,255,255,0.35)"; x.lineWidth = 1.5;
    for (var i = 0; i < 9; i++) { var y = 150 + i * 11; x.beginPath(); x.moveTo(30 + (i * 37) % 120, y); x.lineTo(90 + (i * 53) % 140, y); x.stroke(); }
    var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    texCache.sea = tex; return tex;
  }
  Kit.prototype.tileWall = function (w, h, z, tileW, tileH, tileHex, groutHex) {
    var tex = tileTexture(tileHex, groutHex).clone(); tex.needsUpdate = true;
    tex.repeat.set(w / tileW, h / tileH);
    return this.wall(w, h, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, envMapIntensity: 0.5 }), z);
  };
  // An open-topped vessel (bath, basin): four walls and a floor, so it is really hollow.
  Kit.prototype.trough = function (L, D, H, t, x, y0, z, material) {
    this.box(L, H, t, material, x, y0 + H / 2, z + D / 2 - t / 2, 0.012);
    this.box(L, H, t, material, x, y0 + H / 2, z - D / 2 + t / 2, 0.012);
    this.box(t, H, D, material, x - L / 2 + t / 2, y0 + H / 2, z, 0.012);
    this.box(t, H, D, material, x + L / 2 - t / 2, y0 + H / 2, z, 0.012);
    this.box(L - 0.01, t, D - 0.01, material, x, y0 + t / 2, z, 0.008);
  };
  function brass() { return std("#c9a24a", 0.24, 1); }
  function clearGlass() {
    return new THREE.MeshStandardMaterial({ color: "#dcecf1", transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.2, envMapIntensity: 1.6, depthWrite: false });
  }

  SCENES.basin = {
    name: "Basin", area: "Bathroom", blurb: "A chip on a bathroom basin",
    floor: "tile", view: [0.5, 0.34, 1], sample: "#e3dccb",
    build: function (k) {
      k.tileWall(9, 3, -0.3, 0.3, 0.15, "#dfe6e6", "#aab2b2");
      var oak = k.surface("vanity", std("#b98c5a", 0.5)), stone = std("#2c2f32", 0.3), gold = brass();
      // wall-hung vanity
      k.box(0.9, 0.46, 0.46, oak, 0, 0.6, -0.04, 0.01);
      k.box(0.86, 0.2, 0.016, oak, 0, 0.705, 0.196, 0.004); k.box(0.86, 0.2, 0.016, oak, 0, 0.49, 0.196, 0.004);
      k.bar(0.3, 0, 0.76, 0.215, false, 0.006); k.bar(0.3, 0, 0.545, 0.215, false, 0.006);
      k.box(0.96, 0.03, 0.5, stone, 0, 0.845, -0.03, 0.006);
      // basin
      k.trough(0.58, 0.38, 0.13, 0.026, 0, 0.86, 0.0, k.paint);
      k.add(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 24), k.steel, 0, 0.889, 0);
      // tap
      k.bar(0.3, 0, 1.01, -0.22, true, 0.014);
      var sp = k.bar(0.15, 0, 1.15, -0.15, true, 0.011); sp.rotation.x = Math.PI / 2;
      // round mirror
      var mir = k.add(new THREE.CircleGeometry(0.34, 48), k.glass, 0, 1.62, -0.285); mir.castShadow = false;
      k.add(new THREE.TorusGeometry(0.345, 0.014, 12, 64), gold, 0, 1.62, -0.283);
      k.addPatch(0.12, 0.925, 0.1912, 0.03, "front", "Front of basin");
      k.addPatch(0.2912, 0.925, 0.0, 0.03, "side", "Side of basin");
      k.addPatch(0.25, 0.47, 0.2052, 0.04, "front", "Vanity drawer", "vanity");
    }
  };

  SCENES.shower = {
    name: "Shower tray", area: "Bathroom", blurb: "A crack repaired on a shower tray",
    floor: "slate", view: [0.5, 0.72, 1], zoom: 0.86, sample: "#d9dad6",
    build: function (k) {
      k.tileWall(9, 3, -0.5, 0.6, 0.3, "#c9d2d2", "#8f9999");
      var side = k.tileWall(4, 3, 0, 0.6, 0.3, "#c9d2d2", "#8f9999");
      side.rotation.y = Math.PI / 2; side.position.set(-0.66, 1.5, 0.6);
      // tray with a low rim
      k.box(1.3, 0.05, 0.95, k.paint, 0, 0.025, 0, 0.012);
      k.box(1.3, 0.016, 0.035, k.paint, 0, 0.058, 0.4575, 0.006); k.box(1.3, 0.016, 0.035, k.paint, 0, 0.058, -0.4575, 0.006);
      k.box(0.035, 0.016, 0.95, k.paint, 0.6325, 0.058, 0, 0.006); k.box(0.035, 0.016, 0.95, k.paint, -0.6325, 0.058, 0, 0.006);
      k.add(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 28), k.steel, -0.25, 0.053, -0.1);
      // glass screen
      var glass = clearGlass();
      var g1 = k.box(0.012, 1.9, 0.92, glass, 0.62, 1.02, 0, 0.002); g1.castShadow = false;
      var g2 = k.box(0.7, 1.9, 0.012, glass, 0.26, 1.02, 0.45, 0.002); g2.castShadow = false;
      k.box(1.3, 0.03, 0.03, k.steel, 0, 1.985, 0.45, 0.004); k.box(0.03, 0.03, 0.95, k.steel, 0.62, 1.985, 0, 0.004);
      k.bar(0.3, -0.06, 1.05, 0.47, true, 0.01);
      // riser and head
      k.bar(1.1, -0.2, 1.45, -0.46, true, 0.011);
      var arm = k.bar(0.26, -0.2, 2.0, -0.34, true, 0.01); arm.rotation.x = Math.PI / 2;
      k.add(new THREE.CylinderGeometry(0.11, 0.11, 0.014, 32), k.steel, -0.2, 1.985, -0.22);
      k.add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 24), k.steel, -0.2, 1.1, -0.47).rotation.x = Math.PI / 2;
      k.addPatch(0.2, 0.0512, 0.12, 0.06, "up", "Middle of tray");
      k.addPatch(-0.35, 0.0512, 0.28, 0.045, "up", "Near the edge");
    }
  };

  SCENES.floor = {
    name: "Floor tiles", area: "Floors", blurb: "One chipped tile matched to the rest",
    floor: "paving", view: [0.42, 0.6, 1], zoom: 0.92, sample: "#9c9486",
    build: function (k) {
      k.paint.clearcoat = 0.12; k.paint.roughness = 0.5;
      k.wall(12, 3, std("#dcd5c9", 0.95), -1.56);
      k.box(12, 0.12, 0.018, k.surface("trim", k.white), 0, 0.06, -1.55).userData.noFit = true;
      k.box(9.04, 0.008, 4.84, std("#6f6b64", 0.9), 0, 0.004, 0.9, 0.001).userData.noFit = true;
      for (var i = 0; i < 15; i++) for (var j = 0; j < 8; j++) {
        var t = k.box(0.594, 0.012, 0.594, k.paint, -4.2 + i * 0.6, 0.012, -1.2 + j * 0.6, 0.003);
        t.castShadow = false;
        if (i < 5 || i > 9 || j > 3) t.userData.noFit = true;
      }
      // a console table and a plant, for scale
      var oak = std("#a97d4f", 0.5);
      k.box(1.1, 0.035, 0.34, oak, -0.6, 0.78, -1.3, 0.008);
      [[-1.1, -1.42], [-0.1, -1.42], [-1.1, -1.18], [-0.1, -1.18]].forEach(function (p) { k.add(new THREE.CylinderGeometry(0.018, 0.014, 0.76, 12), oak, p[0], 0.39, p[1]); });
      k.add(new THREE.CylinderGeometry(0.16, 0.12, 0.3, 24), std("#b5674a", 0.8), 1.1, 0.168, -1.2);
      [[0, 0.62, 0, 0.26], [-0.14, 0.48, 0.05, 0.19], [0.15, 0.5, -0.04, 0.2], [0.02, 0.86, 0.03, 0.18]].forEach(function (s) {
        k.add(new THREE.SphereGeometry(s[3], 16, 12), std("#3f7a4b", 0.8), 1.1 + s[0], s[1], -1.2 + s[2]);
      });
      k.addPatch(0.3, 0.0192, 0.34, 0.07, "up", "Centre tile");
      k.addPatch(0.45, 0.0192, -0.9, 0.06, "up", "Tile by the wall");
      k.addPatch(0.2, 0.06, -1.5398, 0.03, "front", "Skirting board", "trim");
    }
  };

  SCENES.cubicles = {
    name: "Washroom cubicles", area: "Walls and panels", blurb: "A gouge in a laminate cubicle door",
    floor: "tile", view: [0.46, 0.14, 1], sample: "#2f6f78",
    build: function (k) {
      k.paint.clearcoat = 0.15; k.paint.roughness = 0.5;
      k.tileWall(9, 3, -1.6, 0.3, 0.6, "#e4e7e6", "#b4b9b8");
      var dw = 0.62, pw = 0.13, h = 1.85, leg = 0.15, grey = std("#c8ccce", 0.5);
      var total = dw * 3 + pw * 4, x = -total / 2;
      for (var i = 0; i < 4; i++) {
        var px = x + pw / 2 + i * (dw + pw);
        k.box(pw, h, 0.02, k.paint, px, leg + h / 2, 0, 0.004);
        k.add(new THREE.CylinderGeometry(0.014, 0.014, leg, 12), k.steel, px, leg / 2, 0);
        if (i < 3) {
          var dx = px + pw / 2 + dw / 2;
          k.box(dw - 0.012, h - 0.02, 0.02, k.paint, dx, leg + h / 2, 0.004, 0.004);
          k.add(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), k.steel, dx + dw / 2 - 0.07, 1.05, 0.02).rotation.x = Math.PI / 2;
        }
        var part = k.box(0.02, h, 1.5, grey, px, leg + h / 2, -0.76, 0.004);
      }
      k.box(total + 0.06, 0.045, 0.04, k.steel, 0, leg + h + 0.03, 0, 0.004);
      k.addPatch(0.02, 0.8, 0.0152, 0.065, "front", "Middle door");
      k.addPatch(0.75, 1.3, 0.0152, 0.06, "front", "End door");
      k.addPatch(-0.375, 1.0, 0.0112, 0.03, "front", "Pilaster");
    }
  };

  SCENES.stonecill = {
    name: "Stone window cill", area: "Brick and stone", blurb: "A chipped stone cill tinted to match",
    floor: "paving", view: [0.48, 0.2, 1], sample: "#c7baa0",
    build: function (k) {
      k.paint.clearcoat = 0; k.paint.roughness = 0.92; k.paint.envMapIntensity = 0.4;
      var w = 1.2, h = 1.3, y0 = 1.0, fr = 0.07;
      k.brickWall(9, 3.4, -0.05);
      k.box(w, fr, 0.06, k.white, 0, y0 + h - fr / 2, 0); k.box(w, fr, 0.06, k.white, 0, y0 + fr / 2, 0);
      k.box(fr, h, 0.06, k.white, -w / 2 + fr / 2, y0 + h / 2, 0); k.box(fr, h, 0.06, k.white, w / 2 - fr / 2, y0 + h / 2, 0);
      k.box(fr * 0.8, h, 0.06, k.white, 0, y0 + h / 2, 0);
      k.box(w - fr * 2, fr * 0.8, 0.06, k.white, 0, y0 + h * 0.68, 0);
      k.box(w - fr * 2 + 0.01, h - fr * 2 + 0.01, 0.01, k.glass, 0, y0 + h / 2, -0.012, 0.002);
      // stone cill and header
      k.box(w + 0.34, 0.1, 0.24, k.paint, 0, y0 - 0.05, 0.07, 0.01);
      k.box(w + 0.34, 0.18, 0.1, k.paint, 0, y0 + h + 0.09, 0.0, 0.008);
      k.addPatch(-0.32, y0 - 0.05, 0.1912, 0.032, "front", "Front of cill");
      k.addPatch(0.3, y0 + h + 0.09, 0.0512, 0.04, "front", "Header");
      k.addPatch(0.25, y0 + 0.0012, 0.12, 0.035, "up", "Top of cill");
    }
  };

  SCENES.bar = {
    name: "Cruise ship bar", area: "Marine", blurb: "A scuff on the front of a ship's cocktail bar",
    floor: "carpet", view: [0.5, 0.3, 1], zoom: 0.74, bg: "#1d1611", sample: "#17443c",
    build: function (k) {
      var gold = brass(), walnut = std("#3a281d", 0.45), dark = std("#17110d", 0.5);
      // panelled back wall with brass inlay and two portholes
      k.wall(16, 6, std("#33231a", 0.5), -1.5);
      for (var s = -8; s <= 8; s++) { var st = k.box(0.014, 5.6, 0.006, gold, s * 0.98, 2.8, -1.494, 0.002); st.userData.noFit = true; st.castShadow = false; }
      [-2.05, 2.05].forEach(function (x) {
        var sea = new THREE.Mesh(new THREE.CircleGeometry(0.27, 48), new THREE.MeshBasicMaterial({ map: seaTexture() }));
        sea.position.set(x, 1.72, -1.49); sea.userData.noFit = true; k.group.add(sea);
        k.add(new THREE.TorusGeometry(0.28, 0.04, 14, 64), gold, x, 1.72, -1.485, true);
      });
      // back bar: counter, mirror, shelves, bottles
      k.box(3.0, 0.9, 0.42, walnut, 0, 0.45, -1.27, 0.01);
      k.box(3.06, 0.03, 0.46, gold, 0, 0.915, -1.26, 0.006);
      var mir = k.add(new THREE.PlaneGeometry(2.7, 1.25), k.glass, 0, 1.72, -1.488); mir.castShadow = false;
      k.box(2.78, 0.04, 0.03, gold, 0, 2.36, -1.48); k.box(2.78, 0.04, 0.03, gold, 0, 1.08, -1.48);
      k.box(0.04, 1.32, 0.03, gold, -1.39, 1.72, -1.48); k.box(0.04, 1.32, 0.03, gold, 1.39, 1.72, -1.48);
      [1.42, 1.86].forEach(function (y) { k.box(2.6, 0.018, 0.2, gold, 0, y, -1.38, 0.004); });
      var cols = ["#7a4a1c", "#2f5d3a", "#cfdadd", "#5a1f24", "#1f3f6b", "#d9b25a", "#3b2a55"], seed = 5;
      function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
      [0.93, 1.43, 1.87].forEach(function (y, row) {
        for (var i = 0; i < 15; i++) {
          if (rnd() < 0.18) continue;
          var hh = 0.17 + rnd() * 0.09, r = 0.03 + rnd() * 0.012, bx = -1.2 + i * 0.17 + (rnd() - 0.5) * 0.03;
          var m = new THREE.MeshStandardMaterial({ color: cols[Math.floor(rnd() * cols.length)], roughness: 0.12, metalness: 0.25, envMapIntensity: 1.3 });
          k.add(new THREE.CylinderGeometry(r, r, hh, 16), m, bx, y + hh / 2 + 0.005, row === 0 ? -1.3 : -1.39);
          k.add(new THREE.CylinderGeometry(r * 0.35, r * 0.4, 0.07, 12), m, bx, y + hh + 0.04, row === 0 ? -1.3 : -1.39);
        }
      });
      // the bar itself: fluted painted front, marble top, brass rail
      k.box(3.2, 0.1, 0.5, dark, 0, 0.05, -0.02);
      k.box(3.2, 0.94, 0.58, walnut, 0, 0.57, 0, 0.008);
      k.box(3.2, 0.86, 0.02, k.paint, 0, 0.6, 0.296, 0.004);
      for (var f = 0; f < 44; f++) k.box(0.052, 0.84, 0.03, k.paint, -1.548 + f * 0.072, 0.6, 0.312, 0.012);
      k.box(3.2, 0.07, 0.014, gold, 0, 0.14, 0.305, 0.004);
      var mt = marbleTexture().clone(); mt.needsUpdate = true; mt.repeat.set(2.2, 0.5);
      k.box(3.38, 0.05, 0.74, new THREE.MeshStandardMaterial({ map: mt, roughness: 0.15, envMapIntensity: 0.9 }), 0, 1.068, 0.03, 0.012);
      k.box(3.3, 0.022, 0.66, gold, 0, 1.03, 0.02, 0.004);
      var rail = k.add(new THREE.CylinderGeometry(0.02, 0.02, 3.1, 20), gold, 0, 0.22, 0.44); rail.rotation.z = Math.PI / 2;
      [-1.4, -0.47, 0.47, 1.4].forEach(function (x) { k.add(new THREE.CylinderGeometry(0.011, 0.011, 0.22, 12), gold, x, 0.11, 0.44); });
      // beer font and glasses
      k.add(new THREE.CylinderGeometry(0.03, 0.035, 0.34, 20), gold, 1.05, 1.26, 0.02);
      var tb = k.add(new THREE.CylinderGeometry(0.022, 0.022, 0.4, 16), gold, 1.05, 1.43, 0.02); tb.rotation.z = Math.PI / 2;
      [0.92, 1.05, 1.18].forEach(function (x) { k.add(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 12), dark, x, 1.5, 0.05); });
      var cg = clearGlass(); cg.opacity = 0.35;
      [[-1.1, 0.12], [-0.95, 0.2], [0.2, 0.15]].forEach(function (p) { var gl = k.add(new THREE.CylinderGeometry(0.035, 0.028, 0.11, 18), cg, p[0], 1.15, p[1]); gl.castShadow = false; });
      // pendant lamps
      [-1.05, 0, 1.05].forEach(function (x) {
        var rod = k.add(new THREE.CylinderGeometry(0.004, 0.004, 0.95, 8), gold, x, 2.58, 0.05); rod.castShadow = false; rod.userData.noFit = true;
        k.add(new THREE.CylinderGeometry(0.03, 0.05, 0.05, 20), gold, x, 2.1, 0.05).castShadow = false;
        var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 18), new THREE.MeshStandardMaterial({ color: "#fff4dc", emissive: "#ffcf87", emissiveIntensity: 1.6, roughness: 0.4 }));
        lamp.position.set(x, 1.98, 0.05); k.group.add(lamp);
      });
      // stools
      var leather = std("#6c2a2a", 0.45);
      [-1.3, 0.5, 1.25].forEach(function (x) {
        k.add(new THREE.CylinderGeometry(0.19, 0.2, 0.02, 28), gold, x, 0.01, 0.95);
        k.add(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 14), gold, x, 0.33, 0.95);
        var ring = k.add(new THREE.TorusGeometry(0.15, 0.01, 8, 36), gold, x, 0.27, 0.95); ring.rotation.x = Math.PI / 2;
        k.add(new THREE.CylinderGeometry(0.18, 0.17, 0.085, 28), leather, x, 0.69, 0.95);
      });
      k.addPatch(-0.42, 0.62, 0.3285, 0.075, "front", "Bar front, left");
      k.addPatch(0.8, 0.5, 0.3285, 0.07, "front", "Bar front, right");
    }
  };

  var ORDER = ["bar", "kitchen", "worktop", "bath", "basin", "shower", "door", "frontdoor", "window", "stonecill", "floor", "cubicles", "drawers", "garage"];

  // ── Viewer ──
  function createViewer(canvas, opts) {
    opts = opts || {};
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(opts.pixelRatio || global.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.outputEncoding = THREE.sRGBEncoding;

    var scene = new THREE.Scene();
    var BG = new THREE.Color("#cfc9be");
    scene.background = BG;
    scene.fog = new THREE.Fog(BG, 9, 22);
    var pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;

    var camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 60);
    var key = new THREE.DirectionalLight(0xfff1dc, 0.82);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0003;
    key.shadow.normalBias = 0.006;
    key.shadow.radius = 3;
    scene.add(key); scene.add(key.target);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8ad9c, 0.16));

    var floorMats = {
      wood: (function () { var t = woodTexture().clone(); t.needsUpdate = true; t.repeat.set(60, 60); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.62, envMapIntensity: 0.35 }); })(),
      tile: std("#dcdfe0", 0.35),
      paving: std("#b9b6b0", 0.9),
      carpet: std("#1b2a44", 0.98),
      slate: std("#6b7177", 0.45)
    };
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMats.wood);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    scene.add(floor);

    var pivot = new THREE.Group(); scene.add(pivot);
    var current = null, kit = null, built = {};
    var rot = 0, vel = 0, dragging = false, lastX = 0, raf = 0, LIMIT = 0.62;
    var colour = new THREE.Color("#383e42"), patchColour = null, spotIndex = 0;
    var zoom = 1, ZOOM_MAX = 3.4, base = { c: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), dist: 5 };

    function frame() {
      if (!kit) return;
      var box = new THREE.Box3();
      kit.group.updateMatrixWorld(true);
      kit.group.traverse(function (o) { if (o.isMesh && !o.userData.noFit) box.expandByObject(o); });
      var c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
      var radius = size.length() / 2;
      var v = SCENES[current].view, dir = new THREE.Vector3(v[0], v[1], v[2]).normalize();
      var vfov = camera.fov * Math.PI / 180;
      var hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      var distH = (size.y / 2) / Math.tan(vfov / 2);
      var distW = (Math.hypot(size.x, size.z) / 2) / Math.tan(hfov / 2);
      var dist = (Math.max(distH, distW) * 1.3 + size.z / 2) * (SCENES[current].zoom || 1);
      pivot.position.set(c.x, 0, c.z);
      kit.group.position.set(-c.x, 0, -c.z);
      base.c.copy(c); base.dir.copy(dir); base.dist = dist;
      var side = v[0] >= 0 ? -1 : 1;
      key.position.set(c.x + side * radius * 1.5, c.y + radius * 2.3, c.z + radius * 1.9);
      key.target.position.copy(c);
      var sc = key.shadow.camera, s = radius * 1.8;
      sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 0.1; sc.far = radius * 8;
      sc.updateProjectionMatrix();
    }
    // The camera sits back at zoom 1 and closes on the active damage spot as you zoom in.
    function render() {
      pivot.rotation.y = rot;
      var target = base.c.clone();
      var sp = kit && kit.spots[spotIndex];
      if (sp && zoom > 1) {
        pivot.updateMatrixWorld(true);
        var p = sp.mesh.getWorldPosition(new THREE.Vector3());
        target.lerp(p, Math.min(1, (zoom - 1) / 1.2) * 0.92);
      }
      camera.position.copy(target).add(base.dir.clone().multiplyScalar(base.dist / zoom));
      camera.lookAt(target);
      renderer.render(scene, camera);
    }
    function setZoom(z) { zoom = Math.max(1, Math.min(ZOOM_MAX, z)); render(); return zoom; }
    function tick() {
      raf = 0;
      if (!dragging && Math.abs(vel) > 0.0004) {
        rot = Math.max(-LIMIT, Math.min(LIMIT, rot + vel)); vel *= 0.9;
        render(); raf = requestAnimationFrame(tick);
      }
    }
    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      frame(); render();
    }
    function applyColours() {
      if (!kit) return;
      var active = kit.spots[spotIndex] ? kit.spots[spotIndex].surface : "paint";
      Object.keys(kit.surfaces).forEach(function (name) {
        var sf = kit.surfaces[name];
        sf.mat.color.copy(name === active ? colour : sf.def);
      });
      kit.spots.forEach(function (sp, i) { sp.mesh.visible = !!patchColour && i === spotIndex; });
      if (patchColour) kit.patchMat.color.copy(patchColour);
    }
    function show(id, spot) {
      if (!SCENES[id]) return;
      if (kit) pivot.remove(kit.group);
      if (!built[id]) {
        var k = new Kit(); SCENES[id].build(k);
        k.surfaces.paint = { mat: k.paint, def: new THREE.Color(SCENES[id].sample) };
        built[id] = k;
      }
      kit = built[id]; current = id;
      pivot.add(kit.group);
      floor.material = floorMats[SCENES[id].floor] || floorMats.wood;
      var bg = new THREE.Color(SCENES[id].bg || "#cfc9be");
      scene.background = bg; scene.fog.color.copy(bg);
      rot = 0; vel = 0; zoom = 1;
      spotIndex = Math.max(0, Math.min(kit.spots.length - 1, spot || 0));
      applyColours(); frame(); render();
    }
    function setSpot(i) {
      if (!kit) return;
      spotIndex = Math.max(0, Math.min(kit.spots.length - 1, i));
      applyColours(); render();
    }
    function spots() { return kit ? kit.spots.map(function (sp) { return sp.label; }) : []; }
    // Where the active damage spot sits in the picture, as fractions of its width and height.
    function spotScreen() {
      var sp = kit && kit.spots[spotIndex];
      if (!sp) return null;
      pivot.updateMatrixWorld(true); camera.updateMatrixWorld(true);
      var p = sp.mesh.getWorldPosition(new THREE.Vector3()).project(camera);
      return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
    }
    function setColour(hex) { colour.set(hex); applyColours(); render(); }
    function setPatch(hex) { patchColour = hex ? new THREE.Color(hex) : null; applyColours(); render(); }
    function snapshot(type, quality) { render(); return canvas.toDataURL(type || "image/jpeg", quality || 0.85); }

    canvas.style.touchAction = "pan-y";
    var pinch = null, onZoom = opts.onZoom || function () {};
    canvas.addEventListener("pointerdown", function (e) { dragging = true; lastX = e.clientX; vel = 0; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ } });
    canvas.addEventListener("pointermove", function (e) {
      if (!dragging || pinch) return;
      var dx = e.clientX - lastX; lastX = e.clientX;
      vel = dx * 0.006; rot = Math.max(-LIMIT, Math.min(LIMIT, rot + vel));
      render();
    });
    function end() { if (!dragging) return; dragging = false; if (!raf) raf = requestAnimationFrame(tick); }
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("pointerleave", end);
    // Two fingers: pinch to zoom. The page must not scroll or zoom while that happens.
    function spread(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
    canvas.addEventListener("touchstart", function (e) {
      if (e.touches.length === 2) { pinch = { d: spread(e.touches), z: zoom }; dragging = false; vel = 0; e.preventDefault(); }
    }, { passive: false });
    canvas.addEventListener("touchmove", function (e) {
      if (pinch && e.touches.length === 2) { e.preventDefault(); onZoom(setZoom(pinch.z * spread(e.touches) / pinch.d)); }
    }, { passive: false });
    function endPinch(e) { if (e.touches.length < 2) pinch = null; }
    canvas.addEventListener("touchend", endPinch);
    canvas.addEventListener("touchcancel", endPinch);
    // Trackpad pinch arrives as ctrl + wheel.
    canvas.addEventListener("wheel", function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault(); onZoom(setZoom(zoom * Math.exp(-e.deltaY * 0.012)));
    }, { passive: false });

    return {
      show: show, setColour: setColour, setPatch: setPatch, setSpot: setSpot, spots: spots, spotScreen: spotScreen,
      zoom: setZoom, getZoom: function () { return zoom; },
      resize: resize, snapshot: snapshot, turn: function (r) { rot = r; render(); }, current: function () { return current; }
    };
  }

  /* Paint cans for the palette: an open tin showing its paint, rendered once per
     colour to a picture with a clear background. Returns one image address per
     colour, or null if 3D graphics are not available. */
  function renderCans(hexList, size) {
    var canvas = document.createElement("canvas"), renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); }
    catch (e) { return null; }
    var px = (size || 96) * 2;
    renderer.setPixelRatio(1); renderer.setSize(px, px, false);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputEncoding = THREE.sRGBEncoding;
    var scene = new THREE.Scene();
    var pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    var key = new THREE.DirectionalLight(0xfff4e4, 0.75); key.position.set(-1.6, 3, 2.4); scene.add(key);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8ad9c, 0.2));
    var cam = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    cam.position.set(0, 1.55, 2.95); cam.lookAt(0, -0.02, 0);

    var tin = new THREE.MeshStandardMaterial({ color: "#c7ccd2", roughness: 0.3, metalness: 1, envMapIntensity: 1.2 });
    var tinDark = new THREE.MeshStandardMaterial({ color: "#8d949c", roughness: 0.45, metalness: 1, side: THREE.BackSide });
    var paint = new THREE.MeshPhysicalMaterial({ color: "#888888", roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.9 });
    var label = new THREE.MeshStandardMaterial({ color: "#888888", roughness: 0.55, envMapIntensity: 0.45 });
    var can = new THREE.Group(); scene.add(can);
    function add(geo, mat, y) { var m = new THREE.Mesh(geo, mat); if (y != null) m.position.y = y; can.add(m); return m; }
    add(new THREE.CylinderGeometry(0.5, 0.5, 0.92, 64, 1, true), tin, 0);                 // body
    add(new THREE.CylinderGeometry(0.5, 0.5, 0.92, 64, 1, true), tinDark, 0);             // inside wall
    add(new THREE.CylinderGeometry(0.506, 0.506, 0.56, 64, 1, true), label, -0.02);       // colour band
    add(new THREE.CircleGeometry(0.5, 64), tin, -0.46).rotation.x = Math.PI / 2;          // base
    [0.46, -0.46].forEach(function (y) { add(new THREE.TorusGeometry(0.5, 0.032, 12, 64), tin, y).rotation.x = Math.PI / 2; });
    add(new THREE.TorusGeometry(0.455, 0.022, 10, 64), tin, 0.445).rotation.x = Math.PI / 2;   // lid seat
    add(new THREE.CircleGeometry(0.44, 64), paint, 0.36).rotation.x = -Math.PI / 2;       // the paint
    // a run of paint over the rim
    var drip = add(new THREE.SphereGeometry(0.07, 20, 16), paint, 0.36); drip.position.set(0.2, 0.36, 0.47); drip.scale.set(1, 2.3, 0.55);
    var drop = add(new THREE.SphereGeometry(0.06, 20, 16), paint, 0.2); drop.position.set(0.2, 0.2, 0.488); drop.scale.set(1, 1.2, 0.5);
    // wire handle and its ears
    var handle = add(new THREE.TorusGeometry(0.535, 0.013, 8, 48, Math.PI), tin, 0.26); handle.rotation.x = Math.PI / 2 + 0.95; handle.rotation.z = Math.PI;
    [-0.535, 0.535].forEach(function (x) { var e = add(new THREE.SphereGeometry(0.04, 14, 10), tin, 0.26); e.position.x = x; });
    can.rotation.y = -0.35;

    var out = hexList.map(function (hex) {
      paint.color.set(hex); label.color.set(hex);
      renderer.render(scene, cam);
      return canvas.toDataURL("image/png");
    });
    pm.dispose(); renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
    return out;
  }

  global.MarvScenes = {
    list: ORDER.map(function (id) { return { id: id, name: SCENES[id].name, area: SCENES[id].area, blurb: SCENES[id].blurb, sample: SCENES[id].sample }; }),
    createViewer: createViewer,
    renderCans: renderCans
  };
})(window);
