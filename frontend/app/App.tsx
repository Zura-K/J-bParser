import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { ApiFetch, type MeResponse } from "../library/Api"
import Styles from "./App.module.css"
import { Auth } from "../auth/Auth"
import { Landing } from "../landing/Landing"
import { Profiles } from "../profiles/Profiles"
import { Results } from "../results/Results"
import { Sources } from "../sources/Sources"
import { UseTheme } from "../library/Theme"

const NavTabs = [
  { Id: "results", Label: "Results" },
  { Id: "profiles", Label: "Profiles" },
  { Id: "sources", Label: "Sources" },
] as const

type Tab = (typeof NavTabs)[number]["Id"] | "account"

const VisitedKey = "jobsearch_visited"

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

export function App() {
  const [Entered, SetEntered] = useState(() => localStorage.getItem(VisitedKey) === "1")
  const [ActiveTab, SetActiveTab] = useState<Tab>("results")
  const { Theme, ToggleTheme } = UseTheme()
  const Me = useQuery({
    queryKey: ["me"],
    queryFn: () => ApiFetch<MeResponse>("/api/me"),
  })
  const Enter = () => {
    localStorage.setItem(VisitedKey, "1")
    SetEntered(true)
  }
  if (!Entered) {
    return <Landing OnEnter={Enter} Theme={Theme} ToggleTheme={ToggleTheme} />
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
              className={Item.Id === ActiveTab ? Styles.NavActive : Styles.NavButton}
              onClick={() => SetActiveTab(Item.Id)}
            >
              {Item.Label}
            </button>
          ))}
        </nav>
        <div className={Styles.HeaderRight}>
          <button className={Styles.ThemeButton} title="Toggle theme" onClick={ToggleTheme}>
            {Theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            className={ActiveTab === "account" ? Styles.AccountActive : Styles.AccountButton}
            onClick={() => SetActiveTab("account")}
          >
            {Me.data?.email ?? "Sign in"}
          </button>
        </div>
      </header>
      <main className={Styles.Main}>
        <ActivePanel Tab={ActiveTab} />
      </main>
    </div>
  )
}
