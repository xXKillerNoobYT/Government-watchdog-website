# syntax=docker/dockerfile:1
# GOV-1544 (P3b of GOV-1523) — one deployment unit per docs/gov1543-deploy-execution-plan.md §2:
# edge (Caddy) serves dist/ and reverse-proxies /api/* to the loopback-only
# artifact service. Exactly ONE port (Caddy's 8080) is ever exposed; the
# service port 8100 is never mapped (§5 double enforcement — the run.py bind
# guard refuses non-loopback, and scripts/check-no-direct-exposure.mjs greps
# this file + fly.toml).
#
# Fail-closed build: stage 1 runs scripts/fetch-artifact.mjs, which now refuses
# every commit/tag backed by the public GitHub Release channel. A private image
# therefore remains intentionally unbuildable until a protected, authenticated
# private-runtime delivery channel is implemented and verified (#291/#95):
#
#   landing-only:  docker build --build-arg LANDING_ONLY=1 .   (explicit choice)
#
# Building this image deploys nothing and activates nothing: every gated
# surface stays a constant 404 until the owner-gated DB flags are appended.

FROM node:22-slim AS build
WORKDIR /site
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# A local: override is useful only outside this container, where the backend
# checkout actually exists. It cannot turn this public build context into a
# private artifact transport.
ARG BACKEND_REF=""
ARG LANDING_ONLY=""
RUN BACKEND_REF="$BACKEND_REF" LANDING_ONLY="$LANDING_ONLY" \
    node scripts/fetch-artifact.mjs
# This image is the authenticated same-origin backend deployment, not the
# public Sites package. Select its private browser lane explicitly now that
# the repository default fails closed to the Sites public-free artifact.
RUN npm run build:private-beta

FROM python:3.12-slim AS runtime
# Caddy is a single static binary — take it from the official image.
COPY --from=caddy:2 /usr/bin/caddy /usr/bin/caddy
# The artifact's accounts closure needs argon2 for session hashing.
RUN pip install --no-cache-dir argon2-cffi
WORKDIR /srv
COPY --from=build /site/dist/client /srv/dist
# Staged artifact: service/ + data/ (gated lane served ONLY via /api after auth).
# Absent in a LANDING_ONLY build — the entrypoint then serves static only.
COPY --from=build /site/.artifact /srv/.artifact
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY deploy/entrypoint.sh /srv/entrypoint.sh
RUN chmod +x /srv/entrypoint.sh && \
    if [ -d /srv/.artifact/artifact ]; then mv /srv/.artifact/artifact /srv/artifact; fi && \
    rm -rf /srv/.artifact
# Caddy only. The service port is deliberately NOT exposed.
EXPOSE 8080
VOLUME /data
ENTRYPOINT ["/srv/entrypoint.sh"]
