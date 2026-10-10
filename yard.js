(() => {
  'use strict';

  const Y = (window.Yard = window.Yard || {});

  // ---- Layout constants (logical canvas units) -------------------------------
  const W = 1100;
  const H = 720;
  const SP = 56; // length of one vehicle slot, including the gap
  const L0 = { x: 250, y: 690 }; // where the lead meets the ladder
  const SPINE_K = 0.3; // the ladder leans right by this much per unit of height
  const HOME_U = -150; // where the shunting engine waits, along the lead

  // ---- Timing -----------------------------------------------------------------
  const SECONDS_PER_MINUTE = 8; // real seconds per game minute at 1x
  const PILOT_SPEED = 430; // units per second
  const BOARD_SECONDS = 4; // real seconds to board / load at 1x
  const SERVICE_MINUTES = 5; // game minutes an arrived engine needs in the shed before it can be used again
  const UNLOAD_SECONDS = 9; // real seconds for passengers to get off an arriving train at 1x
  const CANCEL_AFTER = 6; // minutes late before a train is cancelled
  const STAR_LIMITS = [0.4, 2, 5]; // minutes late for 3, 2 and 1 star

  const TRACK_DEFS = [
    { id: 'P1', name: 'Platform 1', y: 150, xEnd: 1030, through: true, kind: 'platform' },
    { id: 'P2', name: 'Platform 2', y: 236, xEnd: 1030, through: true, kind: 'platform' },
    { id: 'G', name: 'Goods road', y: 318, xEnd: 1030, through: true, kind: 'goods' },
    { id: 'S1', name: 'Siding 1', y: 384, xEnd: 960, through: false, kind: 'siding' },
    { id: 'S2', name: 'Siding 2', y: 448, xEnd: 960, through: false, kind: 'siding' },
    { id: 'S3', name: 'Siding 3', y: 512, xEnd: 960, through: false, kind: 'siding' },
    { id: 'S4', name: 'Siding 4', y: 576, xEnd: 960, through: false, kind: 'siding' },
    { id: 'S5', name: 'Siding 5', y: 640, xEnd: 960, through: false, kind: 'siding' },
    // The engine shed branches off the spine to the LEFT, above the signal box, and runs leftwards.
    { id: 'SHED', name: 'Engine shed', y: 590, xEnd: 26, through: false, kind: 'shed', side: 'left' }
  ];

  const spinePoint = y => ({ x: L0.x + (L0.y - y) * SPINE_K, y });

  // A track is a sampled path measured by distance `u` from L0. Before the first sample the
  // lead runs straight left; after the last point the track runs straight right. Every track
  // shares the same lead and spine, then peels off with its own smooth curve, so tracks
  // diverge like points and never cross.
  const SPINE_DIR = (() => {
    const len = Math.hypot(SPINE_K, 1);
    return { x: SPINE_K / len, y: -1 / len };
  })();
  const CORNER = 22; // size of the shared bend where the lead turns onto the spine

  function cubic(a, b, c, d, t) {
    const m = 1 - t;
    const w = [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t];
    return { x: w[0] * a.x + w[1] * b.x + w[2] * c.x + w[3] * d.x, y: w[0] * a.y + w[1] * b.y + w[2] * c.y + w[3] * d.y };
  }

  function buildTrack(def) {
    const pts = [];
    const add = (x, y) => {
      const last = pts[pts.length - 1];
      pts.push({ x, y, u: last ? last.u + Math.hypot(x - last.x, y - last.y) : -CORNER });
    };
    const bendY = L0.y - def.y;
    const left = def.side === 'left';
    let uBranch;
    let p2;
    {
      // Shared corner: lead turns onto the spine.
      const cornerEnd = { x: L0.x + SPINE_DIR.x * CORNER, y: L0.y + SPINE_DIR.y * CORNER };
      add(L0.x - CORNER, L0.y);
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const m = 1 - t;
        add(m * m * (L0.x - CORNER) + 2 * m * t * L0.x + t * t * cornerEnd.x, m * m * L0.y + 2 * m * t * L0.y + t * t * cornerEnd.y);
      }
      const bend = left ? 56 : Math.min(60, bendY - CORNER - 4);
      const p0 = spinePoint(def.y + bend);
      const p1 = spinePoint(def.y);
      p2 = left ? { x: p1.x - 62, y: def.y } : { x: p1.x + bend * 1.4 + 20, y: def.y };
      add(p0.x, p0.y);
      uBranch = pts[pts.length - 1].u;
      const c1 = { x: p0.x + SPINE_DIR.x * 40, y: p0.y + SPINE_DIR.y * 40 };
      const c2 = { x: p2.x + (left ? 45 : -45), y: p2.y };
      for (let i = 1; i <= 30; i++) {
        const p = cubic(p0, c1, c2, p2, i / 30);
        add(p.x, p.y);
      }
    }
    const uStraight = pts[pts.length - 1].u;
    add(left ? -500 : W + 500, def.y);
    const length = Math.abs(def.xEnd - p2.x);
    return {
      ...def,
      pts,
      uBranch,
      uStraight,
      straightX: p2.x,
      // Left and right ends of the straight part of the road, whichever way it runs.
      xMin: Math.min(p2.x, def.xEnd),
      xMax: Math.max(p2.x, def.xEnd),
      uEnd: uStraight + length,
      cap: Math.floor((length - 8) / SP),
      cars: [],
      locked: false
    };
  }

  function pointAt(track, u) {
    const pts = track.pts;
    if (u <= pts[0].u) return { x: pts[0].x + (u - pts[0].u), y: pts[0].y, a: 0 };
    let i = 0;
    while (i < pts.length - 2 && pts[i + 1].u < u) i++;
    const p = pts[i];
    const q = pts[i + 1];
    const t = (u - p.u) / (q.u - p.u);
    return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, a: Math.atan2(q.y - p.y, q.x - p.x) };
  }

  // Centre of the vehicle at index `idx` when the track holds `n` vehicles.
  const slotU = (track, idx, n) => track.uEnd - SP / 2 - (n - 1 - idx) * SP;

  const ease = p => 0.5 - 0.5 * Math.cos(Math.PI * p);
  const isLoco = type => Y.TYPES[type].kind === 'loco';
  const isPassenger = type => Y.TYPES[type].kind === 'coach';

  function createGame(level) {
    const tracks = TRACK_DEFS.map(buildTrack);
    const byId = new Map(tracks.map(track => [track.id, track]));
    for (const track of tracks) track.locked = !level.tracks.includes(track.id);

    let nextId = 1;
    const makeVehicle = type => ({ id: nextId++, type });

    for (const type of level.shed) byId.get('SHED').cars.push(makeVehicle(type));
    for (const [id, list] of Object.entries(level.initial)) {
      for (const type of list) byId.get(id).cars.push(makeVehicle(type));
    }

    const departures = level.departures
      .map((d, i) => ({ ...d, id: i + 1, status: 'waiting', progress: 0, stars: 0, lateBy: 0 }))
      .sort((a, b) => a.at - b.at);
    const arrivals = level.arrivals
      .map((a, i) => ({ ...a, id: i + 1, track: a.track || 'S5', status: 'coming' }))
      .sort((a, b) => a.at - b.at);

    const unloadings = []; // trains standing while their passengers get off
    let undoState = null;

    const G = {
      level,
      unloadings,
      SERVICE_MINUTES,
      W,
      H,
      SP,
      L0,
      tracks,
      byId,
      departures,
      arrivals,
      minute: level.start,
      job: null,
      leaving: [],
      events: [],
      finished: false,
      stars: 0,
      maxStars: departures.length * 3,
      pointAt,
      slotU,
      isPassenger,
      isLoco
    };

    const emit = (type, data = {}) => G.events.push({ type, ...data });

    // ---- Formations -----------------------------------------------------------
    function formationMatches(dep, track) {
      const cars = track.cars;
      if (cars.length !== dep.spec.length) return false;
      return dep.spec.every((token, i) => {
        const car = cars[cars.length - 1 - i];
        return token === 'loco' ? isLoco(car.type) : car.type === token;
      });
    }
    G.formationMatches = formationMatches;

    // A short, friendly note on what a half-built train still needs ('' if the track is empty).
    function formationHint(dep, track) {
      const front = [...track.cars].reverse();
      if (!front.length) return '';
      const name = token => (token === 'loco' ? 'engine' : Y.TYPES[token].name.toLowerCase());
      const fits = (i) => (dep.spec[i] === 'loco' ? isLoco(front[i].type) : front[i].type === dep.spec[i]);
      for (let i = 0; i < Math.min(front.length, dep.spec.length); i++) {
        if (!fits(i)) {
          const article = /^[aeiou]/.test(name(dep.spec[i])) ? 'an' : 'a';
          return i === 0
            ? `Needs an engine at the front`
            : `Vehicle ${i + 1} from the front should be ${article} ${name(dep.spec[i])}`;
        }
      }
      if (front.length > dep.spec.length) {
        const extra = front.length - dep.spec.length;
        return `${extra} vehicle${extra > 1 ? 's' : ''} too many at the back`;
      }
      if (front.length < dep.spec.length) {
        const next = name(dep.spec[front.length]);
        return `Next add ${/^[aeiou]/.test(next) ? 'an' : 'a'} ${next} at the back`;
      }
      return 'Perfect!';
    }
    G.formationHint = formationHint;

    const activeDeparture = trackId =>
      departures.find(d => d.track === trackId && (d.status === 'waiting' || d.status === 'boarding' || d.status === 'ready'));
    G.activeDeparture = activeDeparture;

    // ---- Jobs: one mover (the shunting engine, or an engine / train under its own power)
    function startJob(job) {
      job.i = -1;
      job.cut = job.cut || [];
      G.job = job;
      nextStep();
    }

    function nextStep() {
      const job = G.job;
      if (job.steps[job.i] && job.steps[job.i].onEnd) job.steps[job.i].onEnd(job);
      job.i++;
      const step = job.steps[job.i];
      if (!step) {
        G.job = null;
        if (job.onDone) job.onDone(job);
        return;
      }
      step.t = 0;
      if (step.go) {
        job.track = step.go;
        step.from = job.pilotU;
        step.dur = Math.max(0.35, Math.abs(step.to - step.from) / PILOT_SPEED);
      }
      if (step.onStart) step.onStart(job);
    }

    function stepJob(dt) {
      const job = G.job;
      const step = job.steps[job.i];
      step.t += dt;
      if (step.go) {
        const p = Math.min(1, step.t / step.dur);
        job.pilotU = step.from + (step.to - step.from) * ease(p);
        job.dir = Math.sign(step.to - step.from) || job.dir || 1;
        if (p >= 1) nextStep();
      } else if (step.t >= step.wait) {
        nextStep();
      }
    }

    function detach(job) {
      const from = byId.get(job.from);
      job.cut = from.cars.splice(0, job.k);
    }

    function attach(job) {
      const to = byId.get(job.to);
      // An engine that has just arrived stays 'arrived' (and will head for the shed) until it is moved on.
      if (job.kind !== 'arrival') for (const v of job.cut) v.arrived = false;
      to.cars.unshift(...job.cut);
      job.cut = [];
    }

    function planMove(fromId, toId, k) {
      const from = byId.get(fromId);
      const to = byId.get(toId);
      const uCouple = slotU(from, 0, from.cars.length) - SP;
      const uOut = Math.min(Math.min(from.uBranch, to.uBranch) - 40 - k * SP, uCouple - 10);
      const uFinal = to.uEnd - SP / 2 - (to.cars.length + k) * SP;
      return { from, to, uCouple, uOut, uFinal };
    }

    // Where the shunting engine is when it is not mid-job: 'track' is null while it
    // waits at the signal box, otherwise it is parked coupled to the vehicles it just moved.
    const pilot = { track: null, u: HOME_U, flip: false };
    G.pilot = pilot;

    // Pip starts the day parked in the engine shed road.
    const startShed = byId.get('SHED');
    if (!startShed.locked) {
      pilot.track = 'SHED';
      pilot.u = slotU(startShed, 0, startShed.cars.length) - SP;
    }

    function startPlayerMove(fromId, toId, k) {
      const from = byId.get(fromId);
      const { uCouple, uOut, uFinal } = planMove(fromId, toId, k);
      const alreadyCoupled = pilot.track === fromId && Math.abs(pilot.u - uCouple) < 1.5;
      const steps = [];
      if (alreadyCoupled) {
        steps.push({ wait: 0.2, onEnd: detach });
      } else {
        if (pilot.track !== null && pilot.track !== fromId) {
          // Back out of the track Pip is parked on before heading for the next one.
          const parked = byId.get(pilot.track);
          const uClear = Math.min(parked.uBranch, from.uBranch) - 40;
          if (pilot.u > uClear) steps.push({ go: parked.id, to: uClear });
        }
        steps.push({ go: fromId, to: uCouple });
        steps.push({ wait: 0.45, onStart: () => emit('couple', { track: fromId }), onEnd: detach });
      }
      steps.push({ go: fromId, to: uOut });
      steps.push({
        go: toId,
        to: uFinal,
        onEnd: job => {
          attach(job);
          emit('uncouple', { track: toId });
        }
      });
      startJob({
        kind: 'shunt',
        from: fromId,
        to: toId,
        k,
        pilotU: pilot.track === null ? HOME_U : pilot.u,
        track: pilot.track === null ? fromId : pilot.track,
        dir: 1,
        steps,
        onDone: () => {
          // Pip stays hooked on to the vehicles it just placed.
          pilot.track = toId;
          pilot.u = uFinal;
          pilot.flip = false;
        }
      });
    }

    function startHome(then) {
      startJob({
        kind: 'home',
        from: null,
        to: pilot.track,
        k: 0,
        pilotU: pilot.u,
        track: pilot.track,
        dir: -1,
        steps: [{ go: pilot.track, to: HOME_U }],
        onDone: () => {
          pilot.track = null;
          pilot.u = HOME_U;
          pilot.flip = false;
          if (then) then();
        }
      });
    }

    // Pip must never be left on a road a train is arriving on, or on the lead by the signal box, when a
    // train is due: it parks on the engine shed road (or another open road) and stays out of the way.
    const PARK_ORDER = ['SHED', 'S1', 'S2', 'S3', 'S4', 'S5', 'G', 'P2', 'P1'];
    function parkingRoad(exclude) {
      const open = id => {
        const t = byId.get(id);
        return t && !t.locked && t.id !== exclude && t.cars.length < t.cap && !isUnloading(t.id);
      };
      const id = PARK_ORDER.find(open);
      return id ? byId.get(id) : null;
    }

    function startPark(dest) {
      const from = pilot.track === null ? null : byId.get(pilot.track);
      const uStop = slotU(dest, 0, dest.cars.length) - SP;
      const steps = [];
      if (from && from !== dest) steps.push({ go: from.id, to: Math.min(from.uBranch, dest.uBranch) - 40 });
      steps.push({ go: dest.id, to: uStop });
      startJob({
        kind: 'home',
        from: null,
        to: dest.id,
        k: 0,
        pilotU: pilot.track === null ? HOME_U : pilot.u,
        track: from ? from.id : dest.id,
        dir: pilot.track === null ? 1 : -1,
        steps,
        onDone: () => {
          pilot.track = dest.id;
          pilot.u = uStop;
          pilot.flip = false;
        }
      });
    }

    // Pip that has been idle at the signal box for a while parks in the engine shed road (if there is room).
    const IDLE_SECONDS = 5;
    let idle = 0;

    G.sendHome = () => {
      if (G.busy() || G.finished || pilot.track === null) return false;
      startHome();
      return true;
    };

    // An engine runs itself to the shed.
    function startEngineRun(fromId, toId, k = 1) {
      const { uCouple, uOut, uFinal } = planMove(fromId, toId, k);
      startJob({
        kind: 'engine',
        from: fromId,
        to: toId,
        k,
        hidePilot: true,
        pilotU: uCouple,
        track: fromId,
        dir: -1,
        steps: [
          { go: fromId, to: uOut, onStart: detach },
          { go: toId, to: uFinal, onEnd: job => { for (const v of job.cut) v.arrived = false; attach(job); if (toId === 'SHED') emit('servicing'); } }
        ]
      });
    }

    function startArrival(arrival) {
      const rec = byId.get(arrival.track);
      // The engine leads, pulling the train in: it ends up at the far end of the road.
      const loco = makeVehicle(arrival.loco);
      loco.arrived = true;
      loco.service = SERVICE_MINUTES; // worn out from the run: needs servicing in the shed
      const cut = [...arrival.cars.map(makeVehicle), loco];
      const k = cut.length;
      const uFinal = rec.uEnd - SP / 2 - (rec.cars.length + k) * SP;
      arrival.status = 'arriving';
      undoState = null;
      startJob({
        kind: 'arrival',
        from: null,
        to: rec.id,
        k,
        hidePilot: true,
        cut,
        pilotU: -(L0.x + 80 + k * SP),
        track: rec.id,
        dir: 1,
        steps: [{ go: rec.id, to: uFinal, onEnd: attach }],
        onDone: () => {
          // Give the passengers a little time to get off before the train can be moved.
          arrival.status = 'unloading';
          unloadings.push({ arrival, track: rec.id, t: 0, progress: 0 });
          emit('unloading', { arrival });
        }
      });
      emit('arriving', { arrival });
    }

    function isUnloading(trackId) {
      return unloadings.some(u => u.track === trackId);
    }
    G.isUnloading = isUnloading;

    function updateUnloading(dt) {
      for (let i = unloadings.length - 1; i >= 0; i--) {
        const u = unloadings[i];
        u.t += dt;
        u.progress = Math.min(1, u.t / UNLOAD_SECONDS);
        if (u.progress >= 1) {
          unloadings.splice(i, 1);
          u.arrival.status = 'arrived';
          emit('arrived', { arrival: u.arrival, track: u.track });
        }
      }
    }

    // ---- Public queries ---------------------------------------------------------
    G.busy = () => !!G.job || readyLoco() !== null || arrivalReady() !== null;

    // Signal for trains coming in: 'green' while one is entering or may enter, 'amber' when one is
    // due soon and the road is clear, otherwise 'red'.
    G.entrySignal = trackId => {
      const track = byId.get(trackId);
      if (G.job && G.job.kind === 'arrival' && G.job.to === trackId) return 'green';
      const nextAny = arrivals.find(a => a.status === 'coming');
      if (!nextAny || nextAny.track !== trackId) return 'red';
      const clear = track.cars.length === 0 && !G.leaving.some(l => l.track === trackId);
      const due = nextAny.at + level.start - G.minute;
      if (!clear) return 'red';
      return due <= 0 ? 'green' : due < 3 ? 'amber' : 'red';
    };

    // An arrived engine that has been uncovered (its coaches are gone) drives itself to the shed.
    function readyLoco() {
      const shed = byId.get('SHED');
      if (shed.locked || shed.cars.length >= shed.cap) return null;
      return tracks.find(t => t.id !== 'SHED' && t.cars.length > 0 && t.cars[0].arrived === true && !isUnloading(t.id)) || null;
    }

    // The next train due in, if the road it needs is clear. Trains arrive in timetable order.
    function arrivalReady() {
      for (const arrival of arrivals) {
        if (arrival.status !== 'coming' || arrival.at + level.start > G.minute) continue;
        const track = byId.get(arrival.track);
        const clear = !track.locked && track.cars.length === 0 && !G.leaving.some(l => l.track === track.id);
        return clear && arrival.cars.length + 1 <= track.cap ? arrival : null;
      }
      return null;
    }

    // A train that is due but held at the signal because its road is not clear.
    G.waitingArrival = () => {
      const due = arrivals.find(a => a.status === 'coming' && a.at + level.start <= G.minute);
      return due && !G.job && arrivalReady() === null ? due : null;
    };

    // An engine that has just arrived must be serviced in the shed before it can work again.
    const needsService = v => isLoco(v.type) && v.service > 0;
    G.needsService = needsService;

    // True if the first k vehicles of a road include an engine that still needs servicing.
    // (In the shed, engines are picked individually, so only the chosen engine counts.)
    G.cutNeedsService = (fromId, k) => {
      const cars = byId.get(fromId).cars;
      return fromId === 'SHED' ? needsService(cars[k - 1]) : cars.slice(0, k).some(needsService);
    };

    G.validTargets = (fromId, k) => {
      const from = byId.get(fromId);
      let cut = from.cars.slice(0, k);
      if (fromId === 'SHED' && from.cars[k - 1] && !needsService(from.cars[k - 1])) {
        cut = [from.cars[k - 1]];
        k = 1;
      }
      const worn = cut.some(needsService);
      return tracks
        .filter(t => !t.locked && t.id !== fromId && !isUnloading(t.id) && t.cars.length + k <= t.cap)
        // Worn engines may only go to the shed (and only by themselves).
        .filter(t => !worn || (t.id === 'SHED' && cut.every(v => isLoco(v.type))))
        .map(t => t.id);
    };

    G.startMove = (fromId, idx, toId) => {
      if (G.busy() || G.finished) return false;
      const from = byId.get(fromId);
      let k = idx + 1;
      if (!from || from.locked || isUnloading(fromId) || idx < 0 || idx >= from.cars.length) return false;
      if (!G.validTargets(fromId, k).includes(toId)) return false;
      snapshot();
      if (fromId === 'SHED' && !needsService(from.cars[idx])) {
        // Engines in the shed can shuffle past each other: only the chosen engine goes.
        from.cars.unshift(...from.cars.splice(idx, 1));
        k = 1;
      }
      // Engines have their own power, so they don't need Pip to shunt them.
      if (from.cars.slice(0, k).every(v => isLoco(v.type))) {
        if (pilot.track === fromId || pilot.track === toId) {
          // Pip is in the way: send it home first, then the engine goes.
          startHome(() => startEngineRun(fromId, toId, k));
        } else {
          startEngineRun(fromId, toId, k);
        }
        return true;
      }
      startPlayerMove(fromId, toId, k);
      return true;
    };

    // ---- Undo ----------------------------------------------------------------------
    // The last move you made can be taken back until something else happens in the yard
    // (a train arrives or departs, or an engine drives off on its own).
    function snapshot() {
      undoState = { cars: new Map(tracks.map(t => [t.id, t.cars.slice()])), pilot: { ...pilot } };
    }

    G.canUndo = () => undoState !== null && !G.busy() && !G.finished;

    G.undo = () => {
      if (!G.canUndo()) return false;
      for (const t of tracks) t.cars.splice(0, t.cars.length, ...undoState.cars.get(t.id));
      Object.assign(pilot, undoState.pilot);
      undoState = null;
      emit('undo');
      return true;
    };

    // ---- Hints ---------------------------------------------------------------------
    // Suggests one sensible next move: { text, track, idx, to } (track/idx/to are absent for advice only).
    G.hint = () => {
      if (G.finished) return null;
      const name = type => (type === 'loco' ? 'an engine' : `a ${Y.TYPES[type].name.toLowerCase()}`);
      const dump = (k, ...exclude) => {
        const ok = id => {
          const t = byId.get(id);
          return t && !t.locked && !exclude.includes(id) && !isUnloading(id) && !activeDeparture(id) && t.cars.length + k <= t.cap;
        };
        const id = ['S1', 'S2', 'S3', 'S4', 'S5', 'G', 'P2', 'P1'].find(ok);
        return id ? byId.get(id) : null;
      };
      const moveOut = (track, k, why) => {
        const to = dump(k, track.id);
        if (!to) return { text: `${why} There is no room to move it, so free up a siding first.` };
        const what = k === 1 ? `the ${Y.TYPES[track.cars[0].type].name.toLowerCase()}` : `the first ${k} vehicles`;
        return { text: `${why} Move ${what} from ${track.name} to ${to.name}.`, track: track.id, idx: k - 1, to: to.id };
      };

      // 1. A train that has arrived and been unloaded should be moved out of the way.
      for (const t of tracks) {
        const n = t.cars.length;
        if (n > 1 && t.cars[n - 1].arrived && !isUnloading(t.id) && !t.locked) {
          return moveOut(t, n - 1, 'This train has arrived and is unloaded.');
        }
      }
      // 2. Work on the next train to leave.
      const dep = departures
        .filter(d => (d.status === 'waiting' || d.status === 'boarding') && activeDeparture(d.track) === d)
        .sort((a, b) => a.at - b.at)[0];
      if (!dep) {
        const ready = departures.find(d => d.status === 'ready');
        return ready ? { text: `${ready.name} is ready and leaves at its time. Keep platforms free for arriving trains.` } : null;
      }
      const track = byId.get(dep.track);
      if (isUnloading(track.id)) return { text: `Passengers are still getting off at ${track.name}. One moment!` };
      const front = [...track.cars].reverse();
      const fits = i => (dep.spec[i] === 'loco' ? isLoco(front[i].type) : front[i].type === dep.spec[i]);
      for (let i = 0; i < Math.min(front.length, dep.spec.length); i++) {
        if (!fits(i)) return moveOut(track, front.length - i, `Vehicle ${i + 1} on ${track.name} is wrong.`);
      }
      if (front.length > dep.spec.length) {
        return moveOut(track, front.length - dep.spec.length, `${track.name} has too many vehicles.`);
      }
      if (front.length === dep.spec.length) return { text: `${dep.name} is built correctly. It leaves at its time.` };
      const need = dep.spec[front.length];
      let best = null;
      for (const t of tracks) {
        if (t.id === track.id || t.locked || isUnloading(t.id)) continue;
        t.cars.forEach((v, idx) => {
          const match = need === 'loco' ? isLoco(v.type) : v.type === need;
          const worn = t.id === 'SHED' ? needsService(v) : t.cars.slice(0, idx + 1).some(needsService);
          if (!match || worn) return;
          const carry = t.id === 'SHED' ? 0 : idx;
          const score = carry * 10 + (t.id === 'SHED' ? 0 : 1);
          if (!best || score < best.score) best = { t, idx, carry, score };
        });
      }
      if (!best) {
        const servicing = need === 'loco' && tracks.some(t => t.cars.some(needsService));
        return { text: servicing ? `${dep.name} needs an engine, but they are all being serviced in the shed. Wait a moment.` : `${dep.name} needs ${name(need)}, but there isn't one in the yard yet. Wait for the next train.` };
      }
      if (best.carry > 0) {
        const t = best.t;
        const k = best.carry;
        const to = dump(k, t.id, track.id);
        if (!to) return { text: 'Free up some space on a siding first.' };
        return {
          text: `${dep.name} needs ${name(need)} from ${t.name}, but ${k === 1 ? 'a vehicle is' : `${k} vehicles are`} in front of it. Move ${k === 1 ? 'it' : 'them'} to ${to.name} first.`,
          track: t.id,
          idx: k - 1,
          to: to.id
        };
      }
      return {
        text: `${dep.name} needs ${name(need)} next. Move it from ${best.t.name} to ${track.name}.`,
        track: best.t.id,
        idx: best.idx,
        to: track.id
      };
    };

    // ---- Poses for drawing -------------------------------------------------------
    G.pilotPose = () => {
      const job = G.job;
      if (!job || job.hidePilot) {
        const p = pointAt(byId.get(pilot.track || 'SHED'), pilot.u);
        return { ...p, flip: pilot.flip, moving: false, work: false, parked: pilot.track !== null };
      }
      const p = pointAt(byId.get(job.track), job.pilotU);
      const step = job.steps[job.i];
      return { ...p, flip: job.dir < 0, moving: !!step.go, work: true };
    };

    G.vehiclePoses = () => {
      const out = [];
      for (const track of tracks) {
        const n = track.cars.length;
        track.cars.forEach((v, idx) => {
          out.push({ v, track: track.id, idx, ...pointAt(track, slotU(track, idx, n)) });
        });
      }
      const job = G.job;
      if (job && job.cut.length) {
        const track = byId.get(job.track);
        job.cut.forEach((v, i) => {
          out.push({ v, cut: true, ...pointAt(track, job.pilotU + (i + 1) * SP) });
        });
      }
      for (const train of G.leaving) {
        const track = byId.get(train.track);
        train.cars.forEach((v, i) => {
          out.push({ v, leaving: true, ...pointAt(track, train.base + (i + 1) * SP) });
        });
      }
      return out;
    };

    // ---- Departures -------------------------------------------------------------
    function busyTracks() {
      const set = new Set();
      // Pip going home leaves the vehicles alone, so passengers stay aboard.
      if (G.job && G.job.kind !== 'home') {
        if (G.job.from) set.add(G.job.from);
        set.add(G.job.to);
      }
      return set;
    }

    function updateDepartures(dt) {
      const busy = busyTracks();
      for (const dep of departures) {
        if (dep.status === 'done' || dep.status === 'cancelled') continue;
        if (activeDeparture(dep.track) !== dep) continue;
        const track = byId.get(dep.track);
        const due = level.start + dep.at;
        const ok = !busy.has(dep.track) && formationMatches(dep, track);

        if (ok) {
          // A correct train doesn't need Pip any more: it uncouples and heads home straight away.
          if (!G.job && pilot.track === dep.track) startHome();
          if (dep.status === 'waiting') {
            dep.status = 'boarding';
            emit('boarding', { dep });
          }
          if (dep.progress < 1) {
            dep.progress = Math.min(1, dep.progress + dt / BOARD_SECONDS);
            if (dep.progress >= 1) {
              dep.status = 'ready';
              emit('ready', { dep });
            }
          }
          if (dep.progress >= 1 && G.minute >= due) depart(dep, track);
        } else if (dep.progress > 0) {
          // Formation broken or being shunted: passengers get off again.
          dep.progress = Math.max(0, dep.progress - (2 * dt) / BOARD_SECONDS);
          dep.status = dep.progress > 0 ? 'boarding' : 'waiting';
        }

        if (dep.status !== 'done' && G.minute > due + CANCEL_AFTER) {
          dep.status = 'cancelled';
          dep.progress = 0;
          emit('cancel', { dep });
        }
      }
    }

    function depart(dep, track) {
      const late = Math.max(0, G.minute - (level.start + dep.at));
      dep.lateBy = late;
      dep.stars = late <= STAR_LIMITS[0] ? 3 : late <= STAR_LIMITS[1] ? 2 : 1;
      dep.status = 'done';
      undoState = null;
      G.stars += dep.stars;
      const cars = track.cars.splice(0);
      G.leaving.push({ track: track.id, cars, base: slotU(track, 0, cars.length) - SP, v: 0, dep });
      emit('depart', { dep, track: track.id });
    }

    function updateLeaving(dt) {
      for (const train of G.leaving) {
        train.v = Math.min(train.v + 170 * dt, 440);
        train.base += train.v * dt;
      }
      G.leaving = G.leaving.filter(train => {
        const p = pointAt(byId.get(train.track), train.base + SP);
        return p.x < W + 90;
      });
    }

    // ---- Main update ------------------------------------------------------------
    G.update = dt => {
      if (G.finished) return;
      G.minute += dt / SECONDS_PER_MINUTE;

      const incoming = arrivalReady();
      const loco = readyLoco();
      if (!G.job && incoming && (pilot.track === null || pilot.track === incoming.track)) {
        // A train is arriving: Pip gets out of the way and parks on another road.
        const parking = parkingRoad(incoming.track);
        if (parking) startPark(parking);
      } else if (!G.job && loco && (pilot.track === loco.id || pilot.track === 'SHED')) {
        // The engine is about to run into the shed, so Pip heads home.
        startHome();
      }
      if (!G.job) {
        if (loco) {
          undoState = null;
          startEngineRun(loco.id, 'SHED');
        } else if (incoming) startArrival(incoming);
      }
      const held = G.waitingArrival();
      if (held && !held.held) {
        held.held = true;
        emit('held', { arrival: held });
      }
      const shedOpen = !byId.get('SHED').locked && byId.get('SHED').cars.length < byId.get('SHED').cap;
      if (G.job || pilot.track !== null) idle = 0;
      else if (shedOpen && !readyLoco() && !arrivalReady()) {
        idle += dt;
        if (idle >= IDLE_SECONDS) {
          idle = 0;
          const dest = parkingRoad();
          if (dest && dest.id === 'SHED') startPark(dest);
        }
      }
      if (G.job) stepJob(dt);
      updateUnloading(dt);
      // Engines in the shed are serviced, one clock minute at a time.
      for (const v of byId.get('SHED').cars) {
        if (!needsService(v)) continue;
        v.service -= dt / SECONDS_PER_MINUTE;
        if (v.service <= 0) {
          v.service = 0;
          emit('serviced', { vehicle: v });
        }
      }

      updateDepartures(dt);
      updateLeaving(dt);

      if (departures.every(d => d.status === 'done' || d.status === 'cancelled') && G.leaving.length === 0) {
        G.finished = true;
        emit('finish', { stars: G.stars, max: G.maxStars });
      }
    };

    return G;
  }

  Y.W = W;
  Y.H = H;
  Y.SP = SP;
  Y.SECONDS_PER_MINUTE = SECONDS_PER_MINUTE;
  Y.createGame = createGame;
  Y.isLoco = isLoco;
  Y.isPassenger = isPassenger;
})();
