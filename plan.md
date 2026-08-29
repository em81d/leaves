# Fall Leaf Color Simulation — Project Plan

## Goal
A science-driven, interactive visualization of deciduous leaves changing color and falling in autumn. Users can adjust environmental variables (temperature, wind, sunlight, precipitation) and see the effect on leaf color and abscission (falling) over a compressed simulated season.

**Development approach:** build the biological/environmental model FIRST as pure logic (no rendering), validate it with a minimal grid-of-colored-squares prototype, THEN invest in a polished visual layer. Do not skip ahead to visuals before the model behaves correctly.

**Status:** Phases 1, 2 and 4 complete. Phase 3 partially complete — see the phase list. 40 automated checks passing.

| File | Role |
|---|---|
| `model.js` | Phase 1. Pure logic, no DOM. Runs in browser and Node. |
| `index.html` | Phase 2. Grid prototype + sliders. Open directly, no build step. |
| `scene.html` | Phase 4. The visualization: a canvas fall scene, twelve trees, ~9.6k model-driven leaves, a snow-bearing skyline. Open directly, no build step. |
| `test-model.js` | `node test-model.js` — validation harness, 40 checks. |
| `calibrate-species.js` | Bisects each species' `sCrit` onto a target completion date. |
| `check-docs.js` | Guards `leaf-phenology-data.md` §11.5 against drifting from `model.js`. |
| `leaf-phenology-data.md` | All sourced data + the research behind every constant. §11 is the live calibration; §1–10 are the derivation. |
| `plan-visual.md` | Phase 6. How the scene is *painted* — the style seam, and the candidate looks. Option A is built; B/C1/C2/C3 are open. |
| `style-watercolor.js` | Phase 6, Option C1. A style in its own file, registered into `scene.html`'s seam. |
| `scene-grove.html` | Phase 7. A **second take** on the visualization, not a style of the first: deeper grove, curved tapered limbs, reworked ground and skyline, deliberately faint light. Open directly. |

---

## Decisions already made
- **Site:** **Wasatch montane, semi-arid** — reference point Park City UT, 40.65°N, ~2100 m. Moved here from an original New England calibration; see `leaf-phenology-data.md` §11 for what that change required. Latitude is exposed as a control over 32–46°N.
- **Species variety:** **bigtooth maple, Gambel oak, quaking aspen** — the three that carry most of Utah's fall color. Parameter sets feeding the same equations, not separate code paths. The eastern maple/oak/birch trio these replaced mapped onto the same three roles, and swapping them required no equation changes — only the config table — which is what the config-table decision was for.
- **Time pacing:** Compressed auto-play. A full season (~120 simulated days, Aug 1 → Nov 28) plays out in ~90 s at 1×, with a speed multiplier slider. Environmental sliders modulate a baseline seasonal trajectory rather than acting as independent instantaneous variables.
  - **This is now settled rather than assumed.** Zohner et al. 2023 found the *sign* of a temperature effect depends on whether it lands before or after the solstice (−1.9 d/°C pre, +2.6 d/°C post). An instantaneous-override slider cannot express a sign that depends on timing; a baseline modulator can. See `leaf-phenology-data.md` §5.
- **Constants provenance:** ~~Values are best-estimate synthesis, NOT verified against live datasets.~~ **Superseded.** A research pass against the literature was done; every constant now carries a provenance tag in `model.js`:
  - `[V]` verified against a published source
  - `[P]` plausible — indirect or non-peer-reviewed support
  - `[TUNE]` free parameter inside a published range
  - `[GUESS]` no published range and no local record to calibrate against; direction sourced, magnitude invented
  - The `[GUESS]` tag exists because of the move west: the Wasatch has no open coloration record equivalent to Harvard Forest's HF003, so values that were anchored to a documented pattern in New England are now anchored only to a qualitative description.

---

## Model Design (Phase 1 — pure logic, no rendering) — IMPLEMENTED

