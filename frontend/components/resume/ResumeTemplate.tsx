import { useState, type KeyboardEvent } from "react"
import type { ResumeState } from "./Resume"
import Styles from "./Resume.module.css"

const TierColor = {
  Good: "var(--Good)",
  Warn: "var(--Warn)",
  Bad: "var(--Bad)",
} as const

const ContactFields = [
  { Name: "email", Label: "Email", Hint: "you@example.com" },
  { Name: "phone", Label: "Phone", Hint: "+995 555 12 34 56" },
  { Name: "location", Label: "Location", Hint: "Tbilisi, Georgia" },
] as const

function TagInput(Props: { Placeholder: string; Compact?: boolean; OnAdd: (Value: string) => void }) {
  const [Draft, SetDraft] = useState("")
  const Commit = (Event: KeyboardEvent<HTMLInputElement>) => {
    if (Event.key === "Enter" && Draft.trim() !== "") {
      Event.preventDefault()
      Props.OnAdd(Draft.trim())
      SetDraft("")
    }
  }
  return (
    <input
      className={Props.Compact ? Styles.TagDraftCompact : Styles.TagDraft}
      placeholder={Props.Placeholder}
      value={Draft}
      onChange={(Event) => SetDraft(Event.target.value)}
      onKeyDown={Commit}
    />
  )
}

function CoverageRing(Props: { Score: number; Color: string }) {
  return (
    <div
      className={Styles.Ring}
      style={{ background: `conic-gradient(${Props.Color} ${Props.Score}%, var(--Surface2) 0)` }}
    >
      <div className={Styles.RingInner} style={{ color: Props.Color }}>
        {Math.round(Props.Score)}%
      </div>
    </div>
  )
}

