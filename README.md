# FitRoom API — Batch 1 (Backend Foundation)

Production-oriented NestJS + Prisma backend for the FitRoom AI fashion-fitting platform.
This batch delivers: persistent data model, JWT auth with roles, consent-gated fit profiles,
and the tested rules-based fit/size engine exposed as an endpoint.

## Stack
- **NestJS** (TypeScript) — modular monolith
- **Prisma** ORM + **PostgreSQL**
- **JWT** auth (Passport) with role-based guards
- **class-validator** DTOs, **Helmet**, **rate limiting**, env validation, health check

## Prerequisites
- Node 18+ and npm
- Docker (for local Postgres) — or any Postgres 14+

## Quick start
```bash
cp .env.example .env                 # set JWT_SECRET (16+ chars)
npm install
docker compose up -d                 # starts Postgres on :5432
npm run prisma:generate
npm run prisma:migrate -- --name init # creates tables
npm run prisma:seed                  # demo designer, products, customer
npm run start:dev                    # http://localhost:3000/api
```

## Run the tests
```bash
npm test            # fit-engine unit tests (no DB needed)
```

## Key endpoints
| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/register` | – | Create account (role, consent optional) |
| POST | `/api/auth/login` | – | Returns `{ accessToken, user }` |
| GET | `/api/users/me` | JWT | Current user |
| PATCH | `/api/users/me/consent` | JWT | Set body-data consent |
| POST | `/api/fit-profiles` | JWT | Save a versioned fit profile (needs consent) |
| GET | `/api/fit-profiles` | JWT | List my profiles |
| GET | `/api/fit-profiles/latest` | JWT | Latest profile |
| DELETE | `/api/fit-profiles` | JWT | Erase all my body data (privacy) |
| POST | `/api/garments/fit-check` | – | Size recommendation + warnings |
| GET | `/api/health` | – | Liveness + DB check |

### Example: fit-check (inline chart)
```bash
curl -X POST http://localhost:3000/api/garments/fit-check \
  -H 'Content-Type: application/json' \
  -d '{
    "category":"Senator","stretch":"LOW",
    "sizeChart":{"sizes":["S","M","L","XL","XXL"],
      "chest":[96,100,104,108,112],"waist":[84,88,92,96,100]},
    "chest":104,"waist":94,"fitPreference":"regular"
  }'
# -> { "recommendedSize":"...", "fitConfidence":..., "warnings":[...], "alternativeSize":"..." }
```
Or pass `{"productId":"...","chest":104,"waist":94,"fitPreference":"regular"}` to use a seeded product's chart.

## Architecture notes
- **Modular monolith**, not microservices — split later when load/team justify it (see build plan).
- Money stored as **integer minor units** (`priceKobo`).
- Measurements stored as JSON for cross-garment flexibility; the engine is pure & deterministic.
- The fit engine (`src/fit/fit.service.ts`) is isolated so it can be A/B-compared against an ML model in a later batch.

## Demo logins (after seed) — password `Password123!`
`admin@fitroom.io` · `designer@lagosroyale.com` · `customer@demo.io`

---
Next: **Batch 2 — Order Workflow + Web Frontend** (see `../FitRoom_Build_Plan.md`).
