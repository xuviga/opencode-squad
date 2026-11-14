# SQUAD M2 rework smoke instructions

Use the SQUAD tools in this exact order. Do not skip steps and do not invent IDs.

1. `tools.squad.assign` with `{ mission_id: "m_002859ec", task_id: "t_001", staff_id: "s_c375538b" }` — rework the returned task with the same writer; the brief includes the previous verdict findings.
2. `tools.squad.wait` with `{ mission_id: "m_002859ec", task_id: "t_001", timeout_ms: 180000 }`.
3. `tools.squad.check` with `{ mission_id: "m_002859ec", task_id: "t_001" }`.
4. `tools.squad.review` with `{ mission_id: "m_002859ec", task_id: "t_001" }`.
5. `tools.squad.verdict` with `{ mission_id: "m_002859ec", task_id: "t_001", timeout_ms: 240000 }`.
6. `tools.squad.report` with `{ mission_id: "m_002859ec" }`.

Return the final verdict JSON and the report markdown. Do not do anything else.
