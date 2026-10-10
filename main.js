(() => {
  'use strict';

  const Y = window.Yard;
  const $ = id => document.getElementById(id);

  const canvas = $('yard');
  const wrap = $('canvas-wrap');
  const hint = $('hint');
  const toasts = $('toasts');
  const depBoard = $('departures');
  const arrBoard = $('arrivals');
  const STORE_KEY = 'pebblebrook-yard-stars';

  let levelIndex = 0;
  let game = null;
  let renderer = null;
  let paused = false;
  let speed = 1;
  let selected = null; // { track, idx }
  let hoverTrack = null;
  let hoverCar = null;
  let hoverPilot = false;
  let last = performance.now();
  let panelTimer = 0;
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

  const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

  function show(id) {
    for (const overlay of ['menu', 'help', 'results']) $(overlay).classList.toggle('hidden', overlay !== id);
  }

  function hideOverlays() {
    for (const overlay of ['menu', 'help', 'results']) $(overlay).classList.add('hidden');
  }

  // ---- Menu -----------------------------------------------------------------------
  function buildMenu() {
    const stars = loadStars();
    const list = $('levels');
    list.replaceChildren();
    for (const [i, level] of Y.LEVELS.entries()) {
      const max = level.departures.length * 3;
      const got = stars[level.id] || 0;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'level-card';
      card.innerHTML = '<span class="num"></span><span class="txt"><b></b><small></small></span><span class="earned"></span>';
      card.querySelector('.num').textContent = i + 1;
      card.querySelector('b').textContent = level.title;
      card.querySelector('small').textContent = level.blurb;
      card.querySelector('.earned').innerHTML = got ? `★ ${got}<i> / ${max}</i>` : `<i>0 / ${max}</i>`;
      card.addEventListener('click', () => {
        Y.sound.unlock();
        startLevel(i);
      });
      list.appendChild(card);
    }
  }

  // ---- Game setup -----------------------------------------------------------------
  function startLevel(index) {
    levelIndex = index;
    clearTimeout(finishTimer);
    Y.sound.startMusic();
    game = Y.createGame(Y.LEVELS[index]);
    if (!renderer) renderer = Y.createRenderer(canvas, game);
    else renderer.setGame(game);
    selected = null;
    paused = false;
    $('pause').textContent = 'Ⅱ';
    $('level-name').textContent = `Day ${index + 1}: ${game.level.title}`;
    $('star-max').textContent = game.maxStars;
    buildBoard();
    fit();
    hideOverlays();
    toasts.replaceChildren();
    last = performance.now();
  }

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
    depBoard.replaceChildren();
    for (const dep of game.departures) {
      const card = document.createElement('div');
      card.className = 'card dep';
      card.dataset.id = dep.id;
      const track = game.byId.get(dep.track);
      card.innerHTML = '<div class="top"><span class="time"></span><span class="name"><b></b><small></small></span><span class="chip"></span></div>';
      card.querySelector('.time').textContent = clock(game.level.start + dep.at);
      card.querySelector('b').textContent = dep.name;
      card.querySelector('small').textContent = `to ${dep.dest} · ${track.name} · any engine`;
      // Icons run left to right like the track does: back of the train first, engine last.
      card.appendChild(consist(dep.spec, true));
      depBoard.appendChild(card);
    }
    arrBoard.replaceChildren();
    for (const arrival of game.arrivals) {
      const card = document.createElement('div');
      card.className = 'card arr';
      card.dataset.id = arrival.id;
      card.innerHTML = '<div class="top"><span class="time"></span><span class="name"><b></b><small></small></span><span class="chip"></span></div>';
      card.querySelector('.time').textContent = clock(game.level.start + arrival.at);
      card.querySelector('b').textContent = `From ${arrival.from}`;
      card.querySelector('small').textContent = `${arrival.cars.length} vehicles`;
      card.appendChild(consist(arrival.cars, false));
      arrBoard.appendChild(card);
    }
    updateBoard();
  }

  function updateBoard() {
    for (const dep of game.departures) {
      const card = depBoard.querySelector(`[data-id="${dep.id}"]`);
      if (!card) continue;
      const left = Math.round(game.level.start + dep.at - game.minute);
      let chip = left > 0 ? `in ${left} min` : left === 0 ? 'now' : `${-left} min late`;
      if (dep.status === 'boarding') chip = 'Boarding…';
      if (dep.status === 'ready') chip = 'Ready ✓';
      if (dep.status === 'done') chip = starText(dep.stars);
      if (dep.status === 'cancelled') chip = 'Missed';
      card.className = `card dep status-${dep.status}${game.activeDeparture(dep.track) === dep ? ' active' : ''}`;
      card.querySelector('.chip').textContent = chip;
    }
    for (const arrival of game.arrivals) {
      const card = arrBoard.querySelector(`[data-id="${arrival.id}"]`);
      if (!card) continue;
      const left = Math.round(game.level.start + arrival.at - game.minute);
      let chip = left > 0 ? `in ${left} min` : 'due';
      if (arrival.status === 'arriving') chip = 'Arriving!';
      if (arrival.status === 'arrived') chip = 'Here ✓';
      card.className = `card arr status-${arrival.status}`;
      card.querySelector('.chip').textContent = chip;
    }
    $('clock').textContent = clock(game.minute);
    $('star-count').textContent = game.stars;
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
      if (pt.y >= track.y - 30 && pt.y <= track.y + 14 && pt.x >= track.straightX - 10 && pt.x <= track.xEnd + 30) return track;
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
      if (selected && selected.track === car.track && selected.idx === car.idx) {
        selected = null;
        Y.sound.drop();
      } else if (selected && selected.track !== car.track && targets().includes(car.track)) {
        // Clicking a vehicle on a valid target track counts as clicking the track.
        dropOn(car.track);
      } else {
        selected = { track: car.track, idx: car.idx };
        Y.sound.pick();
      }
      return;
    }
    if (track && selected) {
      dropOn(track.id);
      return;
    }
    selected = null;
  }

  function dropOn(trackId) {
    if (!targets().includes(trackId)) {
      Y.sound.deny();
      const t = game.byId.get(trackId);
      toast(t.locked ? 'That track is closed today.' : 'Not enough room on that track!', 'bad');
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

  $('pause').addEventListener('click', togglePause);
  for (const button of document.querySelectorAll('.speed button')) {
    button.addEventListener('click', () => {
      speed = Number(button.dataset.speed);
      for (const b of document.querySelectorAll('.speed button')) b.classList.toggle('selected', b === button);
    });
  }
  $('music').addEventListener('click', () => {
    const on = !Y.sound.isMusicOn();
    Y.sound.setMusic(on);
    $('music').classList.toggle('on', on);
    $('music').textContent = on ? '♫' : '✕';
    $('music').setAttribute('aria-label', on ? 'Music on' : 'Music off');
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
        case 'arriving':
          Y.sound.whistle();
          toast(`A train from ${event.arrival.from} is arriving!`);
          break;
        case 'arrived':
          toast('The engine is off to the shed.');
          break;
        case 'boarding':
          Y.sound.ding();
          break;
        case 'ready':
          toast(`${event.dep.name} is ready!`, 'good');
          Y.sound.ding();
          break;
        case 'depart': {
          const track = game.byId.get(event.track);
          Y.sound.whistle();
          Y.sound.cheer(event.dep.stars);
          renderer.burst(track.xEnd - 40, track.y - 30, 'confetti');
          toast(`${event.dep.name} departed! ${starText(event.dep.stars)}`, 'good');
          break;
        }
        case 'cancel':
          Y.sound.sad();
          toast(`${event.dep.name} had to leave without a train.`, 'bad');
          break;
        case 'finish':
          finishTimer = setTimeout(() => showResults(event), 1800);
          break;
        default:
      }
    }
  }

  function showResults(event) {
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
    $('results-text').textContent = `You earned ${event.stars} of ${event.max} stars on Day ${levelIndex + 1}.`;
    $('next').style.display = levelIndex + 1 < Y.LEVELS.length ? '' : 'none';
    show('results');
  }

  // ---- Hint bar ------------------------------------------------------------------
  function updateHint() {
    let text = '';
    if (game.finished) text = '';
    else if (paused) text = 'Paused. Press the play button to carry on.';
    else if (game.busy()) text = 'Pip is working…';
    else if (selected) {
      const n = selected.idx + 1;
      text = `Picked up ${n} ${n === 1 ? 'vehicle' : 'vehicles'}. Now click a green track to put ${n === 1 ? 'it' : 'them'} there.`;
    } else if (game.pilot.track !== null) {
      text = 'Pip is hooked on to the train. Pick another vehicle to keep going, or click Pip to send it home.';
    } else if (game.minute - game.level.start < 3) text = 'Click a vehicle to pick it up. Pip takes it and everything between it and the yard entrance. Engines drive themselves.';
    hint.textContent = text;
  }

  // ---- Main loop -----------------------------------------------------------------
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (game && renderer) {
      const covered = !$('menu').classList.contains('hidden') || !$('help').classList.contains('hidden');
      if (!paused && !covered) {
        let remaining = dt * speed;
        while (remaining > 0) {
          const step = Math.min(remaining, 0.03);
          const wasBusy = !!game.job;
          game.update(step);
          remaining -= step;
          if (!wasBusy && game.job) selected = null;
        }
      }
      handleEvents();
      if (selected) {
        const from = game.byId.get(selected.track);
        if (!from || from.cars.length <= selected.idx) selected = null;
      }
      panelTimer += dt;
      if (panelTimer > 0.25) {
        panelTimer = 0;
        updateBoard();
        updateHint();
      }
      renderer.draw(now, paused ? 0 : dt, {
        selected,
        targets: targets(),
        hoverTrack,
        hoverCar,
        hoverPilot
      });
    }
    requestAnimationFrame(frame);
  }

  Y.debug = () => ({ game, paused, speed });

  // Start on the menu, with a quiet yard behind it.
  game = Y.createGame(Y.LEVELS[0]);
  renderer = Y.createRenderer(canvas, game);
  buildBoard();
  fit();
  buildMenu();
  show('menu');
  requestAnimationFrame(frame);
})();
