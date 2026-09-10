/* Regenerate the target-colour tables in pixel/README.md from the live model.
 *
 *   node pixel/tools/cells.js
 *
 * Inverts the (x, y) grid parameterisation back to pigment state, then asks
 * M.leafColor what that state looks like. The output is the colour each
 * generated cell image should average to.
 *
 * The parameterisation itself lives in pixel/grid.js, shared with the grid
 * viewer so the generation targets and the acceptance test cannot disagree.
 *
 * If model.js changes, the README's tables are stale until this is re-run.
 */
'use strict';

var path = require('path');
var G = require(path.join(__dirname, '..', 'grid.js'));
var M = G.model;

var out = [];
G.SPECIES_ORDER.forEach(function (sp) {
  var rows = G.rowsOf(sp), ceil = G.ceilingOf(sp);
  out.push('#### ' + M.SPECIES[sp].name + ' — ' + G.COLS + ' × ' + rows +
           ', `y` ceiling ' + ceil.toFixed(2));
  out.push('');

  var hdr = '| y \\ x |', sep = '|---|';
  for (var i = 0; i < G.COLS; i++) {
    hdr += ' ' + G.xAt(i).toFixed(2) + ' |';
    sep += '---|';
  }
  out.push(hdr);
  out.push(sep);

  for (var j = rows - 1; j >= 0; j--) {
    var y = G.yAt(sp, j);
    var line = '| **' + y.toFixed(2) + '** |';
    for (var k = 0; k < G.COLS; k++) {
      line += ' `' + G.cellColor(sp, G.xAt(k), y) + '` |';
    }
    out.push(line);
  }
  out.push('');
});

console.log(out.join('\n'));
