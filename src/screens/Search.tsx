import { useState } from 'react'
import type { DiscoveredJob } from '../lib/jobsApi'
import { searchJobs } from '../lib/jobsApi'
import type { Job, Profile } from '../types'
import { Badge, Button, Card, ErrorNote, SectionTitle, Spinner, inputCls } from '../components/ui'

const normalizeUrl = (u: string) =>
  u.trim().toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '')

export default function SearchScreen({
  profile,
  jobs,
  onOneTap,
}: {
  profile: Profile
  jobs: Job[]
  onOneTap: (posting: string, url: string) => void
}) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [remoteOnly, setRemoteOnly] = useState(false)
  const [results, setResults] = useState<DiscoveredJob[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const savedUrls = new Set(jobs.filter((j) => j.url).map((j) => normalizeUrl(j.url)))

  const run = async () => {
    setError('')
    if (!query.trim()) {
      setError('Type what you do — e.g. "nurse", "react developer", "warehouse".')
      return
    }
    setBusy(true)
    setResults(null)
    try {
      setResults(await searchJobs(query.trim(), profile.resumeText))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.')
    } finally {
      setBusy(false)
    }
  }

  const visible = (results ?? []).filter(
    (j) =>
      (!remoteOnly || j.remote) &&
      (!location.trim() || j.location.toLowerCase().includes(location.trim().toLowerCase())),
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionTitle sub="Live jobs from free public job boards (Remotive + Arbeitnow) — searched from your browser, no key needed. Ranked by how well each posting overlaps with your actual resume, then one tap does everything else.">
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
        {busy && <Spinner label="Searching both boards…" />}
      </Card>

      {results && (
        <p className="text-sm text-slate-500">
          {visible.length} of {results.length} results{profile.resumeText.trim() ? ', best fit first' : ''}
        </p>
      )}

      <div className="space-y-3">
        {visible.map((job) => {
          const alreadySaved = savedUrls.has(normalizeUrl(job.url))
          return (
            <Card key={job.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
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
                    {job.company} · {job.location} ·{' '}
                    <span className="text-slate-400">{job.source}</span>
                  </p>
                  <button
                    className="mt-1 text-xs text-emerald-700 underline"
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
                <div className="flex shrink-0 flex-col gap-2">
                  <Button onClick={() => onOneTap(job.description, job.url)} disabled={alreadySaved}>
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
