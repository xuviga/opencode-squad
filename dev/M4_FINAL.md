# M4 final gate

Call these SQUAD tools in order. Do NOT inspect source files, do NOT run shell commands, and do not change code.

1. `tools.squad.review` with `{ mission_id: "m_e872b7f0", task_id: "t_001" }`.
2. `tools.squad.verdict` with `{ mission_id: "m_e872b7f0", task_id: "t_001", timeout_ms: 240000 }`.
3. `tools.squad.finalize` with `{ mission_id: "m_e872b7f0" }`.
4. `tools.squad.report` with `{ mission_id: "m_e872b7f0" }`.

Return the verdict and the final mission status.
