import { TierOf, type ResultsState } from "./Results"
import Styles from "./Results.module.css"

const TierClass = {
  Good: Styles.ScoreGood,
  Warn: Styles.ScoreWarn,
  Bad: Styles.ScoreBad,
} as const

function Age(PostedAt: number): string {
  if (!PostedAt) {
    return "—"
  }
  const Days = Math.floor((Date.now() / 1000 - PostedAt) / 86400)
  return Days < 1 ? "today" : `${Days}d`
}

export function ResultsTemplate(Props: ResultsState) {
  if (Props.NoProfilesYet) {
    return <p className={Styles.Empty}>No profiles yet — create one in the Profiles tab.</p>
  }
  return (
    <div>
      <div className={Styles.Bar}>
        <h1 className={Styles.Title}>Matches</h1>
        <span className={Styles.Count}>{Props.CountLabel}</span>
        <button
          className={Styles.RunButton}
          onClick={Props.RunSources}
          disabled={Props.RunPending}
        >
          <span className={Styles.RunGlyph}>▸</span>
          {Props.RunPending ? "Queueing…" : "Run parsing"}
        </button>
        <label className={Styles.ProfilePicker}>
          Profile
          <select
            className={Styles.Select}
            value={Props.ActiveProfile}
            onChange={(Event) => Props.SelectProfile(Event.target.value)}
          >
            {Props.ProfileOptions.map((Option) => (
              <option key={Option.Id} value={Option.Id}>
                {Option.Label}
              </option>
            ))}
          </select>
        </label>
        {Props.RunNote !== "" && <span className={Styles.RunNote}>{Props.RunNote}</span>}
      </div>
      {Props.SearchError !== "" && <p className={Styles.Error}>{Props.SearchError}</p>}
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {Props.Rows.map((Row) => (
              <tr key={Row.fingerprint}>
                <td>
                  <span className={`${Styles.Score} ${TierClass[TierOf(Row.score)]}`}>
                    {Row.score.toFixed(2)}
                  </span>
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
                <td className={Styles.TailorCell}>
                  <button
                    className={Styles.TailorButton}
                    title="Tailor your resume for this vacancy"
                    onClick={() => Props.Tailor(Row.fingerprint)}
                  >
                    Tailor
                  </button>
                </td>
                <td className={Styles.DismissCell}>
                  <button
                    className={Styles.DismissButton}
                    title="Dismiss"
                    onClick={() => Props.Dismiss(Row.fingerprint)}
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
