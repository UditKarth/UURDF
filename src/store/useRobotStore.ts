import { create } from 'zustand';
import * as THREE from 'three';
import type { URDFRobot } from 'urdf-loader';
import type { JointInfo, SolverResult } from '../core/types';
import {
  extractJointInfos,
  buildParentMap,
  getAncestorJoints,
  getLinkNamesDFS,
} from '../core/URDFParser';
import { KinematicsEngine } from '../core/KinematicsEngine';

export interface RobotStore {
  urdfRobot: URDFRobot | null;
  jointInfos: JointInfo[];
  actuatedJointNames: string[];
  linkNames: string[];
  ikAncestorIndices: number[];
  parentMap: Map<string, { joint: JointInfo; parentLink: string }>;
  kinematicsEngine: KinematicsEngine | null;

  primaryJointStates: number[];
  ghostJointStates: number[] | null;
  ikTarget: THREE.Vector3;
  ikResult: SolverResult | null;
  endEffectorLink: string;

  showAxes: boolean;
  cameraPreset: string;

  setJointValue: (index: number, value: number) => void;
  setAllJointValues: (values: number[]) => void;
  setIKTarget: (position: THREE.Vector3) => void;
  runIK: () => void;
  applyIKSolution: () => void;
  discardIKSolution: () => void;
  loadURDF: (robot: URDFRobot) => void;
  setEndEffectorLink: (linkName: string) => void;
  resetToZero: () => void;
  resetToCenter: () => void;
  setShowAxes: (show: boolean) => void;
  setCameraPreset: (preset: string) => void;
}

export const useRobotStore = create<RobotStore>((set, get) => ({
  urdfRobot: null,
  jointInfos: [],
  actuatedJointNames: [],
  linkNames: [],
  ikAncestorIndices: [],
  parentMap: new Map(),
  kinematicsEngine: null,

  primaryJointStates: [],
  ghostJointStates: null,
  ikTarget: new THREE.Vector3(),
  ikResult: null,
  endEffectorLink: '',

  showAxes: false,
  cameraPreset: 'Iso',

  setJointValue: (index, value) => {
    const state = get();
    const next = state.primaryJointStates.slice();
    if (index >= 0 && index < next.length) next[index] = value;
    set({
      primaryJointStates: next,
      ghostJointStates: null,
    });
  },

  setAllJointValues: (values) => {
    set({
      primaryJointStates: values.slice(),
      ghostJointStates: null,
    });
  },

  setIKTarget: (position) => {
    set({ ikTarget: position.clone() });
  },

  runIK: () => {
    const state = get();
    const engine = state.kinematicsEngine;
    if (!engine || state.ikAncestorIndices.length === 0) {
      set({ ikResult: null, ghostJointStates: null });
      return;
    }
    const result = engine.solveIK({
      target: { position: state.ikTarget },
      initialJointStates: state.primaryJointStates,
      joints: state.jointInfos,
      eeLink: state.endEffectorLink,
      positionOnly: true,
      lambda: 0.5,
      tolerance: 1e-4,
      maxIterations: 100,
      jointLimitPadding: 0.01,
      singularityThreshold: 1e-2,
    });
    set({
      ghostJointStates: result.thetas,
      ikResult: result,
    });
  },

  applyIKSolution: () => {
    const state = get();
    if (state.ghostJointStates == null) return;
    set({
      primaryJointStates: state.ghostJointStates,
      ghostJointStates: null,
      ikResult: null,
    });
  },

  discardIKSolution: () => {
    const state = get();
    set({ ghostJointStates: null, ikResult: null });
    if (state.kinematicsEngine) {
      const pos = state.kinematicsEngine.getEndEffectorPosition(
        state.primaryJointStates,
        state.endEffectorLink
      );
      set({ ikTarget: pos.clone() });
    }
  },

  loadURDF: (robot) => {
    const { jointInfos, actuatedJointNames, jointInfoByName } = extractJointInfos(robot);
    const root = robot as unknown as import('urdf-loader').URDFLink;
    const parentMap = buildParentMap(root, jointInfoByName);
    const linkNames = getLinkNamesDFS(root);
    const defaultEE = linkNames.length > 0 ? linkNames[linkNames.length - 1]! : '';
    const ancestorJoints = getAncestorJoints(parentMap, defaultEE);
    const ikAncestorIndices = ancestorJoints.map((j) => j.globalIndex);

    const initialStates = jointInfos.map((j) => {
      if (j.type === 'continuous') return 0;
      return (j.limits.lower + j.limits.upper) / 2;
    });

    const engine = new KinematicsEngine(robot, jointInfos, jointInfoByName, parentMap);
    let ikTarget = new THREE.Vector3();
    if (defaultEE) {
      ikTarget = engine.getEndEffectorPosition(initialStates, defaultEE).clone();
    }

    set({
      urdfRobot: robot,
      jointInfos,
      actuatedJointNames,
      linkNames,
      parentMap,
      kinematicsEngine: engine,
      ikAncestorIndices,
      endEffectorLink: defaultEE,
      primaryJointStates: initialStates,
      ghostJointStates: null,
      ikTarget,
      ikResult: null,
    });
  },

  setEndEffectorLink: (linkName) => {
    const state = get();
    const ancestorJoints = getAncestorJoints(state.parentMap, linkName);
    const ikAncestorIndices = ancestorJoints.map((j) => j.globalIndex);
    let ikTarget = state.ikTarget.clone();
    if (state.kinematicsEngine) {
      ikTarget = state.kinematicsEngine.getEndEffectorPosition(
        state.primaryJointStates,
        linkName
      ).clone();
    }
    set({
      endEffectorLink: linkName,
      ikAncestorIndices,
      ghostJointStates: null,
      ikResult: null,
      ikTarget,
    });
  },

  resetToZero: () => {
    const state = get();
    const n = state.primaryJointStates.length;
    set({
      primaryJointStates: new Array(n).fill(0),
      ghostJointStates: null,
      ikResult: null,
    });
  },

  resetToCenter: () => {
    const state = get();
    const next = state.jointInfos.map((j) => {
      if (j.type === 'continuous') return 0;
      return (j.limits.lower + j.limits.upper) / 2;
    });
    set({
      primaryJointStates: next,
      ghostJointStates: null,
      ikResult: null,
    });
  },

  setShowAxes: (show) => set({ showAxes: show }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
}));
