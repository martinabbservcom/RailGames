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
  let PILOT_SPEED = 430; // units per second (upgrades can change these, see createGame)
  const BOARD_SECONDS = 4; // real seconds to board / load at 1x
  let SERVICE_MINUTES = 5; // game minutes an arrived engine needs in the shed before it can be used again
  let UNLOAD_SECONDS = 9; // real seconds for passengers to get off an arriving train at 1x
  let CANCEL_AFTER = 6; // minutes late before a train is cancelled
  const STAR_LIMITS = [0.4, 2, 5]; // minutes late for 3, 2 and 1 star

  const TRACK_DEFS = [
    { id: 'P1', name: 'Platform 1', y: 150, xEnd: 1030, through: true, kind: 'platform' },
    { id: 'P2', name: 'Platform 2', y: 236, xEnd: 1030, through: true, kind: 'platform' },
    { id: 'G', name: 'Goods road', y: 318, xEnd: 1030, through: true, kind: 'goods' },
    { id: 'S1', name: 'Siding 1', y: 384, xEnd: 960, through: false, kind: 'siding' },
    { id: 'S2', name: 'Siding 2', y: 448, xEnd: 960, through: false, kind: 'siding' },
    { id: 'S3', name: 'Siding 3', y: 512, xEnd: 960, through: false, kind: 'siding' },
    // The engine shed branches off the spine to the LEFT, above the signal box, and runs leftwards.
    { id: 'SHED', name: 'Engine shed 2', y: 562, xEnd: 26, through: false, kind: 'shed', side: 'left' },
    // A second shed road on the other side of the shed building.
    { id: 'SHED2', name: 'Engine shed 1', y: 485, xEnd: 26, through: false, kind: 'shed', side: 'left' },
    // Pip's own little siding, just big enough for the shunting engine, so Pip never has to share a shed road.
    { id: 'PIP', name: "Pip's siding", y: 626, xEnd: 108, through: false, kind: 'pip', side: 'left' }
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
      const bend = left ? Math.min(52, bendY - CORNER - 4) : Math.min(60, bendY - CORNER - 4);
      const p0 = spinePoint(def.y + bend);
      const p1 = spinePoint(def.y);
      p2 = left ? { x: p1.x - 80, y: def.y } : { x: p1.x + bend * 1.4 + 20, y: def.y };
      add(p0.x, p0.y);
      uBranch = pts[pts.length - 1].u;
      // Leave the spine at a shallow angle, then ease round to the straight: like a real turnout.
      const reach = left ? 48 : 58;
      const c1 = { x: p0.x + SPINE_DIR.x * reach, y: p0.y + SPINE_DIR.y * reach };
      const c2 = { x: p2.x + (left ? 58 : -72), y: p2.y };
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

  // Special trains: the icon shown before the name, the bonus stars for leaving on time, and a description.
  const SPECIALS = {
    vip: { icon: '👑', bonus: 2, text: 'VIP train: 2 bonus stars if it leaves on time.' },
    mail: { icon: '✉️', bonus: 1, text: 'Mail train: cancelled if it is more than 2 minutes late. 1 bonus star if on time.' },
    heritage: { icon: '🚂', bonus: 1, text: 'Heritage train: needs a steam engine. 1 bonus star if on time.' }
  };

  function createGame(level, options = {}) {
    // Upgrades bought with stars (see Y.UPGRADES in levels.js).
    const up = new Set(options.upgrades || []);
    PILOT_SPEED = up.has('pip') ? 640 : 430;
    SERVICE_MINUTES = up.has('service') ? 3 : 5;
    UNLOAD_SECONDS = up.has('unload') ? 5 : 9;
    CANCEL_AFTER = up.has('grace') ? 9 : 6;
    const PULL_LIMIT = level.pullLimit || 0; // vehicles one engine can pull (0 = no limit)
    const tracks = TRACK_DEFS.map(buildTrack);
    const byId = new Map(tracks.map(track => [track.id, track]));
    for (const track of tracks) track.locked = track.kind === 'pip' ? false : !level.tracks.includes(track.id);
    // True if the spine carries on past where this road branches off (some other road lies further up it).
    for (const track of tracks) track.spineContinues = tracks.some(o => o !== track && o.side !== 'left' && o.y < track.y);

    let nextId = 1;
    const makeVehicle = type => ({ id: nextId++, type, facing: 1 });

    const sheds = tracks.filter(t => t.kind === 'shed' && !t.locked);
    const isShed = t => t.kind === 'shed';
    // The first shed road with a free space (engines wait here for servicing).
    const freeShed = () => sheds.find(t => t.cars.length < t.cap) || null;
    for (const type of level.shed) {
      const engine = makeVehicle(type);
      engine.facing = -1; // engines in the shed are nose-in, facing left
      (freeShed() || sheds[0]).cars.push(engine);
    }
    for (const [id, list] of Object.entries(level.initial)) {
      for (const type of list) byId.get(id).cars.push(makeVehicle(type));
    }

    const specialBonus = d => (d.special ? SPECIALS[d.special].bonus : 0);
    const withIcon = d => (d.special && !d.name.startsWith(SPECIALS[d.special].icon) ? { ...d, name: `${SPECIALS[d.special].icon} ${d.name}` } : d);
    const departures = level.departures
      .map((d, i) => ({ ...withIcon(d), id: i + 1, status: 'waiting', progress: 0, stars: 0, lateBy: 0 }))
      .sort((a, b) => a.at - b.at);
    // Trains only ever come in from the main line on the right, never from the engine shed side.
    // Passenger trains use a platform so the passengers can get off; goods trains use the goods road.
    const platformFor = a => {
      const platforms = tracks.filter(t => t.kind === 'platform' && !t.locked);
      return platforms.find(t => t.id === a.track) || platforms[0];
    };
    const goodsRoad = tracks.find(t => t.kind === 'goods' && !t.locked);
    // The guard's van or brake van always rides at the back of a train (the last car, behind the engine-led front).
    const vanLast = cars => [
      ...cars.filter(t => t !== 'guard' && t !== 'brake'),
      ...cars.filter(t => t === 'brake'),
      ...cars.filter(t => t === 'guard')
    ];
    const arrivals = level.arrivals
      .map((a, i) => {
        const passengers = a.cars.some(type => isPassenger(type));
        const track = passengers || !goodsRoad ? platformFor(a) : goodsRoad;
        return { ...a, cars: vanLast(a.cars), id: i + 1, track: track.id, status: 'coming' };
      })
      .sort((a, b) => a.at - b.at);

    const unloadings = []; // trains standing while their passengers get off
    let undoState = null;
    const MAX_MISSES = 3;

    const G = {
      level,
      unloadings,
      endless: !!level.endless,
      maxMisses: MAX_MISSES,
      missed: 0,
      sent: 0,
      scheduleVersion: 0,
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
      freeplay: !!level.freeplay,
      maxStars: departures.reduce((sum, d) => sum + 3 + specialBonus(d), 0),
      stats: { sent: 0, onTime: 0, lateMinutes: 0, missed: 0, breakdowns: 0, derailments: 0, recovered: 0, signalFailures: 0, trackWorks: 0, arrivals: 0, specials: 0, bonusStars: 0 },
      pullLimit: PULL_LIMIT,
      pointAt,
      slotU,
      isPassenger,
      isLoco
    };

    const STAT_EVENTS = { breakdown: 'breakdowns', derail: 'derailments', recovered: 'recovered', signalfail: 'signalFailures', blocked: 'trackWorks', arrived: 'arrivals', cancel: 'missed' };
    const emit = (type, data = {}) => {
      if (STAT_EVENTS[type]) G.stats[STAT_EVENTS[type]]++;
      G.events.push({ type, ...data });
    };
    const DERAIL_CHANCE = 0.14 * (level.endless ? 0.5 : 1) * (up.has('safe') ? 0.5 : 1); // chance that an arriving train derails (events levels only)
    const DERAIL_AFTER = 12; // game minutes into the day before the first derailment can happen
    const BREAKDOWN_CHANCE = 0.12 * (level.endless ? 0.5 : 1) * (up.has('safe') ? 0.5 : 1); // chance that a departing train's engine breaks down (events levels only)
    let safeDepartures = 0; // trains that have left without a breakdown since the last one
    const BREAKDOWN_DELAY = 4; // extra game minutes given to a train whose engine broke down
    const RECOVER_SECONDS = up.has('crew') ? 14 : 24; // real seconds the recovery crane needs once called, at 1x

    // ---- Formations -----------------------------------------------------------
    const isEngineToken = t => t === 'loco' || (Y.TYPES[t] && Y.TYPES[t].kind === 'loco');
    // An engine fit to pull a departure: the right sort, and serviced.
    const engineOk = (car, token) =>
      isLoco(car.type) && (token === 'loco' || car.type === token) && !needsService(car);
    function formationMatches(dep, track) {
      const cars = track.cars;
      if (cars.length !== dep.spec.length) return false;
      return dep.spec.every((token, i) => {
        const car = cars[cars.length - 1 - i];
        return isEngineToken(token) ? engineOk(car, token) : car.type === token;
      });
    }
    G.formationMatches = formationMatches;

    // A short, friendly note on what a half-built train still needs ('' if the track is empty).
    function formationHint(dep, track) {
      const front = [...track.cars].reverse();
      if (!front.length) return '';
      const name = token => (token === 'loco' ? 'engine' : Y.TYPES[token].name.toLowerCase());
      const fits = i => (isEngineToken(dep.spec[i]) ? engineOk(front[i], dep.spec[i]) : front[i].type === dep.spec[i]);
      for (let i = 0; i < Math.min(front.length, dep.spec.length); i++) {
        if (!fits(i)) {
          const article = /^[aeiou]/.test(name(dep.spec[i])) ? 'an' : 'a';
          if (isLoco(front[i].type) && needsService(front[i])) return 'Engine broken down: swap it for a new one';
          return i === 0
            ? `Needs ${article} ${name(dep.spec[i])} at the front`
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
      if (step.go) {
        // An engine faces the way it is going, so it looks right whichever way it drives.
        const road = byId.get(step.go);
        const dx = pointAt(road, step.to).x - pointAt(road, step.from).x;
        if (Math.abs(dx) > 2) for (const v of job.cut) if (isLoco(v.type)) v.facing = dx < 0 ? -1 : 1;
      }
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
      // An engine that has just arrived stays 'arrived' until it reaches the shed; on a siding it then runs there itself.
      if (isShed(to)) for (const v of job.cut) { v.arrived = false; v.broken = false; }
      const moved = job.cut;
      to.cars.unshift(...moved);
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
    const pilot = { track: null, u: HOME_U, flip: false, hooked: false };
    G.pilot = pilot;

    // Pip starts the day parked in the engine shed road.
    const startShed = byId.get('PIP');
    if (startShed) {
      pilot.track = startShed.id;
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
          pilot.hooked = true;
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
          pilot.hooked = false;
          if (then) then();
        }
      });
    }

    // Pip must never be left on a road a train is arriving on, or on the lead by the signal box, when a
    // train is due: it parks on the engine shed road (or another open road) and stays out of the way.
    const PARK_ORDER = ['PIP', 'SHED', 'SHED2', 'S1', 'S2', 'S3', 'G', 'P2', 'P1'];
    function parkingRoad(...exclude) {
      const open = id => {
        const t = byId.get(id);
        return t && !t.locked && !exclude.includes(t.id) && t.cars.length < t.cap && !isUnloading(t.id);
      };
      const id = PARK_ORDER.find(open);
      return id ? byId.get(id) : null;
    }

    function startPark(dest, then) {
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
          pilot.hooked = false; // just parked, not coupled to anything
          if (then) then();
        }
      });
    }

    // Pip that has been idle at the signal box for a while parks in the engine shed road (if there is room).
    const IDLE_SECONDS = 5;
    let idle = 0;

    // Pip's own siding or an engine shed road: places where Pip can wait out of the way.
    const isParking = t => t.kind === 'pip' || isShed(t);

    // Pip tucks into its own siding if one has room, otherwise goes back to the signal box.
    function startToShed() {
      const here = pilot.track === null ? null : byId.get(pilot.track);
      if (here && isParking(here)) return;
      const dest = parkingRoad();
      if (dest && isParking(dest)) startPark(dest);
      else startHome();
    }

    G.sendHome = () => {
      if (G.busy() || G.finished || pilot.track === null) return false;
      const here = byId.get(pilot.track);
      if (isParking(here)) return false;
      startToShed();
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
          { go: toId, to: uFinal, onEnd: job => { attach(job); if (isShed(byId.get(toId))) emit('servicing'); } }
        ]
      });
    }

    function startArrival(arrival) {
      const rec = byId.get(arrival.track);
      // The engine leads, pulling the train in: it ends up at the far end of the road.
      const loco = makeVehicle(arrival.loco);
      loco.arrived = true;
      loco.service = SERVICE_MINUTES; // worn out from the run: needs servicing in the shed
      loco.facing = -1; // it comes in heading left, so it faces left
      // The engine leads the train, so it is at the left-hand (front) end as the train runs in from the right.
      const cut = [loco, ...arrival.cars.map(makeVehicle)];
      const k = cut.length;
      const uFinal = rec.uEnd - SP / 2 - (rec.cars.length + k) * SP;
      // The train runs in from the main line off the right-hand edge of the screen.
      const uStart = rec.uStraight + (W + 60 - rec.straightX);
      arrival.status = 'arriving';
      undoState = null;
      startJob({
        kind: 'arrival',
        from: null,
        to: rec.id,
        k,
        hidePilot: true,
        cut,
        pilotU: uStart,
        track: rec.id,
        dir: -1,
        steps: [{ go: rec.id, to: uFinal, onEnd: attach }],
        onDone: () => {
          if (eventsOn && G.minute - level.start > DERAIL_AFTER && Math.random() < DERAIL_CHANCE * (G.weather && G.weather.kind === 'rain' ? 1.6 : 1)) {
            // Random event: the train derails as it comes in and must be recovered before it can be moved.
            arrival.status = 'derailed';
            unloadings.push({ arrival, track: rec.id, t: 0, progress: 0, derail: true, called: false });
            emit('derail', { arrival, track: rec.id });
            return;
          }
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

    // 'passengers' or 'goods' for a train standing while it unloads, otherwise null.
    G.unloadingKind = trackId => {
      const u = unloadings.find(x => x.track === trackId);
      if (!u) return null;
      if (u.derail) return 'derail';
      return u.arrival.cars.some(type => isPassenger(type)) ? 'passengers' : 'goods';
    };

    function updateUnloading(dt) {
      for (let i = unloadings.length - 1; i >= 0; i--) {
        const u = unloadings[i];
        // A derailed train stands until the player calls the recovery crew; then the crew takes a while.
        if (u.derail && !u.called) continue;
        u.t += dt;
        u.progress = Math.min(1, u.t / (u.derail ? RECOVER_SECONDS : UNLOAD_SECONDS));
        if (u.progress >= 1) {
          unloadings.splice(i, 1);
          u.arrival.status = 'arrived';
          if (u.derail) emit('recovered', { arrival: u.arrival, track: u.track });
          else emit('arrived', { arrival: u.arrival, track: u.track });
        }
      }
    }

    // ---- Public queries ---------------------------------------------------------
    G.busy = () => !!G.job || readyLoco() !== null || arrivalReady() !== null;
    // True while an engine or train is moving (for the sound of chuffing).
    G.moving = () => !!(G.job && G.job.steps[G.job.i] && G.job.steps[G.job.i].go) || G.leaving.length > 0;

    // Signal for trains coming in: 'green' while one is entering or may enter, 'amber' when one is
    // due soon and the road is clear, otherwise 'red'.
    G.entrySignal = trackId => {
      const track = byId.get(trackId);
      if (G.job && G.job.kind === 'arrival' && G.job.to === trackId) return 'green';
      const nextAny = arrivals.find(a => a.status === 'coming');
      if (!nextAny || nextAny.track !== trackId) return 'red';
      const clear = !track.locked && track.cars.length === 0 && !G.leaving.some(l => l.track === trackId);
      const due = nextAny.at + level.start - G.minute;
      if (!clear) return 'red';
      return due <= 0 ? 'green' : due < 3 ? 'amber' : 'red';
    };

    // An arrived engine that has been taken into a siding with its train is uncoupled and drives itself to the shed.
    function readyLoco() {
      if (!freeShed()) return null;
      return tracks.find(t => !isShed(t) && t.cars.length > 0 && !isUnloading(t.id) &&
        ((t.kind === 'siding' && t.cars[0].arrived === true) || (t.cars.length === 1 && t.cars[0].broken === true))) || null;
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
      return isShed(byId.get(fromId)) ? needsService(cars[k - 1]) : cars.slice(0, k).some(needsService);
    };

    // A road that already has a serviced engine at its front, forming a new train. A train still hauled by its
    // tired engine may join it (the tired engine ends up at the back, from where it can go to the shed).
    const hasLeadEngine = t =>
      t.kind !== 'shed' && t.kind !== 'pip' && t.cars.length > 0 &&
      isLoco(t.cars[t.cars.length - 1].type) && !needsService(t.cars[t.cars.length - 1]);

    G.validTargets = (fromId, k) => {
      const from = byId.get(fromId);
      let cut = from.cars.slice(0, k);
      if (isShed(from) && from.cars[k - 1] && !needsService(from.cars[k - 1])) {
        cut = [from.cars[k - 1]];
        k = 1;
      }
      const worn = cut.some(needsService);
      return tracks
        // Only engines may enter an engine shed; coaches and wagons stay out.
        .filter(t => !isShed(t) || cut.every(v => isLoco(v.type)))
        .filter(t => !t.locked && t.kind !== 'pip' && t.id !== fromId && !isUnloading(t.id) && t.cars.length + k <= t.cap)
        // A worn engine alone may only go to the shed; hauling a train it may only go to a siding.
        .filter(t => !worn || (cut.every(v => isLoco(v.type)) ? isShed(t) : t.kind === 'siding' || hasLeadEngine(t)))
        .map(t => t.id);
    };

    G.startMove = (fromId, idx, toId) => {
      if (G.busy() || G.finished) return false;
      const from = byId.get(fromId);
      let k = idx + 1;
      if (!from || from.locked || isUnloading(fromId) || idx < 0 || idx >= from.cars.length) return false;
      if (!G.validTargets(fromId, k).includes(toId)) return false;
      snapshot();
      if (isShed(from) && !needsService(from.cars[idx])) {
        // Engines in the shed can shuffle past each other: only the chosen engine goes.
        from.cars.unshift(...from.cars.splice(idx, 1));
        k = 1;
      }
      // A train with an engine in it has its own power, so it doesn't need Pip to shunt it.
      if (from.cars.slice(0, k).some(v => isLoco(v.type))) {
        if (pilot.track === fromId || pilot.track === toId) {
          // Pip is in the way: send it home first, then the engine goes.
          // Pip tucks itself away in an engine shed (or another free road) rather than going back to the signal box.
          const away = parkingRoad(fromId, toId);
          const run = () => startEngineRun(fromId, toId, k);
          if (away) startPark(away, run);
          else startHome(run);
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
        const id = ['S1', 'S2', 'S3', 'G', 'P2', 'P1'].find(ok);
        return id ? byId.get(id) : null;
      };
      const moveOut = (track, k, why) => {
        // A train still hauled by its tired engine must go to a siding.
        const to = track.cars.slice(0, k).some(needsService) ? ['S1', 'S2', 'S3'].map(id => byId.get(id)).find(t => t && !t.locked && t.id !== track.id && t.cars.length + k <= t.cap) : dump(k, track.id);
        if (!to) return { text: `${why} There is no room to move it, so free up a siding first.` };
        const what = k === 1 ? `the ${Y.TYPES[track.cars[0].type].name.toLowerCase()}` : `the first ${k} vehicles`;
        return { text: `${why} Move ${what} from ${track.name} to ${to.name}.`, track: track.id, idx: k - 1, to: to.id };
      };

      // 1. A train that has arrived and been unloaded should be moved out of the way.
      for (const t of tracks) {
        const n = t.cars.length;
        if (n > 1 && t.kind !== 'siding' && t.kind !== 'shed' && t.cars[0].arrived && !isUnloading(t.id) && !t.locked) {
          return moveOut(t, n, 'This train has arrived and is unloaded. Take it into a siding, where the engine can leave for the shed.');
        }
      }
      // A train held at the signal needs its road cleared first.
      const held = G.waitingArrival();
      if (held) {
        const road = byId.get(held.track);
        if (road.cars.length > 0 && !isUnloading(road.id)) {
          return moveOut(road, road.cars.length, `The ${held.from} train is waiting at the signal.`);
        }
      }
      if (freeplay) {
        return { text: "Free play: put a train with an engine at the front and a guard's van or brake van at the back on a platform or the goods road and it leaves after 2 minutes. Passenger trains can only leave from the platforms." };
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
      if (isUnloading(track.id)) {
        if (G.unloadingKind(track.id) === 'derail') return { text: `The train on ${track.name} has derailed. Click it to call the recovery crew.` };
        return { text: G.unloadingKind(track.id) === 'goods' ? `Goods are still being unloaded at ${track.name}. Please wait.` : `Passengers are still getting off at ${track.name}. One moment!` };
      }
      const front = [...track.cars].reverse();
      if (front.length && isLoco(front[0].type) && needsService(front[0])) {
        // A broken-down engine: uncouple the train from it, send it to the shed and fit a new engine.
        if (front.length > 1) return moveOut(track, front.length - 1, `The engine on ${track.name} has broken down. Move the train off it first, then it can go to the shed.`);
        return { text: `The broken engine on ${track.name} will run to the shed. Then fit a serviced engine at the front.` };
      }
      const fits = i => (isEngineToken(dep.spec[i]) ? engineOk(front[i], dep.spec[i]) : front[i].type === dep.spec[i]);
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
          const match = isEngineToken(need) ? isLoco(v.type) && (need === 'loco' || v.type === need) : v.type === need;
          const worn = isShed(t) ? needsService(v) : t.cars.slice(0, idx + 1).some(needsService);
          if (!match || worn) return;
          const carry = isShed(t) ? 0 : idx;
          const score = carry * 10 + (isShed(t) ? 0 : 1);
          if (!best || score < best.score) best = { t, idx, carry, score };
        });
      }
      if (!best) {
        const servicing = isEngineToken(need) && tracks.some(t => t.cars.some(needsService));
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
        const p = pointAt(byId.get(pilot.track || 'PIP'), pilot.u);
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

    // The departure light turns green this many minutes before the due time, and a ready train may then leave.
    const GO_EARLY = 1;
    G.departureGreen = dep => !!dep && dep.status === 'ready' && G.minute >= level.start + dep.at - GO_EARLY;

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
          if (!G.job && pilot.track === dep.track) startToShed();
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
          if (dep.progress >= 1 && G.minute >= due - GO_EARLY) {
            // Random event: the engine may break down just as the train is about to leave.
            if (eventsOn && !dep.breakChecked) {
              dep.breakChecked = true;
              // The chance climbs with every train that leaves safely, and the third departure of a day with
              // events always breaks down if none has yet, so a breakdown is never missed for long.
              const chance = Math.min(0.6, BREAKDOWN_CHANCE * (G.weather && G.weather.kind === 'rain' ? 1.3 : 1) + (level.endless ? 0.03 : 0.08) * safeDepartures);
              if (((!level.endless && !G.stats.breakdowns && safeDepartures >= 2)) || (safeDepartures >= 1 && Math.random() < chance)) {
                safeDepartures = 0;
                breakDown(dep, track);
                continue;
              }
              safeDepartures++;
            }
            depart(dep, track);
          }
        } else if (dep.progress > 0) {
          // Formation broken or being shunted: passengers get off again.
          dep.progress = Math.max(0, dep.progress - (2 * dt) / BOARD_SECONDS);
          dep.status = dep.progress > 0 ? 'boarding' : 'waiting';
        }

        if (dep.status !== 'done' && G.minute > due + (dep.special === 'mail' ? 2.5 : CANCEL_AFTER)) {
          dep.status = 'cancelled';
          dep.progress = 0;
          G.missed++;
          emit('cancel', { dep, missed: G.missed });
        }
      }
    }

    function breakDown(dep, track) {
      const engine = track.cars[track.cars.length - 1];
      engine.service = SERVICE_MINUTES; // needs servicing again
      engine.broken = true;
      dep.status = 'waiting';
      dep.progress = 0;
      dep.at += BREAKDOWN_DELAY; // a little extra time to sort it out
      G.scheduleVersion++;
      undoState = null;
      emit('breakdown', { dep, track: track.id });
    }

    function depart(dep, track) {
      const late = Math.max(0, G.minute - (level.start + dep.at));
      dep.lateBy = late;
      const base = late <= STAR_LIMITS[0] ? 3 : late <= STAR_LIMITS[1] ? 2 : 1;
      // Special trains earn bonus stars for leaving on time.
      const bonus = base === 3 ? specialBonus(dep) : 0;
      dep.stars = base + bonus;
      G.stats.sent++;
      G.stats.lateMinutes += late;
      if (late <= STAR_LIMITS[1]) G.stats.onTime++;
      if (dep.special) G.stats.specials++;
      G.stats.bonusStars += bonus;
      dep.status = 'done';
      undoState = null;
      G.sent++;
      G.stars += dep.stars;
      const cars = track.cars.splice(0);
      for (const v of cars) v.facing = 1; // it leaves heading right
      // With a signal failure on the road, the train has to creep out.
      const slow = track.signalFailedUntil > G.minute;
      G.leaving.push({ track: track.id, cars, base: slotU(track, 0, cars.length) - SP, v: 0, dep, slow });
      emit('depart', { dep, track: track.id, slow });
    }

    function updateLeaving(dt) {
      for (const train of G.leaving) {
        train.v = Math.min(train.v + (train.slow ? 28 : 170) * dt, train.slow ? 75 : 440);
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
      if (endless) extendSchedule();

      if (freeplay) updateFreeplay();
      updateWeather(dt);
      if (eventsOn) updateEvents();

      const incoming = arrivalReady();
      const loco = readyLoco();
      if (!G.job && incoming && pilot.track === incoming.track) {
        // A train is arriving on the road Pip is standing on: Pip gets out of the way (trains come in from the right, so Pip is fine anywhere else).
        const parking = parkingRoad(incoming.track);
        if (parking) startPark(parking);
      } else if (!G.job && loco && (pilot.track === loco.id || pilot.track === freeShed().id)) {
        // The engine is about to run out of Pip's road or into Pip's shed road: Pip tucks into its own siding.
        const away = parkingRoad(loco.id, freeShed().id);
        if (away) startPark(away);
        else startHome();
      }
      if (!G.job) {
        if (loco) {
          undoState = null;
          startEngineRun(loco.id, freeShed().id);
        } else if (incoming) startArrival(incoming);
      }
      const held = G.waitingArrival();
      if (held && !held.held) {
        held.held = true;
        emit('held', { arrival: held });
      }
      if (G.job || pilot.track !== null) idle = 0;
      else if (!readyLoco() && !arrivalReady()) {
        idle += dt;
        if (idle >= IDLE_SECONDS) {
          idle = 0;
          const dest = parkingRoad();
          if (dest && isParking(dest)) startPark(dest);
        }
      }
      if (G.job) stepJob(dt);
      updateUnloading(dt);
      // Engines in the shed are serviced, one clock minute at a time.
      for (const v of sheds.flatMap(t => t.cars)) {
        if (!needsService(v)) continue;
        v.service -= dt / SECONDS_PER_MINUTE;
        if (v.service <= 0) {
          v.service = 0;
          emit('serviced', { vehicle: v });
        }
      }

      updateDepartures(dt);
      if (endless) updateDumps();
      updateLeaving(dt);

      if (endless) {
        if (G.missed >= MAX_MISSES) {
          G.finished = true;
          emit('finish', { stars: G.stars, max: 0, sent: G.sent, missed: G.missed });
        }
      } else if (!freeplay && departures.every(d => d.status === 'done' || d.status === 'cancelled') && G.leaving.length === 0) {
        G.finished = true;
        emit('finish', { stars: G.stars, max: G.maxStars });
      }
    };


    // ---- Endless mode ----------------------------------------------------------------
    // The timetable is made up as the game goes on, getting busier and harder, until the
    // player has missed MAX_MISSES trains. Every departure is built from vehicles that
    // really arrive, so it can always be done (but not always in time).
    const endless = !!level.endless;
    const TOWNS = ['Hillbury', 'Marshford', 'Dockside', 'Castle Hill', 'Lakeside', 'Greenfield', 'Cityville', 'Skegness'];
    const PASSENGER_MIX = ['coach', 'coach', 'coach', 'first', 'buffet'];
    const GOODS_MIX = ['coal', 'box', 'logs', 'tank', 'box'];
    const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const gen = { arrivals: 0, deps: 0, t: 0, flip: false, pool: { passenger: [], goods: [] }, lastDep: new Map() };
    let nextArrivalId = arrivals.length;
    let nextDepId = departures.length;

    function genArrival() {
      const n = gen.arrivals++;
      const passengers = Math.random() < 0.65;
      const len = Math.min(7, 3 + Math.floor(n / 3) + (Math.random() < 0.5 ? 1 : 0));
      const back = passengers ? 'guard' : 'brake';
      const cars = [];
      for (let i = 0; i < len - 1; i++) cars.push(pick(passengers ? PASSENGER_MIX : GOODS_MIX));
      cars.push(back);
      let track = 'G';
      if (passengers) {
        gen.flip = !gen.flip;
        track = gen.flip ? 'P1' : 'P2';
      }
      const at = gen.t;
      arrivals.push({
        id: ++nextArrivalId, at, from: pick(TOWNS), track, loco: pick(['steam', 'diesel']), cars, status: 'coming'
      });
      for (const type of cars) gen.pool[passengers ? 'passenger' : 'goods'].push({ type, avail: at + 3 });
      // Trains come thicker and faster the longer you last.
      gen.t += Math.max(6, 11 - n * 0.3) + rnd(-1, 1.5);
    }

    // Plan one departure out of the vehicles that are (or soon will be) in the yard.
    function genDeparture(kind) {
      const list = gen.pool[kind];
      const n = gen.deps;
      const want = Math.min(7, 3 + Math.floor(n / 3) + (Math.random() < 0.4 ? 1 : 0));
      const back = kind === 'passenger' ? 'guard' : 'brake';
      const backIdx = list.findIndex(v => v.type === back);
      if (list.length < want || backIdx < 0) return false;
      const backCar = list.splice(backIdx, 1)[0];
      const mids = list.splice(0, want - 1);
      // Shuffle so the new train is in a different order from how the vehicles arrived.
      for (let i = mids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mids[i], mids[j]] = [mids[j], mids[i]];
      }
      let track = 'G';
      if (kind === 'passenger') {
        track = ['P1', 'P2'].sort((a, b) => (gen.lastDep.get(a) || 0) - (gen.lastDep.get(b) || 0))[0];
      }
      const gap = Math.max(11, 18 - n * 0.5) + rnd(0, 2);
      const ready = Math.max(backCar.avail, ...mids.map(v => v.avail));
      const at = Math.max(ready + gap, (gen.lastDep.get(track) || 0) + 5);
      gen.lastDep.set(track, at);
      gen.deps++;
      const dest = pick(TOWNS);
      // Trains longer than one engine can pull need a second engine at the front.
      const engines = PULL_LIMIT && mids.length + 1 > PULL_LIMIT ? ['loco', 'loco'] : ['loco'];
      let special = null;
      if (kind === 'passenger') {
        if (mids.some(v => v.type === 'first') && Math.random() < 0.6) special = 'vip';
        else if (Math.random() < 0.08) special = 'heritage';
      } else if (mids.some(v => v.type === 'box') && Math.random() < 0.4) special = 'mail';
      const spec = [...engines, ...mids.map(v => v.type), backCar.type];
      if (special === 'heritage') spec[0] = 'steam';
      let title = kind === 'goods' ? `${dest} Goods` : `${dest} ${pick(['Express', 'Local', 'Special', 'Flyer'])}`;
      if (special === 'heritage') title = `${dest} Steam Special`;
      if (special === 'mail') title = `${dest} Mail`;
      if (special) title = `${SPECIALS[special].icon} ${title}`;
      departures.push({
        id: ++nextDepId,
        at,
        track,
        dest,
        special,
        name: title,
        spec,
        status: 'waiting',
        progress: 0,
        stars: 0,
        lateBy: 0
      });
      return true;
    }

    // ---- Spare trains (Endless Rush) ----------------------------------------------------
    // A proper train (engine in front, guard's or brake van at the back) that stands on a platform or the goods
    // road without being any timetabled train leaves by itself after 2 minutes. That lets the player clear the
    // sidings when they fill up. A train that is still being built for the next departure is left alone.
    const DUMP_MINUTES = 2;
    const dumpSince = new Map();
    G.dumpProgress = id => {
      const since = dumpSince.get(id);
      return since === undefined ? 0 : Math.min(1, (G.minute - since) / DUMP_MINUTES);
    };

    function updateDumps() {
      const busy = busyTracks();
      for (const track of tracks) {
        if (track.locked || !track.through) continue;
        const cars = track.cars;
        const front = cars[cars.length - 1];
        const dep = activeDeparture(track.id);
        // Is this road's next timetabled train being built (cars so far match its front)?
        const building = !!dep && cars.length <= dep.spec.length && cars.every((v, i) => {
          const token = dep.spec[cars.length - 1 - i];
          return isEngineToken(token) ? engineOk(v, token) : v.type === token;
        });
        const fit = cars.length >= 2 && !busy.has(track.id) && !isUnloading(track.id) &&
          engineOk(front, 'loco') && isVan(cars[0].type) && !G.passengersOnGoods(track) && !G.overPull(track) &&
          !building && !(dep && formationMatches(dep, track));
        if (!fit) {
          dumpSince.delete(track.id);
          continue;
        }
        if (!dumpSince.has(track.id)) dumpSince.set(track.id, G.minute);
        if (!G.job && pilot.track === track.id) startToShed();
        if (G.minute - dumpSince.get(track.id) >= DUMP_MINUTES) {
          dumpSince.delete(track.id);
          const gone = track.cars.splice(0);
          for (const v of gone) v.facing = 1;
          undoState = null;
          G.leaving.push({ track: track.id, cars: gone, base: slotU(track, 0, gone.length) - SP, v: 0, dep: null, slow: track.signalFailedUntil > G.minute });
          emit('dumped', { track: track.id });
        }
      }
    }

    function extendSchedule() {
      const before = arrivals.length + departures.length;
      while (gen.t < G.minute - level.start + 25) genArrival();
      for (const kind of ['passenger', 'goods']) while (genDeparture(kind));
      if (arrivals.length + departures.length !== before) {
        arrivals.sort((a, b) => a.at - b.at);
        departures.sort((a, b) => a.at - b.at);
        G.scheduleVersion++;
      }
    }

    if (endless) extendSchedule();

    // ---- Random events ----------------------------------------------------------------
    // Levels with `events: true` get track works that close a road for a while, and arriving trains
    // that sometimes derail and have to be recovered before they can be moved.
    const eventsOn = !!level.events;
    // ---- Time of day and weather -----------------------------------------------------
    // The sky runs on its own faster clock so that a short day still sees the sun move across the sky.
    const skyHour0 = level.sky ? level.sky.hour : 8;
    const skyRate = level.sky ? level.sky.rate : 1;
    G.hour = () => (skyHour0 + ((G.minute - level.start) / 60) * skyRate) % 24;
    const randomWeather = !!(level.endless || level.freeplay);
    G.weather = {
      kind: level.weather || 'clear',
      amount: level.weather && level.weather !== 'clear' ? 1 : 0,
      nextChange: level.start + rnd(18, 30)
    };

    function updateWeather(dt) {
      const w = G.weather;
      if (randomWeather && G.minute >= w.nextChange) {
        const r = Math.random();
        w.kind = r < 0.45 ? 'clear' : r < 0.65 ? 'cloudy' : r < 0.85 ? 'rain' : 'fog';
        w.nextChange = G.minute + rnd(20, 38);
        emit('weather', { kind: w.kind });
      }
      w.amount += ((w.kind === 'clear' ? 0 : 1) - w.amount) * Math.min(1, dt / 12);
    }

    let nextEventAt = level.start + rnd(10, 16);
    let nextSignalAt = level.start + rnd(16, 24);

    // Signal failure: trains leaving that road have to creep out slowly (and so hold up the road longer).
    function startSignalFailure() {
      if (tracks.some(t => t.signalFailedUntil > G.minute)) return false;
      const options = tracks.filter(t => t.through && !t.locked);
      if (!options.length) return false;
      const track = pick(options);
      const minutes = Math.round(rnd(8, 12));
      track.signalFailedUntil = G.minute + minutes;
      emit('signalfail', { track: track.id, minutes });
      return true;
    }

    G.callRecovery = trackId => {
      const u = unloadings.find(x => x.track === trackId && x.derail && !x.called);
      if (!u) return false;
      u.called = true;
      emit('recovering', { arrival: u.arrival, track: trackId });
      return true;
    };
    G.isDerailed = trackId => unloadings.some(u => u.derail && u.track === trackId);
    G.recovery = trackId => unloadings.find(u => u.derail && u.track === trackId) || null;

    function startTrackWorks() {
      if (tracks.some(t => t.blockedUntil)) return false;
      const minutes = Math.round(rnd(6, 9));
      const horizon = G.minute + minutes + 3;
      const quiet = t =>
        ['platform', 'goods', 'siding'].includes(t.kind) && !t.locked && t.cars.length === 0 &&
        !isUnloading(t.id) && pilot.track !== t.id &&
        !(G.job && (G.job.from === t.id || G.job.to === t.id || G.job.track === t.id)) &&
        !G.leaving.some(l => l.track === t.id) &&
        !arrivals.some(a => a.track === t.id && (a.status === 'arriving' || (a.status === 'coming' && level.start + a.at < horizon))) &&
        !departures.some(d => d.track === t.id && (d.status === 'waiting' || d.status === 'boarding' || d.status === 'ready') && level.start + d.at < horizon);
      const options = tracks.filter(quiet);
      if (!options.length) return false;
      const track = pick(options);
      track.locked = true;
      track.blockedUntil = G.minute + minutes;
      emit('blocked', { track: track.id, minutes });
      return true;
    }

    function updateEvents() {
      for (const t of tracks) {
        if (t.blockedUntil && G.minute >= t.blockedUntil) {
          t.blockedUntil = 0;
          t.locked = false;
          emit('reopened', { track: t.id });
        }
      }
      for (const t of tracks) {
        if (t.signalFailedUntil && G.minute >= t.signalFailedUntil) {
          t.signalFailedUntil = 0;
          emit('signalfixed', { track: t.id });
        }
      }
      if (G.minute >= nextSignalAt) nextSignalAt = G.minute + (startSignalFailure() ? rnd(18, 30) * (G.weather.kind === 'fog' ? 0.5 : 1) : 2);
      if (G.minute >= nextEventAt) nextEventAt = G.minute + (startTrackWorks() ? rnd(14, 24) : 2);
    }

    // ---- Free play ------------------------------------------------------------------
    // No timetable: a train comes in every 10 minutes if a road is free, and any train standing on a
    // platform or the goods road with a fit engine at the front boards and leaves after 2 minutes.
    const freeplay = !!level.freeplay;
    const FREE_ARRIVAL_GAP = 10; // game minutes between arrivals
    const FREE_LEAVE_AFTER = 2; // game minutes a built train waits before it goes
    let nextFreeArrival = level.start;

    // Passenger trains can't leave from the goods road (goods trains can leave from the platforms).
    G.passengersOnGoods = track => track.kind === 'goods' && track.cars.some(v => isPassenger(v.type));

    // True if a train with an engine in front has more vehicles than its engines can pull (one engine pulls PULL_LIMIT).
    G.overPull = track =>
      PULL_LIMIT > 0 && track.cars.length > 0 && isLoco(track.cars[track.cars.length - 1].type) &&
      track.cars.filter(v => !isLoco(v.type)).length > PULL_LIMIT * track.cars.filter(v => isLoco(v.type)).length;

    // A train needs a guard's van or brake van at the back before it may leave.
    const isVan = type => type === 'guard' || type === 'brake';

    function roadFree(id) {
      const t = byId.get(id);
      return !!t && !t.locked && t.cars.length === 0 && !isUnloading(id) &&
        !G.leaving.some(l => l.track === id) && !arrivals.some(a => a.status === 'arriving' && a.track === id);
    }

    // The player can call the next train in early from the main line (Free Play only).
    G.canCallTrain = () =>
      freeplay && !G.finished && !arrivals.some(a => a.status === 'coming') && ['P1', 'P2', 'G'].some(roadFree);
    G.callTrain = () => {
      if (!G.canCallTrain() || !freeArrival()) return false;
      nextFreeArrival = G.minute + FREE_ARRIVAL_GAP;
      return true;
    };

    function freeArrival() {
      const platforms = ['P1', 'P2'].filter(roadFree);
      let passengers = Math.random() < 0.65;
      if (passengers && !platforms.length) passengers = false;
      if (!passengers && !roadFree('G')) passengers = true;
      if (passengers && !platforms.length) return false;
      const len = 3 + Math.floor(Math.random() * 4);
      const cars = [];
      for (let i = 0; i < len - 1; i++) cars.push(pick(passengers ? PASSENGER_MIX : GOODS_MIX));
      cars.push(passengers ? 'guard' : 'brake');
      arrivals.push({
        id: ++nextArrivalId,
        at: G.minute - level.start,
        from: pick(TOWNS),
        track: passengers ? pick(platforms) : 'G',
        loco: pick(['steam', 'diesel']),
        cars,
        status: 'coming'
      });
      arrivals.sort((a, b) => a.at - b.at);
      G.scheduleVersion++;
      return true;
    }

    function updateFreeplay() {
      if (G.minute >= nextFreeArrival && !arrivals.some(a => a.status === 'coming') && freeArrival()) {
        nextFreeArrival = G.minute + FREE_ARRIVAL_GAP;
      }
      const busy = busyTracks();
      for (let i = departures.length - 1; i >= 0; i--) if (departures[i].status === 'done') departures.splice(i, 1);
      for (const track of tracks) {
        if (track.locked || !track.through) continue;
        const dep = activeDeparture(track.id);
        const front = track.cars[track.cars.length - 1];
        const fit = track.cars.length >= 2 && !busy.has(track.id) && !isUnloading(track.id) &&
          engineOk(front, 'loco') && isVan(track.cars[0].type) && !G.passengersOnGoods(track) && !G.overPull(track);
        if (dep) {
          if (!fit || !formationMatches(dep, track)) departures.splice(departures.indexOf(dep), 1);
        } else if (fit) {
          const dest = pick(TOWNS);
          departures.push({
            id: ++nextDepId,
            free: true,
            at: G.minute - level.start + FREE_LEAVE_AFTER,
            track: track.id,
            dest,
            name: track.cars.some(v => isPassenger(v.type)) ? `${dest} Local` : `${dest} Goods`,
            spec: [...track.cars].reverse().map(v => (isLoco(v.type) ? 'loco' : v.type)),
            status: 'waiting',
            progress: 0,
            stars: 3,
            lateBy: 0
          });
        }
      }
    }

    return G;
  }

  Y.W = W;
  Y.H = H;
  Y.SP = SP;
  Y.SECONDS_PER_MINUTE = SECONDS_PER_MINUTE;
  Y.createGame = createGame;
  Y.SPECIALS = SPECIALS;
  Y.isLoco = isLoco;
  Y.isPassenger = isPassenger;
})();
