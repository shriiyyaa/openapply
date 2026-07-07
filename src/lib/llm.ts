import type { Settings } from '../types'

export const DEFAULT_MODELS: Record<Settings['provider'], string> = {
  puter: '',
  gemini: 'gemini-2.5-flash',
  anthropic: 'claude-sonnet-5',
}

export class LlmError extends Error {}

/** True when this provider works without the user supplying an API key. */
export function isKeyless(provider: Settings['provider']): boolean {
  return provider === 'puter'
}

// ---------------------------------------------------------------------------
// Puter.js — free, keyless AI. The script is loaded on first use; the user
// signs into a free Puter account in a popup the first time they generate.
// Their "user pays" model gives each signed-in user a free allowance, which
// is what makes true zero-setup possible for a static app with no backend.
// ---------------------------------------------------------------------------

interface PuterAi {
  ai: { chat: (messages: { role: string; content: string }[], opts?: { model?: string }) => Promise<unknown> }
}

let puterLoading: Promise<PuterAi> | null = null

function ensurePuter(): Promise<PuterAi> {
  const existing = (window as unknown as { puter?: PuterAi }).puter
  if (existing) return Promise.resolve(existing)
  if (!puterLoading) {
    puterLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://js.puter.com/v2/'
      script.onload = () => {
        const p = (window as unknown as { puter?: PuterAi }).puter
        if (p) resolve(p)
        else reject(new LlmError('Puter.js loaded but did not initialize.'))
      }
      script.onerror = () => {
        puterLoading = null
        reject(new LlmError('Could not load the free AI service — check your connection, or set your own key in Settings.'))
      }
      document.head.appendChild(script)
    })
  }
  return puterLoading
}

/** Puter responses vary by underlying model — dig the text out of the known shapes. */
function extractPuterText(resp: unknown): string {
  if (typeof resp === 'string') return resp
  const r = resp as { message?: { content?: unknown }; text?: string; toString?: () => string }
  if (typeof r?.text === 'string') return r.text
  const content = r?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((b: { text?: string }) => b?.text ?? '')
      .join('')
  }
  return ''
}

async function callPuter(settings: Settings, system: string, user: string): Promise<string> {
  const puter = await ensurePuter()
  const opts = settings.model ? { model: settings.model } : undefined
  let resp: unknown
  try {
    resp = await puter.ai.chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      opts,
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new LlmError(`Free AI service error: ${msg.slice(0, 300)}`)
  }
  const text = extractPuterText(resp)
  if (!text) throw new LlmError('The free AI service returned an empty response — try again.')
  return text
}

/** fetch with a hard deadline — a hung provider should fail loudly, not spin forever. */
function fetchWithTimeout(url: string, init: RequestInit, ms = 90_000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...init, signal: ctrl.signal })
    .catch((e) => {
      if (ctrl.signal.aborted) throw new LlmError('The AI request timed out (90s) — try again.')
      throw e
    })
    .finally(() => clearTimeout(timer))
}

async function callGemini(settings: Settings, system: string, user: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${encodeURIComponent(settings.apiKey)}`
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new LlmError(`Gemini API error ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('')
  if (!text) throw new LlmError('Gemini returned an empty response.')
  return text
}

async function callAnthropic(settings: Settings, system: string, user: string): Promise<string> {
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new LlmError(`Claude API error ${res.status}: ${body.slice(0, 300)}`)
  }
  const data = await res.json()
  const text = (data?.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('')
  if (!text) throw new LlmError('Claude returned an empty response.')
  return text
}

export function generateText(settings: Settings, system: string, user: string): Promise<string> {
  if (settings.provider === 'puter') return callPuter(settings, system, user)
  if (!settings.apiKey) throw new LlmError('No API key set. Add one in Settings.')
  return settings.provider === 'gemini'
    ? callGemini(settings, system, user)
    : callAnthropic(settings, system, user)
}

function tryParseJson<T>(raw: string): T | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Fall back to the outermost JSON object/array in the response.
    const match = cleaned.match(/[[{][\s\S]*[\]}]/)
    if (match) {
      try {
        return JSON.parse(match[0]) as T
      } catch {
        return null
      }
    }
    return null
  }
}

/**
 * Ask for JSON and parse it, tolerating markdown fences and stray prose.
 * A malformed response gets one automatic retry with a firmer instruction
 * before the user ever sees an error.
 */
export async function generateJson<T>(settings: Settings, system: string, user: string): Promise<T> {
  const sys = system + '\n\nRespond with ONLY valid JSON. No markdown fences, no commentary.'
  const first = await generateText(settings, sys, user)
  const parsed = tryParseJson<T>(first)
  if (parsed !== null) return parsed

  const retry = await generateText(
    settings,
    sys + '\n\nCRITICAL: your previous attempt was not valid JSON. Output raw JSON only, starting with { or [.',
    user,
  )
  const reparsed = tryParseJson<T>(retry)
  if (reparsed !== null) return reparsed
  throw new LlmError('The model did not return valid JSON after a retry. Try again.')
}
