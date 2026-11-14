Continue mission m_a5669cde: review all three tasks, then integrate them.

1. const reviews = await Promise.all([
  tools.squad.review({ mission_id: "m_a5669cde", task_id: "p1" }),
  tools.squad.review({ mission_id: "m_a5669cde", task_id: "p2" }),
  tools.squad.review({ mission_id: "m_a5669cde", task_id: "p3" })
])
2. const verdicts = await Promise.all([
  tools.squad.verdict({ mission_id: "m_a5669cde", task_id: "p1", timeout_ms: 300000 }),
  tools.squad.verdict({ mission_id: "m_a5669cde", task_id: "p2", timeout_ms: 300000 }),
  tools.squad.verdict({ mission_id: "m_a5669cde", task_id: "p3", timeout_ms: 300000 })
])
3. const integrated = await tools.squad.integrate({ mission_id: "m_a5669cde" })

Return one JSON object with:
{
  "reviewer_grades": reviews.map(r => r.reviewer_grade),
  "verdicts": verdicts.map(v => ({ task: v.task.id, verdict: v.verdict.verdict, status: v.task.status })),
  "integrated": integrated.integrated,
  "results": integrated.results?.map(r => ({ taskID: r.taskID, commit: r.commit, sourceCommit: r.sourceCommit, alreadyMerged: r.alreadyMerged }))
}
