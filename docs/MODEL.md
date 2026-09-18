# Ibuprofen PK-PD Model (v1, draft)

A deterministic "typical patient" model of racemic ibuprofen after oral
dosing, for adults and children aged 6 months and older. Every parameter is
listed with its source in `src/parameters.js`; the reasoning behind each
choice is in `docs/SOURCES_REVIEW.md`.

For education only. Not for clinical dosing decisions.

## 1. Pharmacokinetics

Two-compartment disposition with first-order absorption and a lag time
(morse2022).

### State variables

| symbol | meaning | units |
|--------|---------|-------|
| $A_{gut,i}$ | amount remaining to be absorbed from dose $i$ | mg |
| $A_c$ | amount in the central compartment | mg |
| $A_p$ | amount in the peripheral compartment | mg |

Each dose has its own gut compartment, because doses can differ in
formulation and fed state and therefore in $k_a$ and lag time. The model is
linear, so this is equivalent to superposition.

### Equations

$$
\frac{dA_{gut,i}}{dt} = -k_{a,i}\,A_{gut,i}
$$

$$
\frac{dA_c}{dt} = \sum_i k_{a,i}\,A_{gut,i}
 - \frac{CL}{V_1}A_c - \frac{Q}{V_1}A_c + \frac{Q}{V_2}A_p
$$

$$
\frac{dA_p}{dt} = \frac{Q}{V_1}A_c - \frac{Q}{V_2}A_p
$$

$$
C_p = \frac{A_c}{V_1}\quad\text{(mg/L, total plasma concentration)}
$$

Dose $i$ of $D_i$ mg taken at time $t_i$ adds $F \cdot D_i$ to
$A_{gut,i}$ at time $t_i + t_{lag,i}$. The integrator stops at every such
time, so discontinuities never fall inside a step.

### Absorption

$$
k_{a,i} = \frac{\ln 2}{t_{1/2,abs} \cdot f_{abs}(\text{formulation}_i, \text{fed}_i)},
\qquad
t_{lag,i} = t_{lag} \cdot f_{lag}(\text{formulation}_i, \text{fed}_i)
$$

Baseline $t_{1/2,abs} = 26.7$ min and $t_{lag} = 6.66$ min (tablet,
fasted). The factors $f_{abs}$ and $f_{lag}$ for suspension and sachet,
fasted or fed, are from morse2022 Table 3.

### Size and age

$$
CL = CL_{std}\left(\frac{WT}{70}\right)^{3/4} MF(PMA),\qquad
Q = Q_{std}\left(\frac{WT}{70}\right)^{3/4}
$$

$$
V_1 = V_{1,std}\frac{WT}{70},\qquad V_2 = V_{2,std}\frac{WT}{70}
$$

$$
MF(PMA) = \frac{PMA^{11.9}}{36.8^{11.9} + PMA^{11.9}},\qquad
PMA = \text{postnatal age (weeks)} + 40
$$

Typical values for 70 kg: $CL_{std} = 3.79$ L/h, $V_{1,std} = 6.05$ L,
$Q_{std} = 10.5$ L/h, $V_{2,std} = 4.37$ L, $F = 0.941$ (morse2022).
Maturation (anderson2019) is $\geq 0.998$ for all ages the app accepts.

## 2. Pharmacodynamics

### 2.1 COX-1 and COX-2 inhibition (direct effect)

$$
I_{COX}(t) = 100\% \cdot \frac{C_p^{\,n}}{IC_{50}^{\,n} + C_p^{\,n}}
$$

| | IC50 whole blood (uM) | IC80 whole blood (uM) | IC50 plasma (mg/L) | n |
|---|---|---|---|---|
| COX-1 | 4.30 | 40.8 | 1.46 | 0.616 |
| COX-2 | 10.0 | 74.9 | 3.40 | 0.688 |

Conversions: plasma IC50 = whole-blood IC50 x 1.65 x 206.28 / 1000;
$n = \ln 4 / \ln(IC_{80}/IC_{50})$. Source: blain2002.

