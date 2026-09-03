FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
    HF_HOME=/opt/hf-cache

COPY --from=ghcr.io/astral-sh/uv:0.8 /uv /usr/local/bin/uv

WORKDIR /app

# Dependencies first, so source edits don't invalidate the heavy layers below.
COPY pyproject.toml ./
RUN uv pip install --system --no-cache -r pyproject.toml

# Chromium + its system libraries, needed by the ingest worker's Playwright fallback.
RUN playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# Bake the embedding model into the image so the server never downloads it at runtime.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5', device='cpu')" \
    && chmod -R a+rX /opt/hf-cache /opt/pw-browsers

COPY api.py ./
COPY components ./components
COPY library ./library

RUN useradd --create-home app
USER app

EXPOSE 8000
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
