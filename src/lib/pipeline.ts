import type { InterviewQuestion, Job, Profile, Settings, TailorResult } from '../types'
import { uid } from './storage'
import { generateJson } from './llm'
import { INTERVIEW_QUESTIONS_SYSTEM, JOB_PARSE_SYSTEM, TAILOR_SYSTEM } from './prompts'

export type PipelineStep = 'parse' | 'save' | 'tailor' | 'interview'
export type StepState = 'pending' | 'running' | 'done' | 'failed'

export const normalizeUrl = (u: string) =>
  u.trim().toLowerCase().replace(/\/+$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '')

export class DuplicateJobError extends Error {
  constructor() {
    super('Already processed a job with this URL — duplicate blocked.')
  }
}

/**
 * The One-Tap engine: parse posting → dedup → save → (tailor ∥ interview prep).
 * Shared by the One-Tap screen and the bulk runner in Search.
 * The job is saved before generation so a failed step never loses the lead.
 */
export async function runOneTapPipeline(opts: {
  settings: Settings
  profile: Profile
  posting: string
  url: string
  existingJobs: Job[]
  addJob: (job: Job) => void
  patchJob: (id: string, patch: Partial<Job>) => void
  onStep?: (step: PipelineStep, state: StepState) => void
}): Promise<Job> {
  const { settings, profile, posting, url, existingJobs, addJob, patchJob } = opts
  const onStep = opts.onStep ?? (() => {})

  if (!profile.resumeText.trim()) throw new Error('Add your resume in Profile first.')
  if (!posting.trim()) throw new Error('No job posting text.')
  if (url.trim() && existingJobs.some((j) => j.url && normalizeUrl(j.url) === normalizeUrl(url))) {
    throw new DuplicateJobError()
  }

  onStep('parse', 'running')
  const parsed = await generateJson<{ title: string; company: string; location: string }>(
    settings,
    JOB_PARSE_SYSTEM,
    posting.slice(0, 6000),
  )
  onStep('parse', 'done')

  onStep('save', 'running')
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
  addJob(job)
  onStep('save', 'done')

  onStep('tailor', 'running')
  onStep('interview', 'running')
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
    onStep('tailor', 'done')
  } else {
    onStep('tailor', 'failed')
  }
  if (prepRes.status === 'fulfilled') {
    patch.interviewPrep = prepRes.value.questions
    onStep('interview', 'done')
  } else {
    onStep('interview', 'failed')
  }
  patchJob(job.id, patch)

  if (tailorRes.status === 'rejected' && prepRes.status === 'rejected') throw tailorRes.reason
  return { ...job, ...patch }
}
