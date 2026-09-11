import { useMutation, useQuery } from "@tanstack/react-query"
import { createElement, useEffect, useState } from "react"
import {
  ApiFetch,
  FetchMasterProfile,
  FetchResumePdf,
  FetchResumePreview,
  SaveMasterProfile,
  TailorResume,
  type MasterProfile,
  type ProfileFields,
  type ResumeWidget,
  type SearchResult,
  type TailoredResume,
  type TemplateSettings,
  type WidgetId,
} from "../../library/ts/Api"
import { ResumeTemplate } from "./ResumeTemplate"

export type ResumeProps = {
  InitialVacancy: string
}

export type Tier = "Good" | "Warn" | "Bad"
export type EntryWidgetId = "experience" | "education" | "languages" | "certifications" | "projects"
export type Entry = Record<string, string | string[] | undefined>
export type Cell = { Key: string; Placeholder: string; Strong: boolean }
export type TemplateKey = Exclude<keyof TemplateSettings, "preset">
export type TemplateValue = TemplateSettings[TemplateKey]
export type IdentityField = "full_name" | "title"

export type StepInfo = {
  Number: number
  Label: string
  Hint: string
  Current: boolean
  Done: boolean
}

export type VacancyCard = {
  Id: string
  Title: string
  Company: string
  Location: string
  Required: string[]
  Matched: string[]
  Missing: string[]
  Pct: number
  Tier: Tier
}

export type ResumeState = {
  Step: number
  Steps: StepInfo[]
  GoStep: (Step: number) => void
  Back: () => void
  Next: () => void
  NextLabel: string
  Footnote: string
  AtStart: boolean
  Draft: MasterProfile
  Dirty: boolean
  SaveStatus: string
  SetIdentity: (Name: IdentityField, Value: string) => void
  SetContact: (Name: string, Value: string) => void
  Editing: WidgetId | null
  OpenEditor: (Id: WidgetId) => void
  WidgetMeta: (Id: WidgetId) => string
  ToggleWidget: (Id: WidgetId) => void
  SetSummary: (Value: string) => void
  AddSkill: (Skill: string) => void
  RemoveSkill: (Index: number) => void
  EntriesOf: (Id: EntryWidgetId) => Entry[]
  AddEntry: (Id: EntryWidgetId) => void
  RemoveEntry: (Id: EntryWidgetId, Index: number) => void
  SetEntryCell: (Id: EntryWidgetId, Index: number, Key: string, Value: string) => void
  SetEntryBullets: (Id: EntryWidgetId, Index: number, Text: string) => void
  VacancyCards: VacancyCard[]
  VacancyId: string
  Selected: VacancyCard | null
  SelectVacancy: (Id: string) => void
  ClearVacancy: () => void
  AddMissingSkill: (Skill: string) => void
  RewriteSummary: boolean
  ToggleRewrite: () => void
  ReorderSkills: boolean
  ToggleReorder: () => void
  Template: TemplateSettings
  PickPreset: (Id: string) => void
  SetTemplate: (Key: TemplateKey, Value: TemplateValue) => void
  MoveWidget: (Index: number, Delta: number) => void
  FlipWidgetSide: (Index: number) => void
  ToggleWidgetVisible: (Index: number) => void
  Headline: string
  Generating: boolean
  GenerateError: string
  PreviewUrl: string
  Regenerate: () => void
  DownloadPdf: () => void
  PdfMeta: string
  AtsSafe: boolean
}

export const WidgetLabels: Record<WidgetId, string> = {
  summary: "Summary",
  experience: "Experience",
  skills: "Skills",
  education: "Education",
  languages: "Languages",
  certifications: "Certifications",
  projects: "Projects",
}

