import { useQuery } from "@tanstack/react-query"
import { createElement, useState } from "react"
import { ApiFetch, type MeResponse } from "../library/ts/Api"
import { UseTheme, type ThemeName } from "../library/ts/Theme"
import { AppTemplate } from "./AppTemplate"

export type Tab = "results" | "profiles" | "resume" | "sources" | "account"

export type AppState = {
  Entered: boolean
  Enter: () => void
  ActiveTab: Tab
  SetActiveTab: (Value: Tab) => void
  TailorVacancy: string
  OpenResume: (Fingerprint: string) => void
  Theme: ThemeName
  ToggleTheme: () => void
  AccountLabel: string
}

const VisitedKey = "jobsearch_visited"

function UseAppState(): AppState {
  const [Entered, SetEntered] = useState(() => localStorage.getItem(VisitedKey) === "1")
  const [ActiveTab, SetActiveTab] = useState<Tab>("results")
  const [TailorVacancy, SetTailorVacancy] = useState("")
  const { Theme, ToggleTheme } = UseTheme()
  const Me = useQuery({
    queryKey: ["me"],
    queryFn: () => ApiFetch<MeResponse>("/api/me"),
  })
  return {
    Entered,
    Enter: () => {
      localStorage.setItem(VisitedKey, "1")
      SetEntered(true)
    },
    ActiveTab,
    SetActiveTab,
    TailorVacancy,
    OpenResume: (Fingerprint) => {
      SetTailorVacancy(Fingerprint)
      SetActiveTab("resume")
    },
    Theme,
    ToggleTheme,
    AccountLabel: Me.data?.email ?? "Sign in",
  }
}

export function App() {
  return createElement(AppTemplate, UseAppState())
}
