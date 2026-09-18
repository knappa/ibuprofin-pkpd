# Ibuprofen PK-PD Simulator: Project Plan

## 1. Goal

A single-page website that simulates ibuprofen pharmacokinetics (PK) and
pharmacodynamics (PD) for user-defined dosing regimens. Requirements:

- Runs entirely in the browser. The site is served as static files; the server
  performs no computation and stores no user data. Client-side storage
  (localStorage, URL hash) is allowed.
- ODE-based model. Every equation, parameter value, and unit is traceable to a
  cited, verified source.
- Covers adults and children, using a single "typical patient" (no
  between-subject variability in the first version).
- The user can run experiments: vary dose size, dose timing, number of doses,
  formulation, body weight, and age, then compare scenarios.
- Educational tool only. The page states clearly that it is not medical advice.

### Scope decisions (settled)

| topic            | decision                                                   |
|------------------|------------------------------------------------------------|
| population       | adults and children                                        |
| drug form        | racemic mixture; R/S enantiomer model documented as a future extension |
| PD endpoints     | COX-1/COX-2 inhibition, analgesia, antipyresis             |
| variability      | typical patient only in v1; Monte Carlo bands later        |
| hosting          | static web hosting; no server computation or server-side user data |

## 2. Guiding rule: no uncited numbers

Every parameter enters the code through one table (`src/parameters.js`), and
each row carries:

| field        | example                                  |
|--------------|------------------------------------------|
| `symbol`     | `CL_F`                                   |
| `value`      | numeric value                            |
| `units`      | `L/h`                                    |
| `population` | healthy adults, n = ?, fasted            |
| `source`     | citation key, e.g. `lee1985`             |
| `location`   | table / figure / page in the source      |
| `notes`      | derivation or unit conversion, if any    |

A unit test fails if any parameter lacks a `source` and `location`, or if a
citation key is missing from the bibliography. The in-page "Model and
References" section is generated from the same table, so the documentation
cannot drift from the code.

"Verified" means: the paper was located (DOI or PMID resolved), the value was
read from the stated table/figure, and any conversion is written out in
`notes`. Values reported only as means are labeled as such; ranges/CVs are
recorded where available for later variability work.

## 3. Model (settled in Phase 0)

The full specification, with equations, is in `docs/MODEL.md`; every value
and its source is in `src/parameters.js`; the reasoning is in
`docs/SOURCES_REVIEW.md`. Summary:

- **PK:** two-compartment disposition, first-order absorption with lag
  time (Morse et al. 2022, 116 healthy adults with IV reference data).
  Allometric size scaling by total body weight (exponents 3/4 and 1),
  plus clearance maturation (Anderson and Hannam 2019). The maturation term
  is essentially 1 at ages 6 months and older.
- **Formulations:** tablet, oral suspension, sachet, each fasted or fed
  (Morse 2022 Table 3). Fast-absorbed salts are dropped from v1 because no
  verified source with absorption parameters was found.
- **COX-1/COX-2 inhibition:** direct sigmoid on plasma concentration, from
  whole blood IC50/IC80 with a measured whole-blood-to-plasma factor
  (Blain et al. 2002).
- **Analgesia:** effect compartment plus fractional Emax (Hannam et al.
  2018, pediatric; applied to adults as in Morse 2022).
- **Antipyresis:** indirect response on temperature in degrees C
  (Troconiz et al. 2000, febrile children 4-16 y).
- **Linear PK in v1.** Saturable protein binding is deferred: no verified
  source with usable binding parameters yet. Dose warnings flag the range
  where linearity is doubtful.
- **Future extension:** R/S enantiomer model with chiral inversion
  (`docs/MODEL.md` section 5).

### 3.6 Derived outputs

Cmax, Tmax, AUC (per dose interval and total), trough, time above a
user-chosen concentration or effect threshold, cumulative 24 h dose, and a
visible note when the 24 h total exceeds labeled maxima (OTC and prescription
labeling limits, cited from FDA labeling).

## 4. Software architecture

No build-time dependencies required to run. Proposed layout:

```
index.html              page shell, controls, plot containers
src/solver.js           ODE integrator (Dormand-Prince RK45, adaptive step)
src/model.js            right-hand sides, dose-event handling, derived metrics
src/parameters.js       the single parameter table (section 2)
src/references.js       bibliography (key, authors, title, journal, year, DOI, PMID)
src/ui.js               dose table, regimen builder, scenario comparison
src/plots.js            plotting wrapper
docs/MODEL.md           full model description, equations, assumptions
tests/*.test.js         run with `node --test`
```

Decisions:

- **Solver.** Hand-written adaptive RK45 (about 100 lines), integrating
  piecewise between dose events so discontinuities never fall inside a step.
  The system is small and non-stiff; no library needed.
- **Plotting.** Vendor a small charting library (uPlot or Chart.js) into
  `vendor/` so the page works offline, or draw SVG directly. Recommendation:
  uPlot (small, fast, handles multi-series time data well).
- **Delivery.** Static files (ES modules), no build step. During development
  serve locally with `python -m http.server` (or an equivalent `npm` script,
  e.g. `npx http-server`). GitHub Pages is the likely final destination; any
  static host works since the server only serves files.
