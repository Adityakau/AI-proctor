# AI Exam Proctoring – Phase 1 (Camera-only, Low Bandwidth, Massive Scale)

This repo contains a backend-first architecture for AI proctoring where the client runs webcam inference and the backend receives **only lightweight anomaly events** (no raw video).

## Key properties

- **Scale**: designed for 1M+ concurrent sessions (write-path decoupled with Kafka; Redis for hot state).
- **Privacy-first**: no raw video ingestion/storage. Optional tiny thumbnails only.
- **Security**: validates an **existing RS256 exam JWT** (no token issuance). Tenant isolation is enforced via JWT claims.

## Repo structure

```text
backend/    Java 17 + Spring Boot 3 multi-module
client/     Next.js (JS) + Tailwind (minimal demo)
infra/      docker-compose.yml (MySQL, Redis, Kafka, MinIO)
Jenkinsfile CI pipeline (Jenkinsfile only)
```

## Authentication model (MANDATORY)

The proctoring backend **does not** issue JWTs. Every request must include:

`Authorization: Bearer <exam_jwt>`

The backend validates:

- RS256 signature (public key configured via `JWT_PUBLIC_KEY_LOCATION`)
- `exp`
- required identity claims (at minimum): `tenant_id`, `exam_schedule_id`, `user_id`, `attempt_no`

The internal proctoring session identity is derived from:

`(tenant_id, exam_schedule_id, user_id, attempt_no)`

JWT refresh is supported: session remains valid if new JWT has matching identity claims.

## Local dev: running everything

### Start stack

```bash
docker compose -f infra/docker-compose.yml up --build
```

Services:

- `auth-service`: `http://localhost:8081`
- `event-ingest-service`: `http://localhost:8082`
- `rules-engine`: `http://localhost:8083` (health only; consumes Kafka)
- `dashboard-api`: `http://localhost:8084`
- `client`: `http://localhost:3000`

### Local JWT for dev

For local development, each service includes a **sample RSA public key** at `classpath:jwt-public.pem`.
Generate a matching private key + JWT using your preferred tooling, or point `JWT_PUBLIC_KEY_LOCATION` to your platform’s public key/JWKS.

> Production: use JWKS (`spring.security.oauth2.resourceserver.jwt.jwk-set-uri`) or rotate keys centrally.

## Core endpoints

### Sessions

- `POST /sessions/start`
- `POST /sessions/heartbeat`
- `POST /sessions/end`

Example:

```bash
curl -sS -X POST http://localhost:8081/sessions/start \
  -H "Authorization: Bearer <exam_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"examConfig":{"maxLookAwaySeconds":5,"maxLookAwayWindowSeconds":30}}'
```

### Event ingest (critical write path)

- `POST /events/batch`

Example:

```bash
curl -sS -X POST http://localhost:8082/events/batch \
  -H "Authorization: Bearer <exam_jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "<session_id>",
    "events": [
      {"eventId":"evt-1","type":"LOOK_AWAY","timestamp":"2026-01-28T10:00:00Z","confidence":0.93,"details":{"durationMillis":2000}},
      {"eventId":"evt-2","type":"MULTI_PERSON","timestamp":"2026-01-28T10:00:05Z","confidence":0.99,"details":{}}
    ]
  }'
```

## Scalability notes (why this survives massive scale)

- **Thin ingest**: minimal synchronous work (JWT verify, payload limits, Redis dedupe/rate limit, Kafka publish). No heavy DB writes on request thread.
- **Kafka buffering**: absorbs spikes; rules/scoring scales horizontally via consumer concurrency.
- **Redis hot state**: sliding windows + ephemeral risk aggregation with TTLs.
- **MySQL durability**: alerts and periodic risk snapshots are persisted and indexed for auditing/dashboarding.

