# SQUAD M1 smoke instructions

Use the SQUAD tools in this exact order. Do not skip steps and do not invent IDs.

1. `tools.squad.mission` with `{ action: "create", title: "SQUAD M1 smoke", goal: "Validate hire/assign/wait/check" }` — save `mission_id`.
2. `tools.squad.plan` with `{ action: "submit", mission_id, plan: { goal: "Validate hire/assign/wait/check", expectedCostUsd: 0.01, tasks: [{ id: "t_001", title: "Write a one-line proof", class: "writing", role: "writer", grade: "G2", acceptance: ["report contains status done"] }] } }`.
3. `tools.squad.plan` with `{ action: "approve", mission_id }`.
4. `tools.squad.hire` with `{ mission_id, persona: "writer" }` — save `staff_id`.
5. `tools.squad.assign` with `{ mission_id, task_id: "t_001", staff_id }`.
6. `tools.squad.wait` with `{ mission_id, task_id: "t_001", timeout_ms: 180000 }`.
7. `tools.squad.check` with `{ mission_id, task_id: "t_001" }`.

Return the final `check` JSON and the `staff_id`. Do not do anything else.
