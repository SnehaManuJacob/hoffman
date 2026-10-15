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
     * How the figures are arrived at, which is not obvious and changes what
     * they mean: both are averaged over every firing since the kiln was lit,
     * so the cold start is still in them and the gap goes on widening for a
     * loop or so. Measured: 1.27x at tick 5, 1.73x at tick 25, 1.88x at 65.
     *
     * Said rather than smoothed away. A trailing window would hold still and
     * read the same to every visitor, but it would also hide the fact that a
     * cold kiln is expensive, which is a real thing the model knows.
     *
     * Nothing before the first firing: describing how two dashes were averaged
     * would be explaining figures that do not exist yet.
     */
    if (recoveryEl.basis) {
      recoveryEl.basis.textContent = firings
        ? 'Averaged over every firing since the kiln was lit, so a cold start is still being paid off — the gap goes on widening as the run settles.'
        : '';
    }

    /**
     * The note says what reuse IS, not what it saves. The saving is the number
     * above it; repeating it as a sentence would turn the pair into a verdict,
     * which section 7 rules out.
     */
    recoveryEl.note.textContent = firings
      ? 'Air drawn in behind the fire arrives hot, and leaves the fire still hot enough to warm the tiles ahead. Shutting that off costs fuel, not temperature.'
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
