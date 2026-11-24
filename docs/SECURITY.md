# Security Architecture — Urban Air Quality Assistant

## 1. Threat Model & Core Principles

1. **Fail Closed**: Unconfigured authentication verifiers, missing tokens, invalid tokens, or unverified email claims strictly deny access (`401`, `403`, or `503`). There is no guest mode and no simulated/bypass auth path.
2. **Never Trust the Client**: Frontend-supplied roles, ownership IDs, timestamps, or permission flags are ignored. Authorization derives exclusively from verified token `uid` and trusted server/Firestore records.
3. **Secret Isolation**: `GEMINI_API_KEY`, server credentials, and third-party API keys live exclusively on the server (`apps/api`) and are never exposed to client bundles (`VITE_*`) or HTTP error payloads.

## 2. Authentication Design (`MOD-AUTH`, Phase 1 Active)

- **Provider**: Firebase Authentication (Email/Password, email verification, and password recovery with `oobCode` action-link validation).
- **Session Persistence Strategy**:
  - Client sessions persist refresh state in IndexedDB via Firebase `browserLocalPersistence`; raw secrets or privileged tokens are never stored in `localStorage` or `sessionStorage`.
  - Short-lived Firebase ID tokens are retrieved on demand and verified server-side on every protected request (`GET /api/v1/auth/session`, `POST /api/v1/auth/verify-token`, `/api/v1/household/*`, `/api/v1/system/*`).
- **Email Verification Gate**:
  - Frontend never trusts `user.emailVerified` alone; after `reload()` + `getIdToken(true)`, it confirms verification status against `GET /api/v1/auth/session`.
  - Express middleware (`requireVerifiedEmail`) rejects any principal with `emailVerified !== true` using HTTP `403 EMAIL_NOT_VERIFIED`.
  - Firestore rules (`isVerifiedUser()`) enforce `request.auth.token.email_verified == true` on every read and write.
- **Account-Enumeration Protection**:
  - `POST /api/v1/auth/password-reset-request` and `FirebaseAuthService.sendPasswordReset` return a uniform `200` confirmation message regardless of whether the email address is registered.
- **Session Expiration & Revocation**:
  - `FirebaseAdminTokenVerifier` maps expired/revoked token errors (`auth/id-token-expired`, `auth/id-token-revoked`) to HTTP `401`.
  - When deployed on a user-owned GCP project with `roles/firebaseauth.viewer` IAM granted, `FirebaseAdminTokenVerifier` supports `checkRevoked: true` (`verifyIdToken(token, true)`). On Starter Tier projects without IAM, token signature and expiry validation (`verifyIdToken(token)`) remain active without IAM.

## 3. Authorization & Ownership Model (RBAC + ABAC)

| Role                    | Intended Holders                         | Permitted Capabilities                                                                                                |
| :---------------------- | :--------------------------------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `regular_user`          | Families & household members             | Read/write own household profile (`ownerUid == uid`), generate own recommendations, read active community advisories. |
| `community_coordinator` | Verified local neighborhood coordinators | All `regular_user` capabilities plus publishing/updating own `communityAdvisories` (no admin or user-PII access).     |
| `admin`                 | System administrators                    | System audit verification, coordinator role management, advisory moderation.                                          |

- **Privilege Escalation Prevention**:
  - `firestore.rules` forces `role == 'regular_user'` on user account creation and prevents users from modifying their own `role` field.
  - Admin and coordinator privileges are stored in dedicated `/admins/{uid}` and `/coordinators/{uid}` lookup documents writable only by admins.
- **IDOR Prevention**:
  - Express routes use `requireOwnership((req) => req.params.ownerUid)`.
  - Firestore `get`, `list`, `update`, and `delete` rules explicitly evaluate `existing().ownerUid == request.auth.uid` (and `resource.data.ownerUid == request.auth.uid` on `list`).

## 4. PII Isolation & Input Validation

- **Split Collection Strategy**: Non-PII account metadata lives at `/users/{userId}` while email addresses are isolated in `/users/{userId}/private/info` readable only by the owner or an admin.
- **Synchronized Validation**: `@uaqa/contracts` Zod schemas, `firebase-blueprint.json`, and `firestore.rules` enforce identical `maxLength` and `pattern` bounds to block payload poisoning and shadow fields.

## 5. API Hardening & Secret Leakage Prevention

- **Security Headers**: `helmet` sets `X-Content-Type-Options: nosniff`, `Referrer-Policy`, removes `X-Powered-By`, and applies strict CSP in production.
- **Strict CORS**: Explicit origin allowlist configured via `CORS_ALLOWED_ORIGINS`.
- **Rate Limiting**: `express-rate-limit` enforces sliding-window limits returning standardized `429 RATE_LIMITED` responses.
- **Log Redaction**: `redactSensitiveData` strips `Authorization`, `Cookie`, `API keys` (`AIza...`), and JWT strings before any structured log is emitted.
- **Repository Hygiene**: `.gitignore` blocks `.env`, `.env.*` (except `.env.example`), `*serviceAccount*.json`, `firebase-adminsdk-*.json`, `*.pem`, and `*.key`. CI scans for leaked key patterns before merge.

## 6. External Environmental Provider Isolation (Phase 2 Active)

- **Server-Only Provider Communication**: All Open-Meteo Air Quality and Geocoding requests execute exclusively inside `apps/api/src/modules/air-quality/providers/open-meteo.provider.ts` with `AbortController` timeouts (5,000 ms), bounded single transient retries, 512 KB response size caps, and strict Zod validation. The browser never communicates with upstream provider endpoints directly.
- **Strict Query & Coordinate Validation**: `airQualityQuerySchema` enforces paired numeric `latitude` (`[-90, 90]`) and `longitude` (`[-180, 180]`), integer `hours` (`1..48`), valid AQI scale identifiers, and `.strict()` unknown-key rejection (blocking `userId`/`ownerUid` tampering).
- **Protected Routes & Ownership**: Every `/api/v1/air-quality/*` endpoint enforces `authenticate`, `requireVerifiedEmail`, and `requirePermission('air_quality:read')` (or `'profile:write_own'` for `PUT /location`), resolving saved household locations exclusively from authenticated `req.principal.uid`.

## 7. Server-Side GenAI Security & Hallucination Guardrails (Phase 6 Active)

- **Strict Secret Isolation**: `@google/genai` is imported and executed solely on the backend (`apps/api/src/services/ai/geminiClient.ts`) using `GEMINI_API_KEY`; keys are never included in client bundles, logs, or API error responses.
- **PII & Context Minimization**: `buildMinimizedAdvisoryContext` strips `ownerUid`, email addresses, auth claims, and raw tokens before prompt serialization, and sanitizes user-editable strings (`city`, `neighborhood`) against control characters and instruction tags (`<VERIFIED_DATA_JSON>` isolation).
- **Deterministic Authority & Guardrail Validation**: Every Gemini structured response undergoes Zod validation, strict evidence ID allowlist verification, recommendation status cross-checking (blocking contradictory outdoor cycling during `not_advised_now` or unqualified HEPA CO-capture claims), and numerical/monetary hallucination detection—failing safely to deterministic fallback on any violation or timeout.
- **Dedicated AI Rate Limiting & Ownership**: All `/api/v1/advisory/*` routes enforce `authenticate`, `requireVerifiedEmail`, ownership-scoped SHA-256 fingerprint caching, and sensitive-route rate limiting (`429 RATE_LIMITED`).
