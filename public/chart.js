/**
 * drawDistillation(points)
 * points: Array of [label, temp]  e.g. [["IBP", 182], ["5%", 195], ...]
 * Labels are evenly spaced on the x-axis (like the reference COA report).
 */
function drawDistillation(points) {
  const canvas = document.getElementById('distChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const cssW = canvas.clientWidth  || 700;
  const cssH = canvas.clientHeight || 260;
  const dpr  = window.devicePixelRatio || 1;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = cssW, h = cssH;

  // Exclude non-distillation entries (Recovery %)
  const pts = points.filter(([lbl]) => lbl !== 'Recovery %');
  const n   = pts.length;

  // Build data: keep track of original index for x-position
  const data = [];
  for (let i = 0; i < n; i++) {
    const t = pts[i][1];
    if (t !== null && t !== undefined && Number.isFinite(Number(t))) {
      data.push({ xi: i, y: Number(t) });
    }
  }

  ctx.clearRect(0, 0, w, h);
  if (data.length < 2) return;

  const pad = { l: 50, r: 15, t: 15, b: 52 };
  const pw  = w - pad.l - pad.r;
  const ph  = h - pad.t - pad.b;

  const ys      = data.map(d => d.y);
  const rawYmin = Math.min(...ys);
  const rawYmax = Math.max(...ys);
  const yStep   = Math.ceil((rawYmax - rawYmin) / 6 / 10) * 10 || 10;
  const ymin    = Math.floor(rawYmin / yStep) * yStep;
  const ymax    = Math.ceil(rawYmax  / yStep) * yStep + yStep;

  const xOf = i => pad.l + (n > 1 ? i / (n - 1) : 0) * pw;
  const yOf = v => pad.t + ph - ((v - ymin) / (ymax - ymin)) * ph;

  // Axes
  ctx.strokeStyle = '#444';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + ph);
  ctx.lineTo(pad.l + pw, pad.t + ph);
  ctx.stroke();

  ctx.font = '10px system-ui, sans-serif';

  // Y ticks
  for (let yv = ymin; yv <= ymax + 0.01; yv += yStep) {
    const y = yOf(yv);
    ctx.strokeStyle = '#e6e6e6';
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + pw, y);
    ctx.stroke();
    ctx.fillStyle = '#444';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.round(yv)), pad.l - 4, y + 4);
  }

  // X labels (evenly spaced, all distillation labels)
  for (let i = 0; i < n; i++) {
    const x = xOf(i);
    ctx.strokeStyle = '#e6e6e6';
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + ph);
    ctx.stroke();
    ctx.fillStyle = '#444';
    ctx.textAlign = 'center';
    ctx.fillText(String(pts[i][0]), x, pad.t + ph + 16);
  }

  // Y axis label
  ctx.save();
  ctx.translate(12, pad.t + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#444';
  ctx.fillText('Temperature (\u00b0C)', 0, 0);
  ctx.restore();

  // Line
  ctx.strokeStyle = '#1a6fc4';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = xOf(d.xi), y = yOf(d.y);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points
  ctx.fillStyle = '#1a6fc4';
  for (const d of data) {
    ctx.beginPath();
    ctx.arc(xOf(d.xi), yOf(d.y), 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * drawParamGauge(canvasId, value, dotColor)
 * Draws a vertical dot gauge showing a single measured value on a scale.
 */
function drawParamGauge(canvasId, value, dotColor) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const v = parseFloat(value);
  if (!Number.isFinite(v)) return;

  const ctx  = canvas.getContext('2d');
  const cssW = canvas.clientWidth  || 200;
  const cssH = canvas.clientHeight || 130;
  const dpr  = window.devicePixelRatio || 1;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = cssW, h = cssH;
  const pad = { l: 36, r: 8, t: 8, b: 8 };
  const pw  = w - pad.l - pad.r;
  const ph  = h - pad.t - pad.b;

  // Pick a nice step and max
  let step;
  if      (v >= 50) step = 10;
  else if (v >= 10) step = 5;
  else if (v >= 2)  step = 0.5;
  else              step = 0.1;
  const ymax     = Math.ceil(v * 1.2 / step) * step;
  const numTicks = Math.round(ymax / step);

  ctx.clearRect(0, 0, w, h);
  ctx.font = '10px system-ui, sans-serif';

  // Gridlines + y-axis labels
  for (let i = 0; i <= numTicks; i++) {
    const yv = i * step;
    const y  = pad.t + ph - (yv / ymax) * ph;
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth   = 0.5;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + pw, y);
    ctx.stroke();
    const lbl = step < 1 ? yv.toFixed(2) : String(Math.round(yv));
    ctx.fillStyle = '#666';
    ctx.textAlign = 'right';
    ctx.fillText(lbl, pad.l - 3, y + 3.5);
  }

  // Axes
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, pad.t + ph);
  ctx.lineTo(pad.l + pw, pad.t + ph);
  ctx.stroke();

  // Dot at the measured value
  const dotX = pad.l + pw / 2;
  const dotY = pad.t + ph - (v / ymax) * ph;
  ctx.fillStyle = dotColor || '#1a6fc4';
  ctx.beginPath();
  ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
  ctx.fill();
}
