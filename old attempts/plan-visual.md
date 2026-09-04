# Visual Style Plan — Phase 6

Companion to `plan.md`. That document covers the model and the scene's *content*;
this one covers how the scene is *painted*. Nothing here touches `model.js` — the
model owns colour, senescence and abscission, and every option below consumes
`M.leafColor()` output exactly as `scene.html` does today.

**Status:** Phase 0, Option A and Option C1 are **built** — `?style=lit` and
`?style=watercolor`, or the Style dropdown in the Scene panel. B, C2 and C3 are
still candidates, and the seam Phase 0 added is what they slot into.

| Style | Where it lives | Select with |
|---|---|---|
| Flat (original) | `scene.html`, untouched baseline | `?style=current` |
| Lit | `scene.html` §9.5 | `?style=lit` |
| Watercolour | `style-watercolor.js` | `?style=watercolor` |

---

## Phase 7 — a second take, not a style

**`scene-grove.html`.** Built after the styles above, on a rereading of the
problem: the leaves in `scene.html` are the part that already works, and the
styles were all changing the leaves. What actually reads as unfinished is the
trunks, the ground, the skyline and — most of all — the arrangement. A style
hook cannot fix an arrangement, so this is a separate scene rather than another
entry in the registry. Same `model.js`, same leaves, different picture.

What is different:

- **Depth is a coordinate.** `scene.html` hand-places x, y, scale and haze per
  tree, which caps the grove near a dozen and makes its flat band hard to
  escape. A tree here has one spatial parameter `d` (0 at the horizon, 1 at the
  viewer) and the ground line, scale, haze, leaf budget, draw order and wind lag
  all derive from it. **54 trees** at the default against twelve.
- **Level of detail.** Leaf budget falls off as `d^1.6`, so near trees carry the
  canopy and far ones cost almost nothing. Behind them the treed skyline is
  painted as canopy masses with no individual leaves — still model-coloured, off
  a pool of probe leaves stepped daily per species.
- **Limbs curve.** Every branch is a short polyline integrating a curvature
  term, painted as a tapered ribbon, which also lets the trunk flare into
  buttress roots instead of stopping dead at the ground. Straight-stick limbs
  were a louder "this was drawn" signal than any colour problem.
- **The ground is a place.** Grass in clumps rather than blades, undergrowth
  that turns with the same model the canopy uses, rocks, deadfall, and a worn
  line through the middle. Nearly all static, stamped once into an offscreen
  layer.
- **The light is faint on purpose.** Measured against the ungraded model colour
  (`?light=0`), grading moves canopy luminance to **0.90–1.08x**, bulk inside
  0.94–1.03, largest single-channel shift 17/255. Option A's `lit` spans about
  2.1x. The point of this project is the pigment model; a light strong enough to
  restate its output in its own terms is a light that is too strong.

**Unverified, same as the styles:** nobody has looked at it, and real frame cost
is unknown — the harness reports its own synthetic frame delta, not work done.
Peak canopy is 15.5k leaves against `scene.html`'s ~9.6k. The Trees slider runs
to 90, which at density 1.6 reaches ~59k leaves and will very likely be too slow;
the readout in the Grove panel shows tree and leaf counts so the cost is visible
while dragging.

---

## Why the current scene reads as flat

Diagnosis before prescription. The scene is not naively drawn — the clouds are
stacked soft radial gradients specifically to avoid reading as a cartoon
(`scene.html:1157`), the ranges carry aerial perspective, the shadows lean with
the sun, and the gust travels through the canopy as a correlated wave. Four
specific gaps account for the flatness, and none of them are the fault of
canvas 2D:

1. **Leaves have no lighting.** `refreshLeafColors` (`scene.html:1385`) folds
   haze into every leaf and applies `lit2 = 0.68 + 0.32 * sunF` to **bark only**.
   Leaf colour goes to screen as the model's raw pigment RGB. A leaf on the
   sunlit crown and one buried in the canopy interior are painted identically.
   Everything else in the frame responds to the light; the subject does not.
   This is the single largest contributor.

2. **Density.** ~9.6k leaves over twelve trees is ~800 per tree. A real bigtooth
   maple carries 50k–200k. At 800 the eye resolves individual stickers rather
   than foliage mass.

