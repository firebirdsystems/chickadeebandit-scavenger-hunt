import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));

describe("manifest.json", () => {
  it("has required string fields", () => {
    for (const field of ["id", "name", "version", "description", "entrypoint", "runtime", "icon"]) {
      expect(manifest[field], `missing field: ${field}`).toBeTruthy();
    }
  });
  it("entrypoint/runtime/storage are standard", () => {
    expect(manifest.entrypoint).toBe("index.html");
    expect(manifest.runtime).toBe("static");
    expect(manifest.storage).toBe("db");
  });
  it("version follows semver", () => expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/));
  it("has a nav label", () => expect(manifest.nav?.label).toBeTruthy());

  it("hunts: everyone sees, ONLY the organizer writes", () => {
    const p = manifest.row_policies?.hunts;
    expect(p?.kind).toBe("owner_or_visibility");
    expect(p?.write_owner_only).toBe(true);
  });

  it("tasks and awards: organizer-only INSERT via the parent-column gate", () => {
    for (const table of ["tasks", "awards"]) {
      const p = manifest.row_policies?.[table];
      expect(p?.kind, table).toBe("inherit_visibility");
      expect(p?.insert_only_by_parent_column_member, table).toBe("created_by");
    }
  });

  it("submissions: sealed until close, one per member per task, frozen after", () => {
    const p = manifest.row_policies?.submissions;
    expect(p?.kind).toBe("sealed_until");
    expect(p?.visible_parent_status_values).toEqual(["closed"]);
    expect(p?.max_per_member?.scope_columns).toEqual(["task_id"]);
    expect(p?.max_per_member?.limit).toBe(1);
    expect(p?.frozen_when?.locked_values).toContain("closed");
  });

  it("has no ai_access", () => {
    expect(manifest.ai_access).toBeUndefined();
  });
});