Limitation: in blain2002 the in vitro curve underestimated ex vivo COX-2
inhibition after oral dosing.

### 2.2 Analgesia (effect compartment)

$$
\frac{dC_e}{dt} = k_{e0}\,(C_p - C_e),\qquad k_{e0} = \frac{\ln 2}{1.04\ \text{h}}
$$

$$
U = \frac{C_e}{C_{50}},\qquad
E(t) = E_{max}\frac{U^{h}}{1 + U^{h}},\qquad
\text{Pain}(t) = \text{Pain}_0\,(1 - E(t))
$$

$E_{max} = 0.648$, $C_{50} = 3.95$ mg/L, $h = 1.48$ (hannam2018 Table 2).

**REVIEW-LATER (analgesia-equation-form):** the source prints
$E = E_{max}\,U^{h}/(1+U)^{h}$, but its text defines $C_{50}$ as the
concentration giving 50% of $E_{max}$, which holds only for the standard
form used here. Treated as a typesetting error; see `docs/SOURCES_REVIEW.md`,
"Analgesia equation form". The source also includes a disease
(pain-resolution) term; it is omitted here. $\text{Pain}_0$ is the
user's baseline pain score (0-10). The model has no placebo or disease time
course: pain returns to baseline when the drug is gone.

### 2.3 Antipyresis (indirect response)

$$
\frac{dT}{dt} = k_{out}\,T_0\left(1 - E_{max}\frac{C_p^{\,n}}{EC_{50}^{\,n} + C_p^{\,n}}\right) - k_{out}\,T
$$

$E_{max} = 0.055$, $EC_{50} = 6.18$ mg/L, $n = 2.71$, $k_{out} = 1.17$
1/h (troconiz2000 Table V). $T$ and $T_0$ are in degrees Celsius; the
fractional $E_{max}$ is only meaningful on that scale. The page converts to
Fahrenheit for display only. $T_0$ is the user's baseline temperature
(default 38.8 C = 101.8 F). The fever itself is held constant: without
drug, $T$ stays at $T_0$.

## 3. Applicability and extrapolation labels

| output | source population | labeled "extrapolated" when |
|--------|-------------------|-----------------------------|
| plasma concentration | adults 18-49 y, 49-116 kg (morse2022); size/age scaling from pooled neonate-to-adult data (anderson2019) | weight outside 49-116 kg for adults; always note allometric scaling for children |
| COX inhibition | in vitro blood from men aged 20-27 | age < 18 |
| analgesia | children 2-12 y (>= 10 kg) after tonsillectomy, pooled with adult dental pain; no child-adult difference (hannam2018) | age < 2 or weight < 10 kg |
| antipyresis | febrile children 4-16 y, 25-70 kg, axillary temperature (troconiz2000) | age < 4, age > 16, or weight outside 25-70 kg |

Hard limits: age >= 6 months (OTC labeling). Warnings: 24 h total above
label maxima (adult OTC 1200 mg, Rx 3200 mg; pediatric 40 mg/kg/day capped
at 2400 mg); single dose above 800 mg or above 10 mg/kg in a child, where
the linear model is less reliable.

## 4. Known limitations (v1)

- Linear PK. Total concentrations rise less than dose-proportionally at high
  doses (lockwood1983, brown1998); not modeled.
- Racemic drug only. S-ibuprofen is the active enantiomer and R converts to S
  (about 63% in lee1985); not modeled separately (planned extension).
- Suspension absorption parameters come from adults and are applied to
  children.
- Typical patient only: no between-subject variability (planned extension).
- The pain and fever models describe drug effect on a constant baseline, not
  the natural course of the illness.

## 5. Planned extension: R/S enantiomer model

Separate central compartments for R- and S-ibuprofen; R-to-S inversion with
fraction $f_{inv}$ (lee1985: 63 +/- 6% of an R dose), no S-to-R inversion;
PD driven by S concentration. The code builds the state vector from a model
definition so this can be added without changing the solver. Sources beyond
lee1985 are still to be found and verified.
