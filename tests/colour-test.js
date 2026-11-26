/* Checks the colour maths.
   1. ΔE2000 against published Sharma, Wu and Dalal test pairs.
   2. The photo correction against the 68 readings in the feasibility report
      (Appendix B): four photos of one sheet under very different light. */
const C = require('../js/colour.js');
let fail = 0;

const sharma = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630],
  [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082],
  [[90.8027, -2.0831, 1.4410], [91.1528, -1.6435, 0.0447], 1.4441]
];
sharma.forEach(([a, b, want], i) => {
  const got = C.deltaE(a, b);
  if (Math.abs(got - want) > 0.0002) { fail++; console.log('ΔE2000 pair', i + 1, 'FAIL got', got.toFixed(4), 'want', want); }
});
console.log('ΔE2000:', sharma.length, 'published pairs,', fail ? fail + ' failed' : 'all match to 4 decimal places');
const white = C.rgbToLab([255, 255, 255]), black = C.rgbToLab([0, 0, 0]);
console.log('white L* =', white[0].toFixed(2), ' black L* =', black[0].toFixed(2));
if (Math.abs(white[0] - 100) > 0.01 || Math.abs(black[0]) > 0.01) fail++;

// Appendix B: [desk, soft indoor, direct sun, shaded sun]
const N = [
  [[188.6, 177.8, 172.6], [230.9, 209.9, 188.9], [196.7, 207.7, 227.7], [166.1, 190.3, 236.2]],
  [[165.6, 160.0, 155.6], [206.7, 186.8, 169.1], [170.8, 179.2, 198.2], [146.8, 170.8, 216.8]],
  [[140.0, 137.0, 132.9], [170.2, 155.3, 136.4], [137.2, 144.8, 160.7], [122.9, 145.7, 187.2]],
  [[79.3, 78.3, 73.3], [110.4, 100.4, 88.4], [88.4, 94.1, 106.0], [80.6, 99.5, 131.6]],
  [[30.4, 29.5, 27.4], [67.9, 61.5, 53.6], [53.5, 57.5, 69.4], [56.7, 72.6, 100.9]],
  [[16.7, 16.4, 16.5], [63.4, 57.6, 53.6], [48.6, 54.5, 68.2], [52.4, 68.0, 96.8]],
  [[24.7, 22.7, 22.7], [67.0, 61.1, 57.4], [54.8, 60.9, 73.8], [55.2, 73.7, 106.0]]
];
const intended = [255, 217, 179, 128, 77, 38, 0];
const RAL = {
  '7003 Moss grey': [[83.6, 74.9, 73.4], [128.6, 104.0, 86.2], [100.9, 99.0, 100.2], [83.6, 92.6, 107.6]],
  '6028 Pine green': [[27.7, 43.0, 43.1], [69.7, 77.1, 62.2], [52.2, 71.8, 75.9], [43.7, 72.3, 86.3]],
  '6034 Pastel turquoise': [[110.3, 144.8, 154.6], [146.5, 157.5, 145.6], [115.6, 152.7, 170.6], [97.5, 145.4, 185.5]],
  '8022 Black brown': [[6.8, 8.8, 7.7], [54.1, 50.1, 40.6], [44.8, 49.1, 57.5], [45.7, 60.5, 84.5]],
  '7032 Pebble grey': [[169.0, 159.3, 149.2], [187.5, 160.0, 135.3], [154.0, 156.3, 162.2], [139.5, 160.8, 191.9]],
  '8002 Signal brown': [[79.3, 29.4, 32.2], [135.5, 69.5, 57.5], [102.9, 67.2, 70.9], [76.2, 55.5, 69.9]],
  '5021 Water blue': [[24.8, 76.0, 101.1], [62.9, 106.9, 116.0], [51.2, 107.7, 134.6], [37.0, 92.4, 133.2]],
  '1018 Zinc yellow': [[206.9, 166.5, 82.1], [238.9, 176.8, 61.5], [197.9, 169.4, 107.3], [158.8, 152.2, 109.8]],
  '6019 Pastel green': [[166.3, 177.8, 160.9], [190.2, 187.9, 149.1], [154.4, 178.6, 176.3], [127.8, 168.7, 196.6]],
  '7015 Slate grey': [[58.0, 46.3, 52.7], [103.4, 84.5, 80.2], [77.2, 82.6, 95.3], [69.0, 88.0, 120.0]]
};
const photos = ['desk', 'soft indoor', 'direct sun', 'shaded sun'];
const fits = photos.map((_, p) => C.fitCorrection(N.map((row, i) => ({ seen: row[p], truth: [intended[i], intended[i], intended[i]] }))));
fits.forEach((f, p) => console.log('  ' + photos[p] + ': fitted on ' + f.used + ' of ' + f.total + ' neutral patches (' + f.kind + ')'));

