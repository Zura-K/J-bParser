import { Auth } from "../components/auth/Auth"
import { Landing } from "../components/landing/Landing"
import { Profiles } from "../components/profiles/Profiles"
import { Results } from "../components/results/Results"
import { Sources } from "../components/sources/Sources"
import type { AppState, Tab } from "./App"
import Styles from "./App.module.css"

const NavTabs = [
  { Id: "results", Label: "Results" },
  { Id: "profiles", Label: "Profiles" },
  { Id: "sources", Label: "Sources" },
] as const

function ActivePanel(Props: { Tab: Tab }) {
  switch (Props.Tab) {
    case "results":
      return <Results />
    case "profiles":
      return <Profiles />
    case "sources":
      return <Sources />
    case "account":
      return <Auth />
  }
}

export function AppTemplate(Props: AppState) {
  if (!Props.Entered) {
    return (
      <Landing OnEnter={Props.Enter} Theme={Props.Theme} ToggleTheme={Props.ToggleTheme} />
    )
  }
  return (
    <div className={Styles.Shell}>
      <header className={Styles.Header}>
        <span className={Styles.Brand}>
          jobsearch<span className={Styles.BrandDot}>.</span>
        </span>
        <nav className={Styles.Nav}>
          {NavTabs.map((Item) => (
            <button
              key={Item.Id}
              className={Item.Id === Props.ActiveTab ? Styles.NavActive : Styles.NavButton}
              onClick={() => Props.SetActiveTab(Item.Id)}
            >
              {Item.Label}
            </button>
          ))}
        </nav>
        <div className={Styles.HeaderRight}>
          <button
            className={Styles.ThemeButton}
            title="Toggle theme"
            onClick={Props.ToggleTheme}
          >
            {Props.Theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            className={
              Props.ActiveTab === "account" ? Styles.AccountActive : Styles.AccountButton
            }
            onClick={() => Props.SetActiveTab("account")}
          >
            {Props.AccountLabel}
          </button>
        </div>
      </header>
      <main className={Styles.Main}>
        <ActivePanel Tab={Props.ActiveTab} />
      </main>
    </div>
  )
}
