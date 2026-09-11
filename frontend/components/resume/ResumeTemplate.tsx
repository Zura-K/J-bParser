import { useState, type KeyboardEvent } from "react"
import type { WidgetId } from "../../library/ts/Api"
import { PageTemplate } from "./PageTemplate"
import {
  BulletWidgets,
  EntryFields,
  Presets,
  WidgetLabels,
  type ResumeState,
  type TemplateKey,
  type TemplateValue,
  type Tier,
} from "./Resume"
import Styles from "./Resume.module.css"

const TierColor: Record<Tier, string> = {
  Good: "var(--Good)",
  Warn: "var(--Warn)",
  Bad: "var(--Bad)",
}

const PctClass: Record<Tier, string> = {
  Good: Styles.PctGood,
  Warn: Styles.PctWarn,
  Bad: Styles.PctBad,
}

const PresetList: [string, string][] = [
  ["classic", "ATS Classic"],
  ["compact", "Compact"],
  ["modern", "Modern"],
  ["custom", "Custom"],
]

type KnobOption = { Value: TemplateValue; Label: string; Swatch?: string }
type Knob = { Label: string; Key: TemplateKey; Options: KnobOption[] }

const Knobs: Knob[] = [
  {
    Label: "Layout",
    Key: "columns",
    Options: [
      { Value: 1, Label: "One column" },
      { Value: 2, Label: "Main + side" },
    ],
  },
  {
    Label: "Typeface",
    Key: "font",
    Options: [
      { Value: "sans", Label: "Sans" },
      { Value: "serif", Label: "Serif" },
    ],
  },
  {
    Label: "Accent",
    Key: "accent",
    Options: [
      { Value: "#111827", Label: "Ink", Swatch: "#111827" },
      { Value: "#1d4ed8", Label: "Cobalt", Swatch: "#1d4ed8" },
      { Value: "#0f766e", Label: "Teal", Swatch: "#0f766e" },
      { Value: "#9f1239", Label: "Wine", Swatch: "#9f1239" },
    ],
  },
  {
    Label: "Density",
    Key: "density",
    Options: [
      { Value: "compact", Label: "Compact" },
      { Value: "normal", Label: "Normal" },
      { Value: "airy", Label: "Airy" },
    ],
  },
  {
    Label: "Header",
    Key: "header_align",
    Options: [
      { Value: "left", Label: "Left" },
      { Value: "center", Label: "Centered" },
    ],
  },
  {
    Label: "Section titles",
    Key: "title_style",
    Options: [
      { Value: "underline", Label: "Underline" },
      { Value: "caps", Label: "Caps" },
      { Value: "bar", Label: "Bar" },
    ],
  },
]

const ContactFields = [
  { Name: "email", Hint: "you@example.com" },
  { Name: "phone", Hint: "+995 555 12 34 56" },
  { Name: "location", Hint: "Tbilisi, Georgia" },
] as const

function TagInput(Props: { Placeholder: string; OnAdd: (Value: string) => void }) {
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
      className={Styles.TagDraft}
      placeholder={Props.Placeholder}
      value={Draft}
      onChange={(Event) => SetDraft(Event.target.value)}
      onKeyDown={Commit}
    />
  )
}

