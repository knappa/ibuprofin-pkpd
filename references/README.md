# Local reference PDFs

Full-text copies used to verify parameter values. Each file is named by its
citation key in `src/references.js`, which holds the full citation, DOI and
PMID.

These are publisher PDFs under copyright and are excluded from git (see
`.gitignore`). To reproduce the verification, obtain each paper through its
DOI.

| file | citation |
|------|----------|
| anderson2019.pdf | Anderson & Hannam, Paediatr Anaesth 2019 |
| brown1998.pdf | Brown, Kearns & Wilson, J Pharmacokinet Biopharm 1998 |
| davies1998.pdf | Davies, Clin Pharmacokinet 1998 |
| hannam2011.pdf | Hannam & Anderson, Paediatr Anaesth 2011 |
| hannam2018.pdf | Hannam, Anderson & Potts, Paediatr Anaesth 2018 |
| kauffman1992.pdf | Kauffman & Nelson, J Pediatr 1992 |
| kelley1992.pdf | Kelley et al., Clin Pharmacol Ther 1992 |
| li2012.pdf | Li et al., J Clin Pharmacol 2012 |
| lockwood1983.pdf | Lockwood et al., Clin Pharmacol Ther 1983 |
| nahata1991.pdf | Nahata et al., Eur J Clin Pharmacol 1991 |
| troconiz2000.pdf | Troconiz et al., Clin Pharmacokinet 2000 |

New PDFs: name them `<citationKey>.pdf` and add the entry to
`src/references.js` with `localPdf`.
