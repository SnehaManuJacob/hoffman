/**
 * nav.js — the bar every page shares: the four pages, centred, and (on
 * pages that have one) the evidence switch at the right end.
 *
 * The page list lives here and nowhere else, so adding a page is one line.
 * A page that is not built yet is listed but not linked: the visitor can see
 * where the site is going without being sent to a 404.
 *
 * On every page the bar gets out of the way: it shows at the top, hides as
 * the visitor scrolls on, and comes back as soon as they scroll up (the
 * gesture of someone looking for a way out), at the very end of the page,
 * and whenever the keyboard moves focus into it.
 *
 * Anything pinned under the bar follows it through one variable, set on the
 * root: `--nav-top` is the bar's height while it shows and 0 while it hides
 * (site.css). The root's `nav-hidden` class says which.
 */

export const PAGES = [
  { id: 'story',    href: './index.html',    label: 'Investigation', ready: true },
  { id: 'kiln',     href: './kiln.html',     label: 'The kiln',      ready: true },
  { id: 'proposal', href: './proposal.html', label: 'The proposal',  ready: true },
  { id: 'evidence', href: './evidence.html', label: 'Evidence',      ready: true },
];

/**
 * @param {object} o
 * @param {string} o.current   id of this page, from PAGES
 * @param {Element} [o.end]    something for the right end (the evidence pill)
 * @param {boolean} [o.autoHide] hide on scroll down, show on scroll up (on by default)
 * @param {'dark'|'light'} [o.tone] the ground the bar starts over, at the very top
 */
