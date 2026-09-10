# Phase 8 — Pixel-level leaves from an interpolated image grid

**Status: Steps 0–4 built for bigtooth maple. Oak and aspen have no cells yet.**
All 43 maple cells are generated and in `cells/bigtoothMaple/`; they register well enough
to blend (worst IoU 0.945), leaf space is defined and checked, and `leaf-season.html`
runs a season of four model leaves drawn entirely from the grid. Step 5 — per-leaf tint
and multiple specimens per cell — has not been started, and the technique has been
proven only at a handful of leaves, which was the scope.

| file | what it is |
|---|---|
| `grid.js` | the axes and target colours, shared with `tools/cells.js` so targets and test cannot drift |
| `leafspace.js` | Step 2 — the common space every cell is put into |
| `interpolate.js` | Steps 3 and 4 — the per-pixel blend, its cache, and the draw |
| `leaf-season.html` | **the visualization**: a season of four model leaves, drawn from the grid |
| `grid-viewer.html` | per-cell acceptance test, cell by cell |
| `contact-sheet.html` | static grid of the maple cells, measurements baked in — opens without a server |
| `tools/leafspace-build.js` | the registration gate; `--write` emits `_alpha.png` |
| `tools/cells.js` | regenerates the target-colour tables from the live model |
| `tools/png.js` | zero-dependency PNG read/write, so the tooling needs no install |

Everything except `contact-sheet.html` reads image pixels, so **serve the repo root** —
`python -m http.server` — rather than opening the files directly.

## The idea in one paragraph

Instead of drawing a leaf as a flat-filled silhouette whose single colour comes from
`M.leafColor(leaf)`, draw it as an **image sampled from a 2D grid of reference leaf
images**. The grid's two axes are driven by the existing model. Between the reference
images, every pixel is interpolated: for an output pixel at position `(u,v)` in leaf
space, look up that same `(u,v)` in the four surrounding grid images and blend by
distance. The result is a leaf that carries real internal structure — veins that stay
green after the blade has turned, margins that brown first, blotches — none of which a
single average colour can express.

The model is unchanged. It decides *where in the grid* a leaf sits. The grid decides what
that looks like. No biology moves into the renderer, which is the discipline the whole
project is organised around (see `../plan.md`).

## Scope for this phase — deliberately small

Previous phases built a twelve-tree grove with ~9.6k simulated leaves (`scene.html`).
**That is out of scope here.** Per-pixel work at that leaf count is a different problem and
would force the technique to be judged on frame budget before it has been judged on
whether it looks good.

1. **First:** a handful of leaves, stationary, on an otherwise empty page. Sliders or a
   scrubber to drive them across the grid. This is where the technique is proven or not.
2. **Then, maybe:** one tree.
3. **Later, if ever:** back to the grove. Performance notes for that case are recorded at
   the bottom so they are not rediscovered, but they are not this phase's problem.

## Source images — AI generated, not photographed

Decided: the reference images are **generated with AI image tools that can hold the leaf's
exact shape constant while varying colour**, not photographed. This removes what would
otherwise have been the hardest part of the pipeline. A real drying leaf curls and shrinks
by up to ~20%, so photographed cells would have needed point-correspondence marking and
warping onto a shared outline before they could be blended without ghosting. Generated
cells arrive pre-registered.

**Assumption to hold for now:** brown/dead leaves are still *flat*. Real ones curl and cup.
Revisit later — it is a silhouette-and-shading problem, not a colour problem, and it is
separable from everything else here.

**The new risk this trades into:** generative drift. Two cells that are supposed to be the
same leaf at different colours can come back with a moved vein, a different tooth, a
shifted notch. Blending those produces exactly the ghosting the photo pipeline was going to
produce. So there must be a **registration check**: before a cell is accepted into the
grid, compare its alpha mask against the reference cell's and reject anything past a small
IoU / edge-distance threshold. Cheap to write, and it is the difference between this
working and this looking subtly smeared for reasons nobody can name.

---

## The axes

### Why there are exactly two

