/* Superconducting-circuit device models.
   Frequencies are in GHz (E/h), times in microseconds unless a name says otherwise. */
(function (YR) {
  'use strict';

  const H = 6.62607015e-34;        // J s
  const E = 1.602176634e-19;       // C
  const KB = 1.380649e-23;         // J/K
  const PHI0 = H / (2 * E);        // Wb
  const EPS0 = 8.8541878128e-12;   // F/m
  const MU0 = 1.25663706212e-6;    // H/m
  const C0 = 299792458;            // m/s

  /** Josephson energy EJ/h [GHz] from the junction critical current [nA]. */
  function ejFromIc(icNanoAmp) {
    return (PHI0 * icNanoAmp * 1e-9) / (2 * Math.PI * H) / 1e9;
  }
  /** Charging energy EC/h [GHz] from the total shunt capacitance [fF]. */
  function ecFromC(cFemtoFarad) {
    return (E * E) / (2 * cFemtoFarad * 1e-15 * H) / 1e9;
  }

  /** Lowest eigenenergies of the transmon Hamiltonian
   *  H = 4 EC (n - ng)^2 - EJ cos(phi), diagonalised in the charge basis. */
  function transmonLevels(ej, ec, ng, nLevels, ncut) {
    ncut = ncut || 14;
    nLevels = nLevels || 4;
    const dim = 2 * ncut + 1;
    const M = [];
    for (let i = 0; i < dim; i++) {
      const row = new Float64Array(dim);
      const n = i - ncut;
      row[i] = 4 * ec * (n - ng) * (n - ng);
      if (i > 0) row[i - 1] = -ej / 2;
      if (i < dim - 1) row[i + 1] = -ej / 2;
      M.push(row);
    }
    return YR.linalg.jacobiEigen(M).values.slice(0, nLevels);
  }

  /** Transition frequencies, anharmonicity and charge dispersion of a transmon. */
  function transmonSummary(ej, ec) {
    const e0 = transmonLevels(ej, ec, 0, 4);
    const eh = transmonLevels(ej, ec, 0.5, 4);
    const f01a = e0[1] - e0[0];
    const f01b = eh[1] - eh[0];
    const f01 = (f01a + f01b) / 2;
    const f12 = ((e0[2] - e0[1]) + (eh[2] - eh[1])) / 2;
    return {
      f01,
      f12,
      alpha: f12 - f01,
      ratio: ej / ec,
      dispersion01: Math.abs(f01a - f01b),      // peak-to-peak charge dispersion of f01 [GHz]
      f01Asymptotic: Math.sqrt(8 * ej * ec) - ec
    };
  }

  /** Static ZZ of two coupled transmons (Duffing oscillators, 4 levels each,
   *  exchange coupling J), from the dressed energies: E11 - E10 - E01 + E00. [GHz] */
  function staticZZ(f1, a1, f2, a2, j) {
    const d = 4;
    const dim = d * d;
    const M = [];
    for (let i = 0; i < dim; i++) M.push(new Float64Array(dim));
    for (let p = 0; p < d; p++) {
      for (let q = 0; q < d; q++) {
        const idx = p * d + q;
        M[idx][idx] = f1 * p + (a1 / 2) * p * (p - 1) + f2 * q + (a2 / 2) * q * (q - 1);
        if (p + 1 < d && q - 1 >= 0) {
          const other = (p + 1) * d + (q - 1);
          const g = j * Math.sqrt(p + 1) * Math.sqrt(q);
          M[idx][other] = g;
          M[other][idx] = g;
        }
      }
    }
    const { values, vectors } = YR.linalg.jacobiEigen(M);
    function dressed(p, q) {
      const bare = p * d + q;
      let best = 0, bestW = -1;
      for (let k = 0; k < dim; k++) {
        const w = vectors[bare][k] * vectors[bare][k];
        if (w > bestW) { bestW = w; best = k; }
      }
      return values[best];
    }
    return dressed(1, 1) - dressed(1, 0) - dressed(0, 1) + dressed(0, 0);
  }

  /** Dispersive readout figures. Inputs: qubit and resonator frequency [GHz],
   *  anharmonicity [GHz], coupling g [MHz], resonator linewidth kappa/2pi [MHz]. */
  function readout(fq, alpha, fr, gMHz, kappaMHz) {
    const g = gMHz / 1000;
    const delta = fq - fr;
    const chi = (g * g / delta) * (alpha / (delta + alpha));         // GHz
    const purcellT1 = (delta * delta) / (g * g) / (2 * Math.PI * kappaMHz * 1e6) * 1e6; // us
    return {
      delta,
      chiMHz: chi * 1000,
      purcellT1,
      nCrit: (delta * delta) / (4 * g * g),
      dispersive: Math.abs(g / delta) < 0.1
    };
  }

  /** Dielectric-loss limit: 1/T1 = 2 pi f sum_i p_i tan(delta_i). Returns microseconds. */
  function dielectricT1(fGHz, channels) {
    let sum = 0;
    for (const c of channels) sum += c.p * c.tand;
    if (sum <= 0) return Infinity;
    return 1 / (2 * Math.PI * fGHz * 1e9 * sum) * 1e6;
  }

  /** Combine independent decay channels (microseconds). */
  function combineT1(list) {
    let rate = 0;
    for (const t of list) if (isFinite(t) && t > 0) rate += 1 / t;
    return rate > 0 ? 1 / rate : Infinity;
  }
  function t2From(t1, tphi) {
    const rate = 1 / (2 * t1) + (isFinite(tphi) && tphi > 0 ? 1 / tphi : 0);
    return 1 / rate;
  }

  /** BCS gap at T = 0 from the critical temperature: Delta = 1.764 kB Tc. */
  function bcsGap(tcKelvin) {
    const delta = 1.764 * KB * tcKelvin;
    return {
      microEv: delta / E * 1e6,
      pairBreakingGHz: 2 * delta / H / 1e9
    };
  }
  /** Thermal quasiparticle fraction x_qp = sqrt(2 pi kB T / Delta) exp(-Delta / kB T). */
  function thermalQuasiparticles(tcKelvin, tKelvin) {
    const delta = 1.764 * KB * tcKelvin;
    const x = (KB * tKelvin) / delta;
    return Math.sqrt(2 * Math.PI * x) * Math.exp(-1 / x);
  }

  /** Complete elliptic integral of the first kind K(k), by the AGM. */
  function ellipK(k) {
    let a = 1, b = Math.sqrt(1 - k * k);
    for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15; i++) {
      const an = (a + b) / 2;
      b = Math.sqrt(a * b);
      a = an;
    }
    return Math.PI / (2 * a);
  }

  /** Coplanar waveguide on a thick substrate (conformal mapping, zero-thickness metal).
   *  w: centre width, s: gap (same unit). */
  function cpw(w, s, epsR) {
    const k = w / (w + 2 * s);
    const kp = Math.sqrt(1 - k * k);
    const ratio = ellipK(k) / ellipK(kp);
    const epsEff = (epsR + 1) / 2;
    const cPerM = 4 * EPS0 * epsEff * ratio;       // F/m
    const lPerM = (MU0 / 4) / ratio;               // H/m
    return {
      k,
      epsEff,
      z0: Math.sqrt(lPerM / cPerM),
      cPerM,
      lPerM,
      vPhase: 1 / Math.sqrt(lPerM * cPerM)
    };
  }
  /** Length [mm] of a CPW resonator. kind: 'quarter' or 'half'. */
  function resonatorLength(fGHz, epsEff, kind) {
    const lambda = C0 / Math.sqrt(epsEff) / (fGHz * 1e9);
    return (kind === 'half' ? lambda / 2 : lambda / 4) * 1e3;
  }

  YR.sc = {
    consts: { H, E, KB, PHI0, EPS0, MU0, C0 },
    ejFromIc, ecFromC, transmonLevels, transmonSummary, staticZZ, readout,
    dielectricT1, combineT1, t2From, bcsGap, thermalQuasiparticles,
    ellipK, cpw, resonatorLength
  };
})(globalThis.YR = globalThis.YR || {});
