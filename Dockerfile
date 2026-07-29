# Daluyan — single-image deploy for Railway / Render (always-on host).
# Node builds the React console, Python (Tornado) serves both the API and that build.

# ---- Stage 1: build the React console -> dist/ ----
FROM node:20-slim AS web
WORKDIR /web
COPY prototype/frontend/package.json prototype/frontend/package-lock.json ./
RUN npm ci
COPY prototype/frontend/ ./
RUN npm run build

# ---- Stage 2: Python runtime (serves /ui/ + JSON API + /inbound webhook) ----
FROM python:3.11-slim
WORKDIR /app
COPY prototype/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY prototype/ ./
# overlay the freshly compiled UI (prototype/frontend/dist is gitignored / only a stub)
COPY --from=web /web/dist ./frontend/dist

# MOCK gateway by default (no SMS spend). DEMO_FAST => retry backoff in seconds, not minutes.
ENV DEMO_FAST=1
# Railway/Render inject their own $PORT at runtime; this is only the local fallback.
ENV PORT=8787
EXPOSE 8787
CMD ["python", "-m", "daluyan.main"]
