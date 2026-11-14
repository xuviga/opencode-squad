# SQUAD M3 HR smoke instructions

Use the SQUAD tools in this exact order. Do not skip steps and do not invent IDs.

1. `tools.squad.mission` with `{ action: "create", title: "SQUAD M3 HR smoke", goal: "Validate scorecard/appraise/fire/blacklist" }` — save `mission_id`.
2. `tools.squad.plan` with `{ action: "submit", mission_id, plan: { goal: "Validate scorecard/appraise/fire/blacklist", expectedCostUsd: 0, tasks: [{ id: "t_001", title: "HR smoke task", class: "writing", role: "scribe", grade: "G1", acceptance: ["no work required"] }] } }`.
3. `tools.squad.plan` with `{ action: "approve", mission_id }`.
4. `tools.squad.hire` with `{ mission_id, persona: "scribe" }` — save `staff_id`.
5. `tools.squad.appraise` with `{ staff_id, delta: 0.2, note: "M3 smoke praise" }`.
6. `tools.squad.scorecard` with `{ staff_id }`.
7. `tools.squad.career` with `{ staff_id, action: "evaluate" }`.
8. `tools.squad.fire` with `{ staff_id, reason: "M3 smoke firing", evidence_ref: "dev/M3_PROMPT.md" }`.
9. `tools.squad.hire` with `{ mission_id, persona: "scribe" }` — this must fail with a blacklist error; capture the error text.
10. `tools.squad.report` with `{ mission_id }`.

Return the scorecard JSON, the fired staff status, and the error text from step 9. Do not do anything else.