The model gives each leaf four pigment numbers (`model.js`, `makeLeaf` ~line 387):

| pigment | what it is | behaviour |
|---|---|---|
| `chlorophyll` | green | starts ~1, decays |
| `carotenoid` | yellow | **fixed per leaf, never changes** — hidden under the green, revealed as green goes |
| `anthocyanin` | red | starts at 0, actively manufactured; needs sun, sugar, cool-not-freezing nights |
| `tannin` | brown | end of life |

Four numbers, but not four degrees of freedom:

- **Yellow is not free.** `leafColor` (model.js:648) weights it as
  `carotenoid × (1 − chlorophyll)`, and `carotenoid` is a per-leaf constant. Yellow is a
  deterministic function of green. It contributes no axis.
- **Green and brown never coexist.** Measured across 621,884 leaf-days (60 condition sets ×
  2 seeds × 120 days × 3 species): leaves with `chlorophyll > 0.6` *and* `tannin > 0.4` are
  **0.0%** of the population, in all three species. Browning only ever happens after the
  green has gone. So "how much green is left" and "how brown is it" are never both in play
  and can be laid end to end on one axis.

That leaves two.

### Definition

```
x  =  min(0.999,  0.5 * (1 - chlorophyll)  +  0.5 * min(1, tannin * 1.6))
y  =  anthocyanin / (anthocyanin + carotenoid * (1 - chlorophyll))
```

- **`x` — how far through the change.** `0` = full green. `0.5` = fully turned, no green
  left and not yet dying. `1.0` = dead brown. The `1.6` on tannin is a free tuning constant
  chosen so the brown end saturates at roughly the tannin levels the model actually
  reaches; it is not derived from anything.
- **`y` — which way it turned.** `0` = it went yellow. `1` = it went red. This is the red
  pigment's share of the total autumn pigment.

`y` is **undefined when the leaf is fully green** (both numerator and denominator go to
zero). That is not a bug — it is why the whole left edge of the grid is a single colour.

### Two facts that constrain the grid

**1. The top of `y` is never reached.** Measured maximum red share, 95th percentile across
all conditions:

| species | max red share |
|---|---|
| bigtooth maple | **0.82** |
| Gambel oak | **0.73** |
| quaking aspen | **0.36** |

Generate a genuinely scarlet maple and file it at `y = 1.0` and nothing will ever index it.
Build the grids against these ceilings, not against 1.0.

This ceiling is itself worth interrogating. `../plan.md` already flags palette judgment as
"the least verifiable part of the model," and notes maple peaking near 0.97 anthocyanin —
close enough to the clamp that a good year has little headroom over an average one. A grid
laid out visually makes that legible in a way a column of numbers does not. **If the reds
look weak once the grid exists, suspect the model's `anthoPotential` / anchors, not the
generated images.**

**2. Aspen barely has a second axis.** Its red share spans 0.01–0.36 and is essentially
flat with respect to `x`. Aspen is a 1D strip wearing a grid's clothes. Two rows is
generous.

---

## What the grid looks like

Left edge: one solid green column, identical top to bottom (no autumn pigment exists yet,
so `y` has nothing to act on). Moving right, that column fans open into a vertical spread —
yellow at the bottom, red at the top — peaking in saturation around `x ≈ 0.5`. Then it
closes back down toward brown, but **not to a single point**: a leaf that browned out of
red stays measurably warmer than one that browned out of yellow, so `y` still carries
meaning at the far edge.

Not a lens, not a wedge. A well-used rectangle — maple occupies 79–83% of a 64×64 binning
of it.

### Target colours per cell

Computed by inverting the `(x,y)` definition back to pigment state and running the result
through the live `M.leafColor`. These are the **average** colour each generated image
should land on; the image's job is to distribute that average across real leaf structure.

Regenerate with `node pixel/tools/cells.js`, which prints these tables in markdown
straight from the live model. If `model.js` changes, re-run it — the tables below are
stale until you do.

#### Bigtooth maple — 8 × 6, `y` ceiling 0.82

