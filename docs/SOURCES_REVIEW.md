# Phase 0 Source Review

This file records how each source was checked, which values were taken from
it, conflicts found, and how they were resolved. Parameter values themselves
live in `src/parameters.js`; bibliographic details in `src/references.js`.

Verification date: 2026-09-18 (abstract pass, then full-text pass the same day).

## Method

1. Every candidate citation was resolved against PubMed (E-utilities
   `esearch`/`esummary`); authors, journal, volume, pages, DOI and PMID in
   `src/references.js` come from those records.
2. Where an open-access full text exists (PubMed Central / Europe PMC), the
   values were read from the tables in the full text.
3. Where only the abstract was accessible, values were taken from the
   abstract and the reference is marked `access: "abstract"`. Such values
   are flagged below for confirmation against the full text if it becomes
   available.
4. Paywalled papers were then read in full from local copies in
   `references/` (named by citation key; not committed). Values were
   re-checked against their tables; see "Full-text verification" below.
5. Drug label limits were read from current FDA labels via openFDA; set IDs
   and effective dates are recorded.

## Sources used for model parameters

| key | access | used for | notes |
|-----|--------|----------|-------|
| morse2022 | full text (PMC9232434) + supplement | adult PK (CL, V1, Q, V2, F, absorption, formulation and feeding factors); reproduction of hannam2018 PD | 116 healthy adults with IV reference data, so F is identifiable |
| anderson2019 | full text | clearance maturation (TM50, Hill); cross-check of CL | pooled 30 published studies, neonates to adults |
| hannam2018 | full text | analgesia PD (Emax, C50, Hill, t1/2 keo) | children 2-12 y after tonsillectomy, pooled with adult dental-pain data |
| troconiz2000 | full text | antipyresis indirect response model | PD in 103 febrile children 4-16 y, 25-70 kg |
| blain2002 | full text (PMC1874310) | COX-1 / COX-2 IC50, IC80, whole-blood-to-plasma factor | also provides ex vivo validation data |
| pubchem3672 | database | molecular weight 206.28 g/mol | |
| FDA labels (5) | openFDA | dose-limit warnings, minimum age | |
| CDC / WHO growth data | data files | default weight for age | see `data/growth/README.md` |

## Sources used for cross-checks and validation only

| key | access | role |
|-----|--------|------|
| warner1999 | full text (PMC22126) | COX IC50 cross-check: COX-1 7.6 uM, COX-2 (WBA) 7.2 uM (Table 1) |
| hannam2011 | full text | adult dental pain EC50 5.07 mg/L, Emax 4.03 (Table 1; abstract 4.06), Hill 2, t1/2 keo 1.16 h |
| li2012 | full text | adult dental pain effect-site EC50 10.2 mg/L, k_e0 1.49 1/h; adult 400 mg tablet Cmax/Tmax |
| kauffman1992 | full text | pediatric 8 mg/kg PK (Cmax, tmax, AUC); k_e0 0.564 1/h; 1-3 h lag from peak concentration to peak effect |
| brown1998 | full text | pediatric antipyresis k_e0 0.57-0.70 1/h, EC50 11-13 mg/L; AUC rose 1.5-fold for a 2-fold dose |
| nahata1991 | full text | pediatric Cmax ranges, Tmax, CL/F, half-life |
| kelley1992 | full text | pediatric 6 mg/kg PK (Cmax, Tmax 54 min, absorption t1/2 16.3 min, CL, Vd); time to max temperature decrease 183 min |
| cicali2020 | full text (PMC7576628) | independent restatement of the troconiz2000 equation |
| lee1985 | abstract | R/S chiral inversion, 63 +/- 6% of R converted to S (future extension) |
| lockwood1983 | full text | nonlinear total AUC vs dose, linear free AUC (known limitation) |
| davies1998 | full text | background review; no values used |
| mazaleuskaya2015 | abstract | background review; no values used |

## Conflicts and decisions

1. **Morse 2022 abstract vs. Table 3.** The abstract gives ibuprofen "central
   volume of distribution ... 10.5 L/h/70 kg". Table 3 lists Q2 = 10.5
   L/h/70 kg and V1 = 6.05 L/70 kg. The abstract appears to have copied the
   Q2 value (and its units). **Decision:** use Table 3.

2. **Size descriptor.** Morse 2022 scales CL and V by normal fat mass (NFM),
   which needs height, sex, and an adult fat-free-mass equation that is not
   valid in children. **Decision:** scale by total body weight with the same
   allometric exponents (3/4 and 1). These agree exactly at the 70 kg / 1.76
   m reference. Support: anderson2019 used weight-based scaling across ages
   and obtained CL = 3.81 L/h/70 kg, close to Morse's 3.79. Morse's model
   building (Supplementary Table S1) also fitted a total-body-weight model.
   Effect: in obese adults the model will overpredict V and CL somewhat
   relative to Morse's final model.

