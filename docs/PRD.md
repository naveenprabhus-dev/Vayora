# Product Requirements Document (PRD) — Urban Air Quality Assistant

## 1. Problem Statement & Mission

Urban families and neighborhood communities face acute health risks during severe winter smog episodes (temperature inversions, residential solid-fuel heating spikes, and traffic emissions). **Urban Air Quality Assistant** helps verified households reduce daily pollutant exposure and local emissions through actionable, personalized guidance backed by live air-quality data and clear explanations of impact.

## 2. Core Functional Requirements

1. **Low-Emission Daily Routines (`REQ-PROD-01`)**: Actionable daily schedules adapting commuting, outdoor activity, and household energy use to current smog conditions.
2. **Indoor Air Quality Guidance (`REQ-PROD-02`)**: Practical indoor protection recommendations (ventilation timing, filtration maintenance, indoor emission reduction).
3. **Sustainable Alternatives (`REQ-PROD-03`)**: Realistic lower-emission alternatives for daily transport, heating, and household tasks.
4. **Location & Lifestyle Personalization (`REQ-PROD-04`)**: Tailored recommendations combining live air-quality API measurements (with graceful fallback guidance when upstream feeds are unavailable) and household lifestyle context via server-side Gemini AI orchestration.
5. **Direct Impact Explanations (`REQ-PROD-05`)**: Clear, transparent explanations of why each recommendation matters and its measurable health and emissions impact.

## 3. Non-Negotiable Product & Security Constraints

- **Mandatory Verified Accounts**: Account registration and verified email are required for all application features. Guest access is strictly prohibited.
- **Community Focus Without Social Networking**: Community coordinators can publish local air-quality advisories without social feeds, follower graphs, or direct messaging.
- **Strict Scope Discipline**: No unrelated analytics, gamification clutter, or unrequested features.

## 4. Phased Delivery Plan

- **Phase 0 (Current)**: Monorepo architecture, shared contracts, security boundaries, Firestore rules, testing harness, accessibility primitives, documentation, and CI automation.
- **Phase 1**: Firebase Auth provisioning, verified login/registration/password recovery UI, and household onboarding profile persistence.
- **Phase 2**: Live AQI adapter + fallback guidance and Low-Emission Daily Routines module.
- **Phase 3**: Indoor Air Quality Guidance and Sustainable Alternatives Advisor modules.
- **Phase 4**: Location & Lifestyle Gemini AI personalization engine and Coordinator Advisories.
- **Phase 5**: Direct Impact Explanations, end-to-end Playwright/axe regression suite, and final release hardening.
