# Leaf Change & Environmental Conditions — Verified Data Reference

Companion to `plan.md`. This file replaces the "best-estimate synthesis, NOT verified"
constants block in that plan with values traced to published sources, and records which of
the plan's original numbers survived checking.

> ## ⚠ Which calibration is live
>
> **The model is calibrated for the WASATCH MONTANE site — Park City UT, 40.65°N, ~2100 m.**
>
> Sections 1–10 were written against an earlier **New England** calibration (Harvard Forest,
> 42.54°N, ~340 m). That research is still the derivation for every equation in the model and
> is kept for that reason, but where it states a site-specific number it has been superseded.
>
> | Looking for | Go to |
> |---|---|
> | The live site's temperature baseline, species and drivers | **§11** |
> | Equation forms, pigment chemistry, frost/wind/abscission logic | §3 (site-independent) |
> | Published sensitivity anchors to tune against | §5 (site-independent) |
> | What the model actually does now, and what is still `[GUESS]` | §11.5, §9 |
>
> Superseded material is marked **[SUPERSEDED → §11]** inline. Nothing has been deleted —
> the New England numbers are what the Wasatch ones were derived *against*, and the
> contrast between the two is load-bearing in several places.

**Research dates:** 2026-08-21 (New England, §1–10) · 2026-08-25 (Wasatch, §11)

Confidence tags used below:
- **[V]** Verified — traced to a peer-reviewed paper, agency source, or dataset I read
- **[P]** Plausible — supported only indirectly, or by non-peer-reviewed authority
- **[U]** Unverified — I could not confirm it; source paywalled or no measurement exists
- **[GUESS]** Weaker than a tuned parameter: no published range to sit inside *and* no local
  observational record to calibrate against. Direction sourced, magnitude invented. This tag
  only appears from §11 onward — it exists because the move west left several constants
  without an anchor.
- **[X]** Wrong or misleading as stated in `plan.md`

---

## 1. Fact-check summary

| `plan.md` claim | Verdict | Correction |
|---|---|---|
| Photoperiod threshold 11–12 h triggers senescence onset | **[X]** | Too late. At 42.5°N daylength only reaches 12 h on ~Sep 26 and 11 h on ~Oct 19, but observed coloration at Harvard Forest starts in **early September** (13.2 h). Published models calibrate this threshold over **10–16 h** and start accumulating at the **summer solstice (DOY 173)** or DOY 200. |
| Temperature threshold ~10 °C night temp drives senescence | **[X]** | Conflates two different mechanisms. As a *cold-degree-day base temperature* (Tb) the calibration range in the literature is **+7 to +30 °C** — at Tb = 10 °C almost nothing accumulates until late October. 10 °C *is* a fair marker for the separate "cool nights" anthocyanin condition. Keep them as two distinct parameters. |
| Frost = discrete event at ≤ 0 °C causing rapid browning/abscission | **[V]** | Correct and well supported. Split into two tiers (light frost vs hard freeze) — see §3.3. |
| Anthocyanin needs sunny days + cool-not-freezing nights, ~0–10 °C | **[V]** | Correct. Tighten the peak window to **0 to ~7 °C** (agency sources say "below 45 °F but not freezing"). Freezing **destroys** the synthesis mechanism — production should switch off permanently, not just slow. |
| Anthocyanin is actively produced; carotenoid pre-existing | **[V]** | Correct. Carotenoids/xanthophylls are present all season and revealed; anthocyanin is *de novo* synthesis in autumn (cyanidin-3-glucoside ≈ 80 % of maple leaf anthocyanin); brown is oxidised phenolics/tannin at cell death. |
| Anthocyanin requires chlorophyll still declining (sugar availability) | **[V]** | Correct, and there is a measured coupling: autumn anthocyanin content correlates with *degree of chlorophyll degradation*, **r = 0.60–0.72, p < 0.001**. Note the direction — **early**-senescing trees make the *most* anthocyanin, not the latest ones. |
| Wind stripping begins ~30–40 km/h (8–11 m/s) | **[P]** | No published wind-speed-vs-abscission threshold found. The nearest hard measurement is aerodynamic: leaves reconfigure from open to a full cone at **~11 m/s** and shatter beyond **~30 m/s**. Usable, but treat 8–11 m/s as a shape parameter, not a cited fact. |
| Wind must be a multiplier on biological readiness, not an independent cause | **[V]** | Correct, and this is exactly where the NetLogo reference model is wrong (§7) — it decrements attachedness by wind every tick regardless of leaf state. Keep the plan's design. |
| Green→peak 3–6 weeks; peak→leaf-off 1–3 weeks; 90–120 day season | **[V]** | Broadly correct. Harvard Forest 18-yr record: onset early September, peak spread across October, extending into November ≈ 10–12 weeks total. Measured onset→leaf-fall lag ~2–3 weeks. |
| Precipitation is a weak secondary driver | **[V]** for New England, **[X]** as a general rule | In the **eastern** US leaf color is driven primarily by summer temperature, but in the **western** US it is driven more strongly by **precipitation more than six months prior**. Fine to keep weak for a New England default; do not present as universal. |
| Night temp matters more than day temp for senescence | **[P]**, and understated | Best-performing models do use daily **minimum** temperature. But the real finding is stronger: daytime and nighttime warming push senescence in **opposite directions** (Wu et al. 2018), and pre- vs post-solstice warming also reverse sign (§5). |
| Maple = high anthocyanin, red/orange | **[V]** | Correct. |
| Birch = ~no anthocyanin, yellow | **[V]** | Correct. |
| Oak = low–medium anthocyanin, brown/russet | **[X]** partially | *Quercus rubra* and *Q. velutina* are explicitly among the eight Harvard Forest hardwoods **displaying autumn anthocyanins**, and red oak is named among the most spectacularly coloured species. *Q. alba* (white oak) is the brown one. Split the oak profile, or raise its anthocyanin potential. |
| Oak = slow chlorophyll decay, late turner | **[V]** | Correct — but the plan **omits marcescence** (§6.1), a distinctive oak behaviour worth modelling. |
| Datasets: USA-NPN, Harvard Forest HF000/HF003, LOTUS, NetLogo Autumn | mostly **[V]**, one **[X]** | All four exist. **HF000 is not a phenology dataset** — it is the Shaler Meteorological Station 1964–2002. The pairing you want is **HF003** (phenology) + **HF001** (met drivers). See §8. |

---

## 2. Day length reference (computed, not estimated)

Forsythe et al. CBM daylength model, sunrise/sunset refraction p = 0.8333°.
This is the table that invalidates the plan's 11–12 h threshold.

Both latitudes are shown. **40.65°N is the live site**; 42.54°N is retained because
`test-model.js` asserts the day-length function against it, which is what keeps the
astronomy honest independently of wherever the model happens to be calibrated.

