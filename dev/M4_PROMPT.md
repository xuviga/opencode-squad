# SQUAD M4 smoke instructions

Use the SQUAD tools in this exact order. Do not skip steps and do not invent IDs.

1. `tools.squad.mission` with `{ action: "create", title: "SQUAD M4 worktree smoke", goal: "Validate worktree isolation and finalize gate" }` — save `mission_id`.
2. `tools.squad.plan` with `{ action: "submit", mission_id, plan: { goal: "Validate worktree isolation and finalize gate", expectedCostUsd: 0.01, tasks: [{ id: "t_001", title: "Create dev/m4-proof.txt with M4_OK", class: "code", role: "implementer", grade: "G2", acceptance: ["dev/m4-proof.txt exists and contains M4_OK"] }] } }`.
3. `tools.squad.plan` with `{ action: "approve", mission_id }`.
4. `tools.squad.hire` with `{ mission_id, persona: "implementer" }` — save `staff_id` and `worktree_directory`.
5. `tools.squad.tasks` with `{ mission_id }` — confirm `t_001` is `ready`.
6. `tools.squad.assign` with `{ mission_id, task_id: "t_001", staff_id, context: ["Create the file in your worktree, not the main checkout."] }`.
7. `tools.squad.wait` with `{ mission_id, task_id: "t_001", timeout_ms: 180000 }`.
8. `tools.squad.check` with `{ mission_id, task_id: "t_001" }` — confirm the diff comes from the worktree and includes `m4-proof.txt`.
9. `tools.squad.review` with `{ mission_id, task_id: "t_001" }`.
10. `tools.squad.verdict` with `{ mission_id, task_id: "t_001", timeout_ms: 240000 }`.
11. `tools.squad.tasks` with `{ mission_id }` — confirm `t_001` is `integrated` and mission is `integrating`.
12. `tools.squad.finalize` with `{ mission_id }` — this must succeed and set mission `done`.
13. `tools.squad.report` with `{ mission_id }`.

Return the worktree directory, the file list from the check diff, the final verdict, and the final mission status. Do not do anything else.
