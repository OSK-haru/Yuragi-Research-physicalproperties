/* Pulse-level dynamics of a driven transmon: three-level Duffing oscillator in the frame
   rotating at the drive frequency, Lindblad master equation, fixed-step RK4.
   Times in ns, frequencies in GHz. */
(function (YR) {
  'use strict';

  const D = 3;
  const TWO_PI = 2 * Math.PI;

  function zeros() { return { re: new Float64Array(D * D), im: new Float64Array(D * D) }; }

  /** out = a * b */
  function mul(a, b, out) {
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        let r = 0, m = 0;
        for (let k = 0; k < D; k++) {
          const ar = a.re[i * D + k], ai = a.im[i * D + k];
          const br = b.re[k * D + j], bi = b.im[k * D + j];
          r += ar * br - ai * bi;
          m += ar * bi + ai * br;
        }
        out.re[i * D + j] = r; out.im[i * D + j] = m;
      }
    }
    return out;
  }

  /** Gaussian envelope that starts and ends at zero, with unit area. Returns { value, slope }. */
  function makeEnvelope(duration) {
    const sigma = duration / 4;
    const base = Math.exp(-(duration / 2) * (duration / 2) / (2 * sigma * sigma));
    const steps = 2000;
    let area = 0;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) * duration / steps;
      area += (Math.exp(-(t - duration / 2) * (t - duration / 2) / (2 * sigma * sigma)) - base) * duration / steps;
    }
    return function (t) {
      if (t < 0 || t > duration) return { value: 0, slope: 0 };
      const g = Math.exp(-(t - duration / 2) * (t - duration / 2) / (2 * sigma * sigma));
      return { value: (g - base) / area, slope: (-(t - duration / 2) / (sigma * sigma)) * g / area };
    };
  }

  /** Simulate one pulse.
   *  p: { alpha [GHz], detuning [GHz], duration [ns], angle [rad], beta (DRAG weight),
   *       t1 [ns], tphi [ns], steps }
   *  Returns the populations over time and the final state. */
  function simulatePulse(p) {
    const steps = p.steps || 1200;
    const dt = p.duration / steps;
    const alpha = TWO_PI * p.alpha;
    const delta = TWO_PI * (p.detuning || 0);
    const env = makeEnvelope(p.duration);
    const g1 = isFinite(p.t1) && p.t1 > 0 ? 1 / p.t1 : 0;
    const gphi = isFinite(p.tphi) && p.tphi > 0 ? 1 / p.tphi : 0;
    const r2 = Math.SQRT2;

    let rho = zeros();
    rho.re[0] = 1;
    const H = zeros();
    const t1 = zeros(), t2 = zeros();

    function derivative(t, r, out) {
      const e = env(t);
      const oi = p.angle * e.value;                                   // in-phase Rabi rate [rad/ns]
      const oq = alpha !== 0 ? -p.beta * p.angle * e.slope / alpha : 0; // quadrature (DRAG)
      H.re.fill(0); H.im.fill(0);
      H.re[1 * D + 1] = delta;
      H.re[2 * D + 2] = 2 * delta + alpha;
      // (oi/2)(a + a^dag) + (oq/2) i (a^dag - a),  a = |0><1| + sqrt2 |1><2|
      H.re[0 * D + 1] = oi / 2;        H.im[0 * D + 1] = -oq / 2;
      H.re[1 * D + 0] = oi / 2;        H.im[1 * D + 0] = oq / 2;
      H.re[1 * D + 2] = r2 * oi / 2;   H.im[1 * D + 2] = -r2 * oq / 2;
      H.re[2 * D + 1] = r2 * oi / 2;   H.im[2 * D + 1] = r2 * oq / 2;
      mul(H, r, t1); mul(r, H, t2);
      for (let k = 0; k < D * D; k++) {
        // -i (H r - r H)
        out.re[k] = t1.im[k] - t2.im[k];
        out.im[k] = -(t1.re[k] - t2.re[k]);
      }
      if (g1 > 0) {
        // D[a] rho with a = |0><1| + sqrt2 |1><2|
        for (let i = 0; i < D; i++) {
          for (let j = 0; j < D; j++) {
            const k = i * D + j;
            let gr = 0, gi = 0;
            if (i + 1 < D && j + 1 < D) {
              const f = Math.sqrt((i + 1) * (j + 1));
              gr += f * r.re[(i + 1) * D + (j + 1)];
              gi += f * r.im[(i + 1) * D + (j + 1)];
            }
            const loss = (i + j) / 2;
            out.re[k] += g1 * (gr - loss * r.re[k]);
            out.im[k] += g1 * (gi - loss * r.im[k]);
          }
        }
      }
      if (gphi > 0) {
        // D[sqrt(2 gphi) n] rho: coherence between i and j decays at gphi (i - j)^2
        for (let i = 0; i < D; i++) {
          for (let j = 0; j < D; j++) {
            const k = i * D + j, d = (i - j) * (i - j);
            out.re[k] -= gphi * d * r.re[k];
            out.im[k] -= gphi * d * r.im[k];
          }
        }
      }
      return out;
    }

    const k1 = zeros(), k2 = zeros(), k3 = zeros(), k4 = zeros(), tmp = zeros();
    const stride = Math.max(1, Math.floor(steps / 300));
    const time = [], p0 = [], p1 = [], p2 = [], inPhase = [], quad = [];
    function record(t) {
      time.push(t); p0.push(rho.re[0]); p1.push(rho.re[4]); p2.push(rho.re[8]);
      const e = env(Math.min(t, p.duration));
      inPhase.push(p.angle * e.value / TWO_PI * 1000);
      quad.push(alpha !== 0 ? -p.beta * p.angle * e.slope / alpha / TWO_PI * 1000 : 0);
    }
    record(0);
    for (let s = 0; s < steps; s++) {
      const t = s * dt;
      derivative(t, rho, k1);
      for (let k = 0; k < 9; k++) { tmp.re[k] = rho.re[k] + 0.5 * dt * k1.re[k]; tmp.im[k] = rho.im[k] + 0.5 * dt * k1.im[k]; }
      derivative(t + dt / 2, tmp, k2);
      for (let k = 0; k < 9; k++) { tmp.re[k] = rho.re[k] + 0.5 * dt * k2.re[k]; tmp.im[k] = rho.im[k] + 0.5 * dt * k2.im[k]; }
      derivative(t + dt / 2, tmp, k3);
      for (let k = 0; k < 9; k++) { tmp.re[k] = rho.re[k] + dt * k3.re[k]; tmp.im[k] = rho.im[k] + dt * k3.im[k]; }
      derivative(t + dt, tmp, k4);
      for (let k = 0; k < 9; k++) {
        rho.re[k] += dt / 6 * (k1.re[k] + 2 * k2.re[k] + 2 * k3.re[k] + k4.re[k]);
        rho.im[k] += dt / 6 * (k1.im[k] + 2 * k2.im[k] + 2 * k3.im[k] + k4.im[k]);
      }
      if ((s + 1) % stride === 0 || s === steps - 1) record((s + 1) * dt);
    }
    return {
      time, p0, p1, p2, inPhase, quad,
      final: { p0: rho.re[0], p1: rho.re[4], p2: rho.re[8] },
      trace: rho.re[0] + rho.re[4] + rho.re[8]
    };
  }

  YR.dynamics = { simulatePulse, makeEnvelope };
})(globalThis.YR = globalThis.YR || {});
