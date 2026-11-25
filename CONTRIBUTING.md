# Contributing to SQUAD

Thanks for looking at the code. This repository is small on purpose: a single
plugin, a SQLite schema and a test suite. Everything below is what actually
runs on this machine, not an aspiration.

## Requirements

- Node 22+ and Bun 1.3+ (the plugin loads TypeScript sources directly; there is
  no build step);
- OpenCode `2.4.1` for a live run;
- git, because worktree isolation shells out to it.

## Setup

```bash
git clone https://github.com/xuviga/opencode-squad.git
cd opencode-squad
bun install
bun run verify
```

`bun run verify` is the same gate CI uses: `tsc --noEmit`, `biome check src tests`
and `bun test`. A pull request that makes it fail will not be merged.

## Where things live

| Path | Responsibility |
|---|---|
| `src/index.ts` | plugin entry: 29 tool registrations, RPC, in-place lock |
| `src/tools/*` | one file per tool, namespace `squad` |
| `src/db/` | schema, migrations, model mapping, store facade and repositories |
| `src/runtime/` | hire, worktree, diff, snapshot, integration, sessions, gc |
| `src/*.ts` | contracts: plan, verdict, report, ruling, capabilities, classes |
| `.opencode/agents/` | the three no-tool reviewer/arbiter/auditor agents |
| `tests/` | 23 files, 107 cases |

## Changing behaviour

Almost every change belongs to one of three places, in this order:

1. **Schema** — add a migration to `src/db/schema.ts`. Never edit an existing
   one: databases in the wild have already run it.
2. **Repository** — the state machine. A transition that is not guarded here
   does not exist, because the tool layer is not trusted to enforce it.
3. **Tool** — arguments, `permission.assert`, prompt text. Tools must stay thin
   and return `{ ok: true, ... }` or `{ ok: false, error }`.

If a change touches a security-relevant gate (plan approval, permissions,
integration, evidence), add a test in `tests/gates.test.ts`.

## Style

- Biome is the formatter and the linter: `bun run lint:fix` before committing.
- TypeScript strict, no `any`. If a host type is missing, narrow it at the
  boundary and explain why in a comment.
- Comments explain *why*, not *what*. Keep them short.
- Prompt text is code: it is reviewed, versioned and tested like everything
  else.

## Commits

Conventional prefixes: `feat:`, `fix:`, `docs:`, `test:`, `chore:`. The subject
line says what changed, the body says why and what it costs. One logical change
per commit; version bumps and their changelog entry go together.

## Pull requests

- Describe the problem before the solution.
- List the commands you ran (`bun run verify`, a live mission, a git
  reproduction).
- If the change alters a documented guarantee, update `README.md` and
  `docs/PLAN.md` in the same commit.
- Add a `CHANGELOG.md` entry under `Unreleased` for user-visible changes.

## Releasing

1. Bump `package.json`, `src/version.ts`, `README.md` and `CHANGELOG.md`.
2. Add `docs/releases/v<version>.md` with the notes that go to GitHub.
3. `git tag -a v<version> -m "SQUAD <version>"` and push the tag.
4. The `release` workflow publishes the GitHub release from that file.

## Security

Do not open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
