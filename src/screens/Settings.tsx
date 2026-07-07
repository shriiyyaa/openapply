import { useRef, useState } from 'react'
import type { Provider, Settings } from '../types'
import { DEFAULT_MODELS, generateText, isKeyless } from '../lib/llm'
import { Badge, Button, Card, Field, SectionTitle, Spinner, inputCls } from '../components/ui'

const PROVIDERS: { key: Provider; name: string; blurb: string }[] = [
  { key: 'puter', name: 'Free — no key', blurb: 'Zero setup. Sign into a free Puter account in a popup on first use.' },
  { key: 'gemini', name: 'Google Gemini', blurb: 'Bring your own free API key — full control of your quota.' },
  { key: 'anthropic', name: 'Anthropic Claude', blurb: 'Bring your own key — highest quality writing.' },
]

export default function SettingsScreen({
  settings,
  onChange,
}: {
  settings: Settings
  onChange: (s: Settings) => void
}) {
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  const setProvider = (provider: Provider) =>
    onChange({ ...settings, provider, model: DEFAULT_MODELS[provider] })

  const testKey = async () => {
    setTestState('testing')
    setTestMessage('')
    try {
      await generateText(settings, 'You are a connectivity test.', 'Reply with the single word OK.')
      setTestState('ok')
      setTestMessage('Key works — you are fully set up.')
    } catch (e) {
      setTestState('fail')
      setTestMessage(e instanceof Error ? e.message : 'Test failed.')
    }
  }

  const exportData = () => {
    const data: Record<string, unknown> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('openapply:')) data[key] = JSON.parse(localStorage.getItem(key)!)
    }
    // The API key stays out of exports — a shared backup file must not leak it.
    const s = data['openapply:settings'] as Record<string, unknown> | undefined
    if (s) s.apiKey = ''
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = `openapply-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Record<string, unknown>
      const keys = Object.keys(data).filter((k) => k.startsWith('openapply:'))
      if (keys.length === 0) throw new Error('Not an OpenApply backup file.')
      for (const k of keys) {
        // Keep the current key if the backup's is blank (exports strip it).
        if (k === 'openapply:settings') {
          const incoming = data[k] as Settings
          if (!incoming.apiKey) incoming.apiKey = settings.apiKey
        }
        localStorage.setItem(k, JSON.stringify(data[k]))
      }
      location.reload()
    } catch (e) {
      setTestState('fail')
      setTestMessage(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SectionTitle sub="AI runs free by default with zero setup. Power users can plug in their own Gemini or Claude key instead — keys are stored only in this browser and sent only to that provider.">
        Settings
      </SectionTitle>

      <Card className="space-y-4">
        <Field label="AI provider">
          <div className="flex flex-col gap-2 sm:flex-row">
            {PROVIDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setProvider(p.key)}
                className={`flex-1 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  settings.provider === p.key
                    ? 'border-violet-500 bg-violet-50 text-violet-950'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className="block font-semibold">
                  {p.name} {p.key === 'puter' && <span className="ml-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">DEFAULT</span>}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{p.blurb}</span>
              </button>
            ))}
          </div>
        </Field>

        {!isKeyless(settings.provider) && (
          <>
            <Field label="API key">
              <input
                type="password"
                className={inputCls}
                placeholder={settings.provider === 'gemini' ? 'AIza…' : 'sk-ant-…'}
                value={settings.apiKey}
                onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
              />
            </Field>
            <Field label="Model">
              <input
                className={inputCls}
                value={settings.model}
                onChange={(e) => onChange({ ...settings, model: e.target.value })}
              />
            </Field>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {isKeyless(settings.provider) ? (
            <Badge tone="green">No key needed — you're set</Badge>
          ) : settings.apiKey ? (
            <Badge tone="green">Key saved locally</Badge>
          ) : (
            <Badge tone="amber">No key yet</Badge>
          )}
          <Button
            variant="secondary"
            onClick={testKey}
            disabled={(!isKeyless(settings.provider) && !settings.apiKey) || testState === 'testing'}
          >
            Test connection
          </Button>
          {testState === 'testing' && <Spinner label="Testing…" />}
          {testState === 'ok' && <Badge tone="green">✓ {testMessage}</Badge>}
          {testState === 'fail' && <Badge tone="red">{testMessage.slice(0, 160)}</Badge>}
        </div>
      </Card>

      {!isKeyless(settings.provider) && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">How to get a free key</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>
              <span className="font-medium">Gemini (free):</span> go to{' '}
              <a className="text-violet-700 underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                aistudio.google.com/apikey
              </a>
              , sign in with Google, click “Create API key”.
            </li>
            <li>
              <span className="font-medium">Claude:</span> go to{' '}
              <a className="text-violet-700 underline" href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>{' '}
              → API keys.
            </li>
            <li>Paste the key above. Done — everything else in the app now works.</li>
          </ol>
        </Card>
      )}

      <Card className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Your data</h3>
        <p className="text-sm text-slate-600">
          Your resume, jobs, and interview practice live entirely in this browser (localStorage).
          Nothing is uploaded anywhere except the text sent to your chosen AI provider when you
          click a generate button. Clearing browser data erases everything — back up below before
          switching machines.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportData}>Export all data</Button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
          />
          <Button variant="secondary" onClick={() => importRef.current?.click()}>Import backup</Button>
        </div>
        <p className="text-xs text-slate-400">Backups never include your API key.</p>
      </Card>
    </div>
  )
}
