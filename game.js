(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const map = document.getElementById('rail-map');
  const trackLayer = document.getElementById('track-layer');
  const routeLayer = document.getElementById('route-highlight-layer');
  const signalLayer = document.getElementById('signal-layer');
  const trainLayer = document.getElementById('train-layer');
  const stationLayer = document.getElementById('station-layer');
  const clockElement = document.getElementById('clock');
  const trainList = document.getElementById('train-list');
  const detailKicker = document.getElementById('detail-kicker');
  const detailTitle = document.getElementById('detail-title');
  const detailCopy = document.getElementById('detail-copy');
  const pauseButton = document.getElementById('pause-button');
  const mapScroll = document.getElementById('map-scroll');
  const tooltip = document.getElementById('train-tooltip');
  const pauseText = { paused: '▶', running: 'Ⅱ' };

  // At 1x the clock runs ten times faster than real time (one game minute per six seconds).
  const GAME_MINUTES_PER_SECOND = 1 / 6;

  const sim = window.KentSignaller.createSimulation();
  const { stations, stationById, edges, edgeById, trains } = sim;

  let speed = 1;
  let paused = false;
  let lastFrame = performance.now();
  let selectedTrainId = null;
  let selectedStationId = null;
  const mapSize = sim.map;
  let viewBox = { x: 0, y: 0, width: mapSize.width, height: mapSize.height };
  let drag = null;
  let hoveredTrainId = null;

  function svg(tag, attributes = {}) {
    const element = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
    return element;
  }

  function formatClock(minute) {
    const hours = Math.floor(minute / 60) % 24;
    const mins = Math.floor(minute) % 60;
    const seconds = Math.floor((minute % 1) * 60);
    return [hours, mins, seconds].map(value => String(value).padStart(2, '0')).join(':');
  }

  function addText(parent, text, x, y, className, anchor) {
    const label = svg('text', { x, y, class: className, 'text-anchor': anchor });
    label.textContent = text;
    parent.appendChild(label);
    return label;
  }

  function renderBackground() {
    const background = document.getElementById('map-background');
    for (const label of mapSize.labels) addText(background, label.text, label.x, label.y, 'region-label', label.anchor);
    const x = mapSize.width - 50;
    addText(background, 'N', x, 74, 'region-label', 'middle');
    background.appendChild(svg('line', { x1: x, y1: 118, x2: x, y2: 84, stroke: '#91a3ac', 'stroke-width': 1.5 }));
    background.appendChild(svg('path', { d: `M ${x} 78 L ${x - 5} 88 L ${x} 85 L ${x + 5} 88 Z`, fill: '#a5e36a' }));
  }

  function renderTracks() {
    for (const edge of edges) {
      const a = stationById.get(edge.from);
      const b = stationById.get(edge.to);
      const group = svg('g', { class: `track-segment${edge.yard ? ' yard-track' : ''}`, 'data-edge': edge.id });
      const line = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      const underlay = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'track-underlay' });
      const rail = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'track-line' });
      const hit = svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'track-hit', 'aria-hidden': 'true' });
      group.append(underlay, rail, hit);
      if (edge.yard) {
        const rect = svg('rect', {
          x: Math.min(a.x, b.x) - 17,
          y: Math.min(a.y, b.y) - 10,
          width: Math.max(34, Math.abs(a.x - b.x) + 34),
          height: Math.max(24, Math.abs(a.y - b.y) + 20),
          rx: 5,
          class: 'yard-area'
        });
        group.insertBefore(rect, underlay);
      }
      trackLayer.appendChild(group);
    }
  }

  function renderSignals() {
    for (const edge of edges) {
      const a = stationById.get(edge.from);
      const b = stationById.get(edge.to);
      const x = (a.x + b.x) / 2;
      const y = (a.y + b.y) / 2;
      const signal = svg('g', { class: 'signal', 'data-edge': edge.id, role: 'button', tabindex: '0', 'aria-label': `Signal ${edge.id}, at danger` });
      signal.appendChild(svg('circle', { cx: x, cy: y, r: 16, class: 'signal-hit' }));
      signal.appendChild(svg('rect', { x: x - 5, y: y - 8, width: 10, height: 16, rx: 4, class: 'signal-body' }));
      signal.appendChild(svg('circle', { cx: x, cy: y - 3, r: 2.8, class: 'signal-light' }));
      signal.addEventListener('click', event => {
        event.stopPropagation();
        toggleSignal(edge);
      });
      signal.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggleSignal(edge);
        }
      });
      signalLayer.appendChild(signal);
    }
  }

  function renderStations() {
    for (const station of stations) {
      const group = svg('g', {
        class: `station ${station.kind}`,
        'data-station': station.id,
        role: 'button',
        tabindex: '0',
        'aria-label': `${station.name}. Select to inspect.`
      });
      group.appendChild(svg('circle', { cx: station.x, cy: station.y, r: 14, fill: 'transparent' }));
      group.appendChild(svg('circle', { cx: station.x, cy: station.y, r: station.kind === 'major' ? 5 : 4, class: 'station-dot' }));
      if (station.kind === 'edge') {
        const angle = (station.arrow || 0) * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const at = distance => [station.x + cos * distance, station.y + sin * distance];
        const [x1, y1] = at(10);
        const [x2, y2] = at(38);
        const [hx1, hy1] = [x2 - cos * 8 - sin * 5, y2 - sin * 8 + cos * 5];
        const [hx2, hy2] = [x2 - cos * 8 + sin * 5, y2 - sin * 8 - cos * 5];
        group.appendChild(svg('path', { d: `M ${x1} ${y1} L ${x2} ${y2} M ${hx1} ${hy1} L ${x2} ${y2} L ${hx2} ${hy2}`, class: 'edge-arrow' }));
        const [lx, ly] = at(46);
        addText(group, station.edgeLabel, lx, ly + 4, 'edge-label', cos < -0.3 ? 'end' : 'start');
      }
      const labelClass = `station-label${station.kind === 'major' ? ' major-label' : ''}${station.kind === 'yard' ? ' yard-label' : ''}`;
      addText(group, station.name, station.x + station.dx, station.y + station.dy, labelClass, station.anchor);
      group.addEventListener('click', event => {
        event.stopPropagation();
        selectStation(station);
      });
      group.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectStation(station);
        }
      });
      stationLayer.appendChild(group);
    }
  }

  function toggleSignal(edge) {
    const { result, count, train } = sim.toggleSignal(edge);
    if (result === 'locked') {
      setDetail('SIGNAL LOCKED', 'Block occupied', 'A train is in this block. The signal remains at danger until it clears.');
    } else if (result === 'cleared') {
      setDetail('ROUTE CLEARED', train ? `Train ${train.number}` : 'Block ready', train
        ? `${count} block${count === 1 ? '' : 's'} cleared along the route to ${stationById.get(train.destination).name}. Click a signal on it again to restore danger.`
        : 'The next train with this block in its route may proceed. Click again to restore danger.');
    } else {
      setDetail('SIGNAL AT DANGER', train ? `Train ${train.number}` : 'Block protected', train
        ? `${count} block${count === 1 ? '' : 's'} returned to danger along the route.`
        : 'Trains will stop before entering this block.');
    }
    render();
  }

  function selectStation(station) {
    selectedStationId = station.id;
    selectedTrainId = null;
    const facilities = station.facilities?.length ? ` Facilities: ${station.facilities.join(', ')}.` : '';
    const { used, total } = sim.platformInfo(station.id);
    setDetail('STATION / LOCATION', station.name, `${station.info}${facilities} Platforms: ${used} of ${total} in use.`);
    render();
  }

  function selectTrain(train) {
    selectedTrainId = train.id;
    selectedStationId = null;
    const origin = stationById.get(train.origin).name;
    const destination = stationById.get(train.destination).name;
    const location = train.edgeId ? ` In block ${train.edgeId.replace('block-', '')}.` : ` At ${stationById.get(train.currentStation).name}.`;
    const headline = {
      waiting: 'Waiting at a red signal',
      held: 'Held: no free platform ahead',
      dwelling: `Standing at ${stationById.get(train.currentStation).name}`
    }[train.status] || `${origin} → ${destination}`;
    setDetail(`${train.type} · ${train.number}`, headline, `${origin} → ${destination}. Booked departure ${formatClock(train.departure)}.${location} Clear the next signal to let it proceed.`);
    render();
  }

  function setDetail(kicker, title, copy) {
    detailKicker.textContent = kicker;
    detailTitle.textContent = title;
    detailCopy.textContent = copy;
  }

  function toggleSignalState(edge) {
    const group = signalLayer.querySelector(`[data-edge="${edge.id}"]`);
    const track = trackLayer.querySelector(`[data-edge="${edge.id}"]`);
    if (!group || !track) return;
    group.classList.toggle('cleared', edge.cleared && !edge.trainId);
    group.classList.toggle('occupied', Boolean(edge.trainId));
    track.classList.toggle('cleared', edge.cleared && !edge.trainId);
    track.classList.toggle('occupied', Boolean(edge.trainId));
    group.setAttribute('aria-label', `Signal ${edge.id}, ${edge.trainId ? 'occupied' : edge.cleared ? 'clear' : 'at danger'}`);
  }

  function renderRouteHighlight() {
    routeLayer.replaceChildren();
    const train = trains.find(candidate => candidate.id === selectedTrainId);
    if (!train) return;
    for (const step of train.path.slice(train.nextStep)) {
      const a = stationById.get(step.from);
      const b = stationById.get(step.to);
      routeLayer.appendChild(svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: 'route-highlight' }));
    }
  }

  // Markers and register rows are created once per train and updated in place,
  // so a click that starts on one is not lost to a DOM rebuild mid-press.
  const trainMarkers = new Map();
  const trainRows = new Map();
  const emptyRegister = document.createElement('div');
  emptyRegister.className = 'empty-register';
  emptyRegister.textContent = 'No trains in section. The first service is booked to depart Victoria at 07:00.';

  function setText(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }

  const statusLabels = { waiting: 'At signal', held: 'Held', dwelling: 'At station', moving: 'Running', arrived: 'Arrived' };
  const tooltipMarkers = new Map();

  function showTooltip(train, marker) {
    hoveredTrainId = train.id;
    tooltipMarkers.set(train.id, marker);
    updateTooltip();
  }

  function hideTooltip(train) {
    if (hoveredTrainId !== train.id) return;
    hoveredTrainId = null;
    tooltip.hidden = true;
  }

  function nextStopName(train) {
    const next = train.edgeId ? train.directionTo : train.path[train.nextStep]?.to;
    return next ? stationById.get(next).name : 'Terminates here';
  }

  function updateTooltip() {
    const train = trains.find(candidate => candidate.id === hoveredTrainId);
    const marker = tooltipMarkers.get(hoveredTrainId);
    if (!train || !marker || train.status === 'arrived') {
      tooltip.hidden = true;
      return;
    }
    const rows = [
      ['Headcode', train.number],
      ['Type', train.type === 'EMU' ? 'Passenger (EMU)' : 'Freight'],
      ['Stock', train.stock],
      ['Unit no.', train.unit],
      ['Route', `${stationById.get(train.origin).name} → ${stationById.get(train.destination).name}`],
      ['Next stop', nextStopName(train)],
      ['Booked', formatClock(train.departure).slice(0, 5)]
    ];
    tooltip.className = `train-tooltip status-${train.status}`;
    tooltip.replaceChildren();
    const header = document.createElement('header');
    const title = document.createElement('strong');
    title.textContent = train.number;
    const state = document.createElement('span');
    state.textContent = statusLabels[train.status] || train.status;
    header.append(title, state);
    const list = document.createElement('dl');
    for (const [label, value] of rows) {
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      list.append(term, detail);
    }
    tooltip.append(header, list);
    tooltip.hidden = false;

    const area = tooltip.offsetParent.getBoundingClientRect();
    const box = marker.getBoundingClientRect();
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    let left = box.left - area.left + box.width / 2 - width / 2;
    let top = box.top - area.top - height - 10;
    if (top < 8) top = box.bottom - area.top + 10;
    left = Math.max(8, Math.min(left, area.width - width - 8));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function createTrainMarker(train) {
    const marker = svg('g', { class: 'train-marker', role: 'button', tabindex: '0' });
    marker.appendChild(svg('rect', { x: -20, y: -9, width: 40, height: 18 }));
    addText(marker, train.number, 0, 0, '', 'middle');
    marker.addEventListener('click', event => {
      event.stopPropagation();
      selectTrain(train);
    });
    for (const [start, end] of [['pointerenter', 'pointerleave'], ['focus', 'blur']]) {
      marker.addEventListener(start, () => showTooltip(train, marker));
      marker.addEventListener(end, () => hideTooltip(train));
    }
    marker.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectTrain(train);
      }
    });
    trainLayer.appendChild(marker);
    return marker;
  }

  function renderTrains() {
    for (const train of trains) {
      let marker = trainMarkers.get(train.id);
      if (train.status === 'arrived') {
        if (marker) {
          marker.remove();
          trainMarkers.delete(train.id);
        }
        continue;
      }
      if (!marker) {
        marker = createTrainMarker(train);
        trainMarkers.set(train.id, marker);
      }
      const point = sim.trainPosition(train);
      marker.setAttribute('transform', `translate(${point.x}, ${point.y})`);
      marker.setAttribute('class', `train-marker status-${train.status}${train.id === selectedTrainId ? ' selected' : ''}`);
      marker.setAttribute('aria-label', `Train ${train.number}, ${train.status}. Select for details.`);
    }
  }

  function createTrainRow(train) {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML = '<span class="train-id"></span><span class="train-destination"></span><span class="train-status"></span>';
    button.querySelector('.train-id').textContent = train.number;
    button.querySelector('.train-destination').textContent = stationById.get(train.destination).name;
    button.addEventListener('click', () => selectTrain(train));
    trainList.appendChild(button);
    return button;
  }

  function renderRegister() {
    const active = trains.filter(train => train.status !== 'arrived');
    setText(document.getElementById('train-count'), String(active.length).padStart(2, '0'));
    for (const train of trains) {
      if (train.status !== 'arrived') continue;
      const row = trainRows.get(train.id);
      if (row) {
        row.remove();
        trainRows.delete(train.id);
      }
    }
    if (!active.length) {
      if (!emptyRegister.isConnected) trainList.appendChild(emptyRegister);
      return;
    }
    emptyRegister.remove();
    for (const train of active) {
      let row = trainRows.get(train.id);
      if (!row) {
        row = createTrainRow(train);
        trainRows.set(train.id, row);
      }
      row.className = `train-row status-${train.status}${train.id === selectedTrainId ? ' active' : ''}`;
      const status = row.querySelector('.train-status');
      setText(status, { waiting: 'at signal', held: 'held', dwelling: 'at station', moving: 'running' }[train.status] || 'booked');
    }
  }

  function render() {
    for (const edge of edges) toggleSignalState(edge);
    stationLayer.querySelectorAll('.station').forEach(group => {
      group.classList.toggle('selected', group.dataset.station === selectedStationId);
    });
    renderRouteHighlight();
    renderTrains();
    renderRegister();
    if (hoveredTrainId) updateTooltip();
  }

  function updateClock() {
    clockElement.textContent = formatClock(sim.minute);
  }

  function frame(now) {
    const elapsed = Math.min((now - lastFrame) / 1000, 0.25);
    lastFrame = now;
    if (!paused) {
      sim.advance(elapsed * speed * GAME_MINUTES_PER_SECOND);
      updateClock();
      render();
    }
    requestAnimationFrame(frame);
  }

  pauseButton.addEventListener('click', () => {
    paused = !paused;
    pauseButton.textContent = pauseText[paused ? 'paused' : 'running'];
    pauseButton.setAttribute('aria-label', paused ? 'Resume simulation' : 'Pause simulation');
    pauseButton.classList.toggle('is-paused', paused);
  });

  document.querySelectorAll('.speed-button').forEach(button => {
    button.addEventListener('click', () => {
      speed = Number(button.dataset.speed);
      document.querySelectorAll('.speed-button').forEach(item => item.classList.toggle('selected', item === button));
    });
  });

  function updateViewBox() {
    map.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  }

  map.addEventListener('wheel', event => {
    event.preventDefault();
    const rect = map.getBoundingClientRect();
    const point = map.createSVGPoint();
    point.x = event.clientX - rect.left;
    point.y = event.clientY - rect.top;
    const cursor = point.matrixTransform(map.getScreenCTM().inverse());
    const factor = event.deltaY < 0 ? 0.88 : 1.14;
    const width = Math.max(600, Math.min(mapSize.width, viewBox.width * factor));
    const height = width * mapSize.height / mapSize.width;
    const ratio = width / viewBox.width;
    viewBox = {
      x: cursor.x - (cursor.x - viewBox.x) * ratio,
      y: cursor.y - (cursor.y - viewBox.y) * ratio,
      width,
      height
    };
    updateViewBox();
  }, { passive: false });

  map.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.signal, .station, .train-marker')) return;
    drag = { x: event.clientX, y: event.clientY, startX: viewBox.x, startY: viewBox.y };
    mapScroll.classList.add('dragging');
    map.setPointerCapture(event.pointerId);
  });

  map.addEventListener('pointermove', event => {
    if (!drag) return;
    const rect = map.getBoundingClientRect();
    viewBox.x = drag.startX - (event.clientX - drag.x) * viewBox.width / rect.width;
    viewBox.y = drag.startY - (event.clientY - drag.y) * viewBox.height / rect.height;
    updateViewBox();
  });

  map.addEventListener('pointerup', () => {
    drag = null;
    mapScroll.classList.remove('dragging');
  });

  map.addEventListener('pointercancel', () => {
    drag = null;
    mapScroll.classList.remove('dragging');
  });

  renderBackground();
  renderTracks();
  renderSignals();
  renderStations();
  updateClock();
  render();
  requestAnimationFrame(frame);
})();
