Finish mission m_e6049e51.

1. const audit = await tools.squad.audit({ action: "task", mission_id: "m_e6049e51", task_id: "research_collect", timeout_ms: 240000 })
2. const final = await tools.squad.finalize({ mission_id: "m_e6049e51" })

Return one JSON object with:
{
  "audit_status": audit.audit?.status ?? audit.status,
  "audit_verdict": audit.verdict,
  "mission_status": final.mission?.status ?? final.status,
  "mission_id": "m_e6049e51"
}
