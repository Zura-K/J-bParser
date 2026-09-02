import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiFetch, type ProfileFields, type SearchResult } from "../library/Api"
import Styles from "./Results.module.css"

function Age(PostedAt: number): string {
  if (!PostedAt) {
    return "—"
  }
  const Days = Math.floor((Date.now() / 1000 - PostedAt) / 86400)
  return Days < 1 ? "today" : `${Days}d`
}

export function Results() {
  const [SelectedProfile, SetSelectedProfile] = useState("")
  const Cache = useQueryClient()
  const ProfilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => ApiFetch<{ profiles: Record<string, ProfileFields> }>("/api/profiles"),
  })
  const ProfileIds = Object.keys(ProfilesQuery.data?.profiles ?? {})
  const ActiveProfile = SelectedProfile || ProfileIds[0] || ""
  const SearchQuery = useQuery({
    queryKey: ["search", ActiveProfile],
    queryFn: () => ApiFetch<{ results: SearchResult[] }>(`/api/search/${ActiveProfile}`),
    enabled: ActiveProfile !== "",
    retry: false,
  })
  const Dismiss = useMutation({
    mutationFn: (Fingerprint: string) =>
      ApiFetch("/api/dismiss", "POST", { fingerprint: Fingerprint }),
    onSuccess: () => Cache.invalidateQueries({ queryKey: ["search"] }),
  })
  if (ProfilesQuery.isSuccess && ProfileIds.length === 0) {
    return <p className={Styles.Empty}>No profiles yet — create one in the Profiles tab.</p>
  }
  return (
    <div>
      <div className={Styles.Bar}>
        <h1 className={Styles.Title}>Matches</h1>
        <span className={Styles.Count}>
          {SearchQuery.data ? `${SearchQuery.data.results.length} open positions` : ""}
        </span>
        <label className={Styles.ProfilePicker}>
          Profile
          <select
            className={Styles.Select}
            value={ActiveProfile}
            onChange={(Event) => SetSelectedProfile(Event.target.value)}
          >
            {ProfileIds.map((ProfileId) => (
              <option key={ProfileId} value={ProfileId}>
                {ProfilesQuery.data?.profiles[ProfileId]?.keywords || ProfileId}
              </option>
            ))}
          </select>
        </label>
      </div>
      {SearchQuery.isError && (
        <p className={Styles.Error}>{String(SearchQuery.error)}</p>
      )}
      <div className={Styles.Card}>
        <table className={Styles.Table}>
          <thead>
            <tr>
              <th>Match</th>
              <th>Position</th>
              <th>Location</th>
              <th>Age</th>
              <th>Why it matches</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(SearchQuery.data?.results ?? []).map((Row) => (
              <tr key={Row.fingerprint}>
                <td>
                  <span className={Styles.Score}>{Row.score.toFixed(2)}</span>
                </td>
                <td>
                  <a
                    className={Styles.Link}
                    href={Row.url}
                    target="_blank"
                    rel="noreferrer"
                    title={Row.snippet}
                  >
                    {Row.title}
                  </a>
                  <div className={Styles.Company}>{Row.company}</div>
                </td>
                <td className={Styles.Muted}>{Row.location}</td>
                <td className={Styles.Mono}>{Age(Row.posted_at)}</td>
                <td className={Styles.Reason}>{Row.reason}</td>
                <td className={Styles.DismissCell}>
                  <button
                    className={Styles.DismissButton}
                    title="Dismiss"
                    onClick={() => Dismiss.mutate(Row.fingerprint)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