3. **Which CL value.** anderson2019 (3.81) and morse2022 (3.79) agree.
   **Decision:** use 3.79 from morse2022 so that all disposition parameters
   come from one joint fit; use only the maturation function from
   anderson2019.

4. **Maturation function.** anderson2019 prints MF = PMA^Hill /
   (TM50^Hill + PMA^Hill) with TM50 = 36.8 weeks PMA. Hill is 11.9 in Table 1
   and 11.5 in the abstract. **Decision:** use the table value, 11.9. Above
   6 months of age MF > 0.998, so this barely affects the app's age range.

5. **COX IC50 source.** blain2002 and warner1999 give similar whole-blood
   IC50s (COX-1 4.3-7.6 uM; COX-2 7.2-10.0 uM). **Decision:** use blain2002
   because it (a) measured the whole-blood-to-plasma conversion factor for
   ibuprofen (1.65), so the IC50 can be applied to the model's plasma
   concentration; and (b) reports ex vivo inhibition in the same volunteers
   after oral dosing, which gives independent validation data. Hill slopes
   are derived from IC50/IC80 assuming 0-100% plateaus (the source's
   four-parameter fit does not report plateaus).
   **Known issue (from the source itself):** the in vitro curve predicts ex
   vivo COX-1 inhibition acceptably but underestimates ex vivo COX-2
   inhibition. The page must say so.

6. **Analgesia source population.** hannam2018 fitted children 2-12 y
   together with published adult dental-pain data and tested a child-vs-adult
   factor on the PD parameters; no difference was found (full text, Methods
   2.7.6 and Results). **Decision:** use hannam2018 for ages >= 2 y, adults
   included, without an "extrapolated" label. Adult cross-checks from the
   full texts: t1/2 keo 1.16 h (hannam2011 Table 1), k_e0 1.49 1/h
   (li2012 Table II).

