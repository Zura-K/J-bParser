import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { InitSentry } from "../ts/Sentry"
import { App } from "./App"
import "../css/Theme.css"

InitSentry()

const Client = new QueryClient()

createRoot(document.getElementById("root")!).render(
  createElement(
    StrictMode,
    null,
    createElement(QueryClientProvider, { client: Client }, createElement(App)),
  ),
)
