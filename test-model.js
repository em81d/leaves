/* ============================================================================
 * Phase 1 validation harness. `node test-model.js`
 *
 * plan.md Phase 1: "run a simulated season for a single leaf of each species and
 * print out its pigment values and fall-day, confirm the shapes look sane
 * (e.g. oak should not turn bright red; a frost event should visibly spike
 * browning)."
 *
 * Phase 3 checks are asserted against the validation targets in
 * leaf-phenology-data.md §3.7 and §5.
 * ==========================================================================*/

var M = require('./model.js');

var pass = 0, fail = 0;
function check(label, ok, detail) {
  if (ok) { pass++; console.log('  PASS  ' + label); }
  else    { fail++; console.log('  FAIL  ' + label + (detail ? '  -> ' + detail : '')); }
}
function hr(t) { console.log('\n' + t + '\n' + '='.repeat(t.length)); }

/* -------------------------------------------------------------------------
 * A. Astronomy — must reproduce the computed table in §2.
 * ---------------------------------------------------------------------- */
hr('A. Photoperiod (lat 42.54 N) vs leaf-phenology-data.md table 2');
var expected = [[173, 15.31], [244, 13.22], [266, 12.18], [288, 11.14], [305, 10.37], [335, 9.32]];
expected.forEach(function (e) {
  var got = M.dayLength(e[0], 42.54);
  check('DOY ' + e[0] + ' daylength ' + got.toFixed(2) + ' h (expect ' + e[1] + ')',
        Math.abs(got - e[1]) < 0.02, 'off by ' + (got - e[1]).toFixed(3));
});

/* -------------------------------------------------------------------------
 * B. Single-leaf season trace per species.
 * ---------------------------------------------------------------------- */
function traceSpecies(key, controls, seed) {
  var rng = M.makeRng(seed == null ? 7 : seed);
  var leaf = M.makeLeaf(key, M.makeRng(99));
  var c = Object.assign({}, M.DEFAULT_CONTROLS, controls || {});
  var rows = [];
  var peakAntho = 0, peakAnthoDoy = null;
  var chl50Doy = null, sen50Doy = null;

  for (var d = 0; d < M.SEASON_DAYS; d++) {
    var doy = M.START_DOY + d;
    var env = M.makeEnvironment(doy, c, rng);
    M.stepLeaf(leaf, env, rng);
    if (leaf.anthocyanin > peakAntho) { peakAntho = leaf.anthocyanin; peakAnthoDoy = doy; }
    if (chl50Doy === null && leaf.chlorophyll < 0.5) chl50Doy = doy;
    if (sen50Doy === null && leaf.senescence >= 0.5) sen50Doy = doy;
    if (d % 7 === 0 || (leaf.fellOnDoy === doy)) {
      rows.push({ doy: doy, env: env, leaf: JSON.parse(JSON.stringify(leaf)) });
    }
    if (!leaf.attached) break;
  }
  return {
    key: key, leaf: leaf, rows: rows,
    peakAntho: peakAntho, peakAnthoDoy: peakAnthoDoy,
    chl50Doy: chl50Doy, sen50Doy: sen50Doy
  };
}

function printTrace(t) {
  console.log('\n--- ' + M.SPECIES[t.key].name + ' -------------------------------------------');
  console.log('  date    L(h)  Tmin   sun   sen   chl   car   ant   tan   attached');
  t.rows.forEach(function (r) {
    var l = r.leaf, e = r.env;
    console.log('  ' + M.doyToLabel(r.doy).padEnd(7) +
      e.dayLength.toFixed(2).padStart(5) +
      e.tMin.toFixed(1).padStart(6) +
      e.sun.toFixed(2).padStart(6) +
      l.senescence.toFixed(2).padStart(6) +
      l.chlorophyll.toFixed(2).padStart(6) +
      l.carotenoid.toFixed(2).padStart(6) +
      l.anthocyanin.toFixed(2).padStart(6) +
      l.tannin.toFixed(2).padStart(6) +
      (l.attached ? '   yes' : '    NO'));
  });
  console.log('  chlorophyll < 0.5 on : ' + (t.chl50Doy ? M.doyToLabel(t.chl50Doy) : 'never'));
  console.log('  senescence >= 0.5 on : ' + (t.sen50Doy ? M.doyToLabel(t.sen50Doy) : 'never'));
  console.log('  peak anthocyanin     : ' + t.peakAntho.toFixed(2) +
              (t.peakAnthoDoy ? ' on ' + M.doyToLabel(t.peakAnthoDoy) : ''));
  console.log('  fell on              : ' +
              (t.leaf.fellOnDoy ? M.doyToLabel(t.leaf.fellOnDoy) : 'still attached'));
}

