/**
 * SVD for small matrices (k×M with k ≤ 6) via eigendecomposition of J Jᵀ (k×k).
 * J = U Σ Vᵀ  =>  J Jᵀ = U Σ² Uᵀ  =>  V = Jᵀ U Σ⁻¹
 * Uses Jacobi rotations for the symmetric eigendecomposition.
 */

const EPS = 1e-12;
const MAX_SWEEPS = 20;


/**
 * Compute A = J * Jᵀ (k×k). J is k×M column-major.
 */
function matMulJJT(J: Float64Array, k: number, M: number, A: Float64Array): void {
  for (let i = 0; i < k; i++) {
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let c = 0; c < M; c++) s += J[i + c * k] * J[j + c * k];
      A[i * k + j] = s;
      A[j * k + i] = s;
    }
  }
}

/**
 * Jacobi rotation to zero out A(p,q). Updates A and U in place.
 */
function jacobiRotate(A: Float64Array, U: Float64Array, k: number, p: number, q: number): void {
  const apq = A[p * k + q];
  const app = A[p * k + p];
  const aqq = A[q * k + q];
  const denom = aqq - app;
  let angle: number;
  if (Math.abs(apq) < EPS) return;
  if (Math.abs(denom) < EPS) angle = Math.PI / 4;
  else angle = 0.5 * Math.atan2(2 * apq, denom);
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  for (let i = 0; i < k; i++) {
    const aip = A[i * k + p];
    const aiq = A[i * k + q];
    A[i * k + p] = aip * c - aiq * s;
    A[i * k + q] = aip * s + aiq * c;
  }
  for (let j = 0; j < k; j++) {
    const apj = A[p * k + j];
    const aqj = A[q * k + j];
    A[p * k + j] = apj * c - aqj * s;
    A[q * k + j] = apj * s + aqj * c;
  }
  for (let i = 0; i < k; i++) {
    const uip = U[i * k + p];
    const uiq = U[i * k + q];
    U[i * k + p] = uip * c - uiq * s;
    U[i * k + q] = uip * s + uiq * c;
  }
}

/**
 * Eigendecomposition of symmetric k×k matrix A: A = U * diag(S) * Uᵀ.
 * U overwrites A (we work on a copy), S is the eigenvalue array (sorted descending later).
 */
function jacobiEigen(A: Float64Array, k: number, U: Float64Array, S: Float64Array): void {
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) U[i * k + j] = i === j ? 1 : 0;
  }
  for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
    let maxOff = 0;
    for (let p = 0; p < k; p++) {
      for (let q = p + 1; q < k; q++) {
        maxOff = Math.max(maxOff, Math.abs(A[p * k + q]));
        jacobiRotate(A, U, k, p, q);
      }
    }
    if (maxOff < EPS) break;
  }
  for (let i = 0; i < k; i++) S[i] = A[i * k + i];
  // Sort by eigenvalue descending (and reorder U columns)
  for (let i = 0; i < k; i++) {
    let imax = i;
    for (let j = i + 1; j < k; j++) if (S[j] > S[imax]) imax = j;
    if (imax !== i) {
      const t = S[i]; S[i] = S[imax]; S[imax] = t;
      for (let r = 0; r < k; r++) {
        const tmp = U[r * k + i]; U[r * k + i] = U[r * k + imax]; U[r * k + imax] = tmp;
      }
    }
  }
}

/**
 * Compute SVD of J (k×M): J = U Σ Vᵀ.
 * J column-major, k rows, M columns.
 * Returns U (k×k), S (length min(k,M)), V (M×M) - only first k columns of V are meaningful.
 */
export function computeSVD(
  J: Float64Array,
  k: number,
  M: number
): { U: Float64Array; S: Float64Array; V: Float64Array } {
  const JJT = new Float64Array(k * k);
  matMulJJT(J, k, M, JJT);
  const U = new Float64Array(k * k);
  const A = new Float64Array(JJT);
  const S = new Float64Array(k);
  jacobiEigen(A, k, U, S);
  for (let i = 0; i < k; i++) S[i] = S[i] > 0 ? Math.sqrt(S[i]) : 0;

  const V = new Float64Array(M * M);
  const vCol = new Float64Array(M);
  for (let i = 0; i < Math.min(k, M); i++) {
    const sigma = S[i];
    if (sigma < EPS) continue;
    for (let j = 0; j < M; j++) {
      let s = 0;
      for (let r = 0; r < k; r++) s += J[r + j * k] * U[r * k + i];
      vCol[j] = s / sigma;
    }
    for (let j = 0; j < M; j++) V[j * M + i] = vCol[j];
  }
  return { U, S, V };
}

/**
 * Get column i of U (k×k).
 */
export function getUColumn(U: Float64Array, k: number, i: number, out: Float64Array): void {
  for (let r = 0; r < k; r++) out[r] = U[r * k + i];
}

/**
 * Get column i of V (M×M).
 */
export function getVColumn(V: Float64Array, M: number, i: number, out: Float64Array): void {
  for (let j = 0; j < M; j++) out[j] = V[j * M + i];
}
