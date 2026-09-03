import type { LandingProps } from "./Landing"
import Styles from "./Landing.module.css"

const Features = [
  {
    Tag: "aggregate",
    Title: "All sources, deduplicated",
    Body: "Listings from every tracked job board land in one place, with duplicates collapsed automatically.",
  },
  {
    Tag: "score",
    Title: "Ranked for you",
    Body: "Each listing is scored against your profile — keywords, location, seniority — and sorted by fit.",
  },
  {
    Tag: "explain",
    Title: "Reasons, not black boxes",
    Body: "Every match comes with a short explanation of why it surfaced, so you can trust the ranking.",
  },
]

const Steps = [
  {
    Number: "01",
    Title: "Describe what you want.",
    Body: "Keywords, locations, remote preference — or plain prose.",
  },
  {
    Number: "02",
    Title: "We crawl and score.",
    Body: "Sources run on a schedule; new listings are matched within hours.",
  },
  {
    Number: "03",
    Title: "Work the list.",
    Body: "Open what fits, dismiss what doesn't — dismissed jobs never return.",
  },
]

export function LandingTemplate(Props: LandingProps) {
  return (
    <div className={Styles.Shell}>
      <header className={Styles.Header}>
        <span className={Styles.Brand}>
          jobsearch<span className={Styles.BrandDot}>.</span>
        </span>
        <div className={Styles.HeaderRight}>
          <button className={Styles.ThemeButton} onClick={Props.ToggleTheme}>
            {Props.Theme === "dark" ? "Light" : "Dark"}
          </button>
          <button className={Styles.SignIn} onClick={Props.OnEnter}>
            Sign in
          </button>
        </div>
      </header>
      <main className={Styles.Main}>
        <section className={Styles.Hero}>
          <h1 className={Styles.HeroTitle}>
            Every job board.
            <br />
            One ranked list.
          </h1>
          <p className={Styles.HeroLead}>
            jobsearch crawls the boards for you, scores each listing against your profile,
            and tells you why it matched. No accounts, no noise.
          </p>
          <div className={Styles.HeroActions}>
            <button className={Styles.Cta} onClick={Props.OnEnter}>
              Start searching
            </button>
            <span className={Styles.CtaNote}>Free · no signup needed</span>
          </div>
        </section>
        <section className={Styles.Features}>
          {Features.map((Feature) => (
            <div key={Feature.Tag} className={Styles.FeatureCard}>
              <div className={Styles.FeatureTag}>{Feature.Tag}</div>
              <div className={Styles.FeatureTitle}>{Feature.Title}</div>
              <div className={Styles.FeatureBody}>{Feature.Body}</div>
            </div>
          ))}
        </section>
        <section className={Styles.HowItWorks}>
          <h2 className={Styles.HowTitle}>How it works</h2>
          <div className={Styles.Steps}>
            {Steps.map((Step) => (
              <div key={Step.Number} className={Styles.Step}>
                <span className={Styles.StepNumber}>{Step.Number}</span>
                <div>
                  <span className={Styles.StepTitle}>{Step.Title}</span>{" "}
                  <span className={Styles.StepBody}>{Step.Body}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className={Styles.Footer}>
        <span>jobsearch</span>
        <button className={Styles.FooterLink} onClick={Props.OnEnter}>
          Open the app
        </button>
      </footer>
    </div>
  )
}
