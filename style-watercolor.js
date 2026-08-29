/* ============================================================================
 * WATERCOLOUR — Option C1 of plan-visual.md.
 *
 * A style, not a fork. This file registers itself on window.LeafStyles and
 * scene.html merges it into the Phase 0 registry at boot, so it reaches the
 * scene only through the hooks that seam exposes and touches neither the model
 * nor the draw path. Loading it costs nothing until it is selected:
 * ?style=watercolor, or the Style dropdown in the Scene panel.
 *
 * WHY THIS STYLE FOR THIS PROJECT
 * The model simulates pigment. Watercolour IS pigment — the same four things
 * model.js tracks are the things a painter is actually pushing around on paper.
 * Nothing else on the candidate list has that correspondence.
 *
 * THE STRUCTURAL IDEA — glazing does the work
 * Leaves are laid down with globalCompositeOperation 'multiply' at partial
 * alpha, which is what a transparent wash physically is: each layer filters
 * what is under it. So where leaves stack the canopy darkens by itself, and the
 * crown gets an interior WITHOUT an occlusion pass. The 'lit' style needed a
 * grid and eight rays per leaf to buy the same thing (see computeCanopyOcclusion
 * in scene.html); here it falls out of the medium for free.
 *
 * That is also why every colour has to move. A wash multiplies toward dark, so
 * it only reads as watercolour over a PALE ground — glaze a mid-blue sky and
 * you get mud. The `wash` hook repaints the scene's whole palette onto paper
 * white first; the geometry underneath is untouched.
 *
 * Reference for the technique: Curtis et al., "Computer-Generated Watercolor",
 * SIGGRAPH 1997. The three cues worth having, in order of how much they buy:
 *   1. edge darkening — pigment migrates outward and pools at a wash's rim as
 *      it dries. This is the signature of the medium and it is two draw calls.
 *   2. paper — cold-press tooth, multiplied over everything at the end.
 *   3. wet-in-wet bleed — soft haloes where pigment ran into damp paper.
 * ==========================================================================*/