3. **Almost no post.** One world-space vignette exists (`scene.html:1609`). No
   bloom, grain, grade, or depth blur. Note the existing vignette is drawn in
   *world* space inside `drawWeather`, so it is anchored to the 1600×900
   composition rather than the viewport — it should move to the screen-space
   stack in Option A.

4. **No unifying grade.** Sky, foliage and bark are each locally plausible but
   share no colour cast, so nothing says they are lit by the same sun.

---

## Phase 0 — the style seam (do this first, whichever option follows)

Since several options will be tried and compared, build the switch before the
styles. Without it, trying four looks means four divergent copies of a 1966-line
file and no way to A/B them.

**Add a style registry.** A plain object per style, no framework:

```js
var STYLES = {
  current:    { /* today's behaviour, as the baseline */ },
  lit:        { },   // Option A
  watercolor: { },   // Option C1
  painterly:  { },   // Option C2
  ukiyoe:     { }    // Option C3
};
```

**Hooks each style may implement** (all optional, falling back to current
behaviour):

| Hook | Called | Purpose |
|---|---|---|
| `init(ctx)` | once at build | pre-render sprite atlases, paper/canvas textures, palettes |
| `gradeLeaf(rgb, leaf, tree)` | inside `refreshLeafColors` | per-leaf lighting, quantisation, palette snapping |
| `paintLeaf(ctx, leaf, px, path)` | inside `drawTree` | replaces the `ctx.fill(path)` call |
| `paintBackground(ctx)` | before trees | sky / ranges / meadow treatment |
| `canopyLayer` | flag | if true, each tree's canopy renders to an offscreen layer then composites (needed for `multiply` styles) |
| `post(srcCanvas, dstCtx)` | end of `frame` | the screen-space post stack |

**Selection:** `?style=watercolor` on the URL, matching the existing `?still`
convention, plus a dropdown in the controls panel. Default to whichever wins.

**Comparison harness:** `?still&style=X&seed=N&day=D` already gives deterministic
frames — `?still` freezes the clock but keeps repainting (`scene.html:1626`).
Add `&day=` to jump the sim to a fixed day at build, then capture the same three
days (early September, peak, late October) across every style at one seed. Judge
from those nine images side by side, not from memory.

**Effort:** ~150 lines of plumbing. Everything below assumes it exists.

---

## Option A — Light & post

Keep canvas 2D. Add the lighting the leaves never got, and a real post stack.
This is the highest return per hour available, and it is a **prerequisite for
Option B and Option C2** (both need value structure underneath). C1 and C3 get
their depth other ways and can skip it.

### A1 — Per-leaf shading, baked into the existing colour cache

The key structural fact: `refreshLeafColors` already rebuilds every leaf's colour
string 8 times per simulated day, deliberately, to avoid per-frame string
building. Static lighting belongs *there*, at zero per-frame cost. Do not put it
in `drawTree`.

**Ambient occlusion term** — compute once per leaf at scene build, store on the
leaf site:

- Cheap version: distance from the canopy centroid, plus height within the crown.
  Outer-envelope and upper leaves bright, interior and lower leaves dark.
- Better version: rasterise all leaf sites of a tree into a low-resolution grid
  (say 32×32), then for each leaf count occupancy in the cells between it and the
  crown surface along the sun direction. One pass at build, ~20 lines, and it
  produces genuinely convincing canopy depth.
- Store as `s2.ao` in 0..1.

**Direct term** — the sun's world position is already known (`x = 1180`,
`y = 150 + (1 - sunF) * 360`, `scene.html:1125`). Build a direction vector per
leaf from its world position, take a Lambert-ish dot against the leaf's resting
normal (approximated from `s2.rot`), and modulate by `sunF` and cloud cover.
Under heavy overcast the direct term should collapse toward pure ambient —
which is physically right and will make the cloud slider suddenly feel meaningful.

**Composite:**

```
shade = ambient*(0.55 + 0.45*ao) + direct*NdotL*ao + translucency*backlit
```

### A2 — Backlit translucency

