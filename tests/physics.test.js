/* Checks of the numerical kernels against closed-form results.
   Run with:  node --test tests/                                   */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

for (const f of ['linalg', 'sc', 'fieldsolver', 'photonics', 'bpm', 'linearoptics', 'qcircuit', 'dynamics']) {
  require(path.join('..', 'assets', 'js', 'physics', f + '.js'));
}
const YR = globalThis.YR;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} got ${a}, expected ${b} ± ${tol}`);

test('Jacobi eigenvalues of a 2x2 matrix', () => {
  const { values } = YR.linalg.jacobiEigen([[2, 1], [1, 2]]);
  close(values[0], 1, 1e-12); close(values[1], 3, 1e-12);
});

test('junction and capacitance energies', () => {
  close(YR.sc.ejFromIc(30), 14.9, 0.05, 'EJ/h for 30 nA');
  close(YR.sc.ecFromC(65), 0.298, 0.001, 'EC/h for 65 fF');
});

test('transmon spectrum approaches the asymptotic formulas', () => {
  const s = YR.sc.transmonSummary(15, 0.3);
  // sqrt(8 EJ EC) - EC is the leading-order result; the next correction is of order EC^2/(hf)
  close(s.f01, s.f01Asymptotic, 0.03, 'f01');
  close(s.alpha, -0.3, 0.05, 'anharmonicity ~ -EC');
  assert.ok(s.alpha < -0.3, 'anharmonicity is slightly larger than EC in magnitude');
  assert.ok(s.dispersion01 < 1e-4, 'charge dispersion is suppressed at EJ/EC = 50');
  const cpb = YR.sc.transmonSummary(1, 1);
  assert.ok(cpb.dispersion01 > 0.1, 'charge-sensitive at EJ/EC = 1');
});

test('static ZZ matches second-order perturbation theory for weak coupling', () => {
  const f1 = 5.0, f2 = 5.12, a = -0.3, j = 0.002;
  const d = f1 - f2;
  // E11 is pushed by |20> and |02>: zz = 2 J^2 (a1 + a2) / ((d + a1)(d - a2))
  const pert = 2 * j * j * (a + a) / ((d + a) * (d - a));
  const zz = YR.sc.staticZZ(f1, a, f2, a, j);
  close(zz, pert, Math.abs(pert) * 0.1, 'ZZ');
  close(YR.sc.staticZZ(f1, a, f2, a, 0), 0, 1e-9, 'no coupling, no ZZ');
});

test('coplanar waveguide: 10/6 um on silicon is close to 50 ohm', () => {
  const line = YR.sc.cpw(10, 6, 11.45);
  close(line.z0, 50, 2.5, 'Z0');
  close(line.vPhase, 299792458 / Math.sqrt(6.225), 1e3, 'phase velocity');
  close(YR.sc.resonatorLength(7, line.epsEff, 'quarter'), 4.29, 0.02, 'quarter-wave length');
});

test('field solver agrees with the conformal-mapping result', () => {
  const analytic = YR.sc.cpw(10, 6, 11.45);
  const num = YR.fieldsolver.cpwNumeric(10, 6, 11.45, 32, 6);
  close(num.z0, analytic.z0, analytic.z0 * 0.08, 'Z0');
  close(num.epsEff, analytic.epsEff, analytic.epsEff * 0.03, 'eps_eff');
  // energy splits as eps_r : 1 between the two half spaces
  close(num.substrateFraction, 11.45 / 12.45, 0.01, 'substrate energy fraction');
});

test('slab waveguide: symmetric slab obeys its dispersion relation', () => {
  const nf = 3.476, nc = 1.444, d = 0.22, lambda = 1.55;
  const m = YR.photonics.slabMode(nf, nc, nc, d, lambda, 'TE', 0);
  assert.ok(m.neff > 2.7 && m.neff < 2.9, `TE0 neff of a 220 nm SOI slab, got ${m.neff}`);
  // even mode: kappa tan(kappa d / 2) = gamma
  close(m.kappa * Math.tan(m.kappa * d / 2), m.gs, 1e-6, 'even-mode condition');
  assert.strictEqual(YR.photonics.slabMode(nf, nc, nc, 0.05, lambda, 'TE', 1), null);
});

test('strip waveguide and ring resonator', () => {
  const p = { nCore: 3.476, nSub: 1.444, nClad: 1.444, h: 0.22, w: 0.5, lambda: 1.55 };
  const s = YR.photonics.stripMode(p);
  assert.ok(s.neff > 2.2 && s.neff < 2.7, `neff ${s.neff}`);
  const ng = YR.photonics.groupIndex(p);
  assert.ok(ng > s.neff, 'group index exceeds the effective index');
  const ring = YR.photonics.ring({ length: 200, ng: 4.2, lossDbCm: 2, kappa2: 0.05, lambda0: 1.55 });
  close(ring.fsr * 1000, 1.55 * 1.55 / (4.2 * 200) * 1000, 1e-9, 'FSR [nm]');
  close(ring.transmission(1.55), Math.pow((ring.a - ring.r) / (1 - ring.a * ring.r), 2), 1e-12, 'on resonance');
  assert.ok(ring.transmission(1.55 + ring.fsr / 2) > 0.95, 'off resonance is transparent');
  // critical coupling: r = a gives full extinction
  const a = Math.exp(-YR.photonics.alphaPerMetre(2) * 200e-6 / 2);
  const crit = YR.photonics.ring({ length: 200, ng: 4.2, lossDbCm: 2, kappa2: 1 - a * a, lambda0: 1.55 });
  assert.ok(crit.transmission(1.55) < 1e-12);
});

test('squeezing and Hong-Ou-Mandel formulas', () => {
  close(YR.photonics.squeezingDb(1, 1), -20 / Math.LN10, 1e-9, 'lossless squeezing = -8.69 dB per unit r');
  close(YR.photonics.squeezingDb(5, 0.5), 10 * Math.log10(0.5), 0.01, '50% loss caps squeezing at -3 dB');
  close(YR.photonics.homCoincidence(0.5, 1, 0, 1), 0, 1e-12);
  close(YR.photonics.homCoincidence(0.5, 1, 100, 1), 0.5, 1e-12);
  close(YR.photonics.mziCross(0.5, 0.5, 0), 1, 1e-12);
  close(YR.photonics.mziCross(0.5, 0.5, Math.PI), 0, 1e-12);
});

test('beam propagation: a straight guide keeps its mode', () => {
  const r = YR.bpm.propagate({ kind: 'straight', nCore: 1.6, nClad: 1.444, lambda: 1.55, width: 1.2, length: 200, windowX: 16 });
  close(r.totalPower, 1, 0.01, 'power is conserved');
  close(r.ports[0].power, 1, 0.03, 'power stays in the guide');
});

test('beam propagation: coupler transfers power and the Y-branch splits evenly', () => {
  const base = { nCore: 1.6, nClad: 1.444, lambda: 1.55, width: 1.0, windowX: 20 };
  let best = { cross: 0 };
  for (const length of [50, 100, 150, 200, 250]) {
    const r = YR.bpm.propagate(Object.assign({ kind: 'coupler', gap: 0.6, length }, base));
    const cross = r.ports[1].power;
    if (cross > best.cross) best = { cross, length, total: r.totalPower };
  }
  assert.ok(best.cross > 0.9, `some length transfers most of the power (best ${best.cross} at ${best.length})`);
  const y = YR.bpm.propagate(Object.assign({ kind: 'ysplit', separation: 6, lead: 30, bend: 300 }, base));
  close(y.ports[0].power, y.ports[1].power, 0.01, 'symmetric split');
  assert.ok(y.ports[0].power > 0.4, `low excess loss, got ${y.ports[0].power}`);
});

test('beam propagation: Mach-Zehnder output follows the arm phase', () => {
  // width 1.0 um keeps the guide single-mode, so the antisymmetric part must radiate
  const base = { kind: 'mzi', nCore: 1.6, nClad: 1.444, lambda: 1.55, width: 1.0, windowX: 20,
    separation: 6, lead: 60, bend: 300, arm: 200 };
  const out = [];
  for (let k = 0; k <= 9; k++) out.push(YR.bpm.propagate(Object.assign({ deltaN: k * 0.001 }, base)).ports[0].power);
  assert.ok(out[0] > 0.9, `constructive at zero phase, got ${out[0]}`);
  assert.ok(Math.min(...out) < 0.1, `destructive near pi, got ${Math.min(...out)}`);
  assert.ok(out[9] > 0.9, `constructive again after 2 pi, got ${out[9]}`);
});

test('linear optics: unitarity and Hong-Ou-Mandel bunching', () => {
  const LO = YR.linearoptics;
  const u = LO.circuitUnitary(2, [{ type: 'bs', mode: 0, theta: Math.PI / 4 }]);
  const dist = LO.outputDistribution(u, [1, 1]);
  const get = (occ) => dist.find((d) => d.occ.join() === occ.join());
  close(get([1, 1]).quantum, 0, 1e-12, 'no coincidences');
  close(get([2, 0]).quantum, 0.5, 1e-12);
  close(get([1, 1]).classical, 0.5, 1e-12, 'distinguishable photons');
  const u4 = LO.circuitUnitary(4, [
    { type: 'bs', mode: 0, theta: 0.7 }, { type: 'ps', mode: 1, phi: 1.1 }, { type: 'bs', mode: 1, theta: 0.3 },
    { type: 'bs', mode: 2, theta: 1.2 }, { type: 'ps', mode: 2, phi: -0.4 }, { type: 'bs', mode: 0, theta: 0.9 }
  ]);
  const d3 = LO.outputDistribution(u4, [1, 1, 1, 0]);
  close(d3.reduce((s, d) => s + d.quantum, 0), 1, 1e-10, 'quantum probabilities sum to 1');
  close(d3.reduce((s, d) => s + d.classical, 0), 1, 1e-10, 'classical probabilities sum to 1');
  const d2 = LO.outputDistribution(u4, [2, 0, 1, 0]);
  close(d2.reduce((s, d) => s + d.quantum, 0), 1, 1e-10, 'repeated input mode');
});

test('gate circuits: Bell state, GHZ and decoherence', () => {
  const QC = YR.qcircuit;
  const bell = { n: 2, columns: [[{ gate: 'H', q: 0 }], [{ gate: 'CNOT', q: 0, q2: 1 }]] };
  const ideal = QC.run(bell, null).state;
  const p = ideal.probabilities();
  close(p[0], 0.5, 1e-12); close(p[3], 0.5, 1e-12); close(p[1] + p[2], 0, 1e-12);
  close(ideal.purity(), 1, 1e-12);
  const noisy = QC.run(bell, { t1: 50, tphi: 80, t1q: 0.03, t2q: 0.2 }).state;
  close(noisy.probabilities().reduce((a, b) => a + b, 0), 1, 1e-12, 'trace preserved');
  const f = noisy.overlap(ideal);
  assert.ok(f < 1 && f > 0.98, `fidelity ${f}`);

  const ghz = { n: 3, columns: [[{ gate: 'H', q: 0 }], [{ gate: 'CNOT', q: 0, q2: 1 }], [{ gate: 'CNOT', q: 1, q2: 2 }]] };
  const g = QC.run(ghz, null).state.probabilities();
  close(g[0], 0.5, 1e-12); close(g[7], 0.5, 1e-12);

  // HZH = X, S^2 = Z, T^2 = S, RX(pi) flips, SWAP moves the excitation
  const x = QC.run({ n: 1, columns: [[{ gate: 'H', q: 0 }], [{ gate: 'Z', q: 0 }], [{ gate: 'H', q: 0 }]] }, null).state;
  close(x.probabilities()[1], 1, 1e-12);
  const sw = QC.run({ n: 2, columns: [[{ gate: 'RX', q: 0, theta: Math.PI }], [{ gate: 'SWAP', q: 0, q2: 1 }]] }, null).state;
  close(sw.probabilities()[2], 1, 1e-12);
  const b = QC.run({ n: 1, columns: [[{ gate: 'H', q: 0 }], [{ gate: 'S', q: 0 }]] }, null).state.bloch(0);
  close(b[1], 1, 1e-12, 'H then S points along +y');

  // pure T1 decay: population of |1> after a wait
  const wait = QC.run({ n: 1, columns: [[{ gate: 'X', q: 0 }]] }, { t1: 10, tphi: Infinity, t1q: 5, t2q: 5 }).state;
  close(wait.probabilities()[1], Math.exp(-0.5), 1e-12);
});

test('pulse dynamics: pi pulse, leakage and DRAG', () => {
  const base = { alpha: -0.3, detuning: 0, duration: 40, angle: Math.PI, beta: 0, t1: Infinity, tphi: Infinity };
  const slow = YR.dynamics.simulatePulse(base);
  close(slow.trace, 1, 1e-9, 'trace');
  assert.ok(slow.final.p1 > 0.99, `slow pi pulse inverts, p1 = ${slow.final.p1}`);
  const fast = YR.dynamics.simulatePulse(Object.assign({}, base, { duration: 8 }));
  let bestBeta = 0, bestLeak = fast.final.p2;
  for (let beta = -1.5; beta <= 1.5; beta += 0.25) {
    const r = YR.dynamics.simulatePulse(Object.assign({}, base, { duration: 8, beta }));
    if (r.final.p2 < bestLeak) { bestLeak = r.final.p2; bestBeta = beta; }
  }
  assert.ok(fast.final.p2 > 1e-4, `a short pulse leaks, p2 = ${fast.final.p2}`);
  assert.ok(bestLeak < fast.final.p2 / 10, `DRAG reduces leakage: ${fast.final.p2} -> ${bestLeak} at beta ${bestBeta}`);
  // half the leakage-optimal weight removes the phase error instead and restores the inversion
  const half = YR.dynamics.simulatePulse(Object.assign({}, base, { duration: 8, beta: 0.5 }));
  assert.ok(half.final.p1 > 0.999 && fast.final.p1 < 0.98, `p1 ${fast.final.p1} -> ${half.final.p1}`);
  const decay = YR.dynamics.simulatePulse({ alpha: -0.3, detuning: 0, duration: 100, angle: 0, beta: 0, t1: 50, tphi: Infinity });
  close(decay.final.p0, 1, 1e-12, 'ground state is stationary');
});
