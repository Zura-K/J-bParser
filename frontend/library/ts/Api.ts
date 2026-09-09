import { ReportApiException, ReportFailedApiCall } from "./Sentry"

const AnonKey = "jobsearch_anon_id"
const TokenKey = "jobsearch_token"
const AdminKey = "jobsearch_admin"

// TEMPORARY debug switch: visiting /?admin=1 sticks an admin flag in
// localStorage so the backend upgrades this browser to the Paid tier
// (/?admin=0 clears it). Remove this and its header uses when done.
export function AdminMode(): boolean {
  const Requested = new URLSearchParams(window.location.search).get("admin")
  if (Requested === "1") {
    localStorage.setItem(AdminKey, "1")
  } else if (Requested === "0") {
    localStorage.removeItem(AdminKey)
  }
  return localStorage.getItem(AdminKey) === "1"
}

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
  if (AdminMode()) {
    HeaderMap["x-admin"] = "1"
  }
  let Reply: Response
  try {
    Reply = await fetch(Path, {
      method: Method,
      headers: HeaderMap,
      body: Body === undefined ? undefined : JSON.stringify(Body),
    })
  } catch (Error) {
    ReportApiException(Method, Path, Error)
    throw Error
  }
  if (!Reply.ok) {
    const RawBody = await Reply.text()
    let Detail = RawBody
    try {
      const Parsed = JSON.parse(RawBody) as { detail?: unknown }
      if (typeof Parsed.detail === "string") {
        Detail = Parsed.detail
      }
    } catch {
      Detail = RawBody
    }
    ReportFailedApiCall(Method, Path, Reply.status, Detail)
    throw new Error(Detail || Reply.statusText)
  }
  return Reply.json() as Promise<T>
}

export async function ApiFetchBlob(Path: string): Promise<Blob> {
  const HeaderMap: Record<string, string> = {
    "x-anon-id": AnonId(),
  }
  const Session = SessionToken()
  if (Session) {
    HeaderMap["authorization"] = `Bearer ${Session}`
  }
  if (AdminMode()) {
    HeaderMap["x-admin"] = "1"
  }
  let Reply: Response
  try {
    Reply = await fetch(Path, { headers: HeaderMap })
  } catch (Error) {
    ReportApiException("GET", Path, Error)
    throw Error
  }
  if (!Reply.ok) {
    const Detail = await Reply.text()
    ReportFailedApiCall("GET", Path, Reply.status, Detail)
    throw new Error(Detail || Reply.statusText)
  }
  return Reply.blob()
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
  company: string
  region: string
  active: boolean
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
  max_profiles: number
}

export type ResumeBullet = {
  text: string
  skills: string[]
}

export type ResumeExperience = {
  company: string
  role: string
  start: string
  end: string
  bullets: ResumeBullet[]
}

export type MasterProfile = {
  full_name: string
  title: string
  contact: Record<string, string>
  summary: string
  experience: ResumeExperience[]
  skills: string[]
  education: Record<string, string>[]
}

export type ResumeCoverage = {
  matched: string[]
  missing: string[]
  score: number
}

export type TailoredResume = {
  coverage: ResumeCoverage
  resume: MasterProfile
}

export function FetchMasterProfile(): Promise<{ profile: MasterProfile }> {
  return ApiFetch<{ profile: MasterProfile }>("/api/resume/profile")
}

export function SaveMasterProfile(Profile: MasterProfile): Promise<{ ok: boolean }> {
  return ApiFetch<{ ok: boolean }>("/api/resume/profile", "PUT", Profile)
}

export function TailorResume(VacancyId: string): Promise<TailoredResume> {
  return ApiFetch<TailoredResume>(`/api/resume/${VacancyId}`, "POST")
}

export function FetchResumePdf(VacancyId: string): Promise<Blob> {
  return ApiFetchBlob(`/api/resume/${VacancyId}/pdf`)
}

export function FetchResumePreview(VacancyId: string): Promise<Blob> {
  return ApiFetchBlob(`/api/resume/${VacancyId}/preview.png`)
}
