# OpenApply — Decisions

Closed decisions. Do not re-debate without new information.

## D1 — Bring-your-own API key (2026-07-07)
The product stays free by having users paste their own Gemini (free tier) or Claude key. Rejected: hosting our own key (costs scale with users, leads back to the freemium trap we're competing against) and local models (quality too low for resume writing).

## D2 — Fully client-side, no backend (2026-07-07)
Consequence of D1. All data in localStorage, AI calls browser-direct. This is a feature: privacy ("your resume never touches our servers") and zero hosting cost. Trade-off accepted: no cross-device sync (export/import can come later).

## D3 — All three feature pillars, thin versions (2026-07-07)
User decision (against depth-first recommendation): tailor engine + job tracker + interview coach all ship in v1. Mitigation: they share one LLM layer, one storage layer, one grounding prompt-set, so "thin" still means working.

## D4 — No unattended auto-submission to job boards (2026-07-07)
The "one tap" automates everything up to and including document generation and prep; the final submit stays human. Reasons: (a) LinkedIn/Indeed/Workday ban bot submissions — burned user accounts are unrecoverable harm; (b) blind submission is the root cause of AIApply's worst reviews (50× duplicate applications, wrong-language applications); (c) a static client-side app cannot drive third-party sites anyway. A browser extension that prefills forms for one-click human submit is the sanctioned future path (see TECH_TASKS).

## D5 — Hard anti-hallucination grounding (2026-07-07)
The model may rephrase, reorder, and re-emphasize the master resume; it may never invent employers, dates, degrees, skills, or metrics. Enforced in GROUNDING_RULES (prompts.ts), surfaced to the user via changes_summary + word diff. This is the core quality differentiator vs AIApply's fabricated-experience complaints.

## D6 — No live-interview answer feeding (2026-07-07)
Mock interviews with feedback: yes. Whispering answers during a real interview (AIApply's "Interview Buddy"): excluded — ethically gray and their most bug-ridden feature.

## D7 — Keyword alignment is automatic, not interactive (2026-07-07)
User decision: no manual "confirm this skill" chips. Every tailor run automatically rewrites resume wording to the JD's exact ATS vocabulary — bounded by D5: only where the resume shows real evidence; genuinely missing requirements are reported honestly in missing_keywords, never injected.

## D8 — Honest ATS score (2026-07-07)
The score reflects real fit after alignment. A low score tells the user the fit is weak — we don't inflate to flatter, because wasted applications are the user's cost, not ours.
