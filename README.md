# VAYORA — Urban Air Quality Assistant

**PromptWars Challenge 6 — Phase 2: Air Quality Intelligence (built on Phase 0 & Phase 1)**

VAYORA (Urban Air Quality Assistant) helps families and neighborhood communities navigate severe winter smog and urban air pollution through live atmospheric air quality telemetry, low-emission daily routines, indoor air quality guidance, sustainable alternatives, personalized location/lifestyle recommendations, and clear explanations of direct impact.

---

## Technology Stack

- **Monorepo**: `npm` workspaces (`apps/*`, `packages/*`) with `pnpm-workspace.yaml` compatibility
- **Frontend (`apps/web`)**: React 19, TypeScript (strict), Vite 8, Tailwind CSS v4, WCAG 2.2 AA auth, 3-step household onboarding, and VAYORA Air Quality Intelligence dashboard
- **Backend (`apps/api`)**: Node.js 22, Express 4, TypeScript (strict), Helmet, CORS, `express-rate-limit`, Zod, server-side Firebase ID token verification, RBAC, and server-side Open-Meteo Air Quality & Geocoding adapter with TTL/stale caching
- **Identity & Data (`infrastructure/firebase`)**: Provisioned Firebase Authentication (Email/Password + mandatory email verification + password recovery) and Cloud Firestore (`ai-studio-urbanairqualitya-...` named database with deployed `firestore.rules` & split PII subcollection)
- **Environmental Data**: Open-Meteo Air Quality API & Geocoding API (`CC BY 4.0`, model-generated atmospheric forecast & dispersion data, disclosed transparently in API & UI)
- **AI Orchestration**: Server-side `@google/genai` SDK (never exposed to browser; reserved for Phase 4+)
- **Testing & Quality**: Vitest, React Testing Library, Supertest, Playwright, `axe-core`, `oxlint`, ESLint 9 (`@firebase/eslint-plugin-security-rules`, `eslint-plugin-jsx-a11y`), Prettier

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
│   └── firebase/           # Hardened firestore.rules, indexes, blueprint IR, security spec
├── docs/                   # PRD, Architecture, Security, Testing, Accessibility, Traceability
├── .github/workflows/      # Automated CI verification pipeline
├── server.ts               # Unified AI Studio port-3000 Express + Vite runtime entrypoint
└── package.json            # Monorepo workspace scripts
```

## Prerequisites

- Node.js `>= 22`
- `npm >= 10` (or `pnpm >= 9` in local/CI environments)

## Installation & Environment Setup

1. Install dependencies:
   ```bash
   npm install
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
