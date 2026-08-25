/* ============================================================================
 * Doc/code consistency guard.  `node check-docs.js`
 *
 * leaf-phenology-data.md section 11.5 mirrors the live constants in model.js.
 * A mirrored table is only useful if it is actually true, and this session
 * already produced two rounds of silently-stale documentation (a superseded
 * temperature baseline, and species names that no longer existed), so the
 * mirror is checked rather than trusted.
 *
 * Run this after changing any species parameter, default control, or the
 * season bounds. It compares every field section 11.5 declares against the
 * model and fails loudly on drift. It does NOT check the prose — only numbers.
 * ==========================================================================*/

var fs = require('fs');
var M = require('./model.js');

var raw = fs.readFileSync(__dirname + '/leaf-phenology-data.md', 'utf8');
var doc = raw.split(String.fromCharCode(13)).join('');

var sec = doc.split('## 11.5 Live constants')[1];
if (!sec) { console.log('FAIL: could not find section 11.5'); process.exit(1); }
var m = sec.match(/```json\n([\s\S]*?)```/);
if (!m) { console.log('FAIL: no json block in 11.5'); process.exit(1); }
var d = JSON.parse(m[1]);

var bad = [];
function eq(label, a, b) {
  if (typeof a !== 'number' || typeof b !== 'number' || Math.abs(a - b) > 1e-9) {
    bad.push(label + ': doc ' + a + ' vs code ' + b);
  }
}

Object.keys(d.species).forEach(function (k) {
  var ds = d.species[k], cs = M.SPECIES[k];
  if (!cs) { bad.push('species ' + k + ' documented but not in model'); return; }
  ['pSen', 'ySen', 'sCrit', 'chlDecay', 'carotenoid', 'anthoPotential', 'fallFloor', 'marcescence']
    .forEach(function (f) { eq(k + '.' + f, ds[f], cs[f]); });
  ['h', 's', 'l'].forEach(function (f) { eq(k + '.green.' + f, ds.green[f], cs.green[f]); });
});
Object.keys(M.SPECIES).forEach(function (k) {
  if (!d.species[k]) bad.push('species ' + k + ' in model but undocumented');
});

Object.keys(d.default_controls).forEach(function (k) {
  eq('control.' + k, d.default_controls[k], M.DEFAULT_CONTROLS[k]);
});
Object.keys(M.DEFAULT_CONTROLS).forEach(function (k) {
  if (!(k in d.default_controls)) bad.push('control ' + k + ' undocumented');
});

eq('site.latitude', d.site.latitude, M.DEFAULT_CONTROLS.latitude);
eq('season.start_doy', d.season.start_doy, M.START_DOY);
eq('season.length_days', d.season.length_days, M.SEASON_DAYS);

if (bad.length) {
  console.log('MISMATCHES between doc 11.5 and model.js:');
  bad.forEach(function (b) { console.log('  ' + b); });
  process.exit(1);
}
console.log('doc 11.5 matches model.js on every declared field: ' +
  Object.keys(d.species).length + ' species x 11 fields, ' +
  Object.keys(d.default_controls).length + ' controls, plus site/season.');
