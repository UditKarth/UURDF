import { Canvas } from '@react-three/fiber';
import { Grid, ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RobotModel } from './RobotModel';
import { IKTargetGizmo } from './IKTargetGizmo';
import { CameraController } from './CameraController';

export function Viewport() {
  return (
    <div className="flex-1 min-h-0 bg-[#1a1a2e]">
      <Canvas
        camera={{ position: [2, 2, 2], fov: 50, near: 0.01, far: 100 }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1,
        }}
      >
        <color attach="background" args={['#1a1a2e']} />
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 10, 5]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <Grid
          infiniteGrid
          fadeDistance={30}
          cellSize={0.1}
          sectionSize={1}
          sectionColor="#6e6e6e"
          cellColor="#3a3a3a"
        />
        <ContactShadows
          position={[0, -0.001, 0]}
          opacity={0.4}
          scale={10}
          blur={2.5}
          far={4}
        />
        <Environment preset="warehouse" background={false} />
        <OrbitControls makeDefault />
        <CameraController />
        <RobotModel />
        <IKTargetGizmo />
      </Canvas>
    </div>
  );
}
