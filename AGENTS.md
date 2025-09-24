# Repository Guidelines

## Scope & Vision

- `stream-markdown` is a single-package library that streams Markdown into React
  components with headless primitives.
- We work exclusively with the Deno toolchain; all commands, scripts, and
  tooling run through `deno`.
- Priority: ergonomic developer experience for consumers (React apps, AI
  tooling) and robust handling of partial/dirty Markdown input.
- Keep the core package small; optional experiences (preview playgrounds, docs)
  live in supporting tooling.

## Repository Layout

- `src/`: TypeScript source for the library. Keep exports consolidated through a
  single public entry point (`mod.ts` or `src/index.ts`) so bundlers tree-shake
  cleanly.
- `README.md`: user-facing overview. Maintain feature parity with actual
  implementation before updating roadmap checkboxes.
- `deno.json`: shared config for formatting/linting/tests. Add tasks here rather
  than scattering shell scripts.
- `package.json`: metadata for downstream bundlers/registries; keep runtime
  dependencies minimal and align exported entry points with the compiled output.
- `examples/` (planned): Vite + React preview apps. Each example should depend
  on the local package source via relative paths or import maps, never a
  published version.

## Tooling & Dependencies

- Package management: always add dependencies via the Deno CLI. Use
  `deno add npm:<pkg>` for runtime deps and `deno add -D npm:<pkg>` for dev-only
  tooling.
- Publishing target: the library ships to npm, so dependencies must come from
  npm (no jsr-only packages in production code).
- Imports: never commit source files that use `jsr:` or `npm:` prefixes. After
  `deno add`, reference modules via the bare specifier Deno records in the
  import map (e.g. `import React from 'react'`).
- Never modify import maps manually; use `deno add` to update them.
- Standard library usage: Deno std modules are allowed only in tests. Add them
  with commands like `deno add jsr:@std/assert` and scope their imports to
  `*.test.ts` files.

## Local Development Workflow

- Tooling: install `deno` ≥ 2; Deno's Node compatibility is sufficient to run
  Vite and other preview tooling without external package managers.
- Formatting: run `deno fmt` before committing.
- Static checks: add `deno task lint` and `deno task check` once the codebase
  grows; for now, run `deno lint` and `deno check src/**/*.ts` manually if
  needed.
- Testing: use `deno test` for unit coverage. Keep tests colocated with the
  modules they exercise (e.g. `src/foo.test.ts`).
- Build artifacts: expose ESM by default; consider generating CJS/types via a
  lightweight build pipeline (`deno task build` invoking `esbuild` or similar)
  when the API stabilizes.

## Preview & Examples

- Place previews under `examples/<name>`. Recommended layout:
  - `examples/basic`: minimal streaming preview.
  - `examples/directives`: directive-heavy scenarios.
- Give each example its own `deno.json` with tasks such as `dev` and `build`.
  Use `deno task dev` to launch Vite through Deno's compatibility layer.
- Add a workspace-style import map so examples resolve the library from `../src`
  (or the compiled output) rather than a registry install.
- Keep examples optional—core library must remain usable without building the
  preview.

## Coding Standards

- Style: two-space indentation, single quotes, no semicolons (enforced by
  `deno fmt`).
- Types: treat the library as `strict` TypeScript. Leverage explicit return
  types for exported functions/components.
- React components should be headless; do not ship default styles. Expose
  hooks/utilities for consumers to wire their own UI.
- Prefer pure functions for Markdown transforms; guard async or streaming code
  paths with strong type contracts.

## Testing Strategy

- Unit tests: cover block identity generation, streaming diff logic, directive
  resolution.
- Snapshot tests: acceptable for rendered AST/React trees but keep fixtures
  small and derive from real Markdown snippets.
- Integration tests (optional): drive streaming scenarios through Deno test
  servers or Vitest once the public API stabilizes (also executed via Deno).
- Continuous checks: wire `deno fmt`, `deno lint`, and `deno test` into CI
  before first release.

## Versioning & Releases

- Follow semantic versioning. Start at `0.x` until the streaming API stabilizes.
- Update `CHANGELOG.md` (add this file when appropriate) with notable changes
  before publishing.
- Use your chosen registry tooling (`deno publish`, `jsr publish`, etc.) from
  the repo root. Double-check the build output and type declarations before
  release.

## Collaboration Guidelines

- Commits: short imperative subject (e.g. `Implement streaming buffer`,
  `Fix directive resolver error`).
- PRs: describe behavior changes, include reproduction steps for bug fixes, and
  link to README updates when new features land.
- Issues: capture open questions about streaming semantics, directive
  extensibility, or preview tooling.

## Security & Operational Notes

- Never commit API keys or AI provider tokens used in streaming demos. Load them
  from `.env.local` in examples (ensure `.env*` stays gitignored).
- External network access is allowed; prefer pinned versions when adding
  dependencies through Deno's compatibility layer to avoid supply-chain drift.
- Keep dependencies minimal; review Markdown/HTML sanitizer choices carefully
  due to XSS risk.
