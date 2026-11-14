Finish mission m_e6049e51 now that the main checkout is clean.

1. const merged = await tools.squad.integrate({ mission_id: "m_e6049e51", task_id: "research_synthesize" })
2. const final = await tools.squad.finalize({ mission_id: "m_e6049e51" })

Return one JSON object with:
{
  "integrated": merged.integrated,
  "results": merged.results,
  "mission_status": final.mission?.status ?? final.status
}