### Per-leaf state
- `chlorophyll` (0–1, starts ~1) — the green mask
- `carotenoid` (0–1, constant per leaf) — yellow, always present, revealed as chlorophyll fades
- `anthocyanin` (0–1, starts at 0) — red, actively *produced*, not revealed
- `tannin` (0–1) — brown, end-of-life state
- `sugar` (0–1) — **added during Phase 1.** Substrate pool for anthocyanin synthesis. Makes "cloudy autumn → duller reds" emergent (fewer photons → smaller pool → less substrate) instead of requiring a separate hand-added term. Borrowed from the NetLogo reference model, §7.
- `S` (raw accumulated senescence rate) and `senescence` (0–1, normalised)
- `anthoBlocked` (bool) — latched by the first freeze
- `marcescent` (bool) — **added during Phase 1.** Per-leaf, not a rate: on some leaves the abscission layer never fully develops.
- `anchors` — this leaf's four resolved RGB color anchors (green/yellow/red/brown)
- `attached` (bool), `fellOnDoy`
- `p` — resolved species profile with per-leaf jitter

### Daily/tick environmental inputs
- Temperature — daily **minimum** drives the model (the best-performing published models use minimum, not mean), with a fixed diurnal range giving the daytime high
- Photoperiod — derived from simulated date + latitude (Forsythe CBM model)
- Sunlight — clear-sky seasonal insolation curve × cloud cover
- In-season precipitation
- Wind speed (seasonal mean → stochastic daily gust)
- **Antecedent Jan–Mar precipitation** — *added in Phase 3.* Not a daily driver; a seasonal conditioner set before the season starts. This is the primary control in the western US.

### Core equations — as implemented

**Senescence clock (master trigger):** Delpierre DM2 — a photoperiod-gated cold-degree-day sum, accumulating from the summer solstice (DOY 173).
```
R = (T_sen − T_min)^x · (pSen / dayLength)^ySen     when dayLength < pSen AND T_min < T_sen
senescence = S / (sCrit · winterPrecipScale)
```
`ySen` is **per species**: 0 makes a species a pure thermal accumulator with no photoperiod dependence at all. Quaking aspen uses that, because Michelson et al. 2018 found aspen senescence onset "incompatible with the trigger being the day length per se." Species-specific weighting of photoperiod vs thermal forcing is the documented position, not a workaround.

**Chlorophyll decay:** **logistic**, not exponential.
```
dChl = −k · chlDecay · dSenescence · chl · (cap − chl)
```
The original exponential form front-loads the loss (rate ∝ chl, so the biggest absolute drop comes first), which stripped the green weeks before the cool nights arrived and left nothing degrading during the anthocyanin window — maple peaked at a muddy 0.23. Real chlorophyll curves are sigmoid, which is why the literature needs breakpoint analysis to locate onset at all.

**Anthocyanin (red) production:** coupled to the chlorophyll *degradation rate*, not to absolute chlorophyll — that is what reproduces the observed r = 0.60–0.72 correlation.
```
dAnth = k · anthoPotential · sun · coolness · sugar · chlLoss
```
Requires light, sugar, and cool-but-not-freezing nights. **Freezing latches production off permanently** rather than merely slowing it — freezing destroys the synthesis mechanism.

**Color composition:** weighted blend of four per-leaf anchors by pigment "mass". Carotenoid weighted by `(1 − chlorophyll)` because it is revealed rather than produced; tannin over-weighted because brown dominates at cell death. Orange is not a special case — it falls out of yellow + red mixing.
- Anchors are held in **HSL** and carry **per-species green** plus a **per-leaf tint** (hue/saturation/lightness), so no two leaves start the same color. Deliberately kept out of `chlorophyll`, which is a state variable — scattering that would couple how a leaf *looks* to when it *turns*.

**Abscission (falling):** wind is a **multiplier on biological readiness**, never an independent cause.
```
readiness = (senescence − fallFloor) / (1 − fallFloor)     [0 if below the floor]
P(fall)   = k · readiness² · windMultiplier  ÷  (1 + 0.9·chl + 0.35·anth)
```
Attachment resistance orders green > red > yellow, matching measured petiole detachment force. Verified: a sustained 12 m/s gale strips 0.00 % of the canopy in August but brings 50 % leaf-off forward by 8 days.

**Marcescence:** a marcescent leaf's readiness is scaled to 0.10 **and it is exempt from the hard-freeze abscission bonus entirely** — freezing is precisely what interrupts abscission-layer formation, so the freeze that strips its neighbours is what locks this leaf on.

**Frost — two discrete tiers, not a gradual curve:**
- Light frost (0 to −2 °C): abscission layer hardens, senescence nudged, anthocyanin latched off
- Hard freeze (≤ −2 °C): cells rupture → tannin spike, chlorophyll ×0.7, senescence jump, mass abscission including still-green leaves

