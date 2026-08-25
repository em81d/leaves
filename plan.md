# Fall Leaf Color Simulation — Project Plan

## Goal
A science-driven, interactive visualization of deciduous leaves changing color and falling in autumn. Users can adjust environmental variables (temperature, wind, sunlight, precipitation) and see the effect on leaf color and abscission (falling) over a compressed simulated season.

**Development approach:** build the biological/environmental model FIRST as pure logic (no rendering), validate it with a minimal grid-of-colored-squares prototype, THEN invest in a polished visual layer. Do not skip ahead to visuals before the model behaves correctly.

**Status:** Phases 1 and 2 complete. Phase 3 partially complete — see the phase list. 40 automated checks passing.

| File | Role |
|---|---|
| `model.js` | Phase 1. Pure logic, no DOM. Runs in browser and Node. |
| `index.html` | Phase 2. Grid prototype + sliders. Open directly, no build step. |
| `test-model.js` | `node test-model.js` — validation harness, 40 checks. |
| `calibrate-species.js` | Bisects each species' `sCrit` onto a target completion date. |
| `check-docs.js` | Guards `leaf-phenology-data.md` §11.5 against drifting from `model.js`. |
| `leaf-phenology-data.md` | All sourced data + the research behind every constant. §11 is the live calibration; §1–10 are the derivation. |

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

### Phase 4 — Real visualization
Once the model's behavior is validated:
- Recommended: **p5.js**, from CDN, rendering to canvas — suits organic leaf shapes, particle motion, and wind-sway physics, no build step.
- Use **canvas**, not SVG, past ~50 leaves.
- Ship as a single self-contained HTML file.

### Phase 5 — Interactivity polish
- ~~Real-unit sliders~~ **done in Phase 2** — °C, m/s, % cloud, mm, × normal.
- ~~"Run a season" auto-play with speed multiplier~~ **done.**
- ~~Species selector~~ **done.**
- ~~Expose latitude/photoperiod~~ **done** — the day-length model is ~15 lines and takes only DOY + latitude, so it was nearly free.
- Remaining: whatever polish the real visualization needs.

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