hr('B. Single-leaf season trace, default controls');
var tm = traceSpecies('bigtoothMaple');
var to = traceSpecies('gambelOak');
var tb = traceSpecies('aspen');
[tm, to, tb].forEach(printTrace);

hr('B. Assertions — species ordering and pigment shapes');
check('aspen reaches 50% senescence before Gambel oak',
      tb.sen50Doy !== null && to.sen50Doy !== null && tb.sen50Doy < to.sen50Doy,
      'aspen ' + tb.sen50Doy + ' vs oak ' + to.sen50Doy);
check('aspen loses chlorophyll before maple, maple before oak',
      tb.chl50Doy < tm.chl50Doy && tm.chl50Doy < to.chl50Doy,
      'aspen ' + tb.chl50Doy + ', maple ' + tm.chl50Doy + ', oak ' + to.chl50Doy);
check('bigtooth maple is the reddest', tm.peakAntho > to.peakAntho && tm.peakAntho > tb.peakAntho,
      'maple ' + tm.peakAntho.toFixed(2) + ', oak ' + to.peakAntho.toFixed(2) +
      ', aspen ' + tb.peakAntho.toFixed(2));
check('Gambel oak is red-orange but still short of maple', to.peakAntho < tm.peakAntho,
      'oak peak antho ' + to.peakAntho.toFixed(2));
check('aspen reads yellow, with only a hint of orange-red', tb.peakAntho < 0.30,
      'aspen peak antho ' + tb.peakAntho.toFixed(2));
check('bigtooth maple develops a strong red in a default season', tm.peakAntho > 0.45,
      'maple peak antho ' + tm.peakAntho.toFixed(2));

/* -------------------------------------------------------------------------
 * C. Grid-level behaviour and environmental sensitivity.
 * ---------------------------------------------------------------------- */
function runSeason(controls, opts) {
  var sim = M.createSim(Object.assign({ cols: 24, rows: 14, seed: 4242 }, opts || {}));
  Object.assign(sim.controls, controls || {});
  sim.reset();
  var peak = { bigtoothMaple: 0, gambelOak: 0, aspen: 0 };
  var half = null;
  while (sim.step()) {
    ['bigtoothMaple', 'gambelOak', 'aspen'].forEach(function (k) {
      var s = sim.stats(k);
      if (s.anthocyanin > peak[k]) peak[k] = s.anthocyanin;
    });
    if (half === null && sim.stats().fallenFrac >= 0.5) half = sim.doy;
  }
  return { sim: sim, peakAntho: peak, half50Doy: half, final: sim.stats() };
}

hr('C. Whole-grid season, default controls');
var base = runSeason();
console.log('  50% of leaves down on : ' +
            (base.half50Doy ? M.doyToLabel(base.half50Doy) : 'never'));
console.log('  final fallen fraction : ' + (base.final.fallenFrac * 100).toFixed(1) + '%');
['bigtoothMaple', 'gambelOak', 'aspen'].forEach(function (k) {
  var s = base.sim.stats(k);
  console.log('  ' + M.SPECIES[k].name.padEnd(15) + ' fallen ' +
              (s.fallenFrac * 100).toFixed(1).padStart(5) + '%   peak antho ' +
              base.peakAntho[k].toFixed(2));
});

check('50% leaf-off lands in Oct-Nov (season is tightly clocked, §3.7)',
      base.half50Doy !== null && base.half50Doy >= 274 && base.half50Doy <= 330,
      'DOY ' + base.half50Doy);
check('Gambel oak retains leaves at season end (marcescence, §6.1)',
      base.sim.stats('gambelOak').fallenFrac < 0.85,
      'oak fallen ' + (base.sim.stats('gambelOak').fallenFrac * 100).toFixed(1) + '%');