| y \ x | 0.00 | 0.14 | 0.29 | 0.43 | 0.57 | 0.71 | 0.86 | 1.00 |
|---|---|---|---|---|---|---|---|---|
| **0.82** | `#407b2d` | `#7b612b` | `#9c542a` | `#b3552a` | `#b8552b` | `#aa542c` | `#a1532c` | `#9a522d` |
| **0.66** | `#407b2d` | `#6b712c` | `#92682c` | `#b4612b` | `#b95b2c` | `#a9582c` | `#9f572d` | `#98552d` |
| **0.49** | `#407b2d` | `#637a2d` | `#8a782d` | `#b5762e` | `#bc6e2e` | `#a7662f` | `#9b612f` | `#945e2f` |
| **0.33** | `#407b2d` | `#5e7f2e` | `#84832f` | `#b68a30` | `#be7f30` | `#a67030` | `#996830` | `#906330` |
| **0.16** | `#407b2d` | `#5a822e` | `#7f8c2f` | `#b79b32` | `#c18f32` | `#a47832` | `#966e31` | `#8e6731` |
| **0.00** | `#407b2d` | `#58852e` | `#7c9330` | `#b8ab33` | `#c39d34` | `#a37f33` | `#957232` | `#8c6a32` |

#### Gambel oak — 8 × 4, `y` ceiling 0.73

| y \ x | 0.00 | 0.14 | 0.29 | 0.43 | 0.57 | 0.71 | 0.86 | 1.00 |
|---|---|---|---|---|---|---|---|---|
| **0.73** | `#2a5926` | `#5c5727` | `#885528` | `#ae5329` | `#b5512a` | `#a7512c` | `#9e502c` | `#97502d` |
| **0.49** | `#2a5926` | `#4c5f28` | `#76672a` | `#ac702c` | `#b96d2e` | `#a2642f` | `#965f2f` | `#8f5c2f` |
| **0.24** | `#2a5926` | `#456328` | `#6c712a` | `#aa882f` | `#bb8431` | `#9f7131` | `#926731` | `#8b6230` |
| **0.00** | `#2a5926` | `#416528` | `#65792b` | `#a99d31` | `#bd9734` | `#9d7932` | `#8f6d32` | `#886631` |

#### Quaking aspen — 8 × 2, `y` ceiling 0.36

| y \ x | 0.00 | 0.14 | 0.29 | 0.43 | 0.57 | 0.71 | 0.86 | 1.00 |
|---|---|---|---|---|---|---|---|---|
| **0.36** | `#5e9933` | `#7d9532` | `#9e9031` | `#c18b30` | `#c37f30` | `#ae7330` | `#a16c30` | `#996730` |
| **0.00** | `#5e9933` | `#78a034` | `#9aa934` | `#c8b635` | `#cba435` | `#ad8833` | `#9e7a32` | `#947132` |

### Why those grid sizes

Measured error from snapping a leaf to the **nearest** cell (mean ΔE in CIELAB; ΔE ≈ 2 is
roughly where a difference becomes noticeable side by side). Bilinear interpolation between
cells roughly halves these, which is what makes 8 columns sufficient:

| grid | maple | oak | aspen |
|---|---|---|---|
| 12 × 12 | 1.9 | 1.2 | 2.4 |
| **8 × 8** | **2.5** | **1.5** | **3.5** |
| 6 × 6 | 3.1 | 1.8 | 4.6 |
| 4 × 4 | 4.4 | 2.3 | 6.9 |

With the left column collapsing to a single image per species, the real generation budget
is **maple 41, oak 29, aspen 15 — about 85 images total**, plus variants (below).
(Measured against the live model by the Step 0 viewer: 42 / 26 / 15 = 83. See Step 0.)

---

## Implementation plan

### Step 0 — the grid viewer — **built**

`grid-viewer.html`. Lays out one species' grid with the model's target colour in a strip
beside every cell, and marks the cells the model barely reaches. Serve the repo root and open
it — `python -m http.server`, then `/pixel/grid-viewer.html`. It also takes
`?species=gambelOak&dir=cells/oak-v2/`.

