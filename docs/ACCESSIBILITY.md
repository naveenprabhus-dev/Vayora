# Accessibility Standards — Urban Air Quality Assistant

## 1. Compliance Target

Every user-facing view and reusable component targets **WCAG 2.2 Level AA** compliance. Accessibility is treated as a build-blocking requirement rather than a post-hoc audit.

## 2. Mandatory Implementation Standards

1. **Semantic Landmarks & Heading Hierarchy**:
   - Every page renders a single `<header>`, `<nav>`, `<main id="main-content">`, and `<footer>`.
   - Headings follow a strict sequential hierarchy (`h1` -> `h2` -> `h3`) with no skipped levels.
2. **Keyboard Accessibility & Focus Management**:
   - First tabbable element on every page is `<SkipLink targetId="main-content" />`.
   - All interactive controls use native `<button>`, `<a>`, or `<input>` elements.
   - Global `:focus-visible` outlines (`3px solid #0F5132`, `2px` offset) remain visible across every interactive surface.
   - Touch and click targets maintain a minimum `44px` height (`min-h-11`).
3. **No Color-Only Status Communication**:
   - Status alerts (`AlertBanner`) and future air-quality severity indicators pair color with an explicit text label (`Verified:`, `Notice:`, `Error:`) and an icon (`aria-hidden="true"`).
4. **Accessible Forms & Error Messaging (Phase 1+ Standard)**:
   - Every input must bind an explicit `<label htmlFor=...>`.
   - Validation errors must link via `aria-describedby` and `aria-invalid="true"`, announcing summaries in an accessible live region (`role="alert"`).
5. **Screen-Reader & Motion Support**:
   - Dynamic status regions use `aria-live="polite"` (non-blocking) or `role="alert"` (critical).
   - `prefers-reduced-motion` is respected in both CSS (`globals.css`) and JS (`useReducedMotion`).
   - Numeric telemetry and AQI readings use `tabular-nums` (`IBM Plex Mono`) to prevent layout jitter.

## 3. Automated & Manual Verification

- **Automated**:
  - `oxlint` enforces `jsx-a11y/*` rules at lint time.
  - Vitest + `axe-core` runs WCAG 2.2 AA assertions on component/app DOM renders (`npm run test:a11y`).
  - Playwright + `@axe-core/playwright` verifies live browser rendering, color contrast, and keyboard navigation (`npm run test:e2e`).
- **Manual Checklist (Required for Phases 1–5)**:
  - Complete keyboard-only traversal (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`) with visible focus at 1440px and 390px viewports.
  - 200% browser zoom verification without horizontal clipping or overlapping controls.
