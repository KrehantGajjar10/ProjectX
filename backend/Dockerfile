FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.5.26 /uv /uvx /bin/

# Copy dependency specifications
COPY pyproject.toml uv.lock* ./

# Install dependencies into /app/.venv
RUN uv sync --frozen --no-dev --no-install-project || uv sync --no-dev --no-install-project

# Runtime stage
FROM python:3.12-slim AS runtime

WORKDIR /app

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy virtualenv and app code
COPY --from=builder /app/.venv /app/.venv
COPY . /app

# Ensure proper permissions
RUN chown -R appuser:appuser /app

USER appuser

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
