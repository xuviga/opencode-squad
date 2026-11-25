# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 0.9.x | yes |
| 0.8.x and older | no |

Only the latest minor line gets fixes. The plugin loads its sources directly,
so "upgrading" means pulling the repository and restarting the host
(`opencode service restart`).

## Reporting a vulnerability

Do not open a public issue. Send a private report to
**xuvigan@users.noreply.github.com** with:

- affected version and platform;
- what an attacker controls (a plan? a worker report? a repository?);
- the smallest reproduction you have;
- the impact you believe it has.

You will get an acknowledgement within a few days. If the report is valid, a
fix and a release note land together, and you are credited unless you ask not
to be.

## What the plugin does with trust

SQUAD hires child sessions, gives them file and shell access based on the
persona, and lets them write to a worktree or to the project folder. The
security model is deliberately explicit:

- **Plan gate.** `squad_plan` and `squad_mission` call `permission.assert`.
  A denied permission leaves the mission in `plan_gate`; nothing is hired.
- **Isolation.** Worktree missions put each writer in its own git worktree and
  move the child session there; the move is verified and fails closed.
  `isolation: "none"` runs employees directly in the project folder and is
  weaker by design — one in-place mission owns a folder at a time via
  `.squad/locks/inplace.json`.
- **Blind review.** Reviewers receive the brief, the report and the diff only.
  They are hired with `* deny` permissions and two steps: no tools, no files,
  no shell.
- **Deterministic evidence.** Before any model is paid, an integrated worktree
  task must have a commit that is an ancestor of `main`. A missing commit fails
  the audit without spending tokens.
- **Integration.** Cherry-picks refuse a dirty `main`; a failed batch rewinds
  to the batch HEAD and unmarks its tasks.

## Known limitations (not vulnerabilities, but read them)

- There is no secret scanning and no prompt-injection wrapper. A worker can be
  told to leak a file it can read; permissions are the boundary, not the
  prompt.
- `report.status` does not change the task status; only a reviewer verdict
  does.
- The in-place mode has no history and no rollback. Snapshots are copies of
  text files under `.squad/snapshots/`; binaries and files over 2 MB are only
  fingerprinted.
- Child sessions run with the model and provider configured in
  `src/config.ts`. A malicious plan cannot pick another provider, but it can
  pick a grade and therefore a more expensive model.
