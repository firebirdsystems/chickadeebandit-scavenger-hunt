import { describe, it, expect } from "vitest";
import { failureLine, photoUploadLine, findRefusedLine } from "../src/logic.js";

const err = (props, message = "hub text") => Object.assign(new Error(message), props);
const words = { action: "delete the hunt", thing: "hunt" };

describe("failureLine", () => {
  it("names a duplicate by code, or by the hub's text while production lags", () => {
    expect(failureLine(err({ status: 400, code: "UNIQUE_CONSTRAINT" }), words)).toBe("That hunt already exists.");
    expect(failureLine(err({ status: 400 }, "UNIQUE constraint failed: x.id"), words)).toBe("That hunt already exists.");
  });
  it("names a refusal without asking for a retry", () => {
    expect(failureLine(err({ status: 403 }), words)).toBe("You don’t have permission to delete the hunt.");
    expect(failureLine(err({ status: 507 }), words)).toBe("The household’s storage is full — free up space first.");
    expect(failureLine(err({ status: 429 }), words)).toBe("Too many tries — wait a minute and try again.");
  });
  it("splits a write that changed nothing by the caller's re-read", () => {
    expect(failureLine(null, { ...words, found: false })).toBe("This hunt has been removed.");
    expect(failureLine(null, { ...words, found: true })).toBe("You don’t have permission to delete the hunt.");
  });
  it("reads a 404 as removed and a 409 as changed", () => {
    expect(failureLine(err({ status: 404 }), words)).toBe("This hunt has been removed.");
    expect(failureLine(err({ status: 409 }), words)).toBe("This hunt was changed by someone else — check it first.");
  });
  it("asks for a retry only when retrying can work", () => {
    for (const e of [err({}), err({ status: 0 }), err({ status: 500 }), err({ status: 503 }), err({ status: 400 }), new TypeError("Failed to fetch"), undefined]) {
      expect(failureLine(e, words)).toBe("Couldn’t delete the hunt — try again.");
    }
  });
  it("keeps a line the app wrote for the user, and never shows hub text", () => {
    expect(failureLine(err({ forUser: true }, "This hunt can no longer be changed."), words)).toBe("This hunt can no longer be changed.");
    expect(failureLine(err({ status: 500 }, "D1_ERROR: boom"), words)).not.toMatch(/D1_ERROR/);
  });
});

describe("photoUploadLine", () => {
  it("names what the files endpoint refused, and never its text", () => {
    expect(photoUploadLine(err({ status: 413 }))).toBe("That photo is too large.");
    expect(photoUploadLine(err({ status: 415 }))).toBe("That kind of file can’t be uploaded.");
    expect(photoUploadLine(err({ status: 507 }))).toBe("The household’s storage is full — free up space first.");
    expect(photoUploadLine(err({ status: 429 }))).toBe("Too many tries — wait a minute and try again.");
    expect(photoUploadLine(err({ status: 0 }, "Upload failed"))).toBe("Couldn’t upload the photo — try again.");
    expect(photoUploadLine(err({ status: 500 }, "R2 exploded"))).not.toMatch(/R2/);
  });
});

describe("findRefusedLine", () => {
  it("says the hunt ended or was removed, from the re-read", () => {
    expect(findRefusedLine(err({ status: 403 }), { huntStatus: "closed" })).toBe("This hunt has ended — no more finds.");
    expect(findRefusedLine(err({ status: 409 }), { huntStatus: "closed" })).toBe("This hunt has ended — no more finds.");
    expect(findRefusedLine(err({ status: 403 }), { huntStatus: null })).toBe("This hunt has been removed.");
  });
  it("says a find was already sent for the task", () => {
    expect(findRefusedLine(err({ status: 403 }), { huntStatus: "open", alreadySent: true })).toBe("You already sent a find for this task.");
  });
  it("falls back to the table when the re-read explains nothing or failed", () => {
    expect(findRefusedLine(err({ status: 403 }), { huntStatus: "open", alreadySent: false })).toBe("You don’t have permission to send your find.");
    expect(findRefusedLine(err({ status: 403 }), {})).toBe("You don’t have permission to send your find.");
    expect(findRefusedLine(err({ status: 507 }))).toBe("The household’s storage is full — free up space first.");
    expect(findRefusedLine(err({ status: 400 }))).toBe("Couldn’t send your find — try again.");
  });
  it("never says a brand-new find was changed by someone else", () => {
    expect(findRefusedLine(err({ status: 409 }), {})).toBe("Couldn’t send your find — try again.");
    expect(findRefusedLine(err({ status: 409 }), { huntStatus: "open", alreadySent: false })).toBe("Couldn’t send your find — try again.");
  });
});
