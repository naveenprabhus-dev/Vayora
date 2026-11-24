# Testing Strategy & Verification — Urban Air Quality Assistant

## 1. Testing Pyramid & Levels

1. **Unit Tests (`npm run test:unit`)**:
   - **`packages/contracts/tests/`**: Zod schema validation (registration, login, password strength, password reset confirmation, household location/lifestyle profile, `airQualityQuerySchema`, `coordinatesSchema`, `locationUpdateSchema`, `routinesQuerySchema`, `indoorGuidanceQuerySchema`, `alternativesQuerySchema`, `alternativesCompareQuerySchema`, `advisoryBriefingQuerySchema`, `advisoryExplainBodySchema`, `advisoryCompareBodySchema`, `geminiBriefingOutputSchema`, `geminiExplanationOutputSchema`), Firestore ID poisoning rejection, RBAC permission matrix invariants (`air_quality:read`, `recommendations:read_own`), API response envelopes.
   - **`apps/api/tests/unit/`**: Environment loader validation, secret/JWT redaction (`redact.test.ts`), auth/email-verification & `ServerConfiguredRoleResolver` middleware (`auth.middleware.test.ts`), RBAC & IDOR ownership middleware (`authorize.middleware.test.ts`), Phase 2 Air Quality mapper/EPA+EEA AQI interpreters/pollutants/freshness/caching/winter-smog guidance (`air-quality.utils.test.ts`), Phase 3 Low-Emission Daily Routines engine (`routines.engine.test.ts`), Phase 4 Indoor Air Quality Assistant engines (`indoor.engine.test.ts`), Phase 5 Sustainable Alternatives engine & comparison utility (`alternatives.engine.test.ts`), and Phase 6 GenAI guardrails, context minimization, SHA-256 caching, coalescing, and operational metrics (`advisory.guardrails.test.ts`).
   - **`apps/web/tests/unit/`**: Reusable accessible UI primitives (`Button`, `AlertBanner`, `FormField`, `PasswordInput`, `PasswordStrengthMeter`, `SkipLink`, `ErrorBoundary`), full Phase 1 auth/verification/recovery/onboarding/edit flows, VAYORA Air Quality Intelligence dashboard (`air-quality-dashboard.test.tsx`), Low-Emission Daily Routines (`daily-routines.test.tsx`), Indoor Air Quality Assistant (`indoor-air-assistant.test.tsx`), Sustainable Alternatives Advisor (`sustainable-alternatives.test.tsx`), Personalized Daily Briefing & Impact Explorer (`personalized-advisory.test.tsx`), and automated `axe-core` WCAG 2.2 AA DOM audits.
2. **Integration Tests (`npm run test:integration`)**:
   - **`apps/api/tests/integration/`**: Supertest suites running against the full Express pipeline (`createApp()`), verifying:
     - Health endpoints, security headers, 404 envelopes, and non-exposure of secrets.
     - Fail-closed behavior when Firebase verifier is unconfigured (`503`).
     - Auth endpoints (`/api/v1/auth/session`, `/verify-token`, `/password-reset-request`) covering `401`, `403 EMAIL_NOT_VERIFIED`, `429 RATE_LIMITED`, and account-enumeration resistance.
     - Household endpoints (`/api/v1/household/profile`, `/profile/:ownerUid`, `/validate`) covering verified ownership, IDOR blocking (`403`), role-tampering immunity, and Zod `400 VALIDATION_ERROR`.
     - Air Quality Intelligence endpoints (`/api/v1/air-quality/{current,forecast,pollutants,guidance,health,location}`) covering auth/email verification gates, geocoding & telemetry cache hits, stale fallback, honest unavailable responses, coordinate/query validation, IDOR protection, and rate limits (`air-quality.routes.integration.test.ts`).
     - Low-Emission Daily Routines (`/api/v1/routines/{daily,refresh}`), Indoor Air Quality Assistant (`/api/v1/indoor-air/{guidance,refresh}`), Sustainable Alternatives (`/api/v1/alternatives/{recommendations,compare,refresh}`), and Phase 6 GenAI Advisory (`/api/v1/advisory/{briefing,explain-recommendation,compare-choices,refresh,metrics}`) covering auth/verification, missing household profile (`404`), strict Zod rejection (`400`), valid Gemini output, guardrail-triggered deterministic fallback, timeout fallback, unconfigured fallback, stale/unavailable disclosures, caching, and AI rate limits (`429`).
     - Request body Zod validation (`400 VALIDATION_ERROR`) and rate-limit enforcement (`429 RATE_LIMITED`).
   - External token verification, Gemini client calls, and Open-Meteo providers in integration tests use injected test doubles without weakening production fail-closed defaults.
3. **System & Accessibility E2E Tests (`npm run test:e2e`)**:
   - **`apps/web/tests/e2e/foundation.spec.ts`, `auth-and-onboarding.spec.ts`, `air-quality-dashboard.spec.ts`, `daily-routines.spec.ts`, `indoor-air-assistant.spec.ts`, `sustainable-alternatives.spec.ts`, & `personalized-advisory.spec.ts`**: Playwright desktop (`Desktop Chrome`) and mobile (`Pixel 7`) tests verifying Login shell, protected-route redirect, keyboard `Tab` skip-link focus, registration validation, forgot/reset password recovery, live VAYORA Air Quality dashboard, Low-Emission Daily Routines, Indoor Air Quality Assistant, Sustainable Alternatives Advisor, Personalized Daily Briefing & 6-part Impact Explorer (Gemini vs deterministic fallback, Choice Comparison, unavailable telemetry disclosure), and `@axe-core/playwright` full-page WCAG 2.2 AA scans.
4. **Security Rules Static Analysis & Emulator Suite (`npm run lint:rules` & `infrastructure/firebase/firestore.rules.test.ts`)**:
   - Runs ESLint with `@firebase/eslint-plugin-security-rules` against `firestore.rules` and `infrastructure/firebase/firestore.rules.test.ts` (adversarial `@firebase/rules-unit-testing` suite requiring JVM Firestore Emulator).

## 2. Execution Commands

| Check                                           | Command                    |
| :---------------------------------------------- | :------------------------- |
| Type checking (all workspaces)                  | `npm run typecheck`        |
| Full lint (typecheck + oxlint + eslint + rules) | `npm run lint`             |
| Formatting check                                | `npm run format:check`     |
| Unit tests                                      | `npm run test:unit`        |
| Integration tests                               | `npm run test:integration` |
| Accessibility unit tests                        | `npm run test:a11y`        |
| Full-page Playwright + axe E2E                  | `npm run test:e2e`         |
| Production builds (web + api)                   | `npm run build`            |

## 3. CI Quality Gates

`.github/workflows/ci.yml` executes formatting checks, static linting (including Firestore rules), strict TypeScript checks, unit tests, integration tests, production builds, secret-pattern scanning, and Playwright/axe-core E2E checks. Any failure blocks the pipeline.
