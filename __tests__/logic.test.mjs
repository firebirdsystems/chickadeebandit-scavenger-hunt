import { describe, it, expect } from "vitest";
import {
  isOrganizer, statusLabel, visibleHunts, huntTasks, submissionFor,
  foundCount, awardBySubmission, scoreboard, searchableFields, tilePhotoId, huntVisibility, misfiledHunts,
} from "../src/logic.js";

const me = { id: "org-1", role: "adult" };
const other = { id: "kid-1", role: "child" };

describe("isOrganizer — must mirror write_owner_only (no adult bypass)", () => {
  const hunt = { id: "h1", created_by: "org-1" };
  it("true only for the creator", () => {
    expect(isOrganizer(hunt, me)).toBe(true);
    expect(isOrganizer(hunt, other)).toBe(false);
    expect(isOrganizer(hunt, { id: "adult-2", role: "adult" })).toBe(false);
    expect(isOrganizer(hunt, null)).toBe(false);
  });
});

describe("visibleHunts", () => {
  const hunts = [
    { id: "draft-mine", status: "draft", created_by: "org-1", created_at: "3" },
    { id: "draft-other", status: "draft", created_by: "kid-1", created_at: "2" },
    { id: "open", status: "open", created_by: "kid-1", created_at: "1" },
  ];
  it("hides other members' drafts", () => {
    expect(visibleHunts(hunts, me).map((h) => h.id)).toEqual(["draft-mine", "open"]);
  });
});

describe("tasks + submissions", () => {
  const tasks = [
    { id: "t2", hunt_id: "h1", sort_order: 1, created_at: "1" },
    { id: "t1", hunt_id: "h1", sort_order: 0, created_at: "1" },
  ];
  const subs = [
    { id: "s1", task_id: "t1", member_id: "kid-1" },
  ];
  it("orders tasks and finds my submission", () => {
    expect(huntTasks(tasks, "h1").map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(submissionFor(subs, "t1", "kid-1")?.id).toBe("s1");
    expect(submissionFor(subs, "t2", "kid-1")).toBeUndefined();
    expect(foundCount(subs, tasks, "h1", "kid-1")).toBe(1);
  });
});

describe("awards + scoreboard", () => {
  const subs = [
    { id: "s1", member_id: "a" },
    { id: "s2", member_id: "b" },
    { id: "s3", member_id: "a" },
  ];
  const awards = [
    { id: "aw1", hunt_id: "h1", submission_id: "s1", points_awarded: 2 },
    { id: "aw2", hunt_id: "h1", submission_id: "s2", points_awarded: 3 },
    { id: "aw3", hunt_id: "h1", submission_id: "s3", points_awarded: 1 },
    { id: "awX", hunt_id: "h2", submission_id: "s1", points_awarded: 99 },
  ];
  it("totals per member for the hunt only", () => {
    expect(scoreboard(awards, subs, "h1")).toEqual([
      { member_id: "a", points: 3, finds: 2 },
      { member_id: "b", points: 3, finds: 1 },
    ]);
  });
  it("indexes awards by submission", () => {
    expect(awardBySubmission(awards, "h1").get("s2")?.points_awarded).toBe(3);
  });
});

describe("statusLabel", () => {
  it("labels all statuses", () => {
    expect(statusLabel("draft")).toBe("Draft");
    expect(statusLabel("open")).toMatch(/hunt is on/);
    expect(statusLabel("closed")).toBe("Revealed");
  });
});

describe("searchableFields", () => {
  it("matches on the organiser passed in alongside the hunt title", () => {
    const fields = searchableFields({ title: "Garden hunt" }, "Mia");
    expect(fields).toContain("Garden hunt");
    expect(fields).toContain("Mia");
  });
});

describe("tilePhotoId", () => {
  it("draws the small copy when the hub kept one, else the photo", () => {
    expect(tilePhotoId({ photo_file_id: "p1", thumb_file_id: "t1" })).toBe("t1");
    expect(tilePhotoId({ photo_file_id: "p1", thumb_file_id: null })).toBe("p1");
    // A find submitted before the column existed carries no such field.
    expect(tilePhotoId({ photo_file_id: "p1" })).toBe("p1");
  });
  it("is empty for a find with a caption only", () => {
    expect(tilePhotoId({ photo_file_id: "", thumb_file_id: null })).toBe("");
    expect(tilePhotoId(null)).toBe("");
  });
});

describe("huntVisibility", () => {
  it("keeps a draft to its organizer and opens a started hunt to everyone", () => {
    expect(huntVisibility("draft")).toBe("private");
    expect(huntVisibility("open")).toBe("everyone");
    expect(huntVisibility("closed")).toBe("everyone");
  });
});

describe("misfiledHunts", () => {
  const organizer = { id: "org-1" };
  const rows = [
    { id: "stuck", status: "open", visibility: "private", created_by: "org-1" },
    { id: "stuck-closed", status: "closed", visibility: "private", created_by: "org-1" },
    { id: "fine", status: "open", visibility: "everyone", created_by: "org-1" },
    { id: "draft", status: "draft", visibility: "private", created_by: "org-1" },
    { id: "open-draft", status: "draft", visibility: "everyone", created_by: "org-1" },
    { id: "theirs", status: "open", visibility: "private", created_by: "kid-1" },
    { id: "their-draft", status: "draft", visibility: "everyone", created_by: "kid-1" },
  ];

  it("names the member's own hunts stored with the wrong visibility for their stage", () => {
    expect(misfiledHunts(rows, organizer).map((h) => h.id)).toEqual(["stuck", "stuck-closed", "open-draft"]);
  });

  it("names nothing without a member", () => {
    expect(misfiledHunts(rows, null)).toEqual([]);
  });
});
