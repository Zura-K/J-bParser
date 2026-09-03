import { useQuery } from "@tanstack/react-query"
import { createElement } from "react"
import { ApiFetch, type SourceRow } from "../../ts/Api"
import { SourcesTemplate } from "./SourcesTemplate"

export type SourcesState = {
  Rows: SourceRow[]
}

function UseSourcesState(): SourcesState {
  const SourcesQuery = useQuery({
    queryKey: ["sources"],
    queryFn: () => ApiFetch<{ sources: SourceRow[] }>("/api/sources"),
    refetchInterval: 30000,
  })
  return { Rows: SourcesQuery.data?.sources ?? [] }
}

export function Sources() {
  return createElement(SourcesTemplate, UseSourcesState())
}
