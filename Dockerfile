# syntax=docker/dockerfile:1

# --- Build stage: render the static site with uv + mkdocs ---
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS build

# git-revision-date / git-latest-changes plugins read commit history at build time
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first for better layer caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

# Copy the rest (including .git, required by the git-* plugins) and build
COPY . .
RUN uv run mkdocs build

# --- Runtime stage: serve the static site ---
FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/site /usr/share/nginx/html

EXPOSE 80
