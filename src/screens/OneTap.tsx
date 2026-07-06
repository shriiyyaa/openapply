import { useEffect, useRef, useState } from 'react'
import type { InterviewQuestion, Job, Profile, Settings, TailorResult } from '../types'
import { uid } from '../lib/storage'
import { generateJson } from '../lib/llm'
import { INTERVIEW_QUESTIONS_SYSTEM, JOB_PARSE_SYSTEM, TAILOR_SYSTEM } from '../lib/prompts'
import { Badge, Button, Card, ErrorNote, SectionTitle, textareaCls } from '../components/ui'

type StepState = 'pending' | 'running' | 'done' | 'failed'

interface Steps {
  parse: StepState
  save: StepState
  tailor: StepState
  interview: StepState
}

const IDLE: Steps = { parse: 'pending', save: 'pending', tailor: 'pending', interview: 'pending' }

const normalizeUrl = (u: string) =>
  u.trim().toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '')

function StepRow({ label, state, detail }: { label: string; state: StepState; detail?: string }) {
  const icon =
    state === 'done' ? (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span>
    ) : state === 'running' ? (
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
    ) : state === 'failed' ? (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">✕</span>
    ) : (
      <span className="h-6 w-6 rounded-full border-2 border-dashed border-slate-200" />
    )
  return (
    <div className="flex items-center gap-3 py-2">
      {icon}
      <div>
        <p className={`text-sm font-medium ${state === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>{label}</p>
        {detail && <p className="text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  )
}

export default function OneTapScreen({
  settings,
  profile,
  jobs,
  onJobsChange,
  onOpenTailor,
  onOpenInterview,
  prefill,
  onPrefillConsumed,
}: {
  settings: Settings
  profile: Profile
  jobs: Job[]
  onJobsChange: (updater: (prev: Job[]) => Job[]) => void
  onOpenTailor: (jobId: string) => void
  onOpenInterview: (jobId: string) => void
  prefill?: { posting: string; url: string } | null
  onPrefillConsumed?: () => void
}) {
  const [postingInput, setPosting] = useState('')
  const [urlInput, setUrl] = useState('')
  const [steps, setSteps] = useState<Steps>(IDLE)
  const [error, setError] = useState('')
  const [doneJob, setDoneJob] = useState<Job | null>(null)
  const [busy, setBusy] = useState(false)

  const setStep = (key: keyof Steps, state: StepState) =>
    setSteps((s) => ({ ...s, [key]: state }))

  const prefillRan = useRef(false)
  useEffect(() => {
    if (!prefill) {
      prefillRan.current = false
      return
    }
    if (prefillRan.current) return
    prefillRan.current = true
    setPosting(prefill.posting)
    setUrl(prefill.url)
    onPrefillConsumed?.()
    void run(prefill.posting, prefill.url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill])

  const run = async (postingArg?: string, urlArg?: string) => {
    const posting = postingArg ?? postingInput
    const url = urlArg ?? urlInput
    setError('')
    setDoneJob(null)
    if (!settings.apiKey) {
      setError('Add your free API key in Settings first.')
      return
    }
    if (!profile.resumeText.trim()) {
      setError('Add your master resume in Profile first — everything is grounded in it.')
      return
    }
    if (!posting.trim()) {
      setError('Paste the job posting text first.')
      return
    }
    if (url.trim() && jobs.some((j) => j.url && normalizeUrl(j.url) === normalizeUrl(url))) {
      setError('Duplicate blocked: you already processed a job with this URL. (This guard is the point — no tool should apply twice to one posting.)')
      return
    }

    setBusy(true)
    setSteps({ parse: 'running', save: 'pending', tailor: 'pending', interview: 'pending' })
    try {
      // Step 1 — parse posting into structured fields
      const parsed = await generateJson<{ title: string; company: string; location: string }>(
        settings,
        JOB_PARSE_SYSTEM,
        posting.slice(0, 6000),
      )
      setStep('parse', 'done')

      // Step 2 — save to tracker immediately so nothing is lost if a later step fails
      setStep('save', 'running')
      const job: Job = {
        id: uid(),
        title: parsed.title || 'Untitled role',
        company: parsed.company,
        location: parsed.location,
        url: url.trim(),
        description: posting.trim(),
        status: 'saved',
        notes: '',
        createdAt: Date.now(),
      }
      onJobsChange((prev) => [job, ...prev])
      setStep('save', 'done')

      // Steps 3 + 4 — tailor documents and interview prep run in parallel
      setStep('tailor', 'running')
      setStep('interview', 'running')
      const context = `CANDIDATE NAME: ${profile.fullName || 'not given'}\n\nMASTER RESUME:\n${profile.resumeText}\n\nJOB DESCRIPTION:\n${posting}`
      const [tailorRes, prepRes] = await Promise.allSettled([
        generateJson<Omit<TailorResult, 'generatedAt'>>(settings, TAILOR_SYSTEM, context),
        generateJson<{ questions: InterviewQuestion[] }>(
          settings,
          INTERVIEW_QUESTIONS_SYSTEM,
          `ROLE: ${parsed.title} at ${parsed.company}\nJOB DESCRIPTION:\n${posting.slice(0, 4000)}\nCANDIDATE RESUME:\n${profile.resumeText.slice(0, 4000)}`,
        ),
      ])

      const patch: Partial<Job> = {}
      if (tailorRes.status === 'fulfilled') {
        patch.tailorResult = { ...tailorRes.value, generatedAt: Date.now() }
        setStep('tailor', 'done')
      } else {
        setStep('tailor', 'failed')
      }
      if (prepRes.status === 'fulfilled') {
        patch.interviewPrep = prepRes.value.questions
        setStep('interview', 'done')
      } else {
        setStep('interview', 'failed')
      }
      const finalJob = { ...job, ...patch }
      onJobsChange((prev) => prev.map((j) => (j.id === job.id ? finalJob : j)))

      if (tailorRes.status === 'rejected' && prepRes.status === 'rejected') {
        throw tailorRes.reason
      }
      setDoneJob(finalJob)
      setPosting('')
      setUrl('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pipeline failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionTitle sub="Paste a job posting, tap once. It gets parsed, saved to your tracker, your resume and cover letter get tailored with an ATS score, and your interview prep is generated — automatically, in one go. You stay in control of exactly one thing: hitting send.">
        One-Tap
      </SectionTitle>

      <Card className="space-y-4">
        <textarea
          className={textareaCls}
          rows={10}
          placeholder="Paste the full job posting here…"
          value={postingInput}
          onChange={(e) => setPosting(e.target.value)}
        />
        <input
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          placeholder="Posting URL (optional — powers the duplicate guard)"
          value={urlInput}
          onChange={(e) => setUrl(e.target.value)}
        />
        {error && <ErrorNote message={error} />}
        <Button onClick={() => run()} disabled={busy} className="w-full py-3 text-base">
          {busy ? 'Working…' : '⚡ One tap — do everything'}
        </Button>
      </Card>

      {(busy || doneJob) && (
        <Card>
          <StepRow label="Parse posting" state={steps.parse} detail="Title, company, location extracted" />
          <StepRow label="Save to tracker" state={steps.save} detail="Duplicate-checked, nothing lost if a later step fails" />
          <StepRow label="Tailor resume + cover letter" state={steps.tailor} detail="Grounded in your real experience, ATS-scored" />
          <StepRow label="Generate interview prep" state={steps.interview} detail="8 questions specific to this role" />
        </Card>
      )}

      {doneJob && (
        <Card className="space-y-3 border-emerald-200 bg-emerald-50/50">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              {doneJob.title} {doneJob.company && `@ ${doneJob.company}`}
            </h3>
            {doneJob.tailorResult && <Badge tone="green">ATS {doneJob.tailorResult.ats.score}%</Badge>}
          </div>
          {doneJob.tailorResult && <p className="text-sm text-slate-600">{doneJob.tailorResult.ats.notes}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onOpenTailor(doneJob.id)}>Review documents →</Button>
            <Button variant="secondary" onClick={() => onOpenInterview(doneJob.id)}>Practice interview →</Button>
            {doneJob.url && (
              <a
                href={doneJob.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Open posting & apply ↗
              </a>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