check('maple and aspen drop nearly everything',
      base.sim.stats('bigtoothMaple').fallenFrac > 0.9 && base.sim.stats('aspen').fallenFrac > 0.9,
      'maple ' + base.sim.stats('bigtoothMaple').fallenFrac.toFixed(2) +
      ', aspen ' + base.sim.stats('aspen').fallenFrac.toFixed(2));

/* --- Wind must not strip a healthy summer canopy. --------------------- */
hr('C. Wind gated on biological readiness (the NetLogo fix, §7)');
// Compare DATES, not final fractions: both a calm and a gale season end with
// the canopy down, so the final fraction saturates and cannot distinguish them.
function windSeason(windMean) {
  var s = M.createSim({ cols: 20, rows: 10, seed: 11 });
  s.controls.windMean = windMean;
  s.reset();
  var augFallen = 0, half = null;
  while (s.step()) {
    if (s.doy === 243) augFallen = s.stats().fallenFrac;        // Aug 31
    if (half === null && s.stats().fallenFrac >= 0.5) half = s.doy;
  }
  return { augFallen: augFallen, half50Doy: half, final: s.stats().fallenFrac };
}
var calm = windSeason(1.0);
var gale = windSeason(12.0);
console.log('  calm season (1 m/s)  : 50% down ' + M.doyToLabel(calm.half50Doy) +
            ', Aug 31 fallen ' + (calm.augFallen * 100).toFixed(2) + '%');
console.log('  gale season (12 m/s) : 50% down ' + M.doyToLabel(gale.half50Doy) +
            ', Aug 31 fallen ' + (gale.augFallen * 100).toFixed(2) + '%');
check('a 12 m/s gale strips ~nothing in August', gale.augFallen < 0.01,
      (gale.augFallen * 100).toFixed(2) + '% fell');
check('but that gale does bring leaf-off forward',
      gale.half50Doy < calm.half50Doy,
      'gale ' + gale.half50Doy + ' vs calm ' + calm.half50Doy);

/* --- Sunny + cool should beat cloudy + cool on redness. -------------- */
hr('C. Sunny-and-cool vs cloudy-and-cool (Phase 3 target)');
var sunnyCool = runSeason({ cloudCover: 5,  tempOffset: -1 });
var cloudyCool = runSeason({ cloudCover: 90, tempOffset: -1 });
console.log('  maple peak antho, sunny  (5% cloud) : ' + sunnyCool.peakAntho.bigtoothMaple.toFixed(2));
console.log('  maple peak antho, cloudy (90% cloud): ' + cloudyCool.peakAntho.bigtoothMaple.toFixed(2));
check('sunny+cool is visibly redder than cloudy+cool',
      sunnyCool.peakAntho.bigtoothMaple > cloudyCool.peakAntho.bigtoothMaple * 1.4,
      sunnyCool.peakAntho.bigtoothMaple.toFixed(2) + ' vs ' + cloudyCool.peakAntho.bigtoothMaple.toFixed(2));

/* --- Warm season should delay, and only modestly (§5). --------------- */
hr('C. Temperature sensitivity vs §5 (should be a SMALL shift)');
var warm = runSeason({ tempOffset: 3 });
var cold = runSeason({ tempOffset: -3 });
console.log('  50% leaf-off, +3 C : ' + (warm.half50Doy ? M.doyToLabel(warm.half50Doy) : 'never'));
console.log('  50% leaf-off,  0 C : ' + (base.half50Doy ? M.doyToLabel(base.half50Doy) : 'never'));
console.log('  50% leaf-off, -3 C : ' + (cold.half50Doy ? M.doyToLabel(cold.half50Doy) : 'never'));
check('warmer season delays leaf-off',
      warm.half50Doy !== null && warm.half50Doy > base.half50Doy,
      'warm ' + warm.half50Doy + ' vs base ' + base.half50Doy);
check('cooler season advances leaf-off',
      cold.half50Doy !== null && cold.half50Doy < base.half50Doy,
      'cold ' + cold.half50Doy + ' vs base ' + base.half50Doy);
var span = (warm.half50Doy || 0) - (cold.half50Doy || 0);
console.log('  total span across 6 C : ' + span + ' days');
check('6 C of forcing moves leaf-off by < 5 weeks (§5: effects partly cancel)',
      span > 0 && span < 35, span + ' days');

