Run a live dispute ruling on mission m_e6049e51.

1. const opened = await tools.squad.dispute({
  action: "open",
  mission_id: "m_e6049e51",
  task_id: "research_collect",
  claim: "The worker report claims primary-source coverage but the evidence tail cites sections without quoting the exact supporting sentence for the 2026 WAL-reset claim.",
  evidence: { task_id: "research_collect", review_round: 1 }
})
2. const reply = await tools.squad.dispute({
  action: "reply",
  dispute_id: opened.dispute.id,
  role: "reviewer",
  text: "The pass was based on the evidence tail as a whole; the missing exact quote is a documentation nit, not a functional gap. Acceptance criteria are met."
})
3. const ruled = await tools.squad.dispute({ action: "rule", dispute_id: opened.dispute.id, timeout_ms: 240000 })

Return one JSON object with:
{
  "dispute_id": opened.dispute.id,
  "status": ruled.dispute.status,
  "winner": ruled.ruling.winner,
  "reasoning": ruled.ruling.reasoning,
  "actions": ruled.ruling.actions,
  "cost": ruled.cost
}
