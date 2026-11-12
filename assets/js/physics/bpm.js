/* 2D scalar paraxial beam-propagation method (finite differences, Crank-Nicolson).
   The in-plane structure is described by an effective index, so results are qualitative
   for high-contrast platforms and wide-angle structures. Lengths in micrometres. */
(function (YR) {
  'use strict';

  function sBend(z, z0, length, offset) {
    if (z <= z0) return 0;
    if (z >= z0 + length) return offset;
    return offset * (1 - Math.cos(Math.PI * (z - z0) / length)) / 2;
  }

  /** Build a structure: a list of guides {centre(z), width(z), dn(z)} and the output ports. */
  function buildStructure(kind, p) {
    const w = p.width;
    const guides = [];
    let ports = [];
    let launchX = 0;
    let length = p.length;
    const constant = (v) => () => v;

    if (kind === 'straight') {
      guides.push({ centre: constant(0), width: constant(w) });
      ports = [{ name: 'out', x: 0 }];
    } else if (kind === 'coupler') {
      const off = (w + p.gap) / 2;
      guides.push({ centre: constant(-off), width: constant(w) });
      guides.push({ centre: constant(off), width: constant(w) });
      launchX = -off;
      ports = [{ name: 'bar', x: -off }, { name: 'cross', x: off }];
    } else if (kind === 'ysplit') {
      const half = p.separation / 2;
      const z0 = p.lead;
      guides.push({ centre: (z) => -sBend(z, z0, p.bend, half), width: constant(w) });
      guides.push({ centre: (z) => sBend(z, z0, p.bend, half), width: constant(w) });
      length = p.lead + p.bend + p.lead;
      ports = [{ name: 'out 1', x: -half }, { name: 'out 2', x: half }];
    } else if (kind === 'mzi') {
      const half = p.separation / 2;
      const zA = p.lead, zB = zA + p.bend, zC = zB + p.arm, zD = zC + p.bend;
      length = zD + p.lead;
      const centre = (sign) => (z) => {
        if (z < zB) return sign * sBend(z, zA, p.bend, half);
        if (z < zC) return sign * half;
        return sign * (half - sBend(z, zC, p.bend, half));
      };
      guides.push({ centre: centre(-1), width: constant(w) });
      guides.push({
        centre: centre(1), width: constant(w),
        dn: (z) => (z >= zB && z < zC ? p.deltaN : 0)
      });
      ports = [{ name: 'out', x: 0 }];
    } else if (kind === 'mmi') {
      const z1 = p.lead, z2 = z1 + p.mmiLength;
      length = z2 + p.lead;
      const q = p.mmiWidth / 4;
      guides.push({ centre: constant(0), width: (z) => (z < z1 ? w : (z < z2 ? p.mmiWidth : 0)) });
      guides.push({ centre: constant(-q), width: (z) => (z >= z2 ? w : 0) });
      guides.push({ centre: constant(q), width: (z) => (z >= z2 ? w : 0) });
      ports = [{ name: 'out 1', x: -q }, { name: 'out 2', x: q }];
    }
    return { kind, guides, ports, launchX, length };
  }

  /** Relative permittivity profile at position z, with sub-cell smoothing of the edges. */
  function epsProfile(structure, z, xs, dx, nCore, nClad, out) {
    const base = nClad * nClad;
    for (let i = 0; i < xs.length; i++) out[i] = base;
    for (const g of structure.guides) {
      const wz = g.width(z);
      if (wz <= 0) continue;
      const c = g.centre(z);
      const n = nCore + (g.dn ? g.dn(z) : 0);
      const contrast = n * n - base;
      for (let i = 0; i < xs.length; i++) {
        let fill = (wz / 2 - Math.abs(xs[i] - c)) / dx + 0.5;
        if (fill <= 0) continue;
        if (fill > 1) fill = 1;
        const v = base + contrast * fill;
        if (v > out[i]) out[i] = v;
      }
    }
  }

  /** Propagate the fundamental mode of the input guide through the structure.
   *  p: { kind, nCore, nClad, lambda, width, ..., dx, dz, windowX } */
  function propagate(p) {
    const structure = buildStructure(p.kind, p);
    const dx = p.dx || 0.05;
    const dz = p.dz || 0.5;
    const half = p.windowX / 2;
    const nx = Math.round(p.windowX / dx) + 1;
    const nz = Math.max(2, Math.round(structure.length / dz));
    const xs = new Float64Array(nx);
    for (let i = 0; i < nx; i++) xs[i] = -half + i * dx;

    const k0 = 2 * Math.PI / p.lambda;
    const mode = YR.photonics.slabMode(p.nCore, p.nClad, p.nClad, p.width, p.lambda, 'TE', 0);
    if (!mode) return null;
    const n0 = mode.neff;
    const kbar = k0 * n0;

    let re = new Float64Array(nx), im = new Float64Array(nx);
    let pin = 0;
    for (let i = 0; i < nx; i++) {
      re[i] = mode.field(xs[i] - structure.launchX + p.width / 2);
      pin += re[i] * re[i];
    }

    // absorbing layers at the lateral edges
    const absorb = new Float64Array(nx);
    const layer = Math.max(4, Math.round(nx * 0.1));
    for (let i = 0; i < nx; i++) {
      const dEdge = Math.min(i, nx - 1 - i);
      absorb[i] = dEdge < layer ? Math.exp(-0.6 * dz * Math.pow(1 - dEdge / layer, 2)) : 1;
    }

    const q = dz / (4 * kbar);
    const s = q / (dx * dx);
    const eps = new Float64Array(nx);
    const diagIm = new Float64Array(nx);
    const cpRe = new Float64Array(nx), cpIm = new Float64Array(nx);
    const dpRe = new Float64Array(nx), dpIm = new Float64Array(nx);
    const rRe = new Float64Array(nx), rIm = new Float64Array(nx);

    const cols = Math.min(nz, p.columns || 360);
    const intensity = new Float32Array(cols * nx);
    const index = new Float32Array(cols * nx);
    const stride = nz / cols;
    let nextCol = 0;
    const powerAlong = new Float32Array(cols);

    for (let step = 0; step < nz; step++) {
      const z = (step + 0.5) * dz;
      epsProfile(structure, z, xs, dx, p.nCore, p.nClad, eps);
      for (let i = 0; i < nx; i++) diagIm[i] = 2 * s - q * k0 * k0 * (eps[i] - n0 * n0);

      // right-hand side: (1 + i q H) psi
      for (let i = 0; i < nx; i++) {
        const lRe = (i > 0 ? re[i - 1] : 0) + (i < nx - 1 ? re[i + 1] : 0);
        const lIm = (i > 0 ? im[i - 1] : 0) + (i < nx - 1 ? im[i + 1] : 0);
        rRe[i] = re[i] + diagIm[i] * im[i] - s * lIm;
        rIm[i] = im[i] - diagIm[i] * re[i] + s * lRe;
      }
      // tridiagonal solve of (1 - i q H) psi' = rhs; off-diagonals are -i s, diagonal 1 + i diagIm
      // forward sweep
      {
        const bRe = 1, bIm = diagIm[0];
        const den = bRe * bRe + bIm * bIm;
        // c' = (-i s) / b
        cpRe[0] = (-s * bIm) / den;
        cpIm[0] = (-s * bRe) / den;
        dpRe[0] = (rRe[0] * bRe + rIm[0] * bIm) / den;
        dpIm[0] = (rIm[0] * bRe - rRe[0] * bIm) / den;
      }
      for (let i = 1; i < nx; i++) {
        // m = b_i - a * c'_{i-1}, a = -i s  ->  a*c' = (s*cpIm, -s*cpRe)
        const mRe = 1 - s * cpIm[i - 1];
        const mIm = diagIm[i] + s * cpRe[i - 1];
        const den = mRe * mRe + mIm * mIm;
        cpRe[i] = (-s * mIm) / den;
        cpIm[i] = (-s * mRe) / den;
        // numerator = r_i - a * d'_{i-1} = r_i - (s*dpIm, -s*dpRe)
        const nRe = rRe[i] - s * dpIm[i - 1];
        const nIm = rIm[i] + s * dpRe[i - 1];
        dpRe[i] = (nRe * mRe + nIm * mIm) / den;
        dpIm[i] = (nIm * mRe - nRe * mIm) / den;
      }
      re[nx - 1] = dpRe[nx - 1];
      im[nx - 1] = dpIm[nx - 1];
      for (let i = nx - 2; i >= 0; i--) {
        re[i] = dpRe[i] - (cpRe[i] * re[i + 1] - cpIm[i] * im[i + 1]);
        im[i] = dpIm[i] - (cpRe[i] * im[i + 1] + cpIm[i] * re[i + 1]);
      }
      for (let i = 0; i < nx; i++) { re[i] *= absorb[i]; im[i] *= absorb[i]; }

      if (nextCol < cols && step >= Math.floor(nextCol * stride)) {
        let tot = 0;
        for (let i = 0; i < nx; i++) {
          const v = re[i] * re[i] + im[i] * im[i];
          intensity[nextCol * nx + i] = v;
          index[nextCol * nx + i] = eps[i];
          tot += v;
        }
        powerAlong[nextCol] = tot / pin;
        nextCol++;
      }
    }

    let total = 0;
    for (let i = 0; i < nx; i++) total += re[i] * re[i] + im[i] * im[i];
    const ports = structure.ports.map((port) => {
      let sum = 0;
      for (let i = 0; i < nx; i++) {
        if (Math.abs(xs[i] - port.x) <= p.width) sum += re[i] * re[i] + im[i] * im[i];
      }
      return { name: port.name, x: port.x, power: sum / pin };
    });

    return {
      nx, cols, xs, intensity, index, powerAlong,
      length: structure.length,
      windowX: p.windowX,
      n0,
      ports,
      totalPower: total / pin
    };
  }

  /** Self-imaging length scale of a multimode section: L_pi = 4 n W^2 / (3 lambda). */
  function mmiBeatLength(nCore, widthEff, lambda) {
    return 4 * nCore * widthEff * widthEff / (3 * lambda);
  }

  YR.bpm = { propagate, buildStructure, mmiBeatLength };
})(globalThis.YR = globalThis.YR || {});
