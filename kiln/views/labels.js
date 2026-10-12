/**
 * views/labels.js — component names pinned to the 3D kiln.
 *
 * A VIEW. Each frame it projects anchor points from the scene into screen
 * space and moves an HTML element to match. HTML rather than sprites so the
 * labels keep the page's typography, stay crisp at any pixel ratio, and can
 * carry evidence styling straight from CSS (`data-ev`).
 *
 * Every label names a component from config.COMPONENTS and shows the tag for
 * where that knowledge came from. That is the point of the detail: a visitor
 * can see a chimney and a flue duct, and also see that neither was observed at
 * Kundapur. Normal mode keeps the tags quiet; evidence mode makes them loud.
 */

import * as THREE from 'three';
import { COMPONENTS } from '../config.js';

/** What each anchor is called on screen, and which component backs it. */
const LABEL_TEXT = {
  chimney:     { text: 'Chimney',      component: 'chimney' },
  flueDuct:    { text: 'Flue duct',    component: 'flueDuct' },
  dampers:     { text: 'Open damper',  component: 'dampers' },
  stokeHoles:  { text: 'Stoke holes',  component: 'stokeHoles' },
  tiles:       { text: 'Tiles stay still', component: 'tiles' },
  wicketDoors: { text: 'Wicket door',  component: 'wicketDoors' },
  zoneFire:    { text: 'Firing',       component: 'zones' },
  zonePreheat: { text: 'Drying & preheating', component: 'zones' },
  zoneCool:    { text: 'Cooling',      component: 'zones' },
  airIn:       { text: 'Air in',       component: 'airPath' },
};

export function createLabels(layerEl, ring) {
  const projected = new THREE.Vector3();
  const entries = new Map();

  function elementFor(id) {
    if (entries.has(id)) return entries.get(id);

    const spec = LABEL_TEXT[id];
    const component = COMPONENTS[spec.component];

    const el = document.createElement('div');
    el.className = 'kiln-label';
    // Drives evidence styling in style.css, and says where the part comes from.
    el.setAttribute('data-ev', component.tag);
    el.title = component.note;

    const dot = document.createElement('span');
    dot.className = 'kiln-label-dot';

    const text = document.createElement('span');
    text.className = 'kiln-label-text';
    text.textContent = spec.text;

    const tag = document.createElement('span');
    tag.className = 'kiln-label-tag';
    tag.textContent = component.tag;

    el.append(dot, text, tag);
    layerEl.appendChild(el);
    entries.set(id, el);
    return el;
  }

  /**
   * Labels anchored to a ring seen in perspective bunch up badly at the top,
   * where the far side of the kiln compresses. Rather than hand-placing offsets
   * that would break the moment the camera or the kiln's proportions change,
   * push overlapping labels apart vertically: sort by screen y, then walk down
   * nudging any label that sits too close to the one above it.
   */
  function deoverlap(placed) {
    const MIN_GAP_Y = 24;
    const MIN_GAP_X = 150;

    placed.sort((a, b) => a.y - b.y);
    for (let i = 1; i < placed.length; i++) {
      const cur = placed[i];
      for (let j = 0; j < i; j++) {
        const other = placed[j];
        if (Math.abs(cur.x - other.x) > MIN_GAP_X) continue;
        const overlap = MIN_GAP_Y - (cur.y - other.y);
        if (overlap > 0) cur.y += overlap;
      }
    }
    return placed;
  }

  function update(state) {
    const { camera, renderer } = ring;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const placed = [];

    for (const anchor of ring.anchors(state)) {
      if (!LABEL_TEXT[anchor.id]) continue;
      const el = elementFor(anchor.id);

      projected.copy(anchor.pos).project(camera);

      // Behind the camera, or outside the frustum: hide rather than wrap
      // around to the wrong side of the screen.
      const offscreen = projected.z > 1
        || projected.x < -1.05 || projected.x > 1.05
        || projected.y < -1.05 || projected.y > 1.05;
      el.classList.toggle('is-hidden', offscreen);
      if (offscreen) continue;

      placed.push({
        el,
        x: (projected.x * 0.5 + 0.5) * w,
        y: (-projected.y * 0.5 + 0.5) * h,
      });
    }

    for (const item of deoverlap(placed)) {
      // Keep the label inside the pane. Anchors near the kiln's edge project
      // close to the border, and a label is wider than its anchor point, so
      // without this the ones at the ends get sliced off as the fire moves.
      const box = item.el.getBoundingClientRect();
      const halfW = box.width / 2 || 40;
      const halfH = box.height / 2 || 10;
      const x = Math.min(w - halfW - 2, Math.max(halfW + 2, item.x));
      const y = Math.min(h - halfH - 2, Math.max(halfH + 2, item.y));

      item.el.style.transform =
        `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }

  function dispose() {
    entries.forEach((el) => el.remove());
    entries.clear();
  }

  return { update, dispose };
}