/* --- Antecedent winter precipitation: the western primary driver. ----- */
hr('C. Antecedent Jan-Mar precipitation (Li, Donnelly & Wang 2026)');
function wpSeason(wp, key) {
  var acc = [];
  [11, 202, 3003, 40004, 55].forEach(function (seed) {
    var s = M.createSim({ cols: 12, rows: 8, mix: [key], seed: seed });
    s.controls.winterPrecip = wp;
    s.reset();
    var hit = null;
    while (s.step()) {
      if (hit === null && s.stats(key).senescence >= 0.98) hit = s.doy;
    }
    if (hit !== null) acc.push(hit);
  });
  return acc.length ? acc.reduce(function (a, b) { return a + b; }, 0) / acc.length : null;
}
// Measured at senescence completion, which is the level sCrit acts on. Leaf-off
// is a poor probe here — abscission and frost both sit downstream and compress
// the signal, which is exactly how this driver looked inert at first.
['aspen', 'bigtoothMaple', 'gambelOak'].forEach(function (k) {
  var dry = wpSeason(0.0, k), norm = wpSeason(1.0, k), wet = wpSeason(2.0, k);
  console.log('  ' + M.SPECIES[k].name.padEnd(15) +
    'dry ' + M.doyToLabel(Math.round(dry)).padEnd(8) +
    'normal ' + M.doyToLabel(Math.round(norm)).padEnd(8) +
    'wet ' + M.doyToLabel(Math.round(wet)).padEnd(8) +
    ' span ' + Math.round(wet - dry) + ' d');
  check(M.SPECIES[k].name + ': wet winter delays senescence, dry advances it',
        dry < norm && norm <= wet, 'dry ' + dry + ', normal ' + norm + ', wet ' + wet);
});
// Emergent, not designed: the wet-side delay runs into the mid-October frost
// wall, so early species express the antecedent signal fully and late ones get
// truncated.
var spanAspen = wpSeason(2.0, 'aspen') - wpSeason(0.0, 'aspen');
var spanOak   = wpSeason(2.0, 'gambelOak') - wpSeason(0.0, 'gambelOak');
check('the winter signal is clipped more for later species (frost wall)',
      spanAspen > spanOak * 1.8,
      'aspen span ' + Math.round(spanAspen) + ' d vs oak span ' + Math.round(spanOak) + ' d');
check('a dry winter also dulls the colour (drought -> less sugar, §3.5)',
      (function () {
        function peak(wp) {
          var s = M.createSim({ cols: 14, rows: 10, mix: ['bigtoothMaple'], seed: 4242 });
          s.controls.winterPrecip = wp; s.reset();
          var p = 0;
          while (s.step()) p = Math.max(p, s.stats('bigtoothMaple').anthocyanin);
          return p;
        }
        var d = peak(0.0), n = peak(1.0);
        console.log('  maple peak antho: dry winter ' + d.toFixed(2) +
                    ', normal ' + n.toFixed(2));
        return d < n * 0.85;
      })());

/* --- Latitude gradient. ---------------------------------------------- */
hr('C. Latitude gradient (photoperiod + continental lapse)');
// Averaged over several weather seeds. A single seed made this flaky: peak
// anthocyanin swings ~0.2 between years, which is enough to reorder adjacent
// latitudes and break the assertions for no real reason.
function latSeason(lat) {
  var halves = [], peaks = [];
  [11, 202, 3003, 40004, 55].forEach(function (seed) {
    var s = M.createSim({ cols: 14, rows: 10, mix: ['bigtoothMaple'], seed: seed });
    s.controls.latitude = lat;
    s.reset();
    var half = null, peak = 0;
    while (s.step()) {
      var st = s.stats('bigtoothMaple');
      if (st.anthocyanin > peak) peak = st.anthocyanin;
      if (half === null && st.fallenFrac >= 0.5) half = s.doy;
    }
    peaks.push(peak);
    if (half !== null) halves.push(half);
  });
  var mean = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; };
  return {
    half50Doy: halves.length ? Math.round(mean(halves)) : null,
    peakAntho: mean(peaks)
  };
}
// Sweep 30-46 N, not 30-55. The baseline is now a 2100 m montane site, so
// latitude stacks on top of an elevation that already supplies most of the cold.
// Past ~44 N the combination is above these species' actual range — first freeze
// lands in early September, before any chlorophyll has degraded, so anthocyanin
// latches off at zero and every season is just brown. That is the frost latch
// behaving correctly, but it makes a cliff rather than a gradient.
var lats = [30, 34, 38, 42, 46].map(function (L) {
  var r = latSeason(L);
  console.log('  ' + String(L).padStart(3) + ' N : 50% leaf-off ' +
    (r.half50Doy ? M.doyToLabel(r.half50Doy) : 'never').padEnd(8) +
    '  peak antho ' + r.peakAntho.toFixed(2));
  return Object.assign({ lat: L }, r);
});
check('higher latitude turns earlier (was inverted before the lapse fix)',
      lats[0].half50Doy > lats[2].half50Doy && lats[2].half50Doy > lats[4].half50Doy,
      lats.map(function (r) { return r.lat + ':' + r.half50Doy; }).join(' '));