| DOY | Date | **40.65°N (live site)** | 42.54°N (test reference) |
|---:|---|---:|---:|
| 173 | Jun 22 (solstice) | **15.09** | 15.31 |
| 213 | Aug 01 | **14.35** | 14.51 |
| 244 | Sep 01 | **13.14** | 13.22 |
| 258 | Sep 15 | **12.53** | 12.56 |
| 266 | Sep 23 (equinox) | **12.18** | 12.18 |
| 273 | Sep 30 | **11.86** | 11.85 |
| 280 | Oct 07 | **11.55** | 11.52 |
| 288 | Oct 15 | **11.20** | 11.14 |
| 296 | Oct 23 | **10.86** | 10.77 |
| 305 | Nov 01 | **10.49** | 10.37 |
| 315 | Nov 11 | **10.10** | 9.96 |
| 325 | Nov 21 | **9.77** | 9.61 |
| 335 | Dec 01 | **9.51** | 9.32 |

The two columns converge at the equinox and diverge either side of it, which is the whole
of the latitude effect on photoperiod: less than 0.25 h anywhere in the season. That is
worth noticing — it means the latitude slider's visible effect comes overwhelmingly from
the temperature lapse in §11.1, **not** from day length. Photoperiod alone is a weak
latitudinal lever over this range.

Cross-check: the ~48 min of daylength lost between the solstice and Aug 1 matches the NPS
statement that day length shortens "about 30–45 minutes" from the solstice by late July.

Phase 5 note: this model is ~15 lines of code and takes only DOY + latitude, so exposing
latitude as a control is cheap. **Done** — the slider is capped at 32–46°N; see §11.4 for why.

---

## 3. Revised calibration constants

> **Scope:** §3.1–§3.4 and §3.6–§3.7 are site-independent — equation forms, pigment
> chemistry, frost tiers, wind behaviour. Those still hold.
> §3.5 (precipitation) is **[SUPERSEDED → §11.3]**: it was written for a
> temperature-dominated eastern site, and precipitation is the *primary* driver at the
> live one. The temperature baseline referenced throughout is **[SUPERSEDED → §11.1]**.

### 3.1 Senescence clock (master trigger)

The standard published form is Delpierre et al. (2009) — a photoperiod-gated cold-degree-day
sum, called DM1/DM2 in the model-comparison literature. It outperformed plain CDD in both the
original study and later independent comparisons.

```
R_sen(d) = (T_sen - T_d)^x_sen * (P_d / P_sen)^y_sen     when T_d < T_sen AND P_d < P_sen
         = 0                                             otherwise

S(d) = sum of R_sen over days;  senescence complete when S >= S_crit
```

- `P_sen` — photoperiod gate, hours. **Published calibration range 10–16 h [V].**
  Accumulation in most implementations starts the first day after DOY 173 (solstice) or DOY 200.
- `T_sen` — cold-degree-day base temperature, °C. **Published calibration range +7 to +30 °C
  [V]** (Harvard Forest study); the `phenor` framework searches −10 to +30 °C for CDD's base.
  Fitted values are much warmer than intuition suggests, because CDD sums *how far below* the
  base each day sits.
- `x_sen`, `y_sen` — exponents weighting temperature vs photoperiod. **Fitted values paywalled [U]**;
  the DM1 vs DM2 distinction is whether shortening days *weaken* (DM1) or *amplify* (DM2) the
  temperature response. DM2 was the stronger performer in the broadest comparison.
- `S_crit` — critical sum. Scale-dependent on `T_sen`; must be fitted, never transplanted.
- Drive with **daily minimum** temperature, not daily mean, if you have both.

**Sanity anchor for picking S_crit:** with `T_sen` = 20 °C and Sep–Oct nightly minima averaging
~10 °C, daily accumulation ≈ 10 units, so `S_crit` ≈ 400 lands completion ~40 days after onset —
early September onset → mid-October peak. That reproduces the observed Harvard Forest pattern.

### 3.2 Anthocyanin production

- Requires **high irradiance** simultaneous with **low temperature** — the condition is that
  energy input exceeds the leaf's utilisation capacity **[V]**.
- Peak night-temperature window: **above 0 °C, below ~7 °C** (45 °F) **[V]**. The plan's 0–10 °C
  is acceptable as an outer envelope.
- Warm sunny days + cool nights: sugars are made but trapped as veins close → substrate for
  synthesis **[V]**.
- Cloudy autumn → less sugar → duller, more yellow-brown **[V]**.
- **Excess nitrogen also suppresses anthocyanin [V]** — not modelled in the plan, and reasonably
  left out.
- Couple production to chlorophyll *degradation rate*, not to absolute chlorophyll: target
  r ≈ 0.6–0.7 between cumulative anthocyanin and fraction of chlorophyll lost **[V]**.
- **Freezing destroys the synthesis mechanism [V]** — latch production off after the first
  hard freeze rather than letting it resume.

### 3.3 Frost — two tiers

| Tier | Trigger | Effect |
|---|---|---|
| Light frost | Tmin 0 to −2 °C | Abscission layer hardens **more rapidly**, cutting the leaf's connection; any wind or snow load then drops it. Anthocyanin synthesis halts. **[V]** |
| Hard freeze | Tmin ≤ −2 °C | Cells rupture → rapid browning (tannin dominates) and mass abscission within ~1–3 days, **including still-green leaves**. **[V]** |

The plan's "can visually wipe out a tree's leaves in a single simulated day" is well supported:
"some trees at the right stage in their fall abscission can lose every leaf to the freeze all at once."

### 3.4 Abscission and wind

- Gate on biological readiness first — wind is a multiplier **[V, design]**.
- Below ~8 m/s: negligible on leaves that have not formed an abscission layer **[P]**.
- ~11 m/s: measured aerodynamic transition, leaves reconfigure open → full cone **[V]**. Good
  place for the multiplier to steepen.
- \>30 m/s: leaf shattering **[V]**. Beyond the range a season sim needs.
- Measured petiole detachment force at Harvard Forest ordered: **green leaves held most firmly,
  then red, then yellow [V]** — i.e. red (high-anthocyanin) leaves resist detachment *longer*
  than yellow ones. Anthocyanin content is associated with **delayed** senescence at the
  individual-leaf level. Worth encoding: high anthocyanin → slightly higher attachment floor.
- Heavy rain as a mechanical knock-down on already-weakened leaves: **[P]**, keep small.

### 3.5 Precipitation and drought  **[SUPERSEDED → §11.3]**

- Weak/secondary in the eastern US; **temperature-dominated there [V]**.
- Western US: precipitation >6 months prior is the stronger driver **[V]**. Out of scope for a
  New England default, but do not generalise the "weak" claim.
- Drought → premature drop before colour develops, giving **duller, muted yellow or brown [V]**.
- **Caveat [V]:** whether drought advances or delays senescence is genuinely unresolved —
  published studies report advanced, delayed, and no effect. Declining precipitation *frequency*
  has been linked to earlier senescence. Keep the effect small and label it uncertain.
- Excessive rainfall also reduces pigment vibrancy **[P]**.

### 3.6 Pigment → colour mapping

Real measured leaf pigment ranges, µg/cm², from the LOPEX_ZJU dataset used to calibrate
PROSPECT-PMP+ (12 species, young → mature → senescent) **[V]**:

