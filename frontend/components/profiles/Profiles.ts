import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createElement, useState } from "react"
import { ApiFetch, type MeResponse, type ProfileFields } from "../../ts/Api"
import { ProfilesTemplate } from "./ProfilesTemplate"

export const EmptyProfile: ProfileFields = {
  keywords: "",
  excluded: "",
  locations: "",
  remote: "",
  seniority: "",
  description: "",
}

export type ProfilesState = {
  Rows: [string, ProfileFields][]
  EditingId: string | null
  Draft: ProfileFields
  FormError: string
  MaxProfiles: number | undefined
  AtProfileLimit: boolean
  SavePending: boolean
  StartNew: () => void
  Edit: (ProfileId: string, Fields: ProfileFields) => void
  SetDraftField: (Name: keyof ProfileFields, Value: string) => void
  Save: () => void
  Remove: (ProfileId: string) => void
}

function UseProfilesState(): ProfilesState {
  const Cache = useQueryClient()
  const [EditingId, SetEditingId] = useState<string | null>(null)
  const [Draft, SetDraft] = useState<ProfileFields>(EmptyProfile)
  const [FormError, SetFormError] = useState("")
  const ProfilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => ApiFetch<{ profiles: Record<string, ProfileFields> }>("/api/profiles"),
  })
  const Me = useQuery({
    queryKey: ["me"],
    queryFn: () => ApiFetch<MeResponse>("/api/me"),
  })
  const Reset = () => {
    SetEditingId(null)
    SetDraft(EmptyProfile)
    SetFormError("")
  }
  const Save = useMutation({
    mutationFn: () =>
      EditingId === null
        ? ApiFetch<{ profile_id: string }>("/api/profiles", "POST", Draft)
        : ApiFetch<{ profile_id: string }>(`/api/profiles/${EditingId}`, "PUT", Draft),
    onSuccess: (Reply) => {
      Cache.invalidateQueries()
      SetEditingId(Reply.profile_id)
      SetFormError("")
    },
    onError: (Caught) =>
      SetFormError(Caught instanceof Error ? Caught.message : String(Caught)),
  })
  const Remove = useMutation({
    mutationFn: (ProfileId: string) =>
      ApiFetch(`/api/profiles/${ProfileId}`, "DELETE").then(() => ProfileId),
    onSuccess: (ProfileId) => {
      Cache.invalidateQueries()
      if (ProfileId === EditingId) {
        Reset()
      }
    },
  })
  const Rows = Object.entries(ProfilesQuery.data?.profiles ?? {})
  const MaxProfiles = Me.data?.max_profiles
  return {
    Rows,
    EditingId,
    Draft,
    FormError,
    MaxProfiles,
    AtProfileLimit: MaxProfiles !== undefined && Rows.length >= MaxProfiles,
    SavePending: Save.isPending,
    StartNew: Reset,
    Edit: (ProfileId, Fields) => {
      SetEditingId(ProfileId)
      SetDraft({ ...EmptyProfile, ...Fields })
      SetFormError("")
    },
    SetDraftField: (Name, Value) => SetDraft((Current) => ({ ...Current, [Name]: Value })),
    Save: () => Save.mutate(),
    Remove: (ProfileId) => Remove.mutate(ProfileId),
  }
}

export function Profiles() {
  return createElement(ProfilesTemplate, UseProfilesState())
}
