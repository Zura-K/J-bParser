from selectolax.parser import HTMLParser


def html_to_text(markup: str) -> str:
    return HTMLParser(markup).text(separator=" ", strip=True)


def fetch(config: dict) -> list[tuple[str, bytes]]:
    match config["handler"]:
        case "greenhouse" | "lever" | "ashby":
            from sources.handlers import ats

            return ats.fetch(config)
        case "linkedin":
            from sources.handlers import linkedin

            return linkedin.handler.fetch(config)
        case "fake":
            from sources.handlers import fake

            return fake.fetch(config)
        case _:
            raise ValueError(f"unknown handler {config['handler']}")


def parse(config: dict, pages: list[tuple[str, bytes]]) -> list[dict]:
    match config["handler"]:
        case "greenhouse" | "lever" | "ashby":
            from sources.handlers import ats

            return ats.parse(config, pages)
        case "linkedin":
            from sources.handlers import linkedin

            return linkedin.handler.parse(config, pages)
        case "fake":
            from sources.handlers import fake

            return fake.parse(config, pages)
        case _:
            raise ValueError(f"unknown handler {config['handler']}")
