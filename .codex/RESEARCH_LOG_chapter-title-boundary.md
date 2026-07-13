# Research Log: Chapter Title Header Boundary

| Claim | Source | Locator | Corroboration | Confidence |
| --- | --- | --- | --- | --- |
| Odd-page running headers are converted by `stripChapterFurniture`. | `data/lib/egw-pdf-importer.ts` | `stripChapterFurniture` replacements | `data/lib/egw-pdf-importer.test.ts` has odd-page header conversion coverage. | VERIFIED |
| The current odd-page chapter-title regex has no leading boundary before the title. | `data/lib/egw-pdf-importer.ts` | replacement using `escTitle` | Direct source inspection plus reported line. | VERIFIED |
| Prior EGW cleanup work warns against broad chapter-title stripping. | `C:\Users\fanel\.codex\memories\MEMORY.md` | `rg` result line 1518 | Current tests cover not deleting ordinary title text. | SINGLE-SOURCE |

