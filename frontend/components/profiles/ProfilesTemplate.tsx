import type { ProfilesState } from "./Profiles"
import Styles from "./Profiles.module.css"

const LineFields = [
  { Name: "keywords", Label: "Keywords", Hint: "python, fastapi, backend" },
  { Name: "excluded", Label: "Excluded", Hint: "php, wordpress" },
  { Name: "locations", Label: "Locations", Hint: "tallinn, remote" },
  { Name: "remote", Label: "Remote", Hint: "yes / no / hybrid" },
  { Name: "seniority", Label: "Seniority", Hint: "mid, senior" },
] as const

export function ProfilesTemplate(Props: ProfilesState) {
  return (
    <div>
      <h1 className={Styles.Title}>Search profiles</h1>
      <p className={Styles.Subtitle}>
        Each profile is a saved search. Matches are scored against it continuously.
      </p>
      <div className={Styles.Split}>
        <div className={Styles.List}>
          {Props.Rows.map(([ProfileId, Fields]) => (
            <div
              key={ProfileId}
              className={
                ProfileId === Props.EditingId
                  ? `${Styles.Row} ${Styles.RowEditing}`
                  : Styles.Row
              }
            >
              <button
                className={Styles.RowMain}
                onClick={() => Props.Edit(ProfileId, Fields)}
              >
                <span className={Styles.RowTitle}>
                  {Fields.keywords || ProfileId}
                  {ProfileId === Props.EditingId && (
                    <span className={Styles.EditingBadge}>editing</span>
                  )}
                </span>
                <span className={Styles.RowSub}>{Fields.locations || "anywhere"}</span>
              </button>
              <button
                className={Styles.Delete}
                title="Delete profile"
                onClick={() => Props.Remove(ProfileId)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className={Styles.NewButton}
            onClick={Props.StartNew}
            disabled={Props.AtProfileLimit}
            title={
              Props.AtProfileLimit
                ? `Your tier allows at most ${Props.MaxProfiles} profile${Props.MaxProfiles === 1 ? "" : "s"}`
                : undefined
            }
          >
            {Props.AtProfileLimit
              ? `Profile limit reached (${Props.MaxProfiles} on your tier)`
              : "+ New profile"}
          </button>
        </div>
        <form
          className={Styles.Editor}
          onSubmit={(Event) => {
            Event.preventDefault()
            Props.Save()
          }}
        >
          <span className={Styles.EditorTitle}>
            {Props.EditingId === null ? "New profile" : "Edit profile"}
          </span>
          {LineFields.map((Field) => (
            <label key={Field.Name} className={Styles.Field}>
              {Field.Label}
              <input
                className={Styles.Input}
                placeholder={Field.Hint}
                value={Props.Draft[Field.Name]}
                onChange={(Event) => Props.SetDraftField(Field.Name, Event.target.value)}
              />
            </label>
          ))}
          <label className={Styles.Field}>
            Description
            <textarea
              className={Styles.TextArea}
              rows={5}
              placeholder="Describe the role you want in your own words — used for AI scoring"
              value={Props.Draft.description}
              onChange={(Event) => Props.SetDraftField("description", Event.target.value)}
            />
          </label>
          {Props.FormError !== "" && <span className={Styles.Error}>{Props.FormError}</span>}
          <button className={Styles.SaveButton} type="submit" disabled={Props.SavePending}>
            Save profile
          </button>
        </form>
      </div>
    </div>
  )
}
