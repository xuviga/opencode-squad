Continue mission m_e6049e51. Run the blind review for task research_collect, then read the verdict.

1. const review = await tools.squad.review({ mission_id: "m_e6049e51", task_id: "research_collect" })
2. const verdict = await tools.squad.verdict({ mission_id: "m_e6049e51", task_id: "research_collect", timeout_ms: 240000 })

Return one JSON object with:
{
  "reviewer_grade": review.reviewer_grade,
  "verdict": verdict.verdict,
  "task_status": verdict.task.status,
  "checked": verdict.verdict.checked,
  "findings": verdict.verdict.findings,
  "raw_verdict": verdict.raw_verdict
}