7. **Antipyresis model choice.** Three pediatric models exist:
   - troconiz2000: indirect response, fully reported (Table V, equation
     p. 510), and restated independently in cicali2020.
   - brown1998: effect compartment with sigmoid Emax, with Emax fixed at
     (37 C - initial temperature) plus per-child slope and cyclic terms.
     Not reusable as a typical-patient model.
   - kauffman1992: linear effect (-0.242 C per mg/L), which is unbounded at
     high concentrations.

   **Decision:** use troconiz2000. brown1998 and kauffman1992 serve as
   timing cross-checks (effect delay, k_e0 about 0.6 1/h).
   Caveat: troconiz2000 fit the PD against concentrations predicted from
   its own adult PK model (scaled allometrically to each child's weight),
   not against concentrations measured in the children. Its PK model (CL
   4.05 L/h/70 kg, Table II) is close to morse2022's (3.79).

8. **Dose linearity.** lockwood1983 found total-concentration AUC is less
   than dose-proportional, and brown1998 reported 1.5-fold AUC for a 2-fold
   dose in children. nahata1991 found no dose effect between 5 and 10 mg/kg.
   The Rx label states a linear relationship for single doses up to 800 mg.
   **Decision:** v1 is linear. The page warns when a single dose exceeds
   800 mg (the label's linearity statement) or 10 mg/kg in a child (the
   highest single dose on the pediatric Rx label), and documents the
   limitation.
   Saturable protein binding stays a candidate extension; no source with
   usable binding parameters has been verified yet.

9. **Troconiz 2000 abstract encoding.** The PubMed text reads "bodyweight
   225kg"; the full text reads ">= 25kg" (Table I range 25-70 kg).
   Resolved.

10. **Formulations.** The plan listed fast-absorbed salts (lysine, arginine,
    sodium). No verified source with absorption parameters for these was
    found in this pass. **Decision:** v1 offers the three formulations
    parameterized in morse2022 (tablet, suspension, sachet), each fasted or
    fed. Salt formulations stay future work.

## Full-text verification (local PDFs)

| source | checked against | result |
|--------|-----------------|--------|
| troconiz2000 | Table V, equation p. 510, Table I | Equation confirmed. **EC50 is 6.18 mg/L** in Table V and the Discussion; the abstract's 6.16 was wrong, so the parameter was changed to 6.18. Emax 0.055, n 2.71, k_out 1.17 1/h, T0 38.8 C confirmed. The children weighed 25-70 kg and temperatures were axillary. The PD was driven by concentrations predicted from the adult PK model, scaled allometrically to each child. The Results text gives adult suspension tmax 0.5 h; the abstract says 0.9 h (validation target widened to 0.5-0.9 h). |
| hannam2018 | Table 2, Methods 2.2, 2.7 | Values confirmed: EMAX 0.648, C50 3.95 mg/L, Hill 1.48, t1/2 keo 1.04 h. Population is children 2-12 y, >= 10 kg, pooled with adult dental data. **The printed concentration-effect equation is not the standard Hill equation** (see "Unresolved" below). |
| anderson2019 | Table 1, Methods 2.2, 2.3 | Maturation form confirmed as printed: MF = PMA^Hill / (TM50^Hill + PMA^Hill). **Hill is 11.9 in Table 1; the abstract says 11.5.** Changed to 11.9. TM50 36.8 and CL 3.81 confirmed. The 6.3 mg/L target in the worked example uses a Hill coefficient of 1, although the text quotes 1.45. |
| hannam2011 | Table 1, Eq. 5 | Emax is 4.03 in Table 1 and 4.06 in the abstract (cross-check only; no parameter uses it). Adult ibuprofen t1/2 keo 1.16 h. Eq. 5 prints the same (1+U)^hill form as hannam2018. |
| li2012 | Tables I and II | Adult standard tablets 400 mg: Cmax 30.7 +/- 8.6 mg/L, Tmax 1.37 +/- 0.86 h, CL/F 3.66 L/h, V/F 8.12 L (one compartment). k_e0 1.49 1/h. Added to the validation data. |
| nahata1991 | Table 1 | Means added: Cmax 28.4 +/- 7.5 (5 mg/kg) and 43.6 +/- 18.6 mg/L (10 mg/kg). |
| kelley1992 | Table II | 6 mg/kg liquid: Cmax 26.67 mg/L, tmax 54 min, absorption t1/2 16.3 min (the morse2022 suspension estimate is 19.2 min), CL 0.96 mL/min/kg, Vd 164 mL/kg. |
| kauffman1992 | Methods, Table I | 8 mg/kg suspension given fasting: Cmax 35.8 +/- 16.7 mg/L, tmax 0.7 h, AUC 102.6 mg*h/L, k_e0 0.564 1/h (the abstract rounds to 0.6). Axillary temperatures. |
| brown1998 | Methods | In its Emax model Emax is fixed at (37 C - initial temperature), which differs from troconiz2000's structure. The 1.5-fold AUC finding is confirmed. |

## Analgesia equation form (decided; REVIEW-LATER)

hannam2018 (Methods 2.7.4) and hannam2011 (Eq. 5), from the same group,
both print

    Effect = EMAX * U^Hill / (1 + U)^Hill,   U = Ce / C50

However, both papers, and morse2022 Supplementary Table S3 (which cites Hill
1910), describe C50 as "the concentration associated with 50% of the maximal
drug effect". That is only true for the standard form

    Effect = EMAX * U^Hill / (1 + U^Hill)

The two forms give different curves with the same parameters. With Hill =
1.48, the printed form reaches half of EMAX at Ce = 6.6 mg/L, not 3.95 mg/L,
and the effect at Ce = C50 is 36% of EMAX instead of 50%. The printed form
cannot be read as a simple typo, because it appears identically in two
papers. The prose, however, consistently describes the standard form.

**Decision (2026-09-18, project owner):** use the standard form,
Effect = EMAX * U^Hill / (1 + U^Hill), treating the printed (1 + U)^Hill as a
typesetting error. Marked REVIEW-LATER: confirm with the corresponding
author (B. J. Anderson) or the original NONMEM code if available. The code
tags this decision with the same marker so it can be found by searching for
`REVIEW-LATER`.

## Open items

- [ ] REVIEW-LATER: confirm analgesia equation form with the authors
      (standard Hill form adopted; see "Analgesia equation form").
- [ ] REVIEW-LATER (adult-cmax-bias): predicted peaks run about 20-25% below
      observed adult means, and morse2022 Table 4 does not follow from its
      Table 3. See docs/VALIDATION_FINDINGS.md section 2.
- [ ] blain2002 repeated-dose sampling: which daily dose preceded the 2.5 h
      sample.
- [ ] WHO growth-standard redistribution terms (before public deployment).
- [ ] Pediatric-specific absorption parameters (the suspension factors are
      from adults). Compare against pediatric Tmax in validation.
- [ ] Source for saturable protein binding parameters (optional extension).
- [ ] Sources for the R/S enantiomer extension beyond lee1985.