The most recognisable autumn image there is, and currently absent. When the sun
is behind the canopy relative to the camera, leaves transmit rather than reflect:
raise luminance, raise saturation, and push hue slightly toward yellow. A yellow
aspen against a low sun should glow. Gate it on `sunF` (strongest at low sun) and
on cloud cover.

This is cheap to fake well because you are not simulating transmission — you are
applying a per-leaf boost whose *mask* comes from geometry you already have.

### A3 — Tapered branches

`scene.html:1434-1439` strokes constant-width round-capped segments, so taper is
stepped per segment. Replace with filled quads interpolating `b.w` from parent to
child width. Also worth adding: a slight darkening toward the branch's lower
edge so limbs read as cylinders.

### A4 — Screen-space post stack

Render the world to an offscreen canvas, then composite passes to the visible one.
Order matters:

1. **Bloom** — threshold bright pixels, downsample to ¼, `ctx.filter = 'blur(Npx)'`
   (GPU-accelerated in Chrome and Firefox), draw back with
   `globalCompositeOperation = 'lighter'`. Sells the low sun and makes backlit
   leaves bleed into the sky.
2. **Depth blur** — a mild blur on the range layers only. You already have depth
   information as `tint` per range and `haze` per tree; reuse it.
3. **Colour grade** — a warm/cool split-tone keyed to `sunF`. Cheapest convincing
   route is two composited fills: `'overlay'` warm in the highlights, `'multiply'`
   cool in the shadows. Avoid per-pixel `getImageData` LUTs; they will not hold 60fps.
4. **Vignette** — move the existing one here, into screen space.
5. **Grain** — pre-generate one tiling noise canvas at build, draw it at low alpha
   with a per-frame random offset. Static grain reads as dirt on the lens; moving
   grain reads as film.

**Perf:** the watchdog steps `QUALITY` down under load (`scene.html:220`). Post
passes must register there too — drop bloom first, then grain, then depth blur.

### A5 — Validation

Capture `?still` frames before and after at identical seed and day. The specific
thing to check: does the canopy read as a volume with an interior, and does the
cloud slider now change the *quality* of light rather than just its brightness?

**Effort:** ~450 lines. A weekend. Lowest risk on this page.

### BUILT — what actually landed, and what it measured

Implemented as the `lit` style. Everything above went in, with three departures
worth recording:

- **A1's better AO variant was the one built**, not the cheap one. It bins the
  crown's leaf area into a 22x22 grid and marches eight rays out of every leaf
  (`computeCanopyOcclusion`). One pass gives both terms: `occ[8]` for the sun's
  direction, and a sky-weighted average that becomes ambient occlusion. Weighted
  by blade area rather than leaf count, and normalised to the busiest cell so the
  density slider does not double as a brightness slider.
- **Leaf normals are derived, not drawn.** Each site needed a 3D normal for the
  lighting. Pulling two fresh `rng()` values per site shifted the random stream
  for every branch after it, so the same seed stopped building the same woods —
  which would have broken every `?seed=` capture URL. The normal now comes from
  `tw` and `fl`, draws addSites had already made.
- **The first tuning pass was wrong and the numbers here are the second.** The
  original gains only ever multiplied *down*, so median canopy luminance fell 27%
  and the scene just looked like dusk. The model's colours are already correct for
  a well-lit leaf, so shade has to be paid for by making something else brighter:
  exposed leaves now land near 1.0 and backlit ones go above it. `tr^2` also
  crushed transmission to nothing (typical blades sit near `ndl = -0.3`, and
  0.3² is not a glow) — it is `tr^1.5` now.

**Measured** (seed 7, leaf fills only, canopy luminance percentiles):

| | day 20 | day 64 | day 96 |
|---|---|---|---|
| p10 → p90, `current` | 79 → 162 | 81 → 147 | 94 → 133 |
| p10 → p90, `lit` | 71 → 179 | 71 → 150 | 77 → 131 |
| p90 chroma, `current` → `lit` | 98 → 132 | 117 → 135 | 83 → 108 |

The canopy gained an interior (the low end drops) without losing its highlights
(the high end holds or rises), and the top-end chroma rise is the transmission
term firing.

**The A5 question — does the cloud slider now change the quality of the light
rather than only its brightness — answers yes**, at day 20, clear to overcast:

