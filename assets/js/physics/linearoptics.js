/* Linear-optical circuits acting on Fock states (exact, by matrix permanents).
   Intended for a few photons in a few modes. Complex numbers are [re, im] pairs. */
(function (YR) {
  'use strict';

  function identity(m) {
    const u = [];
    for (let i = 0; i < m; i++) {
      const row = [];
      for (let j = 0; j < m; j++) row.push([i === j ? 1 : 0, 0]);
      u.push(row);
    }
    return u;
  }
  function cmul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }

  /** Left-multiply u by a 2x2 block g acting on modes (i, j). */
  function applyTwoMode(u, i, j, g) {
    const m = u.length;
    for (let c = 0; c < m; c++) {
      const a = u[i][c], b = u[j][c];
      const x = cmul(g[0][0], a), y = cmul(g[0][1], b);
      const z = cmul(g[1][0], a), w = cmul(g[1][1], b);
      u[i][c] = [x[0] + y[0], x[1] + y[1]];
      u[j][c] = [z[0] + w[0], z[1] + w[1]];
    }
  }

  /** Unitary of a circuit. elements: [{type:'bs', mode, theta} | {type:'ps', mode, phi}] in order.
   *  A beam splitter acts on (mode, mode+1) as [[cos t, i sin t], [i sin t, cos t]]. */
  function circuitUnitary(modes, elements) {
    const u = identity(modes);
    for (const el of elements) {
      if (el.type === 'bs') {
        const c = Math.cos(el.theta), s = Math.sin(el.theta);
        applyTwoMode(u, el.mode, el.mode + 1, [[[c, 0], [0, s]], [[0, s], [c, 0]]]);
      } else if (el.type === 'ps') {
        const ph = [Math.cos(el.phi), Math.sin(el.phi)];
        for (let c = 0; c < modes; c++) u[el.mode][c] = cmul(ph, u[el.mode][c]);
      }
    }
    return u;
  }

  /** Permanent of a small complex matrix (expansion along the first row). */
  function permanent(a) {
    const n = a.length;
    if (n === 0) return [1, 0];
    if (n === 1) return a[0][0];
    let re = 0, im = 0;
    for (let c = 0; c < n; c++) {
      const el = a[0][c];
      if (el[0] === 0 && el[1] === 0) continue;
      const minor = [];
      for (let r = 1; r < n; r++) {
        const row = [];
        for (let k = 0; k < n; k++) if (k !== c) row.push(a[r][k]);
        minor.push(row);
      }
      const p = cmul(el, permanent(minor));
      re += p[0]; im += p[1];
    }
    return [re, im];
  }

  function factorial(n) { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }

  /** All ways to place n photons in m modes (occupation lists). */
  function occupations(m, n) {
    const out = [];
    const cur = new Array(m).fill(0);
    (function rec(mode, left) {
      if (mode === m - 1) { cur[mode] = left; out.push(cur.slice()); return; }
      for (let k = left; k >= 0; k--) { cur[mode] = k; rec(mode + 1, left - k); }
    })(0, n);
    return out;
  }

  /** Output distribution for an input occupation list.
   *  Returns [{ occ, quantum, classical }] where `classical` is the result for
   *  fully distinguishable photons. */
  function outputDistribution(u, input) {
    const m = u.length;
    const n = input.reduce((a, b) => a + b, 0);
    const inModes = [];
    input.forEach((k, mode) => { for (let i = 0; i < k; i++) inModes.push(mode); });
    let inFact = 1;
    input.forEach((k) => { inFact *= factorial(k); });
    const result = [];
    for (const occ of occupations(m, n)) {
      const outModes = [];
      occ.forEach((k, mode) => { for (let i = 0; i < k; i++) outModes.push(mode); });
      let outFact = 1;
      occ.forEach((k) => { outFact *= factorial(k); });
      const sub = outModes.map((o) => inModes.map((i) => u[o][i]));
      const abs2 = sub.map((row) => row.map((z) => [z[0] * z[0] + z[1] * z[1], 0]));
      const p = permanent(sub);
      result.push({
        occ,
        quantum: (p[0] * p[0] + p[1] * p[1]) / (inFact * outFact),
        classical: permanent(abs2)[0] / outFact
      });
    }
    return result;
  }

  YR.linearoptics = { circuitUnitary, permanent, occupations, outputDistribution };
})(globalThis.YR = globalThis.YR || {});
