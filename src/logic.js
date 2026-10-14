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

/**
 * Who a hunt is shown to at each stage. A draft is the organizer's alone: its
 * list is the game, and a hunt everyone can read lets the list be read before
 * the start. "private" is in no visibility tier, so the hub returns the row,
 * and the tasks that inherit from it, to its organizer only. Starting the hunt
 * opens it to everyone.
 */
export function huntVisibility(status) {
  return status === "draft" ? "private" : "everyone";
}

/**
 * The member's own hunts stored with the wrong visibility for their stage. A
 * page from before drafts were private writes a draft as "everyone" and starts
 * a hunt by its status alone, so a tab left open across that release can leave
 * a draft whose list anyone can read, or a started hunt nobody else is shown.
 * The organizer's page puts both right when it next loads.
 */
export function misfiledHunts(hunts, me) {
  return hunts.filter((h) => isOrganizer(h, me) && h.visibility !== huntVisibility(h.status));
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

/**
 * The picture to draw for a find in the reveal grid: its small copy when the
 * hub kept one, else the photo itself. "" for a find with a caption only.
 */
export function tilePhotoId(submission) {
  return submission?.thumb_file_id || submission?.photo_file_id || "";
}

/**
 * Fields the in-app search matches against (see hub-sdk `searchMatch`).
 * A hunt carries only its title, so the organiser is passed in —
 * "the one Mia ran" is how an old hunt gets found.
 */
export function searchableFields(hunt, organizerName = "") {
  return [hunt.title, organizerName];
}

/**
 * The line a failed write shows, from the error's status — never the hub's
 * text. "Try again" only where trying again can work. `found` is the caller's
 * re-read after a write that changed nothing (true: the row is still there).
 */
export function failureLine(e, { action, thing, found } = {}) {
  if (e?.forUser) return e.message;
  if (e?.code === "UNIQUE_CONSTRAINT" || /UNIQUE constraint failed/i.test(String(e?.message ?? ""))) return `That ${thing} already exists.`;
  if (e?.status === 403) return `You don’t have permission to ${action}.`;
  if (e?.status === 507) return "The household’s storage is full — free up space first.";
  if (e?.status === 429) return "Too many tries — wait a minute and try again.";
  if (found === false || (found === undefined && e?.status === 404)) return `This ${thing} has been removed.`;
  if (found === true) return `You don’t have permission to ${action}.`;
  if (e?.status === 409 || e?.status === 404) return `This ${thing} was changed by someone else — check it first.`;
  return `Couldn’t ${action} — try again.`;
}

/** A failed photo upload: the files endpoint answers 413 too large and 415
 *  a type it will not store; the rest follow the table. */
export function photoUploadLine(e) {
  if (e?.status === 413) return "That photo is too large.";
  if (e?.status === 415) return "That kind of file can’t be uploaded.";
  return failureLine(e, { action: "upload the photo", thing: "photo" });
}

/**
 * A find the hub refused. Read after a re-read of the hunts: the hunt ending
 * (it is frozen once closed) and a find already sent for the task (one per
 * task) are the refusals a hunter can act on; the rest follow the table.
 */
export function findRefusedLine(e, { huntStatus, alreadySent } = {}) {
  if (huntStatus === "closed") return "This hunt has ended — no more finds.";
  if (huntStatus === null) return "This hunt has been removed.";
  if (alreadySent) return "You already sent a find for this task.";
  // A brand-new find has nothing for someone else to have changed.
  if (e?.status === 409) return "Couldn’t send your find — try again.";
  return failureLine(e, { action: "send your find", thing: "find" });
}
