import { useQuery } from "@tanstack/react-query"
import { createElement, useState } from "react"
import { ApiFetch, type MeResponse } from "../components/library/ts/Api"
import { UseTheme, type ThemeName } from "../components/library/ts/Theme"
import { AppTemplate } from "./AppTemplate"

export type Tab = "results" | "profiles" | "sources" | "account"

export type AppState = {
  Entered: boolean
  Enter: () => void
  ActiveTab: Tab
  SetActiveTab: (Value: Tab) => void
  Theme: ThemeName
  ToggleTheme: () => void
  AccountLabel: string
}

const VisitedKey = "jobsearch_visited"

function UseAppState(): AppState {
  const [Entered, SetEntered] = useState(() => localStorage.getItem(VisitedKey) === "1")
  const [ActiveTab, SetActiveTab] = useState<Tab>("results")
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
    Theme,
    ToggleTheme,
    AccountLabel: Me.data?.email ?? "Sign in",
  }
}

export function App() {
  return createElement(AppTemplate, UseAppState())
}
