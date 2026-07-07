import { useMemo, useState } from 'react'
import { diffWords } from 'diff'
import type { Job, Profile, Settings, TailorResult } from '../types'
import { generateJson, generateText } from '../lib/llm'
import { SCREENING_ANSWER_SYSTEM, TAILOR_SYSTEM } from '../lib/prompts'
import { downloadResumeDocx, printResumePdf } from '../lib/resumeExport'
import { Badge, Button, Card, ErrorNote, Field, SectionTitle, Spinner, inputCls, textareaCls } from '../components/ui'

type TailorJson = Omit<TailorResult, 'generatedAt'>

function download(filename: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="secondary"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? 'Copied ✓' : label}
    </Button>
  )
}

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 70 ? 'bg-emerald-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-14 text-right text-lg font-bold text-slate-900">{score}%</span>
    </div>
  )
}

export default function TailorScreen({
  settings,
  profile,
  jobs,
  selectedJobId,
  onSelectJob,
  onSaveResult,
}: {
  settings: Settings
  profile: Profile
  jobs: Job[]
  selectedJobId: string
  onSelectJob: (id: string) => void
  onSaveResult: (jobId: string, result: TailorResult) => void
}) {
  const selectedJob = jobs.find((j) => j.id === selectedJobId)
  const [adhocJd, setAdhocJd] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TailorResult | null>(selectedJob?.tailorResult ?? null)
  const [tab, setTab] = useState<'resume' | 'letter' | 'diff'>('resume')
  const [question, setQuestion] = useState('')
  const [qAnswer, setQAnswer] = useState('')
  const [qBusy, setQBusy] = useState(false)

  const answerQuestion = async () => {
    if (!question.trim() || !jobDescription.trim() || !profile.resumeText.trim()) return
    setQBusy(true)
    setQAnswer('')
    setError('')
    try {
      const text = await generateText(
        settings,
        SCREENING_ANSWER_SYSTEM,
        `MASTER RESUME:\n${profile.resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}\n\nSCREENING QUESTION:\n${question}`,
      )
      setQAnswer(text.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not answer the question.')
    } finally {
      setQBusy(false)
    }
  }

  const jobDescription = selectedJob ? selectedJob.description : adhocJd

  const diffParts = useMemo(() => {
    if (!result) return []
    return diffWords(profile.resumeText, result.resume_markdown)
  }, [result, profile.resumeText])

  const generate = async () => {
    setError('')
    if (!profile.resumeText.trim()) {
      setError('Add your master resume in the Profile tab first — generation is grounded in it.')
      return
    }
    if (!jobDescription.trim()) {
      setError('Paste a job description (or pick a saved job) first.')
      return
    }
    setBusy(true)
    try {
      const json = await generateJson<TailorJson>(
        settings,
        TAILOR_SYSTEM,
        `CANDIDATE NAME: ${profile.fullName || 'not given'}\n\nMASTER RESUME:\n${profile.resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`,
      )
      const full: TailorResult = { ...json, generatedAt: Date.now() }
      setResult(full)
      setTab('resume')
      if (selectedJob) onSaveResult(selectedJob.id, full)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SectionTitle sub="Pick a saved job or paste any job description. You get an honestly tailored resume, a cover letter, an ATS match score, and a full record of what changed — so you can verify nothing was invented.">
        Tailor for a job
      </SectionTitle>

      <Card className="space-y-4">
        <Field label="Job">
          <select
            className={inputCls}
            value={selectedJobId}
            onChange={(e) => {
              onSelectJob(e.target.value)
              const j = jobs.find((x) => x.id === e.target.value)
              setResult(j?.tailorResult ?? null)
            }}
          >
            <option value="">— Paste a job description below —</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title || 'Untitled'} @ {j.company || '?'}
              </option>
            ))}
          </select>
        </Field>

        {!selectedJob && (
          <textarea
            className={textareaCls}
            rows={8}
            placeholder="Paste the full job description here…"
            value={adhocJd}
            onChange={(e) => setAdhocJd(e.target.value)}
          />
        )}
        {selectedJob && (
          <p className="max-h-32 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            {selectedJob.description.slice(0, 800) || 'This saved job has no description — edit it in the Jobs tab.'}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={generate} disabled={busy}>
            {result ? 'Regenerate' : 'Tailor resume + cover letter'}
          </Button>
          {busy && <Spinner label="Writing (10–30s)…" />}
        </div>
        {error && <ErrorNote message={error} />}
      </Card>

      {result && (
        <>
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">ATS match score</h3>
              <span className="text-xs text-slate-400">
                keywords auto-aligned to the posting's exact wording — a low score means the fit is genuinely weak
              </span>
            </div>
            <ScoreBar score={result.ats.score} />
            <p className="text-sm text-slate-600">{result.ats.notes}</p>
            <div className="flex flex-wrap gap-1.5">
              {result.ats.matched_keywords.map((k) => (
                <Badge key={k} tone="green">✓ {k}</Badge>
              ))}
              {result.ats.missing_keywords.map((k) => (
                <Badge key={k} tone="red">✗ {k}</Badge>
              ))}
            </div>
            {result.ats.missing_keywords.length > 0 && (
              <p className="text-xs text-slate-400">
                The ✗ list doubles as your fastest upskill map — a short course or certificate in one of
                these often beats 50 more applications.
              </p>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    ['resume', 'Tailored resume'],
                    ['letter', 'Cover letter'],
                    ['diff', 'What changed'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {tab === 'resume' && (
                  <>
                    <CopyButton text={result.resume_markdown} label="Copy" />
                    <Button
                      onClick={() => {
                        try {
                          printResumePdf(result.resume_markdown, profile.fullName || 'Resume')
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'PDF export failed.')
                        }
                      }}
                    >
                      PDF
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        downloadResumeDocx(
                          result.resume_markdown,
                          `${(profile.fullName || 'resume').replace(/\s+/g, '-').toLowerCase()}.docx`,
                        ).catch((e) => setError(e instanceof Error ? e.message : 'DOCX export failed.'))
                      }
                    >
                      DOCX
                    </Button>
                    <Button variant="secondary" onClick={() => download('resume.md', result.resume_markdown)}>
                      .md
                    </Button>
                  </>
                )}
                {tab === 'letter' && (
                  <>
                    <CopyButton text={result.cover_letter} label="Copy" />
                    <Button variant="secondary" onClick={() => download('cover-letter.txt', result.cover_letter)}>
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>

            {tab === 'resume' && (
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800">
                {result.resume_markdown}
              </pre>
            )}
            {tab === 'letter' && (
              <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">
                {result.cover_letter}
              </pre>
            )}
            {tab === 'diff' && (
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-900">Changes made (verify nothing was invented)</h4>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {result.changes_summary.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-900">
                    Word-level diff <span className="font-normal text-slate-400">(green = added, red = removed)</span>
                  </h4>
                  <div className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 font-mono text-xs leading-relaxed">
                    {diffParts.map((part, i) => (
                      <span
                        key={i}
                        className={
                          part.added
                            ? 'rounded bg-emerald-100 text-emerald-900'
                            : part.removed
                              ? 'rounded bg-red-100 text-red-800 line-through'
                              : 'text-slate-500'
                        }
                      >
                        {part.value}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {result && (
        <Card className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Apply Assist — for the employer's form</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Inside a Workday/Greenhouse/Naukri form? Everything they'll ask for, one click each.
              {!profile.email && !profile.phone && ' (Fill your details once in Profile to unlock more chips.)'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['Name', profile.fullName],
                ['Email', profile.email],
                ['Phone', profile.phone],
                ['LinkedIn', profile.linkedin],
                ['Portfolio', profile.portfolio],
                ['Salary', profile.salaryExpectation],
                ['Notice period', profile.noticePeriod],
                ['Cover letter', result.cover_letter],
              ] as const
            )
              .filter(([, v]) => v?.trim())
              .map(([label, value]) => (
                <CopyButton key={label} text={value!} label={`Copy ${label.toLowerCase()}`} />
              ))}
          </div>
        </Card>
      )}

      {jobDescription.trim() && (
        <Card className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Application question helper</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Most applications ask extra questions ("Why do you want to work here?"). Paste one — the
              answer is grounded in your real resume, like everything else.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="Paste the screening question…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && answerQuestion()}
            />
            <Button onClick={answerQuestion} disabled={qBusy || !question.trim()}>
              Answer
            </Button>
          </div>
          {qBusy && <Spinner label="Writing your answer…" />}
          {qAnswer && (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">
                {qAnswer}
              </p>
              <CopyButton text={qAnswer} label="Copy answer" />
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
