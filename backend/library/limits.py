from dataclasses import dataclass


@dataclass(frozen=True)
class Quotas:
    delay_hours: int
    max_profiles: int
    max_results: int
    profile_embeds_per_day: int
    llm_reasons: bool
    record_ttl_seconds: int | None


def limits_for(tier: str) -> Quotas:
    match tier:
        case "Paid":
            return Quotas(
                delay_hours=0,
                max_profiles=10,
                max_results=200,
                profile_embeds_per_day=200,
                llm_reasons=True,
                record_ttl_seconds=None,
            )
        case "Free":
            return Quotas(
                delay_hours=24,
                max_profiles=3,
                max_results=50,
                profile_embeds_per_day=30,
                llm_reasons=False,
                record_ttl_seconds=None,
            )
        case _:
            return Quotas(
                delay_hours=72,
                max_profiles=1,
                max_results=20,
                profile_embeds_per_day=10,
                llm_reasons=False,
                record_ttl_seconds=90 * 86400,
            )
