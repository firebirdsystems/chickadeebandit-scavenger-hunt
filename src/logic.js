/**
 * Pure business logic for the Scavenger Hunt app.
 * No DOM, no fetch — importable in both browser and test environments.
 */

/**
 * Whether `me` may manage (edit/open/close/award) a hunt.
 * Mirrors the hub policy exactly: hunts are write_owner_only, so ONLY the
 * organizer — adults get no bypass — may write. Do not widen this gate.
 */
export function isOrganizer(hunt, me) {
  return !!me && !!hunt && hunt.created_by === me.id;
}

export function statusLabel(status) {
  return { draft: "Draft", open: "The hunt is on!", closed: "Revealed" }[status] ?? status;
}

/** Hunts newest first; other members' drafts hidden in the UI. */
export function visibleHunts(hunts, me) {
  return [...hunts]
    .filter((h) => h.status !== "draft" || isOrganizer(h, me))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/** A hunt's tasks in play order. */
export function huntTasks(tasks, huntId) {
  return tasks
    .filter((t) => t.hunt_id === huntId)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order) || String(a.created_at).localeCompare(String(b.created_at)));
}

/** The caller-visible submission for (task, member); undefined when none. */
export function submissionFor(submissions, taskId, memberId) {
  return submissions.find((s) => s.task_id === taskId && s.member_id === memberId);
}

/** How many of a hunt's tasks this member has submitted. */
export function foundCount(submissions, tasks, huntId, memberId) {
  const tids = new Set(huntTasks(tasks, huntId).map((t) => t.id));
  return submissions.filter((s) => s.member_id === memberId && tids.has(s.task_id)).length;
}

/** Award lookup: submission_id → award row (for the hunt). */
export function awardBySubmission(awards, huntId) {
  const map = new Map();
  for (const a of awards) if (a.hunt_id === huntId) map.set(a.submission_id, a);
  return map;
}

/** Scoreboard [{ member_id, points, finds }] from awards, points desc. */
export function scoreboard(awards, submissions, huntId) {
  const subById = new Map(submissions.map((s) => [s.id, s]));
  const totals = new Map();
  for (const a of awards) {
    if (a.hunt_id !== huntId) continue;
    const sub = subById.get(a.submission_id);
    if (!sub) continue;
    const cur = totals.get(sub.member_id) ?? { member_id: sub.member_id, points: 0, finds: 0 };
    cur.points += Number(a.points_awarded) || 0;
    cur.finds += 1;
    totals.set(sub.member_id, cur);
  }
  return [...totals.values()].sort((a, b) => b.points - a.points || b.finds - a.finds);
}
