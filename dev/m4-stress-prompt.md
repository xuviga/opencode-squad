Run a 3-task parallel stress test.

1. const mission = await tools.squad.mission({ action: "create", title: "M4 parallel stress", goal: "Create three independent proof files in dev/stress and prove the worktrees merge cleanly." })
2. const submitted = await tools.squad.plan({
  action: "submit",
  mission_id: mission.mission.id,
  plan: {
    goal: "Create three independent proof files in dev/stress and prove the worktrees merge cleanly.",
    tasks: [
      { id: "p1", title: "Write dev/stress/p1.txt with P1_OK", class: "code", role: "implementer", grade: "G2", acceptance: ["dev/stress/p1.txt exists and contains exactly P1_OK", "The change is committed in the worktree", "Evidence records the write command and exit code"] },
      { id: "p2", title: "Write dev/stress/p2.txt with P2_OK", class: "code", role: "implementer", grade: "G2", acceptance: ["dev/stress/p2.txt exists and contains exactly P2_OK", "The change is committed in the worktree", "Evidence records the write command and exit code"] },
      { id: "p3", title: "Write dev/stress/p3.txt with P3_OK", class: "code", role: "implementer", grade: "G2", acceptance: ["dev/stress/p3.txt exists and contains exactly P3_OK", "The change is committed in the worktree", "Evidence records the write command and exit code"] }
    ]
  }
})
3. await tools.squad.plan({ action: "approve", mission_id: mission.mission.id })
4. const staff = await Promise.all([
  tools.squad.hire({ mission_id: mission.mission.id, persona: "implementer", grade: "G2" }),
  tools.squad.hire({ mission_id: mission.mission.id, persona: "implementer", grade: "G2" }),
  tools.squad.hire({ mission_id: mission.mission.id, persona: "implementer", grade: "G2" })
])
5. const assigned = await Promise.all([
  tools.squad.assign({ mission_id: mission.mission.id, task_id: "p1", staff_id: staff[0].staff.id, context: ["Create the file with a single write command and commit it in the worktree."] }),
  tools.squad.assign({ mission_id: mission.mission.id, task_id: "p2", staff_id: staff[1].staff.id, context: ["Create the file with a single write command and commit it in the worktree."] }),
  tools.squad.assign({ mission_id: mission.mission.id, task_id: "p3", staff_id: staff[2].staff.id, context: ["Create the file with a single write command and commit it in the worktree."] })
])
6. const waited = []
for (const id of ["p1", "p2", "p3"]) {
  waited.push(await tools.squad.wait({ mission_id: mission.mission.id, task_id: id, timeout_ms: 240000 }))
}
7. const integrated = await tools.squad.integrate({ mission_id: mission.mission.id })

Return one JSON object with:
{
  "mission_id": mission.mission.id,
  "worktrees": staff.map(s => s.worktree_directory),
  "assigned_statuses": assigned.map(a => a.task.status),
  "waited": waited.map(w => ({ task: w.task.id, status: w.task.status, cost: w.cost })),
  "integrated": integrated.integrated,
  "results": integrated.results?.map(r => ({ taskID: r.taskID, commit: r.commit, sourceCommit: r.sourceCommit }))
}
