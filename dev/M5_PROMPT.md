# SQUAD M5 smoke

Call these SQUAD tools in order. Do NOT inspect source files, do NOT run shell commands, and do not change code.

1. `tools.squad.dispute` with `{ action: "list", mission_id: "m_e872b7f0" }`.
2. `tools.squad.audit` with `{ action: "task", mission_id: "m_e872b7f0", task_id: "t_001", timeout_ms: 240000 }`.
3. `tools.squad.report` with `{ mission_id: "m_e872b7f0" }`.

Return the audit status, audit verdict, and the audits list from the report.