export const EntryFields: Record<EntryWidgetId, Cell[]> = {
  experience: [
    { Key: "role", Placeholder: "Role", Strong: true },
    { Key: "company", Placeholder: "Company", Strong: false },
    { Key: "dates", Placeholder: "Dates", Strong: false },
  ],
  education: [
    { Key: "institution", Placeholder: "Institution", Strong: true },
    { Key: "degree", Placeholder: "Degree", Strong: false },
    { Key: "year", Placeholder: "Year", Strong: false },
  ],
  languages: [
    { Key: "language", Placeholder: "Language", Strong: true },
    { Key: "level", Placeholder: "Level", Strong: false },
  ],
  certifications: [
    { Key: "name", Placeholder: "Certification", Strong: true },
    { Key: "year", Placeholder: "Year", Strong: false },
  ],
  projects: [
    { Key: "name", Placeholder: "Project", Strong: true },
    { Key: "summary", Placeholder: "One-liner", Strong: false },
    { Key: "year", Placeholder: "Year", Strong: false },
  ],
}

export const BulletWidgets: EntryWidgetId[] = ["experience", "projects"]

export const DefaultWidgets: ResumeWidget[] = [
  { id: "summary", on: true, side: false },
  { id: "experience", on: true, side: false },
  { id: "skills", on: true, side: true },
  { id: "education", on: true, side: true },
  { id: "languages", on: true, side: true },
  { id: "certifications", on: false, side: true },
  { id: "projects", on: false, side: false },
]

export const Presets: Record<string, Omit<TemplateSettings, "preset">> = {
  classic: {
    columns: 1,
    font: "sans",
    accent: "#111827",
    density: "normal",
    header_align: "left",
    title_style: "underline",
  },
  compact: {
    columns: 1,
    font: "sans",
    accent: "#111827",
    density: "compact",
    header_align: "left",
    title_style: "caps",
  },
  modern: {
    columns: 2,
    font: "serif",
    accent: "#1d4ed8",
    density: "normal",
    header_align: "left",
    title_style: "bar",
  },
}

export const DefaultTemplate: TemplateSettings = { preset: "classic", ...Presets.classic }

export const EmptyMasterProfile: MasterProfile = {
  full_name: "",
  title: "",
  contact: {},
  summary: "",
  experience: [],
  skills: [],
  education: [],
  languages: [],
  certifications: [],
  projects: [],
  widgets: DefaultWidgets,
  template: DefaultTemplate,
}

const StepNames: [string, string][] = [
  ["Widgets", "Pick and edit content"],
  ["Coverage", "Tailor for a vacancy"],
  ["Template", "Presets or custom"],
  ["PDF", "Preview and download"],
]

const GenericVacancyId = "generic"
const NoProfileDetail = "no master profile"

type LegacyRole = {
  role?: string
  company?: string
  dates?: string
  start?: string
  end?: string
  bullets?: (string | { text?: string })[]
}

function MergeWidgets(Stored: ResumeWidget[] | undefined): ResumeWidget[] {
  const Known = new Map(DefaultWidgets.map((Widget) => [Widget.id, Widget]))
  const Ordered = (Stored ?? [])
    .filter((Widget) => Known.has(Widget.id))
    .map((Widget) => ({
      id: Widget.id,
      on: Widget.on ?? Known.get(Widget.id)!.on,
      side: Widget.side ?? Known.get(Widget.id)!.side,
    }))
  const Seen = new Set(Ordered.map((Widget) => Widget.id))
  return [...Ordered, ...DefaultWidgets.filter((Widget) => !Seen.has(Widget.id))]
}

function Normalize(Profile: MasterProfile): MasterProfile {
  const Experience = ((Profile.experience ?? []) as LegacyRole[]).map((Role) => ({
    role: Role.role ?? "",
    company: Role.company ?? "",
    dates:
      Role.dates ||
      [Role.start, Role.end || (Role.start ? "Present" : "")].filter(Boolean).join(" – "),
    bullets: (Role.bullets ?? []).map((Bullet) =>
      typeof Bullet === "string" ? Bullet : (Bullet.text ?? ""),
    ),
  }))
  return {
    ...EmptyMasterProfile,
    ...Profile,
    contact: Profile.contact ?? {},
    experience: Experience,
    skills: Profile.skills ?? [],
    education: Profile.education ?? [],
    languages: Profile.languages ?? [],
    certifications: Profile.certifications ?? [],
    projects: (Profile.projects ?? []).map((Project) => ({
      ...Project,
      bullets: Project.bullets ?? [],
    })),
    widgets: MergeWidgets(Profile.widgets),
    template: { ...DefaultTemplate, ...(Profile.template ?? {}) },
  }
}