// Emergent, not hard-coded: warm southern autumns are dull, and cold northern
// ones are dull too because freezing latches anthocyanin off before chlorophyll
// degradation finishes. The brilliant band sits in the middle.
//
// Under the montane baseline that band sits at 34-38 N, not 45-50 N as it did
// for the New England baseline. Elevation supplies the cold that latitude used
// to, so the whole gradient shifts equatorward — which is why bigtooth maple's
// real range is the southern and central Rockies rather than New England's.
var mid = Math.max(lats[2].peakAntho, lats[3].peakAntho);
check('a mid-latitude colour sweet spot emerges (dull south AND dull north)',
      mid > lats[0].peakAntho * 1.4 && mid > lats[4].peakAntho * 1.4,
      '30N ' + lats[0].peakAntho.toFixed(2) + ', 38-42N ' + mid.toFixed(2) +
      ', 46N ' + lats[4].peakAntho.toFixed(2));
// The strongest single validation available for this site. Nothing in the model
// knows where it was calibrated: the temperature baseline is a bare sinusoid,
// the species table holds no coordinates. Yet sweeping latitude puts the colour
// optimum at 38-42 N, bracketing the 40.65 N reference site — and that is also
// bigtooth maple's real prime range in the central Rockies.
check('the colour optimum brackets the reference latitude (' +
      M.DEFAULT_CONTROLS.latitude + ' N)',
      lats[2].peakAntho > lats[1].peakAntho && lats[3].peakAntho > lats[4].peakAntho,
      '34N ' + lats[1].peakAntho.toFixed(2) + ', 38N ' + lats[2].peakAntho.toFixed(2) +
      ', 42N ' + lats[3].peakAntho.toFixed(2) + ', 46N ' + lats[4].peakAntho.toFixed(2));

/* --- Frost must spike browning discretely. --------------------------- */
hr('D. Frost is a discrete event, not a gradual curve (§3.3)');
var frostRng = M.makeRng(5);
var fleaf = M.makeLeaf('bigtoothMaple', M.makeRng(3));
var c = Object.assign({}, M.DEFAULT_CONTROLS);
var beforeTan = null, afterTan = null, freezeDoy = null;
// Trigger on STATE, not a hard-coded date: fire the freeze the first day the
// leaf is genuinely mid-colour. A fixed date silently stopped testing anything
// when the site moved west and the whole season shifted three weeks earlier —
// Oct 1 went from mid-transition to already-finished, so the "jump" was just
// the clamp at 1.0.
for (var d = 0; d < M.SEASON_DAYS; d++) {
  var doy = M.START_DOY + d;
  var env = M.makeEnvironment(doy, c, frostRng);
  var midColour = freezeDoy === null &&
                  fleaf.senescence > 0.30 && fleaf.senescence < 0.55;
  if (midColour) {
    env.tMin = -5; env.hardFreeze = true; env.lightFrost = false;
    beforeTan = { tan: fleaf.tannin, chl: fleaf.chlorophyll, sen: fleaf.senescence };
  }
  M.stepLeaf(fleaf, env, frostRng);
  if (midColour) {
    afterTan = { tan: fleaf.tannin, chl: fleaf.chlorophyll, sen: fleaf.senescence };
    freezeDoy = doy;
  }
  if (!fleaf.attached) break;
}
console.log('  injected hard freeze on ' + M.doyToLabel(freezeDoy) +
            ' (Tmin -5 C), at senescence ' + beforeTan.sen.toFixed(2));
