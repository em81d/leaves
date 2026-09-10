/* Step 2's acceptance test, and the one artefact it produces.
 *
 *   node pixel/tools/leafspace-build.js [species] [--write]
 *
 * Puts every cell of a species into leaf space (pixel/leafspace.js), measures
 * how well the silhouettes agree once they are there, and refuses the grid if
 * any cell has drifted far enough that blending it would ghost. Read-only
 * unless --write, which additionally emits, into the species' cell directory:
 *
 *   _alpha.png       the shared silhouette, the alpha Step 3 composites with
 *   _leafspace.json  aspect ratio, per-cell IoU, and what produced them
 *
 * Both are build artefacts derived from the cells. Re-run after changing,
 * adding or regenerating any cell — nothing else notices that they are stale.
 *
 * Exit status is 0 only if every cell passes LeafSpace.MIN_IOU, so this is
 * usable as a gate.
 */
'use strict';

var fs = require('fs');
var path = require('path');
var png = require('./png.js');
var LS = require(path.join(__dirname, '..', 'leafspace.js'));
var G = require(path.join(__dirname, '..', 'grid.js'));

var args = process.argv.slice(2);
var WRITE = args.indexOf('--write') >= 0;
var species = args.filter(function (a) { return a[0] !== '-'; })[0] || 'bigtoothMaple';

if (G.SPECIES_ORDER.indexOf(species) < 0) {
  fail('unknown species "' + species + '" — expected one of ' + G.SPECIES_ORDER.join(', '));
}

var dir = path.join(__dirname, '..', 'cells', species);
var rows = G.rowsOf(species), cols = G.COLS;

/* Column 0 is one image shared down the column: y is undefined on a fully
 * green leaf, so only x0_y0.png exists. Every other cell is its own file. */
var wanted = [];
for (var c = 0; c < cols; c++) {
  for (var r = 0; r < rows; r++) {
    if (c === 0 && r > 0) continue;
    wanted.push({ col: c, row: r, name: G.cellName(c, r) });
  }
}

var missing = wanted.filter(function (w) { return !fs.existsSync(path.join(dir, w.name + '.png')); });
if (missing.length) {
  fail(missing.length + ' of ' + wanted.length + ' cells missing from ' +
       path.relative(process.cwd(), dir) + '\n  ' +
       missing.map(function (m) { return m.name + '.png'; }).join(', '));
}

console.log(G.model.SPECIES[species].name + ' — ' + wanted.length + ' cells, leaf space ' +
            LS.LEAF_PX + 'x' + LS.LEAF_PX + '\n');

/* ---- pass 1: into leaf space, keeping only what the checks need --------- */
/* Holding 43 cells of RGBA at 1024 square would be ~180 MB. Only the mask and
 * the running alpha sum are needed after a cell has been resampled, so the
 * pixels are dropped as soon as they have been folded in. */
var alphaSum = new Float64Array(LS.LEAF_PX * LS.LEAF_PX);
var t0 = Date.now();

wanted.forEach(function (cell, i) {
  var src = png.read(path.join(dir, cell.name + '.png'));
  var b = LS.alphaBounds(src);
  var img = LS.resample(src, b);

  cell.srcSize = src.width + 'x' + src.height;
  cell.bbox = b.w + 'x' + b.h;
  cell.aspect = b.w / b.h;
  cell.frameFill = (b.w * b.h) / (src.width * src.height);
  cell.mask = LS.maskOf(img);

  for (var p = 0; p < alphaSum.length; p++) alphaSum[p] += img.data[p * 4 + 3];
  progress('  resampling ' + (i + 1) + '/' + wanted.length);
});
progress(null);

/* ---- the shared silhouette --------------------------------------------- */
var shared = LS.finishConsensus(alphaSum, wanted.length);

var sharedMask = new Uint8Array(shared.length);
var sharedArea = 0;
for (var q = 0; q < shared.length; q++) {
  sharedMask[q] = shared[q] > LS.ALPHA_CUT ? 1 : 0;
  sharedArea += sharedMask[q];
}

/* ---- pass 2: does every cell still agree with it? ---------------------- */
var failures = [];
wanted.forEach(function (cell) {
  cell.iou = LS.iou(cell.mask, sharedMask);
  /* Pixels the shared alpha calls leaf but this cell left transparent. These
   * are exactly the pixels fillOutward has to invent colour for; if the count
   * is large the cells are not the same leaf and IoU will have said so. */
  var gap = 0;
  for (var i = 0; i < sharedMask.length; i++) if (sharedMask[i] && !cell.mask[i]) gap++;
  cell.gap = gap / sharedArea;
  if (cell.iou < LS.MIN_IOU) failures.push(cell);
});

/* ---- report ------------------------------------------------------------ */
var ious = wanted.map(function (c) { return c.iou; });
var aspects = wanted.map(function (c) { return c.aspect; });
var aspect = mean(aspects);

