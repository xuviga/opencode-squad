# SQUAD M4 continuation

The reviewer failed only because the diff was read from the main checkout. That is fixed: `taskDiff` now uses the staff worktree directory.

Call these SQUAD tools in order. Do NOT inspect source files, do NOT run shell commands, and do not change code. Only call the tools.

1. `tools.squad.check` with `{ mission_id: "m_e872b7f0", task_id: "t_001" }` — capture the worktree diff.
2. `tools.squad.review` with `{ mission_id: "m_e872b7f0", task_id: "t_001" }`.
3. `tools.squad.verdict` with `{ mission_id: "m_e872b7f0", task_id: "t_001", timeout_ms: 240000 }`.
4. `tools.squad.finalize` with `{ mission_id: "m_e872b7f0" }`.
5. `tools.squad.report` with `{ mission_id: "m_e872b7f0" }`.

Return the check diff file list, the verdict, and the final mission status.
