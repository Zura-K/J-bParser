import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Profiles } from "../components/profiles/Profiles"

type FetchCall = { Path: string; Method: string; Body: unknown }

const RecordedCalls: FetchCall[] = []

function JsonReply(Payload: unknown): Response {
  return new Response(JSON.stringify(Payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

function StubBackend(Routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (Path: string, Options?: RequestInit) => {
      const Method = Options?.method ?? "GET"
      RecordedCalls.push({
        Path,
        Method,
        Body: Options?.body ? JSON.parse(String(Options.body)) : undefined,
      })
      const Key = `${Method} ${Path}`
      if (Key in Routes) {
        return JsonReply(Routes[Key])
      }
      return new Response(JSON.stringify({ detail: `no stub for ${Key}` }), {
        status: 500,
      })
    }),
  )
}

function RenderProfiles() {
  const Client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={Client}>
      <Profiles />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  RecordedCalls.length = 0
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Profiles", () => {
  it("lists stored profiles with keywords and locations", async () => {
    StubBackend({
      "GET /api/profiles": {
        profiles: {
          p1: { keywords: "python, fastapi", locations: "berlin" },
          p2: { keywords: "", locations: "" },
        },
      },
      "GET /api/me": { tier: "Free", email: null, max_profiles: 3 },
    })
    RenderProfiles()
    expect(await screen.findByText("python, fastapi")).toBeTruthy()
    expect(screen.getByText("berlin")).toBeTruthy()
    expect(screen.getByText("p2")).toBeTruthy()
    expect(screen.getByText("anywhere")).toBeTruthy()
    expect(screen.getByText("+ New profile")).toBeTruthy()
  })

  it("disables new profiles at the tier limit", async () => {
    StubBackend({
      "GET /api/profiles": {
        profiles: { p1: { keywords: "one" }, p2: { keywords: "two" } },
      },
      "GET /api/me": { tier: "Anonymous", email: null, max_profiles: 2 },
    })
    RenderProfiles()
    const LimitButton = (await screen.findByText(
      "Profile limit reached (2 on your tier)",
    )) as HTMLButtonElement
    expect(LimitButton.disabled).toBe(true)
  })

  it("creates a new profile from the editor draft", async () => {
    StubBackend({
      "GET /api/profiles": { profiles: {} },
      "GET /api/me": { tier: "Free", email: null, max_profiles: 3 },
      "POST /api/profiles": { profile_id: "fresh1" },
    })
    RenderProfiles()
    await screen.findByText("New profile")
    fireEvent.change(screen.getByPlaceholderText("python, fastapi, backend"), {
      target: { value: "golang" },
    })
    fireEvent.click(screen.getByText("Save profile"))
    const Created = await vi.waitFor(() => {
      const Call = RecordedCalls.find((Item) => Item.Method === "POST")
      expect(Call).toBeTruthy()
      return Call!
    })
    expect(Created.Path).toBe("/api/profiles")
    expect(Created.Body).toMatchObject({ keywords: "golang", description: "" })
  })

  it("loads a clicked profile into the editor and updates it in place", async () => {
    StubBackend({
      "GET /api/profiles": {
        profiles: { p9: { keywords: "rust", locations: "tokyo", seniority: "senior" } },
      },
      "GET /api/me": { tier: "Paid", email: "x", max_profiles: 10 },
      "PUT /api/profiles/p9": { profile_id: "p9" },
    })
    RenderProfiles()
    fireEvent.click(await screen.findByText("rust"))
    expect(await screen.findByText("Edit profile")).toBeTruthy()
    const KeywordsInput = screen.getByPlaceholderText(
      "python, fastapi, backend",
    ) as HTMLInputElement
    expect(KeywordsInput.value).toBe("rust")
    fireEvent.change(KeywordsInput, { target: { value: "rust, wasm" } })
    fireEvent.click(screen.getByText("Save profile"))
    const Updated = await vi.waitFor(() => {
      const Call = RecordedCalls.find((Item) => Item.Method === "PUT")
      expect(Call).toBeTruthy()
      return Call!
    })
    expect(Updated.Path).toBe("/api/profiles/p9")
    expect(Updated.Body).toMatchObject({ keywords: "rust, wasm", seniority: "senior" })
  })

  it("shows the backend rejection in the form", async () => {
    StubBackend({
      "GET /api/profiles": { profiles: {} },
      "GET /api/me": { tier: "Free", email: null, max_profiles: 3 },
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (Path: string, Options?: RequestInit) => {
        if ((Options?.method ?? "GET") === "POST") {
          return new Response(JSON.stringify({ detail: "embedding limit reached" }), {
            status: 429,
          })
        }
        return JsonReply(
          Path === "/api/me"
            ? { tier: "Free", email: null, max_profiles: 3 }
            : { profiles: {} },
        )
      }),
    )
    RenderProfiles()
    await screen.findByText("New profile")
    fireEvent.click(screen.getByText("Save profile"))
    expect(await screen.findByText("embedding limit reached")).toBeTruthy()
  })

  it("deletes a profile from its row", async () => {
    StubBackend({
      "GET /api/profiles": { profiles: { p1: { keywords: "python" } } },
      "GET /api/me": { tier: "Free", email: null, max_profiles: 3 },
      "DELETE /api/profiles/p1": { ok: true },
    })
    RenderProfiles()
    await screen.findByText("python")
    fireEvent.click(screen.getByTitle("Delete profile"))
    await vi.waitFor(() => {
      expect(
        RecordedCalls.some(
          (Item) => Item.Method === "DELETE" && Item.Path === "/api/profiles/p1",
        ),
      ).toBe(true)
    })
  })
})
