# Growth chart data

Used only to suggest a default body weight (the 50th percentile, column `M`
or `P50`) when the user enters age and sex. The user can always override it.
The PK/PD model itself uses only the weight the user confirms.

| file | source | ages | sex coding |
|------|--------|------|------------|
| `who-weight-for-age-0-24mo-boys.csv`  | WHO Child Growth Standards, distributed by CDC NCHS | 0-24 months | boys |
| `who-weight-for-age-0-24mo-girls.csv` | WHO Child Growth Standards, distributed by CDC NCHS | 0-24 months | girls |
| `cdc-weight-for-age-2-20y.csv`        | CDC 2000 growth charts (`wtage.csv`)                 | 24-240 months | `Sex`: 1 = male, 2 = female |

CDC recommends the WHO standards for children under 2 years and the CDC
charts from 2 years on.

## Provenance

- WHO files: downloaded from
  `https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/`
  (`WHO-Boys-Weight-for-age-Percentiles.csv`,
  `WHO-Girls-Weight-for-age%20Percentiles.csv`). The only change was
  removing the UTF-8 byte-order mark and CR line endings.
- CDC file: `https://www.cdc.gov/growthcharts/data/zscore/wtage.csv`.
  cdc.gov refuses scripted downloads, so the file was retrieved from
  Internet Archive snapshots of that exact URL. The 2019 and 2021 snapshots
  are byte-identical. Unmodified.

SHA-256:

```
3406c9d125bcb69c062a9e84eb8c0209bfe9346542bdc1d308643750dcc241b7  cdc-weight-for-age-2-20y.csv
bbad4fd3d05b8a592bc96e72e2736517993f056eb193ca7f282d113e62d8679e  who-weight-for-age-0-24mo-boys.csv
a3e85cab8f148dcc3c58186bd5ed7d86e0f569b6f87fe682411fd66d006e71aa  who-weight-for-age-0-24mo-girls.csv
```

Licensing: the CDC file is a US government work. The WHO standards carry
WHO's own terms of use; confirm redistribution terms before public
deployment (open item in `docs/SOURCES_REVIEW.md`).
