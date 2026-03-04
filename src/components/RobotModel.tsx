import { useMemo } from 'react';
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

function JointAxes({ position, isIKActive }: { position: THREE.Vector3; isIKActive?: boolean }) {
  const s = isIKActive ? 0.07 : 0.05;
  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh position={[s / 2, 0, 0]}>
        <boxGeometry args={[s, 0.008, 0.008]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <mesh position={[0, s / 2, 0]}>
        <boxGeometry args={[0.008, s, 0.008]} />
        <meshBasicMaterial color="green" />
      </mesh>
      <mesh position={[0, 0, s / 2]}>
        <boxGeometry args={[0.008, 0.008, s]} />
        <meshBasicMaterial color="blue" />
      </mesh>
    </group>
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

  useFrame(() => {
    if (!robot) return;
    setRobotJointValues(robot, primaryJointStates, actuatedJointNames);
    if (ghostRobot && ghostJointStates) {
      setRobotJointValues(ghostRobot, ghostJointStates, actuatedJointNames);
    }
  });

  const eePosition = useMemo(() => {
    if (!kinematicsEngine || !endEffectorLink) return new THREE.Vector3();
    return kinematicsEngine.getEndEffectorPosition(primaryJointStates, endEffectorLink);
  }, [kinematicsEngine, endEffectorLink, primaryJointStates]);

  const jointPositions = useMemo(() => {
    if (!kinematicsEngine || !showAxes) return new Map<string, { pos: THREE.Vector3; isIK: boolean }>();
    const world = kinematicsEngine.computeFK(primaryJointStates);
    const m = new Map<string, { pos: THREE.Vector3; isIK: boolean }>();
    const ikSet = new Set(ikAncestorIndices);
    jointInfos.forEach((j) => {
      const idx = j.globalIndex;
      const parentMat = world.get(j.parentLinkName);
      if (parentMat) {
        const T = new THREE.Matrix4().copy(parentMat).multiply(j.originTransform);
        const pos = new THREE.Vector3().setFromMatrixPosition(T);
        m.set(j.name, { pos, isIK: ikSet.has(idx) });
      }
    });
    return m;
  }, [kinematicsEngine, primaryJointStates, showAxes, jointInfos, ikAncestorIndices]);

  if (!robot) return null;

  return (
    <>
      <group renderOrder={0}>
        <primitive object={robot} />
      </group>
      {ghostRobot && (
        <group renderOrder={1} visible={!!ghostJointStates}>
          <primitive object={ghostRobot} />
        </group>
      )}
      <EEMarker position={eePosition} />
      {showAxes &&
        Array.from(jointPositions.entries()).map((entry) => {
          const name = entry[0];
          const val = entry[1];
          return <JointAxes key={name} position={val.pos} isIKActive={val.isIK} />;
        })}
    </>
  );
}