| Pigment | Min | Max | Mean |
|---|---:|---:|---:|
| Chlorophyll a | 0.04 | 94.53 | 24.63 |
| Chlorophyll b | 0.05 | 47.49 | 12.75 |
| Total carotenoids | 0.24 | 44.55 | 16.09 |
| Anthocyanins | 0.01 | 47.22 | 4.12 |

Useful ratio for initialising the model: in a healthy green leaf total chlorophyll (a+b) runs
roughly **2–2.5× carotenoid** content, and anthocyanin is near zero. That gives the plan's
`carotenoid` constant a defensible starting value of ~0.4 in its 0–1 normalised space, rather
than an arbitrary one — and it explains why chlorophyll loss alone produces a strong yellow.

### 3.7 Durations and validation targets

- Coloration onset: **early September** at 42.5°N **[V]**
- 10 % → 90 % coloured: **3–6 weeks [V]**, species-dependent
- Senescence onset → leaf fall lag: **~2–3 weeks [V]** (beech: onset DOY 279–295, leaf-fall
  proxy DOY 315). The literature explicitly warns that leaf-fall proxies hide a *large* lag
  behind true senescence onset — keep the plan's separate `senescence` and `attached` state.
- Full season Sep 1 → mid-November ≈ **75–105 days [V]**; the plan's 90–120 is fine.
- Interannual SD of the 50 %-leaf-fall date: **3.1–6.6 days [V]** — i.e. the season is
  *tightly* clocked. If your sliders move leaf-off by months, they are too strong.

---

## 4. Machine-readable constants  **[SUPERSEDED → §11.5]**

> The block below is the New England parameter set. The live values are in §11.5.


```json
{
  "_provenance": "See leaf-phenology-data.md sections 3 and 6. Ranges are published calibration bounds; single values marked TUNE are starting points inside those bounds, not fitted values.",
  "site": { "latitude": 42.54, "longitude": -72.18, "elevation_m": 340 },
  "season": { "start_doy": 173, "accumulation_start_doy": 173, "length_days_range": [75, 120] },
  "senescence": {
    "model": "Delpierre DM2 (photoperiod-gated cold-degree-day sum)",
    "photoperiod_gate_h": { "published_range": [10, 16], "TUNE": 13.2 },
    "cdd_base_temp_c":    { "published_range": [7, 30],  "TUNE": 20.0 },
    "temp_driver": "daily_minimum",
    "exponent_temp_x":       { "TUNE": 2.0, "note": "fitted values paywalled" },
    "exponent_photoperiod_y":{ "TUNE": 2.0, "note": "fitted values paywalled" },
    "critical_sum":          { "TUNE": 400, "note": "scale-dependent on cdd_base_temp_c; refit if that changes" }
  },
  "anthocyanin": {
    "night_temp_window_c": [0.0, 7.0],
    "night_temp_outer_envelope_c": [0.0, 10.0],
    "requires_high_irradiance": true,
    "couple_to": "chlorophyll_degradation_rate",
    "target_correlation_with_chl_loss": [0.60, 0.72],
    "halted_permanently_by_frost": true
  },
  "frost": {
    "light_frost_c": [-2.0, 0.0],
    "hard_freeze_c": -2.0,
    "hard_freeze_defoliation_days": [1, 3],
    "hard_freeze_drops_green_leaves": true
  },
  "wind": {
    "negligible_below_ms": 8.0,
    "reconfiguration_ms": 11.0,
    "shatter_ms": 30.0,
    "acts_as": "multiplier_on_senescence_readiness",
    "attachment_order_strongest_first": ["green", "red", "yellow"]
  },
  "precipitation": {
    "role": "weak_secondary",
    "drought_effect_sign": "unresolved_in_literature",
    "drought_effect_on_color": "duller_muted_yellow_brown",
    "heavy_rain": "mechanical_knockdown_on_weakened_leaves_only"
  },
  "pigments_ug_cm2": {
    "chlorophyll_a": { "min": 0.04, "max": 94.53, "mean": 24.63 },
    "chlorophyll_b": { "min": 0.05, "max": 47.49, "mean": 12.75 },
    "carotenoids":   { "min": 0.24, "max": 44.55, "mean": 16.09 },
    "anthocyanins":  { "min": 0.01, "max": 47.22, "mean": 4.12 },
    "green_leaf_chl_to_carotenoid_ratio": [2.0, 2.5]
  },
  "validation_targets": {
    "onset_to_90pct_color_weeks": [3, 6],
    "onset_to_leaffall_lag_weeks": [2, 3],
    "interannual_sd_50pct_leaffall_days": [3.1, 6.6],
    "pre_solstice_warming_days_per_c": -1.9,
    "post_solstice_warming_days_per_c": 2.6
  }
}
```

---

## 5. Sensitivity anchors — the Phase 3 tuning targets

These are the most useful numbers found, because they are exactly what "tune by eye" should be
tuned *against*, and they retroactively justify one of the plan's open design questions.

| Perturbation | Measured response | Source |
|---|---|---|
| +1 °C **pre**-solstice warming | senescence onset **1.9 days earlier** | Zohner et al. 2023, *Science* |
| +1 °C **post**-solstice warming | senescence process **2.6 days longer** | Zohner et al. 2023, *Science* |
| +1 day later spring leaf-out | senescence **0.22 ± 0.08 days later** | eLife 2025, beech saplings |
| Daytime vs nighttime warming | **opposite-signed** effects on senescence date | Wu et al. 2018, *Nat. Clim. Change* |

**This settles the plan's open question about slider semantics.** The sign of a temperature
perturbation depends on *when in the season* it occurs — before or after the solstice, day or
night. An "instantaneous override" slider cannot express that; a slider that modulates a seasonal
baseline can. Keep the baseline-modulation design.

It also means a season-wide "warmer" slider should produce a **small** net shift, because the
pre- and post-solstice effects partly cancel. If your warm-season run shifts leaf-off by more
than ~1–2 weeks, the model is over-sensitive.

---

## 6. Revised species profiles  **[SUPERSEDED → §11.2]**

> The eastern trio below is no longer in the model. It is kept because the western trio
> maps onto exactly these three roles — which is the evidence that the config-table
> design worked: swapping regions changed the table and not one equation.


| Parameter | Maple (*Acer rubrum/saccharum*) | Red oak (*Q. rubra/velutina*) | White oak (*Q. alba*) | Birch (*Betula*) |
|---|---|---|---|---|
| Anthocyanin potential | High **[V]** | **Medium** — displays autumn anthocyanins **[V]** | Low **[V]** | ~None **[V]** |
| Dominant late colour | Red / orange | Red-russet | Brown / russet | Yellow **[V]** |
| Senescence sensitivity | Medium | Low (late turner) **[V]** | Low (late turner) | High (early turner) **[V]** |
| Chlorophyll decay | Medium | Slow | Slow | Fast |
| Marcescence | No | Partial | **Yes [V]** | No |

The plan's single "Oak" column collapses two genuinely different behaviours. Cheapest fix
consistent with the plan's config-table design: keep one oak profile but raise its anthocyanin
potential to medium, and add a `marcescence` parameter. Splitting into two oak rows costs nothing
either, since these are data rows, not code paths.

