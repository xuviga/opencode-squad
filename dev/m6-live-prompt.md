Run a SQUAD M6 capability smoke test with these exact calls. Do not invent extra steps.

1. const mission = await tools.squad.mission({ action: "create", title: "M6 capability smoke", goal: "Explain in three bullets why SQLite WAL mode allows concurrent readers." })
2. const built = await tools.squad.template({ action: "build", class: "research", goal: "Explain in three bullets why SQLite WAL mode allows concurrent readers.", capabilities: ["mcp:poster-compiler"] })
3. await tools.squad.plan({ action: "submit", mission_id: mission.mission.id, plan: built.plan })
4. await tools.squad.plan({ action: "approve", mission_id: mission.mission.id })
5. const staff = await tools.squad.hire({ mission_id: mission.mission.id, persona: "researcher", grade: "G1" })
6. const assigned = await tools.squad.assign({ mission_id: mission.mission.id, task_id: "research_collect", staff_id: staff.staff.id, context: ["Use official SQLite documentation."] })
7. const waited = await tools.squad.wait({ mission_id: mission.mission.id, task_id: "research_collect", timeout_ms: 180000 })

Return one JSON object with these fields only:
{
  "mission_id": "...",
  "staff_id": "...",
  "task_capabilities": assigned.brief.capabilities,
  "capability_resolution": assigned.capabilities,
  "capability_warnings": assigned.capability_warnings,
  "task_status": waited.task.status,
  "raw_report": waited.raw_report
}
