# OpenApply — Requirements

## Product thesis

Take every documented complaint about aiapply.co and invert it. Free forever (BYO key), private (client-side only), honest (grounded generation, real ATS scores), and controlled (nothing sent anywhere without the user's tap).

## Complaint → requirement map

| AIApply complaint (from BBB/Trustpilot/reviews) | Requirement | Status |
|---|---|---|
| $29/mo + hidden credit packs, "$2/week" billing $99 | No payments of any kind; user brings a free-tier key | ✅ v1 |
| Credits expire / get locked (233 credits lost) | No credit system exists | ✅ v1 |
| Data on their servers, account required | 100% localStorage; no accounts | ✅ v1 |
| AI invents experience on resumes | Grounding rules + changes summary + word diff | ✅ v1 |
| Resume "customization" only edits the cover letter | Real per-job resume rewrite with visible diff | ✅ v1 |
| Keyword matching weak / fake ATS claims | Automatic keyword alignment to JD vocabulary + honest score + missing-keyword honesty | ✅ v1 |
| Applies 50× to one posting | Duplicate-URL guard blocks re-processing | ✅ v1 |
| Applies against user preferences (wrong language/location/mode) | Human reviews docs and submits; nothing unattended | ✅ v1 (by design) |
| Only good for tech/marketing roles | Field-agnostic prompts (healthcare, trades, academia, government tested in prompt design) | ✅ v1 |
| Interview Buddy: transcription failures, disconnects | Text-based mock interview, no fragile live audio | ✅ v1 |
| Unresponsive support, no refunds | Nothing to refund; open source planned | ✅ by design |

## Functional requirements (v1 — all built)

1. **Settings**: provider choice (Gemini/Claude), key stored locally, model editable, free-key instructions.
2. **Profile**: master resume via paste or PDF/text upload; name; word count; single source of truth.
3. **One-Tap**: paste posting (+ optional URL) → one tap → parse fields → dedup check → save to tracker → tailored resume + cover letter + ATS report → 8 interview questions. Progress UI per step; partial failure tolerated; results actionable (review docs / practice / open posting).
4. **Tailor**: standalone per-job or ad-hoc JD; resume (markdown, copy/download), cover letter (copy/download), ATS score with matched/missing keywords and notes, changes summary, word-level diff.
5. **Jobs**: add manually or via AI parse; statuses saved/applied/interviewing/offer/rejected; filter chips; duplicate-URL block; link out to posting; jump to tailor.
6. **Interview**: from saved job (reuses One-Tap prep, no extra API cost) or any typed role; 8 questions (3 behavioral / 3 technical / 2 scenario); per-answer score 1–10, strengths, improvements, stronger rewrite; session average.

## Non-functional

- Zero server dependencies; deployable to any static host.
- Works for any industry, not just tech.
- All AI failures surface as readable errors, never silent.
- No dark patterns: no fake urgency, no hidden costs, no data collection.
