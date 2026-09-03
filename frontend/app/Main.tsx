import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import { InitSentry } from "../library/Sentry"
import "../library/Theme.css"

InitSentry()

const Client = new QueryClient()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={Client}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
