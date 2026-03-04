import * as THREE from 'three';
import type { URDFRobot, URDFJoint, URDFLink } from 'urdf-loader';
import type { JointInfo } from './types';

/**
 * Build origin Matrix4 from URDF joint's position and quaternion.
 * URDF origin rpy is applied as Rz(yaw) * Ry(pitch) * Rx(roll) = ZYX in Three.js.
 */
function jointOriginToMatrix4(joint: URDFJoint): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  m.compose(
    joint.position.clone(),
    joint.quaternion.clone(),
    new THREE.Vector3(1, 1, 1)
  );
  return m;
}

/**
 * Depth-first traversal from a link, collecting actuated joints in order.
 */
function collectActuatedJointsDFS(
  link: URDFLink,
  jointList: JointInfo[],
  jointInfoByName: Map<string, JointInfo>,
  linkNames: Set<string>
): void {
  link.children.forEach((child) => {
    if (!('isURDFJoint' in child) || !(child as URDFJoint).isURDFJoint) return;
    const joint = child as URDFJoint;
    const childLink = joint.children.find((c) => (c as URDFLink).isURDFLink) as URDFLink | undefined;
    if (!childLink) return;

    const jointType = joint.jointType as JointInfo['type'];
    if (jointType === 'fixed') return;

    const lower = joint.limit?.lower ?? (jointType === 'prismatic' ? 0 : -Math.PI);
    const upper = joint.limit?.upper ?? (jointType === 'prismatic' ? 0 : Math.PI);
    const axis = joint.axis ? joint.axis.clone().normalize() : new THREE.Vector3(1, 0, 0);

    const info: JointInfo = {
      name: joint.name,
      type: jointType,
      axis,
      limits: { lower, upper },
      parentLinkName: (joint.parent as URDFLink).name,
      childLinkName: childLink.name,
      originTransform: jointOriginToMatrix4(joint),
      globalIndex: jointList.length,
    };
    jointList.push(info);
    jointInfoByName.set(joint.name, info);
    linkNames.add((joint.parent as URDFLink).name);
    linkNames.add(childLink.name);

    collectActuatedJointsDFS(childLink, jointList, jointInfoByName, linkNames);
  });
}

/**
 * Extract JointInfo[] and actuated joint names in depth-first order from a parsed URDF robot.
 */
export function extractJointInfos(robot: URDFRobot): {
  jointInfos: JointInfo[];
  actuatedJointNames: string[];
  jointInfoByName: Map<string, JointInfo>;
} {
  const jointList: JointInfo[] = [];
  const jointInfoByName = new Map<string, JointInfo>();
  const linkNames = new Set<string>();
  collectActuatedJointsDFS(robot as unknown as URDFLink, jointList, jointInfoByName, linkNames);
  return {
    jointInfos: jointList,
    actuatedJointNames: jointList.map((j) => j.name),
    jointInfoByName,
  };
}

/**
 * Build a mapping from each link name to its parent joint and parent link.
 * Root link does not appear in the map.
 */
export function buildParentMap(
  root: URDFLink,
  jointInfoByName: Map<string, JointInfo>
): Map<string, { joint: JointInfo; parentLink: string }> {
  const parentMap = new Map<string, { joint: JointInfo; parentLink: string }>();
  root.traverse((c) => {
    if (!('isURDFJoint' in c) || !(c as URDFJoint).isURDFJoint) return;
    const joint = c as URDFJoint;
    const parentLink = joint.parent as URDFLink;
    const childLink = joint.children.find((ch) => (ch as URDFLink).isURDFLink) as URDFLink | undefined;
    if (!childLink || !parentLink) return;
    const info = jointInfoByName.get(joint.name);
    if (info) parentMap.set(childLink.name, { joint: info, parentLink: parentLink.name });
  });
  return parentMap;
}

/**
 * Given the full URDF tree and a target link name, return the ordered list
 * of actuated joints from the root to that link (ancestor chain).
 */
export function getAncestorJoints(
  parentMap: Map<string, { joint: JointInfo; parentLink: string }>,
  eeLink: string
): JointInfo[] {
  const chain: JointInfo[] = [];
  let current: string | undefined = eeLink;
  while (current) {
    const entry = parentMap.get(current);
    if (!entry) break;
    chain.unshift(entry.joint);
    current = entry.parentLink;
  }
  return chain;
}

/**
 * Depth-first list of link names (root first, then descendants).
 * Last link is a typical default end-effector.
 */
export function getLinkNamesDFS(root: URDFLink): string[] {
  const names: string[] = [];
  root.traverse((c) => {
    if ((c as URDFLink).isURDFLink) names.push((c as URDFLink).name);
  });
  return names;
}
