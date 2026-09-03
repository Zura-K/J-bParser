import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createElement, useState } from "react"
import { ApiFetch, type ProfileFields, type SearchResult } from "../../library/ts/Api"
import { ResultsTemplate } from "./ResultsTemplate"

export type ResultsState = {
  NoProfilesYet: boolean
  ProfileOptions: { Id: string; Label: string }[]
  ActiveProfile: string
  SelectProfile: (Id: string) => void
  Rows: SearchResult[]
  CountLabel: string
  SearchError: string
  RunNote: string
  RunPending: boolean
  RunSources: () => void
  Dismiss: (Fingerprint: string) => void
}

function UseResultsState(): ResultsState {
  const [SelectedProfile, SetSelectedProfile] = useState("")
  const [RunNote, SetRunNote] = useState("")
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
    refetchInterval: 60000,
  })
  const RunSources = useMutation({
    mutationFn: () => ApiFetch<{ queued: string[] }>("/api/sources/run", "POST"),
    onSuccess: (Reply) => {
      SetRunNote(`Queued ${Reply.queued.length} sources — matches update as crawls finish`)
      Cache.invalidateQueries({ queryKey: ["sources"] })
    },
    onError: (Caught) =>
      SetRunNote(Caught instanceof Error ? Caught.message : String(Caught)),
  })
  const Dismiss = useMutation({
    mutationFn: (Fingerprint: string) =>
      ApiFetch("/api/dismiss", "POST", { fingerprint: Fingerprint }),
    onSuccess: () => Cache.invalidateQueries({ queryKey: ["search"] }),
  })
  return {
    NoProfilesYet: ProfilesQuery.isSuccess && ProfileIds.length === 0,
    ProfileOptions: ProfileIds.map((ProfileId) => ({
      Id: ProfileId,
      Label: ProfilesQuery.data?.profiles[ProfileId]?.keywords || ProfileId,
    })),
    ActiveProfile,
    SelectProfile: SetSelectedProfile,
    Rows: SearchQuery.data?.results ?? [],
    CountLabel: SearchQuery.data ? `${SearchQuery.data.results.length} open positions` : "",
    SearchError: SearchQuery.isError ? String(SearchQuery.error) : "",
    RunNote,
    RunPending: RunSources.isPending,
    RunSources: () => RunSources.mutate(),
    Dismiss: (Fingerprint) => Dismiss.mutate(Fingerprint),
  }
}

export function Results() {
  return createElement(ResultsTemplate, UseResultsState())
}
