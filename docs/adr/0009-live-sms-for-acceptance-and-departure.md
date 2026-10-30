# Demonstrate live SMS for acceptance and pickup departure

The intended SMS integration covers two events: donor acceptance of a claim sends an SMS to its claimant, and the claimant tapping On my way on an accepted claim sends an SMS to its donor. Supabase Edge Functions are included in the intended notification implementation. Sending requires an SMS provider account, credits, and recipient phone numbers.

The departure notice does not change the claim's accepted status or confirm pickup. Only donor QR verification confirms pickup before the strict deadline. Actual SMS delivery was initially requested for the defense; the user subsequently deferred SMS work for now. In-app notifications support the current workflow, and live SMS must not be represented as implemented or verified until the deferred integration is completed. SMS for donor post cancellation has not been agreed as a required event.

If sending an SMS fails, the app catches the failure and falls back to an in-app notification for the intended recipient. The underlying acceptance or departure notice still succeeds. Automatic SMS retries have not been agreed.

On my way is optional and permitted only for an accepted claim before the pickup deadline. Each claim may generate this notice once; repeated taps must not create additional notices or SMS sends. Sending the notice is not a prerequisite for QR pickup confirmation.

Demo recipients will use Philippine phone numbers. Provider selection and setup are deferred; no SMS provider has been selected or approved. Semaphore was researched as a candidate, not adopted.
