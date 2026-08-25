/* ============================================================================
 * Calibrate each species' sCrit so senescence completes on a target date.
 *   node calibrate-species.js
 *
 * NOT a fit to observed data — there is no open coloration record for the
 * Wasatch equivalent to Harvard Forest's HF003. This is a bisection onto target
 * dates taken from USU Forestry Extension's qualitative description of Utah's
 * colour sequence, which is why the sCrit values are tagged [GUESS] and not
 * [TUNE]. Re-run this after changing the temperature baseline, T_SEN_C, X_SEN,
 * or any species' pSen / ySen — sCrit is scale-dependent on all of them.
 *
 * Targets (USU Extension, "Fall Color in Utah"):
 *   high-country aspen starts turning mid-September, peaks late September
 *   lower canyons (bigtooth maple, Gambel oak) peak the first two weeks of Oct
 * ==========================================================================*/

var M = require('./model.js');

var TARGETS = {
  aspen:         265,   // Sep 22
  bigtoothMaple: 280,   // Oct  7
  gambelOak:     287    // Oct 14
};

// Mean DOY at which a cohort of this species reaches full senescence, with
// sCrit temporarily overridden. Averaged over several weather seeds so we are
// not calibrating to one lucky year.
function completionDoy(key, sCrit, seeds) {
  var saved = M.SPECIES[key].sCrit;
  M.SPECIES[key].sCrit = sCrit;
  var acc = [];
  seeds.forEach(function (seed) {
    var s = M.createSim({ cols: 12, rows: 8, mix: [key], seed: seed });
    s.reset();
    var hit = null;
    while (s.step()) {
      // Use attached leaves only; once leaves start dropping the mean is over a
      // survivor population, so take the first crossing.
      if (hit === null && s.stats(key).senescence >= 0.98) hit = s.doy;
    }
    if (hit !== null) acc.push(hit);
  });
  M.SPECIES[key].sCrit = saved;
  if (!acc.length) return null;
  return acc.reduce(function (a, b) { return a + b; }, 0) / acc.length;
}

var SEEDS = [11, 202, 3003, 40004, 55];

function bisect(key, target) {
  var lo = 50, hi = 6000;
  // completionDoy is monotonically increasing in sCrit.
  for (var i = 0; i < 34; i++) {
    var mid = (lo + hi) / 2;
    var got = completionDoy(key, mid, SEEDS);
    if (got === null || got > target) hi = mid; else lo = mid;
  }
  return Math.round((lo + hi) / 2);
}

console.log('Calibrating sCrit against target completion dates');
console.log('site: Wasatch montane, lat ' + M.DEFAULT_CONTROLS.latitude +
            ', winterPrecip ' + M.DEFAULT_CONTROLS.winterPrecip + '\n');

var out = {};
Object.keys(TARGETS).forEach(function (key) {
  var target = TARGETS[key];
  var fitted = bisect(key, target);
  var achieved = completionDoy(key, fitted, SEEDS);
  out[key] = fitted;
  console.log('  ' + M.SPECIES[key].name.padEnd(16) +
    'target ' + M.doyToLabel(target).padEnd(7) +
    '  sCrit ' + String(fitted).padStart(5) +
    '  -> mean completion ' + (achieved === null ? 'never' : M.doyToLabel(Math.round(achieved))) +
    '   (current in model.js: ' + M.SPECIES[key].sCrit + ')');
});

console.log('\nPaste into model.js SPECIES table:');
Object.keys(out).forEach(function (k) {
  console.log('  ' + k + ': sCrit ' + out[k]);
});
