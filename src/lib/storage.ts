import { useEffect, useState } from 'react'

const PREFIX = 'openapply:'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

/** useState persisted to localStorage. */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback))
  useEffect(() => {
    save(key, value)
  }, [key, value])
  return [value, setValue] as const
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/** Download every openapply:* key as a JSON backup. The API keys stay out — a shared file must not leak them. */
export function exportAllData(): void {
  const data: Record<string, unknown> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) data[key] = JSON.parse(localStorage.getItem(key)!)
  }
  const s = data[PREFIX + 'settings'] as Record<string, unknown> | undefined
  if (s) {
    s.apiKey = ''
    s.rapidApiKey = ''
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  a.download = `openapply-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}