function Clean(Profile: MasterProfile): MasterProfile {
  const NonBlank = (Lines: string[]) => Lines.filter((Line) => Line.trim() !== "")
  return {
    ...Profile,
    skills: NonBlank(Profile.skills),
    experience: Profile.experience.map((Role) => ({ ...Role, bullets: NonBlank(Role.bullets) })),
    projects: Profile.projects.map((Project) => ({
      ...Project,
      bullets: NonBlank(Project.bullets),
    })),
  }
}

export function TierOf(Pct: number): Tier {
  if (Pct >= 67) {
    return "Good"
  }
  if (Pct >= 34) {
    return "Warn"
  }
  return "Bad"
}

export function HasSkill(Profile: MasterProfile): (Skill: string) => boolean {
  const Text = [
    Profile.summary,
    ...Profile.experience.flatMap((Role) => Role.bullets),
    ...Profile.projects.flatMap((Project) => [Project.summary, ...Project.bullets]),
    ...Profile.certifications.map((Item) => Item.name),
  ]
    .join(" ")
    .toLowerCase()
  const Owned = new Set(Profile.skills.map((Skill) => Skill.toLowerCase()))
  return (Skill) => Owned.has(Skill.toLowerCase()) || Text.includes(Skill.toLowerCase())
}

function ErrorText(Caught: unknown): string {
  return Caught instanceof Error ? Caught.message : String(Caught)
}

