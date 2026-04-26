# ADR-0001: Adopt pnpm workspaces + Turborepo for monorepo

## Status
Accepted

## Context
We need to co-locate `apps/web`, `apps/worker`, and several shared packages (`packages/db`, `packages/shared`, `packages/ui`, `packages/config`) in a single repository. The tooling must support: incremental builds, shared TypeScript configs, fast CI, and a clean developer experience.

## Decision
Use **pnpm workspaces** for dependency management and **Turborepo** for task orchestration and caching.

## Rationale
- pnpm's content-addressable store avoids duplicate installs and is faster than npm/yarn for monorepos.
- Turborepo's task graph understands cross-package dependencies; `turbo build` only rebuilds what changed.
- Turborepo remote cache (Vercel or self-hosted) can cut CI times by 60–80% after warm-up.
- Both tools have first-class TypeScript support and are actively maintained.

## Alternatives Considered
- **Nx**: More opinionated, heavier setup, better for very large monorepos. Overkill here.
- **Yarn workspaces + Lerna**: Lerna is in maintenance mode; Yarn v1 hoisting issues with some packages.
- **Single package**: Would force circular dependencies between web and worker; no clean shared-code boundary.

## Consequences
- Developers must use pnpm (enforced via `engines` + `packageManager` field).
- Turborepo config (`turbo.json`) must be kept in sync with actual task dependencies.
