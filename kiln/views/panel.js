/**
 * views/panel.js — the context text and the Day 3 debug table.
 *
 * A VIEW: it reads state and writes DOM. It holds no kiln rules, and it takes
 * every number from config.js rather than restating any (brief rule 14.3).
 *
 * Day 3 scope: the debug table section 12 asks for, plus a plain context line.
 * The fork card is Day 10; the evidence legend is Day 11.
 */

import { C, STAGES, TAGS } from '../config.js';

/** One line about what is happening now, and one about how far to trust it. */
function contextFor(state) {
  const hours = state.tick * C.time.tickHours;
  const fire = state.firePos + 1;                 // 1-based for reading aloud
  const band = C.temperature.peakBandC;

  if (state.fork) {
    const at = state.fork.at + 1;
    return {
      line: `The fire has reached chamber ${at}, which is empty. It cannot simply carry on.`,
      qualifier: 'What the factory does here is not known. Three outcomes are modelled; none of them is the right answer.',
    };
  }

  // Charging: the kiln is being filled and has not been lit. No fire, no
  // clock, nothing travelling — and saying so stops the pause reading as a bug.
  if (state.phase === 'charging') {
    const filled = state.chambers.filter((c) => c.loaded).length;
    if (filled === 0) {
      return {
        line: `An empty kiln. Before anything can burn, the chambers have to be stacked with tiles.`,
        qualifier: `Press step or play to start loading. The clock does not run until the fire is lit.`,
      };
    }
    return {
      line: `Loading. ${filled} of ${state.chambers.length} chambers stacked so far, working ahead of where the fire will start.`,
      qualifier: `Nothing is burning yet. How the crew actually works at Kundapur is not known.`,
    };
  }

  if (state.paused && state.tick === 0) {
    return {
      line: `The kiln is lit. Chamber ${fire} is burning, and the tiles ahead of it are already waiting.`,
      qualifier: `The fire moves to the next chamber every ${C.time.tickHours} hours. The tiles never move again.`,
    };
  }

  // The first loop is the kiln being charged, which looks different enough from
  // the steady rhythm to be worth saying out loud.
  const empty = state.chambers.filter((c) => !c.loaded).length;
  if (empty > 1) {
    return {
      line: `Chamber ${fire} is firing while the kiln is still being filled. Tiles are loaded ahead of the fire, never behind it.`,
      qualifier: `${empty} chambers are still empty. How the crew actually works at Kundapur is not known.`,
    };
  }

  // Heat recovery off: the exhaust leaves at the fire and the chambers ahead
  // get nothing. Worth saying, because the kiln looks the same at a glance and
  // only the tiles ahead of the fire give it away.
  if (state.params.recovery === false) {
    return {
      line: `Chamber ${fire} is firing, but its exhaust is going straight up the chimney. The chambers ahead stay cold until the fire reaches them.`,
      qualifier: `${hours} hours in. Peak firing still sits in the ${band[0]}–${band[1]} °C band — the crew simply burns more to hold it.`,
    };
  }

  return {
    line: `Chamber ${fire} is firing. The chambers ahead of it are warming on its exhaust; the ones behind are cooling.`,
    qualifier: `${hours} hours in. Peak firing sits in the ${band[0]}–${band[1]} °C band.`,
  };
}

/**
 * Fuel per chamber fired, as a string. Relative units (section 4), and a RATE
 * rather than a running total — a total only tells you how long you have been
 * watching, and two totals from runs of different lengths cannot be compared.
 *
 * Nothing until a chamber has actually finished firing: a rate with nothing in
 * the denominator would be a number made up to fill the space.
 */
function fuelRate(fuel, firings) {
  if (!firings) return '–';
  return String(Math.round(fuel / firings));
}

/**
 * What the air actually does on each route. One of these is on screen at a
 * time — whichever route the switch has chosen — so the switch changes what
 * the kiln is doing and not merely which figure is brighter.
 *
 * Both are read straight off the one rule in `flowPath`: the gas path runs
 * from `cool` chambers behind the fire to `last` ahead, and `last` is the
 * preheat window with recovery on, zero without. So turning recovery off does
 * NOT stop air being drawn in behind the fire — the intake leg survives, and
 * the fired tiles still give their heat back to it. Only the forward leg is
 * lost. Three jobs for one stream of air, or two: that is the whole of it,
 * and it is the model's own arithmetic rather than a claim laid over it.
 *
 * Said as mechanism. Neither line calls a setting good, cheap or clean, and
 * neither mentions the figures beside them — section 7 rules out a verdict,
 * and the comparison is already there in the two numbers.
 */
const WHY = {
  on: 'One stream of air does three jobs before it leaves: it draws the heat back out of the tiles just fired, feeds the flame with it, then warms the green tiles ahead. Only what is left over goes up the chimney.',
  off: 'The air still cools the fired tiles and still feeds the flame, but then it leaves at the heat of the fire. Nothing ahead is warmed, so every chamber comes to the fire cold.',
};

