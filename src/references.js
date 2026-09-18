// Bibliography for every source cited by the model, parameter table, and
// validation data. Keys are referenced from `parameters.js` and
// `validation-data.js`.
//
// `access` records how the cited content was read during verification:
//   "full-text"  - full article read (open access, or a local copy)
//   "abstract"   - only the PubMed abstract was read; values cited from
//                  such sources come from the abstract text
//   "label"      - FDA drug label (DailyMed / openFDA)
//   "dataset"    - published data file
//
// `localPdf` points to a local copy used for verification. These copies are
// not committed (see .gitignore): most are publisher PDFs under copyright.

export const REFERENCES = {
  morse2022: {
    authors: "Morse JD, Stanescu I, Atkinson HC, Anderson BJ",
    title:
      "Population Pharmacokinetic Modelling of Acetaminophen and Ibuprofen: " +
      "the Influence of Body Composition, Formulation and Feeding in Healthy " +
      "Adult Volunteers",
    journal: "Eur J Drug Metab Pharmacokinet",
    year: 2022,
    volume: "47(4)",
    pages: "497-507",
    doi: "10.1007/s13318-022-00766-9",
    pmid: "35366213",
    pmcid: "PMC9232434",
    access: "full-text",
  },

  anderson2019: {
    authors: "Anderson BJ, Hannam JA",
    title: "A target concentration strategy to determine ibuprofen dosing in children",
    journal: "Paediatr Anaesth",
    year: 2019,
    volume: "29(11)",
    pages: "1107-1113",
    doi: "10.1111/pan.13731",
    pmid: "31472084",
    access: "full-text",
    localPdf: "references/anderson2019.pdf",
  },

  hannam2018: {
    authors: "Hannam JA, Anderson BJ, Potts A",
    title: "Acetaminophen, ibuprofen, and tramadol analgesic interactions after adenotonsillectomy",
    journal: "Paediatr Anaesth",
    year: 2018,
    volume: "28(10)",
    pages: "841-851",
    doi: "10.1111/pan.13464",
    pmid: "30117229",
    access: "full-text",
    localPdf: "references/hannam2018.pdf",
  },

  hannam2011: {
    authors: "Hannam J, Anderson BJ",
    title: "Explaining the acetaminophen-ibuprofen analgesic interaction using a response surface model",
    journal: "Paediatr Anaesth",
    year: 2011,
    volume: "21(12)",
    pages: "1234-1240",
    doi: "10.1111/j.1460-9592.2011.03644.x",
    pmid: "21722228",
    access: "full-text",
    localPdf: "references/hannam2011.pdf",
  },

  li2012: {
    authors: "Li H, Mandema J, Wada R, Jayawardena S, Desjardins P, Doyle G, Kellstein D",
    title: "Modeling the onset and offset of dental pain relief by ibuprofen",
    journal: "J Clin Pharmacol",
    year: 2012,
    volume: "52(1)",
    pages: "89-101",
    doi: "10.1177/0091270010389470",
    pmid: "21383341",
    access: "full-text",
    localPdf: "references/li2012.pdf",
  },

  troconiz2000: {
    authors: "Troconiz IF, Armenteros S, Planelles MV, Benitez J, Calvo R, Dominguez R",
    title:
      "Pharmacokinetic-pharmacodynamic modelling of the antipyretic effect of " +
      "two oral formulations of ibuprofen",
    journal: "Clin Pharmacokinet",
    year: 2000,
    volume: "38(6)",
    pages: "505-518",
    doi: "10.2165/00003088-200038060-00004",
    pmid: "10885587",
    access: "full-text",
    localPdf: "references/troconiz2000.pdf",
  },

  cicali2020: {
    authors: "Cicali B, Long T, Kim S, Cristofoletti R",
    title:
      "Assessing the impact of cystic fibrosis on the antipyretic response of " +
      "ibuprofen in children: Physiologically-based modeling as a candle in the dark",
    journal: "Br J Clin Pharmacol",
    year: 2020,
    volume: "86(11)",
    pages: "2247-2255",
    doi: "10.1111/bcp.14326",
    pmid: "32335930",
    pmcid: "PMC7576628",
    access: "full-text",
  },

  brown1998: {
    authors: "Brown RD, Kearns GL, Wilson JT",
    title:
      "Integrated pharmacokinetic-pharmacodynamic model for acetaminophen, " +
      "ibuprofen, and placebo antipyresis in children",
    journal: "J Pharmacokinet Biopharm",
    year: 1998,
    volume: "26(5)",
    pages: "559-579",
    doi: "10.1023/a:1023225217108",
    pmid: "10205771",
    access: "full-text",
    localPdf: "references/brown1998.pdf",
  },

  kauffman1992: {
    authors: "Kauffman RE, Nelson MV",
    title: "Effect of age on ibuprofen pharmacokinetics and antipyretic response",
    journal: "J Pediatr",
    year: 1992,
    volume: "121(6)",
    pages: "969-973",
    doi: "10.1016/s0022-3476(05)80354-3",
    pmid: "1447669",
    access: "full-text",
    localPdf: "references/kauffman1992.pdf",
  },

  nahata1991: {
    authors: "Nahata MC, Durrell DE, Powell DA, Gupta N",
    title: "Pharmacokinetics of ibuprofen in febrile children",
    journal: "Eur J Clin Pharmacol",
    year: 1991,
    volume: "40(4)",
    pages: "427-428",
    doi: "10.1007/BF00265858",
    pmid: "2050181",
    access: "full-text",
    localPdf: "references/nahata1991.pdf",
  },

  kelley1992: {
    authors: "Kelley MT, Walson PD, Edge JH, Cox S, Mortensen ME",
    title:
      "Pharmacokinetics and pharmacodynamics of ibuprofen isomers and " +
      "acetaminophen in febrile children",
    journal: "Clin Pharmacol Ther",
    year: 1992,
    volume: "52(2)",
    pages: "181-189",
    doi: "10.1038/clpt.1992.128",
    pmid: "1505153",
    access: "full-text",
    localPdf: "references/kelley1992.pdf",
  },

  blain2002: {
    authors:
      "Blain H, Boileau C, Lapicque F, Nedelec E, Loeuille D, Guillaume C, " +
      "Gaucher A, Jeandel C, Netter P, Jouzeau JY",
    title:
      "Limitation of the in vitro whole blood assay for predicting the COX " +
      "selectivity of NSAIDs in clinical use",
    journal: "Br J Clin Pharmacol",
    year: 2002,
    volume: "53(3)",
    pages: "255-265",
    doi: "10.1046/j.0306-5251.2001.01533.x",
    pmid: "11874389",
    pmcid: "PMC1874310",
    access: "full-text",
  },

  warner1999: {
    authors: "Warner TD, Giuliano F, Vojnovic I, Bukasa A, Mitchell JA, Vane JR",
    title:
      "Nonsteroid drug selectivities for cyclo-oxygenase-1 rather than " +
      "cyclo-oxygenase-2 are associated with human gastrointestinal toxicity: " +
      "a full in vitro analysis",
    journal: "Proc Natl Acad Sci U S A",
    year: 1999,
    volume: "96(13)",
    pages: "7563-7568",
    doi: "10.1073/pnas.96.13.7563",
    pmid: "10377455",
    pmcid: "PMC22126",
    access: "full-text",
  },

  lee1985: {
    authors: "Lee EJ, Williams K, Day R, Graham G, Champion D",
    title: "Stereoselective disposition of ibuprofen enantiomers in man",
    journal: "Br J Clin Pharmacol",
    year: 1985,
    volume: "19(5)",
    pages: "669-674",
    doi: "10.1111/j.1365-2125.1985.tb02694.x",
    pmid: "4005104",
    pmcid: "PMC1463853",
    access: "abstract",
  },

  lockwood1983: {
    authors: "Lockwood GF, Albert KS, Gillespie WR, Bole GG, Harkcom TM, Szpunar GJ, Wagner JG",
    title: "Pharmacokinetics of ibuprofen in man. I. Free and total area/dose relationships",
    journal: "Clin Pharmacol Ther",
    year: 1983,
    volume: "34(1)",
    pages: "97-103",
    doi: "10.1038/clpt.1983.136",
    pmid: "6861443",
    access: "full-text",
    localPdf: "references/lockwood1983.pdf",
  },

  davies1998: {
    authors: "Davies NM",
    title: "Clinical pharmacokinetics of ibuprofen. The first 30 years",
    journal: "Clin Pharmacokinet",
    year: 1998,
    volume: "34(2)",
    pages: "101-154",
    doi: "10.2165/00003088-199834020-00002",
    pmid: "9515184",
    access: "full-text",
    localPdf: "references/davies1998.pdf",
  },

  mazaleuskaya2015: {
    authors: "Mazaleuskaya LL, Theken KN, Gong L, Thorn CF, FitzGerald GA, Altman RB, Klein TE",
    title: "PharmGKB summary: ibuprofen pathways",
    journal: "Pharmacogenet Genomics",
    year: 2015,
    volume: "25(2)",
    pages: "96-106",
    doi: "10.1097/FPC.0000000000000113",
    pmid: "25502615",
    pmcid: "PMC4355401",
    access: "abstract",
  },

  pubchem3672: {
    authors: "National Center for Biotechnology Information",
    title: "PubChem Compound Summary for CID 3672, Ibuprofen",
    url: "https://pubchem.ncbi.nlm.nih.gov/compound/3672",
    year: 2026,
    access: "dataset",
  },

  labelAdvil: {
    authors: "Haleon US Holdings LLC",
    title: "Advil (ibuprofen tablets 200 mg) OTC Drug Facts label",
    url: "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=1a665e64-9f30-be37-4a83-38789f1f1e89",
    setId: "1a665e64-9f30-be37-4a83-38789f1f1e89",
    effective: "2026-03-12",
    year: 2026,
    access: "label",
  },

  labelIbuprofenTabletsRx: {
    authors: "Aurobindo Pharma Limited",
    title: "Ibuprofen Tablets USP (Rx) prescribing information",
    url: "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=00872852-680a-41b3-901b-b991b12a176d",
    setId: "00872852-680a-41b3-901b-b991b12a176d",
    effective: "2025-02-14",
    year: 2025,
    access: "label",
  },

  labelIbuprofenSuspensionRx: {
    authors: "NuCare Pharmaceuticals, Inc.",
    title: "Ibuprofen Oral Suspension (Rx) prescribing information",
    url: "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=141b7964-cce6-74e4-e063-6294a90af746",
    setId: "141b7964-cce6-74e4-e063-6294a90af746",
    effective: "2024-03-20",
    year: 2024,
    access: "label",
  },

  labelCaldolor: {
    authors: "Cumberland Pharmaceuticals Inc.",
    title: "Caldolor (ibuprofen injection) prescribing information",
    url: "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=1eaa7790-f1a1-4f51-b10a-cbbaf033f684",
    setId: "1eaa7790-f1a1-4f51-b10a-cbbaf033f684",
    effective: "2026-01-29",
    year: 2026,
    access: "label",
  },

  labelInfantsMotrin: {
    authors: "Kenvue Brands LLC",
    title: "Infants' Motrin (ibuprofen oral suspension) OTC Drug Facts label",
    url: "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=c2302bfe-b367-4867-b803-29f066a42dc7",
    setId: "c2302bfe-b367-4867-b803-29f066a42dc7",
    effective: "2026-06-30",
    year: 2026,
    access: "label",
  },

  labelChildrensMotrin: {
    authors: "Kenvue Brands LLC",
    title: "Children's Motrin (ibuprofen oral suspension) OTC Drug Facts label",
    url: "https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=152189e5-391c-42d3-a03b-c8364e2de6bf",
    setId: "152189e5-391c-42d3-a03b-c8364e2de6bf",
    effective: "2024-11-08",
    year: 2024,
    access: "label",
  },

  cdcWeightForAge: {
    authors: "CDC National Center for Health Statistics",
    title: "CDC growth charts data file: weight-for-age, 2 to 20 years (wtage.csv)",
    url: "https://www.cdc.gov/growthcharts/data/zscore/wtage.csv",
    year: 2000,
    access: "dataset",
    note:
      "cdc.gov blocks scripted download; retrieved from Internet Archive " +
      "snapshots of the same URL (2019 and 2021 snapshots are byte-identical).",
  },

  whoWeightForAge: {
    authors: "World Health Organization (distributed by CDC NCHS)",
    title: "WHO growth standards: weight-for-age percentiles, 0 to 24 months",
    url: "https://ftp.cdc.gov/pub/Health_Statistics/NCHS/growthcharts/",
    year: 2006,
    access: "dataset",
  },
};
