import { useQuery } from "@tanstack/react-query"
import { ApiFetch, type SourceRow } from "../library/Api"
import Styles from "./Sources.module.css"

function Stamp(Epoch: number): string {
  return Epoch ? new Date(Epoch * 1000).toISOString().slice(0, 16).replace("T", " ") : "—"
}

export function Sources() {
  const SourcesQuery = useQuery({
    queryKey: ["sources"],
    queryFn: () => ApiFetch<{ sources: SourceRow[] }>("/api/sources"),
    refetchInterval: 30000,
  })
  return (
    <div>
      <h1 className={Styles.Title}>Sources</h1>
      <p className={Styles.Subtitle}>Job boards we crawl, and when they run next.</p>
      <div className={Styles.Card}>
        <table className={Styles.Table}>
          <thead>
            <tr>
              <th>Source</th>
              <th>Status</th>
              <th>Last run</th>
              <th>Next run</th>
              <th className={Styles.Numeric}>Stored</th>
              <th className={Styles.Numeric}>Skipped</th>
            </tr>
          </thead>
          <tbody>
            {(SourcesQuery.data?.sources ?? []).map((Row) => (
              <tr key={Row.key}>
                <td className={Styles.SourceKey}>
                  {Row.company !== "" ? `${Row.company} (${Row.key})` : Row.key}
                  {!Row.active && <span className={Styles.Inactive}>inactive</span>}
                </td>
                <td>
                  <span
                    className={
                      Row.last_status === "error" ? Styles.StatusBad : Styles.StatusGood
                    }
                  >
                    <span className={Styles.StatusDot}></span>
                    {Row.last_status || "—"}
                  </span>
                  {Row.last_error !== "" && (
                    <div className={Styles.ErrorText}>{Row.last_error}</div>
                  )}
                </td>
                <td className={Styles.Mono}>{Stamp(Row.last_run_at)}</td>
                <td className={Styles.Mono}>{Stamp(Row.next_run_at)}</td>
                <td className={`${Styles.Numeric} ${Styles.CountCell}`}>{Row.stored}</td>
                <td className={`${Styles.Numeric} ${Styles.CountMuted}`}>{Row.skipped}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