var frames = uniq(wanted.map(function (c) { return c.srcSize; }))
  .sort(function (a, b) { return area(a) - area(b); });
console.log('  source frames   ' + frames.length + ' distinct, ' + frames[0] + ' to ' +
            frames[frames.length - 1] + ' — normalised away by the bbox crop');
console.log('  leaf fills      ' + pct(Math.min.apply(null, wanted.map(function (c) { return c.frameFill; }))) +
            '-' + pct(Math.max.apply(null, wanted.map(function (c) { return c.frameFill; }))) + ' of its frame');
console.log('  aspect ratio    ' + aspect.toFixed(4) + '  (spread ' +
            Math.min.apply(null, aspects).toFixed(3) + '-' + Math.max.apply(null, aspects).toFixed(3) + ')');
console.log('  shared alpha    ' + pct(sharedArea / sharedMask.length) + ' of the square is leaf');
console.log('');
console.log('  registration against the shared silhouette');
console.log('    IoU           ' + Math.min.apply(null, ious).toFixed(3) + ' min, ' +
            mean(ious).toFixed(3) + ' mean   (floor ' + LS.MIN_IOU + ')');
console.log('    colour gap    ' + pct(Math.max.apply(null, wanted.map(function (c) { return c.gap; }))) +
            ' of the silhouette, worst cell — filled outward from its own edge');
console.log('');

/* Only the cells worth looking at: the tail of the IoU distribution. */
var ranked = wanted.slice().sort(function (a, b) { return a.iou - b.iou; });
console.log('  weakest cells');
ranked.slice(0, 5).forEach(function (c) {
  console.log('    ' + pad(c.name, 8) + ' IoU ' + c.iou.toFixed(3) +
              '   gap ' + pct(c.gap) + '   ' + c.srcSize);
});
console.log('');

if (failures.length) {
  fail(failures.length + ' cell(s) below the IoU floor of ' + LS.MIN_IOU + ':\n  ' +
       failures.map(function (f) { return f.name + ' (' + f.iou.toFixed(3) + ')'; }).join('\n  ') +
       '\n\nThese are no longer the same leaf as the rest of the grid. Blending them\n' +
       'will ghost. Regenerate them against a cell that passes, or lower\n' +
       'MIN_IOU in leafspace.js if the drift is genuinely acceptable.');
}

console.log('  PASS — leaf space holds: (u,v) means the same point in all ' +
            wanted.length + ' cells.');

/* ---- artefacts ---------------------------------------------------------- */
if (WRITE) {
  var rgba = new Uint8Array(shared.length * 4);
  for (var k = 0; k < shared.length; k++) {
    rgba[k * 4] = 255; rgba[k * 4 + 1] = 255; rgba[k * 4 + 2] = 255;
    rgba[k * 4 + 3] = shared[k];
  }
  png.write(path.join(dir, '_alpha.png'),
            { width: LS.LEAF_PX, height: LS.LEAF_PX, data: rgba });

  fs.writeFileSync(path.join(dir, '_leafspace.json'), JSON.stringify({
    _: 'Generated by pixel/tools/leafspace-build.js — do not edit. Re-run after changing any cell.',
    species: species,
    leafPx: LS.LEAF_PX,
    alphaCut: LS.ALPHA_CUT,
    minIou: LS.MIN_IOU,
    aspect: round(aspect, 4),
    sharedAlpha: '_alpha.png',
    cells: wanted.map(function (c) {
      return { name: c.name, col: c.col, row: c.row,
               iou: round(c.iou, 4), gap: round(c.gap, 5),
               source: c.srcSize, bbox: c.bbox, aspect: round(c.aspect, 4) };
    })
  }, null, 2) + '\n');

  console.log('\n  wrote ' + path.relative(process.cwd(), path.join(dir, '_alpha.png')));
  console.log('  wrote ' + path.relative(process.cwd(), path.join(dir, '_leafspace.json')));
} else {
  console.log('\n  (read-only; pass --write to emit _alpha.png and _leafspace.json)');
}

console.log('\n  ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');

/* ---- helpers ------------------------------------------------------------ */
function mean(a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; }
function pct(v) { return (v * 100).toFixed(1) + '%'; }
function round(v, n) { var f = Math.pow(10, n); return Math.round(v * f) / f; }
function pad(s, n) { return s + ' '.repeat(Math.max(0, n - s.length)); }
function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
function area(s) { var p = s.split('x'); return (+p[0]) * (+p[1]); }
/* Overwrite one line when attached to a terminal; stay quiet in a pipe or CI. */
function progress(msg) {
  if (!process.stdout.isTTY) return;
  process.stdout.write('\r' + (msg == null ? ' '.repeat(40) + '\r' : msg + '   '));
}
function fail(msg) { console.error('\n  FAIL — ' + msg + '\n'); process.exit(1); }
