import { useMemo, useRef, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Float } from '@react-three/drei';
import { useRobotStore } from '../store/useRobotStore';

const GHOST_MATERIAL = new THREE.MeshPhysicalMaterial({
  color: 0x00ffaa,
  transparent: true,
  opacity: 0.3,
  depthTest: true,
  depthWrite: false,
  roughness: 0.5,
  metalness: 0.1,
  side: THREE.FrontSide,
});

const AXIS_SIZE = 0.05;
const AXIS_SIZE_IK = 0.07;

/** Create a small R/G/B axes group at origin (local space). */
function createJointAxesHelper(): THREE.Group {
  const g = new THREE.Group();
  const s = AXIS_SIZE;
  const makeBar = (color: number, pos: [number, number, number], size: [number, number, number]) => {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    const mat = new THREE.MeshBasicMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    g.add(mesh);
  };
  makeBar(0xff0000, [s / 2, 0, 0], [s, 0.008, 0.008]);
  makeBar(0x00ff00, [0, s / 2, 0], [0.008, s, 0.008]);
  makeBar(0x0000ff, [0, 0, s / 2], [0.008, 0.008, s]);
  return g;
}

function setRobotJointValues(robot: import('urdf-loader').URDFRobot, values: number[], names: string[]) {
  names.forEach((name, i) => {
    robot.setJointValue(name, values[i] ?? 0);
  });
}

function EEMarker({ position }: { position: THREE.Vector3 }) {
  return (
    <Float speed={1.5} rotationIntensity={0} floatIntensity={0.3}>
      <mesh position={[position.x, position.y, position.z]}>
        <sphereGeometry args={[0.015, 16, 16]} />
        <meshStandardMaterial color="#ff8800" />
      </mesh>
    </Float>
  );
}

export function RobotModel() {
  const robot = useRobotStore((s) => s.urdfRobot);
  const primaryJointStates = useRobotStore((s) => s.primaryJointStates);
  const ghostJointStates = useRobotStore((s) => s.ghostJointStates);
  const actuatedJointNames = useRobotStore((s) => s.actuatedJointNames);
  const endEffectorLink = useRobotStore((s) => s.endEffectorLink);
  const showAxes = useRobotStore((s) => s.showAxes);
  const ikAncestorIndices = useRobotStore((s) => s.ikAncestorIndices);
  const kinematicsEngine = useRobotStore((s) => s.kinematicsEngine);
  const jointInfos = useRobotStore((s) => s.jointInfos);

  const ghostRobot = useMemo(() => {
    if (!robot) return null;
    const clone = (robot as THREE.Object3D).clone(true) as import('urdf-loader').URDFRobot;
    clone.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        (c as THREE.Mesh).material = GHOST_MATERIAL;
        (c as THREE.Mesh).castShadow = false;
        (c as THREE.Mesh).receiveShadow = false;
      }
    });
    return clone;
  }, [robot]);

  const eePosition = useMemo(() => {
    if (!kinematicsEngine || !endEffectorLink) return new THREE.Vector3();
    return kinematicsEngine.getEndEffectorPosition(primaryJointStates, endEffectorLink);
  }, [kinematicsEngine, endEffectorLink, primaryJointStates]);

  const robotGroupRef = useRef<THREE.Group | null>(null);
  const axesContainer = useMemo(() => new THREE.Group(), []);
  const axesByJointRef = useRef<Map<string, THREE.Group>>(new Map());
  const _pos = useRef(new THREE.Vector3()).current;
  const _quat = useRef(new THREE.Quaternion()).current;

  const setRobotGroupRef = useCallback(
    (el: THREE.Group | null) => {
      if (robotGroupRef.current && axesContainer.parent === robotGroupRef.current) {
        robotGroupRef.current.remove(axesContainer);
      }
      robotGroupRef.current = el;
      if (el) el.add(axesContainer);
    },
    [axesContainer]
  );

  useEffect(() => {
    if (!robot || !jointInfos.length) return;
    const robotObj = robot as THREE.Object3D;
    const jointNames = new Set(jointInfos.map((j) => j.name));
    const jointObjectRefs = new Map<string, THREE.Object3D>();

    robotObj.traverse((obj) => {
      const joint = obj as import('urdf-loader').URDFJoint;
      if (!joint.isURDFJoint || !jointNames.has(joint.name)) return;
      jointObjectRefs.set(joint.name, joint);
    });

    axesByJointRef.current.forEach((axes) => axesContainer.remove(axes));
    axesByJointRef.current.clear();

    if (showAxes) {
      jointObjectRefs.forEach((_joint, name) => {
        const axes = createJointAxesHelper();
        axes.name = `axes_${name}`;
        axesContainer.add(axes);
        axesByJointRef.current.set(name, axes);
      });
    }
  }, [robot, showAxes, jointInfos, axesContainer]);

  useFrame(() => {
    if (!robot) return;
    setRobotJointValues(robot, primaryJointStates, actuatedJointNames);
    if (ghostRobot && ghostJointStates) {
      setRobotJointValues(ghostRobot, ghostJointStates, actuatedJointNames);
    }
    axesContainer.visible = showAxes;
    if (showAxes && kinematicsEngine) {
      (robot as THREE.Object3D).updateMatrixWorld(true);
      const world = kinematicsEngine.computeFK(primaryJointStates);
      const ikSet = new Set(ikAncestorIndices);
      const T_joint = new THREE.Matrix4();
      jointInfos.forEach((j) => {
        const axes = axesByJointRef.current.get(j.name);
        if (!axes) return;
        const parentMat = world.get(j.parentLinkName);
        if (!parentMat) return;
        T_joint.copy(parentMat).multiply(j.originTransform);
        _pos.setFromMatrixPosition(T_joint);
        axes.position.copy(_pos);
        _quat.setFromRotationMatrix(T_joint);
        axes.quaternion.copy(_quat);
        const scale = ikSet.has(j.globalIndex) ? AXIS_SIZE_IK / AXIS_SIZE : 1;
        axes.scale.setScalar(scale);
      });
    }
  });

  if (!robot) return null;

  return (
    <>
      <group ref={setRobotGroupRef} renderOrder={0}>
        <primitive object={robot} />
      </group>
      {ghostRobot && (
        <group renderOrder={1} visible={!!ghostJointStates}>
          <primitive object={ghostRobot} />
        </group>
      )}
      <EEMarker position={eePosition} />
    </>
  );
}
