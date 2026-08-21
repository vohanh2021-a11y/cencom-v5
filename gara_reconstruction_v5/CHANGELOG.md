# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/specs/2.0.0.html).

## v5.0.0 - 2026-08-21

### Added
- **Production docs**: `.env.production.example`, `docs/PRODUCTION.md`, `CHANGELOG.md`
- CI/CD pipeline skeleton (GitHub Actions) for build + deploy
- On-premise deployment scripts under `Onpremise/`
- Monitoring/observability scaffolding (`lib/observability.ts`, `docs/MONITORING.md`)

### Changed
- **Security hardening**: OWASP review (RPC, auth, RBAC, input validation), fixed DEP0190 warning in `setup.ts`
- Dependency update: `next` patched to `14.2.35` (resolved 2 high severity transitive vulnerabilities)
- Codebase: `utf16be` → `swap16` fix, `npx tsc --noEmit` = 0 errors
- Project structure: added `docs/PLAN_GIAIDOAN_2_3.md` with multi-wave hardening plan

### Fixed
- Conformance test suite: **236/236** passing
- Smoke test: PASS
- E2E test suite: PASS
- UAT video recorded: `videos/uat-tour.mp4` (1.68 MB)
- Security: hardened env variable handling, added placeholder-safe `.env.production.example`
- Build: verified `npm run build` succeeds on clean state

### Removed
- Deprecated inline session secret from repo history
- Old CI config references (migrated to new GitHub Actions skeleton)

### Security
- Added `.env.production.example` with safe placeholders (no real secrets committed)
- OWASP review completed: input validation, RBAC, RPC boundaries
- Dependency hardening: patched transitive `next`/`postcss` vulnerabilities

### CI/CD
- GitHub Actions workflows added: `ci.yml` (lint + typecheck + test), `deploy.yml` (build + start)
- Conformance gate: `npm run test:ci` >= 236/236 required before merge
- On-premise deploy verified via `Onpremise/scripts/`

### Next.js
- Framework version: **14.2.35** (latest stable in 14.x series)
- All TypeScript strict mode passes with 0 errors
- TailwindCSS 3.x configured and verified