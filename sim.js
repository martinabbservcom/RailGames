(() => {
  'use strict';

  const { map, stations, edgeDefinitions, timetable, speeds, dwell, defaultPlatforms } = window.KentSignaller.data;

  const START_MINUTE = 7 * 60;
  const TICK = 0.05; // fixed simulation step, in game minutes

  function edgeKey(a, b) {
    return [a, b].sort().join('|');
  }

  // Pure simulation: no DOM access. All state lives on the returned object.
  function createSimulation() {
    const stationById = new Map(stations.map(station => [station.id, station]));
    const edges = edgeDefinitions.map(([from, to, miles], index) => ({
      id: `block-${index + 1}`,
      from,
      to,
      miles,
      cleared: false,
      trainId: null,
      yard: stationById.get(from).kind === 'yard' || stationById.get(to).kind === 'yard'
    }));
    const edgeById = new Map(edges.map(edge => [edge.id, edge]));
    const edgeBetween = new Map(edges.map(edge => [edgeKey(edge.from, edge.to), edge]));
    const trains = [];
    const launchedServices = new Set();
    let accumulator = 0;

    const sim = {
      map,
      stations,
      stationById,
      edges,
      edgeById,
      edgeBetween,
      trains,
      minute: START_MINUTE,
      startMinute: START_MINUTE,
      getPath,
      durationForEdge,
      toggleSignal,
      platformInfo,
      trainPosition,
      advance
    };

    function getPath(origin, destination) {
      if (origin === destination) return [];
      const queue = [origin];
      const previous = new Map([[origin, null]]);
      for (let head = 0; head < queue.length; head++) {
        const current = queue[head];
        for (const edge of edges) {
          const next = edge.from === current ? edge.to : edge.to === current ? edge.from : null;
          if (!next || previous.has(next)) continue;
          previous.set(next, { station: current, edge });
          if (next === destination) {
            const path = [];
            let cursor = destination;
            while (cursor !== origin) {
              const step = previous.get(cursor);
              path.unshift({ edge: step.edge, from: step.station, to: cursor });
              cursor = step.station;
            }
            return path;
          }
          queue.push(next);
        }
      }
      return [];
    }

    // Running time in game minutes: distance over the train's average speed,
    // or shunting speed on yard blocks.
    function durationForEdge(edge, train) {
      const mph = edge.yard ? speeds.yard : speeds[train.type];
      return edge.miles / mph * 60;
    }

    // The first running train that still has this block ahead of it.
    function trainUsing(edge) {
      return trains.find(train =>
        train.status !== 'arrived' && train.path.slice(train.nextStep).some(step => step.edge === edge));
    }

    // Toggles the signal. If a train is routed over this block, the signals for
    // every free block on the rest of its route are set together.
    // Returns { result: 'locked' | 'cleared' | 'danger', count, train }.
    function toggleSignal(edge) {
      if (edge.trainId) return { result: 'locked', count: 0, train: null };
      const train = trainUsing(edge);
      const blocks = train
        ? train.path.slice(train.nextStep).map(step => step.edge).filter(block => !block.trainId)
        : [edge];
      const clear = !edge.cleared;
      for (const block of blocks) block.cleared = clear;
      return { result: clear ? 'cleared' : 'danger', count: blocks.length, train: train || null };
    }

    function platformsAt(stationId) {
      const station = stationById.get(stationId);
      return station.platforms ?? defaultPlatforms[station.kind];
    }

    // Platforms in use at a station: trains standing there plus trains already
    // on the block heading in, which have a platform reserved.
    function platformsUsed(stationId) {
      return trains.filter(train => train.status !== 'arrived' &&
        (train.edgeId ? train.directionTo === stationId : train.currentStation === stationId)).length;
    }

    function platformInfo(stationId) {
      return { used: platformsUsed(stationId), total: platformsAt(stationId) };
    }

    function trainPosition(train) {
      if (!train.edgeId) return stationById.get(train.currentStation);
      const edge = edgeById.get(train.edgeId);
      const from = stationById.get(train.directionFrom);
      const to = stationById.get(train.directionTo);
      const fraction = Math.max(0, Math.min(1, 1 - train.remaining / train.edgeDuration));
      return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
    }

    // Shortest route through each of the service's `via` stations in turn.
    function routeFor(service) {
      const stops = [service.origin, ...(service.via || []), service.destination];
      const path = [];
      for (let i = 1; i < stops.length; i++) path.push(...getPath(stops[i - 1], stops[i]));
      return path;
    }

    function createTrain(service, departure) {
      const path = routeFor(service);
      if (!path.length) return;
      trains.push({
        id: `train-${service.number}-${departure}`,
        number: service.number,
        type: service.type,
        stock: service.stock,
        unit: service.unit,
        origin: service.origin,
        destination: service.destination,
        departure,
        path,
        nextStep: 0,
        currentStation: service.origin,
        edgeId: null,
        directionFrom: null,
        directionTo: null,
        remaining: 0,
        edgeDuration: 0,
        dwellRemaining: 0,
        status: 'waiting'
      });
    }

    function launchDueServices() {
      for (const service of timetable) {
        const departure = START_MINUTE + service.at;
        // A service that finds every platform at its origin full is held back.
        if (!launchedServices.has(service.number) && sim.minute >= departure &&
            platformsUsed(service.origin) < platformsAt(service.origin)) {
          createTrain(service, departure);
          launchedServices.add(service.number);
        }
      }
    }

    function moveTrain(train, deltaMinutes) {
      let timeLeft = deltaMinutes;
      while (timeLeft > 0 && train.status !== 'arrived') {
        if (!train.edgeId) {
          if (train.dwellRemaining > 0) {
            const stopped = Math.min(timeLeft, train.dwellRemaining);
            train.dwellRemaining -= stopped;
            timeLeft -= stopped;
            train.status = 'dwelling';
            if (train.dwellRemaining > 0) break;
            continue;
          }
          const next = train.path[train.nextStep];
          if (!next) {
            train.status = 'arrived';
            break;
          }
          train.currentStation = next.from;
          if (!next.edge.cleared || (next.edge.trainId && next.edge.trainId !== train.id)) {
            train.status = 'waiting';
            break;
          }
          if (platformsUsed(next.to) >= platformsAt(next.to)) {
            train.status = 'held';
            break;
          }
          next.edge.cleared = false;
          next.edge.trainId = train.id;
          train.edgeId = next.edge.id;
          train.directionFrom = next.from;
          train.directionTo = next.to;
          train.edgeDuration = durationForEdge(next.edge, train);
          train.remaining = train.edgeDuration;
          train.status = 'moving';
        }
        const used = Math.min(timeLeft, train.remaining);
        train.remaining -= used;
        timeLeft -= used;
        if (train.remaining <= 0) {
          edgeById.get(train.edgeId).trainId = null;
          train.currentStation = train.directionTo;
          train.edgeId = null;
          train.nextStep += 1;
          const final = train.nextStep >= train.path.length;
          const atEdge = stationById.get(train.currentStation).kind === 'edge';
          train.dwellRemaining = final ? (atEdge ? 0 : dwell.terminate[train.type]) : dwell.stop[train.type];
          train.status = train.dwellRemaining > 0 ? 'dwelling' : final ? 'arrived' : 'waiting';
        }
      }
    }

    function tick(dt) {
      sim.minute += dt;
      launchDueServices();
      for (const train of trains) {
        if (train.status !== 'arrived') moveTrain(train, dt);
      }
    }

    // Advance by an arbitrary real delta using fixed-size steps, so behaviour
    // does not depend on frame rate or game speed.
    function advance(deltaMinutes) {
      accumulator += deltaMinutes;
      while (accumulator >= TICK) {
        tick(TICK);
        accumulator -= TICK;
      }
    }

    launchDueServices();
    return sim;
  }

  window.KentSignaller.createSimulation = createSimulation;
})();
