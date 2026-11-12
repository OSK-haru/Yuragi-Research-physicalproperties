/* Minimal canvas plotting: line charts, bar charts and heat maps. */
(function (YR) {
  'use strict';

  function prepare(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    const h = canvas.clientHeight || 240;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  function theme() {
    const v = YR.ui.cssVar;
    return {
      text: v('--text-2'), faint: v('--text-3'), line: v('--line'), line2: v('--line-2'),
      mono: '11px ' + (v('--mono') || 'monospace'), monoFamily: v('--mono') || 'monospace', sans: '11.5px ' + (v('--sans') || 'sans-serif'),
      series: [v('--s1'), v('--s2'), v('--s3'), v('--s4'), v('--s5')], accent: v('--accent')
    };
  }
  function color(c, th, i) {
    if (!c) return th.series[i % th.series.length];
    if (c === 'accent') return th.accent;
    if (/^s[1-5]$/.test(c)) return th.series[+c[1] - 1];
    return c;
  }

  function niceTicks(lo, hi, count) {
    if (!(hi > lo)) { hi = lo + 1; }
    const raw = (hi - lo) / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const ticks = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return { ticks, step };
  }
  function tickLabel(v, step) {
    if (v === 0) return '0';
    const a = Math.abs(v);
    if (a >= 1e5 || a < 1e-3) return v.toExponential(0).replace('e+', 'e');
    const d = Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9)));
    return v.toFixed(d);
  }
  function logTicks(lo, hi) {
    const t = [];
    for (let e = Math.ceil(lo - 1e-9); e <= Math.floor(hi + 1e-9); e++) t.push(e);
    return t;
  }
  /** Draw 10^e right-aligned at (x, y) with the exponent raised. */
  function drawPower(ctx, e, x, y, th) {
    const exp = String(e).replace('-', '−');
    ctx.save();
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = '9.5px ' + th.monoFamily;
    const wExp = ctx.measureText(exp).width;
    ctx.fillText(exp, x, y - 5);
    ctx.font = th.mono;
    ctx.fillText('10', x - wExp - 1, y);
    ctx.restore();
  }

  /** Line chart.
   *  o: { series: [{ x, y, color, dash, width, label }], xLabel, yLabel, yLog, xRange, yRange,
   *       vlines: [{ x, label, color }], hlines: [{ y, label }], points: [{ x, y, color }] } */
  function line(canvas, o) {
    const { ctx, w, h } = prepare(canvas);
    const th = theme();
    const m = { l: 54, r: 14, t: 12, b: 36 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const ty = (v) => (o.yLog ? Math.log10(Math.max(v, 1e-300)) : v);

    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of o.series) {
      for (let i = 0; i < s.x.length; i++) {
        const yv = s.y[i];
        if (!isFinite(yv) || (o.yLog && yv <= 0)) continue;
        if (s.x[i] < x0) x0 = s.x[i];
        if (s.x[i] > x1) x1 = s.x[i];
        const t = ty(yv);
        if (t < y0) y0 = t;
        if (t > y1) y1 = t;
      }
    }
    if (o.xRange) { x0 = o.xRange[0]; x1 = o.xRange[1]; }
    if (o.yRange) { y0 = ty(o.yRange[0]); y1 = ty(o.yRange[1]); }
    else if (o.yLog) { y0 = Math.floor(y0 - 1e-9); y1 = Math.ceil(y1 + 1e-9); if (y1 === y0) y1 = y0 + 1; }
    else { const pad = (y1 - y0) * 0.06 || Math.abs(y1) * 0.1 || 1; y0 -= pad; y1 += pad; }
    if (!isFinite(x0) || !isFinite(y0)) { x0 = 0; x1 = 1; y0 = 0; y1 = 1; }

    const X = (v) => m.l + (v - x0) / (x1 - x0) * pw;
    const Y = (v) => m.t + ph - (ty(v) - y0) / (y1 - y0) * ph;

    ctx.font = th.mono;
    ctx.lineWidth = 1;
    // grid + ticks
    const xt = niceTicks(x0, x1, Math.max(3, Math.floor(pw / 80)));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const v of xt.ticks) {
      const px = Math.round(X(v)) + 0.5;
      ctx.strokeStyle = th.line; ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke();
      ctx.fillStyle = th.faint; ctx.fillText(tickLabel(v, xt.step), px, m.t + ph + 6);
    }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    if (o.yLog) {
      for (const e of logTicks(y0, y1)) {
        const py = Math.round(m.t + ph - (e - y0) / (y1 - y0) * ph) + 0.5;
        ctx.strokeStyle = th.line; ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l + pw, py); ctx.stroke();
        ctx.fillStyle = th.faint; drawPower(ctx, e, m.l - 7, py, th);
      }
    } else {
      const yt = niceTicks(y0, y1, Math.max(3, Math.floor(ph / 44)));
      for (const v of yt.ticks) {
        const py = Math.round(m.t + ph - (v - y0) / (y1 - y0) * ph) + 0.5;
        ctx.strokeStyle = th.line; ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l + pw, py); ctx.stroke();
        ctx.fillStyle = th.faint; ctx.fillText(tickLabel(v, yt.step), m.l - 7, py);
      }
    }
    ctx.strokeStyle = th.line2; ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw, ph);

    // axis labels
    ctx.font = th.sans; ctx.fillStyle = th.text;
    if (o.xLabel) { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(o.xLabel, m.l + pw / 2, h - 3); }
    if (o.yLabel) {
      ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.yLabel, 0, 0); ctx.restore();
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
    for (const hl of o.hlines || []) {
      const py = Y(hl.y);
      ctx.strokeStyle = th.faint; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l + pw, py); ctx.stroke(); ctx.setLineDash([]);
      if (hl.label) { ctx.font = th.mono; ctx.fillStyle = th.faint; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(hl.label, m.l + pw - 6, py - 3); }
    }
    for (const vl of o.vlines || []) {
      const px = X(vl.x);
      ctx.strokeStyle = color(vl.color, th, 0) || th.faint; ctx.globalAlpha = 0.7; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      if (vl.label) {
        ctx.font = th.mono; ctx.fillStyle = th.text; ctx.textBaseline = 'top';
        const right = px < m.l + pw * 0.7;
        ctx.textAlign = right ? 'left' : 'right';
        ctx.fillText(vl.label, px + (right ? 5 : -5), m.t + 5);
      }
    }
    o.series.forEach((s, idx) => {
      ctx.strokeStyle = color(s.color, th, idx);
      ctx.lineWidth = s.width || 1.8;
      ctx.setLineDash(s.dash || []);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let pen = false;
      for (let i = 0; i < s.x.length; i++) {
        const yv = s.y[i];
        if (!isFinite(yv) || (o.yLog && yv <= 0)) { pen = false; continue; }
        const px = X(s.x[i]), py = Y(yv);
        if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);
    for (const p of o.points || []) {
      if (!isFinite(p.y) || (o.yLog && p.y <= 0)) continue;
      ctx.fillStyle = color(p.color, th, 0);
      ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0a0d12'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  }

  /** Grouped bar chart.
   *  o: { labels, groups: [{ values, color, label }], yLabel, yMax, highlight (index), rotate } */
  function bars(canvas, o) {
    const { ctx, w, h } = prepare(canvas);
    const th = theme();
    const m = { l: 54, r: 10, t: 12, b: o.rotate ? 70 : 34 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    let max = o.yMax || 0;
    if (!o.yMax) for (const g of o.groups) for (const v of g.values) if (v > max) max = v;
    if (max <= 0) max = 1;
    const yt = niceTicks(0, max * 1.05, Math.max(3, Math.floor(ph / 44)));
    const top = Math.max(max * 1.05, yt.ticks[yt.ticks.length - 1]);
    ctx.font = th.mono; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (const v of yt.ticks) {
      const py = Math.round(m.t + ph - v / top * ph) + 0.5;
      ctx.strokeStyle = th.line; ctx.beginPath(); ctx.moveTo(m.l, py); ctx.lineTo(m.l + pw, py); ctx.stroke();
      ctx.fillStyle = th.faint; ctx.fillText(tickLabel(v, yt.step), m.l - 7, py);
    }
    const n = o.labels.length;
    const slot = pw / n;
    const gw = Math.min(slot * 0.78, 64 * o.groups.length);
    const bw = gw / o.groups.length;
    for (let i = 0; i < n; i++) {
      const xs = m.l + slot * i + (slot - gw) / 2;
      o.groups.forEach((g, gi) => {
        const v = g.values[i];
        const bh = Math.max(0, v / top * ph);
        ctx.fillStyle = color(g.color, th, gi);
        ctx.globalAlpha = (o.highlight === undefined || o.highlight === i) ? 1 : 0.38;
        ctx.fillRect(xs + bw * gi + 1, m.t + ph - bh, Math.max(1, bw - 2), bh);
        ctx.globalAlpha = 1;
      });
      ctx.fillStyle = o.highlight === i ? YR.ui.cssVar('--text') : th.faint;
      ctx.font = th.mono;
      if (o.rotate) {
        ctx.save(); ctx.translate(m.l + slot * i + slot / 2, m.t + ph + 8); ctx.rotate(-Math.PI / 4);
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(o.labels[i], 0, 0); ctx.restore();
      } else if (slot > 16 || i % Math.ceil(16 / slot) === 0) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(o.labels[i], m.l + slot * i + slot / 2, m.t + ph + 6);
      }
    }
    ctx.strokeStyle = th.line2; ctx.beginPath(); ctx.moveTo(m.l, m.t + ph + 0.5); ctx.lineTo(m.l + pw, m.t + ph + 0.5); ctx.stroke();
    if (o.yLabel) {
      ctx.font = th.sans; ctx.fillStyle = th.text;
      ctx.save(); ctx.translate(12, m.t + ph / 2); ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.yLabel, 0, 0); ctx.restore();
    }
  }

  // colour maps: t in [0, 1] -> [r, g, b]
  const MAPS = {
    ice: [[8, 11, 15], [14, 44, 74], [28, 110, 150], [92, 200, 242], [235, 250, 255]],
    ember: [[8, 11, 15], [70, 22, 30], [170, 62, 30], [242, 178, 92], [255, 250, 225]]
  };
  function mapColor(name, t) {
    const stops = MAPS[name] || MAPS.ice;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const f = t * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(f));
    const u = f - i;
    const a = stops[i], b = stops[i + 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
  }

  /** Paint a scalar field into an offscreen image and return it.
   *  value(ix, iy) must return a number in [0, 1]. */
  function heatImage(nx, ny, map, value) {
    const off = document.createElement('canvas');
    off.width = nx; off.height = ny;
    const c = off.getContext('2d');
    const img = c.createImageData(nx, ny);
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const rgb = mapColor(map, value(x, y));
        const k = (y * nx + x) * 4;
        img.data[k] = rgb[0]; img.data[k + 1] = rgb[1]; img.data[k + 2] = rgb[2]; img.data[k + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    return off;
  }

  function legend(items) {
    return '<div class="legend">' + items.map((it) =>
      '<span><i style="background:var(--' + it.color + ')' + (it.dash ? ';background:repeating-linear-gradient(90deg,var(--' + it.color + ') 0 4px,transparent 4px 7px)' : '') + '"></i>' + YR.fmt.esc(it.label) + '</span>').join('') + '</div>';
  }

  YR.plot = { prepare, theme, line, bars, heatImage, mapColor, legend, niceTicks };
})(globalThis.YR = globalThis.YR || {});