| | `current` | `lit` |
|---|---|---|
| p90 luminance | 167 → 156 | 207 → 143 |
| p90 chroma | 95 → 103 | 168 → 93 |

Under `current` an overcast sky barely registers, and chroma even rises slightly.
Under `lit` the directional and transmitted terms collapse toward pure sky light,
which is what overcast physically is.

**Not verified:** nobody has looked at it. Headless Chrome could not render the
page in this environment — it aborts the renderer on the *unmodified* baseline
too, so it is not the new code — which means all of the above is numbers, not
judgement. The constants tagged `[TUNE]` in the `9.5 STYLE: LIT` section are
where to reach first: `AMB_BASE`/`AMB_SKY` for overall level, `TRN_GAIN` and
`GLOW_SAT` for how hard the backlit glow pushes, `BLOOM_A` and `GRAIN_A` for the
post stack.

**Known wrinkle:** restamping the litter (on resize, or on a style change) re-lights
the whole carpet with *today's* sun, so leaves that fell in September get November
light. Arguably more correct than the alternative, but it is a change, not an
accident.

---

## Option B — WebGL instancing (three.js)

Same aesthetic as A, an order of magnitude more of it. This is the density fix.

### B1 — What stays

`model.js` untouched. Scene construction, tree architecture, species profiles,
the day loop, the controls panel — all untouched. Only the paint layer is
replaced. `drawTree`, `drawFalling` and the colour cache go; everything above
them stays.

### B2 — Instancing

One `THREE.InstancedMesh` per species (three draw calls total). Per-instance
attributes: transform, colour (`instanceColor`), plus custom attributes for `ao`,
flutter phase and flutter rate. Per simulated day you upload only the colour
buffer — a single `needsUpdate` on ~1M floats, not a JS loop building strings.

### B3 — Wind moves to the vertex shader

This is what actually unlocks density. Today the per-frame cost is the JS loop in
`drawTree` computing `sin`/`cos` per leaf (`scene.html:1487-1505`). Port that
math to GLSL — the gust wave, the flutter, the petiole twist, the whole-tree sway
— and per-frame CPU cost drops to near zero regardless of leaf count.

### B4 — The real constraint: the model, not the renderer

**Flag this before starting.** At 50k leaves/tree × 12 trees = 600k leaves, the
bottleneck is `M.stepLeaf()` running 600k times per simulated day, not rendering.
Three ways out, in order of preference:

- **Archetypes.** Simulate ~2–4k leaves per tree as today, and map many rendered
  instances onto each simulated one with per-instance colour jitter. Visually
  indistinguishable at canopy scale, and it preserves the model's exact behaviour.
  This is the recommended route.
- **Web Worker.** Move the day step off the main thread. Keeps every leaf real
  but adds a synchronisation problem and does not remove the cost.
- **Fewer leaves.** Defeats the purpose.

The archetype route means the honest claim becomes "~40k simulated leaves driving
600k rendered ones," which is worth stating in the UI rather than glossing.

### B5 — Shading

A custom `ShaderMaterial` doing what A1/A2 approximate, but properly: real
per-leaf normals, two-sided rendering, and a transmission term for backlit
translucency. Soft shadows via a shadow map, or cheaper, keep the baked AO from A1.

### B6 — Post

`EffectComposer` with `UnrealBloomPass`, a `BokehPass` for depth, and a custom
grade/grain shader pass. Better and faster than the canvas 2D equivalents.

### B7 — Cost to the project

`plan.md` states "open directly, no build step" three separate times, and
`scene.html:187` records dropping p5 specifically to keep the file network-free.
Three.js via an ESM `importmap` from a CDN preserves *no build step* but not
*no network*. That is a real regression against a stated project value — worth
deciding deliberately rather than discovering later. Vendoring a local copy of
three.js restores offline use at the cost of a ~600KB file in the repo.

**Effort:** 1–2 weeks. Highest ceiling, highest cost, and the one that risks
turning a finished thing into a rebuild.

---

## Option C1 — Watercolour

The thematically strongest option on this page: the model simulates pigment, and
watercolour *is* pigment. Reference technique: Curtis et al., *Computer-Generated
Watercolor*, SIGGRAPH 1997.

### C1.1 — Glazing gives you canopy depth for free

