# COBRA-WATCH Major Project Report (`RAITreport` LaTeX Template)

Drafted strictly in the official **Ramrao Adik Institute of Technology (D. Y. Patil Deemed to be University)** CE BE Major Project LaTeX template (`RAITreport.cls`). All numbers come directly from verified repository outputs (`data/censys/2026-11-26/snapshot.json`, `eval/results/`, `docs/SPEED_BENCHMARK.md`, `paper/results.md`, and verified test suites).

## How to Compile in Overleaf
1. Zip the entire `report/` folder (containing `report.tex`, `prelude.tex`, `chap1.tex`..`chap5.tex`, `san.bib`, `RAITreport.cls`, `rait-dypu-logo.png`, and `figures/*.pdf`) or upload all files preserving `figures/`.
2. Set **Compiler** to **pdfLaTeX** and **Main document** to `report.tex`.
3. Click **Recompile** (`pdflatex -> bibtex -> pdflatex -> pdflatex`).

## Remaining `[TODO]` Items Before Review 2 Freeze
- [ ] **Front matter (`report/prelude.tex` & `report/report.tex`):** Fill exact registered project title, all 4 team member full names + USNs + Roll Numbers, Supervisor full name (`Miss Gaikwad`), and Division Co-ordinator name.
- [ ] **UI Screenshots (`report/chap4.tex` + `report/figures/`):** Capture screenshots of `/`, `/research`, `/lab`, `/console`, and `/ethics` running cleanly and embed them in Chapter 4.
- [ ] **Manual Testing Matrix (`report/chap4.tex`):** Add More's manual two-laptop test checklist on `90f3265`.
- [ ] **Appendices A/B/C (`report/report.tex`):** Attach signed Weekly Progress Report pages, approved Plagiarism Report PDF, and confirmed IPR/copyright status.
- [ ] **References (`report/san.bib`):** Kavtik to verify/clean entries marked `note = {VERIFY}` against DOIs/proceedings before final export.