Regional timing check **[V]**, useful for Phase 3: in Minnesota, maples peak **Sep 21 – Oct 10**
while birch and aspen peak **~Sep 28 – Oct 8** and have shifted 3–5 days later in recent years.
So birch being the "early turner" is true for *senescence onset*, but its *peak colour* lands
close to or slightly after maple's — because maple has the longer, showier transition. Do not
expect birch to finish first on the grid.

### 6.1 Marcescence — missing from the plan

Oaks, American beech, and juveniles of many hardwoods **retain dead brown leaves through winter**
because the abscission layer either never fully forms or its formation is interrupted by freezing
before completion **[V]**. It is an inherited trait in oak and beech, strongest in juveniles and
on lower branches.

Implication for the model: an oak's `attached` fraction should **asymptote well above zero**
rather than converging to full leaf-off. This is a visually distinctive, cheap-to-implement
behaviour — a bare maple next to a still-brown-clad oak — and it is a good Phase 3 correctness
check, since it falls out of the interaction between a slow abscission rate and a frost event.

---

## 7. Reference implementation: NetLogo "Autumn"

Confirmed to exist **[V]** — Wilensky & Lerner, NetLogo Sample Models / Biology. Full source read.
Actual constants, so you can see what a working toy model chose:

| Quantity | Value in NetLogo Autumn |
|---|---|
| Initial chlorophyll | `50 + random 50` (0–100 scale) |
| Initial carotene | `random 100` |
| Initial anthocyanin | 0 |
| Initial attachedness | `100 + random 50` |
| Chlorophyll loss, cold | `-0.5 * (15 - temperature)` when temp < 15 °C |
| Chlorophyll loss, strong sun | `-0.5 * (sun_intensity - 75)` when sun > 75 |
| Chlorophyll regrowth | `+1` when temp > 15 °C and sun > 20 |
| Anthocyanin production | `+1/tick` when temp < 20 °C and sugar > 0 and water > 0, consuming 1 sugar + 1 water |
| Water uptake cutoff | none below 10 °C |
| Evaporation | above 30 °C |
| Green threshold | chlorophyll > 50 → green |
| Orange | `abs(anthocyanin - carotene) < 10` |
| Red / yellow | whichever exceeds the other by > 10 |
| Wind | `attachedness -= wind_factor` **every tick, unconditionally** |
| Fall trigger | `attachedness <= 0` |

**Three things it gets wrong that the plan already fixes — keep those fixes:**

1. **No photoperiod at all.** Temperature is the only clock, so it cannot reproduce the
   photoperiod control that dominates at higher latitudes and colder autumns.
2. **Wind strips healthy green leaves.** `attachedness -= wind_factor` runs with no reference to
   chlorophyll or senescence. The plan's "wind as a multiplier on biological readiness" is the
   correct fix and is the single biggest improvement over this reference.
3. **Chlorophyll regrows** whenever it is warm and sunny, so senescence is fully reversible.
   Real senescence past onset is not.

One thing it does that the plan does **not**, and which is worth stealing: it tracks explicit
`water_level` and `sugar_level` per leaf, and derives anthocyanin from *sugar consumption*. That
is a cleaner mechanism for "sunny + cool → red" than a direct `sunlight * coolnessFactor` product,
because it naturally produces the duller-in-a-cloudy-autumn result via a depleted sugar pool
rather than requiring a separate term. Consider adding a scalar `sugar` to the per-leaf state.

---

## 8. Datasets — verified IDs and contents

> **Note after the move west:** the Harvard Forest pairing below is no longer the live site's
> data source — it has none. HF003/HF001 remain the best *worked example* of what a usable
> phenology + driver pair looks like, and USA-NPN still covers the West, but nothing here
> calibrates the Wasatch. That gap is the first entry in §9.

### USA National Phenology Network / Nature's Notebook **[V]**
- Observational database, **2009–present**, plus integrated historical lilac/honeysuckle from 1955.
- **>10 million records**; largest such database in the US.
- Download: Phenology Observation Portal, https://www.usanpn.org/data/observational
- **Directly reusable for this project — the phenophase intensity bins map onto the grid state:**
  - *Colored leaves*: "one or more leaves have turned to their late-season colors."
    Intensity = **proportion of canopy still full with green leaves**, binned as
    **95 %+ / 75–94 % / 50–74 % / 25–49 % / 5–24 % / <5 %**.
  - *Falling leaves*: "one or more leaves are falling or have recently fallen." No intensity bins —
    derived from the remaining-leaves percentage.
- Known finding to reproduce: eastern US leaf colour driven by **summer temperature**; western US
  by **precipitation >6 months prior**.

### Harvard Forest **[V]** — note the correction to `plan.md`
- **HF003 — "Phenology of Woody Species at Harvard Forest since 1990"** ← the phenology dataset.
  - 1990–2023, ongoing. Prospect Hill Tract, 42.53–42.54°N, −72.19 to −72.18°W, 335–365 m.
  - 33 woody species 1990–2001; from 2002, **14 species for fall** observations.
  - **Autumn: percent leaf coloration and percent leaf fall, recorded weekly from September
    through complete leaf drop.** Exactly the two series this project needs.
  - Sub-datasets hf003-01 … hf003-11. **CC0 1.0.**
  - Cite: O'Keefe J, VanScoy G. 2024. *Phenology of Woody Species at Harvard Forest since 1990.*
    Harvard Forest Data Archive HF003 (v.37). Environmental Data Initiative.
    https://doi.org/10.6073/pasta/bc5d2c15df4fa81aeadcd59ed7580c91
- **HF001 — "Fisher Meteorological Station at Harvard Forest since 2001"** ← use this for drivers,
  not HF000.
  - 2001–present, updated monthly. 42.53311°N, −72.18968°W, 342 m.
  - **15-minute resolution since 2005** (hourly 2001–2004; daily/monthly/annual summaries).
  - Variables: air temperature, RH, dew point, precipitation (mm), global solar radiation
    (MJ/m² or W/m²), **PAR**, net radiation, barometric pressure, **wind speed scalar & vector
    (m/s)**, **wind gust speed**, wind direction, soil temperature at 10 cm.
  - This is a near-exact match for the plan's Phase 5 slider units — temperature °C, wind m/s,
    sunlight W/m², precipitation mm. You can drive the sim from real data instead of sliders.
- **HF000 — "Shaler Meteorological Station at Harvard Forest 1964–2002"**: **[X]** the plan lists
  this as a phenology archive; it is **meteorological only** — daily min/max air temperature and
  24-h precipitation, read manually at ~08:00 EST. Useful for long-baseline temperature, not for
  colour onset.
- HF003 is co-located with HF001, so phenology and drivers are directly joinable by date.

### LOTUS **[V]**
- *"A new dataset of leaf optical traits to include biophysical parameters in addition to spectral
  and biochemical assessment"*, Remote Sensing of Environment, 2024.
- Contains hemispherical **and** bidirectional reflectance/transmittance; biophysical (moisture
  content, thickness, surface characterisation); biochemical **chlorophyll a, chlorophyll b,
  carotenoids, anthocyanins**.
- **[U]** The full pigment ranges are behind a paywall (ScienceDirect returned 403). The
  LOPEX_ZJU ranges in §3.6 are an open substitute and are sufficient for RGB mapping.

