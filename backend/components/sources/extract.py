import re

seniority_rules = [
    ("intern", r"\bintern(ship)?\b"),
    ("lead", r"\b(principal|staff|lead|head of|director)\b"),
    ("senior", r"\b(senior|sr\.?)\b"),
    ("junior", r"\b(junior|jr\.?|entry[ -]level|graduate)\b"),
    ("mid", r"\b(mid[ -]level|intermediate)\b"),
]

remote_mode_rules = [
    ("hybrid", r"\bhybrid\b"),
    ("onsite", r"\b(on[ -]?site|in[ -]office|office[ -]based)\b"),
    ("remote", r"\b(remote|work[ -]from[ -]home|distributed team)\b"),
]

skill_rules = [
    ("Python", r"\bpython\b"),
    ("Java", r"\bjava\b"),
    ("JavaScript", r"\bjavascript\b"),
    ("TypeScript", r"\btypescript\b"),
    ("C++", r"\bc\+\+"),
    ("C#", r"\bc#"),
    ("Go", r"\bgolang\b|\bgo (developer|engineer|programming)\b"),
    ("Rust", r"\brust\b"),
    ("PHP", r"\bphp\b"),
    ("Ruby", r"\bruby\b"),
    ("Kotlin", r"\bkotlin\b"),
    ("Swift", r"\bswift\b"),
    ("SQL", r"\bsql\b"),
    ("PostgreSQL", r"\bpostgres(ql)?\b"),
    ("MySQL", r"\bmysql\b"),
    ("MongoDB", r"\bmongodb?\b"),
    ("Redis", r"\bredis\b|\bvalkey\b"),
    ("Elasticsearch", r"\belastic ?search\b"),
    ("Kafka", r"\bkafka\b"),
    ("RabbitMQ", r"\brabbitmq\b"),
    ("GraphQL", r"\bgraphql\b"),
    ("REST", r"\brest(ful)? apis?\b"),
    ("gRPC", r"\bgrpc\b"),
    ("React", r"\breact(\.?js)?\b"),
    ("Angular", r"\bangular(js)?\b"),
    ("Vue", r"\bvue(\.?js)?\b"),
    ("Next.js", r"\bnext\.?js\b"),
    ("Node.js", r"\bnode\.?js\b"),
    ("Django", r"\bdjango\b"),
    ("Flask", r"\bflask\b"),
    ("FastAPI", r"\bfastapi\b"),
    ("Spring", r"\bspring( boot)?\b"),
    (".NET", r"\.net\b|\bdotnet\b"),
    ("Rails", r"\bruby on rails\b|\brails\b"),
    ("HTML", r"\bhtml5?\b"),
    ("CSS", r"\bcss3?\b"),
    ("Docker", r"\bdocker\b"),
    ("Kubernetes", r"\bkubernetes\b|\bk8s\b"),
    ("Terraform", r"\bterraform\b"),
    ("Ansible", r"\bansible\b"),
    ("AWS", r"\baws\b|\bamazon web services\b"),
    ("Azure", r"\bazure\b"),
    ("GCP", r"\bgcp\b|\bgoogle cloud\b"),
    ("Linux", r"\blinux\b"),
    ("Git", r"\bgit\b"),
    ("CI/CD", r"\bci/cd\b|\bcicd\b|\bcontinuous integration\b"),
    ("Machine Learning", r"\bmachine learning\b|\bdeep learning\b"),
    ("PyTorch", r"\bpytorch\b"),
    ("TensorFlow", r"\btensorflow\b"),
    ("Pandas", r"\bpandas\b"),
    ("NumPy", r"\bnumpy\b"),
    ("Spark", r"\bspark\b"),
    ("Airflow", r"\bairflow\b"),
    ("Snowflake", r"\bsnowflake\b"),
    ("dbt", r"\bdbt\b"),
    ("Tableau", r"\btableau\b"),
    ("Power BI", r"\bpower ?bi\b"),
    ("Excel", r"\bexcel\b"),
    ("Agile", r"\bagile\b"),
    ("Scrum", r"\bscrum\b"),
]

employment_type_rules = [
    ("internship", r"\binternship\b"),
    ("part_time", r"\bpart[ -]time\b"),
    ("contract", r"\b(contract(or)?|freelance|temporary)\b"),
    ("full_time", r"\bfull[ -]time\b"),
]


def extract_fields(title: str, location: str, body: str) -> dict:
    title_lower = title.lower()
    location_lower = location.lower()
    body_lower = body.lower()
    return {
        "seniority": _first_match(seniority_rules, [title_lower]),
        "remote_mode": _first_match(
            remote_mode_rules, [title_lower + " " + location_lower, body_lower]
        ),
        "employment_type": _first_match(
            employment_type_rules, [title_lower, body_lower]
        ),
    }


def extract_skills(text: str) -> list[str]:
    lowered = text.lower()
    return [skill for skill, pattern in skill_rules if re.search(pattern, lowered)]


def _first_match(rules: list[tuple[str, str]], texts: list[str]) -> str:
    for text in texts:
        for value, pattern in rules:
            if re.search(pattern, text):
                return value
    return ""