Frost jumps are sized against the leaf's **base** `sCrit`, not the winter-scaled one — a frost event does a fixed amount of damage, not proportionally more because a wet winter raised the tree's requirement. Sizing them proportionally made them scale-invariant, which silently cancelled the winter-precipitation driver almost exactly.

### Species profiles (config table, not branching logic)

| Parameter | Bigtooth maple | Gambel oak | Quaking aspen |
|---|---|---|---|
| Anthocyanin potential | 1.00 (high) | 0.55 (medium) | 0.15 (trace) |
| Dominant late-season color | Brilliant orange-red | Orange to red-orange | Bright yellow |
| Photoperiod gate `pSen` | 13.0 h | 12.5 h | **24 h — no gate** |
| Photoperiod weight `ySen` | 2.0 | 2.0 | **0 — pure thermal** |
| `sCrit` | 630 | 1114 | 605 |
| Chlorophyll decay | 1.00 (medium) | 0.80 (slow) | 1.40 (fast) |
| Marcescence | 0 | 0.35 | 0 |
| Base green (HSL) | 106 / .46 / .33 | 116 / .40 / .25 | 95 / .50 / .40 |
| Turns | ~Oct 7 | ~Oct 14 | ~Sep 22 |

`sCrit` values are **not comparable between a gated and an ungated species** — aspen accumulates from the solstice, so it sums ~10 extra weeks before September. Re-run `calibrate-species.js` after touching `T_SEN_C`, `X_SEN`, `pSen` or `ySen`; `sCrit` is scale-dependent on all of them.

### Calibration constants
Moved out of this file. All values, with sources and provenance tags, live in `leaf-phenology-data.md` §3 (general) and §11 (the Wasatch-specific baseline). `model.js` carries a tag on every constant inline.

### Known dataset context
See `leaf-phenology-data.md` §8. Two corrections to what was originally listed here: **HF000 is a meteorological dataset, not phenology** (the pairing is HF003 for phenology + HF001 for drivers), and the western precipitation finding now has a specific citation and window (Li, Donnelly & Wang 2026 — Jan–Mar).

---

## Phased Build Plan

### Phase 1 — Model only — **DONE**
Pure functions, no rendering. Validated by `test-model.js`, which traces a single leaf of each species across a season and asserts pigment shapes and fall-day.

### Phase 2 — Minimal grid prototype — **DONE**
24 × 14 grid of plain colored squares in `index.html`. Sliders for temperature, cloud cover, wind, in-season rain, winter precipitation, latitude, plus play/step/reset and a speed multiplier. A display dropdown swaps the grid between leaf color and any single state variable — Phase 2 is for debugging the model, and watching one pigment at a time is how you see what it is doing. "Log season" dumps a full trace to the console.

### Phase 3 — Validate & tune — **PARTIALLY DONE**
Done:
- All the qualitative targets from the original plan are now automated assertions rather than eyeball checks — color lags temperature, wind is inert early, sunny+cool beats cloudy+cool, oak stays duller than maple.
- Site recalibrated to the Wasatch; species trio swapped; `ySen` made per-species; antecedent winter precipitation added as the western primary driver.
- `sCrit` calibrated numerically by bisection rather than by eye.

Still to do:
1. Close the three untested validation targets from `leaf-phenology-data.md` §3.7 — the anthocyanin↔chlorophyll-loss correlation (r = 0.60–0.72), interannual SD of 50 % leaf-fall (3.1–6.6 d), and the onset→leaf-fall lag (2–3 weeks).
2. Add the solstice-split sensitivity test against §5's −1.9 / +2.6 d/°C anchors. Only the *sign* has been checked so far, not the magnitude.
3. Confirm the frost regime does not flatten every season into "killed by freeze in September" — partially checked (median first frost Oct 3 vs the Sep 25 normal), not yet asserted.

### Phase 4 — Real visualization — **DONE**
`scene.html`. A Wasatch meadow at ~2100 m: twelve trees over three depth planes — a clonal aspen grove in the left third, the focal bigtooth maple on the right, Gambel oak thickets between, and hazed miniatures of all three on the far bench. Every leaf is a real `M.makeLeaf` advanced by `M.stepLeaf` against one shared `M.makeEnvironment` day and painted with `M.leafColor`; nothing about colour, senescence or abscission is re-decided in the renderer. ~4.7k simulated leaves at density 1.

