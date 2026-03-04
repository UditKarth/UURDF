import type * as THREE from 'three';

export type JointType = 'revolute' | 'continuous' | 'prismatic' | 'fixed';

export interface JointInfo {
  name: string;
  type: JointType;
  axis: THREE.Vector3;
  limits: { lower: number; upper: number };
  parentLinkName: string;
  childLinkName: string;
  originTransform: THREE.Matrix4;
  /** Index in the full actuated joint list (actuatedJointNames) */
  globalIndex: number;
}

export interface SolverResult {
  success: boolean;
  thetas: number[];
  finalError: number;
  iterations: number;
  converged: boolean;
  nearSingularity: boolean;
  manipulability: number;
}

export interface IKParams {
  target: { position: THREE.Vector3; orientation?: THREE.Quaternion };
  initialJointStates: number[];
  joints: JointInfo[];
  eeLink: string;
  positionOnly?: boolean;
  lambda?: number;
  tolerance?: number;
  maxIterations?: number;
  jointLimitPadding?: number;
  singularityThreshold?: number;
}
