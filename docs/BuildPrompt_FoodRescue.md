# FoodRescue — Build Prompt

Use this prompt for implementation after reading the confirmed design. It is not a claim that the target has already been built.

> Build FoodRescue for a school defense: Ionic React/Vite Android APK for members and desktop web admin, with a real shared Supabase workflow.
>
> Read Design_Agreement_FoodRescue.md, the root CONTEXT.md, Specs_FoodRescue.md, Rules_FoodRescue.md, Database_FoodRescue.md, SystemDesign_FoodRescue.md, Architecture_FoodRescue.md, and Phases_FoodRescue.md. The agreement and recorded decisions supersede conflicting original behavior. Rubric_Audit.md and Professor_Code_Walkthrough.md describe current evidence, not acceptance criteria.
>
> Follow the revised phases. Keep Supabase authorization server-side and state/inventory changes atomic. Do not reproduce the old illustrative SQL as an exact contract or use broad client writes to bypass transitions.
>
> Pending claims reserve immediately. Donors accept/reject; explained cancellation of pending/accepted claims needs donor approval. Release each reservation once, reopening fully reserved posts before deadline unless closed. Enforce per-person eligibility and post edit locks.
>
> Confirm full pickup by donor QR scan or single-use manual fallback, with ownership/state/deadline checks and one consumption. Block at or after deadline even if scheduled processing has not run. Preserve completed history and reject/expire outstanding claims correctly.
>
> Implement live interactive pickup maps, optional one-photo Storage upload up to 5 MB, and optional once-only On my way with consented donor-only foreground latest-location sharing. GPS failure never blocks pickup; delete coordinates when sharing ends.
>
> Implement live moderation, suspension/reactivation, explained post removal, reports with required resolution explanation, and atomic audit logging. Notifications/history must be shared and persisted.
>
> SMS provider setup/integration is deferred; retain the intended Philippine acceptance/departure events and in-app failure fallback in documentation. Do not claim SMS is working. Background tracking, permanent bans, broadcasts, and advanced analytics are deferred.
>
> Produce runnable migrations for changes, document manual deployment steps, run meaningful checks, and verify the Android APK camera/location/upload flow on real devices with separate accounts. Update implementation evidence honestly; local demo behavior is not a substitute for shared operation.