function TailoringPanel(Props: ResumeState) {
  if (Props.Phase === "empty") {
    return (
      <div className={Styles.EmptyPanel}>
        <div className={Styles.EmptyGlyph}>◎</div>
        <div className={Styles.EmptyTitle}>No vacancy selected</div>
        <p className={Styles.EmptyBody}>
          Pick a vacancy from “Tailor for” above, or open one from Results. We’ll score
          your master profile against it and generate a tailored PDF.
        </p>
        <button
          className={Styles.PrimaryButton}
          onClick={Props.TailorTopMatch}
          disabled={Props.VacancyOptions.length === 0}
        >
          Tailor for top match
        </button>
      </div>
    )
  }
  if (Props.Phase === "loading") {
    return (
      <div className={Styles.Panel}>
        <div className={Styles.LoadingHead}>
          <div className={Styles.Spinner}></div>
          <div>
            <div className={Styles.LoadingTitle}>Tailoring for {Props.VacancyLabel}</div>
            <div className={Styles.LoadingSub}>
              Matching skills, rewriting bullets, rendering PDF…
            </div>
          </div>
        </div>
        <div className={Styles.ShimmerLine} style={{ width: "70%" }}></div>
        <div className={Styles.ShimmerLine} style={{ width: "50%" }}></div>
        <div className={Styles.ShimmerPage}></div>
      </div>
    )
  }
  if (Props.Phase === "error" || Props.Coverage === null) {
    return (
      <div className={Styles.EmptyPanel}>
        <div className={Styles.EmptyTitle}>Tailoring failed</div>
        <p className={Styles.ErrorText}>{Props.TailorError}</p>
        <button className={Styles.SecondaryButton} onClick={Props.Regenerate}>
          ↻ Try again
        </button>
      </div>
    )
  }
  const Color = TierColor[Props.CoverageTier]
  const Total = Props.Coverage.matched.length + Props.Coverage.missing.length
  return (
    <div className={Styles.Stack}>
      <div className={Styles.Panel}>
        <div className={Styles.CoverageHead}>
          <div className={Styles.CoverageMain}>
            <CoverageRing Score={Props.Coverage.score} Color={Color} />
            <div className={Styles.CoverageText}>
              <div className={Styles.SectionLabel}>Coverage</div>
              <div className={Styles.CoverageVacancy}>{Props.VacancyLabel}</div>
              <div className={Styles.CoverageSub}>
                {Props.Coverage.matched.length} of {Total} required skills present
              </div>
            </div>
          </div>
          <div className={Styles.Actions}>
            <button className={Styles.SecondaryButton} onClick={Props.Regenerate}>
              ↻ Regenerate
            </button>
            <button className={Styles.PrimaryButton} onClick={Props.DownloadPdf}>
              ↓ Download PDF
            </button>
          </div>
        </div>
        <div className={Styles.SkillColumns}>
          <div>
            <div className={`${Styles.SkillHeading} ${Styles.SkillHeadingGood}`}>
              <span className={Styles.Dot}></span>Matched · {Props.Coverage.matched.length}
            </div>
            <div className={Styles.Chips}>
              {Props.Coverage.matched.map((Skill) => (
                <span key={Skill} className={`${Styles.Chip} ${Styles.ChipGood}`}>
                  {Skill}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className={`${Styles.SkillHeading} ${Styles.SkillHeadingBad}`}>
              <span className={Styles.Dot}></span>Missing · {Props.Coverage.missing.length}
            </div>
            <div className={Styles.Chips}>
              {Props.Coverage.missing.map((Skill) => (
                <span key={Skill} className={`${Styles.Chip} ${Styles.ChipBad}`}>
                  {Skill}
                </span>
              ))}
            </div>
          </div>
        </div>
        {Props.TailorError !== "" && <p className={Styles.ErrorText}>{Props.TailorError}</p>}
      </div>

      <div className={Styles.PanelTight}>
        <div className={Styles.ViewBar}>
          <div className={Styles.Segment}>
            <button
              className={Props.View === "preview" ? Styles.SegmentActive : Styles.SegmentButton}
              onClick={() => Props.SetView("preview")}
            >
              PDF preview
            </button>
            <button
              className={Props.View === "diff" ? Styles.SegmentActive : Styles.SegmentButton}
              onClick={() => Props.SetView("diff")}
            >
              Diff
            </button>
          </div>
          <span className={Styles.ViewMeta}>{Props.ChangedCount} lines changed</span>
        </div>
        {Props.View === "preview" ? (
          <div className={Styles.PreviewWrap}>
            {Props.PreviewUrl !== "" ? (
              <img className={Styles.PreviewPage} src={Props.PreviewUrl} alt="Tailored resume, first page" />
            ) : (
              <div className={Styles.ShimmerPage}></div>
            )}
          </div>
        ) : (
          <div className={Styles.DiffScroll}>
            <div className={Styles.DiffTable}>
              <div className={Styles.DiffHeader}>
                <div className={Styles.DiffHeaderLeft}>Master</div>
                <div className={Styles.DiffHeaderRight}>Tailored</div>
              </div>
              {Props.Diff.map((Line, Index) => (
                <div key={Index} className={Styles.DiffRow}>
                  <div className={Line.Changed ? Styles.DiffLeftChanged : Styles.DiffCell}>
                    <span className={Styles.DiffMark}>{Line.Changed ? "−" : " "}</span>
                    <span className={Line.Changed ? Styles.Struck : undefined}>{Line.Left}</span>
                  </div>
                  <div className={Line.Changed ? Styles.DiffRightChanged : Styles.DiffCell}>
                    <span className={Styles.DiffMark}>{Line.Changed ? "+" : " "}</span>
                    <span>{Line.Right}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ResumeTemplate(Props: ResumeState) {
  const Status = Props.SavePending
    ? "Saving…"
    : Props.Dirty
      ? "Unsaved changes"
      : Props.SaveStatus || "Master profile"
  return (
    <div>
      <div className={Styles.Bar}>
        <h1 className={Styles.Title}>Resume</h1>
        <span className={Styles.Status}>{Status}</span>
        <button
          className={Styles.SaveButton}
          onClick={Props.Save}
          disabled={Props.SavePending || !Props.Dirty}
        >
          Save
        </button>
        <label className={Styles.Picker}>
          Tailor for
          <select
            className={Styles.Select}
            value={Props.VacancyId}
            onChange={(Event) => Props.SelectVacancy(Event.target.value)}
          >
            <option value="">— no vacancy —</option>
            {Props.VacancyOptions.map((Option) => (
              <option key={Option.Id} value={Option.Id}>
                {Option.Label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={Styles.Grid}>
        <section className={Styles.Editor}>
          <div className={Styles.Card}>
            <h2 className={Styles.SectionLabel}>Identity</h2>
            <div className={Styles.IdentityGrid}>
              <input
                className={Styles.InputStrong}
                placeholder="Full name"
                value={Props.Draft.full_name}
                onChange={(Event) => Props.SetIdentity("full_name", Event.target.value)}
              />
              <input
                className={Styles.Input}
                placeholder="Title, e.g. Senior Backend Engineer"
                value={Props.Draft.title}
                onChange={(Event) => Props.SetIdentity("title", Event.target.value)}
              />
              {ContactFields.map((Field) => (
                <input
                  key={Field.Name}
                  className={Styles.Input}
                  placeholder={Field.Hint}
                  title={Field.Label}
                  value={Props.Draft.contact[Field.Name] ?? ""}
                  onChange={(Event) => Props.SetContact(Field.Name, Event.target.value)}
                />
              ))}
            </div>
          </div>

          <div className={Styles.Card}>
            <div className={Styles.CardHead}>
              <h2 className={Styles.SectionLabel}>Summary</h2>
              <span className={Styles.Mono}>{Props.Draft.summary.length} chars</span>
            </div>
            <textarea
              className={Styles.TextArea}
              rows={4}
              value={Props.Draft.summary}
              onChange={(Event) => Props.SetSummary(Event.target.value)}
            />
          </div>

          <div className={Styles.Card}>
            <div className={Styles.CardHead}>
              <h2 className={Styles.SectionLabel}>Experience</h2>
              <button className={Styles.SmallButton} onClick={Props.AddRole}>
                + Add role
              </button>
            </div>
            <div className={Styles.Roles}>
              {Props.Draft.experience.map((Role, RoleIndex) => (
                <div key={RoleIndex} className={Styles.Role}>
                  <div className={Styles.RoleGrid}>
                    <input
                      className={Styles.InputStrong}
                      placeholder="Role"
                      value={Role.role}
                      onChange={(Event) => Props.SetRoleField(RoleIndex, "role", Event.target.value)}
                    />
                    <input
                      className={Styles.Input}
                      placeholder="Company"
                      value={Role.company}
                      onChange={(Event) => Props.SetRoleField(RoleIndex, "company", Event.target.value)}
                    />
                    <input
                      className={Styles.InputMono}
                      placeholder="Start"
                      value={Role.start}
                      onChange={(Event) => Props.SetRoleField(RoleIndex, "start", Event.target.value)}
                    />
                    <input
                      className={Styles.InputMono}
                      placeholder="End / Present"
                      value={Role.end}
                      onChange={(Event) => Props.SetRoleField(RoleIndex, "end", Event.target.value)}
                    />
                  </div>
                  <div className={Styles.Bullets}>
                    {Role.bullets.map((Bullet, BulletIndex) => (
                      <div key={BulletIndex} className={Styles.BulletRow}>
                        <textarea
                          className={Styles.BulletText}
                          rows={3}
                          value={Bullet.text}
                          onChange={(Event) =>
                            Props.SetBulletText(RoleIndex, BulletIndex, Event.target.value)
                          }
                        />
                        <div className={Styles.BulletTags}>
                          {Bullet.skills.map((Skill, SkillIndex) => (
                            <span key={Skill} className={Styles.Tag}>
                              {Skill}
                              <button
                                className={Styles.TagRemove}
                                title="Remove skill tag"
                                onClick={() =>
                                  Props.RemoveBulletSkill(RoleIndex, BulletIndex, SkillIndex)
                                }
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                          <TagInput
                            Placeholder="+ skill"
                            Compact
                            OnAdd={(Skill) => Props.AddBulletSkill(RoleIndex, BulletIndex, Skill)}
                          />
                        </div>
                        <button
                          className={Styles.IconButton}
                          title="Remove bullet"
                          onClick={() => Props.RemoveBullet(RoleIndex, BulletIndex)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <div className={Styles.RoleFoot}>
                      <button className={Styles.LinkButton} onClick={() => Props.AddBullet(RoleIndex)}>
                        + Add bullet
                      </button>
                      <button className={Styles.LinkButtonMuted} onClick={() => Props.RemoveRole(RoleIndex)}>
                        Remove role
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={Styles.Card}>
            <h2 className={Styles.SectionLabel}>Skills</h2>
            <div className={Styles.SkillTags}>
              {Props.Draft.skills.map((Skill, SkillIndex) => (
                <span key={Skill} className={Styles.SkillTag}>
                  {Skill}
                  <button
                    className={Styles.TagRemove}
                    title="Remove skill"
                    onClick={() => Props.RemoveSkill(SkillIndex)}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <TagInput Placeholder="Add skill, press Enter" OnAdd={Props.AddSkill} />
            </div>
          </div>

          <div className={Styles.Card}>
            <div className={Styles.CardHead}>
              <h2 className={Styles.SectionLabel}>Education</h2>
              <button className={Styles.SmallButton} onClick={Props.AddEducation}>
                + Add
              </button>
            </div>
            <div className={Styles.EducationRows}>
              {Props.Draft.education.map((Item, Index) => (
                <div key={Index} className={Styles.EducationGrid}>
                  <input
                    className={Styles.InputStrong}
                    placeholder="Institution"
                    value={Item.institution}
                    onChange={(Event) => Props.SetEducationField(Index, "institution", Event.target.value)}
                  />
                  <input
                    className={Styles.Input}
                    placeholder="Degree"
                    value={Item.degree}
                    onChange={(Event) => Props.SetEducationField(Index, "degree", Event.target.value)}
                  />
                  <input
                    className={Styles.InputMono}
                    placeholder="Year"
                    value={Item.year}
                    onChange={(Event) => Props.SetEducationField(Index, "year", Event.target.value)}
                  />
                  <button
                    className={Styles.IconButton}
                    title="Remove"
                    onClick={() => Props.RemoveEducation(Index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={Styles.Side}>
          <TailoringPanel {...Props} />
        </section>
      </div>
    </div>
  )
}
