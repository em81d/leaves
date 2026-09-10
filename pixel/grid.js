/* The (x, y) grid parameterisation — pixel/README.md, "The axes".
 *
 * Shared deliberately. pixel/tools/cells.js prints the target-colour tables
 * from this, and pixel/grid-viewer.html lays the grid out from this, so the
 * acceptance test and the generation targets cannot drift apart. Anything that
 * defines where a leaf sits in the grid belongs here and nowhere else.
 *
 * Node:    var G = require('./grid.js');            // finds ../model.js itself
 * Browser: <script src="../model.js"></script>      // then window.LeafGrid
 *          <script src="grid.js"></script>
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('path').join(__dirname, '..', 'model.js'));
  } else {
    root.LeafGrid = factory(root.LeafModel);
  }
})(typeof self !== 'undefined' ? self : this, function (modelOrPath) {
  'use strict';

  var M = typeof modelOrPath === 'string' ? require(modelOrPath) : modelOrPath;

  /* [TUNE] Saturates the brown end at roughly the tannin the model actually
   * reaches. Not derived from anything — see README, "Definition".          */
  var TANNIN_SCALE = 1.6;

  /* How far up y each species can actually be driven: 95th percentile of red
   * share over the full condition sweep. Cells above this are never indexed,
   * so generating them is wasted work. README, "Two facts". */
  var Y_CEILING = { bigtoothMaple: 0.82, gambelOak: 0.73, aspen: 0.36 };

  /* Aspen's red share spans 0.01-0.36 and is flat in x — two rows is generous. */
  var ROWS = { bigtoothMaple: 6, gambelOak: 4, aspen: 2 };
  var COLS = 8;

  var SPECIES_ORDER = ['bigtoothMaple', 'gambelOak', 'aspen'];

  /* y is undefined on a fully green leaf: numerator and denominator both go to
   * zero. That is why the whole left edge of the grid is a single image. */
  var Y_UNDEFINED_EPS = 1e-6;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* ---- forward: a leaf's pigment state -> where it sits in the grid ------ */
  function axesOf(leaf) {
    var x = Math.min(0.999,
      0.5 * (1 - leaf.chlorophyll) + 0.5 * Math.min(1, leaf.tannin * TANNIN_SCALE));
    var denom = leaf.anthocyanin + leaf.carotenoid * (1 - leaf.chlorophyll);
    return denom < Y_UNDEFINED_EPS
      ? { x: x, y: 0, yDefined: false }
      : { x: x, y: leaf.anthocyanin / denom, yDefined: true };
  }

  /* ---- inverse: a point in the grid -> the pigment state that lands there -
   * Unambiguous only because green and brown never co-occur (measured 0.0% of
   * 621,884 leaf-days), which is what lets the two halves of x be disjoint. */
  function stateAt(x) {
    return x <= 0.5
      ? { chl: 1 - 2 * x, tan: 0 }
      : { chl: 0, tan: (2 * x - 1) / TANNIN_SCALE };
  }

  /* ---- cell addressing -------------------------------------------------- */
  function rowsOf(sp) { return ROWS[sp]; }
  function ceilingOf(sp) { return Y_CEILING[sp]; }
  function xAt(col) { return col / (COLS - 1); }
  function yAt(sp, row) {
    var rows = ROWS[sp];
    return rows === 1 ? 0 : (row / (rows - 1)) * Y_CEILING[sp];
  }
  /* Row 0 is y = 0 (turned yellow); the top row is the species' ceiling. */
  function cellName(col, row) { return 'x' + col + '_y' + row; }

  /* Continuous cell coordinates for a leaf, which is what the Step 3 bilinear
   * blend will index with. y is clamped to the ceiling: a leaf redder than the
   * grid's top row reads the top row, it does not fall off the edge. */
  function cellCoords(sp, ax) {
    var rows = ROWS[sp];
    return {
      cx: clamp01(ax.x) * (COLS - 1),
      cy: rows === 1 ? 0 : clamp01(ax.y / Y_CEILING[sp]) * (rows - 1),
      overCeiling: ax.yDefined && ax.y > Y_CEILING[sp]
    };
  }

  /* ---- the target colour a generated cell must average to ---------------- */
  function cellColorRgb(sp, x, y) {
    return M.leafColor(referenceLeaf(sp, x, y)).match(/\d+/g).map(Number);
  }

  /* The pigment state a cell stands for. Untinted: rng() = 0.5 zeroes every
   * jitter term in makeLeaf, so this is the species' canonical anchor set.
   * Per-leaf tint is a multiply applied after the grid lookup (Step 5) and is
   * never baked into a cell. */
  function referenceLeaf(sp, x, y) {
    var car = M.SPECIES[sp].carotenoid;
    var s = stateAt(x);
    var wY = car * (1 - s.chl);
    // y = a/(a + wY)  =>  a = y*wY/(1 - y)
    var anth = y >= 0.999 ? 1 : (y * wY) / (1 - y);

    var leaf = M.makeLeaf(sp, function () { return 0.5; });
    leaf.chlorophyll = s.chl;
    leaf.carotenoid = car;
    leaf.anthocyanin = Math.min(1, anth);
    leaf.tannin = s.tan;
    return leaf;
  }

  function toHex(rgb) {
    return '#' + rgb.map(function (v) {
      return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    }).join('');
  }

  function cellColor(sp, x, y) { return toHex(cellColorRgb(sp, x, y)); }

  return {
    TANNIN_SCALE: TANNIN_SCALE,
    Y_CEILING: Y_CEILING,
    ROWS: ROWS,
    COLS: COLS,
    SPECIES_ORDER: SPECIES_ORDER,
    model: M,
    axesOf: axesOf,
    stateAt: stateAt,
    rowsOf: rowsOf,
    ceilingOf: ceilingOf,
    xAt: xAt,
    yAt: yAt,
    cellName: cellName,
    cellCoords: cellCoords,
    referenceLeaf: referenceLeaf,
    cellColorRgb: cellColorRgb,
    cellColor: cellColor,
    toHex: toHex
  };
});