export function createNav({ current, end = null, autoHide = true, tone = 'dark' }) {
  const bar = document.createElement('header');
  bar.className = 'site-nav';
  bar.dataset.tone = tone;

  const nav = document.createElement('nav');
  nav.className = 'site-nav-links';
  nav.setAttribute('aria-label', 'Pages');
  const list = document.createElement('ul');
  for (const p of PAGES) {
    const li = document.createElement('li');
    let el;
    if (p.ready) {
      el = document.createElement('a');
      el.href = p.href;
      if (p.id === current) el.setAttribute('aria-current', 'page');
    } else {
      el = document.createElement('span');
      el.setAttribute('aria-disabled', 'true');
      el.title = 'Not built yet';
      const soon = document.createElement('small');
      soon.textContent = 'soon';
      el.append(document.createTextNode(p.label), soon);
    }
    el.classList.add('site-nav-link');
    if (p.ready) el.textContent = p.label;
    li.append(el);
    list.append(li);
  }
  nav.append(list);
  bar.append(nav);

  if (end) {
    const slot = document.createElement('div');
    slot.className = 'site-nav-end';
    slot.append(end);
    bar.append(slot);
  }

  document.body.prepend(bar);

  // Publish the bar's real height, so anything pinned under it (the
  // proposal's status strip) sits flush however the bar wraps.
  const publish = () => document.documentElement.style.setProperty('--nav-h', `${bar.offsetHeight}px`);
  new ResizeObserver(publish).observe(bar);
  publish();

  if (autoHide) {
    let lastY = window.scrollY;
    let ticking = false;
    const root = document.documentElement;
    const setHidden = (hidden) => {
      bar.classList.toggle('is-hidden', hidden);
      root.classList.toggle('nav-hidden', hidden);
    };
    // Tabbing into a hidden bar brings it back: focus is never off-screen.
    bar.addEventListener('focusin', () => setHidden(false));
    const apply = () => {
      ticking = false;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const atTop = y < 48;
      const atEnd = y > max - 48;
      const dy = y - lastY;
      // Small jitters (the smooth scroll settling) must not flicker the bar.
      if (Math.abs(dy) > 6 || atTop || atEnd) {
        const show = atTop || atEnd || dy < 0;
        // Keyboard focus in the bar holds it open; a mouse click does not
        // (after clicking the evidence switch, focus stays on it).
        setHidden(!show && !bar.querySelector(':focus-visible'));
        bar.classList.toggle('is-over', !atTop);
        lastY = y;
      }
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(apply); }
    }, { passive: true });
    apply();
  } else {
    const onScroll = () => bar.classList.toggle('is-over', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  return bar;
}

/**
 * Turn every evidence chip under `root` into a link to its key on the
 * Evidence page. Chips inside buttons stay as they are: a link inside a
 * button is not allowed, and the button already does something.
 */
export const EVIDENCE_HREF = (tag) => `./evidence.html#key-${tag}`;
export function linkChips(root = document) {
  root.querySelectorAll('span.chip[data-ev]').forEach((span) => {
    if (span.closest('button, a')) return;
    const a = document.createElement('a');
    for (const { name, value } of span.attributes) if (name !== 'title') a.setAttribute(name, value);
    a.href = EVIDENCE_HREF(span.dataset.ev);
    // What the letter means is said by the hover note (installEvidenceTips).
    a.textContent = span.textContent;
    span.replaceWith(a);
  });
}

/**
 * A short note on every evidence tag, on hover or keyboard focus.
 *
 * Some tags sit beside their full name (the legends, the key), but most stand
 * alone as one letter, and a letter is only a code until something decodes
 * it. One tooltip serves the whole page, so every tag reads the same way: the
 * letter's name, one line on what it means, and any note the tag carries for
 * that spot (`data-note`).
 *
 * A drawn note rather than the browser's `title`: that one waits a second,
 * cannot be styled, and was set on some tags and not others. Titles on the tag
 * or any element around it are set aside while the note shows, so two
 * tooltips never stack.
 *
 * Pages differ in their words for the same letters (the proposal says
 * "Established" where the kiln says "Literature"), so each page passes its own.
 *
 * @param {Record<string, {label: string, blurb: string}>} marks
 */
const TAG_SELECTOR = [
  '.chip[data-ev]',        // kiln, proposal, evidence pages
  '.pb-chip[data-ev]',     // the story's problem section
  '.ev-code[data-code]',   // the run section's legend
  '.ev-after[data-ev]',    // the run section's panels, in evidence mode
  '.kiln-label-tag',       // the labels on the ring
].join(', ');

export function installEvidenceTips(marks) {
  const tip = document.createElement('div');
  tip.className = 'ev-tip';
  tip.id = 'ev-tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);

  let current = null;
  let stashed = [];

  const codeOf = (el) => el.dataset.ev || el.dataset.code
    || el.closest('[data-ev]')?.dataset.ev || el.textContent.trim();

  function show(el) {
    if (el === current) return;
    hide();
    const m = marks[codeOf(el)];
    if (!m) return;
    current = el;

    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.hasAttribute('title')) {
        stashed.push([n, n.getAttribute('title')]);
        n.removeAttribute('title');
      }
    }

    const line = (cls, text) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text;
      return s;
    };
    tip.replaceChildren(
      line('ev-tip-name', m.label),
      line('ev-tip-blurb', m.blurb),
      el.dataset.note ? line('ev-tip-note', el.dataset.note) : '',
      el.closest('a[href]') ? line('ev-tip-more', 'Click to see where this comes from.') : '',
    );
    if (!el.hasAttribute('aria-describedby')) {
      el.setAttribute('aria-describedby', tip.id);
      el.dataset.tipDescribed = '';
    }

    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const w = tip.offsetWidth;
    const hgt = tip.offsetHeight;
    const gap = 8;
    const navTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-top')) || 0;
    let top = r.top - hgt - gap;
    tip.dataset.side = 'above';
    if (top < navTop + gap) { top = r.bottom + gap; tip.dataset.side = 'below'; }
    const left = Math.min(Math.max(r.left + r.width / 2 - w / 2, gap), window.innerWidth - w - gap);
    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
  }

  function hide() {
    if (!current) return;
    if ('tipDescribed' in current.dataset) {
      current.removeAttribute('aria-describedby');
      delete current.dataset.tipDescribed;
    }
    for (const [n, t] of stashed) n.setAttribute('title', t);
    stashed = [];
    current = null;
    tip.hidden = true;
  }

  const tagFrom = (target) => (target instanceof Element ? target.closest(TAG_SELECTOR) : null);

  document.addEventListener('pointerover', (ev) => {
    const el = tagFrom(ev.target);
    if (el) show(el);
  });
  // The note stays while the pointer is on the tag or on the note itself, so
  // it can be read (and hovered) without vanishing.
  document.addEventListener('pointerout', (ev) => {
    if (!current) return;
    const to = ev.relatedTarget;
    if (to instanceof Node && (current.contains(to) || tip.contains(to))) return;
    if (tip.contains(ev.target) || current.contains(ev.target)) hide();
  });
  document.addEventListener('focusin', (ev) => {
    const el = tagFrom(ev.target);
    if (el) show(el); else hide();
  });
  document.addEventListener('focusout', (ev) => { if (ev.target === current) hide(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') hide(); });
  window.addEventListener('scroll', hide, { passive: true, capture: true });
  window.addEventListener('resize', hide);
}
