import { createElement } from "react"
import { type ThemeName } from "../../ts/Theme"
import { LandingTemplate } from "./LandingTemplate"

export type LandingProps = {
  OnEnter: () => void
  Theme: ThemeName
  ToggleTheme: () => void
}

export function Landing(Props: LandingProps) {
  return createElement(LandingTemplate, Props)
}