function UseResumeState(Props: ResumeProps): ResumeState {
  const [Step, SetStep] = useState(0)
  const [Editing, SetEditing] = useState<WidgetId | null>(null)
  const [Draft, SetDraft] = useState<MasterProfile>(EmptyMasterProfile)
  const [Loaded, SetLoaded] = useState(false)
  const [Dirty, SetDirty] = useState(false)
  const [SaveStatus, SetSaveStatus] = useState("")
  const [VacancyId, SetVacancyId] = useState("")
  const [RewriteSummary, SetRewriteSummary] = useState(true)
  const [ReorderSkills, SetReorderSkills] = useState(true)
  const [Generated, SetGenerated] = useState<TailoredResume | null>(null)
  const [GenerateError, SetGenerateError] = useState("")
  const [PreviewUrl, SetPreviewUrl] = useState("")

  const ProfileQuery = useQuery({
    queryKey: ["master-profile"],
    queryFn: () =>
      FetchMasterProfile()
        .then((Reply) => Reply.profile)
        .catch((Caught: unknown) => {
          if (Caught instanceof Error && Caught.message === NoProfileDetail) {
            return EmptyMasterProfile
          }
          throw Caught
        }),
    retry: false,
  })
  useEffect(() => {
    if (ProfileQuery.data && !Loaded) {
      SetDraft(Normalize(ProfileQuery.data))
      SetLoaded(true)
    }
  }, [ProfileQuery.data, Loaded])

  const ProfilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => ApiFetch<{ profiles: Record<string, ProfileFields> }>("/api/profiles"),
  })
  const FirstProfile = Object.keys(ProfilesQuery.data?.profiles ?? {})[0] ?? ""
  const SearchQuery = useQuery({
    queryKey: ["search", FirstProfile],
    queryFn: () => ApiFetch<{ results: SearchResult[] }>(`/api/search/${FirstProfile}`),
    enabled: FirstProfile !== "",
    retry: false,
  })

  useEffect(() => {
    if (Props.InitialVacancy !== "") {
      SetVacancyId(Props.InitialVacancy)
      SetStep(1)
    }
  }, [Props.InitialVacancy])

  const Update = (Mutate: (Next: MasterProfile) => void) => {
    SetDraft((Current) => {
      const Next = structuredClone(Current)
      Mutate(Next)
      return Next
    })
    SetDirty(true)
    SetSaveStatus("")
  }
  const UpdateTemplate = (Mutate: (Next: MasterProfile) => void) =>
    Update((Next) => {
      Mutate(Next)
      Next.template.preset = "custom"
    })

  const Save = useMutation({
    mutationFn: () => SaveMasterProfile(Clean(Draft)),
    onSuccess: () => {
      SetDirty(false)
      SetSaveStatus("Saved")
    },
    onError: (Caught) => SetSaveStatus(ErrorText(Caught)),
  })

  const Generate = useMutation({
    mutationFn: async () => {
      if (Dirty) {
        await SaveMasterProfile(Clean(Draft))
        SetDirty(false)
        SetSaveStatus("Saved")
      }
      return TailorResume(VacancyId || GenericVacancyId, {
        rewrite_summary: RewriteSummary,
        reorder_skills: ReorderSkills,
      })
    },
    onSuccess: async (Reply) => {
      SetGenerated(Reply)
      SetGenerateError("")
      const Preview = await FetchResumePreview(VacancyId || GenericVacancyId)
      SetPreviewUrl((Old) => {
        if (Old) {
          URL.revokeObjectURL(Old)
        }
        return URL.createObjectURL(Preview)
      })
    },
    onError: (Caught) => SetGenerateError(ErrorText(Caught)),
  })
  const GenerateMutate = Generate.mutate

  const DownloadPdf = async () => {
    try {
      const Pdf = await FetchResumePdf(VacancyId || GenericVacancyId)
      const Url = URL.createObjectURL(Pdf)
      const Anchor = document.createElement("a")
      Anchor.href = Url
      Anchor.download = `resume-${VacancyId || GenericVacancyId}.pdf`
      Anchor.click()
      URL.revokeObjectURL(Url)
    } catch (Caught) {
      SetGenerateError(ErrorText(Caught))
    }
  }

  const GoStep = (Target: number) => {
    const Clamped = Math.max(0, Math.min(3, Target))
    if (Clamped === Step) {
      return
    }
    SetEditing(null)
    SetStep(Clamped)
    if (Clamped === 3) {
      SetGenerated(null)
      GenerateMutate()
    } else if (Dirty) {
      Save.mutate()
    }
  }

  const Has = HasSkill(Draft)
  const VacancyCards: VacancyCard[] = (SearchQuery.data?.results ?? []).map((Row) => {
    const Required = Row.skills ?? []
    const Matched = Required.filter(Has)
    const Missing = Required.filter((Skill) => !Has(Skill))
    const Pct = Required.length > 0 ? Math.round((Matched.length / Required.length) * 100) : 0
    return {
      Id: Row.fingerprint,
      Title: Row.title,
      Company: Row.company,
      Location: Row.location,
      Required,
      Matched,
      Missing,
      Pct,
      Tier: TierOf(Pct),
    }
  })
  const Selected = VacancyCards.find((Card) => Card.Id === VacancyId) ?? null
  const OnWidgets = Draft.widgets.filter((Widget) => Widget.on)
  const Preset = Draft.template.preset

  const WidgetMeta = (Id: WidgetId): string => {
    if (Id === "summary") {
      return `${Draft.summary.length} chars`
    }
    if (Id === "skills") {
      return `${Draft.skills.length} skills`
    }
    const Count = Draft[Id].length
    if (Id === "experience") {
      const Bullets = Draft.experience.reduce(
        (Total, Role) => Total + Role.bullets.filter((Line) => Line.trim() !== "").length,
        0,
      )
      return `${Count} ${Count === 1 ? "role" : "roles"} · ${Bullets} bullets`
    }
    return `${Count} ${Count === 1 ? "entry" : "entries"}`
  }

  const EntriesOf = (Id: EntryWidgetId): Entry[] => Draft[Id] as unknown as Entry[]

  return {
    Step,
    Steps: StepNames.map(([Label, Hint], Index) => ({
      Number: Index + 1,
      Label,
      Hint,
      Current: Index === Step,
      Done: Index < Step,
    })),
    GoStep,
    Back: () => GoStep(Step - 1),
    Next: () => {
      if (Step === 3) {
        void DownloadPdf()
      } else {
        GoStep(Step + 1)
      }
    },
    NextLabel: Step === 3 ? "↓ Download PDF" : "Continue →",
    Footnote: `Step ${Step + 1} of 4 · ${OnWidgets.length} widgets · ${
      Selected ? `${Selected.Pct}% coverage` : "no vacancy"
    } · ${Preset} template`,
    AtStart: Step === 0,
    Draft,
    Dirty,
    SaveStatus: Save.isPending ? "Saving…" : SaveStatus,
    SetIdentity: (Name, Value) =>
      Update((Next) => {
        Next[Name] = Value
      }),
    SetContact: (Name, Value) =>
      Update((Next) => {
        Next.contact[Name] = Value
      }),
    Editing,
    OpenEditor: (Id) => SetEditing((Current) => (Current === Id ? null : Id)),
    WidgetMeta,
    ToggleWidget: (Id) =>
      Update((Next) => {
        const Widget = Next.widgets.find((Item) => Item.id === Id)
        if (Widget) {
          Widget.on = !Widget.on
        }
      }),
    SetSummary: (Value) =>
      Update((Next) => {
        Next.summary = Value
      }),
    AddSkill: (Skill) =>
      Update((Next) => {
        if (!Next.skills.includes(Skill)) {
          Next.skills.push(Skill)
        }
      }),
    RemoveSkill: (Index) =>
      Update((Next) => {
        Next.skills.splice(Index, 1)
      }),
    EntriesOf,
    AddEntry: (Id) =>
      Update((Next) => {
        const Blank: Entry = {}
        for (const Field of EntryFields[Id]) {
          Blank[Field.Key] = ""
        }
        if (BulletWidgets.includes(Id)) {
          Blank.bullets = []
        }
        ;(Next[Id] as unknown as Entry[]).push(Blank)
      }),
    RemoveEntry: (Id, Index) =>
      Update((Next) => {
        ;(Next[Id] as unknown as Entry[]).splice(Index, 1)
      }),
    SetEntryCell: (Id, Index, Key, Value) =>
      Update((Next) => {
        ;(Next[Id] as unknown as Entry[])[Index][Key] = Value
      }),
    SetEntryBullets: (Id, Index, Text) =>
      Update((Next) => {
        ;(Next[Id] as unknown as Entry[])[Index].bullets = Text.split("\n")
      }),
    VacancyCards,
    VacancyId,
    Selected,
    SelectVacancy: SetVacancyId,
    ClearVacancy: () => SetVacancyId(""),
    AddMissingSkill: (Skill) =>
      Update((Next) => {
        if (!Next.skills.some((Item) => Item.toLowerCase() === Skill.toLowerCase())) {
          Next.skills.push(Skill)
        }
      }),
    RewriteSummary,
    ToggleRewrite: () => SetRewriteSummary((Value) => !Value),
    ReorderSkills,
    ToggleReorder: () => SetReorderSkills((Value) => !Value),
    Template: Draft.template,
    PickPreset: (Id) =>
      Update((Next) => {
        const Values = Presets[Id]
        if (Values) {
          Next.template = { ...Next.template, ...Values }
        }
        Next.template.preset = Id
      }),
    SetTemplate: (Key, Value) =>
      UpdateTemplate((Next) => {
        ;(Next.template as unknown as Record<string, TemplateValue>)[Key] = Value
      }),
    MoveWidget: (Index, Delta) =>
      UpdateTemplate((Next) => {
        const Target = Index + Delta
        if (Target < 0 || Target >= Next.widgets.length) {
          return
        }
        const [Moved] = Next.widgets.splice(Index, 1)
        Next.widgets.splice(Target, 0, Moved)
      }),
    FlipWidgetSide: (Index) =>
      UpdateTemplate((Next) => {
        Next.widgets[Index].side = !Next.widgets[Index].side
      }),
    ToggleWidgetVisible: (Index) =>
      Update((Next) => {
        Next.widgets[Index].on = !Next.widgets[Index].on
      }),
    Headline: Selected?.Title ?? Draft.title,
    Generating: Generate.isPending,
    GenerateError,
    PreviewUrl: Generated ? PreviewUrl : "",
    Regenerate: () => {
      SetGenerated(null)
      GenerateMutate()
    },
    DownloadPdf: () => {
      void DownloadPdf()
    },
    PdfMeta: `A4 · ${OnWidgets.length} sections · ${Preset} template${
      Selected ? ` · tailored for ${Selected.Company}` : ""
    }`,
    AtsSafe: Draft.template.columns === 1,
  }
}

export function Resume(Props: ResumeProps) {
  return createElement(ResumeTemplate, UseResumeState(Props))
}