### Additional sources found, not in the original plan
- **`phenor`** (R, bluegreen-labs/phenor) — implements CDD, DM1, DM2, SIAM, TDM, PDM, TPDM and
  ships machine-readable parameter search bounds at
  `inst/extdata/parameter_ranges.csv`. This is the fastest way to see the real parameter space:
  CDD is bounded `t0 ∈ [30, 365]`, `T_base ∈ [-10, 30] °C`, `F_crit ∈ [-1000, 0]`.
- **Meier et al. 2023, *Geosci. Model Dev.* 16, 7171** — open-access comparison of **21**
  process-oriented autumn phenology models. Contains the authoritative structure table and the
  finding that DM1/DM2 remain among the best performers. Also documents that accumulation starts
  after DOY 173 or DOY 200, and that these models were originally driven by daily *mean* but
  perform better on daily *minimum* temperature.

---

## 9. Still open

- **[U] Delpierre et al. 2009 fitted parameter values** (`P_sen`, `T_sen`, `x`, `y`, `S_crit` for
  *Betula pendula*, *Fagus sylvatica*, *Quercus robur*) — paywalled at
  doi:10.1016/j.agrformet.2008.11.014. Only the calibration *ranges* are open. If you want fitted
  numbers rather than ranges, this one paper is the highest-value thing to obtain, and BYU library
  access would likely cover it.
- **[U] Published wind-speed → abscission-probability relationship.** Does not appear to exist.
  The 8–11 m/s figure is an aerodynamic analogue, not a phenological measurement. Treat as a
  free shape parameter.
- **[U] Absolute pigment concentrations in the Harvard Forest sugar maple study.** The paper's
  figures are images; the text confirms only the *ordering* (green > red > yellow chlorophyll;
  yellow lowest carotenoid; only red leaves carry high anthocyanin). Its anthocyanin unit is an
  absorbance index (AAI, A532 − 0.24·A653, range 0.01–0.53), not µg/cm², so it cannot be joined
  to the LOPEX numbers in §3.6 without conversion.
- **[U] Exact days-per-°C for the daytime/nighttime warming split** (Wu et al. 2018) — paywalled;
  direction confirmed, magnitude not.
- **Species mismatch to flag:** most of the well-parameterised European work is on beech, oak, and
  birch, while the best *anthocyanin* data is North American maple. The plan's maple/oak/birch
  trio spans both literatures, so no single source will calibrate all three.

### Added by the move west (2026-08-25)

- **[GUESS] No local coloration record exists for the Wasatch.** This is the big one. Harvard
  Forest's HF003 gave the eastern calibration a documented pattern to match; the western site has
  nothing equivalent that is openly available. `sCrit` for all three species is therefore bisected
  onto *qualitative* target dates from USU Extension, not fitted to observations — hence the
  `[GUESS]` tag rather than `[TUNE]`. Finding an open western phenology record would upgrade
  three constants at once.
- **[GUESS] `WINTER_PRECIP_SENS` magnitude.** Li, Donnelly & Wang 2026 establish that wet Jan–Mar
  delays autumn phenology in the western US, but give no days-per-unit figure in the abstract.
  The 0.32 is sized to produce a plausible span, not sourced. §11.3.
- **[P] Aspen's photoperiod independence rests on the European congener.** Michelson et al. 2018 is
  *Populus tremula*; the model applies it to *P. tremuloides*. Direct evidence for the North
  American species would firm this up — or overturn it, since the aspen profile is the one place
  the model departs structurally from the others.
- **Latitude and elevation are conflated.** The temperature baseline bakes in ~2100 m, and the
  latitude slider adds a lapse rate on top, so raising latitude compounds into a site above these
  species' real range. The slider is capped at 32–46°N to hide this rather than fix it. Making
  elevation its own control is the cleanest structural improvement available. §11.4.
- **[U] No source for the sugar submodel.** It reproduces the right behaviour (cloudy autumn →
  duller reds, emergently) but the mechanism is borrowed from the NetLogo toy model in §7, not
  from literature. Least defensible part of the design.
- **Colour anchors are unverified throughout.** The per-species greens in §11.6 are tagged `[P]`
  on observational grounds ("aspen is lighter and yellower, oak darker and leathery") and the
  autumn anchors are inherited hand-picked values. Nothing here is measured. §11.6.

### Resolved since the first pass

- ~~Whether sliders should modulate a baseline or override instantaneously.~~ Settled by §5: the
  solstice reversal means the *sign* of a temperature effect depends on when it lands, which an
  instantaneous override cannot represent.
- ~~Whether to expose latitude as a control.~~ Exposed, and it produced the validation in §11.4.
- ~~Whether the precipitation claim generalises.~~ It does not, and the western case now has a
  specific citation, window (Jan–Mar) and direction. §11.3.

---

## 10. Sources