console.log('  tannin      ' + beforeTan.tan.toFixed(3) + ' -> ' + afterTan.tan.toFixed(3));
console.log('  chlorophyll ' + beforeTan.chl.toFixed(3) + ' -> ' + afterTan.chl.toFixed(3));
console.log('  senescence  ' + beforeTan.sen.toFixed(3) + ' -> ' + afterTan.sen.toFixed(3));
check('hard freeze spikes tannin in a single day', afterTan.tan - beforeTan.tan > 0.25,
      'delta ' + (afterTan.tan - beforeTan.tan).toFixed(3));
check('hard freeze drops chlorophyll sharply', afterTan.chl < beforeTan.chl * 0.75,
      beforeTan.chl.toFixed(3) + ' -> ' + afterTan.chl.toFixed(3));
check('hard freeze jumps the senescence clock', afterTan.sen - beforeTan.sen > 0.3,
      'delta ' + (afterTan.sen - beforeTan.sen).toFixed(3));

/* --- Freeze latches anthocyanin synthesis off. ----------------------- */
var fl2 = M.makeLeaf('bigtoothMaple', M.makeRng(3));
var r2 = M.makeRng(5);
// Also state-triggered: inject the frost while anthocyanin is still actively
// climbing, then confirm it never rises again. Track the max after the freeze
// rather than sampling one later day, so a leaf that falls early cannot make
// this vacuously pass (or crash on a null).
var anthoAtFreeze = null, anthoMaxAfter = null, latchDoy = null, daysAfter = 0;
for (var d2 = 0; d2 < M.SEASON_DAYS; d2++) {
  var doy2 = M.START_DOY + d2;
  var env2 = M.makeEnvironment(doy2, c, r2);
  if (latchDoy === null && fl2.anthocyanin > 0.06) {
    env2.tMin = -1; env2.lightFrost = true; env2.hardFreeze = false;
    anthoAtFreeze = fl2.anthocyanin;
    latchDoy = doy2;
  }
  M.stepLeaf(fl2, env2, r2);
  if (latchDoy !== null && doy2 > latchDoy) {
    daysAfter++;
    anthoMaxAfter = Math.max(anthoMaxAfter === null ? 0 : anthoMaxAfter, fl2.anthocyanin);
  }
  if (!fl2.attached) break;
}
check('freezing permanently halts anthocyanin synthesis (§3.2)',
      anthoAtFreeze !== null && anthoMaxAfter !== null && daysAfter >= 10 &&
      anthoMaxAfter <= anthoAtFreeze + 1e-9,
      latchDoy === null ? 'anthocyanin never got going' :
      'frost on ' + M.doyToLabel(latchDoy) + ' at ' + anthoAtFreeze.toFixed(3) +
      ', max over the following ' + daysAfter + ' d was ' +
      (anthoMaxAfter === null ? 'n/a' : anthoMaxAfter.toFixed(3)));

/* -------------------------------------------------------------------------
 * E. Initial colour variance — by species and by individual leaf.
 * ---------------------------------------------------------------------- */
