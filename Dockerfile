# syntax=docker/dockerfile:1.7

ARG PYTHON_VERSION=3.12

# =============================================================================
# Base stage: Python environment setup
# =============================================================================
FROM python:${PYTHON_VERSION}-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv
RUN python -m venv ${VIRTUAL_ENV}
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"

# =============================================================================
# Builder stage: Install Python dependencies
# =============================================================================
FROM base AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements.txt pyproject.toml README.md ./
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir -e .[dev]
COPY . .

# =============================================================================
# Runtime stage: Final production image
# =============================================================================
FROM base AS runtime
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends wget make && rm -rf /var/lib/apt/lists/*
COPY scripts/npm-shim.sh /usr/local/bin/npm
RUN chmod +x /usr/local/bin/npm

# Environment configuration
ENV PORT=8080 \
    LOG_LEVEL=info \
    PYTHONPATH=/app \
    APP_ENV=production

# Create non-root user (security best practice)
RUN adduser --uid 10001 --home /home/app --disabled-password --gecos "" app \
    && chown -R app:app /home/app

# Copy Python virtual environment from builder
COPY --from=builder /opt/venv /opt/venv

# Copy application code
COPY --from=builder /app/app /app/app
COPY --from=builder /app/pyproject.toml /app/README.md /app/
COPY --from=builder /app/alembic.ini /app/Makefile /app/

# Copy frontend SPAs (monolith deployment)
COPY --from=builder /app/src/lib /app/src/lib
COPY --from=builder /app/src/kiosk-app /app/src/kiosk-app
COPY --from=builder /app/src/teacher-pwa /app/src/teacher-pwa
COPY --from=builder /app/src/web-app /app/src/web-app
COPY --from=builder /app/src/login-app /app/src/login-app

# Copy scripts (seed, postdeploy hooks, etc.)
COPY --from=builder /app/scripts /app/scripts

# Set ownership for non-root user
RUN chown -R app:app /app

USER app
EXPOSE 8080

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

# Default command: API server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
