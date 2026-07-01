# ─────────────────────────────────────────────────────────────────────
# PREDATOR JUNGLE v3.0 "Spilbergian" — Dockerfile
# Multi-stage build with Node.js + ffmpeg + CapCut CLI (if available)
# ─────────────────────────────────────────────────────────────────────

# ── Stage 1: Base with system dependencies ───────────────────────────
FROM node:20-bookworm-slim AS base

# Install ffmpeg (essential for video assembly), sox (for Whisper recording),
# and other useful CLI tools.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    sox \
    libsox-fmt-mp3 \
    curl \
    ca-certificates \
    python3 \
    make \
    g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Stage 2: Dependencies ────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

# ── Stage 3: Build ───────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build 2>/dev/null || true

# ── Stage 4: Runtime ─────────────────────────────────────────────────
FROM base AS runtime

# Create a non-root user for security
RUN groupadd -r spilbergian && useradd -r -g spilbergian -d /app -s /bin/bash spilbergian

WORKDIR /app

# Copy only what we need
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/config ./config
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.env.example ./

# Create data directories
RUN mkdir -p data/memory data/assets/video data/assets/audio data/assets/thumbnails \
    data/projects data/training/scenes data/training/scripts data/training/storyboards \
    data/youtube data/logs \
  && chown -R spilbergian:spilbergian /app

USER spilbergian

# Health check — verify the process can respond
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

# Default entrypoint: start the CLI in status mode.
# Override with: docker run spilbergian-v3 create "your brief"
ENTRYPOINT ["node", "scripts/cli.js"]
CMD ["status"]
