/**
 * Job discovery over free, no-key, CORS-friendly job APIs.
 * Remotive (remote jobs, global) + Arbeitnow (Europe-heavy, incl. visa-sponsorship flags).
 * Both are fetched client-side — no backend, no API key, nothing to pay for.
 */

export interface DiscoveredJob {
  id: string
  source: 'remotive' | 'arbeitnow'
  title: string
  company: string
  location: string
  remote: boolean
  url: string
  description: string
  postedAt: number
  fitScore?: number
}

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
    .filter(
      (j: DiscoveredJob) =>
        !q || j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q),
    )
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
  const results = await Promise.allSettled([searchRemotive(query), searchArbeitnow(query)])
  const jobs = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
  if (jobs.length === 0 && results.every((r) => r.status === 'rejected')) {
    throw new Error('Both job sources are unreachable right now — try again in a minute.')
  }
  for (const j of jobs) j.fitScore = scoreFit(resumeText, j)
  return jobs.sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0) || b.postedAt - a.postedAt)
}