hr('E. Initial green varies by species AND by leaf');
var vsim = M.createSim({ cols: 24, rows: 14, seed: 12345 });
function parseRgb(c) { return (c.match(/\d+/g) || []).map(Number); }
function luminance(p) { return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; }
function meanOf(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
function sdOf(a) {
  var m = meanOf(a);
  return Math.sqrt(meanOf(a.map(function (v) { return (v - m) * (v - m); })));
}

var bySpecies = {};
vsim.mix.forEach(function (k) {
  var lums = vsim.leaves.filter(function (l) { return l.species === k; })
                        .map(function (l) { return luminance(parseRgb(M.leafColor(l))); });
  bySpecies[k] = { mean: meanOf(lums), sd: sdOf(lums), n: lums.length };
  console.log('  ' + M.SPECIES[k].name.padEnd(15) +
    'luminance mean ' + bySpecies[k].mean.toFixed(1).padStart(6) +
    '   sd ' + bySpecies[k].sd.toFixed(1));
});

var allColours = vsim.leaves.map(M.leafColor);
var uniqueCount = Object.keys(allColours.reduce(function (acc, c) {
  acc[c] = 1; return acc;
}, {})).length;
console.log('  canopy: ' + uniqueCount + ' unique colours across ' + allColours.length + ' leaves');

check('nearly every leaf starts a distinct colour',
      uniqueCount > allColours.length * 0.95,
      uniqueCount + '/' + allColours.length);
check('each species has real within-species spread',
      vsim.mix.every(function (k) { return bySpecies[k].sd > 3; }),
      vsim.mix.map(function (k) { return k + ' sd ' + bySpecies[k].sd.toFixed(1); }).join(', '));
// Species must stay separable despite the per-leaf scatter, or the three-way
// texture just reads as noise.
check('aspen is the lightest green, Gambel oak the darkest',
      bySpecies.aspen.mean > bySpecies.bigtoothMaple.mean &&
      bySpecies.bigtoothMaple.mean > bySpecies.gambelOak.mean,
      'aspen ' + bySpecies.aspen.mean.toFixed(1) +
      ', maple ' + bySpecies.bigtoothMaple.mean.toFixed(1) +
      ', oak ' + bySpecies.gambelOak.mean.toFixed(1));
check('between-species separation clears the within-species scatter',
      (bySpecies.aspen.mean - bySpecies.gambelOak.mean) >
      2.5 * Math.max(bySpecies.aspen.sd, bySpecies.gambelOak.sd),
      'gap ' + (bySpecies.aspen.mean - bySpecies.gambelOak.mean).toFixed(1) +
      ' vs max sd ' + Math.max(bySpecies.aspen.sd, bySpecies.gambelOak.sd).toFixed(1));

// The variation must not vanish the moment chlorophyll drops out, or the canopy
// snaps from varied greens to a uniform yellow at peak colour.
for (var vd = 0; vd < 62; vd++) vsim.step();
var lateColours = vsim.leaves.filter(function (l) { return l.attached; }).map(M.leafColor);
var lateUnique = Object.keys(lateColours.reduce(function (acc, c) {
  acc[c] = 1; return acc;
}, {})).length;
console.log('  at ' + M.doyToLabel(vsim.doy) + ': ' + lateUnique + ' unique across ' +
            lateColours.length + ' still attached');
check('individual variation survives into peak colour',
      lateUnique > lateColours.length * 0.9,
      lateUnique + '/' + lateColours.length);

// Colour variance must be purely cosmetic — it must not perturb the model.
check('colour anchors do not touch the senescence clock',
      (function () {
        var a = M.createSim({ cols: 14, rows: 10, mix: ['bigtoothMaple'], seed: 808 });
        a.reset();
        var senTrace = [];
        while (a.step()) senTrace.push(a.stats('bigtoothMaple').senescence);
        // Same seed, anchors mutated out from under it: the clock must be identical.
        var saved = M.SPECIES.bigtoothMaple.green;
        M.SPECIES.bigtoothMaple.green = { h: 250, s: 0.9, l: 0.7 };
        var b = M.createSim({ cols: 14, rows: 10, mix: ['bigtoothMaple'], seed: 808 });
        b.reset();
        var senTrace2 = [];
        while (b.step()) senTrace2.push(b.stats('bigtoothMaple').senescence);
        M.SPECIES.bigtoothMaple.green = saved;
        return senTrace.length === senTrace2.length &&
               senTrace.every(function (v, i) { return Math.abs(v - senTrace2[i]) < 1e-12; });
      })());

/* --- Determinism. ---------------------------------------------------- */
hr('F. Reproducibility');
var r1 = runSeason({}, { seed: 777 });
var r1b = runSeason({}, { seed: 777 });
check('same seed + same controls gives an identical season',
      r1.half50Doy === r1b.half50Doy &&
      Math.abs(r1.peakAntho.bigtoothMaple - r1b.peakAntho.bigtoothMaple) < 1e-12);

/* -------------------------------------------------------------------------
 * Summary
 * ---------------------------------------------------------------------- */
console.log('\n' + '='.repeat(60));
console.log(pass + ' passed, ' + fail + ' failed');
console.log('='.repeat(60));
process.exit(fail ? 1 : 0);
