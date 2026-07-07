import { useState } from 'react'
import type { Job, JobStatus, Profile, Settings } from '../types'
import { uid } from '../lib/storage'
import { generateJson, generateText } from '../lib/llm'
import { FOLLOWUP_EMAIL_SYSTEM, JOB_PARSE_SYSTEM } from '../lib/prompts'
import { Badge, Button, Card, ErrorNote, Field, SectionTitle, Spinner, inputCls, textareaCls } from '../components/ui'

const STATUSES: { value: JobStatus; label: string; tone: 'slate' | 'blue' | 'amber' | 'green' | 'red' }[] = [
  { value: 'saved', label: 'Saved', tone: 'slate' },
  { value: 'applied', label: 'Applied', tone: 'blue' },
  { value: 'interviewing', label: 'Interviewing', tone: 'amber' },
  { value: 'offer', label: 'Offer 🎉', tone: 'green' },
  { value: 'rejected', label: 'Rejected', tone: 'red' },
]

const normalizeUrl = (u: string) => u.trim().toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '')

export default function JobsScreen({
  settings,
  profile,
  jobs,
  onChange,
  onTailor,
}: {
  settings: Settings
  profile: Profile
  jobs: Job[]
  onChange: (jobs: Job[]) => void
  onTailor: (jobId: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ title: '', company: '', location: '', url: '', description: '' })
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<JobStatus | 'all'>('all')
  const [email, setEmail] = useState<{ jobId: string; text: string } | null>(null)
  const [emailBusy, setEmailBusy] = useState('')

  const writeFollowUp = async (job: Job) => {
    setEmailBusy(job.id)
    setEmail(null)
    setError('')
    try {
      const text = await generateText(
        settings,
        FOLLOWUP_EMAIL_SYSTEM,
        `JOB: ${job.title} at ${job.company}\nSTATUS: ${job.status}\nJOB DESCRIPTION:\n${job.description.slice(0, 3000)}\n\nCANDIDATE RESUME:\n${profile.resumeText.slice(0, 3000)}`,
      )
      setEmail({ jobId: job.id, text: text.trim() })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not write the email.')
    } finally {
      setEmailBusy('')
    }
  }

  const parseDescription = async () => {
    if (!draft.description.trim()) return
    setParsing(true)
    setError('')
    try {
      const parsed = await generateJson<{ title: string; company: string; location: string }>(
        settings,
        JOB_PARSE_SYSTEM,
        draft.description.slice(0, 6000),
      )
      setDraft((d) => ({
        ...d,
        title: d.title || parsed.title,
        company: d.company || parsed.company,
        location: d.location || parsed.location,
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not auto-fill.')
    } finally {
      setParsing(false)
    }
  }

  const addJob = () => {
    setError('')
    if (!draft.title.trim() && !draft.description.trim()) {
      setError('Give the job at least a title or a description.')
      return
    }
    // Dedup guard — the exact failure mode competitors have (applying 50x to one posting).
    if (draft.url.trim() && jobs.some((j) => j.url && normalizeUrl(j.url) === normalizeUrl(draft.url))) {
      setError('You already saved a job with this URL — duplicate blocked.')
      return
    }
    const job: Job = {
      id: uid(),
      title: draft.title.trim(),
      company: draft.company.trim(),
      location: draft.location.trim(),
      url: draft.url.trim(),
      description: draft.description.trim(),
      status: 'saved',
      notes: '',
      createdAt: Date.now(),
    }
    onChange([job, ...jobs])
    setDraft({ title: '', company: '', location: '', url: '', description: '' })
    setAdding(false)
  }

  const update = (id: string, patch: Partial<Job>) =>
    onChange(jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)))

  const remove = (id: string) => onChange(jobs.filter((j) => j.id !== id))

  const visible = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)
  const counts = Object.fromEntries(STATUSES.map((s) => [s.value, jobs.filter((j) => j.status === s.value).length]))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <SectionTitle sub="Save jobs you actually want, tailor documents per job, and track every application. You review and send every application yourself — nothing goes out without you.">
          Job tracker
        </SectionTitle>
        <Button onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add job'}</Button>
      </div>

      {adding && (
        <Card className="space-y-4">
          <Field label="Job description (paste the full posting — auto-fills the fields below)">
            <textarea
              className={textareaCls}
              rows={6}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              onBlur={parseDescription}
              placeholder="Paste the job posting text here…"
            />
          </Field>
          {parsing && <Spinner label="Auto-filling title, company, location…" />}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Title">
              <input className={inputCls} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </Field>
            <Field label="Company">
              <input className={inputCls} value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
            </Field>
            <Field label="Location">
              <input className={inputCls} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </Field>
          </div>
          <Field label="Posting URL (used to block duplicates)">
            <input className={inputCls} value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" />
          </Field>
          {error && <ErrorNote message={error} />}
          <Button onClick={addJob}>Save job</Button>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          All ({jobs.length})
        </button>
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${filter === s.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {s.label} ({counts[s.value]})
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <Card className="py-10 text-center text-sm text-slate-400">
          {jobs.length === 0 ? 'No jobs yet — add the first one you actually want.' : 'Nothing with this status.'}
        </Card>
      )}

      <div className="space-y-3">
        {visible.map((job) => {
          const statusMeta = STATUSES.find((s) => s.value === job.status)!
          return (
            <Card key={job.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-slate-900">{job.title || 'Untitled role'}</h3>
                    <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    {job.tailorResult && <Badge tone="green">Docs ready · ATS {job.tailorResult.ats.score}%</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {[job.company, job.location].filter(Boolean).join(' · ') || '—'}
                    {job.url && (
                      <>
                        {' · '}
                        <a href={job.url} target="_blank" rel="noreferrer" className="text-violet-700 underline">
                          posting ↗
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
                    value={job.status}
                    onChange={(e) => update(job.id, { status: e.target.value as JobStatus })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={() => onTailor(job.id)}>
                    {job.tailorResult ? 'View docs' : 'Tailor docs'}
                  </Button>
                  {(job.status === 'applied' || job.status === 'interviewing') && (
                    <Button variant="secondary" onClick={() => writeFollowUp(job)} disabled={emailBusy === job.id}>
                      {emailBusy === job.id ? '…' : '✉ Follow-up'}
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => remove(job.id)}>✕</Button>
                </div>
              </div>
              {email?.jobId === job.id && (
                <div className="mt-3 space-y-2">
                  <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
                    {email.text}
                  </pre>
                  <Button variant="secondary" onClick={() => navigator.clipboard.writeText(email.text)}>
                    Copy email
                  </Button>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
