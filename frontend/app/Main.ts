import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createElement, StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { InitSentry } from "../components/library/ts/Sentry"
import { App } from "./App"
import "../components/library/css/Theme.css"

InitSentry()

const Client = new QueryClient()

createRoot(document.getElementById("root")!).render(
  createElement(
    StrictMode,
    null,
    createElement(QueryClientProvider, { client: Client }, createElement(App)),
  ),
)
