import { useRef, useState } from 'react'
import type { Profile, Settings } from '../types'
import { extractPdfText } from '../lib/pdf'
import { generateJson } from '../lib/llm'
import { RESUME_DOCTOR_SYSTEM } from '../lib/prompts'
import { Badge, Button, Card, ErrorNote, Field, SectionTitle, Spinner, inputCls, textareaCls } from '../components/ui'

interface DoctorReport {
  score: number
  issues: { severity: 'high' | 'medium' | 'low'; issue: string; fix: string }[]
  improved_resume: string
  summary: string
}

export default function ProfileScreen({
  settings,
  profile,
  onChange,
}: {
  settings: Settings
  profile: Profile
  onChange: (p: Profile) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [doctor, setDoctor] = useState<DoctorReport | null>(null)
  const [doctorBusy, setDoctorBusy] = useState(false)
  const [applied, setApplied] = useState(false)

  const runDoctor = async () => {
    if (!profile.resumeText.trim()) return
    setDoctorBusy(true)
    setDoctor(null)
    setApplied(false)
    setError('')
    try {
      const report = await generateJson<DoctorReport>(
        settings,
        RESUME_DOCTOR_SYSTEM,
        `MASTER RESUME:\n${profile.resumeText}`,
      )
      setDoctor(report)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Health check failed.')
    } finally {
      setDoctorBusy(false)
    }
  }

  const handleFile = async (file: File) => {
    setError('')
    setBusy(true)
    try {
      let text: string
      if (file.name.toLowerCase().endsWith('.pdf')) {
        text = await extractPdfText(file)
      } else {
        text = await file.text()
      }
      if (!text.trim()) throw new Error('No text found in that file.')
      onChange({ ...profile, resumeText: text, updatedAt: Date.now() })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SectionTitle sub="Your master resume is the single source of truth. Every tailored resume and cover letter is built strictly from what's here — the AI is forbidden from inventing anything that isn't.">
        Master resume
      </SectionTitle>

      {error && <ErrorNote message={error} />}

      <Card className="space-y-4">
        <Field label="Your name">
          <input
            className={inputCls}
            placeholder="Jane Doe"
            value={profile.fullName}
            onChange={(e) => onChange({ ...profile, fullName: e.target.value, updatedAt: Date.now() })}
          />
        </Field>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Resume</span>
          <div className="flex items-center gap-3">
            {busy && <Spinner label="Reading file…" />}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
              Upload PDF / text file
            </Button>
          </div>
        </div>

        <textarea
          className={textareaCls}
          rows={22}
          placeholder={'Paste your full resume here, or upload a PDF above.\n\nInclude everything — jobs, dates, education, skills, projects. The tailor step selects what is relevant per job; more detail here means better results.'}
          value={profile.resumeText}
          onChange={(e) => onChange({ ...profile, resumeText: e.target.value, updatedAt: Date.now() })}
        />

        <div className="flex items-center gap-2">
          {profile.resumeText.trim() ? (
            <Badge tone="green">{profile.resumeText.trim().split(/\s+/).length} words saved locally</Badge>
          ) : (
            <Badge tone="amber">Empty — add your resume to unlock everything else</Badge>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">🩺 Resume Doctor</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Audits your master resume like a senior reviewer: honest score, prioritized issues, and a
              fixed version — stronger verbs, impact-first bullets, metric placeholders where numbers are
              missing. Never invents facts.
            </p>
          </div>
          <Button onClick={runDoctor} disabled={doctorBusy || !profile.resumeText.trim()}>
            {doctorBusy ? 'Examining…' : doctor ? 'Re-examine' : 'Run health check'}
          </Button>
        </div>
        {doctorBusy && <Spinner label="Reading your resume like a recruiter would (15–30s)…" />}
        {doctor && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span
                className={`text-3xl font-extrabold ${doctor.score >= 70 ? 'text-emerald-600' : doctor.score >= 45 ? 'text-amber-600' : 'text-red-600'}`}
              >
                {doctor.score}
              </span>
              <p className="text-sm text-slate-600">{doctor.summary}</p>
            </div>
            <ul className="space-y-2">
              {doctor.issues.map((iss, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Badge tone={iss.severity === 'high' ? 'red' : iss.severity === 'medium' ? 'amber' : 'slate'}>
                    {iss.severity}
                  </Badge>
                  <span className="text-slate-700">
                    {iss.issue} <span className="text-slate-500">→ {iss.fix}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div>
              <h4 className="mb-1 text-sm font-semibold text-slate-900">Improved version</h4>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800">
                {doctor.improved_resume}
              </pre>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => {
                  onChange({ ...profile, resumeText: doctor.improved_resume, updatedAt: Date.now() })
                  setApplied(true)
                }}
                disabled={applied}
              >
                {applied ? '✓ Applied to master resume' : 'Use improved version'}
              </Button>
              <span className="text-xs text-slate-400">
                Search for “[add metric” afterwards and fill in your real numbers.
              </span>
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Apply Assist details (optional)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Employer portals ask the same fields every single time. Fill these once — the Tailor screen
            gives you one-click copy buttons for each while you're inside a Workday/Greenhouse form.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(
            [
              ['email', 'Email', 'you@example.com'],
              ['phone', 'Phone', '+91 …'],
              ['linkedin', 'LinkedIn URL', 'linkedin.com/in/…'],
              ['portfolio', 'Portfolio / website', 'https://…'],
              ['salaryExpectation', 'Salary expectation', 'e.g. 12 LPA / $85,000'],
              ['noticePeriod', 'Notice period / start date', 'e.g. 30 days / immediately'],
            ] as const
          ).map(([key, label, placeholder]) => (
            <Field key={key} label={label}>
              <input
                className={inputCls}
                placeholder={placeholder}
                value={profile[key] ?? ''}
                onChange={(e) => onChange({ ...profile, [key]: e.target.value, updatedAt: Date.now() })}
              />
            </Field>
          ))}
        </div>
      </Card>
    </div>
  )
}
