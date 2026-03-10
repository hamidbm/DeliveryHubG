Phase 10 core stack is good progress, but Phase 10 is not complete yet.

Please implement Phase 10B: Apply Optimized Variant.

Required work:

1. Add persistence for an accepted optimization variant
   - support both `preview:` and `created:` plans
   - apply accepted variant changes back to the plan source

2. Implement a canonical change-application flow for optimization deltas
   - milestone date shifts
   - capacity-related changes
   - other supported optimized adjustments

3. Add lightweight auditability
   - plan ID
   - accepted variant ID
   - objective weights
   - timestamp
   - summary of applied changes

4. Refresh roadmap / forecast / probabilistic forecast state after apply

5. Update the Optimization modal UX
   - add `Apply Variant`
   - show success/failure feedback
   - reflect applied state

6. Add tests for:
   - preview apply
   - created-plan apply
   - audit record creation
   - no regression in optimization APIs

Do not move to Phase 11 until apply-to-plan persistence is complete.