# Firestore Security Specification (Phase 0 TDD Baseline)

## 1. Core Data Invariants

1. **No Guest Access**: Unauthenticated (`request.auth == null`) or unverified (`email_verified != true`) principals cannot read or write any document.
2. **No Self-Assigned Roles**: Creating `/users/{userId}` with `role != "regular_user"` is always denied.
3. **Strict PII Isolation**: Account email addresses are stored exclusively in `/users/{userId}/private/info` and are readable only by the owning UID or an administrator.
4. **Immutable Ownership & Timestamps**: `ownerUid` / `authorUid` and `createdAt` cannot be modified after creation; `createdAt` and `updatedAt` must equal `request.time`.
5. **Terminal State Locking**: Archived community advisories (`status == "archived"`) cannot be modified by non-admin coordinators.
6. **Zero Shadow Fields**: Extra fields outside the explicit allowlist on `create` or `update` are rejected.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: `PERMISSION_DENIED`)

1. Unauthenticated read on `/households/h1` (`request.auth == null`).
2. Unverified-email user write to `/households/h1` (`email_verified: false`).
3. Privilege escalation on user creation: `/users/u1` with `{ role: "admin" }`.
4. Role tampering on user update: `/users/u1` modifying `role` from `"regular_user"` to `"community_coordinator"`.
5. Shadow field injection on household create: adding `isPremium: true`.
6. Cross-tenant IDOR read on `/users/otherUid/private/info`.
7. Cross-tenant IDOR write on `/households/h1` where `ownerUid != request.auth.uid`.
8. Oversized path ID poisoning (`/households/<150-char-id>` or `/households/bad$id`).
9. Client-spoofed `createdAt` timestamp not equal to `request.time`.
10. Unbounded array poisoning in `sensitivityGroups` (`size > 5` or invalid enum value).
11. Regular user attempting to create a `/communityAdvisories/adv1` document.
12. Coordinator attempting to update an already `archived` community advisory.