- Cells load from `<dir>/x{col}_y{row}.png`, default `pixel/cells/<speciesKey>/`. Row 0 is
  `y = 0`; the top row is the species' ceiling.
- Each generated cell is measured: alpha-weighted mean colour (in linear light, matching the
  Step 3 blend space — switchable to sRGB), against the target, reported as ΔE. Under 2 is
  green, past 5 is red. That number is the acceptance test.
- A cell can be dropped onto the grid, or a whole folder loaded, without a server — useful
  while iterating on a generator prompt, since browsers refuse to read image pixels over
  `file://`.
- The left column is drawn as one image shared down the column, because `y` is undefined on a
  fully green leaf.
- Occupancy is measured live, by running the README's own condition sweep (60 sets × 2 seeds
  × 120 days) through `grid.js`'s forward axes and accumulating the bilinear weight each cell
  would be read with. Takes under a second per species.

Target colours, axes and ceilings live in `grid.js`, which `tools/cells.js` also prints from,
so the acceptance test and the generation targets cannot drift apart. That closes half of the
"Known hazard" below — the grid and the equations still need a check that diffs the table.

**One correction from building it.** By the strict test — a cell no leaf-day ever draws blend
weight from — **no cell of any species is unreachable**. The rectangle is entirely used, just
very thinly at the edges, so what decides the budget is a *rarity* threshold, not
reachability. The viewer exposes it (default: skip below 0.10% of total blend weight), giving
maple 42, oak 26, aspen 15 — 83 images, near the 85 estimated below. The "maple 41" figure
does not reproduce as a hard count; 43 is the number with only the shared column removed.

### Step 1 — generate and register — **maple done, oak and aspen not started**

Generate cells against the target colours above. Store as PNG with alpha, one directory
per species, named `x{col}_y{row}.png`.

All 43 maple cells exist in `cells/bigtoothMaple/`. Their colours were judged by eye
against the targets and accepted; the measured ΔE per cell is baked into
`contact-sheet.html`, which lays the grid out with each target beside what the image
actually averages to and needs no server to open. Colour accuracy is not uniform — the
brown end (`x7`) runs 15–26 ΔE dark, and the shared green `x0_y0` reads grey against its
target — but the palette reads correctly to a human, which is the test that matters here,
and the model is deliberately not being retuned to chase it.

**The registration check moved to Step 2**, where it runs over the whole grid at once
against a consensus silhouette rather than pairwise against a nominated reference cell.
That is a better test — it has no privileged cell to be wrong about — and it needed leaf
space to exist first, since cells arrive at different resolutions and cannot be compared
until they are in a common frame.

Generate flat and shadowless — **albedo only, no baked highlight, no cast shadow, no
specular**. The renderer does its own lighting, haze and shadow. A baked highlight will
fight it the moment a leaf rotates. This matters more than it sounds like it does.

### Step 2 — leaf space — **built**

`leafspace.js` defines the space; `tools/leafspace-build.js` proves the maple grid sits in
it and emits the one artefact Step 3 needs. Run `node pixel/tools/leafspace-build.js` to
check, `--write` to regenerate. It exits non-zero on failure, so it works as a gate.

```
leaf space = the cell's alpha bounding box, resampled to 1024 × 1024.
```

Three decisions are folded into that sentence:

- **The bounding box, not the image frame.** The maple cells arrived in 12 distinct frame
  sizes from 572×546 to 1024×976 — whatever the generator happened to emit. The alpha
  bbox is the leaf; the frame is noise. Each leaf fills 94–100% of its own frame, so
  there was little padding to discard, but the *scales* differed almost 2×.
- **Squashed to a square, not letterboxed.** Cell aspect ratios span 1.046–1.075.
  Normalising that away is part of what makes `(u,v)` line up. The true proportion is not
  lost — it is recorded as `aspect` (1.0539 for maple) and Step 4 restores it in the
  destination rectangle it already computes.
- **One alpha for the whole grid, not one per cell.** See below.

### What the registration check measured

Against the shared silhouette, over all 43 maple cells:

