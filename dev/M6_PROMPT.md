# SQUAD M6 integration smoke

Use the SQUAD tools in this exact order. Do not skip steps and do not invent IDs.

1. `tools.squad.mission` with `{ action: "create", title: "SQUAD M6 integration smoke", goal: "Validate merge, audit gate and finalize" }` — save `mission_id`.
2. `tools.squad.plan` with `{ action: "submit", mission_id, plan: { goal: "Validate merge, audit gate and finalize", expectedCostUsd: 0.02, tasks: [{ id: "t_001", title: "Create dev/m6-proof.txt with M6_OK", class: "code", role: "implementer", grade: "G2", acceptance: ["dev/m6-proof.txt exists and contains M6_OK"] }] } }`.
3. `tools.squad.plan` with `{ action: "approve", mission_id }`.
4. `tools.squad.hire` with `{ mission_id, persona: "implementer" }` — save `staff_id` and `worktree_directory`.
5. `tools.squad.assign` with `{ mission_id, task_id: "t_001", staff_id, context: ["Create the file in your worktree and commit it."] }`.
6. `tools.squad.wait` with `{ mission_id, task_id: "t_001", timeout_ms: 180000 }`.
7. `tools.squad.check` with `{ mission_id, task_id: "t_001" }`.
8. `tools.squad.review` with `{ mission_id, task_id: "t_001" }`.
9. `tools.squad.verdict` with `{ mission_id, task_id: "t_001", timeout_ms: 240000 }`.
10. `tools.squad.integrate` with `{ mission_id }` — cherry-pick the worktree commit into main.
11. `tools.squad.audit` with `{ action: "task", mission_id, task_id: "t_001", timeout_ms: 240000 }`.
12. `tools.squad.finalize` with `{ mission_id }` — must pass only with merge + audit.
13. `tools.squad.report` with `{ mission_id }`.

Return the integration result, audit status, and final mission status. Do not do anything else.
