Run exactly one call:

const staff = await tools.squad.hire({ mission_id: "m_244bbc9f", persona: "implementer", grade: "G2" })

Return one JSON object with:
{
  "staff_id": staff.staff.id,
  "session_id": staff.session_id,
  "worktree_directory": staff.worktree_directory
}