| | |
|---|---|
| IoU, worst cell | **0.945** (`x4_y5`) |
| IoU, mean | **0.968** |
| colour gap, worst cell | 4.4% of the silhouette |
| aspect spread | 1.046–1.075 |

`MIN_IOU` is set to 0.93 — about a point below the worst current cell. Loose enough that
ordinary generator noise does not trip it, tight enough to catch a regenerated cell that
has actually moved a lobe.

**The cells register at vein level, not just at the outline.** This was worth confirming
separately, since IoU only sees the silhouette and it is the veins that would ghost. An
edge-energy test over 50/50 blends is *not* a usable metric here — calibration showed a
cell blended against a copy of itself shifted 0.4% of its width already scores 0.78, so
the measure saturates at any sub-pixel offset and cannot tell "slightly soft" from
"broken". Rendering the blends settles it: the worst-scoring quad walks green → yellow →
orange with the midrib and every lateral vein holding sharp. The cells are one
illustration recoloured, which is the property the whole technique depends on.

### Why the grid shares a single alpha

Every cell is meant to be the same leaf, so per-cell silhouette differences are generator
noise, not signal. Blended, they are worse than noise: where one cell is opaque and its
neighbour transparent, the blend composites leaf against nothing and leaves a **grey
fringe along the lobe tips**. It is clearly visible at 1024 and invisible at the ~64px a
leaf actually draws at, which is exactly the kind of artefact that survives into a later
phase because nothing ever forces you to look at it.

So the alpha is computed once for the species — the per-pixel mean over all cells,
written to `_alpha.png` — and every cell contributes colour only. The fringe cannot occur,
and Step 3 blends three channels instead of four.

Two consequences that are not optional:

- **Colour has to exist outside each cell's own mask.** Where the shared alpha says leaf
  but this cell was transparent (up to 4.4% of the silhouette, worst case), the cell has
  no colour to give. `fillOutward` extends the nearest opaque colour into that band by
  two chamfer passes — O(pixels), where a dilation loop wide enough to close the gap
  would not be.
- **The mean alpha is too soft and has to be pulled back.** Averaging 43 silhouettes that
  disagree by a pixel or two ramps the edge across the whole disagreement band: measured
  22.7px against a single cell's 12.8px. `ALPHA_GAIN = 1.4`, applied around 0.5 so the
  silhouette does not move, restores it to 1.02× a real cell. Sharper than that is not
  crisper, it is sharper than the source images are, and it aliases. The measured
  gain/width curve is in `leafspace.js` beside the constant.

### Artefacts

Both are generated, both live in the species' cell directory, and **nothing notices if
they go stale** — re-run the tool after changing, adding or regenerating any cell.

| file | what it is |
|---|---|
| `_alpha.png` | the shared silhouette, 1024², the alpha Step 3 composites with |
| `_leafspace.json` | aspect, per-cell IoU and colour gap, source and bbox sizes |

`tools/png.js` is a minimal zero-dependency PNG reader/writer (8-bit RGBA,
non-interlaced) so the check runs in Node like the rest of the tooling. The repo has no
`package.json` and this did not seem worth starting one over.

### On the cell files

They were renamed into the layout `grid-viewer.html` and `grid.js` already expected:
`cells/bigtoothMaple/x{col}_y{row}.png`, 0-based, **row 0 is `y = 0`** (turned yellow) and
the top row is the species' ceiling. Column 0 is the single shared green image `x0_y0.png`
— `x0_y1` … `x0_y5` do not exist, because `y` is undefined on a fully green leaf.

### Step 3 — interpolation — **built**

`interpolate.js`. For a leaf at `(x, y)`, find the four surrounding cells and bilinearly
blend per pixel, in linear light.

```js
LeafInterp.load({ species: 'bigtoothMaple' }).then(function (gi) {
  var canvas = gi.forLeaf(leaf);     // a model leaf, straight in
});
```

