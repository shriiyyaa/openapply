# Session Log

## 2026-07-07 (later) — End-to-end audit + v2: discovery → documents → submit-ready

- Audited v1 against "gets people employed": four structural gaps found — not deployed, no job discovery, BYO-key setup friction, markdown-only output.
- Built fixes: **Search tab** (Remotive + Arbeitnow free no-key APIs, client-side, ranked by local resume↔posting fit score, one-tap handoff that auto-runs the pipeline), **PDF export** (ATS-safe print template) + **DOCX export** (lazy-loaded docx lib), **screening-question answerer** (Tailor), **follow-up email writer** (Jobs, applied/interviewing), **test-key button**, **JSON export/import** (key excluded from backups), **onboarding checklist** replacing the setup banner. Default landing tab is now Search.
- Verified: build green (main chunk 721KB after lazy-loading docx), both job APIs live-tested with curl and response shapes match parsers.
- **GitHub: deferred by user** — must go on the `shriiyyaa` account, NOT the logged-in `shriya-ops` account. Blocked on user running `gh auth login` for shriiyyaa. Local git only for now.
- Still open: real-key E2E test of LLM calls, deploy after GitHub decision.

## 2026-07-07 — Project created, v1 built end to end

- Researched aiapply.co: features, pricing model ($29/mo + hidden credit packs), and full complaint corpus (BBB F rating, Trustpilot integrity warning, hallucinated resumes, 50× duplicate applications, credits lockout, wrong-language auto-applies).
- User decisions: BYO API key model / all three feature pillars thin / web app / fully automatic one-tap flow / keyword alignment automatic-only (no manual confirm chips).
- Built entire v1: Vite + React 19 + TS + Tailwind 4, screens OneTap / Profile / Tailor / Jobs / Interview / Settings, LLM layer (Gemini + Claude browser-direct), grounding prompts, PDF upload, word-diff, duplicate guard, interview-prep reuse.
- Wrote README, ARCHITECTURE, COMMANDS, DECISIONS, REQUIREMENTS, TECH_TASKS.
- `npm run build` green; production build served and smoke-tested on :4173.
- NOT yet done: git init, real-key end-to-end test of the LLM calls (needs user's Gemini key), deploy.