The structural insight that makes this cheap. Draw leaves with
`globalCompositeOperation = 'multiply'` at `globalAlpha ≈ 0.6–0.75`. Overlapping
washes darken automatically — so the canopy interior, where many leaves overlap,
goes dark **without computing occlusion at all**. Option A's AO pass becomes
unnecessary. Depth emerges from the medium.

This also means C1 can be tried *without* doing Option A first.

### C1.2 — Edge darkening

The signature of the medium: pigment migrates outward as a wash dries and pools
at the boundary. Per leaf, fill the path, then stroke the same path in the same
colour at ~1.4× alpha and a hairline width. Two calls instead of one. Nothing
else on this list buys as much "this is watercolour" per line of code.

### C1.3 — Paper

- A tiling cold-press paper texture, generated once at build (layered value noise
  is sufficient — no external asset needed, which keeps the file self-contained).
- Composited over the finished frame with `multiply` at low alpha.
- Also used to modulate pigment density, so washes granulate into the paper's
  tooth rather than sitting flat.

### C1.4 — Wet-in-wet and blooms

Slight random outward displacement per leaf path, plus an optional blurred copy
underneath at low alpha, gives the soft bleed of pigment into damp paper. Use
sparingly — over-applied it turns to mud. Consider keying bleed amount to the
model's `rain` value, so wet days literally bleed.

### C1.5 — Backgrounds

- Sky: a wet-in-wet wash. Visible bloom edges where colours meet, not a smooth
  linear gradient.
- Ranges: flat washes with a **hard top edge and a soft bottom** — which is
  exactly how watercolour mountains behave and happens to match the aerial
  perspective already implemented.
- Haze (`t.haze`) reinterprets beautifully: distant trees are *thinner washes*
  with more paper showing through, rather than colours mixed toward the horizon.
- Branches: dry-brush ink over the washes, drawn last.

### C1.6 — Perf note

`multiply` on several thousand small fills is meaningfully slower than
`source-over`. Mitigation: render each tree's canopy to its own offscreen layer
using `multiply` internally, then composite the finished layers normally. This is
what the `canopyLayer` flag in Phase 0 is for. The litter canvas (`litCv`) needs
the same treatment.

**Effort:** ~500 lines. Preserves the model's full colour granularity, since
washes are continuous. Highest payoff-to-effort ratio of the three C variants.

### BUILT — `style-watercolor.js`

Lives in **its own file**, not in `scene.html`. It registers on
`window.LeafStyles` and the Phase 0 registry merges it at boot, which meant
widening the seam a little: styles in another file get a `STYLE_API` object
(everything in `scene.html` is closed over by the IIFE and otherwise
unreachable), and three new hooks landed — `wash(rgb, role)` for the palette,
`afterSky()`, and `leafComposite`/`leafAlpha`/`paintLeaf` for the glaze. Loading
the file costs nothing until the style is selected.

**C1.1 was right, and it is measurable.** Glazing really does give canopy depth
for free. Simulating the multiply composite over the actual palette
(`out = (1-a)·dst + a·(dst·src/255)`, alpha 0.62):

| washes | colour | luminance | chroma |
|---|---|---|---|
| 1 | (201,172,131) | 176 | 70 |
| 3 | (144, 97, 47) | 105 | 97 |
| 6 | ( 87, 41, 10) | 51 | 77 |

Pale ochre at the canopy edge, rich amber in the middle, deep umber in the
interior — and chroma *peaks* around three washes rather than draining away. That
is a 3.4x edge-to-interior luminance range with **no occlusion computation at
all**, against 2.1x for `lit`, which needed a 22x22 grid and eight rays per leaf
to get there. Depth from the medium, exactly as the plan claimed.

**Three things the build turned up:**

- **The palette has to move first.** A wash multiplies toward dark, so it only
  reads as watercolour over a pale ground — glaze a mid-blue sky and you get mud.
  Hence `wash`, which repaints sky, ranges, meadow and bark onto paper white
  without touching any of the geometry that draws them. Background luminance goes
  from a median of 102 to 181. Bark deliberately barely moves (t = 0.16): the
  dark limbs are the drawing under the painting, and a pale wash needs them.