- **Privacy / no server-side data.**
  - All libraries, fonts, and KaTeX are vendored into the repo. The page
    makes no requests to third-party CDNs at run time, and it has no analytics
    or tracking.
  - Shared scenarios go in the URL **hash** (`#...`), never in the query
    string. Browsers do not send the hash to the server, so shared links
    never reach server logs.
  - Named, saved scenarios are kept in `localStorage`, on the user's device
    only.
  - CSV export is generated in the browser as a Blob download.
  - A Content-Security-Policy meta tag (`default-src 'self'`) enforces the
    no-network rule.

## 5. Sources

Phase 0 is complete. All citations were resolved in PubMed and are listed
in `src/references.js`, with how each was accessed (full text, abstract,
secondary, label, dataset). `docs/SOURCES_REVIEW.md` records conflicts,
decisions, and open items (mostly paywalled full texts whose abstract values
should be confirmed).

## 6. Phases

### Phase 0: Literature verification (DONE 2026-09-18)
- Resolve each candidate source (DOI/PMID), extract parameter values with
  table/figure locations, record population and conditions.
- Resolve conflicts between sources explicitly (pick one, document why).
- Collect published observed data for validation: mean Cmax, Tmax, AUC, and
  where possible concentration-time profiles for 200 mg, 400 mg, 800 mg
  single doses and at least one multiple-dose regimen, in adults AND in
  children (separate studies from those used to estimate parameters, where
  possible).
- Collect PD validation data: observed pain relief and temperature time
  courses, and ex vivo COX inhibition time courses if published.
- Deliverable: filled `src/parameters.js`, `src/references.js`,
  `docs/MODEL.md` draft, and a short `docs/SOURCES_REVIEW.md` recording what
  was checked, conflicts found, and how they were resolved.

### Phase 1: Numerical core (DONE 2026-09-18)
- RK45 solver with dose events.
- Model defined from a declarative description (states, parameters, RHS), so
  the R/S extension can be added later without rewriting the solver.
- Tests: two-compartment oral model vs its closed-form (tri-exponential)
  solution, and the one-compartment case vs the Bateman equation (single
  and multiple doses, relative error < 1e-6); mass balance; effect
  compartment steady state equals plasma steady state; indirect response
  model returns to baseline temperature after drug washout; covariate scaling
  reproduces source-reported typical values at reference weight/age.

### Phase 2: Model validation
- Open question from Phase 1 smoke test: a typical 70 kg adult given 300 mg
  tablet fasted gets Cmax ~17.6 mg/L, below the morse2022 Table 4 median
  (24.1 mg/L; 10-90%: 13.3-40.8). Inside the interval, but investigate
  (typical value vs. median of a variable population; NFM vs. total body
  weight scaling) before accepting.
- Simulate the Phase 0 validation scenarios for adults and children; compare
  Cmax, Tmax, AUC, and PD time courses against published means and ranges.
  Record results, including failures, in `docs/VALIDATION.md`.
- Acceptance: simulated summary metrics fall within reported variability of
  the independent studies. Where a scenario cannot be validated, the page
  says so.

### Phase 3: User interface
- Patient panel: age, weight (with growth-chart default), baseline
  temperature for the fever model; out-of-range warnings.
- Dose entry in mg or mg/kg (converted and displayed both ways).
- Dose table: add/remove rows (time, amount, formulation).
- Regimen builder: "X mg (or mg/kg) every N h for M doses", with first-dose
  time.
- Plots: plasma concentration; COX-1/COX-2 inhibition; pain relief;
  temperature. Extrapolation labels where applicable; optional threshold
  lines.
- Metrics table and 24 h cumulative dose warnings (adult mg, pediatric mg/kg).
- Scenario comparison: pin a run and overlay the next one; save named
  scenarios to localStorage.

### Phase 4: Documentation in the page
- "Model and References" section auto-generated from the parameter table:
  equations (rendered with vendored KaTeX), parameter table with DOI links,
  source populations, assumptions and limitations, and a description of the
  planned R/S extension.
- Disclaimer: educational use; not for clinical dosing decisions.

### Phase 5: Packaging and polish
- Local static serving (`python -m http.server`); later GitHub Pages. Verify with browser dev tools that
  no third-party requests occur and nothing is sent to the server beyond the
  static file fetches.
- Accessibility (keyboard, labels, color-blind-safe palette), mobile layout.
- URL-hash scenario sharing, CSV export.

### Later
- R/S enantiomer model with chiral inversion (section 3.4).
- Inter-individual variability: Monte Carlo sampling using reported
  between-subject variability, shown as prediction bands.
- Hepatic/renal impairment adjustments (only with sources).

## 7. Settled details

- **Serving.** `python -m http.server` or an `npm` script for now; GitHub
  Pages later.
- **Pediatric lower age bound.** 6 months (OTC labeling minimum), narrowed
  further if the verified PK sources do not cover it.
- **Units.** Temperature is stored and computed in degrees C internally;
  displayed in degrees F by default with a C toggle. Concentration in mg/L
  with a umol/L toggle.
