# M4 diff diagnostic

Call exactly one SQUAD tool:

`tools.squad.check` with `{ mission_id: "m_e872b7f0", task_id: "t_001" }`.

Return ONLY the JSON containing `diff.requested_directory`, `diff.location`, and the `file` values from `diff.data`. Do not inspect source files, do not run shell commands, and do not call any other tool.
