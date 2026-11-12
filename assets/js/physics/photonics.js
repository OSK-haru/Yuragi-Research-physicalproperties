/* Integrated-photonics device models. Lengths in micrometres unless a name says otherwise. */
(function (YR) {
  'use strict';

  /** Guided mode of a three-layer slab waveguide.
   *  nf: film index, ns: substrate, nc: cover, d: film thickness, lambda: vacuum wavelength,
   *  pol: 'TE' | 'TM', m: mode order. Returns null when the mode is cut off. */
  function slabMode(nf, ns, nc, d, lambda, pol, m) {
    const k0 = 2 * Math.PI / lambda;
    const nMin = Math.max(ns, nc);
    if (nf <= nMin) return null;
    const xs = pol === 'TM' ? (nf * nf) / (ns * ns) : 1;
    const xcv = pol === 'TM' ? (nf * nf) / (nc * nc) : 1;
    function f(N) {
      const kappa = k0 * Math.sqrt(Math.max(nf * nf - N * N, 0));
      const gs = k0 * Math.sqrt(Math.max(N * N - ns * ns, 0));
      const gc = k0 * Math.sqrt(Math.max(N * N - nc * nc, 0));
      return kappa * d - m * Math.PI - Math.atan2(xs * gs, kappa) - Math.atan2(xcv * gc, kappa);
    }
    let lo = nMin + 1e-12, hi = nf - 1e-12;
    if (f(lo) <= 0) return null;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid; else hi = mid;
    }
    const N = (lo + hi) / 2;
    const kappa = k0 * Math.sqrt(nf * nf - N * N);
    const gs = k0 * Math.sqrt(N * N - ns * ns);
    const gc = k0 * Math.sqrt(Math.max(N * N - nc * nc, 0));
    const phiS = Math.atan2(xs * gs, kappa);
    /** Transverse field profile; x = 0 at the substrate interface, x = d at the cover. */
    function field(x) {
      if (x < 0) return Math.cos(phiS) * Math.exp(gs * x);
      if (x > d) return Math.cos(kappa * d - phiS) * Math.exp(-gc * (x - d));
      return Math.cos(kappa * x - phiS);
    }
    return { neff: N, kappa, gs, gc, field };
  }

  function countSlabModes(nf, ns, nc, d, lambda, pol) {
    let m = 0;
    while (m < 50 && slabMode(nf, ns, nc, d, lambda, pol, m)) m++;
    return m;
  }

  /** Quasi-TE mode of a strip waveguide by the effective-index method:
   *  vertical TE slab (thickness h), then lateral TM slab (width w). */
  function stripMode(p) {
    const vertical = slabMode(p.nCore, p.nSub, p.nClad, p.h, p.lambda, 'TE', 0);
    if (!vertical) return null;
    const lateral = slabMode(vertical.neff, p.nClad, p.nClad, p.w, p.lambda, 'TM', 0);
    if (!lateral) return null;
    return {
      neff: lateral.neff,
      nSlab: vertical.neff,
      vertical,
      lateral,
      lateralModes: countSlabModes(vertical.neff, p.nClad, p.nClad, p.w, p.lambda, 'TM')
    };
  }

  /** Group index from the waveguide dispersion (material dispersion is not included). */
  function groupIndex(p) {
    const dl = p.lambda * 1e-3;
    const a = stripMode(Object.assign({}, p, { lambda: p.lambda - dl }));
    const b = stripMode(Object.assign({}, p, { lambda: p.lambda + dl }));
    const c = stripMode(p);
    if (!a || !b || !c) return null;
    return c.neff - p.lambda * (b.neff - a.neff) / (2 * dl);
  }

  /** Power attenuation coefficient [1/m] from a propagation loss in dB/cm. */
  function alphaPerMetre(dbPerCm) {
    return dbPerCm * 100 / (10 / Math.LN10);
  }

  /** All-pass ring resonator. length: circumference [um], ng: group index,
   *  lossDbCm: propagation loss, kappa2: power coupling to the bus, lambda0 [um]. */
  function ring(p) {
    const a = Math.exp(-alphaPerMetre(p.lossDbCm) * p.length * 1e-6 / 2);
    const r = Math.sqrt(1 - p.kappa2);
    const fsr = p.lambda0 * p.lambda0 / (p.ng * p.length);           // um
    const ra = r * a;
    const q = Math.PI * p.ng * p.length * Math.sqrt(ra) / (p.lambda0 * (1 - ra));
    const fwhm = p.lambda0 / q;
    function transmission(lambda) {
      const phase = 2 * Math.PI * p.ng * p.length * (1 / lambda - 1 / p.lambda0);
      const c = Math.cos(phase);
      return (a * a - 2 * ra * c + r * r) / (1 - 2 * ra * c + ra * ra);
    }
    const tMin = Math.pow((a - r) / (1 - ra), 2);
    return {
      a, r, fsr, q, fwhm,
      finesse: fsr / fwhm,
      extinctionDb: tMin > 0 ? -10 * Math.log10(tMin) : Infinity,
      qIntrinsic: 2 * Math.PI * p.ng / (p.lambda0 * 1e-6 * alphaPerMetre(p.lossDbCm)),
      transmission
    };
  }

  /** Cross-port power of a Mach-Zehnder interferometer with two couplers of power
   *  coupling k1, k2 and an internal phase difference phi. */
  function mziCross(k1, k2, phi) {
    return k1 * (1 - k2) + k2 * (1 - k1) + 2 * Math.sqrt(k1 * k2 * (1 - k1) * (1 - k2)) * Math.cos(phi);
  }

  /** Measured squeezing [dB, negative below shot noise] after a channel of efficiency eta. */
  function squeezingDb(r, eta) {
    return 10 * Math.log10(eta * Math.exp(-2 * r) + 1 - eta);
  }
  function antiSqueezingDb(r, eta) {
    return 10 * Math.log10(eta * Math.exp(2 * r) + 1 - eta);
  }

  /** Hong-Ou-Mandel coincidence probability for a beam splitter of reflectivity R,
   *  photon indistinguishability V and relative delay tau (Gaussian wave packets, width tauC). */
  function homCoincidence(R, V, tau, tauC) {
    const T = 1 - R;
    return T * T + R * R - 2 * R * T * V * Math.exp(-(tau * tau) / (tauC * tauC));
  }

  YR.photonics = {
    slabMode, countSlabModes, stripMode, groupIndex, alphaPerMetre,
    ring, mziCross, squeezingDb, antiSqueezingDb, homCoincidence
  };
})(globalThis.YR = globalThis.YR || {});