export function createPanel({ contextEl, debugEl, clockEl, recoveryEl }, dispatch) {
  // Build the debug table once, then only update cell text each frame.
  debugEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Ch</th><th>Stage</th><th>Heat</th><th>Tiles</th><th></th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
    <div class="debug-summary" id="debug-summary"></div>
  `;

  const tbody = debugEl.querySelector('tbody');
  const summary = debugEl.querySelector('#debug-summary');
  const rows = [];

  for (let i = 0; i < C.chambers.count; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td class="cell-stage"></td>
      <td class="cell-temp"></td>
      <td class="cell-loaded"></td>
      <td><button type="button" data-index="${i}"></button></td>
    `;
    tbody.appendChild(tr);
    rows.push({
      tr,
      stage: tr.querySelector('.cell-stage'),
      temp: tr.querySelector('.cell-temp'),
      loaded: tr.querySelector('.cell-loaded'),
      button: tr.querySelector('button'),
    });
  }

  // Empty / reload. Day 9 moves this onto the ring itself; the action is the same.
  tbody.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-index]');
    if (!btn) return;
    const index = Number(btn.dataset.index);
    dispatch({ type: btn.dataset.action === 'load' ? 'loadChamber' : 'emptyChamber', index });
  });

  /**
   * The recovery comparison. Both figures come straight from the engine, which
   * runs the kiln both ways at once over one schedule — so this reads two live
   * numbers and computes nothing (rule 14.2).
   */
  function updateRecovery(state) {
    if (!recoveryEl) return;
    const { on, off, firings } = state.fuelCompare;

    recoveryEl.on.textContent = fuelRate(on, firings);
    recoveryEl.off.textContent = fuelRate(off, firings);

    /**
     * Which row is on screen. Carried by a marker and by `aria-current` as well
     * as by brightness — a difference in tone alone is the one cue a visitor
     * can miss entirely, and it says nothing to anything that is not looking.
     */
    const reusing = state.params.recovery !== false;
    recoveryEl.rowOn.classList.toggle('is-active', reusing);
    recoveryEl.rowOff.classList.toggle('is-active', !reusing);

    const active = reusing ? recoveryEl.rowOn : recoveryEl.rowOff;
    const other = reusing ? recoveryEl.rowOff : recoveryEl.rowOn;
    active.setAttribute('aria-current', 'true');
    other.removeAttribute('aria-current');

    /**
     * The explanation goes with the route that is running, and the other row
     * is left as a bare figure to compare against. Blanked rather than dimmed:
     * two mechanisms on screen at once would have to be held side by side in
     * the head, and only one of them is what the kiln is currently doing.
     *
     * Nothing at all while the kiln is still being charged. The same condition
     * empties the gas path in the engine, so describing what the air does
     * there would be describing air that is not moving.
     */
    const lit = state.phase !== 'charging';
    recoveryEl.whyOn.textContent = lit && reusing ? WHY.on : '';
    recoveryEl.whyOff.textContent = lit && !reusing ? WHY.off : '';

    /**
     * One message, and only while there is nothing to compare — it is there to
     * explain the two dashes. Once a chamber has finished firing the figures
     * speak for themselves and the mechanism is up in the rows, so this empties
     * rather than finding something else to say.
     */
    recoveryEl.note.textContent = firings
      ? ''
      : 'Nothing has finished firing yet, so there is nothing to compare.';
  }

  function update(state) {
    for (let i = 0; i < rows.length; i++) {
      const ch = state.chambers[i];
      const row = rows[i];
      const stage = ch.stage;

      row.stage.textContent = STAGES[stage]?.label ?? stage;
      /**
       * Relative, never degrees. Section 4 allows simulated values only in
       * relative units; the exact temperature is a real number on
       * `chamber.temp` and belongs in the console, not on screen.
       */
      row.temp.textContent = ch.heat.toFixed(2);
      row.loaded.textContent = ch.loaded ? 'loaded' : 'empty';

      row.button.textContent = ch.loaded ? 'empty' : 'load';
      row.button.dataset.action = ch.loaded ? 'empty' : 'load';
      // The firing chamber's tiles are in the fire, so it cannot be emptied.
      row.button.disabled = ch.loaded && i === state.firePos;

      row.tr.classList.toggle('is-fire', stage === 'fire');
      row.tr.classList.toggle('is-empty', !ch.loaded);
    }

    summary.textContent =
      `tick ${state.tick} · fire at ${state.firePos} · ` +
      // Fuel accrues continuously now, so it needs rounding. Relative units —
      // never a mass, per section 4.
      `fuel index ${Math.round(state.fuelIndex)} · ` +
      `${state.fork ? 'FORK' : state.paused ? 'paused' : 'running'}`;

    // Simulated hours, not ticks: the 2-hour interval is the field-documented fact.
    clockEl.textContent = String(state.tick * C.time.tickHours);

    updateRecovery(state);

    const { line, qualifier } = contextFor(state);
    contextEl.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = line;
    const q = document.createElement('p');
    q.className = 'qualifier';
    q.textContent = qualifier;
    // Tag the qualifier with the provenance of the interval it cites.
    q.setAttribute('data-ev', TAGS.time.tickHours);
    contextEl.append(p, q);
  }

  return { update };
}