- **Plain canvas 2D, not p5.js.** The only things p5 was wanted for were organic shapes and particle motion, and both came to a few dozen lines (three `Path2D` silhouettes, one particle integrator). Dropping the CDN keeps the scene openable straight off the filesystem with no network. `scene.html` + `model.js`, no build step.
- Canvas as planned. Leaves are filled via `setTransform` with the tree transform folded into each leaf matrix by hand — that, plus three shared `Path2D` objects, is what makes a few thousand independently-simulated leaves affordable per frame.
- Fallen leaves are stamped once onto an offscreen litter layer and blitted, so a ground carrying thousands of leaves costs one `drawImage` rather than thousands of fills.
- What the model contributes visibly, beyond leaf colour: `env.sun` drives the seasonal light and the sun's height; `env.gust` drives canopy sway, leaf flutter and how hard leaves are pushed downwind as they fall; accumulated frost cures the meadow from green to straw; a hard freeze tints the scene; `env.rain` puts streaks in the air. Aspen leaves twist harder than the other two in the same breeze, which is the one place the renderer takes a species-specific liberty — and the flattened petiole it is imitating is why the species is called quaking aspen.
- Query string for reproducible stills and side-by-side comparisons: `?day=66&seed=7&still=1&air=1&temp=-2&cloud=80&controls=1`. `air` keeps a drift of leaves in flight instead of settling them, which is both what a real leaf-fall day looks like in a single frame and the only way to inspect how airborne leaves are ordered against the trees. `day` fast-forwards the model rather than the clock, so every intervening day is really simulated. `still` freezes the clock but keeps repainting, which is what makes a headless screenshot deterministic.
- Not self-contained in one file, deliberately: it loads `model.js` with a `<script>` tag rather than inlining a copy. A pasted copy of the model would be a second source of truth for the biology, which is the one thing this project is organised to avoid.

#### Phase 4b — second pass

Four things were wrong with the first version, and fixing them turned out to need one shared piece of machinery.

**The scene was choppy.** The model hands over one discrete day at a time and its day-to-day weather noise is real — gusts are drawn fresh every day, the night low carries ~1.6 C of noise, rain is on or off. At 1x a day is 0.75 s, so painting straight from the model made a season of independent daily draws read as strobing rather than as weather. There is now a smoothed layer (`sc.vis`) that everything is painted from: light, wind, rain, temperature and the snowline all chase the model's day on time constants measured in **simulated days**, not seconds, so the result looks the same at 1x and at 6x. Leaf colour eases across each day in eight sub-steps for the same reason — a whole canopy changing colour at once, 1.3 times a second, is a visible pulse. Measured: worst-case canopy colour change per frame went from 5.46 RGB levels to 0.65, and the sky never moves more than 1 level.

The HUD deliberately still shows the model's *raw* day. Smoothing is for the picture; the numbers should be the truth.

**The leaves were jittery in wind.** Three causes, all about frequency rather than amplitude. Flutter *frequency* scaled with wind, so a gale meant fast wobble — real foliage in a gale swings further, not quicker, since a leaf's period is set by its own size and stiffness. Every leaf ran on an independent phase, so a few thousand leaves each doing their own thing summed to noise. And the petiole twist ran at 1.7x the flutter rate, putting a second faster flicker on top. Now: base rates are roughly halved, frequency rises only 15% across the whole wind range, the twist is slower than the flutter it rides on, and a gust travels through the canopy as a wave so the motion is *correlated* and reads as one moving airmass. Measured at the top of the wind slider: median leaf swing 89 → 32 deg/s, twist 861 → 139 %/s.

**More leaves per tree.** ~4.7k → ~9.6k. Paid for by two optimisations rather than by hoping: leaf colours are now resolved into a cached string on a schedule instead of being rebuilt per leaf per frame (that alone was several thousand string builds sixty times a second, re-deriving a value that only changes when the day does), and each species has a reduced-detail silhouette used below ~9 device pixels.

