/* Gate-level circuit simulation on a density matrix.
   The density matrix of n qubits is stored as a vector of 4^n complex numbers:
   index = row + (col << n). Qubit 0 is the least significant bit. */
(function (YR) {
  'use strict';

  const S2 = Math.SQRT1_2;
  // 2x2 matrices as [a_re, a_im, b_re, b_im, c_re, c_im, d_re, d_im] for [[a, b], [c, d]]
  const FIXED = {
    H: [S2, 0, S2, 0, S2, 0, -S2, 0],
    X: [0, 0, 1, 0, 1, 0, 0, 0],
    Y: [0, 0, 0, -1, 0, 1, 0, 0],
    Z: [1, 0, 0, 0, 0, 0, -1, 0],
    S: [1, 0, 0, 0, 0, 0, 0, 1],
    T: [1, 0, 0, 0, 0, 0, S2, S2]
  };
  function rotation(axis, theta) {
    const c = Math.cos(theta / 2), s = Math.sin(theta / 2);
    if (axis === 'RX') return [c, 0, 0, -s, 0, -s, c, 0];
    if (axis === 'RY') return [c, 0, -s, 0, s, 0, c, 0];
    return [c, -s, 0, 0, 0, 0, c, s];
  }
  function conj(u) { return [u[0], -u[1], u[2], -u[3], u[4], -u[5], u[6], -u[7]]; }

  const TWO_QUBIT = { CNOT: true, CZ: true, SWAP: true };
  const PARAM = { RX: true, RY: true, RZ: true };

  function apply1(re, im, bit, u) {
    const mask = 1 << bit;
    const n = re.length;
    for (let i = 0; i < n; i++) {
      if (i & mask) continue;
      const j = i | mask;
      const xr = re[i], xi = im[i], yr = re[j], yi = im[j];
      re[i] = u[0] * xr - u[1] * xi + u[2] * yr - u[3] * yi;
      im[i] = u[0] * xi + u[1] * xr + u[2] * yi + u[3] * yr;
      re[j] = u[4] * xr - u[5] * xi + u[6] * yr - u[7] * yi;
      im[j] = u[4] * xi + u[5] * xr + u[6] * yi + u[7] * yr;
    }
  }

  function State(n) {
    this.n = n;
    const size = Math.pow(4, n);
    this.re = new Float64Array(size);
    this.im = new Float64Array(size);
    this.re[0] = 1;
  }
  State.prototype.unitary1 = function (q, u) {
    apply1(this.re, this.im, q, u);
    apply1(this.re, this.im, q + this.n, conj(u));
  };
  State.prototype.kraus1 = function (q, ops) {
    const outRe = new Float64Array(this.re.length), outIm = new Float64Array(this.re.length);
    for (const k of ops) {
      const tr = Float64Array.from(this.re), ti = Float64Array.from(this.im);
      apply1(tr, ti, q, k);
      apply1(tr, ti, q + this.n, conj(k));
      for (let i = 0; i < tr.length; i++) { outRe[i] += tr[i]; outIm[i] += ti[i]; }
    }
    this.re = outRe; this.im = outIm;
  };
  State.prototype._perm2 = function (a, b, kind) {
    const re = this.re, im = this.im;
    const ma = 1 << a, mb = 1 << b;
    for (let i = 0; i < re.length; i++) {
      if (kind === 'CNOT') {
        if ((i & ma) && !(i & mb)) {
          const j = i | mb;
          let t = re[i]; re[i] = re[j]; re[j] = t;
          t = im[i]; im[i] = im[j]; im[j] = t;
        }
      } else if (kind === 'CZ') {
        if ((i & ma) && (i & mb)) { re[i] = -re[i]; im[i] = -im[i]; }
      } else if (kind === 'SWAP') {
        if ((i & ma) && !(i & mb)) {
          const j = (i & ~ma) | mb;
          let t = re[i]; re[i] = re[j]; re[j] = t;
          t = im[i]; im[i] = im[j]; im[j] = t;
        }
      }
    }
  };
  State.prototype.gate2 = function (kind, a, b) {
    this._perm2(a, b, kind);
    this._perm2(a + this.n, b + this.n, kind);
  };
  State.prototype.probabilities = function () {
    const dim = 1 << this.n;
    const p = new Float64Array(dim);
    for (let i = 0; i < dim; i++) p[i] = this.re[i + (i << this.n)];
    return p;
  };
  State.prototype.purity = function () {
    let s = 0;
    for (let i = 0; i < this.re.length; i++) s += this.re[i] * this.re[i] + this.im[i] * this.im[i];
    return s;
  };
  /** Tr(rho sigma); equals the fidelity when one of the two states is pure. */
  State.prototype.overlap = function (other) {
    let s = 0;
    for (let i = 0; i < this.re.length; i++) s += this.re[i] * other.re[i] + this.im[i] * other.im[i];
    return s;
  };
  /** Bloch vector of one qubit (reduced state). */
  State.prototype.bloch = function (q) {
    const n = this.n, dim = 1 << n, mask = 1 << q;
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < dim; i++) {
      const d = this.re[i + (i << n)];
      z += (i & mask) ? -d : d;
      if (!(i & mask)) {
        const j = i | mask;                    // rho[i][j] with row i, col j
        x += 2 * this.re[i + (j << n)];
        y += -2 * this.im[i + (j << n)];
      }
    }
    return [x, y, z];
  };

  function idleNoise(state, q, t, t1, tphi) {
    if (!(t > 0)) return;
    if (isFinite(t1) && t1 > 0) {
      const g = 1 - Math.exp(-t / t1);
      state.kraus1(q, [
        [1, 0, 0, 0, 0, 0, Math.sqrt(1 - g), 0],
        [0, 0, Math.sqrt(g), 0, 0, 0, 0, 0]
      ]);
    }
    if (isFinite(tphi) && tphi > 0) {
      const p = (1 - Math.exp(-t / tphi)) / 2;
      const a = Math.sqrt(1 - p), b = Math.sqrt(p);
      state.kraus1(q, [
        [a, 0, 0, 0, 0, 0, a, 0],
        [b, 0, 0, 0, 0, 0, -b, 0]
      ]);
    }
  }

  /** Run a circuit.
   *  circuit: { n, columns: [[{ gate, q, q2?, theta? }, ...], ...] }
   *  noise:   null, or { t1, tphi, t1q, t2q } with all times in the same unit. */
  function run(circuit, noise) {
    const state = new State(circuit.n);
    let elapsed = 0;
    for (const column of circuit.columns) {
      if (!column.length) continue;
      let duration = 0;
      for (const g of column) {
        if (TWO_QUBIT[g.gate]) {
          state.gate2(g.gate, g.q, g.q2);
          if (noise) duration = Math.max(duration, noise.t2q);
        } else {
          const u = PARAM[g.gate] ? rotation(g.gate, g.theta) : FIXED[g.gate];
          if (!u) continue;
          state.unitary1(g.q, u);
          if (noise) duration = Math.max(duration, noise.t1q);
        }
      }
      if (noise) {
        for (let q = 0; q < circuit.n; q++) idleNoise(state, q, duration, noise.t1, noise.tphi);
        elapsed += duration;
      }
    }
    return { state, elapsed };
  }

  function label(index, n) {
    let s = '';
    for (let q = 0; q < n; q++) s += (index >> q) & 1;
    return s;
  }

  YR.qcircuit = { run, State, label, TWO_QUBIT, PARAM, FIXED };
})(globalThis.YR = globalThis.YR || {});
