# SQUAD M2 smoke instructions

Use the SQUAD tools in this exact order. Do not skip steps and do not invent IDs.

1. `tools.squad.review` with `{ mission_id: "m_002859ec", task_id: "t_001" }` — start a blind reviewer one grade above the worker.
2. `tools.squad.verdict` with `{ mission_id: "m_002859ec", task_id: "t_001", timeout_ms: 240000 }` — wait for the reviewer and apply the verdict.
3. `tools.squad.report` with `{ mission_id: "m_002859ec" }` — build the mission report.

Return the final verdict JSON and the report markdown. Do not do anything else.
