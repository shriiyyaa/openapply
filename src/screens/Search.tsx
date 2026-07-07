import { useState } from 'react'
import type { DiscoveredJob } from '../lib/jobsApi'
import { searchJobs } from '../lib/jobsApi'
import { normalizeUrl, runOneTapPipeline } from '../lib/pipeline'
import { isKeyless } from '../lib/llm'
import type { Job, Profile, Settings } from '../types'
import { Badge, Button, Card, ErrorNote, SectionTitle, Spinner, inputCls } from '../components/ui'

const BULK_LIMIT = 10

type BulkState = 'queued' | 'running' | 'done' | 'failed'

export default function SearchScreen({
  settings,
  profile,
  jobs,
  onJobsChange,
  onOneTap,
}: {
  settings: Settings
  profile: Profile
  jobs: Job[]
  onJobsChange: (updater: (prev: Job[]) => Job[]) => void
  onOneTap: (posting: string, url: string) => void
}) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [results, setResults] = useState<DiscoveredJob[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [bulk, setBulk] = useState<Record<string, BulkState> | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const savedUrls = new Set(jobs.filter((j) => j.url).map((j) => normalizeUrl(j.url)))

  const run = async () => {
    setError('')
    if (!query.trim()) {
      setError('Type what you do — e.g. "nurse", "react developer", "warehouse".')
      return
    }
    setBusy(true)
    setResults(null)
    setSelected([])
    setBulk(null)
    try {
      setResults(await searchJobs(query.trim(), profile.resumeText))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      setBusy(false)
    }
  }

  const toggleSelect = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length >= BULK_LIMIT ? s : [...s, id],
    )

  const runBulk = async () => {
    if (!profile.resumeText.trim()) {
      setError('Add your resume in Profile first.')
      return
    }
    if (!isKeyless(settings.provider) && !settings.apiKey) {
      setError('Add your API key in Settings first (or switch to the free no-key option).')
      return
    }
    const picked = (results ?? []).filter((r) => selected.includes(r.id))
    setBulkBusy(true)
    setError('')
    setBulk(Object.fromEntries(picked.map((p) => [p.id, 'queued' as BulkState])))
    // Sequential on purpose: free-tier AI rate limits, and jobs land in the
    // tracker one by one so a mid-run failure loses nothing.
    let current: Job[] = jobs
    for (const job of picked) {
      setBulk((b) => ({ ...b!, [job.id]: 'running' }))
      try {
        const done = await runOneTapPipeline({
          settings,
          profile,
          posting: job.description,
          url: job.url,
          existingJobs: current,
          addJob: (j) => {
            current = [j, ...current]
            onJobsChange((prev) => [j, ...prev])
          },
          patchJob: (id, patch) => {
            current = current.map((j) => (j.id === id ? { ...j, ...patch } : j))
            onJobsChange((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
          },
        })
        void done
        setBulk((b) => ({ ...b!, [job.id]: 'done' }))
      } catch {
        setBulk((b) => ({ ...b!, [job.id]: 'failed' }))
      }
    }
    setBulkBusy(false)
    setSelected([])
  }

  const visible = (results ?? []).filter(
    (j) =>
      (!remoteOnly || j.remote) &&
      (!location.trim() || j.location.toLowerCase().includes(location.trim().toLowerCase())),
  )

  const bulkDone = bulk && Object.values(bulk).filter((s) => s === 'done').length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionTitle sub="Live jobs from five free job boards, searched from your browser. Ranked by how well each posting overlaps with your actual resume. Pick several and process them all in one go.">
        Find jobs
      </SectionTitle>

      <Card className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            className={inputCls + ' flex-[2]'}
            placeholder="Role or skill — e.g. nurse, python, customer support"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
          <input
            className={inputCls + ' flex-1'}
            placeholder="Location filter (optional)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Button onClick={run} disabled={busy}>Search</Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
          Remote only
        </label>
        {!profile.resumeText.trim() && (
          <p className="text-xs text-amber-700">
            Tip: add your resume in Profile first — results get ranked by real fit to you.
          </p>
        )}
        {error && <ErrorNote message={error} />}
        {busy && <Spinner label="Searching five boards…" />}
      </Card>

      {selected.length > 0 && (
        <div className="sticky top-2 z-10 flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-violet-900">
            {selected.length} selected {selected.length >= BULK_LIMIT && '(max)'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setSelected([])}>Clear</Button>
            <Button onClick={runBulk} disabled={bulkBusy}>
              ⚡ Process all {selected.length}
            </Button>
          </div>
        </div>
      )}

      {bulk && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Batch progress</h3>
            {bulkBusy ? (
              <Spinner label="Working through the queue…" />
            ) : (
              <Badge tone="green">{bulkDone} of {Object.keys(bulk).length} ready — see Jobs tab</Badge>
            )}
          </div>
          <div className="space-y-1">
            {Object.entries(bulk).map(([id, state]) => {
              const j = results?.find((r) => r.id === id)
              return (
                <div key={id} className="flex items-center gap-2 text-sm">
                  <span className={
                    state === 'done' ? 'text-emerald-600' : state === 'failed' ? 'text-red-500' : state === 'running' ? 'text-violet-600' : 'text-slate-400'
                  }>
                    {state === 'done' ? '✓' : state === 'failed' ? '✕' : state === 'running' ? '⟳' : '·'}
                  </span>
                  <span className="truncate text-slate-600">{j?.title} — {j?.company}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {results && (
        <p className="text-sm text-slate-500">
          {visible.length} of {results.length} results{profile.resumeText.trim() ? ', best fit first' : ''} · select up to {BULK_LIMIT} for batch processing
        </p>
      )}

      <div className="space-y-3">
        {visible.map((job) => {
          const alreadySaved = savedUrls.has(normalizeUrl(job.url))
          const isSelected = selected.includes(job.id)
          return (
            <Card key={job.id} className={isSelected ? 'ring-2 ring-violet-400' : ''}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 gap-3">
                  <input
                    type="checkbox"
                    className="mt-1.5 h-4 w-4 shrink-0 accent-violet-600"
                    checked={isSelected}
                    disabled={alreadySaved || bulkBusy}
                    onChange={() => toggleSelect(job.id)}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{job.title}</h3>
                      {typeof job.fitScore === 'number' && profile.resumeText.trim() && (
                        <Badge tone={job.fitScore >= 25 ? 'green' : job.fitScore >= 12 ? 'amber' : 'slate'}>
                          fit {job.fitScore}%
                        </Badge>
                      )}
                      {job.remote && <Badge tone="blue">remote</Badge>}
                      {alreadySaved && <Badge tone="slate">already in tracker</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {job.company} · {job.location} · <span className="text-slate-400">{job.source}</span>
                    </p>
                    <button
                      className="mt-1 text-xs text-violet-700 underline"
                      onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                    >
                      {expanded === job.id ? 'hide description' : 'show description'}
                    </button>
                    {expanded === job.id && (
                      <p className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                        {job.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <Button onClick={() => onOneTap(job.description, job.url)} disabled={alreadySaved || bulkBusy}>
                    ⚡ One-Tap
                  </Button>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Posting ↗
                  </a>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {results && visible.length === 0 && (
        <Card className="py-10 text-center text-sm text-slate-400">
          Nothing matched those filters — try a broader search term.
        </Card>
      )}
    </div>
  )
}