(function () {
  'use strict';

  window.LeafStyles = window.LeafStyles || {};

  window.LeafStyles.watercolor = function (api) {
    var ctx = null;                 // resolved per call: api.ctx is a getter
    var TAU = api.TAU;
    // Sampled once per frame in afterSky, which always runs before any tree.
    // paintLeaf is called a few thousand times a frame and has no business
    // going back through the api for values that cannot change inside a frame.
    var frameQ = 0;

    /* ======================================================================
     * PALETTE
     *
     * Watercolour is pale AND saturated — that pairing is the whole look. Pale
     * alone gives pastel, which is what happens if you just lighten. So each
     * colour is lifted toward the paper and then has its chroma pushed back out
     * around the new, higher lightness.
     *
     * `t` is how far toward paper, `c` is how hard chroma is re-expanded.
     * Bark stays nearly where it is: the dark limbs are the drawing under the
     * painting, and without them a pale wash has nothing to hang on.
     * ====================================================================*/
    var PAPER = [252, 249, 241];          // warm white, not #fff

    var WASH = {
      skyTop:     { t: 0.60, c: 1.30 },
      skyHz:      { t: 0.74, c: 1.18 },
      rock:       { t: 0.56, c: 1.40 },   // ranges as blue-violet washes
      meadowNear: { t: 0.48, c: 1.34 },
      meadowFar:  { t: 0.58, c: 1.26 },
      barkDark:   { t: 0.16, c: 1.10 },
      barkLight:  { t: 0.30, c: 1.10 },
      // Thinned much less than the scenery. A first wash at 0.44 came out as
      // weak tea: lightening toward white costs absolute chroma faster than
      // re-expanding it recovers, so the outer canopy — the leaves with nothing
      // glazed over them — went pale AND grey, which is the one thing a wash
      // must never be. At 0.30 a single leaf against the sky is still pale but
      // unmistakably coloured, and the glaze does the rest.
      leaf:       { t: 0.30, c: 1.45 }
    };

    function washRgb(c, t, chroma) {
      var r = c[0] + (PAPER[0] - c[0]) * t;
      var g = c[1] + (PAPER[1] - c[1]) * t;
      var b = c[2] + (PAPER[2] - c[2]) * t;
      var y = r * 0.299 + g * 0.587 + b * 0.114;
      r = y + (r - y) * chroma;
      g = y + (g - y) * chroma;
      b = y + (b - y) * chroma;
      return [r < 0 ? 0 : r > 255 ? 255 : r,
              g < 0 ? 0 : g > 255 ? 255 : g,
              b < 0 ? 0 : b > 255 ? 255 : b];
    }

    function wash(rgb, role) {
      var w = WASH[role];
      return w ? washRgb(rgb, w.t, w.c) : rgb;
    }

    /* ======================================================================
     * PAPER
     *
     * Generated, not loaded — an external image would cost the scene its
     * "opens straight off the filesystem" property, which scene.html gave up
     * p5 to keep.
     *
     * Cold-press tooth is two scales at once: a broad mottle from how the sheet
     * dried and a fine grain from the mould. White noise blurred at two radii
     * gives both. The blur wraps, so the tile repeats without a seam.
     * ====================================================================*/
    var paperCv = null, paperPat = null;
    var PAPER_SIZE = 384;

    function blurWrap(src, size, radius) {
      var tmp = new Float32Array(src.length);
      var out = new Float32Array(src.length);
      var span = radius * 2 + 1, x, y, i, acc;
      for (y = 0; y < size; y++) {                       // horizontal
        for (x = 0; x < size; x++) {
          acc = 0;
          for (i = -radius; i <= radius; i++) {
            acc += src[y * size + ((x + i + size * 2) % size)];
          }
          tmp[y * size + x] = acc / span;
        }
      }
      for (x = 0; x < size; x++) {                       // vertical
        for (y = 0; y < size; y++) {
          acc = 0;
          for (i = -radius; i <= radius; i++) {
            acc += tmp[((y + i + size * 2) % size) * size + x];
          }
          out[y * size + x] = acc / span;
        }
      }
      return out;
    }

    function makePaper() {
      if (paperCv) return;
      var size = PAPER_SIZE, N = size * size, i;
      var noise = new Float32Array(N);
      for (i = 0; i < N; i++) noise[i] = Math.random();

      var fine = blurWrap(noise, size, 1);      // the mould grain
      var broad = blurWrap(noise, size, 7);     // how the sheet dried

      paperCv = document.createElement('canvas');
      paperCv.width = paperCv.height = size;
      var g = paperCv.getContext('2d');
      var img = g.createImageData(size, size), d = img.data;
      for (i = 0; i < N; i++) {
        // Near white with a shallow tooth. This gets MULTIPLIED over the
        // finished frame, so anything much below 1.0 reads as dirt rather than
        // as paper — the range here is about 0.90 to 1.0.
        var v = 1 - (0.055 * (1 - fine[i]) + 0.048 * (1 - broad[i]));
        var k = i * 4;
        d[k]     = PAPER[0] * v;
        d[k + 1] = PAPER[1] * v;
        d[k + 2] = PAPER[2] * v;
        d[k + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      paperPat = api.ctx.createPattern(paperCv, 'repeat');
    }

    /* ======================================================================
     * LEAVES
     * ====================================================================*/

    /* The pigment the model produced, thinned into a wash.
     *
     * Deliberately NOT the lighting from Option A. A wash has no specular side
     * and no shaded side — it has a pigment concentration, and depth comes from
     * how many washes lie on top of each other. So this only thins the colour;
     * the canopy interior is built by the multiply in paintLeaf.
     *
     * The model's full colour granularity survives intact, which is the reason
     * to prefer this over the woodblock option: nothing is quantised. */
    function gradeLeaf(rgb, leaf, t, o) {
      var w = WASH.leaf;
      var c = washRgb(rgb, w.t, w.c);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    }

    function gradeFree(rgb, o, exposure) {
      // Airborne and fallen leaves are single washes with nothing glazed over
      // them, so they need to be a little denser or they vanish into the paper.
      var w = WASH.leaf;
      var c = washRgb(rgb, w.t * (0.80 + 0.20 * (1 - exposure)), w.c);
      o[0] = c[0]; o[1] = c[1]; o[2] = c[2];
    }

    /* One leaf, as a wash.
     *
     * Two draw calls, and the second one is what sells it. Pigment carried to
     * the edge of a wet area stays there as the water leaves, so a dried wash
     * is darkest at its rim — that rim is the single most recognisable thing
     * about the medium, and it costs one stroke.
     *
     * The stroke width is in the leaf's own unit space, which the caller has
     * already scaled by leaf length, so it has to be divided back out to land
     * near a constant number of device pixels. Below a few pixels a leaf has no
     * visible rim anyway and the stroke is skipped, which is also where most of
     * the leaves are. */
    function paintLeaf(leaf, path, px) {
      if (!ctx) ctx = api.ctx;
      ctx.fillStyle = leaf.c;
      ctx.fill(path);
      // The rim doubles the canopy's draw calls, so it is bought only where it
      // can actually be seen. Below ~10px a leaf has no resolvable edge, and
      // that is where most of the canopy lives; when the frame-rate watchdog is
      // already stepping quality down it goes entirely.
      if (px > 10 && frameQ < 2) {
        ctx.strokeStyle = leaf.c;
        ctx.lineWidth = 2.0 / px;
        ctx.stroke(path);
      }
    }

    /* ======================================================================
     * SKY — wet-in-wet
     *
     * scene.html paints the sky as a smooth vertical gradient, which is exactly
     * what a watercolour sky is not: pigment dropped into wet paper pools and
     * runs, and the result is blotchy in a very specific soft-edged way. These
     * are those pools, laid over the gradient after it is down.
     *
     * Seeded off a fixed number rather than the scene seed: the paper does not
     * change when you ask for new woods.
     * ====================================================================*/
    var blooms = null;

    function makeBlooms(W, H, HORIZON) {
      var rng = api.makeRng(0x9e3779b9);
      blooms = [];
      for (var i = 0; i < 14; i++) {
        blooms.push({
          x: rng() * W,
          y: rng() * HORIZON * 0.92,
          r: (0.10 + 0.20 * rng()) * W,
          a: 0.05 + 0.09 * rng(),
          squash: 0.34 + 0.34 * rng()
        });
      }
    }

    function afterSky() {
      ctx = api.ctx;
      frameQ = api.quality();
      var d = api.dims(), L = api.light();
      if (!blooms) makeBlooms(d.W, d.H, d.HORIZON);

      // Pooled pigment is the sky's own colour run darker, never a grey.
      var pool = api.mix(L.skyTop, [120, 146, 178], 0.45);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      for (var i = 0; i < blooms.length; i++) {
        var b = blooms[i];
        var g = ctx.createRadialGradient(b.x, b.y, b.r * 0.10, b.x, b.y, b.r);
        // A wet bloom is soft in the middle and hardest at its edge, which is
        // the opposite of a glow — hence the alpha rising before it falls.
        g.addColorStop(0.00, api.cssA(pool, b.a * 0.55));
        g.addColorStop(0.62, api.cssA(pool, b.a));
        g.addColorStop(0.88, api.cssA(pool, b.a * 1.25));
        g.addColorStop(1.00, api.cssA(pool, 0));
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.scale(1, b.squash);
        ctx.translate(-b.x, -b.y);
        ctx.fillStyle = g;
        ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
        ctx.restore();
      }
      ctx.restore();
      api.world();
    }

    /* ======================================================================
     * POST — the paper goes on last
     *
     * Multiplied rather than overlaid, because paper is not a texture laid on
     * top of a painting: it is the thing the painting is made of, and every
     * wash is modulated by the tooth it settled into.
     *
     * There is deliberately no dark vignette. Option A wants one — a photograph
     * falls off at the corners. A painting does the opposite: the wash runs out
     * and the paper shows through, so the edges go LIGHTER.
     * ====================================================================*/
    function post() {
      ctx = api.ctx;
      var cv = api.cv, cw = cv.width, chh = cv.height;
      if (!cw || !chh) return;
      makePaper();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;

      if (paperPat && api.quality() < 3) {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = paperPat;
        ctx.fillRect(0, 0, cw, chh);
      }

      // The wash running out toward the edges of the sheet.
      ctx.globalCompositeOperation = 'source-over';
      var vr = Math.max(cw, chh);
      var vg = ctx.createRadialGradient(cw * 0.5, chh * 0.46, vr * 0.36,
                                        cw * 0.5, chh * 0.48, vr * 0.86);
      vg.addColorStop(0, 'rgba(252,249,241,0)');
      vg.addColorStop(1, 'rgba(252,249,241,0.42)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, cw, chh);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    return {
      label: 'Watercolour',
      wash: wash,
      gradeLeaf: gradeLeaf,
      gradeFree: gradeFree,
      paintLeaf: paintLeaf,
      leafComposite: 'multiply',
      /* The glaze, and the one number that has to move with the density slider.
       *
       * Depth here is a product of how many washes land on the same spot, and
       * that count scales with leaf density — so a fixed alpha is only correct
       * at one setting. Measured over the real palette, a wash of alpha 0.62
       * runs pale ochre at one layer, peaks in chroma around three, and is a
       * deep umber by six; at density 1.6 the interior would stack roughly ten
       * and go to near-black, which in watercolour reads as overworked mud
       * rather than as depth. Holding alpha x depth roughly constant keeps the
       * canopy in the part of the curve where the colour actually lives. */
      get leafAlpha() {
        var d = api.density() || 1;
        var a = 0.62 / d;
        return a < 0.34 ? 0.34 : a > 0.80 ? 0.80 : a;
      },
      afterSky: afterSky,
      taperedBranches: true,
      post: post
    };
  };
})();
