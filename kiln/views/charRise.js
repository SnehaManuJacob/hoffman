/**
 * views/charRise.js — text that rises into place, one character at a time,
 * from behind a mask under each line.
 *
 * Every character is its own box, and every LINE is a window (overflow
 * hidden) the characters rise through: below the line's baseline they are
 * clipped away, so each one appears to come up out of the page rather than
 * fade in. The window is the "overlay under each line" that keeps it clean.
 *
 * Two ways to drive it, same markup:
 *
 *   createCharRise(el, { mode: 'load', delay: 200 })
 *     Plays once on its own (a CSS transition per character, staggered).
 *     Call .play() when ready (the default plays as soon as the fonts have
 *     loaded). For text that is on screen when the page opens.
 *
 *   createCharRise(el, { mode: 'scroll' })
 *     Nothing plays by itself. Call .set(p) with a progress 0..1 and the
 *     characters rise in order as p goes up (and sink back as it goes down).
 *     For text a scroll position drives.
 *
 * Lines are found by measuring where the words wrap, so it follows
 * text-wrap, the font and the width; they are found again when the box
 * resizes. The original text stays in an aria-label; the pieces are hidden
 * from assistive tech. Under prefers-reduced-motion the text just shows.
 */

const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeOut = (t) => 1 - (1 - t) ** 3;

export function createCharRise(el, opts = {}) {
  const {
    mode = 'load',
    stagger = 22,            // ms between characters (load); share of the range (scroll)
    duration = 600,          // ms each character takes (load)
    delay = 0,               // ms before the first character (load)
    autoplay = true,         // load mode: play once fonts are ready
    easing = 'cubic-bezier(0.19, 0.8, 0.22, 1)',
    overlap = 0.35,          // scroll mode: how much of the range one character spans
    startIndex = 0,          // load mode: stagger offset, so two elements read as one
  } = opts;

  const text = el.textContent.replace(/\s+/g, ' ').trim();
  el.setAttribute('aria-label', text);
  let chars = [];
  let progress = 0;
  let played = false;
  let reduced = REDUCED();
  let lastWidth = 0;

  /** Break the text into words and characters, then group the words into lines. */
  function build() {
    el.textContent = '';
    const words = text.split(' ').map((w) => {
      const word = document.createElement('span');
      word.className = 'cr-word';
      word.setAttribute('aria-hidden', 'true');
      for (const ch of w) {
        const c = document.createElement('span');
        c.className = 'cr-char';
        c.textContent = ch;
        word.append(c);
      }
      el.append(word, document.createTextNode(' '));
      return word;
    });

    // Where do the words wrap? Group by their top edge.
    const lines = [];
    let top = null;
    for (const w of words) {
      const t = w.offsetTop;
      if (top === null || Math.abs(t - top) > 2) { lines.push([]); top = t; }
      lines[lines.length - 1].push(w);
    }

    // Each line becomes a window; words are moved into it in order.
    el.textContent = '';
    chars = [];
    lines.forEach((ws) => {
      const line = document.createElement('span');
      line.className = 'cr-line';
      ws.forEach((w, i) => {
        if (i) line.append(document.createTextNode(' '));
        line.append(w);
        chars.push(...w.querySelectorAll('.cr-char'));
      });
      el.append(line);
    });
    el.classList.add('cr-ready');
    lastWidth = el.clientWidth;
    apply();
  }

  /** Put every character where the current state says it should be. */
  function apply() {
    const n = chars.length;
    chars.forEach((c, i) => {
      if (reduced) { c.style.transition = 'none'; c.style.transform = 'none'; return; }
      if (mode === 'scroll') {
        const range = 1 - overlap;
        const k = Math.min(1, Math.max(0, (progress - (i / Math.max(1, n - 1)) * range) / overlap));
        c.style.transition = 'none';
        c.style.transform = `translateY(${((1 - easeOut(k)) * 120).toFixed(2)}%)`;
      } else {
        c.style.transition = played
          ? `transform ${duration}ms ${easing} ${delay + (startIndex + i) * stagger}ms`
          : 'none';
        c.style.transform = played ? 'translateY(0)' : 'translateY(120%)';
      }
    });
  }

  function play() {
    if (mode !== 'load' || played) return;
    played = true;
    // Two frames: the hidden state must be painted before it can transition.
    requestAnimationFrame(() => requestAnimationFrame(apply));
  }

  function set(p) {
    progress = Math.min(1, Math.max(0, p));
    if (mode === 'scroll') apply();
  }

  /** Back to the start, for replaying. */
  function reset() { played = false; progress = 0; apply(); }

  // Re-split when the width changes (lines wrap differently).
  const ro = new ResizeObserver(() => {
    if (Math.abs(el.clientWidth - lastWidth) < 1) return;
    const wasPlayed = played;
    build();
    if (wasPlayed) { played = true; chars.forEach((c) => { c.style.transition = 'none'; c.style.transform = 'translateY(0)'; }); }
  });

  const ready = (document.fonts && document.fonts.ready) || Promise.resolve();
  ready.then(() => {
    build();
    ro.observe(el);
    if (mode === 'load' && autoplay) play();
  });

  return { play, set, reset, count: () => chars.length };
}
