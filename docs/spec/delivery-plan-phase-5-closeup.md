# DeliveryHub Spec: Phase 5 Final Closeout

## Status

Phase 5 is functionally close, but it is **not complete yet**.

The remaining items must be finished before we move to Phase 6.

---

## Required Remaining Work

### 1. Add explicit per-milestone slippage in Simulation Results

The current results UI shows:

- baseline end date
- scenario end date
- summary count of milestones slipped

That is not sufficient for closeout.

### Required UI change

Add an explicit per-milestone slippage field to the results table.

Acceptable options include:

- `Slipped`
- `Schedule Delta`
- `Date Delta`
- `Slip (days)`

### Expected behavior

For each milestone row, show a user-visible value such as:

- `Yes`
- `No`
- `+10 days`
- `0 days`

Preferred approach:

- include a `Date Delta` column showing signed change in days
- optionally also include a boolean `Slipped` indicator

The user should not have to infer slippage by manually comparing two date columns.

---

### 2. Update Phase 5 spec status to Completed

Update:

- `docs/spec/delivery-plan-phase-5-simulation-engine.md`

### Required changes

Add or update an `Implementation Status` section so it clearly states:

```md
## Implementation Status

Status: Completed

Validation:
- simulation engine tests added
- simulation API tests added
- `npm run test:api` passes

Notes:
- `DATE_SHIFT` is milestone-specific
- multiple overrides per scenario are supported
```

Also ensure the rest of the spec accurately reflects the final implementation.

---

### 3. Keep wiki docs aligned

Verify these docs are updated and accurate:

- `docs/wiki/Roadmap.md`
- `docs/wiki/Modules-WorkItems.md`

They should accurately describe:

- simulation capability exists
- supported override types
- milestone-specific `DATE_SHIFT`
- comparison/results behavior

---

## Runtime Verification Guidance

Codex has not runtime-verified the UI flow.

That means one of two things must happen before we officially close Phase 5:

### Option A: Codex verifies in runtime
If Codex can run the app and verify the UI path, do that.

### Option B: Manual verification by us
If Codex cannot reliably verify the runtime UI flow, then we will treat runtime verification as a manual QA step outside Codex.

### Manual QA checklist

Run the following manually in the app:

1. Open roadmap page
2. Click `Simulate`
3. Add at least one override
4. Add multiple overrides in one scenario
5. Submit simulation
6. Confirm results render
7. Confirm per-milestone slippage is explicitly visible
8. Confirm no obvious regression in roadmap tabs

Codex does not need to block on full browser automation if that is not already part of the repo setup.

---

## Final Acceptance Criteria for Phase 5

Phase 5 can be closed once all of the following are true:

1. Per-milestone slippage is explicitly shown in `SimulationResults`
2. Phase 5 spec status is updated to `Completed`
3. Wiki docs are aligned and accurate
4. `npm run test:api` still passes
5. Runtime UI flow is either:
   - verified by Codex, or
   - verified manually using the QA checklist above

---

## Final Instruction to Codex

Proceed with the remaining Phase 5 closeout work now:

1. Add explicit per-milestone slippage to `SimulationResults`
2. Update `docs/spec/delivery-plan-phase-5-simulation-engine.md` status to `Completed`
3. Verify `docs/wiki/Roadmap.md` and `docs/wiki/Modules-WorkItems.md` are accurate
4. Re-run `npm run test:api`

After that, reply with:

- files changed
- confirmation that tests still pass
- confirmation that Phase 5 is ready for manual/runtime closeout