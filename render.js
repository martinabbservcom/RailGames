(() => {
  'use strict';

  const Y = (window.Yard = window.Yard || {});
  const FONT = "'Fredoka', 'Nunito', 'Trebuchet MS', 'Segoe UI', sans-serif";
  const INK = '#2b3a55';
  const PEOPLE = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#ff9f43', '#c77dff', '#ff70a6'];

  const hasPassengers = dep => dep.spec.some(t => t !== 'loco' && Y.TYPES[t].kind === 'coach');

  // ---- Small helpers --------------------------------------------------------------
  function mulberry(seed) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const mix = c => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
    const r = mix(n >> 16);
    const g = mix((n >> 8) & 255);
    const b = mix(n & 255);
    return `rgb(${r},${g},${b})`;
  }

  function path(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function box(ctx, x, y, w, h, r, fill, line = 2.5) {
    path(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = line;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  function circle(ctx, x, y, r, fill, line = 0) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (line) {
      ctx.lineWidth = line;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  }

  function star(ctx, x, y, r, fill, line = 0) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (line) {
      ctx.lineWidth = line;
      ctx.strokeStyle = INK;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  }

  function label(ctx, text, x, y, size, color, align = 'center', weight = 600) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function eyes(ctx, x, y, gap, size, look = 1) {
    for (const dx of [-gap, gap]) {
      circle(ctx, x + dx, y, size, '#fff', 1.5);
      circle(ctx, x + dx + look * size * 0.3, y + size * 0.1, size * 0.5, INK);
    }
  }

  function smile(ctx, x, y, w) {
    ctx.beginPath();
    ctx.arc(x, y, w, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // An unhappy mouth, in the same place as the smile.
  function frown(ctx, x, y, w) {
    ctx.beginPath();
    ctx.arc(x, y + w * 2, w, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function wheel(ctx, x, y, r) {
    circle(ctx, x, y, r, '#39435c', 1.5);
    circle(ctx, x, y, r * 0.42, '#c9d3e6');
  }

  // ---- Vehicles (drawn centred, facing right, wheels at y = +11) -----------------------
  function windows(ctx, count, startX, y, w, h, color = '#d9f1ff') {
    for (let i = 0; i < count; i++) box(ctx, startX + i * (w + 4), y, w, h, 2.5, color, 1.5);
  }

  const SPRITES = {
    coach(ctx, color) {
      box(ctx, -23, -17, 46, 25, 6, color);
      box(ctx, -23, -17, 46, 6, 4, shade(color, 0.35), 2);
      windows(ctx, 4, -19, -9, 6.5, 8);
      box(ctx, -23, 3, 46, 5, 2, shade(color, -0.25), 2);
    },
    first(ctx, color) {
      SPRITES.coach(ctx, color);
      star(ctx, 0, -14, 4.5, '#fff7c2', 1.2);
    },
    buffet(ctx, color) {
      box(ctx, -23, -17, 46, 25, 6, color);
      box(ctx, -23, -17, 46, 6, 4, shade(color, 0.35), 2);
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? '#fff' : '#ffb3b6';
        ctx.fillRect(-16 + i * 5.5, -10, 5.5, 4);
      }
      windows(ctx, 3, -18, -5, 10, 7);
      box(ctx, -23, 3, 46, 5, 2, shade(color, -0.25), 2);
      circle(ctx, 18, -3, 2.5, '#fff7c2', 1);
    },
    guard(ctx, color) {
      box(ctx, -23, -17, 46, 25, 6, color);
      box(ctx, -8, -23, 16, 8, 3, shade(color, 0.3), 2);
      box(ctx, -5, -21, 10, 4, 1, '#d9f1ff', 1);
      box(ctx, -23, -17, 46, 5, 4, shade(color, 0.35), 2);
      windows(ctx, 2, -19, -8, 9, 8);
      box(ctx, 5, -8, 14, 12, 2, shade(color, -0.15), 1.5);
      ctx.beginPath();
      ctx.moveTo(-16, -17);
      ctx.lineTo(-16, -29);
      ctx.lineTo(-6, -26);
      ctx.lineTo(-16, -23);
      ctx.fillStyle = '#ff5d5d';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
    },
    coal(ctx, color) {
      box(ctx, -23, -8, 46, 16, 3, color);
      ctx.fillStyle = shade(color, -0.2);
      for (let i = 0; i < 4; i++) ctx.fillRect(-18 + i * 11, -6, 3, 11);
      for (let i = 0; i < 7; i++) circle(ctx, -18 + i * 6, -9 - (i % 2) * 3, 4.5, '#262a33', 1.2);
    },
    tank(ctx, color) {
      box(ctx, -23, 4, 46, 5, 2, '#4a5470', 2);
      box(ctx, -22, -17, 44, 22, 11, color);
      box(ctx, -22, -17, 44, 7, 6, shade(color, 0.35), 1.5);
      box(ctx, -7, -22, 14, 6, 3, shade(color, -0.2), 2);
      ctx.fillStyle = INK;
      ctx.fillRect(-20, -5, 40, 2);
    },
    box(ctx, color) {
      box(ctx, -23, -17, 46, 25, 4, color);
      ctx.strokeStyle = shade(color, -0.3);
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(-23 + i * 5.75, -16);
        ctx.lineTo(-23 + i * 5.75, 7);
        ctx.stroke();
      }
      box(ctx, -9, -13, 18, 19, 2, shade(color, 0.28), 2);
      ctx.beginPath();
      ctx.moveTo(-9, -13);
      ctx.lineTo(9, 6);
      ctx.moveTo(9, -13);
      ctx.lineTo(-9, 6);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = shade(color, -0.35);
      ctx.stroke();
    },
    logs(ctx, color) {
      box(ctx, -23, 1, 46, 7, 2, color);
      for (const x of [-20, 18]) box(ctx, x, -14, 4, 15, 1, '#5c6578', 1.5);
      const logs = [[-14, -4], [0, -4], [14, -4], [-7, -13], [7, -13]];
      for (const [x, y] of logs) {
        circle(ctx, x, y, 7, '#a9703d', 2);
        circle(ctx, x, y, 4.5, '#d9a066');
        circle(ctx, x, y, 1.8, '#a9703d');
      }
    },
    brake(ctx, color) {
      box(ctx, -23, 3, 46, 5, 2, '#4a5470', 2);
      box(ctx, -15, -17, 30, 21, 4, color);
      box(ctx, -17, -21, 34, 6, 3, shade(color, -0.2), 2);
      box(ctx, -10, -11, 8, 8, 2, '#d9f1ff', 1.5);
      box(ctx, 3, -11, 8, 8, 2, '#d9f1ff', 1.5);
      box(ctx, 6, -31, 4, 11, 1, '#4a5470', 1.5);
      ctx.fillStyle = '#ffd93d';
      ctx.fillRect(-15, 0, 30, 3);
      for (const x of [-22, 20]) {
        ctx.beginPath();
        ctx.moveTo(x, 4);
        ctx.lineTo(x, -8);
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    }
  };

  function drawEngine(ctx, color, trim, kind, sad = false) {
    if (kind === 'diesel') {
      box(ctx, -23, -14, 46, 22, 6, color);
      box(ctx, -23, -26, 19, 14, 5, shade(color, 0.12));
      box(ctx, -20, -23, 13, 7, 2, '#d9f1ff', 1.5);
      ctx.fillStyle = trim;
      ctx.fillRect(-22, -2, 44, 4);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-22, -2, 44, 4);
      eyes(ctx, 6, -8, 6, 4.2, 1);
      if (sad) {
        frown(ctx, 10, -6, 8);
        circle(ctx, 12, -2.5, 1.8, '#6fc3ff');
      } else smile(ctx, 10, -6, 8);
      circle(ctx, 22, -9, 2.5, '#fff7a8', 1);
      for (const x of [-12, 0, 12]) wheel(ctx, x, 11, 6);
      return;
    }
    // steam
    box(ctx, -23, -22, 18, 30, 4, shade(color, -0.12));
    box(ctx, -26, -26, 24, 6, 3, shade(color, -0.3), 2);
    box(ctx, -20, -17, 11, 9, 2, '#d9f1ff', 1.5);
    box(ctx, -6, -14, 28, 19, 9, color);
    box(ctx, 14, -22, 7, 9, 2, '#39435c', 2);
    box(ctx, 11, -26, 13, 5, 2, '#39435c', 2);
    box(ctx, 0, -19, 9, 6, 3, trim, 2);
    ctx.fillStyle = trim;
    ctx.fillRect(-5, 0, 26, 3);
    ctx.beginPath();
    ctx.moveTo(22, 6);
    ctx.lineTo(30, 10);
    ctx.lineTo(22, 10);
    ctx.closePath();
    ctx.fillStyle = '#39435c';
    ctx.fill();
    eyes(ctx, 8, -7, 5.2, 4, 1);
    if (sad) {
      frown(ctx, 13, -4, 6);
      circle(ctx, 13.2, -2, 1.7, '#6fc3ff');
    } else smile(ctx, 13, -4, 6);
    wheel(ctx, -13, 9, 8);
    wheel(ctx, 4, 11, 6);
    wheel(ctx, 17, 11, 6);
  }

  function drawVehicleBody(ctx, type, sad = false) {
    const t = Y.TYPES[type];
    if (t.kind === 'loco') drawEngine(ctx, t.color, t.trim, type, sad);
    else {
      SPRITES[type](ctx, t.color);
      wheel(ctx, -14, 11, 6);
      wheel(ctx, 14, 11, 6);
    }
    if (t.kind !== 'loco') {
      // Couplings.
      ctx.fillStyle = INK;
      ctx.fillRect(-27, 6, 4, 3);
      ctx.fillRect(23, 6, 4, 3);
    }
  }

  function drawPilot(ctx, t) {
    ctx.save();
    ctx.scale(0.92, 0.92);
    drawEngine(ctx, '#ff8a3d', '#fff2a8', 'steam');
    // Little lantern and bell.
    circle(ctx, 24, -2, 3, '#fff7a8', 1.5);
    box(ctx, -24, -33, 3, 7, 1, '#39435c', 1);
    circle(ctx, -22.5, -34, 2.5, '#ffd93d', 1);
    ctx.restore();
  }

  function drawPerson(ctx, x, y, color, bob = 0, wave = false) {
    ctx.save();
    ctx.translate(x, y - Math.abs(bob));
    box(ctx, -3.5, -10, 7, 10, 3, color, 1.4);
    circle(ctx, 0, -14, 4.2, '#ffd9b3', 1.4);
    ctx.fillStyle = INK;
    ctx.fillRect(-2.5, -14.8, 1.2, 1.2);
    ctx.fillRect(1.3, -14.8, 1.2, 1.2);
    if (wave) {
      ctx.beginPath();
      ctx.moveTo(3, -8);
      ctx.lineTo(7, -15 + Math.sin(bob * 9) * 2);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#ffd9b3';
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Scenery (drawn once and cached) ------------------------------------------------
  function tree(ctx, x, y, s, hue) {
    box(ctx, x - 3 * s, y - 14 * s, 6 * s, 15 * s, 2, '#a9703d', 1.8);
    for (const [dx, dy, r, c] of [[-9, -20, 11, 0], [9, -20, 11, 0.12], [0, -30, 13, 0.2]]) {
      circle(ctx, x + dx * s, y + dy * s, r * s, shade(hue, -0.05 + c), 2);
    }
  }

  function house(ctx, x, y, w, h, wall, roof) {
    box(ctx, x, y, w, h, 3, wall);
    ctx.beginPath();
    ctx.moveTo(x - 6, y + 1);
    ctx.lineTo(x + w / 2, y - h * 0.55);
    ctx.lineTo(x + w + 6, y + 1);
    ctx.closePath();
    ctx.fillStyle = roof;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
    box(ctx, x + w * 0.15, y + h * 0.3, w * 0.25, h * 0.3, 2, '#d9f1ff', 1.8);
    box(ctx, x + w * 0.6, y + h * 0.42, w * 0.22, h * 0.58, 3, '#8a5a36', 1.8);
  }

  // Drawn in layers (all ballast, then sleepers, then rails) so branching tracks merge like points
  // instead of one track lying over another.
  function drawTrackBed(ctx, track, pointAt, layer) {
    const samples = [];
    const start = -270;
    // A road with a buffer stops at the buffer; a through road carries on off the edge of the screen.
    const endU = track.through ? track.uEnd + (1130 - track.xEnd) : track.uEnd + 6;
    for (let u = start; u < endU; u += 5) samples.push(pointAt(track, u));
    samples.push(pointAt(track, endU));
    if (layer === 'ballast') {
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      samples.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = '#bba98a';
      ctx.lineWidth = 26;
      ctx.stroke();
      return;
    }
    if (layer === 'ballast2') {
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      samples.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = '#cdbf9f';
      ctx.lineWidth = 20;
      ctx.stroke();
      return;
    }
    if (layer === 'sleepers') {
      // Sleepers.
      ctx.strokeStyle = '#8a5a36';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'butt';
      // Every sleeper is drawn at full length, so both ends show all the way round a curve. Where a
      // branch leaves the spine the sleepers overlap and fan out, like the sleepers at real points.
      for (let u = start; u <= endU; u += 12) {
        const p = pointAt(track, u);
        const nx = -Math.sin(p.a) * 11;
        const ny = Math.cos(p.a) * 11;
        ctx.beginPath();
        ctx.moveTo(p.x - nx, p.y - ny);
        ctx.lineTo(p.x + nx, p.y + ny);
        ctx.stroke();
      }
      return;
    }
    // Rails.
    for (const side of [-5, 5]) {
      ctx.beginPath();
      samples.forEach((p, i) => {
        const x = p.x - Math.sin(p.a) * side;
        const y = p.y + Math.cos(p.a) * side;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.strokeStyle = '#59627a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = '#dfe6f2';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  function bufferStop(ctx, x, y) {
    box(ctx, x, y - 9, 8, 18, 2, '#e5484d', 2);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 1.5, y - 6, 5, 3);
    ctx.fillRect(x + 1.5, y + 2, 5, 3);
  }

  const roadSegs = [[[-10, 420], [60, 410], [40, 385], [130, 360]], [[130, 360], [215, 320], [200, 240], [110, 210]],
    // Winds on and leaves the board at the left edge.
    [[110, 210], [50, 190], [20, 205], [-15, 215]]];
  const roadAt = (seg, t) => {
    const [p0, p1, p2, p3] = seg;
    const u = 1 - t;
    const f = i => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i];
    const g = i => 3 * u * u * (p1[i] - p0[i]) + 6 * u * t * (p2[i] - p1[i]) + 3 * t * t * (p3[i] - p2[i]);
    const len = Math.hypot(g(0), g(1));
    return { x: f(0), y: f(1), nx: -g(1) / len, ny: g(0) / len };
  };

  // The village road as a polyline measured by distance, for traffic.
  const ROAD_PATH = (() => {
    const pts = [];
    let len = 0;
    for (const seg of roadSegs) {
      for (let i = 0; i <= 40; i++) {
        const r = roadAt(seg, i / 40);
        if (pts.length) len += Math.hypot(r.x - pts[pts.length - 1].x, r.y - pts[pts.length - 1].y);
        pts.push({ x: r.x, y: r.y, d: len });
      }
    }
    return { pts, len };
  })();

  function roadPoint(d) {
    const pts = ROAD_PATH.pts;
    let i = 1;
    while (i < pts.length - 1 && pts[i].d < d) i++;
    const a = pts[i - 1];
    const b = pts[i];
    const t = (d - a.d) / ((b.d - a.d) || 1);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return { x: a.x + dx * t, y: a.y + dy * t, angle: Math.atan2(dy, dx) };
  }

  // Trees are drawn onto `treeCtx`, a separate layer that goes on top of the road traffic.
  function drawScenery(ctx, game, treeCtx, stationCtx) {
    const { W, H } = game;
    const rand = mulberry(7);

    // Sky.
    const sky = ctx.createLinearGradient(0, 0, 0, 150);
    sky.addColorStop(0, '#7fcdff');
    sky.addColorStop(1, '#dff4ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 160);

    // Sun with a face.
    ctx.save();
    ctx.translate(150, 62);
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 38, Math.sin(a) * 38);
      ctx.lineTo(Math.cos(a) * 50, Math.sin(a) * 50);
      ctx.stroke();
    }
    circle(ctx, 0, 0, 30, '#ffd23f', 2.5);
    eyes(ctx, 0, -4, 9, 3.6, 0);
    smile(ctx, 0, 6, 9);
    circle(ctx, -16, 8, 4, 'rgba(255,120,120,.5)');
    circle(ctx, 16, 8, 4, 'rgba(255,120,120,.5)');
    ctx.restore();

    // Hills.
    ctx.fillStyle = '#a9e07b';
    ctx.beginPath();
    ctx.moveTo(0, 130);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 100 + Math.sin(x / 130) * 18 + Math.sin(x / 47) * 5);
    ctx.lineTo(W, 200);
    ctx.lineTo(0, 200);
    ctx.fill();
    ctx.fillStyle = '#92d663';
    ctx.beginPath();
    ctx.moveTo(0, 150);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 118 + Math.sin(x / 90 + 2) * 14 + Math.sin(x / 31) * 3);
    ctx.lineTo(W, 220);
    ctx.lineTo(0, 220);
    ctx.fill();

    // Ground.
    ctx.fillStyle = '#86cf56';
    ctx.fillRect(0, 124, W, H - 124);
    for (let i = 0; i < 260; i++) {
      const x = rand() * W;
      const y = 130 + rand() * (H - 130);
      ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,.08)' : 'rgba(40,120,40,.10)';
      ctx.beginPath();
      ctx.ellipse(x, y, 14 + rand() * 18, 4 + rand() * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Village on the left.
    const leftLimit = y => 250 + (690 - y) * 0.3 - 46;
    const spots = [];
    const free = (x, y, r) => x + r < leftLimit(y) && spots.every(s => Math.hypot(s[0] - x, s[1] - y) > r + s[2]);
    // A winding road.
    ctx.strokeStyle = '#d6cdb5';
    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-10, 420);
    ctx.bezierCurveTo(60, 410, 40, 385, 130, 360);
    ctx.bezierCurveTo(215, 320, 200, 240, 110, 210);
    ctx.bezierCurveTo(50, 190, 20, 205, -15, 215);
    ctx.stroke();
    // Keep trees and houses off the road and the windmill.
    for (const seg of roadSegs) {
      for (let t = 0; t <= 1; t += 0.05) {
        const r = roadAt(seg, t);
        spots.push([r.x, r.y, 12]);
      }
    }
    spots.push([60, 295, 48]);
    ctx.setLineDash([10, 12]);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    // Houses and trees.
    // Houses sit just beside the road, one side or the other.
    const houseDefs = [
      [1, 0.15, 1, 42, 30, '#d9f5c3', '#8b5cf6'],
      [1, 0.45, -1, 46, 32, '#cfeaff', '#e5484d'],
      [1, 0.7, 1, 42, 30, '#ffe9b8', '#2f9e8f'],
      [2, 0.3, -1, 42, 30, '#e3d4ff', '#e5484d']
    ];
    for (const [si, t, side, w, h, wall, roof] of houseDefs) {
      const r = roadAt(roadSegs[si], t);
      const dist = 14 + Math.abs(r.nx) * (w / 2 + 6) + Math.abs(r.ny) * (h / 2 + 10);
      const cx = r.x + side * r.nx * dist;
      const cy = r.y + side * r.ny * dist;
      house(ctx, cx - w / 2, cy - h / 2 + 6, w, h, wall, roof);
      spots.push([cx, cy, 30]);
    }
    for (const x of [40, 100, 160, 220, 270]) spots.push([x, 555, 44], [x, 480, 50], [x, 626, 24]);
    let tries = 0;
    let treeCount = 0;
    while (treeCount < 18 && tries++ < 800) {
      const x = 20 + rand() * 210;
      const y = 150 + rand() * 480;
      if (free(x, y, 18) && !(x < 125 && y > 600)) {
        tree(treeCtx, x, y, 0.8 + rand() * 0.5, ['#4fb04f', '#5cc05c', '#3fa05a'][Math.floor(rand() * 3)]);
        spots.push([x, y, 18]);
        treeCount++;
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = 10 + rand() * 230;
      const y = 140 + rand() * 520;
      // Flowers only on the grass: not on the road, the houses or under the trees.
      if (x < leftLimit(y) - 10 && spots.every(p => Math.hypot(p[0] - x, p[1] - y) > p[2] + 6)) {
        circle(ctx, x, y, 2.2, ['#fff', '#ffd93d', '#ff8fab'][i % 3]);
      }
    }

    // Station building behind platform 1: a compact brick building with a hipped roof, chimney and forecourt.
    ctx.fillStyle = '#e7dec6';
    ctx.fillRect(660, 112, 440, 18);
    // The building itself goes on its own layer, drawn over the sky, clouds and planes.
    const sctx = stationCtx;
    box(sctx, 700, 44, 250, 72, 4, '#d9694f');
    sctx.strokeStyle = 'rgba(0,0,0,.12)';
    sctx.lineWidth = 1;
    for (let y = 52; y < 116; y += 8) {
      sctx.beginPath();
      sctx.moveTo(701, y);
      sctx.lineTo(949, y);
      sctx.stroke();
    }
    // Chimney, behind the roof.
    box(sctx, 906, 8, 18, 30, 2, '#b5533c', 2.2);
    box(sctx, 903, 4, 24, 7, 2, '#8d3f2e', 2);
    sctx.beginPath();
    sctx.moveTo(690, 48);
    sctx.lineTo(960, 48);
    sctx.lineTo(936, 24);
    sctx.lineTo(714, 24);
    sctx.closePath();
    sctx.fillStyle = '#5a4b8f';
    sctx.fill();
    sctx.lineWidth = 2.5;
    sctx.strokeStyle = INK;
    sctx.stroke();
    sctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let x = 722; x < 926; x += 22) sctx.fillRect(x, 28, 10, 16);
    box(sctx, 706, 56, 120, 30, 8, '#fff7e0', 2.5);
    label(sctx, 'SIBSEY STATION', 766, 71, 13, INK, 'center', 700);
    for (const x of [712, 868]) {
      box(sctx, x, 90, 26, 22, 10, '#cfeaff', 2);
      sctx.beginPath();
      sctx.moveTo(x + 13, 90);
      sctx.lineTo(x + 13, 112);
      sctx.lineWidth = 1.5;
      sctx.strokeStyle = INK;
      sctx.stroke();
    }
    box(sctx, 898, 62, 34, 38, 15, '#cfeaff', 2);
    sctx.beginPath();
    sctx.moveTo(915, 62);
    sctx.lineTo(915, 100);
    sctx.moveTo(898, 82);
    sctx.lineTo(932, 82);
    sctx.lineWidth = 1.5;
    sctx.strokeStyle = INK;
    sctx.stroke();
    // Arched station door, with the clock above it.
    sctx.beginPath();
    sctx.moveTo(822, 116);
    sctx.lineTo(822, 90);
    sctx.arc(841, 90, 19, Math.PI, 0);
    sctx.lineTo(860, 116);
    sctx.closePath();
    sctx.fillStyle = '#8a5a36';
    sctx.fill();
    sctx.lineWidth = 2.5;
    sctx.strokeStyle = INK;
    sctx.stroke();
    sctx.beginPath();
    sctx.moveTo(841, 71);
    sctx.lineTo(841, 116);
    sctx.lineWidth = 1.5;
    sctx.stroke();
    circle(sctx, 835, 98, 2, '#ffd23f', 1);
    circle(sctx, 847, 98, 2, '#ffd23f', 1);

    // Goods shed and dock.
    box(ctx, 740, 254, 300, 40, 4, '#c9803a');
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let x = 750; x < 1030; x += 12) ctx.fillRect(x, 256, 2, 36);
    ctx.beginPath();
    ctx.moveTo(732, 258);
    ctx.lineTo(1048, 258);
    ctx.lineTo(1030, 244);
    ctx.lineTo(750, 244);
    ctx.closePath();
    ctx.fillStyle = '#6f7b88';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    box(ctx, 840, 270, 46, 24, 3, '#ffe3a3', 2);
    label(ctx, 'GOODS', 863, 281, 11, INK, 'center', 700);
    for (const [x, y] of [[760, 281], [790, 285], [932, 283], [980, 284]]) {
      box(ctx, x - 9, y - 9, 18, 16, 2, '#e0a85c', 2);
      ctx.strokeStyle = INK;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 1);
      ctx.lineTo(x + 9, y - 1);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Track beds and buffers.
    for (const layer of ['ballast', 'ballast2', 'sleepers', 'rails']) {
      for (const track of game.tracks) drawTrackBed(ctx, track, game.pointAt, layer);
    }
    for (const track of game.tracks) {
      if (!track.through) bufferStop(ctx, track.side === 'left' ? track.xEnd - 10 : track.xEnd + 2, track.y);
    }

    // Island platform: a sensible length with sloped ends, in front of the station building.
    box(ctx, 680, 168, 400, 50, 8, '#e8dfc6');
    ctx.fillStyle = '#ffd93d';
    ctx.fillRect(702, 170, 368, 3);
    ctx.fillRect(702, 213, 368, 3);
    for (const x of [724, 832, 940, 1048]) {
      ctx.fillStyle = INK;
      ctx.fillRect(x - 1.5, 168, 3, 44);
      circle(ctx, x, 168, 5, '#fff7a8', 1.8);
    }
    for (const x of [778, 994]) {
      box(ctx, x - 16, 190, 32, 6, 2, '#8a5a36', 1.8);
      ctx.fillStyle = INK;
      ctx.fillRect(x - 13, 196, 3, 6);
      ctx.fillRect(x + 10, 196, 3, 6);
    }
    for (const [n, y] of [[1, 183], [2, 203]]) {
      circle(ctx, 698, y, 8, '#4d96ff', 1.8);
      label(ctx, String(n), 698, y + 0.5, 11, '#fff', 'center', 700);
    }

    // Engine shed, on the left above the signal box, behind its own road.
    ctx.save();
    ctx.translate(0, -20);
    box(ctx, 34, 536, 176, 36, 4, '#d9694f');
    ctx.beginPath();
    ctx.moveTo(26, 540);
    ctx.lineTo(218, 540);
    ctx.lineTo(198, 514);
    ctx.lineTo(46, 514);
    ctx.closePath();
    ctx.fillStyle = '#5a4b8f';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    box(ctx, 160, 546, 36, 24, 3, '#cfeaff', 2);
    label(ctx, 'ENGINE SHED', 100, 556, 10, '#fff5d8', 'center', 700);
    ctx.restore();

    // Sign for Pip's own siding.
    box(ctx, 112, 648, 76, 16, 6, '#fff7e0', 2);
    label(ctx, "PIP'S SIDING", 150, 656, 9, INK, 'center', 700);

    // Signal box near the lead.
    ctx.save();
    ctx.translate(300, 0);
    box(ctx, 28, 640, 44, 34, 3, '#fff0c9');
    box(ctx, 22, 616, 56, 28, 3, '#6b8cff');
    box(ctx, 30, 622, 14, 16, 2, '#d9f1ff', 1.5);
    box(ctx, 56, 622, 14, 16, 2, '#d9f1ff', 1.5);
    box(ctx, 48, 655, 14, 19, 2, '#8a5a36', 1.5);
    label(ctx, 'SIGNAL BOX', 50, 606, 9, INK, 'center', 700);
    ctx.restore();

    // Fence along the bottom edge.
    ctx.fillStyle = '#fff';
    for (let x = 6; x < W; x += 22) {
      path(ctx, x, 704, 6, 14, 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    ctx.fillRect(0, 709, W, 3);
  }

  // ---- Renderer -------------------------------------------------------------------------
  Y.createRenderer = function createRenderer(canvas, game) {
    const ctx = canvas.getContext('2d');
    let G = game;
    let scale = 1;
    let scenery = null;
    let treeLayer = null;
    let stationLayer = null;
    const particles = [];
    let lastPuff = 0;
    const clouds = [[120, 40, 1], [420, 70, 0.8], [760, 30, 1.2]];
    const iconCache = new Map();

    function resize(cssWidth) {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2, 2600 / cssWidth));
      scale = (cssWidth * dpr) / G.W;
      canvas.width = Math.round(G.W * scale);
      canvas.height = Math.round(G.H * scale);
      buildScenery();
    }

    function buildScenery() {
      scenery = document.createElement('canvas');
      scenery.width = canvas.width;
      scenery.height = canvas.height;
      const c = scenery.getContext('2d');
      c.scale(scale, scale);
      treeLayer = document.createElement('canvas');
      treeLayer.width = canvas.width;
      treeLayer.height = canvas.height;
      const t = treeLayer.getContext('2d');
      t.scale(scale, scale);
      stationLayer = document.createElement('canvas');
      stationLayer.width = canvas.width;
      stationLayer.height = canvas.height;
      const st = stationLayer.getContext('2d');
      st.scale(scale, scale);
      drawScenery(c, G, t, st);
    }

    function cloud(x, y, s) {
      ctx.fillStyle = '#fff';
      for (const [dx, dy, r] of [[0, 0, 18], [20, -8, 22], [44, 0, 18], [22, 6, 20]]) {
        ctx.beginPath();
        ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // A passenger plane now and then crosses the sky, trailing a thin white vapour trail.
    let plane = null;
    let nextPlane = null;

    function drawPlane(p) {
      const trail = ctx.createLinearGradient(p.x, 0, p.x - p.dir * 160, 0);
      trail.addColorStop(0, 'rgba(255,255,255,.75)');
      trail.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = trail;
      ctx.fillRect(Math.min(p.x, p.x - p.dir * 160), p.y + 3, 160, 3);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.dir * p.scale, p.scale);
      // Far wing, tail fin, then the body, near wing and engine on top.
      ctx.beginPath();
      ctx.moveTo(-2, -4);
      ctx.lineTo(8, -4);
      ctx.lineTo(-2, -13);
      ctx.lineTo(-10, -13);
      ctx.closePath();
      ctx.fillStyle = '#b9d4f2';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-22, -4);
      ctx.lineTo(-30, -19);
      ctx.lineTo(-17, -19);
      ctx.lineTo(-10, -4);
      ctx.closePath();
      ctx.fillStyle = '#e5484d';
      ctx.fill();
      ctx.stroke();
      box(ctx, -28, -6, 56, 13, 6.5, '#fff', 2);
      box(ctx, 17, -4, 8, 5, 2, '#4d96ff', 1.5);
      for (let x = -20; x <= 10; x += 6) circle(ctx, x, -0.5, 1.7, '#4d96ff');
      ctx.fillStyle = '#e5484d';
      ctx.fillRect(-27, 3, 52, 2);
      ctx.beginPath();
      ctx.moveTo(2, 4);
      ctx.lineTo(12, 4);
      ctx.lineTo(-6, 17);
      ctx.lineTo(-16, 17);
      ctx.closePath();
      ctx.fillStyle = '#dcebfb';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      box(ctx, -5, 11, 9, 5, 2.5, '#8a96ab', 1.5);
      ctx.restore();
    }

    function updatePlane(time, dt) {
      if (nextPlane === null) nextPlane = time + 6000 + Math.random() * 12000;
      if (!plane && time >= nextPlane) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        plane = { x: dir > 0 ? -90 : G.W + 90, y: 22 + Math.random() * 56, dir, speed: 70 + Math.random() * 40, scale: 0.85 + Math.random() * 0.35 };
      }
      if (!plane) return;
      plane.x += plane.dir * plane.speed * dt;
      drawPlane(plane);
      if ((plane.dir > 0 && plane.x > G.W + 220) || (plane.dir < 0 && plane.x < -220)) {
        plane = null;
        nextPlane = time + 25000 + Math.random() * 45000;
      }
    }

    function windmill(time) {
      const x = 60;
      const y = 290;
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(-14, 40);
      ctx.lineTo(-8, -10);
      ctx.lineTo(8, -10);
      ctx.lineTo(14, 40);
      ctx.closePath();
      ctx.fillStyle = '#fff0c9';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      box(ctx, -5, 22, 10, 18, 5, '#8a5a36', 1.5);
      ctx.translate(0, -12);
      ctx.rotate(time / 1800);
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3);
        box(ctx, -3, -42, 10, 40, 2, '#fff', 1.8);
        ctx.restore();
      }
      circle(ctx, 0, 0, 5, '#e5484d', 2);
      ctx.restore();
    }

    function stationClock() {
      const cx = 841;
      const cy = 54;
      circle(ctx, cx, cy, 15, '#fff', 2.5);
      const minutes = G.minute % 60;
      const hours = (G.minute / 60) % 12;
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin((hours / 12) * Math.PI * 2) * 7, cy - Math.cos((hours / 12) * Math.PI * 2) * 7);
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin((minutes / 60) * Math.PI * 2) * 11, cy - Math.cos((minutes / 60) * Math.PI * 2) * 11);
      ctx.stroke();
    }

    const byShed = pose => pose.track === 'SHED' || pose.track === 'SHED2';

    // A spanner badge over an engine that needs servicing; in the shed it shows how far along it is.
    function servicingBadge(pose, inShed) {
      const x = pose.x;
      const y = pose.y - 60;
      path(ctx, x - 15, y - 9, 30, 18, 9);
      ctx.fillStyle = inShed ? '#fff' : '#ffb938';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      if (inShed) {
        const done = 1 - Math.max(0, Math.min(1, pose.v.service / G.SERVICE_MINUTES));
        path(ctx, x - 12, y + 3, 24 * Math.max(0.08, done), 4, 2);
        ctx.fillStyle = '#3ccf7a';
        ctx.fill();
      }
      label(ctx, '🔧', x, y - (inShed ? 2 : 0), 11, INK, 'center', 700);
    }

    function drawVehicle(pose, extra) {
      ctx.save();
      ctx.translate(pose.x, pose.y);
      if (pose.track && G.isDerailed(pose.track)) {
        // A derailed train lies skewed off the rails, each vehicle at its own angle.
        const k = pose.idx || 0;
        ctx.translate(0, 4 + (k % 2) * 2);
        ctx.rotate((k % 2 ? 1 : -1) * (0.1 + (k % 3) * 0.04));
      }
      if (Math.cos(pose.a) < 0) {
        // Heading left (the engine shed road): turn the picture round so it stays the right way up.
        ctx.rotate(pose.a + Math.PI);
        ctx.scale(-1, 1);
      } else ctx.rotate(pose.a);
      ctx.translate(0, -13);
      if (extra && extra.glow) {
        path(ctx, -30, -33, 60, 56, 10);
        ctx.lineWidth = 4;
        ctx.strokeStyle = extra.glow;
        ctx.stroke();
      }
      // Engines of a derailed train look unhappy.
      drawVehicleBody(ctx, pose.v.type, !!pose.track && G.isDerailed(pose.track));
      ctx.restore();
    }

    function tab(track, time) {
      const dep = G.activeDeparture(track.id);
      const title = `${track.name}  ${track.cars.length}/${track.cap}`;
      let x = track.xMin + 8;
      // The engine shed labels sit above their engines, clear of Pip.
      const y = track.kind === 'shed' ? track.y - 62 : track.y - 33;
      const lines = [{ text: title, size: 11, color: track.locked ? '#dfe6f2' : INK }];
      if (dep) {
        const m = Math.round(dep.at + G.level.start);
        lines.push({ text: `${dep.name}  ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, size: 10, color: '#d9486a' });
        const arrived = track.cars.length > 0 && track.cars[0].arrived;
        const note = arrived || G.isUnloading(track.id) ? '' : G.formationHint(dep, track);
        if (note) lines.push({ text: note, size: 10, color: note === 'Perfect!' ? '#1f9d5b' : '#b5651d' });
      }
      if (G.freeplay && G.passengersOnGoods(track)) {
        lines.push({ text: 'Passenger trains leave from a platform', size: 10, color: '#b5651d' });
      }
      if (track.signalFailedUntil > G.minute) {
        lines.push({ text: `Signal failure · trains leave slowly (${Math.max(1, Math.ceil(track.signalFailedUntil - G.minute))} min)`, size: 10, color: '#d92f2f' });
      }
      if (track.blockedUntil) {
        lines.push({ text: `Track works · reopens in ${Math.max(1, Math.ceil(track.blockedUntil - G.minute))} min`, size: 10, color: '#ffd23f' });
      }
      if (G.unloadingKind(track.id) === 'derail') {
        lines.push({ text: G.recovery(track.id).called ? 'Recovery crew at work…' : 'Derailed! Click the train for recovery', size: 10, color: '#d92f2f' });
      } else if (G.isUnloading(track.id)) {
        lines.push({ text: G.unloadingKind(track.id) === 'goods' ? 'Unloading goods, please wait…' : 'Passengers getting off…', size: 10, color: '#1b6fd1' });
      }
      let w = 0;
      for (const line of lines) {
        ctx.font = `700 ${line.size}px ${FONT}`;
        w = Math.max(w, ctx.measureText(line.text).width + 14);
      }
      // Shed labels are centred on the shed building's roof (the signal box has moved, so both labels line up).
      if (track.kind === 'shed') x = 122 - w / 2;
      const h = 6 + lines.length * 13;
      const top = y + 12 - h;
      path(ctx, x, top, w, h, 6);
      ctx.fillStyle = track.locked ? 'rgba(80,90,110,.85)' : 'rgba(255,255,255,.9)';
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = INK;
      ctx.stroke();
      lines.forEach((line, i) => label(ctx, line.text, x + 7, top + 10 + i * 13, line.size, line.color, 'left', 700));
    }

    // A warning (or the recovery progress bar) over a derailed train.
    function derailBadges(time) {
      for (const u of G.unloadings) {
        if (!u.derail) continue;
        const track = G.byId.get(u.track);
        const mid = track.xEnd - (track.cars.length * G.SP) / 2;
        const y = track.y - 56;
        const wide = u.called ? 150 : 184;
        path(ctx, mid - wide / 2, y - 12, wide, 24, 12);
        ctx.fillStyle = u.called ? 'rgba(255,255,255,.94)' : (Math.floor(time / 450) % 2 ? '#ffe3e3' : '#fff');
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = u.called ? INK : '#d92f2f';
        ctx.stroke();
        if (u.called) {
          path(ctx, mid - 66, y + 3, 132 * Math.max(0.05, u.progress), 5, 2.5);
          ctx.fillStyle = '#3ccf7a';
          ctx.fill();
          label(ctx, '🚧 Recovery crew at work', mid, y - 3, 10, INK, 'center', 700);
        } else {
          label(ctx, '⚠ Derailed! Click to call recovery', mid, y, 10, '#d92f2f', 'center', 700);
        }
      }
    }

    function lockedOverlay(track) {
      const xEnd = track.xMax;
      ctx.save();
      path(ctx, track.xMin - 4, track.y - 16, xEnd - track.xMin + 14, 32, 8);
      ctx.clip();
      ctx.fillStyle = 'rgba(70,80,100,.45)';
      ctx.fillRect(track.xMin - 4, track.y - 16, xEnd - track.xMin + 14, 32);
      ctx.strokeStyle = 'rgba(255,214,64,.8)';
      ctx.lineWidth = 6;
      for (let x = track.xMin - 40; x < xEnd + 20; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, track.y + 18);
        ctx.lineTo(x + 30, track.y - 18);
        ctx.stroke();
      }
      ctx.restore();
      for (const x of [track.xMin + 24, xEnd - 24]) {
        ctx.beginPath();
        ctx.moveTo(x - 7, track.y + 6);
        ctx.lineTo(x, track.y - 14);
        ctx.lineTo(x + 7, track.y + 6);
        ctx.closePath();
        ctx.fillStyle = '#ff8a3d';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
      label(ctx, 'Closed today', (track.xMin + xEnd) / 2, track.y, 13, '#fff', 'center', 700);
    }

    function targetGlow(track, time) {
      const pulse = 0.5 + 0.5 * Math.sin(time / 220);
      path(ctx, track.xMin - 6, track.y - 25, track.xMax - track.xMin + 18, 38, 12);
      ctx.fillStyle = `rgba(255,255,255,${0.16 + pulse * 0.16})`;
      ctx.fill();
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -time / 40;
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(32,160,90,${0.7 + pulse * 0.3})`;
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrow showing where the cars will be placed.
      const x = G.pointAt(track, G.slotU(track, 0, track.cars.length + 1)).x;
      ctx.beginPath();
      ctx.moveTo(x + 12, track.y - 32 - pulse * 3);
      ctx.lineTo(x - 12, track.y - 32 - pulse * 3);
      ctx.lineTo(x, track.y - 20 - pulse * 3);
      ctx.closePath();
      ctx.fillStyle = '#24b36b';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }

    // A little signal on a post. `state` is 'green', 'amber' or 'red'.
    // `dir` (-1 or 1) adds a small arrow under the lamps showing which way the train it controls is going.
    function signalPost(x, y, state, dir = 0) {
      if (state === 'fault') {
        // Failed signal: lamps flicker and a warning sign stands over it.
        const on = Math.floor(Date.now() / 400) % 2;
        ctx.fillStyle = INK;
        ctx.fillRect(x - 1.5, y - 30, 3, 36);
        box(ctx, x - 6, y - 40, 12, 20, 5, '#39435c', 2);
        circle(ctx, x, y - 34, 3.6, on ? '#ffb938' : '#3a2a2a');
        circle(ctx, x, y - 25, 3.6, '#4a3a3a');
        label(ctx, '⚠', x, y - 50, 12, '#d92f2f', 'center', 700);
        return;
      }
      ctx.fillStyle = INK;
      ctx.fillRect(x - 1.5, y - 30, 3, 36);
      box(ctx, x - 6, y - 40, 12, 20, 5, '#39435c', 2);
      circle(ctx, x, y - 34, 3.6, state === 'green' ? '#3a4a3a' : state === 'amber' ? '#ffb938' : '#ff5d5d');
      circle(ctx, x, y - 25, 3.6, state === 'green' ? '#5dff8a' : '#4a3a3a');
      if (dir) {
        ctx.beginPath();
        ctx.moveTo(x + dir * 4, y - 12);
        ctx.lineTo(x - dir * 2.5, y - 16);
        ctx.lineTo(x - dir * 2.5, y - 8);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    }

    // Entry signals: one at the throat of each road that a train arrives on. Red until the road is empty, amber when a train is due soon.
    function entrySignals() {
      for (const track of G.tracks) {
        if (track.locked || !track.through) continue;
        // Trains come in from the right: the entry signal (arrow pointing left) stands beside the road at its right-hand end.
        signalPost(track.xEnd + 58, track.y - 16, G.entrySignal(track.id), -1);
      }
    }

    function signals() {
      entrySignals();
      for (const track of G.tracks) {
        if (!track.through) continue;
        const dep = G.activeDeparture(track.id);
        const state = dep && dep.status === 'ready' ? 'green' : dep && dep.status === 'boarding' ? 'amber' : 'red';
        // The exit signal (arrow pointing right) stands beside the road, just past the end of the train.
        signalPost(track.xEnd + 32, track.y - 16, track.signalFailedUntil > G.minute ? 'fault' : state, 1);
      }
    }

    function boardingBars(time) {
      for (const dep of G.departures) {
        if (dep.progress <= 0 || dep.status === 'done' || dep.status === 'cancelled') continue;
        const track = G.byId.get(dep.track);
        const mid = track.xEnd - (track.cars.length * G.SP) / 2;
        const y = track.y - 52;
        const freight = !hasPassengers(dep);
        path(ctx, mid - 66, y - 11, 132, 22, 11);
        ctx.fillStyle = 'rgba(255,255,255,.92)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        path(ctx, mid - 62, y - 7, 124 * dep.progress, 14, 7);
        ctx.fillStyle = dep.status === 'ready' ? '#3ccf7a' : '#ffb938';
        ctx.fill();
        let text = freight ? 'Loading…' : 'Boarding…';
        if (dep.status === 'ready') {
          const m = Math.round(G.level.start + dep.at);
          text = `Ready! Leaves ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        }
        label(ctx, text, mid, y + 0.5, 11, INK, 'center', 700);
      }
    }

    function crowd(time, poses) {
      for (const dep of G.departures) {
        if (dep.status === 'done' || dep.status === 'cancelled') continue;
        if (G.activeDeparture(dep.track) !== dep) continue;
        if (dep.track !== 'P1' && dep.track !== 'P2') continue;
        if (!hasPassengers(dep)) continue;
        const rand = mulberry(dep.id * 97 + 13);
        const count = Math.min(14, 4 + dep.spec.length * 2);
        const doors = poses.filter(p => p.track === dep.track && Y.TYPES[p.v.type].kind === 'coach');
        const yWait = dep.track === 'P1' ? 196 : 190;
        const yDoor = dep.track === 'P1' ? 176 : 210;
        for (let i = 0; i < count; i++) {
          const wx = 710 + rand() * 340;
          const wy = yWait + rand() * 12 - 6;
          const color = PEOPLE[Math.floor(rand() * PEOPLE.length)];
          const bob = Math.sin(time / 300 + i) * 1.2;
          const start = (i / count) * 0.8;
          const p = Math.max(0, Math.min(1, (dep.progress - start) / 0.2));
          if (p >= 1 && doors.length) continue;
          if (p > 0 && doors.length) {
            const door = doors[i % doors.length];
            const t = p * p * (3 - 2 * p);
            drawPerson(ctx, wx + (door.x - wx) * t, wy + (yDoor - wy) * t, color, Math.sin(time / 80 + i) * 2);
          } else {
            drawPerson(ctx, wx, wy, color, bob, dep.status === 'ready' && i % 3 === 0);
          }
        }
      }
    }

    // Passengers stepping off an arriving train and walking away down the platform.
    function alighting(time, poses) {
      for (const u of G.unloadings) {
        if (u.derail || (u.track !== 'P1' && u.track !== 'P2')) continue;
        const doors = poses.filter(p => p.track === u.track && Y.TYPES[p.v.type].kind === 'coach');
        if (!doors.length) continue;
        const rand = mulberry(u.arrival.id * 53 + 7);
        const count = Math.min(14, 4 + doors.length * 2);
        const yDoor = u.track === 'P1' ? 176 : 210;
        const yWalk = u.track === 'P1' ? 196 : 190;
        for (let i = 0; i < count; i++) {
          const door = doors[i % doors.length];
          const start = (i / count) * 0.7;
          const p = Math.max(0, Math.min(1, (u.progress - start) / 0.3));
          if (p <= 0) continue;
          const t = p * p * (3 - 2 * p);
          const wx = Math.max(710, Math.min(1050, door.x + (rand() - 0.5) * 120 - 60));
          const wy = yWalk + rand() * 12 - 6;
          const color = PEOPLE[Math.floor(rand() * PEOPLE.length)];
          drawPerson(ctx, door.x + (wx - door.x) * t, yDoor + (wy - yDoor) * t, color, Math.sin(time / 80 + i) * 2);
        }
      }
    }

    function puff(x, y, big) {
      particles.push({
        x, y, vx: 14 + Math.random() * 10, vy: -22 - Math.random() * 14,
        life: 0, max: 1.1 + Math.random() * 0.6, size: big ? 9 : 6, kind: 'smoke'
      });
    }

    function burst(x, y, kind) {
      const n = kind === 'confetti' ? 40 : 12;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (kind === 'confetti' ? 60 : 40) + Math.random() * 120;
        particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'confetti' ? 80 : 20),
          life: 0, max: 0.7 + Math.random() * 0.7, size: 3 + Math.random() * 3, kind,
          color: PEOPLE[Math.floor(Math.random() * PEOPLE.length)], spin: Math.random() * 6
        });
      }
    }

    function updateParticles(dt) {
      for (const p of particles) {
        p.life += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind !== 'smoke') p.vy += 220 * dt;
      }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life > particles[i].max) particles.splice(i, 1);
    }

    function drawParticles() {
      for (const p of particles) {
        const t = p.life / p.max;
        ctx.globalAlpha = 1 - t;
        if (p.kind === 'smoke') circle(ctx, p.x, p.y, p.size * (1 + t * 1.6), '#fff');
        else if (p.kind === 'spark') star(ctx, p.x, p.y, p.size + 2, '#ffd93d', 1);
        else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin + p.life * 6);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }

    function arrivalHint(time) {
      const waiting = G.waitingArrival();
      const next = G.arrivals.find(a => a.status === 'coming');
      let text = '';
      if (waiting) text = `A train is waiting at the signal! Clear ${G.byId.get(waiting.track).name}.`;
      else if (next && !G.job) {
        const left = next.at + G.level.start - G.minute;
        if (left > 0 && left < 3) text = 'A train is coming in soon…';
      }
      if (!text) return;
      const y = 668 + Math.sin(time / 250) * 2;
      ctx.font = `700 12px ${FONT}`;
      const w = ctx.measureText(text).width + 22;
      path(ctx, 10, y - 28, w, 24, 12);
      ctx.fillStyle = waiting ? '#ffe0e0' : '#fff7d0';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      label(ctx, text, 21, y - 15.5, 12, INK, 'left', 700);
    }

    const traffic = [];
    let nextVehicle = 4;
    const carColors = ['#e5484d', '#4d96ff', '#ffd23f', '#3ccf7a', '#ff8a3d', '#8b5cf6'];

    function updateTraffic(dt) {
      nextVehicle -= dt;
      if (nextVehicle <= 0) {
        nextVehicle = 9 + Math.random() * 14;
        const bus = Math.random() < 0.35;
        const dir = Math.random() < 0.5 ? 1 : -1;
        traffic.push({
          bus,
          dir,
          d: dir > 0 ? -30 : ROAD_PATH.len + 30,
          speed: bus ? 38 : 55,
          color: bus ? '#e5484d' : carColors[Math.floor(Math.random() * carColors.length)]
        });
      }
      for (const v of traffic) v.d += v.dir * v.speed * dt;
      for (let i = traffic.length - 1; i >= 0; i--) {
        if (traffic[i].d < -40 || traffic[i].d > ROAD_PATH.len + 40) traffic.splice(i, 1);
      }
    }

    function drawTraffic() {
      for (const v of traffic) {
        const d = Math.max(0, Math.min(ROAD_PATH.len, v.d));
        const p = roadPoint(d);
        // Drive on the left: offset to the left of the direction of travel.
        const heading = p.angle + (v.dir < 0 ? Math.PI : 0);
        const L = v.bus ? 40 : 24;
        const Wd = v.bus ? 13 : 11;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(heading);
        ctx.translate(0, -5);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        ctx.fillRect(-L / 2 + 2, -Wd / 2 + 3, L, Wd);
        path(ctx, -L / 2, -Wd / 2, L, Wd, 3);
        ctx.fillStyle = v.color;
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.fillStyle = '#cfeaff';
        if (v.bus) {
          for (let x = -L / 2 + 5; x < L / 2 - 8; x += 8) ctx.fillRect(x, -Wd / 2 + 2, 5, Wd - 4);
          ctx.fillRect(L / 2 - 7, -Wd / 2 + 2, 4, Wd - 4);
        } else {
          ctx.fillRect(L / 2 - 9, -Wd / 2 + 2, 5, Wd - 4);
          ctx.fillRect(-L / 2 + 4, -Wd / 2 + 2, 3, Wd - 4);
        }
        ctx.restore();
      }
    }

    function draw(time, dt, ui) {
      particles.length && updateParticles(dt);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.drawImage(scenery, 0, 0, G.W, G.H);
      updateTraffic(dt);
      drawTraffic();
      // Trees stand in front of the road, so vehicles drive behind them.
      ctx.drawImage(treeLayer, 0, 0, G.W, G.H);

      for (const [i, c] of clouds.entries()) {
        const x = ((c[0] + time / (60 + i * 25)) % (G.W + 200)) - 100;
        cloud(x, c[1], c[2]);
      }
      updatePlane(time, dt);
      // Clouds (and planes) drift behind the station building, which has its own layer so it hides only what it covers.
      ctx.drawImage(stationLayer, 0, 0, G.W, G.H);
      windmill(time);
      stationClock();

      const poses = G.vehiclePoses();
      crowd(time, poses);
      alighting(time, poses);
      for (const track of G.tracks) {
        if (ui.targets.includes(track.id)) targetGlow(track, time);
        else if (ui.hoverTrack === track.id && !track.locked && ui.selected) {
          path(ctx, track.xMin - 6, track.y - 25, track.xMax - track.xMin + 18, 38, 12);
          ctx.strokeStyle = 'rgba(200,60,60,.7)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        if (track.kind !== 'shed' && track.kind !== 'pip') tab(track, time);
        if (track.locked) lockedOverlay(track);
      }
      signals();

      const sel = ui.selected;
      const selectedKeys = new Set();
      if (sel) for (let i = 0; i <= sel.idx; i++) selectedKeys.add(`${sel.track}:${i}`);
      const bounce = Math.sin(time / 160) * 3;
      for (const pose of poses) {
        const key = `${pose.track}:${pose.idx}`;
        const picked = selectedKeys.has(key);
        const hovered = ui.hoverCar && ui.hoverCar.track === pose.track && ui.hoverCar.idx >= pose.idx && !sel && !G.busy();
        const lift = picked ? -3 + bounce * 0.5 : 0;
        drawVehicle({ ...pose, y: pose.y + lift }, picked ? { glow: '#ffe14d' } : hovered ? { glow: 'rgba(255,255,255,.9)' } : null);
        if (G.needsService(pose.v) && !byShed(pose)) servicingBadge(pose, false);
        if ((pose.cut || pose.leaving) && pose.v.type === 'steam' && time - lastPuff > 120) puff(pose.x + 14, pose.y - 46, false);
        if (picked && pose.idx === sel.idx) {
          ctx.save();
          ctx.translate(pose.x, pose.y - 60 + bounce);
          ctx.beginPath();
          ctx.moveTo(-9, 0);
          ctx.lineTo(9, 0);
          ctx.lineTo(0, 12);
          ctx.closePath();
          ctx.fillStyle = '#ffe14d';
          ctx.fill();
          ctx.lineWidth = 2.2;
          ctx.strokeStyle = INK;
          ctx.stroke();
          ctx.restore();
          label(ctx, `${sel.idx + 1} ${sel.idx ? 'vehicles' : 'vehicle'}`, pose.x, pose.y - 72 + bounce, 12, INK, 'center', 700);
        }
      }
      if (time - lastPuff > 120) lastPuff = time;

      for (const track of G.tracks) if (track.kind === 'shed') tab(track, time);
      derailBadges(time);
      // Servicing progress badges go on top of the shed labels so they can always be seen.
      for (const pose of poses) if (byShed(pose) && G.needsService(pose.v)) servicingBadge(pose, true);

      // The shunting engine.
      const pilot = G.pilotPose();
      ctx.save();
      ctx.translate(pilot.x, pilot.y);
      let pilotFlip = pilot.flip;
      if (Math.cos(pilot.a) < 0) {
        ctx.rotate(pilot.a + Math.PI);
        pilotFlip = !pilotFlip;
      } else ctx.rotate(pilot.a);
      ctx.translate(0, -13);
      if (pilotFlip) ctx.scale(-1, 1);
      if (pilot.work && pilot.moving) ctx.translate(0, Math.sin(time / 45) * 0.8);
      drawPilot(ctx, time);
      ctx.restore();
      if (ui.hoverPilot && pilot.parked) {
        const y = pilot.y - 62;
        ctx.font = `700 12px ${FONT}`;
        const w = ctx.measureText('Send Pip home').width + 20;
        path(ctx, pilot.x - w / 2, y - 12, w, 24, 12);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = INK;
        ctx.stroke();
        label(ctx, 'Send Pip home', pilot.x, y + 0.5, 12, INK, 'center', 700);
      }
      if (pilot.work && pilot.moving && Math.random() < dt * 9) puff(pilot.x + (pilot.flip ? -14 : 14), pilot.y - 52, true);
      if (!pilot.work && Math.random() < dt * 0.7) puff(pilot.x + 14, pilot.y - 52, false);

      boardingBars(time);
      arrivalHint(time);
      drawParticles();
    }

    function icon(typeName) {
      if (iconCache.has(typeName)) return iconCache.get(typeName);
      const c = document.createElement('canvas');
      c.width = 84;
      c.height = 60;
      const x = c.getContext('2d');
      x.translate(42, 40);
      x.scale(1.45, 1.45);
      if (typeName === 'loco') {
        // "Any engine": a steam engine and a diesel engine, split down the middle.
        x.save();
        x.beginPath();
        x.rect(-30, -40, 30, 80);
        x.clip();
        drawVehicleBody(x, 'steam');
        x.restore();
        x.save();
        x.beginPath();
        x.rect(0, -40, 40, 80);
        x.clip();
        drawVehicleBody(x, 'diesel');
        x.restore();
        x.strokeStyle = '#fff';
        x.lineWidth = 2;
        x.beginPath();
        x.moveTo(0, -30);
        x.lineTo(0, 18);
        x.stroke();
      } else {
        drawVehicleBody(x, typeName);
      }
      const url = c.toDataURL();
      iconCache.set(typeName, url);
      return url;
    }

    function toLogical(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return { x: ((clientX - rect.left) / rect.width) * G.W, y: ((clientY - rect.top) / rect.height) * G.H };
    }

    return {
      resize,
      draw,
      icon,
      burst,
      toLogical,
      setGame(next) {
        G = next;
        particles.length = 0;
        buildScenery();
      }
    };
  };
})();