When the frame rate will not hold, **render scale** is what gives way — not leaves. The first attempt at this thinned the canopy instead, skipping every second leaf and then three in four. That was the wrong trade twice over: leaves are the thing this page exists to show, and the thinning was invisible in its cause and glaring in its effect, so it read as leaves vanishing mid-season rather than as a quality setting. It was sticky across seasons too, since the cull level was never reset, so once it fired the canopy never came back. Reducing the backing store instead quarters the pixel work for half the scale — and pixel work is where the time actually goes, since thousands of small overlapping fills are bounded by fill area, not call count — while every leaf stays exactly where the model put it. `slowmachine.js` is the regression test: it feeds deliberately slow frames and asserts that every held leaf is still drawn. Under the old code 39 of 40 samples under-drew, bottoming out at a third of the canopy; now none do.

**The mountains.** Rebuilt as three ranges of fractional Brownian motion rather than sums of sines — the exponent is the whole point, since amplitude proportional to segment length gives a dome and H around 0.7 gives a ridgeline. Each range gets a vertical light gradient, across-slope shading (the sun is on the right of this scene, so right-facing ground is lit), shaded gullies, lit spurs, and a crest line so hazed ranges stay separable. Trees now cast soft shadows on the meadow, which is what makes them stand *on* the ground rather than in front of it.

**Snow, from the weather rather than painted on.** World y is mapped onto real elevation — the meadow at plan.md's 2100 m, the back crest at roughly Timpanogos height — so the freezing level can be computed from the day's mean temperature and the standard 6.5 C/km lapse rate. Precipitation falls as snow above that level. This is the normal Wasatch autumn case and the thing the ask was pointing at: an October storm is rain at the trailhead and white on the ridge by morning. Accumulation is gated on how much of the range actually sits above the snow line, so a warm rainstorm topping out above the summits leaves nothing; ablation is driven by the temperature at the snow's own elevation, not the valley's, because snow at 3000 m does not care much about a mild afternoon at 2100 m. The conifer belt and the meadow itself go under when the cover reaches them. A typical season: nothing through September, first cover around Oct 19 at 3060 m, down to 2240 m and total by late November.

*Drawing* it took two attempts. The first filled everything above the freezing-level contour with solid white and gave the lower edge its own fractal curve. Two things were wrong. The curve was generated independently of the ridge, so its shape bore no relation to the mountain underneath and it read as a white band painted across the backdrop rather than snow lying on rock. And because the contour is a single elevation shared by the whole scene, when it dropped past a nearer, lower range that range went white too — over the top of a different aerial-perspective tint, which made the foothills discolour.

Both faults trace to the same mistake: drawing a boundary at all. Snow cover on a hillside is not a line, it is a gradient with elevation — deep on the summits, thinning downslope, gone below the freezing level. So it now fades from each range's own crest downward, reaching zero at the snow line, and the only hard edge it has is the silhouette itself. Measuring each range against its own crest is what keeps the ranges reading as separate distances: one that barely pokes above the snow line gets a faint veil while the high one behind it goes white, which is both what the physics says and what the picture needs. A thin rime stroke on the ridge path sharpens the skyline — deliberately narrow, because any width and it stops being snow and becomes white piping traced around the mountain — Relief is carried by two gradients and nothing else — down-slope and across-slope, the latter lit on the sun side. There were drawn gully and spur strokes for a while, painted over the snow so rock ribs showed through it, which is what you see on a photograph of a real peak; at this scale, on flat-shaded stylised rock, they read as scratches on the backdrop rather than as terrain, so they are gone.

**Falling leaves are depth-sorted.** They used to be drawn after every tree, which put every airborne leaf in front of every trunk — so a leaf shed by a hazed tree on the far bench crossed the front of the centre-stage maple, reading as the background tree being nearer than the tree it stands behind. Each particle now carries a depth plane, and the particles are interleaved with the tree draws rather than painted over them. The plane is a distribution, not a constant: about 60% stay in their own tree's plane, and the rest are blown one to three planes toward the viewer, because a gust genuinely does carry leaves across in front of nearer trees and a scene where that never happened would be as wrong as one where it always did. Crossing forward also makes a leaf slightly larger, gives it more lateral drift, and takes back part of the aerial haze its tree was sitting in, since it is now closer than that tree.

**The maple leaf is a maple leaf.** *Acer grandidentatum* means big-toothed, and the outline was nine radial points — five spikes and four notches — which reads as a generic star. It is now tabulated from a half-margin and mirrored: five blunt-tipped lobes carrying coarse teeth, deep sinuses between them, and a cordate notch where the blade meets the petiole. Thirteen control points, 26 polygon points against the old 10.

