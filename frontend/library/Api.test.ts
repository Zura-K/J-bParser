import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AnonId, ApiFetch, SessionToken, SetSessionToken } from "./Api"

const UuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function JsonReply(Status: number, Payload: unknown): Response {
  return new Response(JSON.stringify(Payload), {
    status: Status,
    headers: { "content-type": "application/json" },
  })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("AnonId", () => {
  it("generates a valid uuid and keeps it stable across calls", () => {
    const First = AnonId()
    expect(First).toMatch(UuidPattern)
    expect(AnonId()).toBe(First)
  })
})

describe("SessionToken", () => {
  it("stores, returns and clears the token", () => {
    expect(SessionToken()).toBeNull()
    SetSessionToken("tok-1")
    expect(SessionToken()).toBe("tok-1")
    SetSessionToken(null)
    expect(SessionToken()).toBeNull()
  })
})

describe("ApiFetch", () => {
  it("sends the anon id and content type, and returns the parsed body", async () => {
    const FetchMock = vi.fn().mockResolvedValue(JsonReply(200, { ok: true }))
    vi.stubGlobal("fetch", FetchMock)
    const Reply = await ApiFetch<{ ok: boolean }>("/api/me")
    expect(Reply.ok).toBe(true)
    const [Path, Options] = FetchMock.mock.calls[0]
    expect(Path).toBe("/api/me")
    expect(Options.method).toBe("GET")
    expect(Options.headers["x-anon-id"]).toMatch(UuidPattern)
    expect(Options.headers["content-type"]).toBe("application/json")
    expect(Options.headers["authorization"]).toBeUndefined()
    expect(Options.body).toBeUndefined()
  })

  it("attaches the bearer token and serializes the body", async () => {
    const FetchMock = vi.fn().mockResolvedValue(JsonReply(200, {}))
    vi.stubGlobal("fetch", FetchMock)
    SetSessionToken("tok-2")
    await ApiFetch("/api/profiles", "POST", { keywords: "python" })
    const [, Options] = FetchMock.mock.calls[0]
    expect(Options.method).toBe("POST")
    expect(Options.headers["authorization"]).toBe("Bearer tok-2")
    expect(JSON.parse(Options.body)).toEqual({ keywords: "python" })
  })

  it("throws the backend detail message on a failed reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(JsonReply(403, { detail: "profile limit reached" })),
    )
    await expect(ApiFetch("/api/profiles", "POST", {})).rejects.toThrow(
      "profile limit reached",
    )
  })

  it("falls back to the raw body when the failure is not json", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("gateway exploded", { status: 502 })),
    )
    await expect(ApiFetch("/api/me")).rejects.toThrow("gateway exploded")
  })

  it("rethrows network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed to fetch")))
    await expect(ApiFetch("/api/me")).rejects.toThrow("failed to fetch")
  })
})
