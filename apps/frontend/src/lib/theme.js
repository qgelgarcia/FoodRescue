export const THEME_KEY = 'foodrescue_theme';

export function revealCircle(bounds, width, height) {
  const x = bounds.left + bounds.width / 2;
  const y = bounds.top + bounds.height / 2;
  const radius = Math.ceil(Math.hypot(Math.max(x, width - x), Math.max(y, height - y)));
  return [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`];
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101b15' : '#f5faee');
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* Keep appearance usable when storage is unavailable. */ }
}

export async function transitionTheme(theme, bounds, update) {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const change = () => { applyTheme(theme); update(); };
  if (reducedMotion) { change(); return; }
  if (!document.startViewTransition) {
    root.classList.add('theme-fade');
    change();
    await new Promise(resolve => setTimeout(resolve, 400));
    root.classList.remove('theme-fade');
    return;
  }
  root.classList.add('theme-reveal');
  let transition;
  let animation;
  try {
    transition = document.startViewTransition(change);
    await transition.ready;
    animation = root.animate({ clipPath: revealCircle(bounds, window.innerWidth, window.innerHeight) }, {
      duration: 550, easing: 'cubic-bezier(.2, 0, .2, 1)', fill: 'both',
      pseudoElement: '::view-transition-new(root)',
    });
    await animation.finished;
    // Release snapshots immediately; unrelated page animations must not hold the toggle.
    transition.skipTransition();
  } catch {
    // Unsupported/skipped snapshots still apply the chosen appearance.
    transition?.skipTransition();
    change();
  } finally {
    if (transition) await transition.finished.catch(() => {});
    animation?.cancel();
    root.classList.remove('theme-reveal');
  }
}
