import { useState } from 'react'
import type { Job, Profile, Settings, TailorResult } from './types'
import { DEFAULT_MODELS, isKeyless } from './lib/llm'
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
    provider: 'puter',
    apiKey: '',
    model: DEFAULT_MODELS.puter,
  })
  const [profile, setProfile] = useStored<Profile>('profile', {
    resumeText: '',
    fullName: '',
    updatedAt: 0,
  })
  const [jobs, setJobs] = useStored<Job[]>('jobs', [])
  // Zero-setup: everyone lands on job discovery; the hero guides first-timers.
  const [tab, setTab] = useState<Tab>('search')
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

  const needsSetup = !profile.resumeText.trim() || (!isKeyless(settings.provider) && !settings.apiKey)

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/60 via-slate-50 to-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-base text-white shadow-sm shadow-violet-600/30">
              ⚡
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-extrabold tracking-tight">
                Open<span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">Apply</span>
              </span>
              <span className="hidden text-[11px] text-slate-400 sm:block">
                free · private · zero setup
              </span>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${
                  tab === t.key
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm shadow-violet-600/30'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {needsSetup && tab !== 'settings' && tab !== 'profile' && (
        <div className="mx-auto max-w-5xl animate-[fadeUp_.5s_ease-out] px-4 pt-10">
          <div className="overflow-hidden rounded-3xl border border-violet-200/60 bg-white shadow-[0_8px_40px_rgba(109,40,217,0.08)]">
            <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-700 px-6 py-10 text-center sm:px-10">
              <h1 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Get hired faster. Pay nothing.
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-violet-100 sm:text-base">
                Find jobs ranked by your real fit, tailor your resume and cover letter in one tap,
                and walk into interviews prepared. No subscription, no credits, no account —
                your data never leaves this browser.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-3 sm:px-10">
              {[
                ['🔍', 'Real matching', 'Five job boards searched live, ranked against your actual resume — not spray and pray.'],
                ['⚡', 'One-tap everything', 'Resume, cover letter, ATS score, and interview prep generated together. Honest: it never invents experience.'],
                ['🔒', 'Actually free & private', 'Free AI built in — no API key, no payment. Everything stays on your device.'],
              ].map(([icon, title, body]) => (
                <div key={title} className="rounded-2xl bg-slate-50 p-4">
                  <span className="text-xl">{icon}</span>
                  <h3 className="mt-2 text-sm font-bold text-slate-900">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 px-6 py-5 sm:px-10">
              <p className="text-sm text-slate-700">
                <span className="font-semibold">One step to start:</span> add your resume in{' '}
                <button
                  className="rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1 text-sm font-semibold text-white shadow-sm"
                  onClick={() => setTab('profile')}
                >
                  Profile →
                </button>{' '}
                <span className="text-slate-500">— every document is grounded in it, never fabricated.</span>
                {!isKeyless(settings.provider) && !settings.apiKey && (
                  <span className="mt-1 block text-xs text-amber-600">
                    (Your AI provider needs a key — add it in Settings, or switch back to the free no-key option.)
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-8">
        {tab === 'search' && (
          <SearchScreen
            settings={settings}
            profile={profile}
            jobs={jobs}
            onJobsChange={setJobs}
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
        <span className="mx-1">·</span>
        Job data: Remotive, Arbeitnow, <a className="underline" href="https://www.themuse.com" target="_blank" rel="noreferrer">The Muse</a>,{' '}
        <a className="underline" href="https://remoteok.com" target="_blank" rel="noreferrer">Remote OK</a>,{' '}
        <a className="underline" href="https://jobicy.com" target="_blank" rel="noreferrer">Jobicy</a>
      </footer>
    </div>
  )
}
