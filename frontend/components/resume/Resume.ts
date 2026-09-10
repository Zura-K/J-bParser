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
  type ResumeCoverage,
  type SearchResult,
  type TailoredResume,
} from "../../library/ts/Api"
import { ResumeTemplate } from "./ResumeTemplate"

export type ResumeProps = {
  InitialVacancy: string
}

export type Phase = "empty" | "loading" | "ready" | "error"
export type PanelView = "preview" | "diff"
export type CoverageTier = "Good" | "Warn" | "Bad"
export type IdentityField = "full_name" | "title"
export type RoleField = "role" | "company" | "start" | "end"
export type EducationField = "institution" | "degree" | "year"

export type DiffLine = {
  Left: string
  Right: string
  Changed: boolean
}

export type ResumeState = {
  Draft: MasterProfile
  Dirty: boolean
  SaveStatus: string
  SavePending: boolean
  Save: () => void
  SetIdentity: (Name: IdentityField, Value: string) => void
  SetContact: (Name: string, Value: string) => void
  SetSummary: (Value: string) => void
  AddRole: () => void
  RemoveRole: (RoleIndex: number) => void
  SetRoleField: (RoleIndex: number, Name: RoleField, Value: string) => void
  AddBullet: (RoleIndex: number) => void
  RemoveBullet: (RoleIndex: number, BulletIndex: number) => void
  SetBulletText: (RoleIndex: number, BulletIndex: number, Value: string) => void
  AddBulletSkill: (RoleIndex: number, BulletIndex: number, Skill: string) => void
  RemoveBulletSkill: (RoleIndex: number, BulletIndex: number, SkillIndex: number) => void
  AddSkill: (Skill: string) => void
  RemoveSkill: (SkillIndex: number) => void
  AddEducation: () => void
  RemoveEducation: (Index: number) => void
  SetEducationField: (Index: number, Name: EducationField, Value: string) => void
  VacancyOptions: { Id: string; Label: string }[]
  VacancyId: string
  VacancyLabel: string
  SelectVacancy: (Id: string) => void
  TailorTopMatch: () => void
  Phase: Phase
  TailorError: string
  Coverage: ResumeCoverage | null
  CoverageTier: CoverageTier
  Regenerate: () => void
  DownloadPdf: () => void
  PreviewUrl: string
  View: PanelView
  SetView: (Value: PanelView) => void
  Diff: DiffLine[]
  ChangedCount: number
}

export const EmptyMasterProfile: MasterProfile = {
  full_name: "",
  title: "",
  contact: {},
  summary: "",
  experience: [],
  skills: [],
  education: [],
}

const NoProfileDetail = "no master profile"

function Normalize(Profile: MasterProfile): MasterProfile {
  return {
    ...EmptyMasterProfile,
    ...Profile,
    contact: Profile.contact ?? {},
    experience: (Profile.experience ?? []).map((Role) => ({
      ...Role,
      bullets: (Role.bullets ?? []).map((Bullet) => ({
        text: Bullet.text ?? "",
        skills: Bullet.skills ?? [],
      })),
    })),
    skills: Profile.skills ?? [],
    education: (Profile.education ?? []).map((Item) => ({
      institution: Item.institution ?? "",
      degree: Item.degree ?? "",
      year: Item.year ?? "",
    })),
  }
}

export function TierOf(Score: number): CoverageTier {
  if (Score >= 67) {
    return "Good"
  }
  if (Score >= 34) {
    return "Warn"
  }
  return "Bad"
}

export function BuildDiff(Master: MasterProfile, Tailored: MasterProfile): DiffLine[] {
  const Lines: DiffLine[] = [
    {
      Left: Master.summary,
      Right: Tailored.summary,
      Changed: Master.summary !== Tailored.summary,
    },
  ]
  Master.experience.forEach((Role, RoleIndex) => {
    const TailoredRole = Tailored.experience[RoleIndex]
    Role.bullets.forEach((Bullet, BulletIndex) => {
      const Right = TailoredRole?.bullets[BulletIndex]?.text ?? ""
      Lines.push({ Left: Bullet.text, Right, Changed: Bullet.text !== Right })
    })
  })
  return Lines
}

function ErrorText(Caught: unknown): string {
  return Caught instanceof Error ? Caught.message : String(Caught)
}

