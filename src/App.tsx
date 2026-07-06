import { useState } from 'react'
import type { Job, Profile, Settings, TailorResult } from './types'
import { DEFAULT_MODELS } from './lib/llm'
import { useStored } from './lib/storage'
import SettingsScreen from './screens/Settings'
import ProfileScreen from './screens/Profile'
import TailorScreen from './screens/Tailor'
import JobsScreen from './screens/Jobs'
import InterviewScreen from './screens/Interview'
import OneTapScreen from './screens/OneTap'
import SearchScreen from './screens/Search'

type Tab = 'search' | 'onetap' | 'profile' | 'tailor' | 'jobs' | 'interview' | 'settings'

const TABS: { key: Tab; label: string }[] = [
  { key: 'search', label: '🔍 Find jobs' },
  { key: 'onetap', label: '⚡ One-Tap' },
  { key: 'profile', label: 'Profile' },
  { key: 'tailor', label: 'Tailor' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'interview', label: 'Interview' },
  { key: 'settings', label: 'Settings' },
]

export default function App() {
  const [settings, setSettings] = useStored<Settings>('settings', {
    provider: 'gemini',
    apiKey: '',
    model: DEFAULT_MODELS.gemini,
  })
  const [profile, setProfile] = useStored<Profile>('profile', {
    resumeText: '',
    fullName: '',
    updatedAt: 0,
  })
  const [jobs, setJobs] = useStored<Job[]>('jobs', [])
  const [tab, setTab] = useState<Tab>(() => {
    // First run: land on Settings so the key gets set; afterwards land on job discovery.
    return localStorage.getItem('openapply:settings') ? 'search' : 'settings'
  })
  const [selectedJobId, setSelectedJobId] = useState('')
  const [oneTapPrefill, setOneTapPrefill] = useState<{ posting: string; url: string } | null>(null)

  const saveTailorResult = (jobId: string, result: TailorResult) =>
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, tailorResult: result } : j)))

  const goTailor = (jobId: string) => {
    setSelectedJobId(jobId)
    setTab('tailor')
  }

  const goInterview = (jobId: string) => {
    setSelectedJobId(jobId)
    setTab('interview')
  }

  const needsSetup = !settings.apiKey || !profile.resumeText.trim()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Open<span className="text-emerald-600">Apply</span>
            </span>
            <span className="hidden text-xs text-slate-400 sm:inline">
              free · private · your data never leaves this browser
            </span>
          </div>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {needsSetup && tab !== 'settings' && tab !== 'profile' && (
        <div className="mx-auto max-w-5xl px-4 pt-8">
          <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Two steps and you're set up — free, forever</h2>
            <p className="mt-1 text-sm text-slate-500">
              No account, no payment, no trial. Your data stays in this browser.
            </p>
            <ol className="mt-4 space-y-3">
              <li className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${settings.apiKey ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {settings.apiKey ? '✓' : '1'}
                </span>
                <span className="text-sm text-slate-700">
                  Get a <span className="font-medium">free</span> Google AI key (2 minutes) and paste it in{' '}
                  <button className="font-semibold text-emerald-700 underline" onClick={() => setTab('settings')}>
                    Settings
                  </button>
                  {' — '}there's a step-by-step guide and a "Test key" button there.
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${profile.resumeText.trim() ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {profile.resumeText.trim() ? '✓' : '2'}
                </span>
                <span className="text-sm text-slate-700">
                  Upload or paste your resume once in{' '}
                  <button className="font-semibold text-emerald-700 underline" onClick={() => setTab('profile')}>
                    Profile
                  </button>
                  {' — '}every document is built from it, never invented.
                </span>
              </li>
            </ol>
            <p className="mt-4 text-xs text-slate-400">
              Then: find jobs ranked by your real fit → one tap tailors everything → you hit send.
            </p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8">
        {tab === 'search' && (
          <SearchScreen
            profile={profile}
            jobs={jobs}
            onOneTap={(posting, url) => {
              setOneTapPrefill({ posting, url })
              setTab('onetap')
            }}
          />
        )}
        {tab === 'onetap' && (
          <OneTapScreen
            settings={settings}
            profile={profile}
            jobs={jobs}
            onJobsChange={setJobs}
            onOpenTailor={goTailor}
            onOpenInterview={goInterview}
            prefill={oneTapPrefill}
            onPrefillConsumed={() => setOneTapPrefill(null)}
          />
        )}
        {tab === 'profile' && <ProfileScreen profile={profile} onChange={setProfile} />}
        {tab === 'tailor' && (
          <TailorScreen
            settings={settings}
            profile={profile}
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelectJob={setSelectedJobId}
            onSaveResult={saveTailorResult}
          />
        )}
        {tab === 'jobs' && (
          <JobsScreen settings={settings} profile={profile} jobs={jobs} onChange={setJobs} onTailor={goTailor} />
        )}
        {tab === 'interview' && (
          <InterviewScreen settings={settings} profile={profile} jobs={jobs} initialJobId={selectedJobId} />
        )}
        {tab === 'settings' && <SettingsScreen settings={settings} onChange={setSettings} />}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-8 text-center text-xs text-slate-400">
        OpenApply — every document grounded in your real experience. No credits, no subscriptions, no data collection.
      </footer>
    </div>
  )
}
