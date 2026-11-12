/* Small dense linear algebra used by the device models.
   Loaded as a classic script in the browser and with require() in the tests. */
(function (YR) {
  'use strict';

  /** Eigen-decomposition of a real symmetric matrix (cyclic Jacobi).
   *  Returns eigenvalues ascending and eigenvectors as columns of `vectors`. */
  function jacobiEigen(Ain) {
    const n = Ain.length;
    const A = Ain.map((r) => Float64Array.from(r));
    const V = [];
    for (let i = 0; i < n; i++) { V.push(new Float64Array(n)); V[i][i] = 1; }
    let scale = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) scale += A[i][j] * A[i][j];
    if (scale === 0) scale = 1;

    for (let sweep = 0; sweep < 120; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-24 * scale) break;
      for (let p = 0; p < n; p++) {
        for (let q = p + 1; q < n; q++) {
          const apq = A[p][q];
          if (Math.abs(apq) < 1e-300) continue;
          const theta = (A[q][q] - A[p][p]) / (2 * apq);
          const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          const c = 1 / Math.sqrt(t * t + 1);
          const s = t * c;
          for (let k = 0; k < n; k++) {
            const akp = A[k][p], akq = A[k][q];
            A[k][p] = c * akp - s * akq;
            A[k][q] = s * akp + c * akq;
          }
          for (let k = 0; k < n; k++) {
            const apk = A[p][k], aqk = A[q][k];
            A[p][k] = c * apk - s * aqk;
            A[q][k] = s * apk + c * aqk;
          }
          for (let k = 0; k < n; k++) {
            const vkp = V[k][p], vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq;
            V[k][q] = s * vkp + c * vkq;
          }
        }
      }
    }
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    order.sort((a, b) => A[a][a] - A[b][b]);
    const values = order.map((i) => A[i][i]);
    const vectors = [];
    for (let r = 0; r < n; r++) vectors.push(order.map((i) => V[r][i]));
    return { values, vectors };
  }

  YR.linalg = { jacobiEigen };
})(globalThis.YR = globalThis.YR || {});
