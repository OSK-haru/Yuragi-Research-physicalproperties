/* 2D quasi-static field solver for a coplanar-waveguide cross-section.
   Finite differences on a square grid, successive over-relaxation.
   The conductors are zero-thickness strips on the substrate surface; the outer box is grounded. */
(function (YR) {
  'use strict';

  /** Solve Laplace's equation for the CPW cross-section.
   *  opts: { w, s, epsR, cellsPerPitch, boxPitches }  (w, s in the same length unit)
   *  Returns the potential, the stored energy split by region and the capacitance
   *  per unit length in units of eps0 (multiply by eps0 for F/m). */
  function solveCross(opts) {
    const w = opts.w, s = opts.s, epsR = opts.epsR;
    const pitch = w + 2 * s;
    const cells = opts.cellsPerPitch || 32;
    const box = opts.boxPitches || 6;
    const dx = pitch / cells;
    const nx = Math.round(box * cells) + 1;
    const ny = nx;
    const jSurf = Math.floor(ny / 2);          // row of the substrate surface; rows below are substrate
    const phi = new Float64Array(nx * ny);
    const fixed = new Uint8Array(nx * ny);
    const xc = (nx - 1) / 2;

    for (let i = 0; i < nx; i++) {
      const x = Math.abs(i - xc) * dx;
      const idx = jSurf * nx + i;
      if (x <= w / 2 + 1e-9) { phi[idx] = 1; fixed[idx] = 1; }
      else if (x >= w / 2 + s - 1e-9) { phi[idx] = 0; fixed[idx] = 1; }
    }
    for (let i = 0; i < nx; i++) { fixed[i] = 1; fixed[(ny - 1) * nx + i] = 1; }
    for (let j = 0; j < ny; j++) { fixed[j * nx] = 1; fixed[j * nx + nx - 1] = 1; }

    const epsAvg = (epsR + 1) / 2;
    const omega = 2 / (1 + Math.PI / nx);
    const maxIter = opts.maxIter || 4000;
    let iter = 0, change = 1;
    for (; iter < maxIter && change > 1e-7; iter++) {
      change = 0;
      for (let j = 1; j < ny - 1; j++) {
        const onSurface = j === jSurf;
        for (let i = 1; i < nx - 1; i++) {
          const idx = j * nx + i;
          if (fixed[idx]) continue;
          let target;
          if (onSurface) {
            // rows j < jSurf are substrate, rows j > jSurf are vacuum
            target = (epsAvg * (phi[idx - 1] + phi[idx + 1]) + epsR * phi[idx - nx] + phi[idx + nx]) /
              (2 * epsAvg + epsR + 1);
          } else {
            target = 0.25 * (phi[idx - 1] + phi[idx + 1] + phi[idx - nx] + phi[idx + nx]);
          }
          const d = target - phi[idx];
          phi[idx] += omega * d;
          const ad = d < 0 ? -d : d;
          if (ad > change) change = ad;
        }
      }
    }

    // Discrete field energy, edge by edge: U = 1/2 sum eps_edge (delta phi)^2  (per eps0, unit voltage)
    let uSub = 0, uVac = 0;
    const density = new Float64Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = j * nx + i;
        if (i < nx - 1) {
          const d = phi[idx + 1] - phi[idx];
          const e2 = d * d;
          if (j < jSurf) uSub += 0.5 * epsR * e2;
          else if (j > jSurf) uVac += 0.5 * e2;
          else { uSub += 0.25 * epsR * e2; uVac += 0.25 * e2; }
          density[idx] += e2; density[idx + 1] += e2;
        }
        if (j < ny - 1) {
          const d = phi[idx + nx] - phi[idx];
          const e2 = d * d;
          if (j < jSurf) uSub += 0.5 * epsR * e2; else uVac += 0.5 * e2;
          density[idx] += e2; density[idx + nx] += e2;
        }
      }
    }
    const u = uSub + uVac;
    return {
      nx, ny, dx, jSurf, phi, density,
      iterations: iter,
      residual: change,
      capacitancePerEps0: 2 * u,
      substrateFraction: uSub / u
    };
  }

  /** Quasi-TEM line parameters from two solves (with the substrate and in vacuum). */
  function cpwNumeric(w, s, epsR, cellsPerPitch, boxPitches) {
    const withSub = solveCross({ w, s, epsR, cellsPerPitch, boxPitches });
    const inAir = solveCross({ w, s, epsR: 1, cellsPerPitch, boxPitches });
    const EPS0 = YR.sc.consts.EPS0, C0 = YR.sc.consts.C0;
    const c = withSub.capacitancePerEps0 * EPS0;
    const cAir = inAir.capacitancePerEps0 * EPS0;
    return {
      field: withSub,
      epsEff: c / cAir,
      z0: 1 / (C0 * Math.sqrt(c * cAir)),
      cPerM: c,
      substrateFraction: withSub.substrateFraction
    };
  }

  YR.fieldsolver = { solveCross, cpwNumeric };
})(globalThis.YR = globalThis.YR || {});