- **Pale is not the same as pastel, and the first pass got it wrong.** Lightening
  toward white costs absolute chroma faster than re-expanding it recovers, so at
  `t = 0.44` the outer canopy came out pale *and* grey — weak tea. At `t = 0.30`
  with chroma 1.45, median leaf chroma holds at 75 (same as the original) while
  luminance lifts 122 → 163. Pale AND saturated, which is the whole look.
- **The glaze has to track the density slider.** Depth is a function of how often
  leaves overlap, and that scales with density — so a fixed alpha is right at
  exactly one setting. At density 1.6 the interior would stack ~10 washes and go
  near-black, which reads as overworked mud rather than depth. `leafAlpha` is now
  a getter holding alpha x depth roughly constant (0.80 at density 0.3, 0.62 at
  1.0, 0.39 at 1.6). This is why `STYLE_API` exposes `density()`.

**Also in:** edge darkening (fill, then stroke the same path — the signature of
the medium, and two draw calls), a procedurally generated cold-press paper
multiplied over the finished frame, wet-in-wet blooms pooled into the sky, and a
*light* edge falloff instead of a vignette — a photograph darkens at the corners,
a painting runs out of wash and shows the paper.

**Not verified:** nobody has looked at it, same as Option A — headless Chrome
cannot render this page in this environment (it aborts on the unmodified baseline
too). Everything above is arithmetic over recorded draw calls. Perf in particular
is unmeasured: the canopy now costs a fill plus a stroke per leaf above 10px, and
`multiply` is a slower blend path than `source-over`. Watch the frame-cost
readout in the Scene panel; the stroke already drops out when the quality
watchdog steps down, and `PAPER_SIZE` / the `px > 10` threshold are the next
levers.

**Not built from the C1 plan:** the per-tree offscreen canopy layer (`canopyLayer`
is still just a documented flag). Drawing straight onto the main canvas with
`multiply` set once per canopy turned out to be correct anyway — leaves glaze
against the sky and against each other, which is what the medium does — so the
layer would only be a perf optimisation, and it is not obviously needed yet.
Wet-in-wet bleed on the leaves themselves (C1.4) is also not in; the sky blooms
carry that idea and per-leaf displacement risked mud.

---

## Option C2 — Painterly / brush-stroke

Reference: Meier, *Painterly Rendering for Animation*, SIGGRAPH 1996. Worth
noting why this one fits unusually well: Meier's method is **exactly your data
structure** — particles distributed over a surface, each rendered as an oriented
2D brush stroke coloured from the underlying model. You already have
particles-on-a-tree carrying per-particle colour. The technique was designed for
this.

**Requires Option A first.** Brush strokes without value structure are just
messier stickers.

### C2.1 — Stroke sprites

Pre-render 8–12 brush strokes at build as grayscale alpha masks in offscreen
canvases: tapered, loaded, dry-brush, split-bristle. Procedural generation is
fine and keeps the file self-contained.

### C2.2 — The tinting problem, and the atlas that solves it

Colourising an alpha mask per leaf per frame (`source-in` compositing into a
scratch canvas) is far too slow at thousands of leaves. Solution: **quantise leaf
colour to a palette and pre-render the cross-product, lazily.**

- Quantise `leaf.c` to ~64 entries spanning the season's gamut.
- Cache `strokes × palette` = ~768 small tinted sprites, built on demand.
- Per-leaf draw cost becomes a single `drawImage`. Faster than today's `Path2D` fill.

64 levels is well above what the eye separates in a canopy, so this costs
essentially nothing in perceived granularity — unlike C3, where quantisation is
visible by design.

### C2.3 — Stroke orientation and scale

- Orient along the outward vector from the canopy centroid, plus the wind term.
  Meier's principle: strokes follow the form. A canopy whose strokes all radiate
  outward reads as a mass; randomly oriented strokes read as noise.
- Scale strokes **up** with distance, not down. Impressionist convention is that
  abstraction increases with distance, and it neatly solves the problem of
  background trees looking under-detailed.

### C2.4 — Underpainting

Critical, and easy to miss. Before strokes, lay down a blurred low-resolution
canopy mass in the tree's average colour. Without it, gaps between strokes show
sky and the tree reads as sparse — which is the exact problem you are trying to
solve. With it, 800 strokes per tree can look like full foliage.

