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
    for (const { name, value } of span.attributes) a.setAttribute(name, value);
    a.href = EVIDENCE_HREF(span.dataset.ev);
    a.title = `${span.title || span.dataset.ev}. See where this comes from.`;
    a.textContent = span.textContent;
    span.replaceWith(a);
  });
}
