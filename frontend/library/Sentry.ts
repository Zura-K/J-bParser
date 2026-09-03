import * as Sentry from "@sentry/react"

let Initialized = false

export function InitSentry() {
  const Dsn = import.meta.env.VITE_SENTRY_DSN
  if (!Dsn) {
    return
  }
  Sentry.init({
    dsn: Dsn,
    environment: import.meta.env.MODE,
    release: "jobsearch-frontend@0.1.0",
    sendDefaultPii: false,
  })
  Initialized = true
}

export function ReportFailedApiCall(
  Method: string,
  Path: string,
  Status: number,
  Detail: string,
) {
  if (!Initialized) {
    return
  }
  if (Status >= 500) {
    Sentry.captureMessage(
      `API ${Method} ${Path} failed with ${Status}: ${Detail}`,
      "error",
    )
  } else {
    Sentry.addBreadcrumb({
      category: "api",
      message: `${Method} ${Path} -> ${Status}: ${Detail}`,
      level: "warning",
    })
  }
}

export function ReportApiException(Method: string, Path: string, Error: unknown) {
  if (!Initialized) {
    return
  }
  Sentry.captureException(Error, {
    tags: { api_method: Method, api_path: Path },
  })
}