- **Linear light, via lookup tables.** sRGB in, linear to blend, sRGB out. Blending
  gamma-encoded values darkens midpoints and would make yellow→red muddy, which is
  precisely the transition the project is about. `Math.pow` per channel per pixel is not
  affordable, so the forward direction is a 256-entry table indexed by byte and the
  inverse is quantised to 4096 steps — finer than 8-bit output can express, so it costs
  nothing.
- **Alpha is not blended.** Step 2 settled that: the grid shares one silhouette, so
  `_alpha.png` is composited in whole and only three channels are interpolated.
- **Cached on quantised `(x, y)`,** six sub-steps per cell interval, 48 composites held,
  least-recently-used evicted. A four-leaf season runs at roughly 24 hits per 4 misses.

**Compositing resolution is not leaf-space resolution.** Leaf space stays 1024 and remains
the source of truth; blending at 1024 is 3.1M pixel-blends per cache miss and stalls a
frame for no visible gain. `WORK_PX = 512` measures **6.0 ms** per miss and ~34 MB for the
43 cells. 384 was the first choice and was wrong for a reason worth recording: it looks
identical on a 1× display and visibly soft on a 2× one, where a 300px leaf is 600 device
pixels and the composite was being upscaled.

### Step 4 — draw — **built**

`interp.draw(ctx, canvas, cx, cy, w, rot)` — a `drawImage` under the transform, replacing
the `Path2D` fill. At a few stationary leaves it is free.

The one thing it must not forget: **leaf space is square and the leaf is not.** Step 2
squashed the bounding box to a square to make `(u,v)` line up and recorded the true
proportion as `aspect` (1.0539). Step 4 is where that comes back — the destination height
is `w / aspect`. Drawing the composite square would stretch every leaf by 5%.

### Seeing it — `leaf-season.html`

Four bigtooth maples from `M.createSim()` in a 2 × 2, stepped a simulated day at a time,
each drawn by blending the four cells around wherever the model has put it. **Serve the repo root and
open `/pixel/leaf-season.html`** — like the other viewers it reads image pixels, which
browsers refuse over `file://`.

The weather controls, transport and HUD are lifted from `../old attempts/scene.html`
unchanged, because they are the same controls driving the same model.

- A **grid map** shows where the four leaves currently sit, over the cells at their target
  colours, with a ring around the quad being blended. The mapping from model state to
  image is the thing being demonstrated, so it is on screen rather than implied.
- Each leaf carries its `(x, y)` and its four pigment bars — the numbers the axes are
  computed from.
- **The `Flat` button** (or <kbd>F</kbd>) draws `M.leafColor()` through the same
  silhouette instead. Flipping between them is the argument for this whole phase reduced
  to one keystroke: same shape, same model, colour only. It should be possible to lose
  that comparison, and if a future grid does lose it, this is where it will show.
- `?day=62&flat=1&seed=9&temp=-2&controls=1` — a particular day of a particular season is
  reproducible from a URL, for a screenshot or to compare two settings side by side.

### One correction to Step 2, found by building on it

Step 2 defined `fillOutward` as repairing colour where the shared alpha calls a pixel leaf
and the cell was transparent. That was not enough, and the shortfall was invisible until
leaves were drawn against a dark background: **a pale halo around every leaf.**

The cells carry a light fringe in their antialiased edge — measured mean brightness 152
against 127 in the blade — and canvas returns unpremultiplied colour there, which
amplifies error as alpha falls. `fillOutward` was only replacing colour below
`ALPHA_CUT = 128`, so the 128–249 ramp kept that fringe, and the shared alpha then
composited it at nearly full strength.

The fix is that **"is this leaf?" and "is this pixel's colour trustworthy?" are different
questions with different thresholds.** `COLOUR_TRUST = 250`: colour is carried outward
from fully opaque pixels only, across the whole ramp rather than just outside the mask.
This is a hazard specific to sharing one alpha across cells — with per-cell alpha the
fringe is always drawn at the low alpha it came with, and stays harmless.

### Step 5 — keep the variation

Two mechanisms, both needed, or a canopy of these reads as wallpaper:

- **Per-leaf tint.** The model already gives each leaf its own colour anchors
  (`model.js:415`, constants at `model.js:613`). Measured displacement: **5.6 ΔE mean, 15.2
  max** — a large part of what makes the existing canopy look alive. Apply it as a colour
  multiply *after* the grid lookup, not baked into the cells.
- **2–3 distinct specimens per cell**, assigned to each leaf at creation, so neighbours are
  not literally the same pixels. This multiplies the generation budget, so decide after
  Step 0 whether it is needed at this scale — at "a few leaves on a page" it is not.

---

## Measured background (so it is not re-derived)

All figures from 621,884 leaf-days: `tempOffset` ∈ {−4,−2,0,2,4}, `cloudCover` ∈
{5,25,55,85}, `winterPrecip` ∈ {0.5,1.0,1.8}, seeds {1,7}, 120 days, all three species.

- **The colour gamut is genuinely 2D.** PCA in CIELAB: two components explain **99.47%** of
  variance, off-plane RMS **1.86 ΔE**. Per species 99.1–99.5%.
- **Because the four anchors are near-coplanar.** Brown ≈ `0.55·green − 0.06·yellow +
  0.50·red`, residual only **7.6 RGB levels** (oak 9.1, aspen 6.0). Brown is barely an
  independent colour in this palette — it sits almost on the green–red midline, darkened.
- **But the *state* → colour map is 3D.** Binning by any 2D pigment index leaves a p99 tail
  of 7–21 ΔE, and the worst 1% of cells carry 5–18× the mean tannin. A 3D index (`chl`,
  `anth`, `tannin`) drops p99 to ≤ 3. This is *why* `x` folds browning onto the end of the
  progress axis rather than treating brown as a third pigment dimension — and the fold is
  only legitimate because green-and-brown is measured at 0.0%.
- **Occupancy per corner region** (% of leaf-days):

  | species | green & fresh | green & dead | turned yellow | turned red | turned & dead |
  |---|---|---|---|---|---|
  | bigtooth maple | 71.7% | **0.0%** | 6.9% | 3.2% | 4.2% |
  | Gambel oak | 72.2% | **0.0%** | 0.9% | 0.0% | 20.4% |
  | quaking aspen | 36.6% | **0.0%** | 35.5% | 0.0% | 4.3% |

  Note oak spends 20.4% of its leaf-days brown — it is the species that will exercise the
  right-hand edge of the grid hardest. And ~70% of all leaf-days are plain green, because
  the season is mostly summer; the interesting part of the grid is visited briefly.

---

## Deferred — do not solve these yet

- **Curl on dead leaves.** Assumed flat for now. Separable: silhouette + shading, not
  colour.
- **Backlighting.** Half the leaves in a real autumn scene are lit from behind and glow. A
  second image set per cell (back-lit) blended by leaf facing would probably be the single
  biggest "sells it" factor, and it is cheap to describe and expensive to generate. Not now.
- **Grove-scale performance.** When/if this returns to `scene.html`'s ~9.6k leaves: rotated
  `drawImage` at small sizes runs somewhere between as fast as and 3× slower than a path
  fill; pre-scaled mip copies at ~3 sizes are needed or small leaves both alias and cost
  more than they should; composited cells must be cached lazily, since a single frame only
  touches a few dozen; and `slowmachine.js` (the existing regression test asserting every
  held leaf is still drawn under slow frames) must be re-run, because the existing fallback
  gives up render scale rather than leaves and that trade needs rechecking with image draws.
- **Species beyond the three.** Nothing here is species-specific except the `y` ceiling and
  the row count.

## Known hazard

Once the grid exists, **it becomes the source of truth for what autumn looks like**, and
`anthoPotential`, the HSL anchors and `TINT_AUTUMN_CARRY` in `model.js` quietly demote from
colour decisions to routing decisions. That is arguably an improvement — those constants
are hand-picked and flagged as the least verifiable part of the project. But the palette can
then drift out of agreement with the equations with no test catching it: `check-docs.js`
guards `leaf-phenology-data.md` §11.5 against `model.js`, and nothing would guard the grid
against either. Worth a check that regenerates the target-colour table and diffs it.