function spread(sets) {            // mean ΔE between every pair of photos
  let s = 0, n = 0;
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) { s += C.deltaRgb(sets[i], sets[j]); n++; }
  return s / n;
}
function report(label, idx) {
  let raw = 0, cor = 0, k = 0;
  for (const name in RAL) {
    raw += spread(idx.map(p => RAL[name][p]));
    cor += spread(idx.map(p => fits[p].apply(RAL[name][p])));
    k++;
  }
  console.log('  ' + label.padEnd(30) + ' raw ΔE ' + (raw / k).toFixed(1).padStart(5) + '   corrected ΔE ' + (cor / k).toFixed(1).padStart(5));
  return [raw / k, cor / k];
}
console.log('Photo correction, mean ΔE between photos of the same patch:');
const all = report('all four photos', [0, 1, 2, 3]);
const three = report('all except desk', [1, 2, 3]);
report('soft indoor vs direct sun', [1, 2]);
report('direct sun vs shaded sun', [2, 3]);
report('soft indoor vs shaded sun', [1, 3]);
if (!(all[1] < all[0] * 0.75)) { fail++; console.log('FAIL: correction did not tighten the spread across all four'); }
if (!(three[1] < three[0] * 0.5)) { fail++; console.log('FAIL: correction did not halve the spread across the three comparable photos'); }
// The colour row: does a colour matrix fitted from colour patches fix what greys cannot?
{
  const greysT = [244, 226, 207, 188, 169, 150, 131, 113].map(v => [v, v, v]);
  const coloursT = [[176, 64, 66], [214, 130, 52], [222, 196, 60], [86, 150, 82], [40, 136, 150], [64, 84, 160], [134, 86, 156], [196, 160, 128]];
  // a phone: white balance, tone curve, lifted shadows, boosted saturation and a slight hue twist
  const cams = [
    { gain: [1.14, 0.98, 0.76], gamma: 0.92, lift: 0.10, sat: 1.15, twist: 0.04 },
    { gain: [0.84, 0.98, 1.20], gamma: 0.95, lift: 0.14, sat: 1.25, twist: -0.05 },
    { gain: [1.04, 1.05, 1.12], gamma: 0.84, lift: 0.12, sat: 1.18, twist: 0.03 },
    { gain: [0.82, 0.76, 0.68], gamma: 1.06, lift: 0.06, sat: 1.08, twist: 0 }];
  const shoot = (rgb, c) => {
    let v = rgb.map((x, ch) => c.lift * 255 + (1 - c.lift) * C.linearToSrgb(c.gain[ch] * Math.pow(Math.max(1e-4, C.srgbToLinear(x)), c.gamma)));
    const y = 0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2];
    v = v.map(x => y + c.sat * (x - y));
    return [v[0] * (1 - c.twist) + v[1] * c.twist, v[1] * (1 - c.twist) + v[2] * c.twist, v[2] * (1 - c.twist) + v[0] * c.twist].map(x => Math.max(0, Math.min(255, x)));
  };
  let seed3 = 5; const r3 = () => (seed3 = (seed3 * 16807) % 2147483647) / 2147483647;
  const surfaces = Array.from({ length: 40 }, () => [40 + r3() * 190, 40 + r3() * 190, 40 + r3() * 190]);
  let gSum = 0, fSum = 0, n = 0, checks = [];
  cams.forEach(c => {
    const fit = C.fitFull(greysT.map(t => ({ seen: shoot(t, c), truth: t })), coloursT.map(t => ({ seen: shoot(t, c), truth: t })));
    checks.push(fit.check.toFixed(1));
    surfaces.forEach(t => { const seen = shoot(t, c); gSum += C.deltaRgb(fit.greyOnly(seen), t); fSum += C.deltaRgb(fit.apply(seen), t); n++; });
  });
  console.log('Colour row on 40 surfaces x 4 simulated phones: greys only ΔE ' + (gSum / n).toFixed(2) + ', greys then colour ΔE ' + (fSum / n).toFixed(2) + ', card check per photo ' + checks.join(', '));
  if (!(fSum < gSum * 0.75)) { fail++; console.log('FAIL: the colour row did not improve the correction'); }
}
console.log(fail ? 'FAILED: ' + fail : 'All checks passed');
process.exit(fail ? 1 : 0);
