import { useRef, useEffect } from 'react';
import { TransformControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useRobotStore } from '../store/useRobotStore';

const _world = new THREE.Vector3();

export function IKTargetGizmo() {
  const innerRef = useRef<THREE.Group>(null);
  const ikTarget = useRobotStore((s) => s.ikTarget);
  const setIKTarget = useRobotStore((s) => s.setIKTarget);
  const primaryJointStates = useRobotStore((s) => s.primaryJointStates);
  const endEffectorLink = useRobotStore((s) => s.endEffectorLink);
  const kinematicsEngine = useRobotStore((s) => s.kinematicsEngine);

  const eePosition = kinematicsEngine && endEffectorLink
    ? kinematicsEngine.getEndEffectorPosition(primaryJointStates, endEffectorLink)
    : new THREE.Vector3();

  const error = ikTarget.clone().sub(eePosition);
  const errLen = error.length();
  const lineColor = errLen < 0.001 ? 0x00ff00 : errLen < 0.005 ? 0xffff00 : 0xff0000;

  useEffect(() => {
    if (innerRef.current) innerRef.current.position.set(0, 0, 0);
  }, [ikTarget.x, ikTarget.y, ikTarget.z]);

  const handleObjectChange = () => {
    if (innerRef.current) {
      innerRef.current.getWorldPosition(_world);
      setIKTarget(_world.clone());
    }
  };

  if (!endEffectorLink) return null;

  return (
    <group position={[ikTarget.x, ikTarget.y, ikTarget.z]}>
      <TransformControls mode="translate" onObjectChange={handleObjectChange}>
        <group ref={innerRef}>
          <mesh>
            <sphereGeometry args={[0.02, 16, 16]} />
            <meshBasicMaterial color="#00aaff" />
          </mesh>
        </group>
      </TransformControls>
      <Line
        points={[
          new THREE.Vector3(-error.x, -error.y, -error.z),
          new THREE.Vector3(0, 0, 0),
        ]}
        color={lineColor}
      />
    </group>
  );
}
