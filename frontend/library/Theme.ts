import { useEffect, useState } from "react"

const ThemeKey = "jobsearch_theme"

export type ThemeName = "dark" | "light"

function StoredTheme(): ThemeName {
  return localStorage.getItem(ThemeKey) === "light" ? "light" : "dark"
}

export function UseTheme(): { Theme: ThemeName; ToggleTheme: () => void } {
  const [Theme, SetTheme] = useState<ThemeName>(StoredTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = Theme
    localStorage.setItem(ThemeKey, Theme)
  }, [Theme])
  return {
    Theme,
    ToggleTheme: () => SetTheme((Current) => (Current === "dark" ? "light" : "dark")),
  }
}
