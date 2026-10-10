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
      windows(ctx, 4, -18, -9, 8, 8);
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

  function drawEngine(ctx, color, trim, kind) {
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
      smile(ctx, 10, -6, 8);
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
    smile(ctx, 13, -4, 6);
    wheel(ctx, -13, 9, 8);
    wheel(ctx, 4, 11, 6);
    wheel(ctx, 17, 11, 6);
  }

  function drawVehicleBody(ctx, type) {
    const t = Y.TYPES[type];
    if (t.kind === 'loco') drawEngine(ctx, t.color, t.trim, type);
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

  function drawTrackBed(ctx, track, pointAt) {
    const samples = [];
    const start = -270;
    for (let u = start; u < track.uEnd + 60; u += 5) samples.push(pointAt(track, u));
    // Ballast.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    samples.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = '#bba98a';
    ctx.lineWidth = 26;
    ctx.stroke();
    ctx.strokeStyle = '#cdbf9f';
    ctx.lineWidth = 20;
    ctx.stroke();
    // Sleepers.
    ctx.strokeStyle = '#8a5a36';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'butt';
    for (let u = start; u < track.uEnd + 40; u += 13) {
      const p = pointAt(track, u);
      const nx = -Math.sin(p.a) * 10;
      const ny = Math.cos(p.a) * 10;
      ctx.beginPath();
      ctx.moveTo(p.x - nx, p.y - ny);
      ctx.lineTo(p.x + nx, p.y + ny);
      ctx.stroke();
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

  function drawScenery(ctx, game) {
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
    ctx.moveTo(-10, 560);
    ctx.bezierCurveTo(60, 520, 40, 400, 130, 360);
    ctx.bezierCurveTo(210, 320, 150, 240, 210, 180);
    ctx.stroke();
    ctx.setLineDash([10, 12]);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    // Pond.
    ctx.fillStyle = '#7cc8f2';
    ctx.beginPath();
    ctx.ellipse(70, 610, 52, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(55, 606, 10, 3.4, 5.4);
    ctx.stroke();
    // Houses and trees.
    const houses = [[28, 440, 44, 30, '#ffe3a3', '#e5484d'], [150, 470, 40, 28, '#ffc2d1', '#5b6ee1'], [70, 228, 46, 32, '#cfeaff', '#e5484d'], [150, 320, 42, 30, '#d9f5c3', '#8b5cf6']];
    for (const [x, y, w, h, wall, roof] of houses) {
      house(ctx, x, y, w, h, wall, roof);
      spots.push([x + w / 2, y, 34]);
    }
    let tries = 0;
    while (spots.length < 24 && tries++ < 400) {
      const x = 20 + rand() * 210;
      const y = 150 + rand() * 480;
      if (free(x, y, 18) && !(x < 125 && y > 570)) {
        tree(ctx, x, y, 0.8 + rand() * 0.5, ['#4fb04f', '#5cc05c', '#3fa05a'][Math.floor(rand() * 3)]);
        spots.push([x, y, 18]);
      }
    }
    for (let i = 0; i < 40; i++) {
      const x = 10 + rand() * 230;
      const y = 140 + rand() * 520;
      if (x < leftLimit(y) - 10) {
        circle(ctx, x, y, 2.2, ['#fff', '#ffd93d', '#ff8fab'][i % 3]);
      }
    }

    // Station building behind platform 1.
    ctx.fillStyle = '#e7dec6';
    ctx.fillRect(400, 112, 700, 18);
    box(ctx, 440, 44, 620, 72, 4, '#d9694f');
    ctx.strokeStyle = 'rgba(0,0,0,.12)';
    ctx.lineWidth = 1;
    for (let y = 52; y < 116; y += 8) {
      ctx.beginPath();
      ctx.moveTo(441, y);
      ctx.lineTo(1059, y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(430, 48);
    ctx.lineTo(1070, 48);
    ctx.lineTo(1050, 24);
    ctx.lineTo(450, 24);
    ctx.closePath();
    ctx.fillStyle = '#5a4b8f';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    for (let x = 460; x < 1040; x += 22) ctx.fillRect(x, 28, 10, 16);
    for (let i = 0; i < 5; i++) {
      const x = 470 + i * 96 + (i > 2 ? 90 : 0);
      box(ctx, x, 62, 34, 38, 15, '#cfeaff', 2);
      ctx.beginPath();
      ctx.moveTo(x + 17, 62);
      ctx.lineTo(x + 17, 100);
      ctx.moveTo(x, 82);
      ctx.lineTo(x + 34, 82);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    box(ctx, 585, 56, 130, 30, 8, '#fff7e0', 2.5);
    label(ctx, 'PEBBLEBROOK', 650, 71, 17, INK, 'center', 700);
    box(ctx, 770, 78, 54, 38, 24, '#8a5a36', 2.5);

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
    for (const track of game.tracks) drawTrackBed(ctx, track, game.pointAt);
    for (const track of game.tracks) {
      if (!track.through) bufferStop(ctx, track.xEnd + 2, track.y);
    }

    // Island platform.
    box(ctx, 452, 168, 628, 50, 8, '#e8dfc6');
    ctx.fillStyle = '#ffd93d';
    ctx.fillRect(458, 170, 616, 3);
    ctx.fillRect(458, 213, 616, 3);
    for (const x of [500, 660, 820, 980]) {
      ctx.fillStyle = INK;
      ctx.fillRect(x - 1.5, 168, 3, 44);
      circle(ctx, x, 168, 5, '#fff7a8', 1.8);
    }
    for (const x of [560, 900]) {
      box(ctx, x - 16, 190, 32, 6, 2, '#8a5a36', 1.8);
      ctx.fillStyle = INK;
      ctx.fillRect(x - 13, 196, 3, 6);
      ctx.fillRect(x + 10, 196, 3, 6);
    }
    for (const [n, y] of [[1, 183], [2, 203]]) {
      circle(ctx, 478, y, 8, '#4d96ff', 1.8);
      label(ctx, String(n), 478, y + 0.5, 11, '#fff', 'center', 700);
    }

    // Engine shed.
    box(ctx, 892, 534, 170, 60, 4, '#d9694f');
    ctx.beginPath();
    ctx.moveTo(884, 538);
    ctx.lineTo(1070, 538);
    ctx.lineTo(1050, 514);
    ctx.lineTo(904, 514);
    ctx.closePath();
    ctx.fillStyle = '#5a4b8f';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    box(ctx, 912, 546, 52, 48, 24, '#3a3d63');
    circle(ctx, 988, 558, 6, '#fff7a8', 1.5);
    label(ctx, 'ENGINE SHED', 1010, 575, 10, '#fff5d8', 'center', 700);

    // Signal box near the lead.
    box(ctx, 28, 640, 44, 34, 3, '#fff0c9');
    box(ctx, 22, 616, 56, 28, 3, '#6b8cff');
    box(ctx, 30, 622, 14, 16, 2, '#d9f1ff', 1.5);
    box(ctx, 56, 622, 14, 16, 2, '#d9f1ff', 1.5);
    box(ctx, 48, 655, 14, 19, 2, '#8a5a36', 1.5);
    label(ctx, 'SIGNAL BOX', 50, 606, 9, INK, 'center', 700);

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
      drawScenery(c, G);
    }

    function cloud(x, y, s) {
      ctx.fillStyle = '#fff';
      for (const [dx, dy, r] of [[0, 0, 18], [20, -8, 22], [44, 0, 18], [22, 6, 20]]) {
        ctx.beginPath();
        ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function windmill(time) {
      const x = 70;
      const y = 330;
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
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        box(ctx, -3, -42, 10, 40, 2, '#fff', 1.8);
        ctx.restore();
      }
      circle(ctx, 0, 0, 5, '#e5484d', 2);
      ctx.restore();
    }

    function stationClock() {
      const cx = 797;
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

    function drawVehicle(pose, extra) {
      ctx.save();
      ctx.translate(pose.x, pose.y);
      ctx.rotate(pose.a);
      ctx.translate(0, -17);
      if (extra && extra.glow) {
        path(ctx, -30, -33, 60, 56, 10);
        ctx.lineWidth = 4;
        ctx.strokeStyle = extra.glow;
        ctx.stroke();
      }
      drawVehicleBody(ctx, pose.v.type);
      ctx.restore();
    }

    function tab(track, time) {
      const dep = G.activeDeparture(track.id);
      const title = `${track.name}  ${track.cars.length}/${track.cap}`;
      const x = track.straightX + 8;
      const y = track.y - 33;
      const lines = [{ text: title, size: 11, color: track.locked ? '#dfe6f2' : INK }];
      if (dep) {
        const m = Math.round(dep.at + G.level.start);
        lines.push({ text: `${dep.name}  ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, size: 10, color: '#d9486a' });
        const note = G.formationHint(dep, track);
        if (note) lines.push({ text: note, size: 10, color: note === 'Perfect!' ? '#1f9d5b' : '#b5651d' });
      }
      let w = 0;
      for (const line of lines) {
        ctx.font = `700 ${line.size}px ${FONT}`;
        w = Math.max(w, ctx.measureText(line.text).width + 14);
      }
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

    function lockedOverlay(track) {
      // Keep the closed-track marking clear of the engine shed building.
      const xEnd = track.y > 470 && track.y < 600 ? Math.min(track.xEnd, 876) : track.xEnd;
      ctx.save();
      path(ctx, track.straightX - 4, track.y - 16, xEnd - track.straightX + 14, 32, 8);
      ctx.clip();
      ctx.fillStyle = 'rgba(70,80,100,.45)';
      ctx.fillRect(track.straightX - 4, track.y - 16, xEnd - track.straightX + 14, 32);
      ctx.strokeStyle = 'rgba(255,214,64,.8)';
      ctx.lineWidth = 6;
      for (let x = track.straightX - 40; x < xEnd + 20; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, track.y + 18);
        ctx.lineTo(x + 30, track.y - 18);
        ctx.stroke();
      }
      ctx.restore();
      for (const x of [track.straightX + 24, xEnd - 24]) {
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
      label(ctx, 'Closed today', (track.straightX + xEnd) / 2, track.y, 13, '#fff', 'center', 700);
    }

    function targetGlow(track, time) {
      const pulse = 0.5 + 0.5 * Math.sin(time / 220);
      path(ctx, track.straightX - 6, track.y - 25, track.xEnd - track.straightX + 18, 38, 12);
      ctx.fillStyle = `rgba(255,255,255,${0.16 + pulse * 0.16})`;
      ctx.fill();
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = -time / 40;
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(32,160,90,${0.7 + pulse * 0.3})`;
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrow showing where the cars will be placed.
      const x = track.xEnd - (track.cars.length + 0.5) * G.SP;
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

    function signals() {
      for (const track of G.tracks) {
        if (!track.through) continue;
        const dep = G.activeDeparture(track.id);
        const go = dep && dep.status === 'ready';
        const x = track.xEnd + 38;
        const y = track.y - 4;
        ctx.fillStyle = INK;
        ctx.fillRect(x - 1.5, y - 30, 3, 36);
        box(ctx, x - 6, y - 40, 12, 20, 5, '#39435c', 2);
        circle(ctx, x, y - 34, 3.6, go ? '#3a4a3a' : '#ff5d5d');
        circle(ctx, x, y - 25, 3.6, go ? '#5dff8a' : '#4a3a3a');
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
          const wx = 420 + rand() * 600;
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
      if (waiting) text = 'A train is waiting! Clear some space on the Reception road.';
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

    function draw(time, dt, ui) {
      particles.length && updateParticles(dt);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.drawImage(scenery, 0, 0, G.W, G.H);

      for (const [i, c] of clouds.entries()) {
        const x = ((c[0] + time / (60 + i * 25)) % (G.W + 200)) - 100;
        cloud(x, c[1], c[2]);
      }
      // Clouds drift behind the station building.
      ctx.drawImage(scenery, 425 * scale, 18 * scale, 650 * scale, 104 * scale, 425, 18, 650, 104);
      windmill(time);
      stationClock();

      const poses = G.vehiclePoses();
      crowd(time, poses);
      for (const track of G.tracks) {
        if (ui.targets.includes(track.id)) targetGlow(track, time);
        else if (ui.hoverTrack === track.id && !track.locked && ui.selected) {
          path(ctx, track.straightX - 6, track.y - 25, track.xEnd - track.straightX + 18, 38, 12);
          ctx.strokeStyle = 'rgba(200,60,60,.7)';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        tab(track, time);
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

      // The shunting engine.
      const pilot = G.pilotPose();
      ctx.save();
      ctx.translate(pilot.x, pilot.y);
      ctx.rotate(pilot.a);
      ctx.translate(0, -17);
      if (pilot.flip) ctx.scale(-1, 1);
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
