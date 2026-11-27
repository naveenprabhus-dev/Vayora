# VAYORA — Urban Air Quality Assistant

**Breathe better. Live smarter.** · **PromptWars Challenge 6 — Phases 0–7 Integrated Application**

VAYORA (Urban Air Quality Assistant) helps households navigate winter smog and urban air pollution through live atmospheric air quality telemetry, low-emission daily routines, indoor air quality guidance, sustainable alternatives, and personalized GenAI briefings and impact explanations with deterministic guardrails and fallback support.

---

## Technology Stack

- **Monorepo**: Workspace configuration in `package.json` (`apps/*`, `packages/*`) managed by `bun` (`bun.lock`)
- **Frontend (`apps/web`)**: React 19, TypeScript (strict), Vite 8, Tailwind CSS v4, WCAG 2.2 AA auth, 3-step household onboarding, Personalized Briefing & Impact Explorer, Air Quality Intelligence dashboard, Low-Emission Daily Routines, Indoor Air Quality Assistant, and Sustainable Alternatives Advisor
- **Backend (`apps/api`)**: Node.js 22, Express 4, TypeScript (strict), Helmet, CORS, `express-rate-limit`, Zod, server-side Firebase ID token verification, RBAC, Open-Meteo adapter with TTL/stale caching, deterministic guidance engines, and owner-scoped cache invalidation on household updates
- **Identity & Data (`firestore.rules`, `infrastructure/firebase`)**: Provisioned Firebase Authentication (Email/Password + mandatory email verification + password recovery) and Cloud Firestore named database with canonical root `firestore.rules`, `firebase-blueprint.json`, indexes, and split PII subcollection
- **Environmental Data**: Open-Meteo Air Quality API & Geocoding API (`CC BY 4.0`, model-generated atmospheric forecast & dispersion data, disclosed transparently in API & UI)
- **AI Orchestration**: Server-side `@google/genai` SDK (`gemini-4-hydrogen` / `GEMINI_API_KEY`, server-only with deterministic guardrails and structured fallback; never exposed to browser)
- **Testing & Quality**: Vitest, React Testing Library, Supertest, Playwright, `axe-core`, `oxlint`, ESLint 9 (`typescript-eslint`, `@firebase/eslint-plugin-security-rules`, `eslint-plugin-jsx-a11y`), Prettier

## Project Structure

```text
urban-air-quality-assistant/
├── apps/
│   ├── web/                # Accessible React frontend shell, UI primitives, RTL & Playwright tests
│   └── api/                # Modular Express backend, auth/RBAC/rate-limit middleware, Gemini factory
├── packages/
│   ├── contracts/          # Shared Zod validation schemas, RBAC permissions, API envelopes
│   └── config/             # Shared strict TypeScript & ESLint flat configs
├── infrastructure/
│   └── firebase/           # Firestore indexes, adversarial rules test suite, and security spec
├── docs/                   # PRD, Architecture, Security, Testing, Accessibility, Traceability
├── .github/workflows/      # Automated CI verification pipeline
├── firestore.rules         # Canonical Firestore security rules deployed by firebase.json
├── firebase-blueprint.json # Canonical Firestore entity blueprint
├── public/favicon.ico      # Canonical application favicon
├── server.ts               # Unified AI Studio port-3000 Express + Vite runtime entrypoint
└── package.json            # Monorepo workspace scripts
```

## Prerequisites

- Node.js `>= 22`
- `bun >= 1.4` (canonical workspace package manager with `bun.lock`)

## Installation & Environment Setup

1. Install dependencies:
   ```bash
   bun install --frozen-lockfile
   ```
2. Copy `.env.example` to `.env` for local development (never commit `.env` or credential files):
   ```bash
   cp .env.example .env
   ```
3. Configure server-only secrets (`GEMINI_API_KEY`, `FIREBASE_PROJECT_ID`) in `.env` or Google AI Studio **Settings > Secrets**. Never place secret keys in `VITE_*` variables.

## Development Commands

- `npm run dev` — Start the unified development server on port `3000` (serves `apps/web` and mounts `apps/api` at `/api/v1`)
- `npm run dev:api` — Run the standalone Express API server on `API_PORT` (`4000`)
- `npm run dev:web` — Run Vite frontend dev server only

## Quality, Testing & Build Commands

- `npm run typecheck` — Strict TypeScript checking across all workspaces
- `npm run lint` — Run `typecheck`, `oxlint`, and `eslint` (including `firestore.rules` security audit)
- `npm run format:check` — Verify Prettier formatting
- `npm run test:unit` — Execute contracts, API unit, and Web RTL + `axe-core` unit tests
- `npm run test:integration` — Execute API Supertest integration suite
- `npm run test:e2e` — Execute Playwright system and WCAG 2.2 AA accessibility tests
- `npm run build` — Build both frontend (`dist/`) and backend (`apps/api/dist/server.js`)

## Documentation

- [Product Requirements](docs/PRD.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Security Architecture](docs/SECURITY.md)
- [Testing Strategy](docs/TESTING.md)
- [Accessibility Standards](docs/ACCESSIBILITY.md)
- [Requirements Traceability](docs/TRACEABILITY.md)
