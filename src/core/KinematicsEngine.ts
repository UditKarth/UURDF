import * as THREE from 'three';
import type { URDFRobot, URDFJoint, URDFLink } from 'urdf-loader';
import type { JointInfo, SolverResult, IKParams } from './types';
import { getAncestorJoints } from './URDFParser';
import { computeSVD, getUColumn, getVColumn } from './SVDSolver';

const DELTA = 1e-6;
const DEFAULT_LAMBDA = 0.5;
const DEFAULT_TOLERANCE = 1e-4;
const DEFAULT_MAX_ITER = 100;
const DEFAULT_PADDING = 0.01;
const SINGULARITY_THRESHOLD = 1e-2;
const MANIPULABILITY_NEAR_SINGULAR = 1e-3;
const MAX_STEP = 0.1;

const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _axisAngle = new THREE.Vector3();

function dot(a: Float64Array, b: Float64Array, n: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function getPositionFromMatrix(m: THREE.Matrix4, out: THREE.Vector3): THREE.Vector3 {
  return m.decompose(_pos, _quat, _scale), out.copy(_pos);
}

function getQuaternionFromMatrix(m: THREE.Matrix4, out: THREE.Quaternion): THREE.Quaternion {
  return m.decompose(_pos, out, _scale), out;
}

/**
 * Extract axis-angle (rotation vector) from a rotation matrix R.
 * Length of the vector is the angle in radians.
 */
function axisAngleFromMatrix(R: THREE.Matrix4, out: THREE.Vector3): THREE.Vector3 {
  const e = new THREE.Matrix4().copy(R);
  const m = e.elements;
  const trace = m[0] + m[5] + m[10];
  const angle = Math.acos(Math.max(-1, Math.min(1, (trace - 1) * 0.5)));
  if (angle < 1e-8) {
    out.set(0, 0, 0);
    return out;
  }
  const s = 1 / (2 * Math.sin(angle));
  out.set(
    (m[6] - m[9]) * s,
    (m[8] - m[2]) * s,
    (m[1] - m[4]) * s
  );
  out.multiplyScalar(angle);
  return out;
}

function makeJointTransform(
  type: JointInfo['type'],
  axis: THREE.Vector3,
  value: number
): THREE.Matrix4 {
  const T = new THREE.Matrix4();
  if (type === 'revolute' || type === 'continuous') {
    T.makeRotationAxis(axis, value);
  } else if (type === 'prismatic') {
    T.makeTranslation(axis.x * value, axis.y * value, axis.z * value);
  } else {
    T.identity();
  }
  return T;
}

export class KinematicsEngine {
  private robot: URDFRobot;
  private jointInfoByName: Map<string, JointInfo>;
  private parentMap: Map<string, { joint: JointInfo; parentLink: string }>;

  constructor(
    robot: URDFRobot,
    _jointInfos: JointInfo[],
    jointInfoByName: Map<string, JointInfo>,
    parentMap: Map<string, { joint: JointInfo; parentLink: string }>
  ) {
    this.robot = robot;
    this.jointInfoByName = jointInfoByName;
    this.parentMap = parentMap;
  }

  /**
   * Compute world transform for every link in the tree (all branches).
   */
  computeFK(jointStates: number[]): Map<string, THREE.Matrix4> {
    const world = new Map<string, THREE.Matrix4>();
    const root = this.robot as unknown as URDFLink;
    const T_root = new THREE.Matrix4().identity();
    world.set(root.name, T_root);

    const stack: { link: URDFLink; T: THREE.Matrix4 }[] = [{ link: root, T: T_root.clone() }];
    const T_origin = new THREE.Matrix4();
    const T_joint = new THREE.Matrix4();
    const T_child = new THREE.Matrix4();

    while (stack.length > 0) {
      const { link, T } = stack.pop()!;
      link.children.forEach((child) => {
        if (!(child as URDFJoint).isURDFJoint) return;
        const joint = child as URDFJoint;
        const info = this.jointInfoByName.get(joint.name);
        const childLink = joint.children.find((c) => (c as URDFLink).isURDFLink) as URDFLink | undefined;
        if (!childLink) return;

        if (info && info.type !== 'fixed') {
          const value = jointStates[info.globalIndex] ?? 0;
          T_joint.copy(makeJointTransform(info.type, info.axis, value));
          T_origin.copy(info.originTransform);
          T_child.copy(T).multiply(T_origin).multiply(T_joint);
        } else {
          T_origin.copy(jointOriginFromJoint(joint));
          T_child.copy(T).multiply(T_origin);
        }
        world.set(childLink.name, T_child.clone());
        stack.push({ link: childLink, T: T_child });
      });
    }
    return world;
  }

  getEndEffectorPosition(jointStates: number[], eeLink: string): THREE.Vector3 {
    const world = this.computeFK(jointStates);
    const m = world.get(eeLink);
    if (!m) return new THREE.Vector3();
    return getPositionFromMatrix(m, new THREE.Vector3());
  }

  /**
   * Jacobian 6×M (or 3×M if positionOnly) over ancestor chain only. Column-major.
   */
  computeJacobian(
    jointStates: number[],
    eeLink: string,
    positionOnly: boolean
  ): { J: Float64Array; jointIndices: number[] } {
    const ancestorJoints = getAncestorJoints(this.parentMap, eeLink);
    const M = ancestorJoints.length;
    const k = positionOnly ? 3 : 6;
    const J = new Float64Array(k * M);
    const jointIndices = ancestorJoints.map((j) => j.globalIndex);

    const pPlus = new THREE.Vector3();
    const pMinus = new THREE.Vector3();
    const qPlus = new THREE.Quaternion();
    const qMinus = new THREE.Quaternion();
    const Rdiff = new THREE.Matrix4();

    for (let col = 0; col < M; col++) {
      const globalIdx = ancestorJoints[col].globalIndex;
      const qPlusArr = jointStates.slice();
      const qMinusArr = jointStates.slice();
      qPlusArr[globalIdx] += DELTA;
      qMinusArr[globalIdx] -= DELTA;

      const worldPlus = this.computeFK(qPlusArr);
      const worldMinus = this.computeFK(qMinusArr);

      const mPlus = worldPlus.get(eeLink)!;
      const mMinus = worldMinus.get(eeLink)!;
      getPositionFromMatrix(mPlus, pPlus);
      getPositionFromMatrix(mMinus, pMinus);

      J[0 + col * k] = (pPlus.x - pMinus.x) / (2 * DELTA);
      J[1 + col * k] = (pPlus.y - pMinus.y) / (2 * DELTA);
      J[2 + col * k] = (pPlus.z - pMinus.z) / (2 * DELTA);

      if (!positionOnly) {
        getQuaternionFromMatrix(mPlus, qPlus);
        getQuaternionFromMatrix(mMinus, qMinus);
        Rdiff.compose(
          new THREE.Vector3(0, 0, 0),
          qPlus.clone().multiply(qMinus.clone().invert()),
          new THREE.Vector3(1, 1, 1)
        );
        axisAngleFromMatrix(Rdiff, _axisAngle);
        J[3 + col * k] = _axisAngle.x / (2 * DELTA);
        J[4 + col * k] = _axisAngle.y / (2 * DELTA);
        J[5 + col * k] = _axisAngle.z / (2 * DELTA);
      }
    }
    return { J, jointIndices };
  }

  /**
   * Yoshikawa manipulability: sqrt(det(J Jᵀ)) = product of singular values.
   */
  manipulability(J: Float64Array, k: number, M: number): number {
    const { S } = computeSVD(J, k, M);
    let prod = 1;
    for (let i = 0; i < k; i++) prod *= Math.max(S[i], 0);
    return prod;
  }

  solveIK(params: IKParams): SolverResult {
    const {
      target,
      initialJointStates,
      eeLink,
      positionOnly = true,
      lambda = DEFAULT_LAMBDA,
      tolerance = DEFAULT_TOLERANCE,
      maxIterations = DEFAULT_MAX_ITER,
      jointLimitPadding = DEFAULT_PADDING,
      singularityThreshold = SINGULARITY_THRESHOLD,
    } = params;

    const ancestorJoints = getAncestorJoints(this.parentMap, eeLink);
    const M = ancestorJoints.length;
    const k = positionOnly ? 3 : 6;
    const e = new Float64Array(k);
    let q = initialJointStates.slice();
    let bestQ = q.slice();
    let bestError = Infinity;
    let lastManipulability = 0;
    let nearSingularity = false;
    const Rdiff = new THREE.Matrix4();

    for (let iter = 0; iter < maxIterations; iter++) {
      const world = this.computeFK(q);
      const m = world.get(eeLink);
      if (!m) {
        return {
          success: false,
          thetas: q,
          finalError: bestError,
          iterations: iter,
          converged: false,
          nearSingularity,
          manipulability: 0,
        };
      }
      getPositionFromMatrix(m, _pos);
      e[0] = target.position.x - _pos.x;
      e[1] = target.position.y - _pos.y;
      e[2] = target.position.z - _pos.z;
      let errNorm = Math.sqrt(e[0] * e[0] + e[1] * e[1] + e[2] * e[2]);
      if (!positionOnly && target.orientation) {
        getQuaternionFromMatrix(m, _quat);
        const qErr = target.orientation.clone().multiply(_quat.clone().invert());
        Rdiff.makeRotationFromQuaternion(qErr);
        axisAngleFromMatrix(Rdiff, _axisAngle);
        e[3] = _axisAngle.x;
        e[4] = _axisAngle.y;
        e[5] = _axisAngle.z;
        errNorm = Math.sqrt(
          e[0] * e[0] + e[1] * e[1] + e[2] * e[2] + e[3] * e[3] + e[4] * e[4] + e[5] * e[5]
        );
      }
      if (errNorm < bestError) {
        bestError = errNorm;
        bestQ = q.slice();
      }
      if (errNorm < tolerance) {
        const { J: Jconv } = this.computeJacobian(q, eeLink, positionOnly);
        lastManipulability = this.manipulability(Jconv, k, M);
        return {
          success: true,
          thetas: q,
          finalError: errNorm,
          iterations: iter,
          converged: true,
          nearSingularity: lastManipulability < MANIPULABILITY_NEAR_SINGULAR,
          manipulability: lastManipulability,
        };
      }

      const { J, jointIndices } = this.computeJacobian(q, eeLink, positionOnly);
      lastManipulability = this.manipulability(J, k, M);
      if (lastManipulability < MANIPULABILITY_NEAR_SINGULAR) nearSingularity = true;

      const dq = new Float64Array(M);
      const { U, S, V } = computeSVD(J, k, M);
      const ui = new Float64Array(k);
      const vi = new Float64Array(M);
      const lambdaSq = lambda * lambda;
      for (let i = 0; i < Math.min(k, M); i++) {
        const sigma = S[i];
        const dampedInv =
          sigma / (sigma * sigma + lambdaSq * Math.max(1, (singularityThreshold / (sigma + 1e-12)) ** 2));
        getUColumn(U, k, i, ui);
        getVColumn(V, M, i, vi);
        const alpha = dot(ui, e, k) * dampedInv;
        for (let j = 0; j < M; j++) dq[j] += alpha * vi[j];
      }

      let maxDq = 0;
      for (let j = 0; j < M; j++) maxDq = Math.max(maxDq, Math.abs(dq[j]));
      if (errNorm > 0.5 && maxDq > MAX_STEP) {
        const scale = MAX_STEP / maxDq;
        for (let j = 0; j < M; j++) dq[j] *= scale;
      }

      for (let j = 0; j < M; j++) {
        const idx = jointIndices[j];
        q[idx] = q[idx] + dq[j];
      }

      for (let j = 0; j < M; j++) {
        const idx = jointIndices[j];
        const info = ancestorJoints[j];
        if (info.type === 'continuous') {
          while (q[idx] > Math.PI) q[idx] -= 2 * Math.PI;
          while (q[idx] < -Math.PI) q[idx] += 2 * Math.PI;
        } else {
          q[idx] = Math.max(
            info.limits.lower + jointLimitPadding,
            Math.min(info.limits.upper - jointLimitPadding, q[idx])
          );
        }
      }
    }

    return {
      success: false,
      thetas: bestQ,
      finalError: bestError,
      iterations: maxIterations,
      converged: false,
      nearSingularity,
      manipulability: lastManipulability,
    };
  }
}

function jointOriginToMatrix4(joint: URDFJoint): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.compose(
    joint.position.clone(),
    joint.quaternion.clone(),
    new THREE.Vector3(1, 1, 1)
  );
  return m;
}

function jointOriginFromJoint(joint: URDFJoint): THREE.Matrix4 {
  return jointOriginToMatrix4(joint);
}

