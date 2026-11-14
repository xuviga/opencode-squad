Continue mission m_e6049e51 with the second research task.

1. const staff = await tools.squad.hire({ mission_id: "m_e6049e51", persona: "writer", grade: "G2" })
2. const assigned = await tools.squad.assign({
  mission_id: "m_e6049e51",
  task_id: "research_synthesize",
  staff_id: staff.staff.id,
  context: [
    "Collected evidence for the goal: (1) WAL appends changes to a separate -wal file; a COMMIT is a commit record appended there, so the main database stays unaltered and readers keep reading it. (2) Each reader has a stable end mark / snapshot for the duration of its read transaction. (3) Writers only append to the WAL and do not interfere with readers; readers and writers run concurrently, with one writer at a time enforced by WAL_WRITE_LOCK. (4) Rollback-journal mode takes an EXCLUSIVE lock before writing the main database, which blocks readers. (5) Caveats: same-host only, SQLITE_BUSY edge cases, checkpoint starvation with unbroken readers.",
    "Write exactly three bullets for a technical audience. Put citations to sqlite.org documents in each bullet. State the caveats and remaining uncertainty explicitly."
  ]
})
3. const waited = await tools.squad.wait({ mission_id: "m_e6049e51", task_id: "research_synthesize", timeout_ms: 240000 })

Return one JSON object with:
{
  "staff_id": staff.staff.id,
  "capability_warnings": assigned.capability_warnings,
  "task_status": waited.task.status,
  "raw_report": waited.raw_report
}
