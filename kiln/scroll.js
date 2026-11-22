/**
 * scroll.js — one glide for the whole page.
 *
 * Every section reads the page's scroll position and draws from it, so the
 * feel of the journey is the feel of that one number. A mouse wheel moves it
 * in 100px steps, and a step is a jolt: the camera lurches, then stops. Until
 * now only the drying section followed the scroll through a spring; the
 * others used the raw position, so the page changed character at every seam.
 *
 * This follows the wheel (and the scroll keys) through a critically damped
 * spring — it gathers speed and lets it go, never overshoots — and writes the
 * result back to the window each frame, so every section sees the same
 * smooth number. Touch, scrollbar drags and anchor jumps stay native: they
 * already have their own momentum, and are picked up as they happen.
 *
 * It does nothing under prefers-reduced-motion.
 */

const STIFFNESS = 6;            // ~0.8 s to settle; the old drying spring was 3.2
const LINE_PX = 40;             // one "line" of a wheel that reports lines
const KEY_PX = 48;              // one arrow-key press

export function createSmoothScroll() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enabled = !reduce;

  let target = window.scrollY;
  let pos = window.scrollY;
  let vel = 0;                  // px per second

  const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const clamp = (v) => Math.min(maxScroll(), Math.max(0, v));

  // Where a wheel or key should NOT be taken over: anything with its own scroll.
  const native = (el) => !!el?.closest?.('dialog, [data-native-scroll], textarea, select, [contenteditable]');

  function onWheel(ev) {
    if (!enabled || ev.ctrlKey || ev.defaultPrevented || native(ev.target)) return;
    if (Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) return;          // a sideways gesture
    const unit = ev.deltaMode === 1 ? LINE_PX : ev.deltaMode === 2 ? window.innerHeight : 1;
    ev.preventDefault();
    target = clamp(target + ev.deltaY * unit);
  }

  function onKey(ev) {
    if (!enabled || ev.defaultPrevented || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const t = ev.target;
    if (native(t) || t.closest?.('input, button, summary, a, [role="slider"]')) return;
    const page = window.innerHeight * 0.9;
    const by = {
      ArrowDown: KEY_PX, ArrowUp: -KEY_PX, PageDown: page, PageUp: -page,
      ' ': ev.shiftKey ? -page : page,
    }[ev.key];
    if (by !== undefined) target = clamp(target + by);
    else if (ev.key === 'Home') target = 0;
    else if (ev.key === 'End') target = maxScroll();
    else return;
    ev.preventDefault();
  }

  // Anything else that moved the page (scrollbar, touch, an anchor jump) is
  // adopted as the new resting place, so the glide never fights it.
  function onScroll() {
    if (Math.abs(window.scrollY - pos) > 2) {
      pos = target = window.scrollY;
      vel = 0;
    }
  }

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { target = clamp(target); });

  /** Call once per frame, BEFORE any view reads the scroll. */
  function update(dtMs) {
    if (!enabled) return;
    if (Math.abs(target - pos) < 0.25 && Math.abs(vel) < 1) {
      if (pos !== target) { pos = target; window.scrollTo({ top: pos, behavior: 'instant' }); }
      vel = 0;
      return;
    }
    const dt = Math.min(0.1, dtMs / 1000);
    for (let k = 0, n = Math.ceil(dt / 0.008); k < n; k++) {
      const h = dt / n;
      vel += (STIFFNESS * STIFFNESS * (target - pos) - 2 * STIFFNESS * vel) * h;
      pos += vel * h;
    }
    pos = clamp(pos);
    window.scrollTo({ top: pos, behavior: 'instant' });
  }

  return { update, enabled };
}
