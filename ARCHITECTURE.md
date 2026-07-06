# OpenApply — Architecture

## What this is

A free, fully client-side competitor to aiapply.co. No backend, no database, no accounts. Everything runs in the user's browser; AI calls go browser → provider directly with the user's own API key.

## System overview

```
Browser (React SPA)
├── localStorage  ← all persistence (settings, profile, jobs)
└── fetch() ──→ Gemini API  (generativelanguage.googleapis.com, key in query param)
        └──→ Claude API  (api.anthropic.com, anthropic-dangerous-direct-browser-access header)
```

Deploys as a static site (Vercel/Netlify/GitHub Pages). There is deliberately no server: that is the privacy story (keys and resumes never touch an intermediary) and the zero-cost story.

## Stack

- Vite 8 + React 19 + TypeScript 6 (strict)
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin — no tailwind.config file)
- `pdfjs-dist` — client-side PDF resume text extraction (worker loaded via Vite `?url` import)
- `diff` — word-level diff between master and tailored resume

## Source layout

```
src/
├── App.tsx                  # shell: tab nav, shared state, cross-screen navigation
├── types.ts                 # all shared types (Settings, Profile, Job, TailorResult, Interview*)
├── lib/
│   ├── llm.ts               # provider abstraction: generateText/generateJson for Gemini + Claude
│   ├── prompts.ts           # ALL system prompts, incl. GROUNDING_RULES (anti-hallucination)
│   ├── storage.ts           # localStorage load/save + useStored hook + uid()
│   └── pdf.ts               # PDF → text
├── components/ui.tsx        # Card, Button, Badge, Spinner, Field, input classes
└── screens/
    ├── Search.tsx           # job discovery: Remotive + Arbeitnow, local fit ranking, one-tap handoff
    ├── OneTap.tsx           # flagship: posting (pasted or from Search) → parse → save → tailor → interview prep
    ├── Profile.tsx          # master resume (source of truth for all generation)
    ├── Tailor.tsx           # resume + cover letter + ATS score + diff + PDF/DOCX export + screening-question helper
    ├── Jobs.tsx             # tracker: statuses, duplicate-URL guard, AI field auto-fill, follow-up email writer
    ├── Interview.tsx        # mock interview: questions, per-answer scoring, better answers
    └── Settings.tsx         # BYO API key, test-key button, JSON export/import
```

Additional libs: `lib/jobsApi.ts` (free no-key CORS job APIs: Remotive + Arbeitnow, plus `scoreFit` — a local, zero-cost resume↔posting overlap score used for ranking), `lib/resumeExport.ts` (PDF via ATS-safe print template + marked; DOCX via dynamically-imported `docx`).

## Data model (localStorage, prefix `openapply:`)

- `settings` — `{ provider: 'gemini'|'anthropic', apiKey, model }`
- `profile` — `{ resumeText, fullName, updatedAt }` — the master resume
- `jobs` — `Job[]`: `{ id, title, company, url, location, description, status, notes, createdAt, tailorResult?, interviewPrep? }`
  - `status`: saved → applied → interviewing → offer | rejected
  - `tailorResult`: `{ resume_markdown, cover_letter, ats: {score, matched_keywords, missing_keywords, notes}, changes_summary, generatedAt }`

## Key flows

**One-Tap pipeline** (`OneTap.tsx`): parse posting (JOB_PARSE_SYSTEM) → duplicate-URL check → save job immediately (so later failures lose nothing) → tailor + interview-prep LLM calls run in parallel via `Promise.allSettled` → results patched onto the job. Partial failure tolerated (one step can fail, the other still lands).

**Grounding** (`prompts.ts`): every generation prompt embeds GROUNDING_RULES — the model may rephrase/reorder/select from the master resume, never invent employers, titles, dates, degrees, skills, or metrics. `changes_summary` + the word-diff view exist so users can verify this.

**Automatic keyword alignment** (TAILOR_SYSTEM): every tailor run aggressively rewrites resume wording to the job description's exact ATS vocabulary (abbreviation expansion, synonym alignment, surfacing buried keywords) — but only where the resume shows real evidence of the skill; genuinely absent requirements go to `missing_keywords`, reported honestly.

**Interview prep reuse**: One-Tap stores questions on the job; `Interview.tsx` uses stored prep instead of re-calling the API.
