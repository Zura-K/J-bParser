import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { ApiFetch, SetSessionToken, type MeResponse } from "../library/Api"
import Styles from "./Auth.module.css"

export function Auth() {
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
  if (Me.data?.email) {
    return (
      <div className={Styles.Center}>
        <div className={Styles.Panel}>
          <h1 className={Styles.Title}>Account</h1>
          <p className={Styles.Note}>
            Signed in as <span className={Styles.Accent}>{Me.data.email}</span> · tier{" "}
            <span className={Styles.Accent}>{Me.data.tier}</span>
          </p>
          <button className={Styles.SecondaryButton} onClick={() => Logout.mutate()}>
            Log out
          </button>
        </div>
      </div>
    )
  }
  return (
    <div className={Styles.Center}>
      <form
        className={Styles.Panel}
        onSubmit={(Event) => {
          Event.preventDefault()
          Submit.mutate("/api/auth/login")
        }}
      >
        <h1 className={Styles.Title}>Sign in</h1>
        <p className={Styles.Note}>
          You're browsing anonymously. Your profiles and dismissals carry over when you
          register.
        </p>
        <label className={Styles.Field}>
          Email
          <input
            className={Styles.Input}
            type="email"
            placeholder="you@example.com"
            value={Email}
            onChange={(Event) => SetEmail(Event.target.value)}
          />
        </label>
        <label className={Styles.Field}>
          Password
          <input
            className={Styles.Input}
            type="password"
            placeholder="••••••••"
            value={Password}
            onChange={(Event) => SetPassword(Event.target.value)}
          />
        </label>
        {FormError !== "" && <span className={Styles.Error}>{FormError}</span>}
        <div className={Styles.Buttons}>
          <button className={Styles.PrimaryButton} type="submit">
            Log in
          </button>
          <button
            className={Styles.SecondaryButton}
            type="button"
            onClick={() => Submit.mutate("/api/auth/register")}
          >
            Create account
          </button>
        </div>
      </form>
    </div>
  )
}
