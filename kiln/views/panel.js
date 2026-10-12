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

  return {
    line: `Chamber ${fire} is firing. The chambers ahead of it are warming on its exhaust; the ones behind are cooling.`,
    qualifier: `${hours} hours in. Peak firing sits in the ${band[0]}–${band[1]} °C band.`,
  };
}

export function createPanel({ contextEl, debugEl, clockEl }, dispatch) {
  // Build the debug table once, then only update cell text each frame.
  debugEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Ch</th><th>Stage</th><th>Temp</th><th>Tiles</th><th></th>
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

  function update(state) {
    for (let i = 0; i < rows.length; i++) {
      const ch = state.chambers[i];
      const row = rows[i];
      const stage = ch.stage;

      row.stage.textContent = STAGES[stage]?.label ?? stage;
      row.temp.textContent = `${Math.round(ch.temp)} °C`;
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
      `fuel index ${state.fuelIndex} · ` +
      `${state.fork ? 'FORK' : state.paused ? 'paused' : 'running'}`;

    // Simulated hours, not ticks: the 2-hour interval is the field-documented fact.
    clockEl.textContent = String(state.tick * C.time.tickHours);

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
