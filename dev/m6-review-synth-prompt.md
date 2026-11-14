Review the second task of mission m_e6049e51.

1. const review = await tools.squad.review({ mission_id: "m_e6049e51", task_id: "research_synthesize" })
2. const verdict = await tools.squad.verdict({ mission_id: "m_e6049e51", task_id: "research_synthesize", timeout_ms: 240000 })

Return one JSON object with:
{
  "reviewer_grade": review.reviewer_grade,
  "verdict": verdict.verdict,
  "task_status": verdict.task.status,
  "raw_verdict": verdict.raw_verdict
}
