import type { AuthState } from "./Auth"
import Styles from "./Auth.module.css"

export function AuthTemplate(Props: AuthState) {
  if (Props.SignedInEmail) {
    return (
      <div className={Styles.Center}>
        <div className={Styles.Panel}>
          <h1 className={Styles.Title}>Account</h1>
          <p className={Styles.Note}>
            Signed in as <span className={Styles.Accent}>{Props.SignedInEmail}</span> · tier{" "}
            <span className={Styles.Accent}>{Props.Tier}</span>
          </p>
          <button className={Styles.SecondaryButton} onClick={Props.LogOut}>
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
          Props.LogIn()
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
            value={Props.Email}
            onChange={(Event) => Props.SetEmail(Event.target.value)}
          />
        </label>
        <label className={Styles.Field}>
          Password
          <input
            className={Styles.Input}
            type="password"
            placeholder="••••••••"
            value={Props.Password}
            onChange={(Event) => Props.SetPassword(Event.target.value)}
          />
        </label>
        {Props.FormError !== "" && <span className={Styles.Error}>{Props.FormError}</span>}
        <div className={Styles.Buttons}>
          <button className={Styles.PrimaryButton} type="submit">
            Log in
          </button>
          <button className={Styles.SecondaryButton} type="button" onClick={Props.Register}>
            Create account
          </button>
        </div>
      </form>
    </div>
  )
}
