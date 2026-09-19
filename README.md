# Ibuprofen PK-PD Simulator

A single-page web app that simulates ibuprofen blood levels and effects
(COX-1/COX-2 inhibition, pain relief, fever reduction) for a typical adult or
child, so you can experiment with dose size, timing, formulation and food.

**For education only. Not medical advice; do not use it to choose doses.**

- The model is a system of ordinary differential equations solved in the
  browser. The server only serves static files: no computation and no user
  data on the server.
- Every parameter value is taken from a cited, checked source. Each value
  records the table or section of the paper it came from, and a test fails
  if any value lacks a citation.
- The model is validated against published adult and pediatric data.

## Running it

Any static file server works. From the repository root:

```bash
npm run serve
```

This runs `python3 -m http.server 8000`; then open <http://localhost:8000>.
Opening `index.html` directly from disk will not work, because browsers
block ES modules loaded from `file://`.

No build step and no dependencies. Node.js (18+) is needed only for the tests
and scripts.

## Tests and validation

```bash
npm test            # unit tests, closed-form checks, citation checks, validation regression
npm run validate    # regenerate docs/VALIDATION.md
npm run build:growth  # regenerate src/growth-data.js from data/growth/*.csv
```

## Layout

| path | contents |
|------|----------|
| `index.html`, `src/ui/` | page, controls, SVG charts, in-page documentation |
| `src/model.js` | PK-PD model (two-compartment PK, effect compartment, indirect response, COX inhibition) |
| `src/solver.js` | adaptive Dormand-Prince 5(4) ODE integrator with dose events |
| `src/parameters.js` | every numeric parameter, with source and location |
| `src/references.js` | bibliography (DOI, PMID, how each source was checked) |
| `src/validation-data.js`, `src/validation.js` | published observations and the comparison code |
| `src/warnings.js`, `src/scenario.js` | label dose-limit warnings, extrapolation labels, URL/scenario encoding |
| `data/growth/` | WHO and CDC weight-for-age tables (default weights) |
| `docs/` | model description, source review, validation report and findings |
| `references/` | local PDFs used for verification (not committed; see its README) |

## The model in brief

- **PK:** two compartments with first-order absorption and a lag time. The
  parameters come from Morse et al. 2022 (116 healthy adults, including IV
  data). Size is scaled by body weight (allometric exponents 3/4 and 1), with
  clearance maturation from Anderson & Hannam 2019. Tablet, suspension and
  sachet can each be taken fasted or fed.
- **COX-1/COX-2:** direct sigmoid inhibition, from whole-blood assays
  (Blain et al. 2002).
- **Pain relief:** effect compartment plus a fractional Emax model
  (Hannam et al. 2018; children and adults).
- **Fever:** indirect-response model on body temperature (Troconiz et al.
  2000; febrile children).

The full equations, parameter tables and references are in the page itself
("How the model works") and in `docs/MODEL.md`. `docs/SOURCES_REVIEW.md`
records every conflict found in the literature and how it was resolved.

## Known issues under review

Search the code and docs for `REVIEW-LATER`:

- `analgesia-equation-form`: the pain-relief source papers print an equation
  that contradicts their own definition of C50. The standard Hill form is
  used here.
- `adult-cmax-bias`: predicted adult peak concentrations run about 20% below
  published means. The source's own simulations disagree with its parameter
  table.

Other limitations: typical patient only (no between-person variability),
linear PK, and racemic ibuprofen modeled as a single drug. The R/S
enantiomer model is a planned extension.

## Privacy

The page loads only its own files. A Content-Security-Policy blocks
third-party requests, and there are no analytics, fonts or CDNs. Saved
scenarios stay in the browser's local storage. Shared links store the
scenario after `#s=`; browsers never send that part of the URL to the
server.

## Deploying to GitHub Pages

The repository root is the site. Enable Pages for the default branch, with
the root folder as the source. `.nojekyll` makes Pages serve the files
unchanged, so the `docs/*.md` links work.

## License

Copyright 2026 Adam Knapp. Licensed under the Apache License, Version 2.0; see
[LICENSE](LICENSE).

The growth-chart data in `data/growth/` are third-party data (CDC and WHO)
redistributed under their own terms; see `data/growth/README.md`. Cited
papers are not included in the repository.