Phenology models and senescence timing
- [Predicting Climate Change Impacts on the Amount and Duration of Autumn Colors in a New England Forest — PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0057373)
- [Process-oriented models of autumn leaf phenology: ways to sound calibration — Geosci. Model Dev. 16, 7171 (2023)](https://gmd.copernicus.org/articles/16/7171/2023/)
- [Detecting the onset of autumn leaf senescence in deciduous forest trees of the temperate zone](https://pmc.ncbi.nlm.nih.gov/articles/PMC6713559/)
- [A new process-based model for predicting autumn phenology: photoperiod and temperature coupling](https://www.sciencedirect.com/science/article/abs/pii/S0168192319300061)
- [Leaf phenology and radiation extinction — medfate reference book (Delpierre model equations)](https://emf-creaf.github.io/medfatebook/leafphenologylight.html)
- [phenor: A phenology modelling framework in R](https://github.com/bluegreen-labs/phenor)
- [Aging and stress explain the earlier start of leaf senescence in warmer years: the DP3 model — Geosci. Model Dev. 18, 6963 (2025)](https://gmd.copernicus.org/articles/18/6963/2025/)
- [A trigger may not be necessary to cause senescence in deciduous broadleaf forests (bioRxiv)](https://www.biorxiv.org/content/10.1101/2023.06.07.544057.full.pdf)

Solstice reversal and day/night asymmetry
- [Effect of climate warming on the timing of autumn leaf senescence reverses after the summer solstice — Science](https://www.science.org/doi/10.1126/science.adf5098)
- [Developmental constraints mediate the reversal of temperature effects on autumn phenology of European beech — eLife](https://elifesciences.org/articles/107554)
- [Contrasting responses of autumn-leaf senescence to daytime and night-time warming — Nature Climate Change 8, 1092 (2018)](https://www.nature.com/articles/s41558-018-0346-z)
- [Larger diurnal temperature range undermined later autumn leaf senescence with warming in Europe](https://onlinelibrary.wiley.com/doi/10.1111/geb.13674)

Pigments and colour
- [Association of red coloration with senescence of sugar maple leaves in autumn — USFS](https://www.nrs.fs.usda.gov/pubs/jrnl/2008/nrs_2008_schaberg_002.pdf)
- [Early Autumn Senescence in Red Maple Is Associated with High Leaf Anthocyanin Content](https://pmc.ncbi.nlm.nih.gov/articles/PMC4844408/)
- [PROSPECT-PMP+: Simultaneous Retrievals of Chlorophyll a and b, Carotenoids and Anthocyanins](https://pmc.ncbi.nlm.nih.gov/articles/PMC9028795/)
- [A new dataset of leaf optical traits (LOTUS) — Remote Sensing of Environment 2024](https://www.sciencedirect.com/science/article/pii/S0034425724004504)
- [Autumn Leaf Color: The Majesty & Mystery (cyanidin-3-glucoside ≈ 80 %)](https://static.csbsju.edu/documents/Herbarium/Publications/saupe_maple_majesty_mystery.pdf)

Weather effects, frost, drought, marcescence
- [Science of Fall Colors — US Forest Service](https://www.fs.usda.gov/visit/fall-colors/science-of-fall-colors)
- [The Rise and Fall of Foliage — US National Park Service](https://www.nps.gov/articles/the-rise-and-fall-of-foliage.htm)
- [The interaction between freezing tolerance and phenology in temperate deciduous trees](https://pmc.ncbi.nlm.nih.gov/articles/PMC4192447/)
- [Early Autumn: Drought Accelerates Leaf Senescence in Temperate Tree Species](https://pmc.ncbi.nlm.nih.gov/articles/PMC12720066/)
- [Declining precipitation frequency may drive earlier leaf senescence — Nature Communications](https://www.nature.com/articles/s41467-025-56159-4)
- [The stubborn beauty of oak leaves: marcescence explained — Illinois Extension](https://extension.illinois.edu/blogs/good-growing/2024-12-06-stubborn-beauty-oak-leaves-marcescence-explained)
- [When Oak Leaves Fail to Fall — International Oak Society](https://www.internationaloaksociety.org/content/when-oak-leaves-fail-fall)
- [Settling aerodynamics is a driver of symmetry in deciduous tree leaves (11 m/s reconfiguration)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12055283/)

Datasets and observation protocols
- [USA-NPN Observational Data](https://www.usanpn.org/data/observational)
- [USA-NPN Plant and Animal Phenophase Definitions v2.1 (PDF)](https://usanpn.org/files/npn/reports/USA-NPN_Plant_and_Animal_Phenophase_Definitions_v2.1.pdf)
- [Harvard Forest HF003 — Phenology of Woody Species since 1990](https://harvardforest1.fas.harvard.edu/exist/apps/datasets/showData.html?id=HF003)
- [Harvard Forest HF001 — Fisher Meteorological Station since 2001](https://harvardforest1.fas.harvard.edu/exist/apps/datasets/showData.html?id=HF001)
- [Harvard Forest HF000 — Shaler Meteorological Station 1964–2002](https://harvardforest1.fas.harvard.edu/exist/apps/datasets/showData.html?id=HF000)

Reference implementation and regional timing
- [NetLogo Autumn model source](https://github.com/NetLogo/Teletortoise/blob/master/public/modelslib/Sample%20Models/Biology/Autumn.nlogo)
- [The science behind fall colors — Minnesota DNR](https://www.dnr.state.mn.us/fall_colors/typical_peak.html)
- [Guide to North Shore Peak Fall Colors (species-level peak dates)](https://northshoreexplorermn.com/guide-to-north-shore-peak-fall-colors/)

---

# 11. Wasatch montane calibration — THE LIVE SITE

Added 2026-08-25, when the model moved from New England to the interior West. Everything in
this section supersedes the corresponding site-specific material in §1–§10.

**Reference point:** Park City, Utah — 40.65°N, ~2100 m, semi-arid continental.

The move was not a retune. Three things changed structurally:
1. Precipitation went from a weak secondary lever to the **primary** driver.
2. One species stopped being photoperiod-gated at all.
3. The temperature signature became an **elevation** signature, which the latitude machinery
   could not express.

---

## 11.1 Temperature baseline

Fitted to Park City 1991–2020 normals **[V]**:

| Month | Mean low | Mean high | Diurnal range |
|---|---:|---:|---:|
| Aug | 11 °C | 26 °C | 15 |
| Sep | 6 °C | 20 °C | 14 |
| Oct | 1 °C | 13 °C | 12 |
| Nov | −5 °C | 6 °C | 11 |

Sinusoid fitted through the September and October lows — the two months that decide autumn:

```
Tmin(doy) = 0.4205 + 10.313 · cos(2π (doy − 200) / 365)      [V]
Tmax      = Tmin + 14.0                                       [V]
```

**Compared with the New England baseline this has a SMALLER seasonal amplitude (10.3 vs 13.4)
but a far colder offset (0.42 vs 2.25), and a wider diurnal range (14 vs 12 °C).** That
combination is the signature of elevation rather than latitude, and it is why the whole
baseline had to be swapped rather than shifted — the latitude lapse rate in §11.4 cannot
produce a colder mean *and* a flatter seasonal swing at the same time.

### Night-to-night variance is load-bearing here **[P]**

```
T_NOISE_SD_C = 2.6 °C
```

This is not decoration. Park City's mean September low is 6 °C, but its **first freeze normal
is around September 25** — which can only happen through large clear-sky radiative-cooling
swings. Dry air and clear skies make montane minima far more variable than New England's.
With the eastern noise width the model would never freeze in September at all.

### Resulting frost regime (measured over 40 synthetic seasons)

| Quantity | Model | Reference |
|---|---|---|
| Median first frost (Tmin ≤ 0 °C) | **Oct 3** | ~Sep 25 normal **[V]** |
| Median first hard freeze (≤ −2 °C) | **Oct 14** | — |
| Frost nights per season | 38.5 | — |
| Hard-freeze nights per season | 26.9 | — |

Eight days late on first frost, which is acceptable for a sinusoid through monthly means. The
hard-freeze count matters more than it looks — see §11.3.

---

## 11.2 Species — the western trio

From USU Forestry Extension, "Fall Color in Utah" **[V]**. These three carry most of Utah's
fall colour and map onto the eastern maple/oak/birch roles closely enough that **no equation
changed** — only the config table.

| Parameter | Bigtooth maple<br>*Acer grandidentatum* | Gambel oak<br>*Quercus gambelii* | Quaking aspen<br>*Populus tremuloides* |
|---|---|---|---|
| Anthocyanin potential | 1.00 **[V]** "brilliant orange-red" | 0.55 **[V]** "orange to red-orange" | 0.15 **[V]** "usually bright yellow", can be orange-red |
| `pSen` photoperiod gate | 13.0 h | 12.5 h | **24 h — no gate** |
| `ySen` photoperiod weight | 2.0 | 2.0 | **0 — pure thermal** |
| `sCrit` | 630 **[GUESS]** | 1114 **[GUESS]** | 605 **[GUESS]** |
| Chlorophyll decay | 1.00 | 0.80 | 1.40 |
| Carotenoid | 0.42 | 0.34 | 0.58 |
| Marcescence | 0 | 0.35 **[V]** | 0 |
| Base green H/S/L | 106 / .46 / .33 | 116 / .40 / .25 | 95 / .50 / .40 **[P]** |
| Elevation band **[V]** | lower/mid canyons | foothills to mid | highest, to 10,000 ft+ |
| Senescence completes | ~Oct 7 | ~Oct 14 | ~Sep 22 |

Colour sequence being reproduced **[V]**: high-country aspen turns first (mid-to-late
September), then bigtooth maple and Gambel oak in the lower canyons through the first two
weeks of October.

### Aspen is not photoperiod-gated — the one architectural change **[V]**

Michelson et al. 2018 grew **116 aspen genotypes** in two common gardens 8° of latitude apart
(56.0°N and 63.9°N, ~17.5 h vs ~21 h maximum day length). Their conclusion:

> "the data on initiation of autumn senescence were incompatible with the trigger being the
> day length per se"

Bud set *was* photoperiodic. Senescence was not — genotypes senescing before the equinox
started **earlier in the northern garden, where days were longer**, the reverse of what
photoperiod control predicts. The authors attribute it to "a light-derived factor other than
photoperiod."

**Caveat [P]:** that work is on *Populus tremula*, the European congener, not *P. tremuloides*.

This is why `ySen` moved from a global constant into the species table. Setting `pSen: 24`
(gate permanently open) and `ySen: 0` (photoperiod term collapses to 1) leaves pure
cold-degree-day accumulation from the solstice. Species-specific weighting of photoperiod vs
thermal forcing is the documented position, not a workaround — there is a paper titled almost
exactly that (see §11.7).

**Consequence for `sCrit`:** values are **not comparable between a gated and an ungated
species**. Aspen accumulates from the solstice, roughly ten extra weeks before September, so
its 605 and maple's 630 mean completely different things. Re-run `calibrate-species.js` after
touching `T_SEN_C`, `X_SEN`, `pSen` or `ySen`.

---

## 11.3 Antecedent winter precipitation — the western primary driver

**Citation:** Li, X., A. Donnelly & Y. Wang. 2026. *Contrasting precipitation controls on
autumn phenology across eastern and western U.S.* Agricultural and Forest Meteorology
384:111190. **[V]**

This sharpens what §3.5 and §1 could only say vaguely:

| | Eastern US | Western US |
|---|---|---|
| Dominant control | Summer temperature | **January–March precipitation** |
| Effect | Warm summer delays colour | **Wet Jan–Mar → colour and leaf fall LATER** |

So the "more than six months prior" in §1 has a specific window (Jan–Mar) and a specific
direction (wet → later). Implemented as a **seasonal conditioner**, not a daily driver — it
already happened before the season starts:

```
sCrit_effective = sCrit · (1 + 0.32 · (winterPrecip − 1))     [GUESS] magnitude
sugarScale      = clamp(0.60 + 0.40 · winterPrecip, 0.60, 1.25)
```

The sugar term carries drought through to *colour* as well as timing: a dry antecedent winter
means less carbon, a smaller sugar pool, and duller reds — consistent with §3.5. Measured:
maple peak anthocyanin 0.61 after a dry winter vs 1.00 after a normal one.

Blonder et al. 2023 found aspen responds to climate **up to three years back** **[V]**. Not
modelled — one antecedent season is as far as this goes.

### The frost wall — an emergent result worth keeping

The realised delay is **species-dependent and asymmetric**, and this was not designed in.
Measured span of senescence completion across the full 0–2× winter-precipitation range:

| Species | Dry (0×) | Normal (1×) | Wet (2×) | Span |
|---|---|---|---|---:|
| Quaking aspen | Sep 7 | Sep 22 | Oct 2 | **24 d** |
| Bigtooth maple | Oct 1 | Oct 7 | Oct 11 | 10 d |
| Gambel oak | Oct 11 | Oct 14 | Oct 18 | 7 d |

Median first hard freeze is **Oct 14** (§11.1). A wet winter cannot push a species past the
frost. So **early species express the antecedent-winter signal fully and late species get
truncated** — a real prediction that falls out of the interaction, not something encoded.

### Two bugs this driver flushed out

Both are worth recording because both were silent:

1. **Frost bumps were scale-invariant.** Sized as a fraction of `sCrit`, they scaled up
   exactly in step with a wet winter's raised requirement, cancelling the driver almost
   perfectly. A frost event does a *fixed* amount of damage, not proportionally more because
   the tree needed more accumulation. Now keyed to the base `sCrit`.
2. **It was being measured at the wrong level.** Leaf-off is a poor probe — abscission and
   frost both sit downstream and compress the signal. Measured at senescence completion, the
   level `sCrit` actually acts on, the driver was working the whole time.

---

## 11.4 Latitude — and why the slider is capped

```
LAT_LAPSE_C     = 0.65 °C per degree   [P]
LAT_AMP_PER_DEG = 0.012                [P]
```

Note from §2 that **day length varies by less than 0.25 h across this whole latitude range**.
The latitude slider's visible effect is therefore almost entirely the temperature lapse, not
photoperiod.

Measured sweep, bigtooth maple, 5 weather seeds averaged:

| Latitude | 50 % leaf-off | Peak anthocyanin |
|---:|---|---:|
| 30°N | Oct 25 | 0.34 |
| 34°N | Oct 21 | 0.56 |
| **38°N** | Oct 15 | **0.82** |
| **42°N** | Oct 4 | **0.83** |
| 46°N | Sep 25 | 0.12 |

**The colour optimum sits at 38–42°N, bracketing the 40.65°N reference site.** Nothing in the
model knows where it was calibrated — the temperature baseline is a bare sinusoid and the
species table holds no coordinates — so this is the strongest single validation available for
this site. It is also bigtooth maple's real prime range in the central Rockies.

Under the *New England* baseline the same sweep put the optimum at 45–50°N. It moved south
because elevation now supplies the cold that latitude used to. Both ends are dull for
different reasons: warm southern autumns lack the cool nights, and cold northern ones freeze
before chlorophyll has degraded, latching anthocyanin off at zero.

**Slider capped at 32–46°N.** Past ~44°N the montane baseline plus the lapse rate puts a
2100 m site above these species' actual range — first freeze in early September, every season
just brown. That is the frost latch working correctly, but it is a cliff rather than a
gradient, so the range is limited to where the model is meaningful. **This conflates latitude
with elevation and is the cleanest thing to fix next** (see §9).

---

## 11.5 Live constants

Supersedes the §4 block.

```json
{
  "_provenance": "Wasatch montane, Park City UT 40.65N ~2100 m. Tags: [V] sourced, [P] plausible, [TUNE] free parameter inside a published range, [GUESS] no range and no local record.",
  "site":    { "latitude": 40.65, "elevation_m": 2100, "label": "Wasatch montane, semi-arid" },
  "season":  { "start_doy": 213, "accumulation_start_doy": 173, "length_days": 120 },

  "temperature": {
    "tmin_offset_c":  0.4205,
    "tmin_amp_c":     10.313,
    "peak_doy":       200,
    "diurnal_range_c": 14.0,
    "noise_sd_c":      2.6,
    "lat_lapse_c_per_deg": 0.65,
    "lat_amp_per_deg":     0.012
  },

  "senescence": {
    "model": "Delpierre DM2, photoperiod-gated cold-degree-day sum",
    "cdd_base_temp_c": 20.0,
    "temp_exponent_x": 1.0,
    "temp_driver": "daily_minimum",
    "_note": "photoperiod weight y_sen is PER SPECIES; 0 = pure thermal accumulator"
  },

  "species": {
    "bigtoothMaple": { "pSen": 13.0, "ySen": 2.0, "sCrit": 630,  "chlDecay": 1.00,
                       "carotenoid": 0.42, "anthoPotential": 1.00, "fallFloor": 0.55,
                       "marcescence": 0.00, "green": { "h": 106, "s": 0.46, "l": 0.33 } },
    "gambelOak":     { "pSen": 12.5, "ySen": 2.0, "sCrit": 1114, "chlDecay": 0.80,
                       "carotenoid": 0.34, "anthoPotential": 0.55, "fallFloor": 0.60,
                       "marcescence": 0.35, "green": { "h": 116, "s": 0.40, "l": 0.25 } },
    "aspen":         { "pSen": 24.0, "ySen": 0.0, "sCrit": 605,  "chlDecay": 1.40,
                       "carotenoid": 0.58, "anthoPotential": 0.15, "fallFloor": 0.50,
                       "marcescence": 0.00, "green": { "h":  95, "s": 0.50, "l": 0.40 } }
  },

  "chlorophyll": { "k": 6.2, "logistic_cap": 1.05,
                   "_note": "LOGISTIC not exponential — exponential front-loads the loss and empties the leaf weeks before the cool nights arrive" },

  "sugar": { "production": 0.28, "respiration": 0.035, "export": 0.25,
             "export_t_lo_c": 2.0, "export_t_span_c": 10.0 },

  "anthocyanin": { "k": 3.4, "t_min_c": 0.0, "t_peak_c": 7.0, "t_max_c": 12.0,
                   "couple_to": "chlorophyll_degradation_rate",
                   "halted_permanently_by_frost": true },

  "tannin": { "onset_senescence": 0.70, "rate": 0.035 },

  "frost": { "light_frost_c": 0.0, "hard_freeze_c": -2.0,
             "_note": "senescence jumps are sized against BASE sCrit, not the winter-scaled one" },

  "abscission": { "k_fall": 0.09, "wind_negligible_ms": 8.0, "wind_steep": 3.0,
                  "rain_knockdown_mm": 15.0, "marcescent_readiness": 0.10,
                  "_note": "marcescent leaves are EXEMPT from the hard-freeze bonus, not merely discounted" },

  "winter_precip": { "scrit_sensitivity": 0.32, "sugar_lo": 0.60, "sugar_hi": 1.25 },

  "colour": { "tint_hue_deg": 7.0, "tint_sat": 0.07, "tint_light": 0.055,
              "tint_autumn_carry": 0.6,
              "anchor_yellow": { "h": 46, "s": 0.79, "l": 0.56 },
              "anchor_red":    { "h":  2, "s": 0.65, "l": 0.42 },
              "anchor_brown":  { "h": 29, "s": 0.39, "l": 0.31 } },

  "default_controls": { "tempOffset": 0, "cloudCover": 25, "windMean": 3.0,
                        "precipMult": 1.0, "winterPrecip": 1.0, "latitude": 40.65 }
}
```

### Default-season behaviour

| Metric | Value |
|---|---|
| 50 % of canopy down | **Oct 16** |
| Final fallen fraction | 88.7 % |
| Bigtooth maple | 100 % fallen, peak anthocyanin 0.97 |
| Gambel oak | **66 % fallen** (34 % retained — marcescence), peak anthocyanin 0.17 |
| Quaking aspen | 100 % fallen, peak anthocyanin 0.11 |

---

## 11.6 Colour variance — per species and per leaf

Anchors are held in **HSL** rather than RGB, because the variation that makes a canopy read as
a canopy runs along lightness and hue, and those are awkward to perturb in RGB without the
colour drifting somewhere unintended. The HSL values are conversions of the original RGB
constants, so the palette itself is unchanged.

```
per-leaf tint:  ±7° hue, ±0.07 saturation, ±0.055 lightness    [TUNE]
autumn carry:   0.6                                            [TUNE]
```

**Deliberately not done by widening the chlorophyll jitter.** `chlorophyll` is a state variable
driving the senescence colour trajectory, so scattering it would couple how a leaf *looks* to
when it *turns*. The physical basis for keeping them separate is in §3.6: leaf-to-leaf
difference in green comes mostly from chlorophyll *density* per unit area, which the LOPEX
ranges show varying over more than an order of magnitude — two leaves can both sit at full
chlorophyll and still be visibly different greens. `test-model.js` asserts this by mutating a
species' green to bright purple and checking the senescence trace is bit-identical.

The 0.6 autumn carry is a compromise: at 1.0 a dark-green leaf stays proportionally dark all
season, which overstates it, since a green leaf's individuality is largely the chlorophyll
density that is *gone* by peak colour. At 0 every leaf snaps to an identical yellow the moment
the green drops out.

Measured at day 0 on a 24×14 grid:

| Species | Mean luminance | SD | Character |
|---|---:|---:|---|
| Quaking aspen | 131.8 | 10.1 | lightest, yellowest |
| Bigtooth maple | 106.1 | 10.1 | mid green, reference tone |
| Gambel oak | 74.9 | 9.6 | darkest, slightly blue-green |

**334 unique colours across 336 leaves.** Between-species separation (57 luminance, aspen to
oak) clears the within-species scatter (SD ~10) by well over 2.5×, so individuals vary without
the three-way species texture collapsing into noise. 235 of 236 attached leaves are still
distinct at peak colour on Oct 1.

---

## 11.7 Sources added for this section

- [Michelson et al. 2018 — *Autumn senescence in aspen is not triggered by day length*, Physiologia Plantarum](https://onlinelibrary.wiley.com/doi/10.1111/ppl.12593)
- [Li, Donnelly & Wang 2026 — *Contrasting precipitation controls on autumn phenology across eastern and western U.S.* (summary via USA-NPN)](https://www.usanpn.org/news/article/weather-impacts-autumn-phenology-differently-eastern-and-western-us)
- [Blonder et al. 2023 — *Climate lags and genetics determine phenology in quaking aspen*, New Phytologist](https://nph.onlinelibrary.wiley.com/doi/10.1111/nph.18850)
- [*Senescence in temperate broadleaf trees exhibits species-specific dependence on photoperiod versus thermal forcing*](https://www.sciencedirect.com/science/article/abs/pii/S0168192322002155)
- [USU Forestry Extension — *Fall Color in Utah*](https://extension.usu.edu/forestry/rural-forests/forest-facts-ecology/fall-color-utah)
- [Park City UT monthly temperature normals 1991–2020 — Current Results](https://www.currentresults.com/Weather/Utah/Places/park-city-temperatures-by-month-average.php)
- [*Acer grandidentatum* species review — USFS FEIS](https://research.fs.usda.gov/feis/species-reviews/acegra)
- [TreeUtah — *What Colorful Tree Is That?*](https://www.treeutah.org/blog/what-colorful-tree-is-that)
