import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useRobotStore } from '../store/useRobotStore';

const PRESETS: Record<string, [number, number, number]> = {
  Front: [0, 0, 3],
  Side: [3, 0, 0],
  Top: [0, 3, 0.01],
  Iso: [2, 2, 2],
};

export function CameraController() {
  const camera = useThree((s) => s.camera);
  const cameraPreset = useRobotStore((s) => s.cameraPreset);

  useEffect(() => {
    const pos = PRESETS[cameraPreset];
    if (pos) {
      camera.position.set(pos[0], pos[1], pos[2]);
      camera.updateMatrixWorld();
    }
  }, [camera, cameraPreset]);

  return null;
}
