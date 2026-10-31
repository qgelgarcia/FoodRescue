export const LOADING_DELAYS = { slow: 3000, reassurance: 10000, recovery: 30000 };

export function loadingStage(elapsed, failed = false) {
  if (failed) return 'failed';
  if (elapsed >= LOADING_DELAYS.recovery) return 'recovery';
  if (elapsed >= LOADING_DELAYS.reassurance) return 'reassurance';
  if (elapsed >= LOADING_DELAYS.slow) return 'slow';
  return 'normal';
}
