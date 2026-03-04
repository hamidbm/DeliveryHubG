Yes, implement the full spec end-to-end in this change (types + API + db queries + UI + derived `isBlocked`), but do it in a safe incremental sequence with checkpoints so the app never stays broken for long.

## Delivery Approach (Do All, But In Order)

### Phase A: Data + API foundation (no UI yet)
1. Update `src/types.ts`:
   - Canonical persisted link types: `BLOCKS | RELATES_TO | DUPLICATES`
   - Add API-only derived fields on `WorkItem`: `isBlocked?` and `linkSummary?`
2. Implement canonical behavior in DB/repo layer (`src/services/db.ts`):
   - Functions to add/remove canonical links
   - Inverse lookup queries (who links to me)
   - Derived `linkSummary` + derived `isBlocked`
   - Add indexes needed for inverse lookup
3. Implement dedicated link API route:
   - `src/app/api/work-items/[id]/links/route.ts` with POST + DELETE
   - Relation mapping for UI-facing inverse labels (`BLOCKED_BY`, `DUPLICATED_BY`) into canonical writes
4. Remove bidirectional persistence from:
   - `src/app/api/work-items/[id]/route.ts` PATCH handler
   - Reject/strip inverse link types if they appear in inbound payloads
5. Implement BLOCKS cycle detection (server-side) and return `409` on cycle.

Checkpoint: app compiles, can create/delete links via API, and GET work item returns `linkSummary` and `isBlocked` correctly.

### Phase B: UI integration (switch UI to new API + derived fields)
6. Update UI to stop using inverse persisted types:
   - Replace any checks for `IS_BLOCKED_BY` with `item.isBlocked` (fallback to `linkSummary.openBlockersCount > 0` if present)
7. Update WorkItemDetails link add/remove to use new endpoints:
   - Do NOT PATCH the whole work item just to update links
   - Use `POST /api/work-items/:id/links` and `DELETE /api/work-items/:id/links`
   - Render grouped sections using `item.linkSummary`
8. Update list/board/roadmap cards to show blocked status using derived signals only.

Checkpoint: UI works end-to-end with canonical links; no references to inverse persisted types remain.

### Phase C: Migration + safety
9. Add one-time migration script to convert existing inverse link types into canonical edges, idempotent.
10. Add minimum tests:
   - cycle detection
   - derived isBlocked behavior
   - migration idempotency (small dataset)

## Important Constraints
- Do not persist inverse link types anymore.
- Do not auto-write status `BLOCKED`; compute derived `isBlocked`.
- Keep changes backwards compatible: if legacy inverse types exist in DB, they must still render correctly via derived inverse computation until migration is run.
- Keep patch handler tolerant: it must not reintroduce inverse link writes.

Proceed with the full implementation following the phases above.