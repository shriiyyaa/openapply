# Session Log

## 2026-07-07 (v2 overhaul) — user feedback: didn't like v1 on all four axes

User selected all four pain points: setup friction, plain looks, not automatic enough, weak discovery. Shipped in response:
- **Zero setup**: Puter.js keyless free AI is the default provider (DECISIONS D9); Gemini/Claude BYO keys now optional power mode; Settings shows key fields only for keyed providers; landing flow reduced to one step (resume).
- **Discovery 2→5 sources**: added The Muse (broad non-tech: healthcare/education/finance), RemoteOK, Jobicy (all keyless + CORS, curl-verified). Source attribution links in footer (RemoteOK/Jobicy API terms require it).
- **More automatic**: pipeline extracted to `lib/pipeline.ts`; Search got multi-select + "⚡ Process all N" bulk runner (sequential, cap 10, per-job progress, DECISIONS D10).
- **Visual identity**: violet/indigo gradient brand, sticky blur header with logo mark, gradient landing hero with feature trio, rounded-2xl cards with hover shadows, fadeUp animation (DECISIONS D11).
- Build green (729KB main). NOT yet browser-tested: Puter.js chat call shapes are handled defensively but unverified against the live service — first real generation in the deployed app is the test.

## 2026-07-07 (later) — End-to-end audit + v2: discovery → documents → submit-ready

- Audited v1 against "gets people employed": four structural gaps found — not deployed, no job discovery, BYO-key setup friction, markdown-only output.
- Built fixes: **Search tab** (Remotive + Arbeitnow free no-key APIs, client-side, ranked by local resume↔posting fit score, one-tap handoff that auto-runs the pipeline), **PDF export** (ATS-safe print template) + **DOCX export** (lazy-loaded docx lib), **screening-question answerer** (Tailor), **follow-up email writer** (Jobs, applied/interviewing), **test-key button**, **JSON export/import** (key excluded from backups), **onboarding checklist** replacing the setup banner. Default landing tab is now Search.
- Verified: build green (main chunk 721KB after lazy-loading docx), both job APIs live-tested with curl and response shapes match parsers.
- **GitHub: must be the `shriiyyaa` account, NEVER `shriya-ops`.** Repo-local git identity set to `shriiyyaa <shriiyyaa@users.noreply.github.com>`.
- **Shipped**: repo at https://github.com/shriiyyaa/openapply (public), GitHub Pages enabled with Actions workflow (`.github/workflows/deploy.yml`), live URL https://shriiyyaa.github.io/openapply/ — auto-deploys on every push to main. First CI run failed on `npm ci` lockfile sync (platform-conditional deps); fixed with `npm install --package-lock-only`.
- Still open: real-key E2E test of LLM calls in the deployed app.

## 2026-07-07 — Project created, v1 built end to end

- Researched aiapply.co: features, pricing model ($29/mo + hidden credit packs), and full complaint corpus (BBB F rating, Trustpilot integrity warning, hallucinated resumes, 50× duplicate applications, credits lockout, wrong-language auto-applies).
- User decisions: BYO API key model / all three feature pillars thin / web app / fully automatic one-tap flow / keyword alignment automatic-only (no manual confirm chips).
- Built entire v1: Vite + React 19 + TS + Tailwind 4, screens OneTap / Profile / Tailor / Jobs / Interview / Settings, LLM layer (Gemini + Claude browser-direct), grounding prompts, PDF upload, word-diff, duplicate guard, interview-prep reuse.
- Wrote README, ARCHITECTURE, COMMANDS, DECISIONS, REQUIREMENTS, TECH_TASKS.
- `npm run build` green; production build served and smoke-tested on :4173.
- NOT yet done: git init, real-key end-to-end test of the LLM calls (needs user's Gemini key), deploy.
