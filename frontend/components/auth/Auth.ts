import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createElement, useState } from "react"
import { ApiFetch, SetSessionToken, type MeResponse } from "../../ts/Api"
import { AuthTemplate } from "./AuthTemplate"

export type AuthState = {
  SignedInEmail: string | null
  Tier: string
  Email: string
  Password: string
  FormError: string
  SetEmail: (Value: string) => void
  SetPassword: (Value: string) => void
  LogIn: () => void
  Register: () => void
  LogOut: () => void
}

function UseAuthState(): AuthState {
  const Cache = useQueryClient()
  const [Email, SetEmail] = useState("")
  const [Password, SetPassword] = useState("")
  const [FormError, SetFormError] = useState("")
  const Me = useQuery({
    queryKey: ["me"],
    queryFn: () => ApiFetch<MeResponse>("/api/me"),
  })
  const Submit = useMutation({
    mutationFn: (Path: string) =>
      ApiFetch<{ token: string }>(Path, "POST", { email: Email, password: Password }),
    onSuccess: (Reply) => {
      SetSessionToken(Reply.token)
      SetFormError("")
      Cache.invalidateQueries()
    },
    onError: (Caught) => SetFormError(String(Caught)),
  })
  const Logout = useMutation({
    mutationFn: () => ApiFetch("/api/auth/logout", "POST"),
    onSettled: () => {
      SetSessionToken(null)
      Cache.invalidateQueries()
    },
  })
  return {
    SignedInEmail: Me.data?.email ?? null,
    Tier: Me.data?.tier ?? "",
    Email,
    Password,
    FormError,
    SetEmail,
    SetPassword,
    LogIn: () => Submit.mutate("/api/auth/login"),
    Register: () => Submit.mutate("/api/auth/register"),
    LogOut: () => Logout.mutate(),
  }
}

export function Auth() {
  return createElement(AuthTemplate, UseAuthState())
}