### C2.5 — Surface

Canvas-weave texture over the finished frame, and visible stroke work in the sky
and meadow too — a painted canopy over a smooth gradient sky looks like a
collage.

**Effort:** ~600 lines, plus Option A as a dependency. The most distinctive
result, and the most tuning-sensitive: stroke size, density and orientation all
have narrow good ranges.

---

## Option C3 — Ukiyo-e / woodblock

Turns the current weakness into the entire point: flat colour becomes deliberate.
Autumn foliage is one of the most-painted subjects in the tradition, so the
subject matter sits inside the form naturally.

**Does not need Option A** — the style explicitly rejects modelled lighting.

### C3.1 — Colour plates and registration

- Quantise the season to ~5–7 tones per species. Each becomes a "block."
- Draw each plate at a 1–2px offset from the key block. **Registration
  misalignment is the signature woodblock artifact** and is the cheapest,
  highest-impact single detail here.
- Slight per-plate alpha variation, as ink coverage varies across a pull.

### C3.2 — Key block

Dark outlines on trunks, branches, ridgelines and the meadow edge. At canopy
scale leaves get no outline (they would turn to mud); foreground hero leaves do.

### C3.3 — Bokashi

Hand-wiped gradation, most often at the horizon and the top edge. Implement as a
*banded* gradient, not a smooth one — the visible steps are the point.

### C3.4 — Flattened depth

The existing aerial perspective works against this style. Replace `t.haze`
mixing-toward-horizon with **discrete flat plane tones**: each depth layer gets
its own solid value, with no gradient between. This is a direct swap in
`refreshLeafColors`, not a rewrite.

### C3.5 — Surface and frame

Mulberry paper texture, subtle wood grain visible in the large flat areas
(directional noise, oriented per plate), a deckled edge, and optionally a border
with kentō registration marks.

### C3.6 — Composition

The style rewards strong asymmetry and aggressive cropping — a foreground trunk
running off the top edge, the ranges pushed to one side. This may mean revisiting
the fixed 1600×900 layout rather than only the paint layer.

### C3.7 — The honest cost

**Quantising to 5–7 tones per species discards most of the model's colour
granularity.** Every other option on this page preserves it. If the point of the
project is that a sourced pigment model drives what you see, this option
substantially breaks that link — the season would read as five discrete states
rather than a continuous progression. Worth being clear-eyed about before
investing: it will probably produce the most striking single frame and the least
informative animation.

Upside: flat fills are the fastest thing canvas 2D does, so this could run at
several times the current leaf density with no perf work at all.

**Effort:** ~400 lines. Cheapest of the three C variants, and the most likely to
look finished quickly.

---

## Comparison

| | A: Light & post | B: WebGL | C1: Watercolour | C2: Painterly | C3: Ukiyo-e |
|---|---|---|---|---|---|
| Effort | Weekend | 1–2 weeks | ~1 week | ~1 week + A | ~4 days |
| Needs A first | — | yes | no | **yes** | no |
| Keeps no-build-step | yes | **no** | yes | yes | yes |
| Colour granularity kept | full | full | full | ~full (64 levels) | **poor (5–7)** |
| Leaf density ceiling | ~15k | **~600k** | ~10k | ~10k | ~40k |
| Risk | low | high | low | medium (tuning) | low |
| Fixes "sparse stickers" | partly | **yes** | yes (glazing) | yes (underpainting) | no — makes it a style |

---

## Suggested order

1. **Phase 0**, always. ~150 lines, and it is what makes "try a few" cheap
   instead of four forked files.
2. **Option A.** Even if you end up on C1 or C3, you will have learned what the
   scene looks like with real light, and A is a hard dependency for B and C2.
3. **Then one of C1 / C3** — they are the cheapest routes to a look that reads as
   *made* rather than *generated*, and neither depends on A.
4. **B or C2 last**, once you know which look you actually want. Both are large
   investments that only pay off in a direction you have already chosen.

If only one thing gets built: **A, then C1.** Watercolour over a lit scene keeps
every property the project already values — self-contained, model-driven,
full colour granularity — and the medium is a direct expression of the subject.
