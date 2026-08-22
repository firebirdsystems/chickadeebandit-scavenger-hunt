import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { describe, it, expect } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(__dirname, "../manifest.json"), "utf-8"));
const appHtml = readFileSync(join(__dirname, "../src/index.html"), "utf-8");

const migrationsDir = join(__dirname, "../migrations");
const schema = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => readFileSync(join(migrationsDir, f), "utf-8"))
  .join("\n");

// Mirrors the hub's BUILTIN_APP_DB_PLAINTEXT_COLS + suffix rules
// (packages/hub/src/cloudflare/app-db-codec.ts). A column the hub filters or
// orders on must be plaintext: ciphertext is AES-GCM with a random IV, so an
// equality against an encrypted column silently matches nothing.
const BUILTIN_PLAINTEXT = new Set([
  "id", "household_id", "created_at", "updated_at", "sent_at", "read_at",
  "expires_at", "last_synced_at", "completed", "all_day",
  "status", "type", "category", "week", "emoji", "icon", "source",
  "position", "sort_order", "pinned", "key", "version",
  "visibility", "audience",
  "membership_type", "membership_roles",
]);

function isPlaintext(column) {
  return (
    BUILTIN_PLAINTEXT.has(column)
    || /_(id|at|date|by)$/.test(column)
    || (manifest.db_plaintext_columns ?? []).includes(column)
  );
}

function columnsOf(table) {
  const body = schema.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS app_scavenger_hunt__${table} \\(([\\s\\S]*?)\\n\\);`),
  );
  expect(body, `no CREATE TABLE for ${table}`).toBeTruthy();
  return body[1]
    .split("\n")
    .map((line) => line.trim().match(/^([a-z_]+)\s+(TEXT|INTEGER|REAL|BLOB)\b/))
    .filter(Boolean)
    .map((m) => m[1]);
}

const item = manifest.shareable.hunt;
const feed = item.feed;

describe("shareable.hunt", () => {
  it("shares hunts, keyed on the organizer", () => {
    expect(item.table).toBe("hunts");
    expect(item.owner_column).toBe("created_by");
    expect(columnsOf("hunts")).toContain(item.owner_column);
    expect(isPlaintext(item.owner_column), "the mint and file gates compare it raw").toBe(true);
  });

  it("publishes ONLY a hunt that has been closed", () => {
    // Share reads bypass member row policies entirely, so `sealed_until` on
    // submissions protects nothing here. The reveal has to be re-expressed
    // declaratively or a link would publish the finds mid-hunt.
    expect(item.visible_where).toEqual({ column: "status", values: ["closed"] });
    expect(isPlaintext(item.visible_where.column)).toBe(true);
    expect(manifest.row_policies.submissions.visible_parent_status_values)
      .toEqual(item.visible_where.values);
  });

  it("never names a hunter", () => {
    // A public URL carrying photos of children should not caption them with
    // names. The feed reads one table and `submissions` holds no display name,
    // so this holds as long as nobody projects member_id.
    const projected = feed.columns.map((c) => c.column);
    expect(projected).not.toContain("member_id");
    expect(projected.every((c) => columnsOf("submissions").includes(c))).toBe(true);
    expect(JSON.stringify(item.columns)).not.toContain("created_by");
  });

  it("carries photos through the scalar column the reclaim paths own", () => {
    // photo_file_id is a bare id, not a JSON array. It is what
    // delete_file_columns / delete_cascades / member_references / retain_days
    // all reclaim, and the hub reads that shape directly — a second
    // JSON-encoded copy would be file ids no reclaim path tracks.
    expect(feed.files_column).toBe("photo_file_id");
    expect(columnsOf("submissions")).toContain(feed.files_column);
    expect(manifest.delete_file_columns.submissions).toContain(feed.files_column);
    for (const dep of manifest.row_policies.hunts.retain_days.dependent_tables) {
      if (dep.table === "submissions") expect(dep.file_id_column).toBe(feed.files_column);
    }
  });

  it("orders on a plaintext column that exists", () => {
    expect(columnsOf("submissions")).toContain(feed.order_column);
    expect(isPlaintext(feed.order_column)).toBe(true);
    expect(feed.order).toBe("oldest");
  });

  it("declares no filter it cannot enforce", () => {
    for (const filter of feed.where ?? []) expect(isPlaintext(filter.column)).toBe(true);
    if (feed.parent_where) expect(isPlaintext(feed.parent_where.column)).toBe(true);
  });

  it("accepts no submissions — this link is read-only", () => {
    // The gallery is a reveal, not a guestbook: an anonymous visitor has no
    // business writing into a table gated by sealed_until + max_per_member.
    expect(item.submit).toBeUndefined();
  });
});

describe("the in-app share control", () => {
  it("offers the gallery only once the hunt is closed", () => {
    // visible_where would render an earlier link empty, and the reveal is the
    // point of the game.
    expect(appHtml).toContain('hunt.status === "closed" && share.enabled');
  });

  it("mints the item type the manifest declares", () => {
    expect(appHtml).toContain('share.create("hunt"');
    expect(Object.keys(manifest.shareable)).toEqual(["hunt"]);
  });

  it("never asks for a writable link", () => {
    expect(appHtml).not.toContain("writable");
  });
});
