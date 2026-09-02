const AnonKey = "jobsearch_anon_id"
const TokenKey = "jobsearch_token"

// crypto.randomUUID only exists in secure contexts (HTTPS/localhost);
// fall back to a v4 UUID built from getRandomValues on plain HTTP.
function RandomUuid(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  const Bytes = crypto.getRandomValues(new Uint8Array(16))
  Bytes[6] = (Bytes[6] & 0x0f) | 0x40
  Bytes[8] = (Bytes[8] & 0x3f) | 0x80
  const Hex = Array.from(Bytes, (B) => B.toString(16).padStart(2, "0")).join("")
  return `${Hex.slice(0, 8)}-${Hex.slice(8, 12)}-${Hex.slice(12, 16)}-${Hex.slice(16, 20)}-${Hex.slice(20)}`
}

export function AnonId(): string {
  let Existing = localStorage.getItem(AnonKey)
  if (!Existing) {
    Existing = RandomUuid()
    localStorage.setItem(AnonKey, Existing)
  }
  return Existing
}

export function SessionToken(): string | null {
  return localStorage.getItem(TokenKey)
}

export function SetSessionToken(Value: string | null) {
  if (Value === null) {
    localStorage.removeItem(TokenKey)
  } else {
    localStorage.setItem(TokenKey, Value)
  }
}

export async function ApiFetch<T>(
  Path: string,
  Method = "GET",
  Body?: unknown,
): Promise<T> {
  const HeaderMap: Record<string, string> = {
    "content-type": "application/json",
    "x-anon-id": AnonId(),
  }
  const Session = SessionToken()
  if (Session) {
    HeaderMap["authorization"] = `Bearer ${Session}`
  }
  const Reply = await fetch(Path, {
    method: Method,
    headers: HeaderMap,
    body: Body === undefined ? undefined : JSON.stringify(Body),
  })
  if (!Reply.ok) {
    throw new Error(await Reply.text())
  }
  return Reply.json() as Promise<T>
}

export type ProfileFields = {
  keywords: string
  excluded: string
  locations: string
  remote: string
  seniority: string
  description: string
}

export type SearchResult = {
  fingerprint: string
  title: string
  company: string
  location: string
  url: string
  source: string
  posted_at: number
  snippet: string
  score: number
  reason: string
}

export type SourceRow = {
  key: string
  handler: string
  next_run_at: number
  last_run_at: number
  last_status: string
  last_error: string
  stored: number
  skipped: number
}

export type MeResponse = {
  tier: string
  email: string | null
}
