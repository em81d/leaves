/* Rebuilds tree-art.js from the tree drawings.  Run from the repo root:
 *
 *     node extract-tree-art.js
 *
 * The drawings are silhouettes: every trunk, limb and twig is a filled path,
 * there are no strokes, and the fill colour on them is thrown away here because
 * the scene recolours each tree anyway.  Only the viewBox and the path data
 * survive, so re-run this whenever one of the SVGs is redrawn.
 */
const fs = require('fs');
const names = ['aspen1','aspen2','aspen3','maple','oak'];
const out = {};
for (const n of names) {
  const src = fs.readFileSync(n + '.svg', 'utf8');
  const vb = /viewBox="([^"]+)"/.exec(src)[1].trim().split(/\s+/).map(Number);
  const ds = [...src.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(m => m[1].trim());
  out[n] = { vb, d: ds };
  console.error(n, 'paths', ds.length, 'bytes', ds.join('').length);
}
let js = '// Generated from the tree SVGs by extract-tree-art.js - path outlines only, one entry per source file.\n';
js += '// vb: source viewBox [x y w h].  d: SVG path data, each filled with the even-odd rule.\n';
js += 'var TREE_ART = {\n';
for (const n of names) {
  js += '  ' + n + ': { vb: [' + out[n].vb.join(',') + '], d: [\n';
  js += out[n].d.map(d => '    "' + d + '"').join(',\n') + '\n  ] },\n';
}
js += '};\n';
fs.writeFileSync('tree-art.js', js);
console.error('wrote tree-art.js', js.length);