That detail is not free at a few thousand fills a frame, so it is spent where it can be seen: leaves get the full outline above about 26 device pixels, the old star between 26 and 9 — at which size the teeth are not resolvable anyway — and the plain stub below that. In practice only the foreground maple draws the detailed version, which is the tree the eye is on. `shapes.html` in the scratchpad renders all the silhouettes side by side, large and at true size, by extracting the live functions out of `scene.html` rather than copying them.

**Leaves let go continuously, not once a day.** The model decides that a leaf falls *today*; it says nothing about when. Releasing all of a day's detachments on the frame the day ticks over meant leaves arrived in a pulse — invisible on an average day of forty, obvious on a peak day of five hundred. Each detachment is now queued with a release time spread uniformly across the day that follows, and the leaf stays drawn on its branch until that moment comes. That second half is the part that matters: hiding the leaf at detach time and spawning the particle later would make it wink out and reappear mid-air up to a day later, which is a worse artefact than the pulse. It has left the model's canopy but not the picture's. Release times are counted in simulated days, so the spread holds at any playback speed. Measured over 3000 frames: the worst single frame went from 244 leaves entering the air to 15, and releases now happen on 45% of frames instead of 1.3%.

The one trap here is that `stepDay` no longer spawns anything by itself, so any code path that advances the season without running the frame loop has to drain the queue — the query string's day fast-forward does this explicitly.

**Observed while building it:** the aspens are already fully yellow in the last days of August — the model has aspen chlorophyll at 0.11 and `leafColor` at `rgb(218,175,48)` by Aug 31. That is the ungated pure-thermal accumulator doing exactly what §11 says it should, but real Wasatch aspen turns mid-to-late September, so it reads early on screen. `aspen.sCrit` is a `[GUESS]` with no local record under it, and this is the first look the project has had at that guess as a picture rather than as a column of numbers. A visual calibration pass belongs in Phase 3.

### Phase 5 — Interactivity polish
- ~~Real-unit sliders~~ **done in Phase 2** — °C, m/s, % cloud, mm, × normal.
- ~~"Run a season" auto-play with speed multiplier~~ **done.**
- ~~Species selector~~ **done.**
- ~~Expose latitude/photoperiod~~ **done** — the day-length model is ~15 lines and takes only DOY + latitude, so it was nearly free.
- ~~Whatever polish the real visualization needs~~ — Phase 4 ships with play/pause/step, a speed multiplier, a season progress bar, live per-species canopy state, a leaf-density control with a frame-cost readout, new-woods / replay-season, season looping, and keyboard shortcuts.
- Remaining: nothing identified. A scrubbable season timeline (jump backwards, not only forwards) is the obvious next thing and would need the model to be snapshot-able, which it currently is not.

---

## Open items / things to revisit

**Resolved:**
- ~~Whether sliders should modulate the baseline or override instantaneously.~~ Settled in favour of baseline modulation — the solstice reversal means an override cannot represent the physics. See §5.
- ~~Whether to expose latitude.~~ Exposed, and it produced the strongest single validation available: sweeping latitude puts the color optimum at 38–42°N, bracketing the 40.65°N reference site, with nothing in the model knowing where it was calibrated.

**Open:**
- **Palette judgment.** The four color anchors are hand-picked and are the least verifiable part of the model. Bigtooth maple peaks near 0.97 anthocyanin in an average season — close enough to the clamp that a good year has little room above an average one. Gambel oak's mean 0.17 may read browner than Utah's actually does.
- **Delpierre et al. 2009 fitted parameters** are still paywalled (`doi:10.1016/j.agrformet.2008.11.014`). Only calibration *ranges* are open. This is the highest-value upgrade available and BYU library access would likely cover it.
- **The `[GUESS]` constants have no local ground truth.** `WINTER_PRECIP_SENS` in particular has a verified direction and an invented magnitude.
- **The sugar submodel has no citation under it** — the mechanism is borrowed from a toy NetLogo model. It produces the right behaviour but is the least defensible part of the design.
- **Latitude and elevation are conflated.** The temperature baseline bakes in 2100 m, and the latitude slider adds a lapse rate on top, so high latitudes compound into a site above these species' real range. The slider is capped at 46°N for this reason. A proper fix would make elevation its own control.
- **Should there be region presets?** Currently one site is baked in. Presets (latitude + temperature baseline + driver weighting) would avoid hard-coding one region's assumptions into the equations.
