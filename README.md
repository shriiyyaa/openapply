# OpenApply

A free, private, honest job-search copilot — built as the answer to everything users hate about paid tools like AIApply.

## Why it exists

Paid job-application tools charge $29/mo plus hidden credit packs, hallucinate experience onto resumes, spam applications that ignore user preferences, and lock users' prepaid credits. OpenApply inverts every one of those:

| Their problem | OpenApply's answer |
|---|---|
| $29/mo + hidden credits that expire | 100% free — bring your own AI key (Gemini has a free tier) |
| Data harvested on their servers | Fully client-side: resume, jobs, key all live in your browser's localStorage only |
| AI invents experience | Hard grounding rules — the model may rephrase and reorder, never fabricate; plus a "What changed" diff so you can verify |
| Blind auto-apply spam (50× to one posting) | You review and send every application; duplicate-URL guard in the tracker |
| Fake ATS scores to upsell | Honest match score that tells you when fit is genuinely weak |
| Live-interview answer whispering | Mock interview practice with real feedback — prep, not cheating |

## Features

- **Master resume profile** — paste or upload PDF; the single source of truth for all generation
- **Tailor** — per-job resume + cover letter, ATS keyword match score, missing-requirements honesty, word-level diff
- **Jobs** — application tracker (saved → applied → interviewing → offer/rejected), AI auto-fill from pasted postings, duplicate blocking
- **Interview** — role-specific mock interviews (works for any field, not just tech), per-answer scoring, improved-answer suggestions

## Run it

```bash
npm install
npm run dev
```

Then open the app, go to **Settings**, and paste a free Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (or an Anthropic key).

## Stack

Vite + React 19 + TypeScript + Tailwind CSS 4. No backend — deploys as a static site anywhere (Vercel/Netlify/GitHub Pages) for free. AI calls go browser → provider directly; keys and data never touch any intermediary server.

## Build

```bash
npm run build   # typecheck + production bundle in dist/
```