function Stepper(Props: ResumeState) {
  return (
    <ol className={Styles.Stepper}>
      {Props.Steps.map((Step, Index) => (
        <li key={Step.Label}>
          <button
            className={Step.Current || Step.Done ? Styles.StepButtonActive : Styles.StepButton}
            onClick={() => Props.GoStep(Index)}
          >
            <span
              className={
                Step.Current ? Styles.StepNumCurrent : Step.Done ? Styles.StepNumDone : Styles.StepNum
              }
            >
              {Step.Number}
            </span>
            <span className={Styles.StepText}>
              <span className={Step.Current ? Styles.StepLabelCurrent : Styles.StepLabel}>
                {Step.Label}
              </span>
              <span className={Styles.StepHint}>{Step.Hint}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}

function WidgetEditor(Props: ResumeState & { Id: WidgetId }) {
  if (Props.Id === "summary") {
    return (
      <textarea
        className={Styles.TextArea}
        rows={5}
        value={Props.Draft.summary}
        onChange={(Event) => Props.SetSummary(Event.target.value)}
      />
    )
  }
  if (Props.Id === "skills") {
    return (
      <div className={Styles.Tags}>
        {Props.Draft.skills.map((Skill, Index) => (
          <span key={`${Skill}-${Index}`} className={Styles.Tag}>
            {Skill}
            <button className={Styles.TagRemove} onClick={() => Props.RemoveSkill(Index)}>
              ✕
            </button>
          </span>
        ))}
        <TagInput Placeholder="Type, press Enter" OnAdd={Props.AddSkill} />
      </div>
    )
  }
  const Id = Props.Id
  return (
    <div className={Styles.EntryList}>
      {Props.EntriesOf(Id).map((Entry, Index) => (
        <div key={Index} className={Styles.EntryRow}>
          <div className={Styles.EntryCells}>
            {EntryFields[Id].map((Cell) => (
              <input
                key={Cell.Key}
                className={Cell.Strong ? Styles.InputStrong : Styles.Input}
                placeholder={Cell.Placeholder}
                value={(Entry[Cell.Key] as string | undefined) ?? ""}
                onChange={(Event) => Props.SetEntryCell(Id, Index, Cell.Key, Event.target.value)}
              />
            ))}
          </div>
          {BulletWidgets.includes(Id) && (
            <textarea
              className={Styles.BulletsArea}
              rows={4}
              placeholder="One bullet per line"
              value={((Entry.bullets as string[] | undefined) ?? []).join("\n")}
              onChange={(Event) => Props.SetEntryBullets(Id, Index, Event.target.value)}
            />
          )}
          <button className={Styles.RemoveLink} onClick={() => Props.RemoveEntry(Id, Index)}>
            Remove
          </button>
        </div>
      ))}
      <button className={Styles.AddButton} onClick={() => Props.AddEntry(Id)}>
        + Add
      </button>
    </div>
  )
}

function WidgetsStep(Props: ResumeState) {
  return (
    <section>
      <div className={Styles.Intro}>
        <h1 className={Styles.Heading}>What goes on the resume?</h1>
        <p className={Styles.Sub}>
          Switch widgets on or off, open one to edit its content. Order and layout come later.
        </p>
      </div>
      <div className={Styles.WidgetGrid}>
        <div className={`${Styles.WidgetCard} ${Styles.WidgetCardWide}`}>
          <div className={Styles.WidgetHead}>
            <div className={Styles.WidgetInfo}>
              <div className={Styles.WidgetLabel}>Identity</div>
              <div className={Styles.WidgetMeta}>Name, headline and contact — always on the page</div>
            </div>
          </div>
          <div className={Styles.IdentityGrid}>
            <input
              className={Styles.InputStrong}
              placeholder="Full name"
              value={Props.Draft.full_name}
              onChange={(Event) => Props.SetIdentity("full_name", Event.target.value)}
            />
            <input
              className={Styles.Input}
              placeholder="Headline, e.g. Senior Backend Engineer"
              value={Props.Draft.title}
              onChange={(Event) => Props.SetIdentity("title", Event.target.value)}
            />
            {ContactFields.map((Field) => (
              <input
                key={Field.Name}
                className={Styles.Input}
                placeholder={Field.Hint}
                value={Props.Draft.contact[Field.Name] ?? ""}
                onChange={(Event) => Props.SetContact(Field.Name, Event.target.value)}
              />
            ))}
          </div>
        </div>
        {Props.Draft.widgets.map((Widget) => {
          const Open = Props.Editing === Widget.id
          return (
            <div
              key={Widget.id}
              className={[
                Styles.WidgetCard,
                Open ? Styles.WidgetCardOpen : "",
                Open ? Styles.WidgetCardWide : "",
                Widget.on ? "" : Styles.WidgetCardOff,
              ].join(" ")}
            >
              <div className={Styles.WidgetHead}>
                <button
                  className={Widget.on ? Styles.SwitchOn : Styles.Switch}
                  title="Toggle widget"
                  onClick={() => Props.ToggleWidget(Widget.id)}
                >
                  <span className={Styles.SwitchKnob}></span>
                </button>
                <div className={Styles.WidgetInfo}>
                  <div className={Styles.WidgetLabel}>{WidgetLabels[Widget.id]}</div>
                  <div className={Styles.WidgetMeta}>{Props.WidgetMeta(Widget.id)}</div>
                </div>
                <button
                  className={Open ? Styles.EditButtonActive : Styles.EditButton}
                  onClick={() => Props.OpenEditor(Widget.id)}
                >
                  {Open ? "Done" : "Edit"}
                </button>
              </div>
              {Open && (
                <div className={Styles.WidgetBody}>
                  <WidgetEditor {...Props} Id={Widget.id} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CoverageStep(Props: ResumeState) {
  const Selected = Props.Selected
  return (
    <section>
      <div className={Styles.Intro}>
        <h1 className={Styles.Heading}>Tailor for a vacancy</h1>
        <p className={Styles.Sub}>
          Optional. Pick a match to see how well your widgets cover its requirements.
        </p>
      </div>
      <div className={Styles.CoverageGrid}>
        <div className={Styles.VacancyList}>
          <button
            className={Props.VacancyId === "" ? Styles.VacancyCardSelected : Styles.VacancyCard}
            onClick={Props.ClearVacancy}
          >
            <span className={Props.VacancyId === "" ? Styles.RadioOn : Styles.Radio}></span>
            <span className={Styles.VacancyText}>
              <span className={Styles.VacancyTitle}>No vacancy</span>
              <span className={Styles.VacancySub}>Generic resume from the master profile</span>
            </span>
          </button>
          {Props.VacancyCards.map((Card) => {
            const On = Card.Id === Props.VacancyId
            return (
              <button
                key={Card.Id}
                className={On ? Styles.VacancyCardSelected : Styles.VacancyCard}
                onClick={() => Props.SelectVacancy(Card.Id)}
              >
                <span className={On ? Styles.RadioOn : Styles.Radio}></span>
                <span className={Styles.VacancyText}>
                  <span className={Styles.VacancyTitle}>{Card.Title}</span>
                  <span className={Styles.VacancySub}>
                    {Card.Company} · {Card.Location}
                  </span>
                </span>
                <span className={`${Styles.Pct} ${PctClass[Card.Tier]}`}>{Card.Pct}%</span>
              </button>
            )
          })}
          {Props.VacancyCards.length === 0 && (
            <p className={Styles.Hint}>No matches yet — run a search profile first.</p>
          )}
        </div>
        {Selected ? (
          <div className={Styles.CoveragePanel}>
            <div className={Styles.RingRow}>
              <div
                className={Styles.Ring}
                style={{
                  background: `conic-gradient(${TierColor[Selected.Tier]} ${Selected.Pct}%, var(--Surface2) 0)`,
                }}
              >
                <div className={Styles.RingInner} style={{ color: TierColor[Selected.Tier] }}>
                  {Selected.Pct}%
                </div>
              </div>
              <div>
                <div className={Styles.SectionLabel}>Coverage</div>
                <div className={Styles.CoverageTitle}>
                  {Selected.Title} · {Selected.Company}
                </div>
                <div className={Styles.CoverageSub}>
                  {Selected.Matched.length} of {Selected.Required.length} required skills found in
                  your widgets
                </div>
              </div>
            </div>
            <div className={Styles.SkillCols}>
              <div>
                <div className={`${Styles.SkillHeading} ${Styles.SkillHeadingGood}`}>
                  <span className={Styles.Dot}></span>Matched
                </div>
                <div className={Styles.Chips}>
                  {Selected.Matched.map((Skill) => (
                    <span key={Skill} className={Styles.ChipGood}>
                      {Skill}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className={`${Styles.SkillHeading} ${Styles.SkillHeadingBad}`}>
                  <span className={Styles.Dot}></span>Missing
                </div>
                <div className={Styles.Chips}>
                  {Selected.Missing.map((Skill) => (
                    <button
                      key={Skill}
                      className={Styles.MissingButton}
                      title="Add to Skills widget"
                      onClick={() => Props.AddMissingSkill(Skill)}
                    >
                      {Skill}
                      <span className={Styles.MissingPlus}>+</span>
                    </button>
                  ))}
                </div>
                <div className={Styles.Hint}>
                  Click a missing skill to add it to Skills — only if you actually have it.
                </div>
              </div>
            </div>
            <div className={Styles.Options}>
              <label className={Styles.Option}>
                <input
                  className={Styles.Checkbox}
                  type="checkbox"
                  checked={Props.RewriteSummary}
                  onChange={Props.ToggleRewrite}
                />
                <span>
                  <span className={Styles.OptionTitle}>Rewrite summary for this role</span>
                  <span className={Styles.OptionSub}>
                    Leads with the vacancy title and your matched skills
                  </span>
                </span>
              </label>
              <label className={Styles.Option}>
                <input
                  className={Styles.Checkbox}
                  type="checkbox"
                  checked={Props.ReorderSkills}
                  onChange={Props.ToggleReorder}
                />
                <span>
                  <span className={Styles.OptionTitle}>Put matched skills first</span>
                  <span className={Styles.OptionSub}>Skills widget is reordered by relevance</span>
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div className={Styles.Placeholder}>
            Pick a vacancy to see coverage, or continue with a generic resume.
          </div>
        )}
      </div>
    </section>
  )
}

function PresetThumb(Props: { Id: string }) {
  const Values = Presets[Props.Id]
  const Accent = Values ? Values.accent : "#94a3b8"
  const TwoColumns = Values?.columns === 2
  return (
    <span className={Styles.Thumb}>
      <span className={Styles.ThumbTitle} style={{ background: Accent }}></span>
      <span className={Styles.ThumbLine}></span>
      <span className={Styles.ThumbBody}>
        <span className={Styles.ThumbMain} style={{ flex: TwoColumns ? 1.9 : 1 }}>
          <span className={Styles.ThumbHead} style={{ background: Accent }}></span>
          <span className={Styles.ThumbLine}></span>
          <span className={Styles.ThumbLine}></span>
          <span className={Styles.ThumbLineShort}></span>
          <span className={`${Styles.ThumbHead} ${Styles.ThumbHeadGap}`} style={{ background: Accent }}></span>
          <span className={Styles.ThumbLine}></span>
          <span className={Styles.ThumbLineShort}></span>
        </span>
        {TwoColumns && (
          <span className={Styles.ThumbSide}>
            <span className={Styles.ThumbHead} style={{ background: Accent }}></span>
            <span className={Styles.ThumbLine}></span>
            <span className={Styles.ThumbLine}></span>
          </span>
        )}
      </span>
    </span>
  )
}

function TemplateStep(Props: ResumeState) {
  const TwoColumns = Props.Template.columns === 2
  return (
    <section>
      <div className={Styles.Intro}>
        <h1 className={Styles.Heading}>Design the template</h1>
        <p className={Styles.Sub}>
          Start from a preset or assemble your own. Every change shows on the page.
        </p>
      </div>
      <div className={Styles.DesignGrid}>
        <div className={Styles.DesignLeft}>
          <div className={Styles.Presets}>
            {PresetList.map(([Id, Label]) => {
              const On = Props.Template.preset === Id
              return (
                <button
                  key={Id}
                  className={On ? Styles.PresetButtonActive : Styles.PresetButton}
                  onClick={() => Props.PickPreset(Id)}
                >
                  <PresetThumb Id={Id} />
                  <span className={On ? Styles.PresetLabelActive : Styles.PresetLabel}>{Label}</span>
                </button>
              )
            })}
          </div>
          <div className={Styles.Assembler}>
            <div>
              <div className={Styles.AssemblerHead}>
                <h2 className={Styles.SectionLabel}>Sections</h2>
                <span className={Styles.Hint}>Order, column, visibility</span>
              </div>
              <div className={Styles.Sections}>
                {Props.Draft.widgets.map((Widget, Index) => (
                  <div
                    key={Widget.id}
                    className={Widget.on ? Styles.SectionRow : Styles.SectionRowOff}
                  >
                    <span className={Styles.SectionNum}>{Index + 1}</span>
                    <span className={Styles.SectionName}>{WidgetLabels[Widget.id]}</span>
                    {TwoColumns && (
                      <button
                        className={Styles.ColButton}
                        title="Move to other column"
                        onClick={() => Props.FlipWidgetSide(Index)}
                      >
                        {Widget.side ? "SIDE" : "MAIN"}
                      </button>
                    )}
                    <button
                      className={Styles.ArrowButton}
                      title="Move up"
                      onClick={() => Props.MoveWidget(Index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      className={Styles.ArrowButton}
                      title="Move down"
                      onClick={() => Props.MoveWidget(Index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      className={Widget.on ? Styles.EyeButtonOn : Styles.EyeButton}
                      title="Show / hide"
                      onClick={() => Props.ToggleWidgetVisible(Index)}
                    >
                      {Widget.on ? "●" : "○"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className={Styles.Knobs}>
              {Knobs.map((Knob) => (
                <div key={Knob.Key}>
                  <div className={Styles.KnobLabel}>{Knob.Label}</div>
                  <div className={Styles.Segment}>
                    {Knob.Options.map((Option) => {
                      const On = Props.Template[Knob.Key] === Option.Value
                      return (
                        <button
                          key={String(Option.Value)}
                          className={On ? Styles.SegmentActive : Styles.SegmentButton}
                          title={Option.Label}
                          onClick={() => Props.SetTemplate(Knob.Key, Option.Value)}
                        >
                          {Option.Swatch && (
                            <span className={Styles.Swatch} style={{ background: Option.Swatch }}></span>
                          )}
                          {Option.Label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={Styles.PageWrap}>
          <PageTemplate Profile={Props.Draft} Headline={Props.Headline} MaxWidth="560px" />
        </div>
      </div>
    </section>
  )
}

function PdfStep(Props: ResumeState) {
  return (
    <section>
      <div className={Styles.PdfHead}>
        <div>
          <h1 className={Styles.Heading}>Your PDF</h1>
          <p className={Styles.Sub}>{Props.PdfMeta}</p>
        </div>
        <div className={Styles.PdfActions}>
          <span className={Props.AtsSafe ? Styles.AtsGood : Styles.AtsWarn}>
            <span className={Styles.Dot}></span>
            {Props.AtsSafe ? "ATS-safe layout" : "Two columns — some ATS parsers may misread"}
          </span>
          <button
            className={Styles.SecondaryButton}
            onClick={Props.Regenerate}
            disabled={Props.Generating}
          >
            ↻ Regenerate
          </button>
          <button
            className={Styles.PrimaryButton}
            onClick={Props.DownloadPdf}
            disabled={Props.Generating || Props.PreviewUrl === ""}
          >
            ↓ Download PDF
          </button>
        </div>
      </div>
      {Props.GenerateError !== "" && <p className={Styles.ErrorText}>{Props.GenerateError}</p>}
      <div className={Styles.PdfWrap}>
        {Props.Generating || Props.PreviewUrl === "" ? (
          <div className={Styles.PdfPending}>
            <div className={Styles.Spinner}></div>
            <div className={Styles.PdfPendingText}>
              {Props.Generating ? "Rendering your PDF…" : "Regenerate to render the PDF."}
            </div>
          </div>
        ) : (
          <img className={Styles.PreviewImage} src={Props.PreviewUrl} alt="Your resume, first page" />
        )}
      </div>
    </section>
  )
}

export function ResumeTemplate(Props: ResumeState) {
  return (
    <div className={Styles.Wizard}>
      <Stepper {...Props} />
      {Props.Step === 0 && <WidgetsStep {...Props} />}
      {Props.Step === 1 && <CoverageStep {...Props} />}
      {Props.Step === 2 && <TemplateStep {...Props} />}
      {Props.Step === 3 && <PdfStep {...Props} />}
      <div className={Styles.Footer}>
        <div className={Styles.FooterInner}>
          <button className={Styles.BackButton} onClick={Props.Back} disabled={Props.AtStart}>
            ← Back
          </button>
          <span className={Styles.FootNote}>
            {Props.Footnote}
            {Props.SaveStatus !== "" && ` · ${Props.SaveStatus}`}
          </span>
          <button className={Styles.NextButton} onClick={Props.Next}>
            {Props.NextLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
