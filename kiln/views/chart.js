/**
 * views/chart.js — the space-time chart: chambers across, time down.
 *
 * A VIEW. It reads recorded history and draws it; it holds no kiln rules.
 *
 * WHAT IT IS FOR
 * The kiln shows one moment. This shows the shape of the sequence, which is
 * the thing a visitor otherwise has to hold in their head: the fire walks down
 * the chart as a diagonal, every chamber is at a different stage in any given
 * row, and a stall bends the diagonal into a visible kink (brief 6.4).
 *
 * Cells take their colour from the SAME ramp as the kiln (views/heatRamp.js),
 * because the chart is not a second dataset — it is the kiln's own history
 * seen along a different axis, and they must agree.
 *
 * Drawn from `history.all()`, so it can only ever show what actually happened.
 * There is no future in it.
 *
 * d3 is the vendored UMD bundle on `window.d3` — its ES-module build re-exports
 * from absolute CDN URLs, which would break the offline requirement.
 */

import { C } from '../config.js';
import { heatHex } from './heatRamp.js';

const MARGIN = { top: 18, right: 8, bottom: 4, left: 34 };

export function createChart(container, history, dispatch) {
  const d3 = window.d3;
  if (!d3) {
    console.warn('[chart] d3 is not loaded — the space-time chart will not draw.');
    return { update() {}, dispose() {} };
  }

  container.classList.remove('chart-placeholder');
  container.innerHTML = '';
  container.classList.add('chart');

  const svg = d3.select(container).append('svg').attr('class', 'chart-svg');

  // A hatch for empty chambers. A gap in the record should look like a gap,
  // the same way an empty chamber does on the kiln.
  const defs = svg.append('defs');
  const hatch = defs.append('pattern')
    .attr('id', 'chart-empty')
    .attr('patternUnits', 'userSpaceOnUse')
    .attr('width', 4).attr('height', 4)
    .attr('patternTransform', 'rotate(45)');
  hatch.append('rect').attr('width', 4).attr('height', 4).attr('class', 'chart-empty-bg');
  hatch.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 4)
    .attr('class', 'chart-empty-line');

  const gCells = svg.append('g').attr('class', 'chart-cells');
  const gChambers = svg.append('g').attr('class', 'chart-chambers');
  const gHours = svg.append('g').attr('class', 'chart-hours');
  const gHead = svg.append('g').attr('class', 'chart-playhead');

  // Rebuilt only when the record or the playhead changes — this is SVG, and
  // redrawing 24 x 8 rects every frame for no reason would be waste.
  let lastSignature = '';
  let rows = [];
  let rowHeight = 0;
  let plotTop = 0;

  /** Which tick a y position inside the chart corresponds to. */
  function tickAt(y) {
    if (!rows.length || rowHeight <= 0) return null;
    const i = Math.floor((y - plotTop) / rowHeight);
    const row = rows[Math.max(0, Math.min(rows.length - 1, i))];
    return row ? row.tick : null;
  }

  /**
   * Clicking or dragging the chart scrubs. A space-time chart is already a
   * timeline, so pointing at a moment ought to go there.
   */
  let dragging = false;
  const toLocal = (ev) => {
    const r = container.getBoundingClientRect();
    return ev.clientY - r.top;
  };
  const scrubFrom = (ev) => {
    const tick = tickAt(toLocal(ev));
    if (tick !== null) dispatch({ type: 'scrubTo', tick });
  };

  container.addEventListener('pointerdown', (ev) => {
    dragging = true;
    container.setPointerCapture?.(ev.pointerId);
    scrubFrom(ev);
  });
  container.addEventListener('pointermove', (ev) => { if (dragging) scrubFrom(ev); });
  const stop = (ev) => {
    dragging = false;
    container.releasePointerCapture?.(ev.pointerId);
  };
  container.addEventListener('pointerup', stop);
  container.addEventListener('pointercancel', stop);

  function update(state, force = false) {
    const all = history.all();

    // Nothing to draw until the kiln is lit: charging records no time.
    const signature = `${all.length}:${state.tick}:${container.clientWidth}`;
    if (!force && signature === lastSignature) return;
    lastSignature = signature;

    const width = container.clientWidth || 1;
    const count = C.chambers.count;

    rows = all.slice(-C.chart.windowTicks);
    const plotW = Math.max(1, width - MARGIN.left - MARGIN.right);
    rowHeight = Math.max(C.chart.minRowHeight, 0);
    const height = MARGIN.top + rows.length * rowHeight + MARGIN.bottom;
    plotTop = MARGIN.top;

    svg.attr('width', width).attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);

    const cellW = plotW / count;

    // --- cells ---------------------------------------------------------
    const data = [];
    rows.forEach((row, r) => {
      row.chambers.forEach((ch, c) => {
        data.push({ key: `${row.tick}-${c}`, r, c, tick: row.tick, ch });
      });
    });

    const cells = gCells.selectAll('rect').data(data, (d) => d.key);
    cells.exit().remove();
    cells.enter().append('rect')
      .merge(cells)
      .attr('x', (d) => MARGIN.left + d.c * cellW)
      .attr('y', (d) => plotTop + d.r * rowHeight)
      .attr('width', Math.max(1, cellW - C.chart.cellGap))
      .attr('height', Math.max(1, rowHeight - C.chart.cellGap))
      // An empty chamber is hatched, not coloured: it held nothing to be hot.
      .attr('fill', (d) => (d.ch.loaded ? heatHex(d.ch.heat) : 'url(#chart-empty)'));

    // --- chamber numbers across the top --------------------------------
    const nums = gChambers.selectAll('text')
      .data(Array.from({ length: count }, (_, i) => i));
    nums.exit().remove();
    nums.enter().append('text')
      .merge(nums)
      .attr('x', (i) => MARGIN.left + i * cellW + cellW / 2)
      .attr('y', MARGIN.top - 6)
      .attr('text-anchor', 'middle')
      .text((i) => i + 1);

    // --- elapsed hours down the side -----------------------------------
    const marks = rows.filter((row) => row.tick % C.chart.hoursLabelEvery === 0);
    const hours = gHours.selectAll('text').data(marks, (row) => row.tick);
    hours.exit().remove();
    hours.enter().append('text')
      .merge(hours)
      .attr('x', MARGIN.left - 6)
      .attr('y', (row) => plotTop + rows.indexOf(row) * rowHeight + rowHeight - 1)
      .attr('text-anchor', 'end')
      .text((row) => `${row.tick * C.time.tickHours}h`);

    // --- playhead ------------------------------------------------------
    const here = rows.findIndex((row) => row.tick === state.tick);
    const head = gHead.selectAll('rect').data(here >= 0 ? [here] : []);
    head.exit().remove();
    head.enter().append('rect')
      .merge(head)
      .attr('x', MARGIN.left - 3)
      .attr('y', (i) => plotTop + i * rowHeight - 1)
      .attr('width', plotW + 6)
      .attr('height', rowHeight + 1);
  }

  function dispose() {
    container.innerHTML = '';
  }

  return { update, dispose, tickAt };
}
