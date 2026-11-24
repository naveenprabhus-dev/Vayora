# System Architecture — Urban Air Quality Assistant

## 1. Architectural Overview

Urban Air Quality Assistant is structured as a strict TypeScript monorepo separating presentation (`apps/web`), server orchestration and security enforcement (`apps/api`), shared runtime schemas and domain contracts (`packages/contracts`), shared compiler/linter configurations (`packages/config`), and database security infrastructure (`infrastructure/firebase`).

```text
Browser (apps/web, React 19 + Tailwind CSS — VAYORA Workspace)
  │  HTTPS / JSON + Bearer Firebase ID Token
  ▼
API Boundary (apps/api, Express + Helmet + Rate Limit + Zod)
  ├── Auth Middleware       ──► Firebase ID Token Verification (server-side)
  ├── Authorization Guards  ──► RBAC + Resource Ownership Verification
  ├── AI Orchestration      ──► @google/genai (Phase 6 Active: gemini-4-hydrogen, guardrails & deterministic fallback)
  ├── Air Quality Module    ──► Open-Meteo Provider + EPA/EEA Engine + Cache/Stale Fallback (Phase 2 Active)
  └── Persistence Layer     ──► Repository Contracts / Cloud Firestore
```

## 2. Package & Module Responsibilities

- **`packages/contracts` (`@uaqa/contracts`)**: Single source of truth for Zod validation schemas, TypeScript domain types, RBAC role/permission matrices (`air_quality:read`), and standardized `ApiResponse<T>` envelopes.
- **`packages/config` (`@uaqa/config`)**: Shared strict TypeScript base presets (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) and ESLint 9 flat configurations (including `@firebase/eslint-plugin-security-rules` and `eslint-plugin-jsx-a11y`).
- **`apps/api` (`@uaqa/api`)**: Modular Express backend providing centralized configuration (`src/config`), security middleware (`src/middleware`), typed errors and secret redaction (`src/utils`), auth/AI service adapters (`src/services`), repository contracts (`src/repositories`), and versioned routes (`src/modules/auth`, `src/modules/household`, `src/modules/air-quality`, `src/modules/routines`, `src/modules/indoor`, `src/modules/alternatives`, `src/modules/advisory`, `src/modules/health`, `src/modules/system`).
- **`apps/web` (`@uaqa/web`)**: Accessible React frontend shell, reusable WCAG 2.2 AA UI primitives (`src/components`), typed API client (`src/lib/apiClient.ts`), VAYORA Personalized Daily Briefing & Impact Explorer (`src/features/advisory/*`), Air Quality Intelligence dashboard (`src/features/air-quality/*`), Low-Emission Daily Routines (`src/features/routines/*`), Indoor Air Quality Assistant (`src/features/indoor/*`), Sustainable Alternatives Advisor (`src/features/alternatives/*`), and product module registry (`src/features/moduleRegistry.ts`).
- **`infrastructure/firebase`**: Declarative entity blueprint (`firebase-blueprint.json`), hardened security rules (`firestore.rules`), composite indexes (`firestore.indexes.json`), and adversarial TDD spec (`security_spec.md`).

## 3. Google AI Studio Execution Compatibility & Decisions

Before finalizing dependencies and entrypoints, framework compatibility with the Google AI Studio runtime was verified:

1. **Frontend Runtime Strategy (Next.js Proposal vs. Vite 8 + Express Single-Port Adapter)**:
   - **Constraint**: Google AI Studio runs a single preview server on port `3000` (`npm run dev`), executes `vite build` for frontend bundling, and sets `DISABLE_HMR=true`. Running a separate Next.js SSR server alongside an independent Express API server on distinct ports cannot be served directly through AI Studio's single-port preview without an external reverse proxy.
   - **Strategy**: All frontend source code lives cleanly inside `apps/web/src/` using React 19, TypeScript, and Tailwind CSS v4. Root `server.ts` serves as a thin unified runtime adapter on port `3000` mounting `apps/api` (`createApiRouter`) at `/api/v1` and serving `apps/web` via Vite middleware (development) or `dist/` (production). `apps/api/src/server.ts` remains independently runnable on `API_PORT` (`4000`) for standalone deployments.
2. **Package Manager Compatibility (`pnpm` vs. `npm` Workspaces)**:
   - **Constraint**: `pnpm` is not pre-installed in the AI Studio container (`node v22.23.2`, `npm 10.9.8` are present).
   - **Strategy**: Root `package.json` configures native `npm` `"workspaces": ["apps/*", "packages/*"]`, while `pnpm-workspace.yaml` is maintained for CI and local `pnpm` environments.
3. **TypeScript 7.0.2 & Linting Toolchain**:
   - **Constraint**: The environment uses `typescript@7.0.2`. `typescript-eslint@8.x` currently enforces a peer dependency of `typescript < 6.1.0`, and `@firebase/eslint-plugin-security-rules@0.0.2` requires `eslint@^9`.
   - **Strategy**: TypeScript strict checking runs via `tsc -p <project> --noEmit` across all workspaces; fast TypeScript/React/JSX-a11y static analysis runs via `oxlint` (`.oxlintrc.json`); and JavaScript plus `firestore.rules` auditing run via `eslint@^9` (`eslint.config.mjs`).
4. **Firebase Provisioning & Starter Tier IAM Boundary (Phase 1 Active)**:
   - **Provisioned Project**: Google-hosted Starter Tier project `regal-center-494708-a3` with named Firestore database `ai-studio-urbanairqualitya-cdf4ee93-cab2-4af6-9187-a786bd92841c` (`firebase-applet-config.json`).
   - **Starter Tier IAM Constraint**: Preview runtime service accounts on Starter Tier do not carry `roles/firebaseauth.viewer` or Firestore Admin IAM permissions; therefore, server-side `verifyIdToken(token)` verifies token signatures and expiry without IAM, while persistent Firestore writes (`/users/{uid}`, `/users/{uid}/private/info`, `/households/{uid}`) execute through the Firebase Web SDK governed by deployed `firestore.rules`. Express maintains an ownership-isolated `HouseholdRepository` (`PUT/GET /api/v1/household/profile`) and `GET /api/v1/auth/session` boundary.
   - **Console Prerequisite**: Email/Password sign-in must be enabled in Firebase Console (`Authentication > Sign-in method > Email/Password`) on project `regal-center-494708-a3`.

## 4. Data Flow & Communication Boundaries

- The browser **never** imports `@google/genai`, `firebase-admin`, or reads server secrets.
- Session persistence uses Firebase `browserLocalPersistence` (IndexedDB); short-lived ID tokens are refreshed via `getIdToken` and transmitted over HTTPS in `Authorization: Bearer <Firebase ID Token>` headers to `/api/v1/*`.
- All API responses conform to `{ success: true, data, meta }` or `{ success: false, error, meta }`.
