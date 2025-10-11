# Contributing

Thanks for helping evolve HexMUD! This document outlines the expectations for contributors while the monorepo scaffolding is taking shape.

## Workflow

1. **Create a Feature Plan** – Use the `/speckit` flow to capture requirements, research, and tasks before writing code.
2. **Follow the Tasks** – Implementation work should map directly to the checklist in `specs/<feature>/tasks.md`. Mark tasks as complete in the document as you finish them.
3. **Commit Style** – Follow the conventional commits spec. Use the smallest practical scope (e.g. `feat(server): add heartbeat rate limiting`). Keep subject lines ≤72 characters and body paragraphs wrapped at 100.
4. **Pull Requests** – Reference the associated feature plan and describe how the acceptance criteria are satisfied. Include screenshots or CLI output when helpful.

## Coding Standards

- TypeScript strict mode everywhere (`tsconfig.base.json`).
- Prefer type-only imports when available.
- Maintain shared protocol changes in `packages/protocol` and bump `PROTOCOL_VERSION` when breaking changes are introduced.
- Avoid adding persistence or third-party services without an approved plan.
- Keep shared packages reusable across at least two apps before introducing new workspaces.

## Tooling

- **Linting**: `pnpm run lint`
- **Formatting**: Prettier is configured via `.prettierignore`; configure your editor to format on save.
- **Testing**: `pnpm run test` executes Vitest across workspaces. Add or update tests when modifying behavior.
- **Bootstrap**: `pnpm run bootstrap` installs dependencies and will soon run additional validation (see `scripts/bootstrap.ts`).

## Commit Message Guide

- **Format**: `<type>(optional scope): <present-tense summary>`
- **Common types**: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`.
- **Body**: Add context, breaking-change callouts (`BREAKING CHANGE:`), and links to feature specs when relevant.
- **Scope**: Use a package or app identifier (`server`, `web`, `protocol`, `scripts`).
- **Examples**:
	- `feat(protocol): add room.state schema`
	- `fix(server): reject stale heartbeats`
	- `docs: clarify bootstrap requirements`

## Protocol Change Workflow

1. Edit schemas or constants in `packages/protocol`.
2. Run `pnpm run test` to ensure the shared contract still passes all suites.
3. Execute `pnpm run bump:protocol <next-version>` to increment `PROTOCOL_VERSION` and update the changelog.
4. Restart any running dev processes so server and web pick up the new version.
5. Document behavioral differences in `README.md` or the relevant feature spec, and note the version number in your PR description.

## Documentation

- Update `README.md`, `quickstart.md`, and any relevant spec documents when workflows change.
- Keep `.env.example` aligned with the required environment variables.

## Code of Conduct

Be respectful, inclusive, and collaborative. Raise concerns early and document decisions in the feature plan or research notes.
