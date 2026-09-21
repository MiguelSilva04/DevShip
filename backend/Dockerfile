# Build stage — installs production dependencies only
FROM python:3.11-slim AS builder

WORKDIR /app

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Runtime stage — only what's needed to run the app
FROM python:3.11-slim AS runtime

WORKDIR /app

# Bring in the venv built in the build stage, nothing else from it
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt pyproject.toml alembic.ini ./
COPY backend ./backend

RUN pip install --no-cache-dir --no-deps -e .

# Drop root before running the app
RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app /opt/venv
USER appuser

CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=172.28.0.10"]

# Tests stage — runs tests in a separate stage, never shipped to production
FROM builder AS test

COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt

COPY backend ./backend
COPY pyproject.toml alembic.ini ./
