# OpenApply — Commands

All commands run from `c:\Users\nayya\aiapply`.

## Development

```bash
npm install          # once, or after dependency changes
npm run dev          # dev server → http://localhost:5173
```

## Verify

```bash
npm run build        # tsc -b (typecheck) + vite production build → dist/
npm run lint         # oxlint
npx vite preview     # serve the production build → http://localhost:4173
```

## Deploy (static hosting — no server exists)

`dist/` is the whole app. Any static host works:

```bash
npm run build
# then e.g.:
npx vercel deploy dist --prod        # Vercel
npx netlify deploy --dir=dist --prod # Netlify
```

## Testing the AI features locally

Requires a real key: paste a free Gemini key (aistudio.google.com/apikey) into the app's Settings tab. There are no mocked LLM responses — the app is a thin client over the provider APIs.
