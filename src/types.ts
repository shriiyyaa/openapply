export type Provider = 'puter' | 'gemini' | 'anthropic'

export interface Settings {
  provider: Provider
  apiKey: string
  model: string
}

export interface Profile {
  /** The user's master resume — the single source of truth all generation is grounded in. */
  resumeText: string
  fullName: string
  updatedAt: number
}

export type JobStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected'

export interface AtsReport {
  score: number
  matched_keywords: string[]
  missing_keywords: string[]
  notes: string
}

export interface TailorResult {
  resume_markdown: string
  cover_letter: string
  ats: AtsReport
  changes_summary: string[]
  generatedAt: number
}

export interface Job {
  id: string
  title: string
  company: string
  url: string
  location: string
  description: string
  status: JobStatus
  notes: string
  createdAt: number
  tailorResult?: TailorResult
  interviewPrep?: InterviewQuestion[]
}

export interface InterviewQuestion {
  question: string
  kind: 'behavioral' | 'technical' | 'role'
}

export interface AnswerFeedback {
  score: number
  strengths: string[]
  improvements: string[]
  better_answer: string
}

export interface InterviewTurn {
  question: InterviewQuestion
  answer: string
  feedback?: AnswerFeedback
}
