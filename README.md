# Scavenger Hunt

Set a list of things to find, everyone hunts and submits photo proof in
secret, then the big reveal — see everyone's finds at once and award points.

- **Storage:** D1 (`hunts`, `tasks`, `submissions`, `awards`) + hub file
  storage for proof photos.
- **Enforcement highlights:**
  - `hunts` — `write_owner_only`: only the organizer starts/ends a hunt.
  - `tasks` / `awards` — organizer-only INSERT
    (`insert_only_by_parent_column_member`).
  - `submissions` — `sealed_until` the hunt closes; one per member per task;
    `frozen_when` closed.
- **AI:** none.

## Develop

```bash
make install
make dev
make test
make build
```
