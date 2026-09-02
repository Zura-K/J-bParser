import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiFetch, type MeResponse, type ProfileFields } from "../library/Api"
import Styles from "./Profiles.module.css"

const EmptyProfile: ProfileFields = {
  keywords: "",
  excluded: "",
  locations: "",
  remote: "",
  seniority: "",
  description: "",
}

const LineFields = [
  { Name: "keywords", Label: "Keywords", Hint: "python, fastapi, backend" },
  { Name: "excluded", Label: "Excluded", Hint: "php, wordpress" },
  { Name: "locations", Label: "Locations", Hint: "tallinn, remote" },
  { Name: "remote", Label: "Remote", Hint: "yes / no / hybrid" },
  { Name: "seniority", Label: "Seniority", Hint: "mid, senior" },
] as const

export function Profiles() {
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
  const AtProfileLimit = MaxProfiles !== undefined && Rows.length >= MaxProfiles
  return (
    <div>
      <h1 className={Styles.Title}>Search profiles</h1>
      <p className={Styles.Subtitle}>
        Each profile is a saved search. Matches are scored against it continuously.
      </p>
      <div className={Styles.Split}>
        <div className={Styles.List}>
          {Rows.map(([ProfileId, Fields]) => (
            <div
              key={ProfileId}
              className={
                ProfileId === EditingId ? `${Styles.Row} ${Styles.RowEditing}` : Styles.Row
              }
            >
              <button
                className={Styles.RowMain}
                onClick={() => {
                  SetEditingId(ProfileId)
                  SetDraft({ ...EmptyProfile, ...Fields })
                  SetFormError("")
                }}
              >
                <span className={Styles.RowTitle}>
                  {Fields.keywords || ProfileId}
                  {ProfileId === EditingId && (
                    <span className={Styles.EditingBadge}>editing</span>
                  )}
                </span>
                <span className={Styles.RowSub}>{Fields.locations || "anywhere"}</span>
              </button>
              <button
                className={Styles.Delete}
                title="Delete profile"
                onClick={() => Remove.mutate(ProfileId)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className={Styles.NewButton}
            onClick={Reset}
            disabled={AtProfileLimit}
            title={
              AtProfileLimit
                ? `Your tier allows at most ${MaxProfiles} profile${MaxProfiles === 1 ? "" : "s"}`
                : undefined
            }
          >
            {AtProfileLimit
              ? `Profile limit reached (${MaxProfiles} on your tier)`
              : "+ New profile"}
          </button>
          </button>
        </div>
        <form
          className={Styles.Editor}
          onSubmit={(Event) => {
            Event.preventDefault()
            Save.mutate()
          }}
        >
          <span className={Styles.EditorTitle}>
            {EditingId === null ? "New profile" : "Edit profile"}
          </span>
          {LineFields.map((Field) => (
            <label key={Field.Name} className={Styles.Field}>
              {Field.Label}
              <input
                className={Styles.Input}
                placeholder={Field.Hint}
                value={Draft[Field.Name]}
                onChange={(Event) => SetDraft({ ...Draft, [Field.Name]: Event.target.value })}
              />
            </label>
          ))}
          <label className={Styles.Field}>
            Description
            <textarea
              className={Styles.TextArea}
              rows={5}
              placeholder="Describe the role you want in your own words — used for AI scoring"
              value={Draft.description}
              onChange={(Event) => SetDraft({ ...Draft, description: Event.target.value })}
            />
          </label>
          {FormError !== "" && <span className={Styles.Error}>{FormError}</span>}
          <button className={Styles.SaveButton} type="submit" disabled={Save.isPending}>
            Save profile
          </button>
        </form>
      </div>
    </div>
  )
}
