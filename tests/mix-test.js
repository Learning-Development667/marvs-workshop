/* Checks the mixing behaves like paint and that every job can be solved. */
const C = require('../js/colour.js'); const M = require('../js/mix.js');
let fail = 0; const ok = (name, cond, extra) => { if (!cond) fail++; console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  ' + extra : '')); };
const hex = rgb => C.toHex(rgb), lab = rgb => C.rgbToLab(rgb);

const green = M.mixColour({ CYAN: 3, YELLOW: 3 });
ok('cyan + yellow makes green', green[1] > green[0] && green[1] > green[2], hex(green));
const vg = M.mixColour({ PBX: 1, OYX: 6, TWX: 6 });
ok('phthalo blue + organic yellow + white makes green', vg[1] > vg[0] && vg[1] > vg[2], hex(vg));
const grey = M.mixColour({ LBX: 1, TWX: 12 });
ok('black + white makes a neutral grey', Math.max(...grey) - Math.min(...grey) < 12, hex(grey));
const dark = M.mixColour({ LBX: 2, TWX: 12 });
ok('more black is darker', lab(dark)[0] < lab(grey)[0]);
const pink = M.mixColour({ QRX: 2, TWX: 10 }), pinker = M.mixColour({ QRX: 2, TWX: 20 });
ok('more white is lighter', lab(pinker)[0] > lab(pink)[0], hex(pink) + ' -> ' + hex(pinker));
const strongTest = M.mixColour({ PBX: 1, YOX: 1 });
ok('a strong tint dominates a weak one', C.deltaRgb(M.mixColour({ PBX: 1, TWX: 10 }), M.mixColour({ TWX: 10 })) > C.deltaRgb(M.mixColour({ YOX: 1, TWX: 10 }), M.mixColour({ TWX: 10 })));
ok('empty mix has no colour', M.mixColour({}) === null);
ok('doubling every amount gives the same colour', C.deltaRgb(M.mixColour({ PBX: 1, TWX: 5, BUX: 2 }), M.mixColour({ PBX: 2, TWX: 10, BUX: 4 })) < 0.01);

let seed = 42; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const lv of M.LEVELS) {
  let worst = 0, n = 300, distinct = new Set(), minDrops = 99, maxDrops = 0;
  for (let i = 0; i < n; i++) {
    const job = M.makeJob(lv.id, null, rand);
    const j = M.judge(job.recipe, job.target, lv.id);
    worst = Math.max(worst, j.diff); distinct.add(hex(job.target));
    const d = M.drops(job.recipe); minDrops = Math.min(minDrops, d); maxDrops = Math.max(maxDrops, d);
    const ids = Object.keys(job.recipe), pal = M.palette(lv.id).map(t => t.id);
    if (!ids.every(id => pal.includes(id))) { fail++; console.log('FAIL recipe uses a colour outside the palette', lv.id, ids); }
  }
  ok(lv.name + ': every job is solvable with its own recipe', worst < 0.001, distinct.size + ' different colours in ' + n + ' jobs, ' + minDrops + ' to ' + maxDrops + ' drops');
}
const pale = M.makeJob('technician', rgb => lab(rgb)[0] > 75, rand);
ok('a scene can ask for a pale colour', lab(pale.target)[0] > 75, hex(pale.target) + '  ' + M.recipeText(pale.recipe));
const tgt = M.mixColour({ TWX: 10, LBX: 1, PBX: 1 });
console.log('hint examples:', JSON.stringify([M.hint({}, tgt), M.hint({ TWX: 10 }, tgt), M.hint({ TWX: 10, LBX: 2 }, tgt), M.hint({ TWX: 10, LBX: 1, PBX: 1 }, tgt)]));
ok('a too-light mix is told to go darker', /darker/.test(M.hint({ TWX: 10 }, tgt)));
// suggest(): can it find a mix for colours made from a hidden recipe?
{
  let seed2 = 99; const r2 = () => (seed2 = (seed2 * 16807) % 2147483647) / 2147483647;
  let within = 0, worst = 0, sumd = 0; const n = 60, t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const job = M.makeJob('technician', null, r2);
    const s = M.suggest(job.target, 'tints');
    worst = Math.max(worst, s.diff); sumd += s.diff; if (s.diff <= 4.8) within++;
    if (Object.keys(s.recipe).length > 5) { fail++; console.log('FAIL more than five colourants'); }
  }
  ok('suggest finds a Technician-level match for most made-up colours', within >= n * 0.85, within + ' of ' + n + ' within the Technician pass mark, mean diff ' + (sumd / n).toFixed(2) + ', worst ' + worst.toFixed(1) + ', ' + Math.round((Date.now() - t0) / n) + ' ms each');
  const grey = M.suggest([128, 128, 128], 'tints');
  ok('a mid grey comes out as white and black', grey.recipe.TWX > 0 && grey.recipe.LBX > 0, M.recipeText(grey.recipe) + ' -> ' + C.toHex(grey.colour) + ', ' + M.describe([128, 128, 128]));
  console.log('describe:', ['#383e42', '#f1ece1', '#17443c', '#c9b896', '#6b1c23', '#1a2b3c', '#e6d2b5', '#8c9c92'].map(h => h + ' ' + M.describe(C.fromHex(h))).join(' | '));
}
console.log(fail ? 'FAILED: ' + fail : 'All checks passed'); process.exit(fail ? 1 : 0);
