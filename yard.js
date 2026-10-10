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
  const CANCEL_AFTER = 6; // minutes late before a train is cancelled
  const STAR_LIMITS = [0.4, 2, 5]; // minutes late for 3, 2 and 1 star

  const TRACK_DEFS = [
    { id: 'P1', name: 'Platform 1', y: 150, xEnd: 1030, through: true, kind: 'platform' },
    { id: 'P2', name: 'Platform 2', y: 236, xEnd: 1030, through: true, kind: 'platform' },
    { id: 'G', name: 'Goods road', y: 318, xEnd: 1030, through: true, kind: 'goods' },
    { id: 'S1', name: 'Siding 1', y: 384, xEnd: 960, through: false, kind: 'siding' },
    { id: 'S2', name: 'Siding 2', y: 448, xEnd: 960, through: false, kind: 'siding' },
    { id: 'S3', name: 'Siding 3', y: 512, xEnd: 960, through: false, kind: 'siding' },
    { id: 'SHED', name: 'Engine shed', y: 576, xEnd: 880, through: false, kind: 'shed' },
    { id: 'R', name: 'Reception', y: 640, xEnd: 960, through: false, kind: 'reception' }
  ];

  const spinePoint = y => ({ x: L0.x + (L0.y - y) * SPINE_K, y });

  // A track is a sampled path measured by distance `u` from L0. Before L0 the
  // lead runs straight left; after the last point the track runs straight right.
  function buildTrack(def) {
    const bend = Math.min(60, L0.y - def.y - 6);
    const p0 = spinePoint(def.y + bend);
    const p1 = spinePoint(def.y);
    const p2 = { x: p1.x + bend * 1.4, y: def.y };
    const pts = [{ x: L0.x, y: L0.y, u: 0 }];
    const add = (x, y) => {
      const last = pts[pts.length - 1];
      pts.push({ x, y, u: last.u + Math.hypot(x - last.x, y - last.y) });
    };
    add(p0.x, p0.y);
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      add(a * p0.x + b * p1.x + c * p2.x, a * p0.y + b * p1.y + c * p2.y);
    }
    add(W + 500, def.y);
    const uBranch = pts[1].u;
    const uStraight = pts[pts.length - 2].u;
    const straightX = p2.x;
    const track = {
      ...def,
      pts,
      uBranch,
      uStraight,
      straightX,
      uEnd: uStraight + (def.xEnd - straightX),
      cap: Math.floor((def.xEnd - straightX - 8) / SP),
      cars: [],
      locked: false
    };
    return track;
  }

  function pointAt(track, u) {
    if (u <= 0) return { x: L0.x + u, y: L0.y, a: 0 };
    const pts = track.pts;
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
      .map((a, i) => ({ ...a, id: i + 1, status: 'coming' }))
      .sort((a, b) => a.at - b.at);

    const G = {
      level,
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
      sysQueue: [],
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

    G.sendHome = () => {
      if (G.busy() || G.finished || pilot.track === null) return false;
      startHome();
      return true;
    };

    // An engine runs itself from the reception road to the shed.
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
          { go: toId, to: uFinal, onEnd: attach }
        ]
      });
    }

    function startArrival(arrival) {
      const rec = byId.get('R');
      const cut = [makeVehicle(arrival.loco), ...arrival.cars.map(makeVehicle)];
      const k = cut.length;
      const uFinal = rec.uEnd - SP / 2 - (rec.cars.length + k) * SP;
      arrival.status = 'arriving';
      startJob({
        kind: 'arrival',
        from: null,
        to: 'R',
        k,
        hidePilot: true,
        cut,
        pilotU: -(L0.x + 80 + k * SP),
        track: 'R',
        dir: 1,
        steps: [{ go: 'R', to: uFinal, onEnd: attach }],
        onDone: () => {
          arrival.status = 'arrived';
          emit('arrived', { arrival });
          G.sysQueue.push({ from: 'R', to: 'SHED' });
        }
      });
      emit('arriving', { arrival });
    }

    // ---- Public queries ---------------------------------------------------------
    G.busy = () => !!G.job || G.sysQueue.length > 0 || arrivalReady() !== null;

    function arrivalReady() {
      const rec = byId.get('R');
      for (const arrival of arrivals) {
        if (arrival.status !== 'coming' || arrival.at + level.start > G.minute) continue;
        return rec.cars.length + arrival.cars.length + 1 <= rec.cap ? arrival : null;
      }
      return null;
    }

    G.waitingArrival = () => {
      const due = arrivals.find(a => a.status === 'coming' && a.at + level.start <= G.minute);
      return due && !G.job && arrivalReady() === null ? due : null;
    };

    G.validTargets = (fromId, k) =>
      tracks.filter(t => !t.locked && t.id !== fromId && t.cars.length + k <= t.cap).map(t => t.id);

    G.startMove = (fromId, idx, toId) => {
      if (G.busy() || G.finished) return false;
      const from = byId.get(fromId);
      const k = idx + 1;
      if (!from || from.locked || idx < 0 || idx >= from.cars.length) return false;
      if (!G.validTargets(fromId, k).includes(toId)) return false;
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

    // ---- Poses for drawing -------------------------------------------------------
    G.pilotPose = () => {
      const job = G.job;
      if (!job || job.hidePilot) {
        const p = pointAt(byId.get(pilot.track || 'R'), pilot.u);
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

      if (!G.job && pilot.track !== null && (G.sysQueue.length || arrivalReady())) {
        // Trains and engines need the yard throat clear, so Pip goes home first.
        startHome();
      }
      if (!G.job) {
        const sys = G.sysQueue.shift();
        if (sys) {
          const shed = byId.get(sys.to);
          if (shed.cars.length < shed.cap && byId.get(sys.from).cars.length > 0 && isLoco(byId.get(sys.from).cars[0].type)) {
            startEngineRun(sys.from, sys.to);
          }
        } else {
          const arrival = arrivalReady();
          if (arrival) startArrival(arrival);
        }
      }
      if (G.job) stepJob(dt);

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