function UseResumeState(Props: ResumeProps): ResumeState {
  const [Draft, SetDraft] = useState<MasterProfile>(EmptyMasterProfile)
  const [Loaded, SetLoaded] = useState(false)
  const [Dirty, SetDirty] = useState(false)
  const [SaveStatus, SetSaveStatus] = useState("")
  const [VacancyId, SetVacancyId] = useState("")
  const [Tailored, SetTailored] = useState<TailoredResume | null>(null)
  const [TailorError, SetTailorError] = useState("")
  const [PreviewUrl, SetPreviewUrl] = useState("")
  const [View, SetView] = useState<PanelView>("preview")

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
  const VacancyOptions = (SearchQuery.data?.results ?? []).map((Row) => ({
    Id: Row.fingerprint,
    Label: `${Row.title} · ${Row.company}`,
  }))

  const Update = (Mutate: (Next: MasterProfile) => void) => {
    SetDraft((Current) => {
      const Next = structuredClone(Current)
      Mutate(Next)
      return Next
    })
    SetDirty(true)
    SetSaveStatus("")
  }

  const Save = useMutation({
    mutationFn: () => SaveMasterProfile(Draft),
    onSuccess: () => {
      SetDirty(false)
      SetSaveStatus("Saved")
    },
    onError: (Caught) => SetSaveStatus(ErrorText(Caught)),
  })

  const Tailor = useMutation({
    mutationFn: async (Target: string) => {
      if (Dirty) {
        await SaveMasterProfile(Draft)
        SetDirty(false)
        SetSaveStatus("Saved")
      }
      return TailorResume(Target)
    },
    onSuccess: async (Reply, Target) => {
      SetTailored(Reply)
      SetTailorError("")
      const Preview = await FetchResumePreview(Target)
      SetPreviewUrl((Old) => {
        if (Old) {
          URL.revokeObjectURL(Old)
        }
        return URL.createObjectURL(Preview)
      })
    },
    onError: (Caught) => SetTailorError(ErrorText(Caught)),
  })
  const TailorMutate = Tailor.mutate

  const SelectVacancy = (Id: string) => {
    SetVacancyId(Id)
    SetTailored(null)
    SetTailorError("")
    if (Id !== "") {
      TailorMutate(Id)
    }
  }

  useEffect(() => {
    if (Props.InitialVacancy !== "") {
      SetVacancyId(Props.InitialVacancy)
      TailorMutate(Props.InitialVacancy)
    }
  }, [Props.InitialVacancy, TailorMutate])

  const DownloadPdf = async () => {
    try {
      const Pdf = await FetchResumePdf(VacancyId)
      const Url = URL.createObjectURL(Pdf)
      const Anchor = document.createElement("a")
      Anchor.href = Url
      Anchor.download = `resume-${VacancyId}.pdf`
      Anchor.click()
      URL.revokeObjectURL(Url)
    } catch (Caught) {
      SetTailorError(ErrorText(Caught))
    }
  }

  let Phase: Phase = "empty"
  if (VacancyId !== "") {
    if (Tailored !== null) {
      Phase = "ready"
    } else if (Tailor.isPending) {
      Phase = "loading"
    } else if (TailorError !== "") {
      Phase = "error"
    } else {
      Phase = "loading"
    }
  }
  const Coverage = Tailored?.coverage ?? null
  const Diff = Tailored ? BuildDiff(Draft, Normalize(Tailored.resume)) : []

  return {
    Draft,
    Dirty,
    SaveStatus,
    SavePending: Save.isPending,
    Save: () => Save.mutate(),
    SetIdentity: (Name, Value) =>
      Update((Next) => {
        Next[Name] = Value
      }),
    SetContact: (Name, Value) =>
      Update((Next) => {
        Next.contact[Name] = Value
      }),
    SetSummary: (Value) =>
      Update((Next) => {
        Next.summary = Value
      }),
    AddRole: () =>
      Update((Next) => {
        Next.experience.push({
          role: "",
          company: "",
          start: "",
          end: "",
          bullets: [{ text: "", skills: [] }],
        })
      }),
    RemoveRole: (RoleIndex) =>
      Update((Next) => {
        Next.experience.splice(RoleIndex, 1)
      }),
    SetRoleField: (RoleIndex, Name, Value) =>
      Update((Next) => {
        Next.experience[RoleIndex][Name] = Value
      }),
    AddBullet: (RoleIndex) =>
      Update((Next) => {
        Next.experience[RoleIndex].bullets.push({ text: "", skills: [] })
      }),
    RemoveBullet: (RoleIndex, BulletIndex) =>
      Update((Next) => {
        Next.experience[RoleIndex].bullets.splice(BulletIndex, 1)
      }),
    SetBulletText: (RoleIndex, BulletIndex, Value) =>
      Update((Next) => {
        Next.experience[RoleIndex].bullets[BulletIndex].text = Value
      }),
    AddBulletSkill: (RoleIndex, BulletIndex, Skill) =>
      Update((Next) => {
        const Skills = Next.experience[RoleIndex].bullets[BulletIndex].skills
        if (!Skills.includes(Skill)) {
          Skills.push(Skill)
        }
      }),
    RemoveBulletSkill: (RoleIndex, BulletIndex, SkillIndex) =>
      Update((Next) => {
        Next.experience[RoleIndex].bullets[BulletIndex].skills.splice(SkillIndex, 1)
      }),
    AddSkill: (Skill) =>
      Update((Next) => {
        if (!Next.skills.includes(Skill)) {
          Next.skills.push(Skill)
        }
      }),
    RemoveSkill: (SkillIndex) =>
      Update((Next) => {
        Next.skills.splice(SkillIndex, 1)
      }),
    AddEducation: () =>
      Update((Next) => {
        Next.education.push({ institution: "", degree: "", year: "" })
      }),
    RemoveEducation: (Index) =>
      Update((Next) => {
        Next.education.splice(Index, 1)
      }),
    SetEducationField: (Index, Name, Value) =>
      Update((Next) => {
        Next.education[Index][Name] = Value
      }),
    VacancyOptions,
    VacancyId,
    VacancyLabel: VacancyOptions.find((Option) => Option.Id === VacancyId)?.Label ?? VacancyId,
    SelectVacancy,
    TailorTopMatch: () => {
      if (VacancyOptions.length > 0) {
        SelectVacancy(VacancyOptions[0].Id)
      }
    },
    Phase,
    TailorError,
    Coverage,
    CoverageTier: TierOf(Coverage?.score ?? 0),
    Regenerate: () => SelectVacancy(VacancyId),
    DownloadPdf,
    PreviewUrl,
    View,
    SetView,
    Diff,
    ChangedCount: Diff.filter((Line) => Line.Changed).length,
  }
}

export function Resume(Props: ResumeProps) {
  return createElement(ResumeTemplate, UseResumeState(Props))
}
