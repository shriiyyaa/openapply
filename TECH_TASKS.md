# OpenApply — Tech Tasks

## Next up

- [ ] GitHub repo on the **shriiyyaa** account (NOT shriya-ops) — blocked on `gh auth login` for that account; then push + deploy (GitHub Pages or Vercel/Netlify free)
- [ ] Real-key end-to-end test of all LLM flows (needs user's free Gemini key)
- [ ] More job sources: Adzuna + Jooble (free keys, user-supplied like the AI key), USAJobs; a free Cloudflare Worker relay for sources that block browser CORS

## Backlog

- [ ] Browser extension: detect job posting on the active page → send to One-Tap → prefill application forms for one-click human submit (the sanctioned "auto-apply" — see DECISIONS D4)
- [ ] Job URL fetch: paste a URL and fetch the posting text automatically (CORS — extension or Worker relay solves this)
- [ ] Multiple master-resume profiles (e.g. one per career track)
- [ ] Resume translation (50+ languages — parity with AIApply's translator, trivially a prompt)
- [ ] Voice input for mock interview answers (Web Speech API, keep text fallback)
- [ ] Salary negotiation script generator (offer stage)
- [ ] Dark mode
- [ ] Code-split pdfjs (1.2MB worker) — only load on first PDF upload

## Done (2026-07-07)

- [x] PDF export (print template) + DOCX export (lazy-loaded docx)
- [x] JSON export/import of all data (API key excluded from backups)
- [x] Job discovery: Remotive + Arbeitnow, local fit ranking, one-tap handoff
- [x] Screening-question answerer + follow-up email generator
- [x] Test-key button + onboarding checklist

## Known gaps / debt

- No tests yet — LLM-response parsing (`generateJson`) and the dedup normalizer are the units worth covering first
- `useStored` writes on every keystroke of the resume textarea — debounce if it ever feels laggy
- Gemini key travels as a query param (their documented pattern, but consider `x-goog-api-key` header instead)
- Main JS bundle 657KB (pdfjs dominates) — fine for now, see code-split task
