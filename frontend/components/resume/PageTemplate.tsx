import type { CSSProperties } from "react"
import type { MasterProfile, WidgetId } from "../../library/ts/Api"
import { WidgetLabels } from "./Resume"

export type PageProps = {
  Profile: MasterProfile
  Headline: string
  MaxWidth: string
}

type Block = {
  Title: string
  Kind: "text" | "entries"
  Text?: string
  Entries?: { Head: string; Sub: string; Right: string; Bullets: string[] }[]
}

const Densities = {
  compact: { Size: "clamp(6px, 1.55cqw, 10px)", Line: "1.32", Gap: "1.3em", EntryGap: "0.7em" },
  normal: { Size: "clamp(6px, 1.6cqw, 10.5px)", Line: "1.42", Gap: "1.9em", EntryGap: "1em" },
  airy: { Size: "clamp(6px, 1.6cqw, 10.5px)", Line: "1.55", Gap: "2.6em", EntryGap: "1.4em" },
} as const

function BlockOf(Profile: MasterProfile, Id: WidgetId): Block {
  const Title = WidgetLabels[Id]
  switch (Id) {
    case "summary":
      return { Title, Kind: "text", Text: Profile.summary }
    case "skills":
      return { Title, Kind: "text", Text: Profile.skills.join(", ") }
    case "languages":
      return {
        Title,
        Kind: "text",
        Text: Profile.languages
          .map((Item) => Item.language + (Item.level ? ` (${Item.level})` : ""))
          .join(", "),
      }
    case "experience":
      return {
        Title,
        Kind: "entries",
        Entries: Profile.experience.map((Role) => ({
          Head: Role.role,
          Sub: Role.company ? ` — ${Role.company}` : "",
          Right: Role.dates,
          Bullets: Role.bullets.filter((Line) => Line.trim() !== ""),
        })),
      }
    case "education":
      return {
        Title,
        Kind: "entries",
        Entries: Profile.education.map((Item) => ({
          Head: Item.institution,
          Sub: Item.degree ? ` — ${Item.degree}` : "",
          Right: Item.year,
          Bullets: [],
        })),
      }
    case "certifications":
      return {
        Title,
        Kind: "entries",
        Entries: Profile.certifications.map((Item) => ({
          Head: Item.name,
          Sub: "",
          Right: Item.year,
          Bullets: [],
        })),
      }
    case "projects":
      return {
        Title,
        Kind: "entries",
        Entries: Profile.projects.map((Project) => ({
          Head: Project.name,
          Sub: Project.summary ? ` — ${Project.summary}` : "",
          Right: Project.year,
          Bullets: Project.bullets.filter((Line) => Line.trim() !== ""),
        })),
      }
  }
}

export function PageTemplate(Props: PageProps) {
  const Settings = Props.Profile.template
  const Density = Densities[Settings.density]
  const TitleStyle = Settings.title_style
  const Font =
    Settings.font === "serif"
      ? "'Noto Serif', Georgia, serif"
      : "'Noto Sans', 'DejaVu Sans', Arial, sans-serif"
  const HeaderStyle: CSSProperties = {
    textAlign: Settings.header_align,
    borderBottom:
      TitleStyle === "bar" ? "none" : `1px solid ${TitleStyle === "caps" ? "#e5e7eb" : "#111827"}`,
    paddingBottom: TitleStyle === "bar" ? 0 : "1em",
  }
  const H2Style: CSSProperties = {
    fontSize: "0.85em",
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: TitleStyle === "caps" ? "#6b7280" : Settings.accent,
    borderBottom: TitleStyle === "underline" ? `1px solid ${Settings.accent}` : "none",
    borderLeft: TitleStyle === "bar" ? `3px solid ${Settings.accent}` : "none",
    padding: TitleStyle === "bar" ? "0 0 0 0.7em" : TitleStyle === "underline" ? "0 0 0.3em" : 0,
    marginBottom: "0.7em",
  }
  const Visible = Props.Profile.widgets.filter((Widget) => Widget.on)
  const Columns =
    Settings.columns === 2
      ? [
          { Flex: "1.9", Blocks: Visible.filter((Widget) => !Widget.side) },
          { Flex: "1", Blocks: Visible.filter((Widget) => Widget.side) },
        ]
      : [{ Flex: "1", Blocks: Visible }]
  const Contact = [
    Props.Profile.contact.email,
    Props.Profile.contact.phone,
    Props.Profile.contact.location,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <div style={{ width: "100%", maxWidth: Props.MaxWidth, containerType: "inline-size" }}>
      <div
        style={{
          background: "#fff",
          color: "#111827",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.28)",
          aspectRatio: "210 / 297",
          boxSizing: "border-box",
          padding: "8.5% 8.5% 9%",
          fontFamily: Font,
          fontSize: Density.Size,
          lineHeight: Density.Line,
          display: "flex",
          flexDirection: "column",
          gap: Density.Gap,
          overflow: "hidden",
        }}
      >
        <div style={HeaderStyle}>
          <div
            style={{
              fontSize: "2.1em",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              color: Settings.accent,
            }}
          >
            {Props.Profile.full_name || "Your name"}
          </div>
          {Props.Headline !== "" && (
            <div style={{ color: "#374151", fontSize: "1.1em", marginTop: "0.2em" }}>
              {Props.Headline}
            </div>
          )}
          {Contact !== "" && (
            <div style={{ color: "#374151", fontSize: "0.9em", marginTop: "0.6em" }}>{Contact}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: "2.4em", flex: 1 }}>
          {Columns.map((Column, ColumnIndex) => (
            <div
              key={ColumnIndex}
              style={{
                flex: Column.Flex,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: Density.Gap,
              }}
            >
              {Column.Blocks.map((Widget) => {
                const Block = BlockOf(Props.Profile, Widget.id)
                return (
                  <div key={Widget.id}>
                    <div style={H2Style}>{Block.Title}</div>
                    {Block.Kind === "text" ? (
                      <div style={{ lineHeight: 1.6 }}>{Block.Text}</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: Density.EntryGap }}>
                        {Block.Entries?.map((Entry, EntryIndex) => (
                          <div key={EntryIndex}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "1em",
                                alignItems: "baseline",
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>
                                {Entry.Head}
                                <span style={{ fontWeight: 400, color: "#374151" }}>{Entry.Sub}</span>
                              </span>
                              <span style={{ color: "#4b5563", fontSize: "0.92em", whiteSpace: "nowrap" }}>
                                {Entry.Right}
                              </span>
                            </div>
                            {Entry.Bullets.map((Line, LineIndex) => (
                              <div
                                key={LineIndex}
                                style={{ paddingLeft: "1.2em", position: "relative", marginTop: "0.25em" }}
                              >
                                <span style={{ position: "absolute", left: 0, color: "#4b5563" }}>–</span>
                                {Line}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
