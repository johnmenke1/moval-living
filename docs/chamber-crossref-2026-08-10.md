# Chamber × DB Cross-Reference — 2026-08-10

Source: `doc_d8c156427d7b_CustomMemberReport_1843_Listing.csv` (216 chamber members)
Target: `moval.living` Business table (687 approved businesses)

## Summary

| Outcome | Count |
|---|---|
| Total chamber rows | 216 |
| Matched to DB | 206 |
| EXACT_EMAIL_MATCH | 5 |
| EMAIL_MISMATCH (review needed) | 5 |
| ONLY_CHAMBER_HAS_EMAIL (backfill candidates) | 150 |
| ONLY_DB_HAS_EMAIL | 0 |
| BOTH_NO_EMAIL | 46 |
| NOT_IN_DB (directory gaps) | 10 |

## 🚨 EMAIL_MISMATCHES (5) — needs human review

- **Moreno Valley Unified School District** — chamber: `dhellerstedt@mvusd.net` | db: `klewis@mvusd.net` (matched by name)
- **Provident Bank** — chamber: `kleal@myprovident.com` | db: `info@myprovident.com` (matched by name)
- **Moreno Valley Animal Hospital** — chamber: `dogdrb@msn.com` | db: `mvanimalhosp@gmail.com` (matched by name)
- **Country Kitchen** — chamber: `CountryKitchenmv@gmail.com` | db: `kristiinefinley@gmail.com/contact/` (matched by name)
- **Dough Bowl Pizza** — chamber: `Imran.Shaikh2703@gmail.com` | db: `kbpizza007@gmail.com` (matched by name)

## 📥 NOT_IN_DB (10) — directory gaps

- **Sunnymead Ranch PCA** — (951) 924-2249 | `dpitchers@actionlife.com`
- **Walgreens Distribution Center** — (951) 601-3000 | `laura.brown@walgreens.com`
- **Stewart, Richard** — (no phone) | `richstew27@gmail.com`
- **Baker, James** — (714) 420-6644 | `jcbaker2@earthlink.net`
- **Proctor and Gamble - West Coast Mixing Center** — (951) 601-4100 | `marroguin.e.1@pg.com`
- **Portillo's** — (no phone) | `esaltsman@portillos.com`
- **U. S. Army Recruiting Company Temecula** — (951) 694-4102 | `christopher.j.dalfonso2.mil@army.mil`
- **Dr. Martinrex Kedziora** — (951) 768-8686 | `(no email)`
- ** Sisters Esquivel Foundation** — (951) 481-1710 | `info@sistersesquivelfoundation.org`
- **San Bernardino Community College District** — (951) 594-2998 | `fatimanawaz1223@gmail.com`

Full per-row CSV: `chamber-crossref-2026-08-10.csv`
