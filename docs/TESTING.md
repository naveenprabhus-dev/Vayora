# Testing Strategy & Verification — Urban Air Quality Assistant

## 1. Testing Pyramid & Levels

1. **Unit Tests (`npm run test:unit`)**:
   - **`packages/contracts/tests/`**: Zod schema validation (registration, login, password strength, password reset confirmation, household location/lifestyle profile), Firestore ID poisoning rejection, RBAC permission matrix invariants, API response envelopes.
   - **`apps/api/tests/unit/`**: Environment loader validation, secret/JWT redaction (`redact.test.ts`), auth/email-verification & `ServerConfiguredRoleResolver` middleware (`auth.middleware.test.ts`), RBAC & IDOR ownership middleware (`authorize.middleware.test.ts`).
   - **`apps/web/tests/unit/`**: Reusable accessible UI primitives (`Button`, `AlertBanner`, `FormField`, `PasswordInput`, `PasswordStrengthMeter`, `SkipLink`, `ErrorBoundary`), full Phase 1 auth/verification/recovery/onboarding/edit flows, and automated `axe-core` WCAG 2.2 AA DOM audits (`components.test.tsx`, `auth-and-onboarding.test.tsx`).
2. **Integration Tests (`npm run test:integration`)**:
   - **`apps/api/tests/integration/`**: Supertest suites running against the full Express pipeline (`createApp()`), verifying:
     - Health endpoints, security headers, 404 envelopes, and non-exposure of secrets.
     - Fail-closed behavior when Firebase verifier is unconfigured (`503`).
     - Auth endpoints (`/api/v1/auth/session`, `/verify-token`, `/password-reset-request`) covering `401`, `403 EMAIL_NOT_VERIFIED`, `429 RATE_LIMITED`, and account-enumeration resistance.
     - Household endpoints (`/api/v1/household/profile`, `/profile/:ownerUid`, `/validate`) covering verified ownership, IDOR blocking (`403`), role-tampering immunity, and Zod `400 VALIDATION_ERROR`.
     - Request body Zod validation (`400 VALIDATION_ERROR`) and rate-limit enforcement (`429 RATE_LIMITED`).
   - External token verification in integration tests uses injected `TokenVerifier` / `RoleResolver` test doubles without weakening production fail-closed defaults.
3. **System & Accessibility E2E Tests (`npm run test:e2e`)**:
   - **`apps/web/tests/e2e/foundation.spec.ts` & `auth-and-onboarding.spec.ts`**: Playwright desktop (`Desktop Chrome`) and mobile (`Pixel 7`) tests verifying Login shell, protected-route redirect, keyboard `Tab` skip-link focus, registration validation + password strength/visibility toggle, enumeration-resistant forgot password, expired reset link recovery, API health verification, and `@axe-core/playwright` full-page WCAG 2.2 AA scans.
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
