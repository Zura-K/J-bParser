"""Loads environment configuration for all J-bParser Python entry points.

Values come from the process environment first; a `.env` file only fills in
variables that are not already set. Two locations are honored: the repository
root (next to backend/ and frontend/, works for the deployed server) and the
current working directory (works for crons/scripts run elsewhere).
See .env.example for the recognized variables.

python-dotenv is used when available; otherwise a minimal built-in parser
(KEY=VALUE lines, `#` comments, optional `export ` prefix and quotes) keeps
`.env` working even on machines without the package.
"""
import os

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

_loaded = False


def _parse_env_file(path):
    """Minimal .env parser: fills os.environ without overriding set values."""
    try:
        with open(path, "r", encoding="utf-8") as handle:
            lines = handle.readlines()
    except OSError:
        return

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):].strip()
        key, separator, value = line.partition("=")
        if not separator:
            continue
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        if key and key not in os.environ:
            os.environ[key] = value


def load_project_env():
    """Idempotently load .env files without overriding real env vars."""
    global _loaded
    if _loaded:
        return
    _loaded = True

    project_root = os.path.abspath(
        os.path.join(os.path.dirname(__file__), os.pardir, os.pardir)
    )
    candidates = [
        os.path.join(project_root, ".env"),
        os.path.join(os.getcwd(), ".env"),
    ]

    for env_path in candidates:
        if not os.path.isfile(env_path):
            continue
        if load_dotenv is not None:
            load_dotenv(env_path)
        else:
            _parse_env_file(env_path)
