/**
 * Job discovery over free, no-key, CORS-friendly job APIs, fetched client-side —
 * no backend, no API key, nothing to pay for:
 *   Remotive (remote, global) · Arbeitnow (Europe, visa flags) · The Muse (broad,
 *   strong non-tech coverage: healthcare, education, finance) · RemoteOK (remote
 *   tech) · Jobicy (remote, multi-industry).
 */

export interface DiscoveredJob {
  id: string
  source: 'remotive' | 'arbeitnow' | 'themuse' | 'remoteok' | 'jobicy'
  title: string
  company: string
  location: string
  remote: boolean
  url: string
  description: string
  postedAt: number
  fitScore?: number
}

const matchesQuery = (q: string) => (j: DiscoveredJob) =>
  !q || j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q)

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s{2,}/g, ' ').trim()
}

async function searchRemotive(query: string): Promise<DiscoveredJob[]> {
  const res = await fetch(
    `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=50`,
  )
  if (!res.ok) throw new Error(`Remotive ${res.status}`)
  const data = await res.json()
  return (data.jobs ?? []).map(
    (j: {
      id: number
      title: string
      company_name: string
      candidate_required_location: string
      url: string
      description: string
      publication_date: string
    }) => ({
      id: `remotive-${j.id}`,
      source: 'remotive' as const,
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || 'Remote',
      remote: true,
      url: j.url,
      description: htmlToText(j.description).slice(0, 6000),
      postedAt: Date.parse(j.publication_date) || 0,
    }),
  )
}

async function searchArbeitnow(query: string): Promise<DiscoveredJob[]> {
  const res = await fetch('https://www.arbeitnow.com/api/job-board-api')
  if (!res.ok) throw new Error(`Arbeitnow ${res.status}`)
  const data = await res.json()
  const q = query.toLowerCase()
  return (data.data ?? [])
    .map(
      (j: {
        slug: string
        title: string
        company_name: string
        location: string
        remote: boolean
        url: string
        description: string
        created_at: number
        tags: string[]
      }) => ({
        id: `arbeitnow-${j.slug}`,
        source: 'arbeitnow' as const,
        title: j.title,
        company: j.company_name,
        location: j.location || '—',
        remote: j.remote,
        url: j.url,
        description: htmlToText(j.description).slice(0, 6000),
        postedAt: (j.created_at ?? 0) * 1000,
      }),
    )
    .filter(matchesQuery(q))
}

async function searchTheMuse(query: string): Promise<DiscoveredJob[]> {
  // The Muse has no keyword param on the public API — pull 3 pages and filter locally.
  // Its strength is breadth: healthcare, education, finance, government, not just tech.
  const pages = await Promise.allSettled(
    [1, 2, 3].map((p) => fetch(`https://www.themuse.com/api/public/jobs?page=${p}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Muse ${r.status}`))))),
  )
  const q = query.toLowerCase()
  return pages
    .flatMap((r) => (r.status === 'fulfilled' ? (r.value.results ?? []) : []))
    .map(
      (j: {
        id: number
        name: string
        company: { name: string }
        locations: { name: string }[]
        contents: string
        publication_date: string
        refs: { landing_page: string }
      }) => ({
        id: `themuse-${j.id}`,
        source: 'themuse' as const,
        title: j.name,
        company: j.company?.name ?? '',
        location: j.locations?.map((l) => l.name).join('; ') || '—',
        remote: (j.locations ?? []).some((l) => /remote|flexible/i.test(l.name)),
        url: j.refs?.landing_page ?? '',
        description: htmlToText(j.contents ?? '').slice(0, 6000),
        postedAt: Date.parse(j.publication_date) || 0,
      }),
    )
    .filter(matchesQuery(q))
}

async function searchRemoteOk(query: string): Promise<DiscoveredJob[]> {
  const res = await fetch('https://remoteok.com/api')
  if (!res.ok) throw new Error(`RemoteOK ${res.status}`)
  const data = await res.json()
  const q = query.toLowerCase()
  return (Array.isArray(data) ? data : [])
    .filter((j: { id?: string; position?: string }) => j.id && j.position) // first element is a legal notice
    .map(
      (j: {
        id: string
        position: string
        company: string
        location: string
        url: string
        description: string
        date: string
      }) => ({
        id: `remoteok-${j.id}`,
        source: 'remoteok' as const,
        title: j.position,
        company: j.company ?? '',
        location: j.location || 'Remote',
        remote: true,
        url: j.url ?? '',
        description: htmlToText(j.description ?? '').slice(0, 6000),
        postedAt: Date.parse(j.date) || 0,
      }),
    )
    .filter(matchesQuery(q))
}

async function searchJobicy(query: string): Promise<DiscoveredJob[]> {
  const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=50')
  if (!res.ok) throw new Error(`Jobicy ${res.status}`)
  const data = await res.json()
  const q = query.toLowerCase()
  return (data.jobs ?? [])
    .map(
      (j: {
        id: number
        jobTitle: string
        companyName: string
        jobGeo: string
        url: string
        jobDescription: string
        pubDate: string
      }) => ({
        id: `jobicy-${j.id}`,
        source: 'jobicy' as const,
        title: j.jobTitle,
        company: j.companyName ?? '',
        location: j.jobGeo || 'Remote',
        remote: true,
        url: j.url ?? '',
        description: htmlToText(j.jobDescription ?? '').slice(0, 6000),
        postedAt: Date.parse(j.pubDate) || 0,
      }),
    )
    .filter(matchesQuery(q))
}

const STOPWORDS = new Set(
  'the a an and or of to in for with on at by from as is are was were be been being this that these those you your we our their it its will can may'.split(' '),
)

/** Cheap local fit score: overlap between the user's resume vocabulary and the posting. No API cost. */
export function scoreFit(resumeText: string, job: DiscoveredJob): number {
  if (!resumeText.trim()) return 0
  const resumeWords = new Set(
    resumeText
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )
  const jobWords = (job.title + ' ' + job.description)
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  if (jobWords.length === 0) return 0
  const uniqueJobWords = [...new Set(jobWords)]
  const hits = uniqueJobWords.filter((w) => resumeWords.has(w)).length
  return Math.round((hits / uniqueJobWords.length) * 100)
}

export async function searchJobs(query: string, resumeText: string): Promise<DiscoveredJob[]> {
  const results = await Promise.allSettled([
    searchRemotive(query),
    searchArbeitnow(query),
    searchTheMuse(query),
    searchRemoteOk(query),
    searchJobicy(query),
  ])
  const jobs = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  if (jobs.length === 0 && results.every((r) => r.status === 'rejected')) {
    throw new Error('All job sources are unreachable right now — try again in a minute.')
  }
  for (const j of jobs) j.fitScore = scoreFit(resumeText, j)
  return jobs.sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0) || b.postedAt - a.postedAt)
}
