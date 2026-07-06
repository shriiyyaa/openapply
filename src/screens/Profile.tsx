import { useRef, useState } from 'react'
import type { Profile } from '../types'
import { extractPdfText } from '../lib/pdf'
import { Badge, Button, Card, ErrorNote, Field, SectionTitle, Spinner, inputCls, textareaCls } from '../components/ui'

export default function ProfileScreen({
  profile,
  onChange,
}: {
  profile: Profile
  onChange: (p: Profile) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    </div>
  )
}
