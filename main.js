(() => {
  'use strict';

  const Y = window.Yard;
  const $ = id => document.getElementById(id);

  const canvas = $('yard');
  const wrap = $('canvas-wrap');
  const hint = $('hint');
  const toasts = $('toasts');
  const board = $('timetable');
  const STORE_KEY = 'pebblebrook-yard-stars';
  const UPGRADE_KEY = 'sibsey-upgrades';
  const TUTORIAL_KEY = 'sibsey-tutorial-done';
  const OVERLAYS = ['menu', 'help', 'results', 'upgrades', 'stats'];

  const starsHtml = $('stars-total').innerHTML;
  let levelIndex = 0;
  let game = null;
  let renderer = null;
  let paused = false;
  let speed = 1;
  let selected = null; // { track, idx }
  let hoverTrack = null;
  let hoverCar = null;
  let hoverPilot = false;
  let hintShown = null; // { text, track, idx, to, until }
  let last = performance.now();
  let panelTimer = 0;
  let chuffTimer = 0;
  let finishTimer = null;

  // ---- Saved stars ----------------------------------------------------------------
  function loadStars() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function saveStars(id, stars) {
    const all = loadStars();
    if ((all[id] || 0) >= stars) return;
    all[id] = stars;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    } catch (error) {
      /* storage unavailable: carry on without saving */
    }
  }

  function loadUpgrades() {
    try {
      const list = JSON.parse(localStorage.getItem(UPGRADE_KEY));
      return Array.isArray(list) ? list : [];
    } catch (error) {
      return [];
    }
  }

  function saveUpgrades(list) {
    try {
      localStorage.setItem(UPGRADE_KEY, JSON.stringify(list));
    } catch (error) {
      /* storage unavailable: the upgrade lasts until the page is closed */
    }
  }

  let ownedUpgrades = loadUpgrades();

  // Stars to spend: the best result on each numbered day, less what has been spent on upgrades.
  function starsEarned() {
    const all = loadStars();
    return Y.LEVELS.reduce((sum, level) => sum + (level.endless || level.freeplay ? 0 : all[level.id] || 0), 0);
  }
  const starsSpent = () => Y.UPGRADES.filter(u => ownedUpgrades.includes(u.id)).reduce((sum, u) => sum + u.cost, 0);
  const starsAvailable = () => Math.max(0, starsEarned() - starsSpent());

  function tutorialDone() {
    try {
      return localStorage.getItem(TUTORIAL_KEY) === '1';
    } catch (error) {
      return false;
    }
  }

  function setTutorialDone() {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1');
    } catch (error) {
      /* carry on without remembering */
    }
  }

  // ---- Helpers --------------------------------------------------------------------
  const clock = minute => {
    const m = Math.floor(minute);
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  function toast(text, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = text;
    toasts.appendChild(el);
    setTimeout(() => el.remove(), 3800);
    while (toasts.children.length > 3) toasts.firstChild.remove();
  }

  // Special trains can earn more than three stars (bonus stars), so don't go negative.
  const starText = n => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));

  function show(id) {
    for (const overlay of OVERLAYS) $(overlay).classList.toggle('hidden', overlay !== id);
  }

  function hideOverlays() {
    for (const overlay of OVERLAYS) $(overlay).classList.add('hidden');
  }

  const overlayOpen = () => ['menu', 'help', 'upgrades', 'stats'].some(id => !$(id).classList.contains('hidden'));

  // ---- Menu -----------------------------------------------------------------------
  function buildMenu() {
    const stars = loadStars();
    const list = $('levels');
    list.replaceChildren();
    for (const [i, level] of Y.LEVELS.entries()) {
      const max = level.departures.length * 3;
      const got = stars[level.id] || 0;
      const endless = !!level.endless;
      const freeplay = !!level.freeplay;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card';
      card.innerHTML = '<span class="num"></span><span class="txt"><b></b><small></small></span><span class="earned"></span>';
      card.querySelector('.num').textContent = i + 1;
      card.querySelector('b').textContent = level.title;
      card.querySelector('small').textContent = level.blurb;
      if (freeplay) card.querySelector('.earned').innerHTML = got ? `🚂 ${got}<i> best</i>` : '<i>∞</i>';
      else if (endless) card.querySelector('.earned').innerHTML = got ? `🚂 ${got}<i> best</i>` : '<i>∞</i>';
      else card.querySelector('.earned').innerHTML = got ? `★ ${got}<i> / ${max}</i>` : `<i>0 / ${max}</i>`;
      card.addEventListener('click', () => {
        Y.sound.unlock();
        startLevel(i);
      });
      list.appendChild(card);
    }
    const spare = starsAvailable();
    $('upgrades-button').textContent = spare > 0 ? `Upgrades · ★ ${spare} to spend` : 'Upgrades';
    $('upgrades-button').classList.toggle('glow', spare > 0 && Y.UPGRADES.some(u => !ownedUpgrades.includes(u.id) && u.cost <= spare));
  }

  // ---- Game setup -----------------------------------------------------------------
  function startLevel(index) {
    levelIndex = index;
    clearTimeout(finishTimer);
    Y.sound.startMusic();
    game = Y.createGame(Y.LEVELS[index], { upgrades: ownedUpgrades });
    if (!renderer) renderer = Y.createRenderer(canvas, game);
    else renderer.setGame(game);
    selected = null;
    hintShown = null;
    setSpeed(1);
    paused = false;
    $('pause').textContent = 'Ⅱ';
    $('level-name').textContent = `Day ${index + 1}: ${game.level.title}`;
    if (game.freeplay) $('stars-total').title = 'Trains sent off';
    else if (game.endless) $('stars-total').title = 'Trains sent off, and trains missed';
    else {
      $('stars-total').title = 'Stars earned this day';
      $('stars-total').innerHTML = starsHtml;
      $('star-max').textContent = game.maxStars;
    }
    $('call-train').hidden = !game.freeplay;
    startTutorial(Boolean(game.level.tutorial) && (forceTutorial || !tutorialDone()));
    forceTutorial = false;
    buildBoard();
    fit();
    hideOverlays();
    toasts.replaceChildren();
    last = performance.now();
  }

  let forceTutorial = false;
  let zoom = 1;
  const scroller = $('scroller');
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    document.documentElement.classList.add('is-touch');
  }

  // Zoom about a screen point, keeping the spot under it in place.
  function setZoom(next, clientX, clientY) {
    next = Math.max(1, Math.min(3, next));
    if (next === zoom) return;
    const rect = canvas.getBoundingClientRect();
    const sr = scroller.getBoundingClientRect();
    const px = clientX === undefined ? sr.left + sr.width / 2 : clientX;
    const py = clientY === undefined ? sr.top + sr.height / 2 : clientY;
    const fx = (px - rect.left) / rect.width;
    const fy = (py - rect.top) / rect.height;
    zoom = next;
    fit();
    const after = canvas.getBoundingClientRect();
    scroller.scrollLeft += after.left + fx * after.width - px;
    scroller.scrollTop += after.top + fy * after.height - py;
  }

  function fit() {
    if (!renderer) return;
    const aspect = game.W / game.H;
    const w = Math.min(wrap.clientWidth - 24, (wrap.clientHeight - 24) * aspect);
    const width = Math.max(200, Math.floor(w * zoom));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${Math.floor(width / aspect)}px`;
    renderer.resize(width);
  }

  // ---- Side board -----------------------------------------------------------------
  function consist(list, reverse) {
    const row = document.createElement('div');
    row.className = 'consist';
    const types = reverse ? [...list].reverse() : list;
    for (const type of types) {
      const img = document.createElement('img');
      img.src = renderer.icon(type);
      img.alt = type === 'loco' ? 'Any engine' : Y.TYPES[type].name;
      img.title = type === 'loco' ? 'Any engine' : Y.TYPES[type].name;
      row.appendChild(img);
    }
    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';
    row.appendChild(arrow);
    return row;
  }

  function buildBoard() {
    builtVersion = game.scheduleVersion;
    board.replaceChildren();
    lastNext = null;
    const rows = [
      ...game.departures.filter(dep => !dep.free).map(dep => ({ kind: 'dep', item: dep, at: dep.at })),
      ...game.arrivals.map(arrival => ({ kind: 'arr', item: arrival, at: arrival.at }))
    ];
    // Time order; at the same minute the arriving train comes first.
    rows.sort((a, b) => a.at - b.at || (a.kind === 'arr' ? -1 : 1));
    for (const row of rows) {
      const card = document.createElement('div');
      card.dataset.key = `${row.kind}${row.item.id}`;
      card.innerHTML = '<div class="top"><span class="time"></span><span class="name"><b></b><small></small></span><span class="chip"></span></div>';
      card.querySelector('.time').textContent = clock(game.level.start + row.at);
      if (row.kind === 'dep') {
        const dep = row.item;
        card.className = 'card dep';
        card.querySelector('b').textContent = dep.name;
        const engines = dep.spec.filter(t => t === 'loco' || (Y.TYPES[t] && Y.TYPES[t].kind === 'loco'));
        const engineText = dep.spec[0] === 'steam' ? 'steam engine only' : engines.length > 1 ? `${engines.length} engines` : 'any engine';
        const extra = dep.special ? ` · ${Y.SPECIALS[dep.special].bonus} bonus ★` : '';
        card.querySelector('small').textContent = `Departs to ${dep.dest} · ${game.byId.get(dep.track).name} · ${engineText}${extra}`;
        if (dep.special) {
          card.classList.add('special');
          card.title = Y.SPECIALS[dep.special].text;
        }
        // Icons run left to right like the track does: back of the train first, engine last.
        card.appendChild(consist(dep.spec, true));
      } else {
        const arrival = row.item;
        card.className = 'card arr';
        card.querySelector('b').textContent = `From ${arrival.from}`;
        card.querySelector('small').textContent = `Arrives · ${arrival.cars.length} vehicles · ${game.byId.get(arrival.track).name}`;
        card.appendChild(consist(arrival.cars, false));
      }
      board.appendChild(card);
    }
    updateBoard();
  }

  let lastNext = null;
  let builtVersion = 0;
  function updateBoard() {
    if (game.scheduleVersion !== builtVersion) buildBoard();
    let next = null;
    for (const dep of game.departures) {
      const card = board.querySelector(`[data-key="dep${dep.id}"]`);
      if (!card) continue;
      const left = Math.round(game.level.start + dep.at - game.minute);
      let chip = left > 0 ? `in ${left} min` : left === 0 ? 'now' : `${-left} min late`;
      if (dep.status === 'boarding') chip = dep.spec.some(t => Y.TYPES[t] && Y.TYPES[t].kind === 'coach') ? 'Boarding…' : 'Loading…';
      if (dep.status === 'ready') chip = 'Ready ✓';
      if (dep.status === 'done') chip = starText(dep.stars);
      if (dep.status === 'cancelled') chip = 'Missed';
      card.className = `card dep status-${dep.status}${game.activeDeparture(dep.track) === dep ? ' active' : ''}${dep.special ? ' special' : ''}`;
      // Trains that have left or been missed drop off the list, so the top is always what happens next.
      card.hidden = dep.status === 'done' || dep.status === 'cancelled';
      card.querySelector('.chip').textContent = chip;
      if (!next && dep.status !== 'done' && dep.status !== 'cancelled') next = card;
    }
    for (const arrival of game.arrivals) {
      const card = board.querySelector(`[data-key="arr${arrival.id}"]`);
      if (!card) continue;
      const left = Math.round(game.level.start + arrival.at - game.minute);
      let chip = left > 0 ? `in ${left} min` : 'due';
      if (arrival.status === 'coming' && left <= 0) chip = 'Waiting…';
      if (arrival.status === 'arriving') chip = 'Arriving!';
      if (arrival.status === 'derailed') chip = 'Derailed!';
      if (arrival.status === 'unloading') chip = arrival.cars.some(t => Y.TYPES[t] && Y.TYPES[t].kind === 'coach') ? 'Disembarking…' : 'Unloading…';
      if (arrival.status === 'arrived') chip = 'Here ✓';
      card.className = `card arr status-${arrival.status}`;
      card.hidden = arrival.status === 'arrived';
      card.querySelector('.chip').textContent = chip;
      if (arrival.status === 'coming' || arrival.status === 'arriving' || arrival.status === 'unloading') {
        if (!next || Number(card.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING)) next = card;
      }
    }
    // Mark the first thing still to happen so the eye goes straight to it.
    for (const card of board.children) card.classList.toggle('next', card === next);
    if (next && next !== lastNext) next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    lastNext = next;
    $('undo').disabled = !game.canUndo();
    updateSkyChip();
    $('call-train').disabled = !game.canCallTrain();
    $('clock').textContent = clock(game.minute);
    if (game.freeplay) {
      $('stars-total').innerHTML = `🚂 <span id="star-count">${game.sent}</span> sent`;
    } else if (game.endless) {
      $('stars-total').innerHTML = `🚂 <span id="star-count">${game.sent}</span> sent &nbsp;✗ ${game.missed} / ${game.maxMisses}`;
    } else $('star-count').textContent = game.stars;
  }

  function updateSkyChip() {
    const h = game.hour();
    const w = game.weather;
    let icon = '☀️';
    let label = 'Sunny';
    if (h < 6.2 || h >= 20.6) {
      icon = '🌙';
      label = 'Night';
    } else if (w.kind === 'rain' && w.amount > 0.4) {
      icon = '🌧️';
      label = 'Rain';
    } else if (w.kind === 'fog' && w.amount > 0.4) {
      icon = '🌫️';
      label = 'Fog';
    } else if (w.kind === 'cloudy' && w.amount > 0.4) {
      icon = '⛅';
      label = 'Cloudy';
    } else if (h >= 18 || h < 7) {
      icon = '🌅';
      label = h >= 18 ? 'Sunset' : 'Sunrise';
    }
    const chip = $('sky-chip');
    if (chip.textContent !== icon) chip.textContent = icon;
    chip.title = label;
  }

  // ---- Input ----------------------------------------------------------------------
  function hitVehicle(pt) {
    let best = null;
    for (const pose of game.vehiclePoses()) {
      if (pose.idx === undefined) continue;
      if (Math.abs(pt.x - pose.x) <= 28 && pt.y >= pose.y - 42 && pt.y <= pose.y + 6) {
        if (!best || Math.abs(pt.x - pose.x) < Math.abs(pt.x - best.x)) best = pose;
      }
    }
    return best;
  }

  function hitPilot(pt) {
    const p = game.pilotPose();
    return Math.abs(pt.x - p.x) <= 30 && pt.y >= p.y - 46 && pt.y <= p.y + 6;
  }

  function hitTrack(pt) {
    for (const track of game.tracks) {
      if (pt.y >= track.y - 30 && pt.y <= track.y + 14 && pt.x >= track.xMin - 10 && pt.x <= track.xMax + 30) return track;
    }
    return null;
  }

  function targets() {
    return selected ? game.validTargets(selected.track, selected.idx + 1) : [];
  }

  const touches = new Map();
  let pinch = null;
  let tap = null;

  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return handlePress(event);
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 1) {
      tap = { id: event.pointerId, x: event.clientX, y: event.clientY, ok: true };
    } else {
      tap = null;
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      }
    }
  });

  canvas.addEventListener('pointermove', event => {
    const t = touches.get(event.pointerId);
    if (!t) return;
    t.x = event.clientX;
    t.y = event.clientY;
    if (tap && tap.id === event.pointerId && Math.hypot(t.x - tap.x, t.y - tap.y) > 10) tap.ok = false;
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(pinch.zoom * d / pinch.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
  });

  function endTouch(event, canTap) {
    if (!touches.delete(event.pointerId)) return;
    if (touches.size < 2) pinch = null;
    if (canTap && tap && tap.id === event.pointerId && tap.ok) handlePress(event);
    tap = null;
  }
  canvas.addEventListener('pointerup', event => endTouch(event, true));
  canvas.addEventListener('pointercancel', event => endTouch(event, false));

  $('zoom-in').addEventListener('click', () => setZoom(zoom * 1.4));
  $('zoom-out').addEventListener('click', () => setZoom(zoom / 1.4));
  $('zoom-fit').addEventListener('click', () => setZoom(1));

  function handlePress(event) {
    if (!game) return;
    Y.sound.unlock();
    const pt = renderer.toLogical(event.clientX, event.clientY);
    const car = hitVehicle(pt);
    const track = hitTrack(pt);

    if (hitPilot(pt)) {
      if (game.pilot.track !== null && !game.busy() && game.sendHome()) {
        selected = null;
        Y.sound.toot();
      }
      return;
    }

    if (car) {
      if (game.busy()) {
        Y.sound.deny();
        toast('Pip is busy, one moment!');
        return;
      }
      const chosen = game.byId.get(car.track);
      if (chosen.locked) return;
      if (game.isUnloading(car.track)) {
        if (game.unloadingKind(car.track) === 'derail') {
          callRecovery(car.track);
          return;
        }
        Y.sound.deny();
        toast(unloadMessage(car.track, false));
        return;
      }
      if (selected && selected.track === car.track && selected.idx === car.idx) {
        selected = null;
        Y.sound.drop();
      } else if (selected && selected.track !== car.track && targets().includes(car.track)) {
        // Clicking a vehicle on a valid target track counts as clicking the track.
        dropOn(car.track);
      } else {
        // Picking an engine takes just that engine (it runs to the shed and leaves its train where it stands);
        // pick the last vehicle of a train to move the whole train.
        const from = game.byId.get(car.track);
        selected = { track: car.track, idx: car.idx };
        Y.sound.pick();
        const engineOnly = from.cars.slice(0, car.idx + 1).every(v => game.isLoco(v.type));
        if (game.cutNeedsService(car.track, car.idx + 1) && engineOnly) {
          toast(from.kind !== 'shed' && from.cars.length > car.idx + 1
            ? 'Engine picked: send it to an engine shed and its train stays here. To move the whole train, pick its last vehicle.'
            : 'That engine is tired, so it can only go to the engine shed.');
        }
      }
      return;
    }
    if (track && !selected && game.unloadingKind(track.id) === 'derail') {
      callRecovery(track.id);
      return;
    }
    if (track && selected) {
      dropOn(track.id);
      return;
    }
    selected = null;
  }

  function unloadMessage(trackId, there) {
    const kind = game.unloadingKind(trackId);
    if (kind === 'goods') return there ? 'Goods are still being unloaded there. Please wait.' : 'Goods are still being unloaded. Please wait.';
    return there ? 'Passengers are still getting off there.' : 'Passengers are still getting off. One moment!';
  }

  function callRecovery(trackId) {
    if (game.callRecovery(trackId)) Y.sound.toot();
    else toast('The recovery crew is already on its way.');
  }

  function dropOn(trackId) {
    if (!targets().includes(trackId)) {
      Y.sound.deny();
      const t = game.byId.get(trackId);
      let message = 'Not enough room on that track!';
      if (t.kind === 'pip') message = "That is Pip's own siding.";
      else if (t.locked) message = 'That track is closed today.';
      else if (game.unloadingKind(trackId) === 'derail') message = 'A derailed train is blocking that road.';
      else if (game.isUnloading(trackId)) message = unloadMessage(trackId, true);
      else if (game.cutNeedsService(selected.track, selected.idx + 1) && t.kind !== 'shed') {
        message = game.byId.get(selected.track).cars.slice(0, selected.idx + 1).every(v => game.isLoco(v.type))
          ? 'A tired engine on its own can only go to an engine shed.'
          : 'A train with a tired engine can only go into a siding, or onto a road that already has a serviced engine at the front.';
      }
      toast(message, 'bad');
      return;
    }
    if (game.startMove(selected.track, selected.idx, trackId)) {
      Y.sound.toot();
    }
    selected = null;
  }

  canvas.addEventListener('pointermove', event => {
    if (!game) return;
    const pt = renderer.toLogical(event.clientX, event.clientY);
    const car = hitVehicle(pt);
    const track = hitTrack(pt);
    hoverTrack = track ? track.id : null;
    hoverCar = car ? { track: car.track, idx: car.idx } : null;
    hoverPilot = hitPilot(pt) && game.pilot.track !== null && !game.busy();
    canvas.style.cursor = (hoverPilot || car || (track && selected)) && !game.busy() ? 'pointer' : 'default';
  });

  canvas.addEventListener('pointerleave', () => {
    hoverTrack = null;
    hoverCar = null;
    hoverPilot = false;
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') selected = null;
    const typing = OVERLAYS.some(id => !$(id).classList.contains('hidden'));
    if (game && !typing && (event.key === 'z' || event.key === 'Z')) undo();
    if (game && !typing && (event.key === 'h' || event.key === 'H')) showHint();
    if (event.key === ' ' && game && $('menu').classList.contains('hidden')) {
      event.preventDefault();
      togglePause();
    }
  });

  // ---- Controls -------------------------------------------------------------------
  function togglePause() {
    paused = !paused;
    $('pause').textContent = paused ? '▶' : 'Ⅱ';
    $('pause').classList.toggle('on', paused);
  }

  function undo() {
    if (!game || paused || !game.undo()) {
      Y.sound.deny();
      return;
    }
    selected = null;
    hintShown = null;
    Y.sound.drop();
    toast('Last move undone.');
  }

  function showHint() {
    if (!game || game.finished) return;
    const h = game.hint();
    selected = null;
    if (!h) {
      toast('Nothing to do right now. Keep an eye on the clock!');
      return;
    }
    hintShown = { ...h, until: performance.now() + 9000 };
    tutorial.usedHint = true;
    Y.sound.pick();
  }

  $('call-train').addEventListener('click', () => {
    if (!game || paused) return;
    if (game.callTrain()) {
      selected = null;
      toast('You called the next train in from the main line.');
    } else {
      Y.sound.deny();
      toast(game.canCallTrain() ? 'No train is available right now.' : 'A train is already on its way, or every platform and the goods road is busy.', 'bad');
    }
  });
  $('undo').addEventListener('click', undo);
  $('hint-button').addEventListener('click', showHint);
  $('pause').addEventListener('click', togglePause);
  function setSpeed(value) {
    speed = value;
    for (const b of document.querySelectorAll('.speed button')) b.classList.toggle('selected', Number(b.dataset.speed) === value);
  }
  for (const button of document.querySelectorAll('.speed button')) {
    button.addEventListener('click', () => setSpeed(Number(button.dataset.speed)));
  }
  // The music setting is remembered between visits.
  const MUSIC_KEY = 'sibsey.music';
  function showMusic(on) {
    $('music').classList.toggle('on', on);
    $('music').textContent = on ? '♫' : '✕';
    $('music').setAttribute('aria-label', on ? 'Music on' : 'Music off');
  }
  try {
    if (localStorage.getItem(MUSIC_KEY) === 'off') {
      Y.sound.setMusic(false);
      showMusic(false);
    }
  } catch (e) { /* private browsing: just start with music on */ }
  $('music').addEventListener('click', () => {
    const on = !Y.sound.isMusicOn();
    Y.sound.setMusic(on);
    showMusic(on);
    try { localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
  });
  $('sound').addEventListener('click', () => {
    const mute = !Y.sound.isMuted();
    Y.sound.setMuted(mute);
    $('sound').classList.toggle('on', !mute);
    $('sound').textContent = mute ? '✕' : '♪';
    $('sound').setAttribute('aria-label', mute ? 'Sound effects off' : 'Sound effects on');
  });
  $('help-button').addEventListener('click', () => {
    paused = true;
    $('pause').textContent = '▶';
    $('pause').classList.add('on');
    show('help');
    helpFrom = 'game';
  });
  let helpFrom = 'menu';
  $('howto').addEventListener('click', () => {
    helpFrom = 'menu';
    show('help');
  });
  $('help-close').addEventListener('click', () => {
    if (helpFrom === 'menu') show('menu');
    else {
      hideOverlays();
      paused = false;
      $('pause').textContent = 'Ⅱ';
      $('pause').classList.remove('on');
    }
  });
  $('menu-button').addEventListener('click', () => {
    buildMenu();
    show('menu');
  });
  $('again').addEventListener('click', () => startLevel(levelIndex));
  $('next').addEventListener('click', () => startLevel(Math.min(levelIndex + 1, Y.LEVELS.length - 1)));
  $('results-menu').addEventListener('click', () => {
    buildMenu();
    show('menu');
  });
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 150));
  if (window.ResizeObserver) new ResizeObserver(fit).observe(wrap);
  $('rotate-close').addEventListener('click', () => $('rotate-hint').classList.add('dismissed'));

  // ---- Game events ---------------------------------------------------------------
  function pilotPoint() {
    const p = game.pilotPose();
    return { x: p.x, y: p.y - 20 };
  }

  function handleEvents() {
    for (const event of game.events.splice(0)) {
      switch (event.type) {
        case 'couple':
          Y.sound.couple();
          renderer.burst(pilotPoint().x, pilotPoint().y, 'spark');
          break;
        case 'uncouple':
          Y.sound.drop();
          break;
        case 'arriving': {
          Y.sound.whistle();
          toast(`A train from ${event.arrival.from} is arriving!`);
          const road = game.byId.get(event.arrival.track);
          Y.sound.announce(road.kind === 'goods'
            ? `Toot toot! A goods train from ${event.arrival.from} is coming in!`
            : `Toot toot! The ${event.arrival.from} train is coming in to ${road.name.toLowerCase()}!`);
          break;
        }
        case 'weather':
          toast({ rain: 'Rain is coming in. Wet rails make derailments more likely.', fog: 'Fog is rolling in. Signals are more likely to fail.', cloudy: 'Clouds are gathering.', clear: 'The weather is clearing up.' }[event.kind]);
          break;
        case 'dumped':
          toast('A spare train has left the yard. That clears some space!', 'good');
          break;
        case 'servicing':
          toast('The engine is being serviced in the shed.');
          break;
        case 'serviced':
          Y.sound.ding();
          toast('An engine has been serviced and is ready to work.', 'good');
          break;
        case 'unloading':
          toast(event.arrival.cars.some(type => Y.isPassenger(type)) ? 'Passengers are getting off…' : 'Unloading goods. Please wait…');
          break;
        case 'arrived':
          toast(`The ${event.arrival.from} train is unloaded. Take the whole train into a siding, and the tired engine will go to the shed.`);
          break;
        case 'blocked':
          Y.sound.deny();
          toast(`Track works! ${game.byId.get(event.track).name} is closed for about ${event.minutes} minutes.`, 'bad');
          break;
        case 'reopened':
          Y.sound.ding();
          toast(`${game.byId.get(event.track).name} has reopened.`, 'good');
          break;
        case 'derail':
          Y.sound.sad();
          Y.sound.announce(`Oh no! A train has come off the rails on ${game.byId.get(event.track).name.toLowerCase()}! Call the crane!`, true);
          toast(`The ${event.arrival.from} train has derailed on ${game.byId.get(event.track).name}! Click it to call the recovery crew.`, 'bad');
          break;
        case 'recovering':
          toast('The recovery crew is on its way. Please wait…');
          break;
        case 'recovered':
          Y.sound.ding();
          toast(`The ${event.arrival.from} train is back on the rails. Move it into a siding.`, 'good');
          break;
        case 'signalfail':
          Y.sound.deny();
          toast(`Signal failure on ${game.byId.get(event.track).name}! Trains will leave very slowly for about ${event.minutes} minutes.`, 'bad');
          break;
        case 'signalfixed':
          Y.sound.ding();
          toast(`The signal on ${game.byId.get(event.track).name} has been repaired.`, 'good');
          break;
        case 'breakdown':
          Y.sound.sad();
          toast(`${event.dep.name}'s engine has broken down! Move the train off it, send the engine to the shed and fit a new one.`, 'bad');
          break;
        case 'held':
          Y.sound.deny();
          toast(`The ${event.arrival.from} train is held at the signal. Clear ${game.byId.get(event.arrival.track).name}!`, 'bad');
          break;
        case 'boarding':
          Y.sound.ding();
          break;
        case 'ready':
          toast(`${event.dep.name} is ready!`, 'good');
          Y.sound.ding();
          Y.sound.announce(`All aboard! The ${spoken(event.dep.name)} to ${event.dep.dest} is ready to go!`);
          break;
        case 'depart': {
          const track = game.byId.get(event.track);
          Y.sound.bell();
          Y.sound.whistle();
          Y.sound.cheer(event.dep.stars);
          renderer.burst(track.xEnd - 40, track.y - 30, 'confetti');
          toast((game.freeplay ? `${event.dep.name} departed!` : `${event.dep.name} departed! ${starText(event.dep.stars)}`) + (event.slow ? ' Slowly, because of the signal failure.' : ''), 'good');
          break;
        }
        case 'cancel':
          Y.sound.sad();
          toast(game.endless ? `${event.dep.name} missed! That's ${event.missed} of ${game.maxMisses}.` : `${event.dep.name} had to leave without a train.`, 'bad');
          break;
        case 'finish':
          finishTimer = setTimeout(() => showResults(event), 1800);
          break;
        default:
      }
    }
  }

  // Announcements read out loud shouldn't try to say the emoji.
  const spoken = text => text.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();

  function showResults(event) {
    setSpeed(1);
    if (game.endless) {
      saveStars(game.level.id, event.sent);
      $('results-title').textContent = event.sent >= 10 ? 'Brilliant!' : event.sent >= 5 ? 'Well done!' : 'Good try!';
      const row = $('results-stars');
      row.replaceChildren();
      $('results-text').textContent = `You sent off ${event.sent} ${event.sent === 1 ? 'train' : 'trains'} before missing ${event.missed}. Best so far: ${loadStars()[game.level.id] || event.sent}.`;
      $('next').style.display = 'none';
      renderStats($('results-stats'), game);
      show('results');
      return;
    }
    saveStars(game.level.id, event.stars);
    const ratio = event.max ? event.stars / event.max : 0;
    $('results-title').textContent = ratio >= 0.9 ? 'Brilliant!' : ratio >= 0.5 ? 'Well done!' : 'Good try!';
    const row = $('results-stars');
    row.replaceChildren();
    const lit = Math.round(ratio * 3);
    for (let i = 0; i < 3; i++) {
      const s = document.createElement('span');
      s.textContent = '★';
      if (i < lit) {
        s.className = 'on';
        s.style.animationDelay = `${i * 0.25}s`;
      }
      row.appendChild(s);
    }
    const spare = starsAvailable();
    $('results-text').textContent = `You earned ${event.stars} of ${event.max} stars on Day ${levelIndex + 1}.` +
      (spare > 0 ? ` You have ★ ${spare} to spend on upgrades!` : '');
    $('next').style.display = levelIndex + 1 < Y.LEVELS.length ? '' : 'none';
    renderStats($('results-stats'), game);
    show('results');
  }

  // ---- Hint bar ------------------------------------------------------------------
  function updateHint() {
    let text = '';
    if (game.finished) text = '';
    else if (paused) text = 'Paused. Press the play button to carry on.';
    else if (hintShown && hintShown.until > performance.now()) text = `💡 ${hintShown.text}`;
    else if (game.busy()) text = 'Pip is working…';
    else if (selected) {
      const n = selected.idx + 1;
      text = `Picked up ${n} ${n === 1 ? 'vehicle' : 'vehicles'}. Now click a green track to put ${n === 1 ? 'it' : 'them'} there.`;
    } else if (game.pilot.hooked) {
      text = 'Pip is hooked on to the train. Pick another vehicle to keep going, or click Pip to send it home.';
    } else if (game.minute - game.level.start < 3) text = 'Click a vehicle to pick it up. Pip takes it and everything between it and the yard entrance. A train with an engine drives itself.';
    hint.textContent = text;
  }

  // ---- Main loop -----------------------------------------------------------------
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    try {
      step(now, dt);
    } catch (error) {
      // One bad frame must never stop the game for good.
      console.error(error);
    }
    requestAnimationFrame(frame);
  }

  function step(now, dt) {
    if (game && renderer) {
      const covered = overlayOpen();
      if (!paused && !covered && !tutorialHolds()) {
        // Once every train still to leave is built and ready, there is nothing left to do, so the clock races to the end.
        const pending = game.endless || game.freeplay ? [] : game.departures.filter(d => d.status !== 'done' && d.status !== 'cancelled');
        const autoFinish = pending.length > 0 && pending.every(d => d.status === 'ready');
        $('fast-forward').hidden = !autoFinish;
        let remaining = dt * (autoFinish ? Math.max(speed, 60) : speed);
        while (remaining > 0) {
          const step = Math.min(remaining, 0.03);
          const wasBusy = !!game.job;
          game.update(step);
          remaining -= step;
          if (!wasBusy && game.job) {
            selected = null;
            hintShown = null;
          }
        }
      }
      if (paused || covered || tutorialHolds()) $('fast-forward').hidden = true;
      handleEvents();
      // Engines chuff while they move, and the rain patters.
      if (!paused && !covered && game.moving()) {
        chuffTimer -= dt * Math.min(speed, 4);
        if (chuffTimer <= 0) {
          Y.sound.chuff();
          chuffTimer = 0.27;
        }
      }
      Y.sound.setRain(!covered && !paused && game.weather.kind === 'rain' ? game.weather.amount : 0);
      if (selected) {
        const from = game.byId.get(selected.track);
        if (!from || from.cars.length <= selected.idx) selected = null;
      }
      panelTimer += dt;
      if (panelTimer > 0.25) {
        panelTimer = 0;
        updateBoard();
        updateHint();
        updateTutorial();
      }
      if (hintShown && (hintShown.until < now || selected)) hintShown = null;
      const hinting = hintShown && hintShown.track !== undefined;
      renderer.draw(now, paused ? 0 : dt, {
        selected,
        targets: hinting ? [hintShown.to] : targets(),
        hoverTrack,
        hoverCar: hinting ? { track: hintShown.track, idx: hintShown.idx } : hoverCar,
        hoverPilot,
        highlight: tutorialHighlight()
      });
    }
  }

  // ---- Stats ------------------------------------------------------------------------
  function renderStats(container, g) {
    const st = g.stats;
    const avgLate = st.sent ? st.lateMinutes / st.sent : 0;
    const rows = [
      ['🚆', 'Trains sent off', st.sent],
      ['⏱️', 'Left on time', st.sent ? `${st.onTime} of ${st.sent}` : '–'],
      ['🕒', 'Average lateness', st.sent ? `${avgLate.toFixed(1)} min` : '–'],
      ['❌', 'Trains missed', st.missed],
      ['📥', 'Trains arrived', st.arrivals + st.recovered],
      ['👑', 'Special trains', st.specials ? `${st.specials} (${st.bonusStars} bonus ★)` : 0]
    ];
    if (g.level.events) {
      rows.push(['🛤️', 'Track works', st.trackWorks], ['🚦', 'Signal failures', st.signalFailures],
        ['🔧', 'Engine breakdowns', st.breakdowns], ['🚧', 'Derailments recovered', `${st.recovered} of ${st.derailments}`]);
    }
    container.replaceChildren(...rows.map(([icon, name, value]) => {
      const row = document.createElement('div');
      row.className = 'stat';
      row.innerHTML = '<span class="si"></span><span class="sn"></span><b class="sv"></b>';
      row.querySelector('.si').textContent = icon;
      row.querySelector('.sn').textContent = name;
      row.querySelector('.sv').textContent = value;
      return row;
    }));
  }

  let statsPausedGame = false;
  $('stats-button').addEventListener('click', () => {
    if (!game) return;
    renderStats($('stats-list'), game);
    $('stats-title').textContent = `Day ${levelIndex + 1} so far`;
    statsPausedGame = !paused;
    show('stats');
  });
  $('stats-close').addEventListener('click', () => {
    hideOverlays();
    statsPausedGame = false;
  });

  // ---- Upgrades ---------------------------------------------------------------------
  function buildUpgrades() {
    const spare = starsAvailable();
    $('upgrade-stars').textContent = `★ ${spare} to spend`;
    const list = $('upgrade-list');
    list.replaceChildren();
    for (const upgrade of Y.UPGRADES) {
      const owned = ownedUpgrades.includes(upgrade.id);
      const card = document.createElement('div');
      card.className = `upgrade${owned ? ' owned' : ''}`;
      card.innerHTML = '<span class="ui"></span><span class="ut"><b></b><small></small></span><button type="button" class="buy"></button>';
      card.querySelector('.ui').textContent = upgrade.icon;
      card.querySelector('b').textContent = upgrade.name;
      card.querySelector('small').textContent = upgrade.text;
      const button = card.querySelector('.buy');
      if (owned) {
        button.textContent = '✓ Owned';
        button.disabled = true;
      } else {
        button.textContent = `★ ${upgrade.cost}`;
        button.disabled = upgrade.cost > spare;
        button.addEventListener('click', () => {
          if (upgrade.cost > starsAvailable()) return;
          ownedUpgrades = [...ownedUpgrades, upgrade.id];
          saveUpgrades(ownedUpgrades);
          Y.sound.cheer(2);
          buildUpgrades();
        });
      }
      list.appendChild(card);
    }
  }
  $('upgrades-button').addEventListener('click', () => {
    Y.sound.unlock();
    buildUpgrades();
    show('upgrades');
  });
  $('upgrades-close').addEventListener('click', () => {
    buildMenu();
    show('menu');
  });

  // ---- Day-1 tutorial ----------------------------------------------------------------
  // A few friendly steps for the first day. A step moves on when its condition is met, or when its button is pressed.
  const tutorial = { active: false, step: 0, usedHint: false };
  const TUTORIAL_STEPS = [
    {
      title: 'Welcome to Sibsey Station!',
      text: "I'm Pip, the little shunting engine. Your job is to build the trains on the timetable and send them off on time. A train from Hillbury is coming in on Platform 1 from the main line on the right.",
      button: 'Show me!',
      hold: true
    },
    {
      title: 'Here it comes!',
      text: 'Trains always come in with the engine at the front, and the platform has to be empty or they wait at the red signal. Wait while the passengers get off.',
      done: g => g.arrivals.some(a => a.status === 'arrived')
    },
    {
      title: 'Move the whole train',
      text: "The passengers are off, and the engine is tired. Click the last vehicle (the guard's van on the right) to pick up the whole train, then click a siding.",
      highlight: (g, sel) => (sel ? { tracks: ['S1', 'S2'] } : { vehicles: [{ track: 'P1', idx: g.byId.get('P1').cars.length - 1 }] }),
      done: g => ['S1', 'S2'].some(id => g.byId.get(id).cars.length > 0 || (g.job && g.job.to === id))
    },
    {
      title: 'The engine goes to the shed',
      text: 'In the siding the tired engine uncouples and drives itself to the engine shed to be serviced (🔧). It will be ready to pull a train again in a few minutes.',
      button: 'Next'
    },
    {
      title: 'Read the timetable',
      text: "The Timetable on the right shows each train and the vehicles it needs: an engine at the front (the right-hand end), coaches in the right order, and the guard's van at the back.",
      button: 'Next',
      board: true,
      hold: true
    },
    {
      title: 'Build your train',
      text: 'Pip takes the vehicle you click and everything between it and the yard entrance on the left. Click vehicles and tracks to build the Seaside Express on Platform 1. Stuck? Press 💡 for a hint!',
      button: 'Next',
      hold: true
    },
    {
      title: 'Leave on time!',
      text: 'Once the train is built right, passengers board by themselves and it leaves at its time. Leaving on time earns ★★★. Good luck, driver!',
      button: 'Start playing',
      hold: true
    }
  ];

  const tutorialStep = () => (tutorial.active ? TUTORIAL_STEPS[tutorial.step] : null);
  const tutorialHolds = () => Boolean(tutorialStep() && tutorialStep().hold);

  function showTutorialStep() {
    const step = tutorialStep();
    const box = $('tutorial');
    box.classList.toggle('hidden', !step);
    document.querySelector('.board').classList.toggle('tut-pulse', Boolean(step && step.board));
    if (!step) return;
    $('tut-title').textContent = step.title;
    $('tut-text').textContent = step.text;
    $('tut-step').textContent = `${tutorial.step + 1} / ${TUTORIAL_STEPS.length}`;
    $('tut-next').hidden = !step.button;
    $('tut-next').textContent = step.button || '';
  }

  function advanceTutorial() {
    if (!tutorial.active) return;
    tutorial.step++;
    if (tutorial.step >= TUTORIAL_STEPS.length) endTutorial();
    else showTutorialStep();
  }

  function endTutorial() {
    tutorial.active = false;
    setTutorialDone();
    showTutorialStep();
  }

  function startTutorial(on) {
    tutorial.active = on;
    tutorial.step = 0;
    tutorial.usedHint = false;
    showTutorialStep();
  }

  function updateTutorial() {
    const step = tutorialStep();
    if (step && step.done && game && step.done(game)) advanceTutorial();
  }

  function tutorialHighlight() {
    const step = tutorialStep();
    return step && step.highlight && !game.finished ? step.highlight(game, selected) : null;
  }

  $('tut-next').addEventListener('click', advanceTutorial);
  $('tut-skip').addEventListener('click', endTutorial);
  $('replay-tutorial').addEventListener('click', () => {
    forceTutorial = true;
    startLevel(0);
  });

  Y.debug = () => ({ game, paused, speed });

  // Start on the menu, with a quiet yard behind it.
  $('version').textContent = `v${Y.VERSION}`;
  game = Y.createGame(Y.LEVELS[0]);
  renderer = Y.createRenderer(canvas, game);
  buildBoard();
  fit();
  buildMenu();
  show('menu');
  requestAnimationFrame(frame);
})();
