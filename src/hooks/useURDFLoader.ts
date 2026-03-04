import { useCallback } from 'react';
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { useRobotStore } from '../store/useRobotStore';

export interface LoadURDFOptions {
  /** Map from path suffix (e.g. "meshes/link0.stl") to Blob/File content. */
  fileMap?: Map<string, Blob>;
  workingPath?: string;
}

function loadMeshFromBlob(
  blob: Blob,
  ext: string,
  done: (obj: THREE.Object3D | null, err?: Error) => void
): void {
  const url = URL.createObjectURL(blob);
  const cleanup = () => URL.revokeObjectURL(url);
  if (ext === 'stl') {
    const loader = new STLLoader();
    loader.load(
      url,
      (geom) => {
        cleanup();
        const mesh = new THREE.Mesh(
          geom,
          new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.3, roughness: 0.7 })
        );
        done(mesh);
      },
      undefined,
      (e) => {
        cleanup();
        done(null, e as Error);
      }
    );
          } else if (ext === 'dae') {
            const loader = new ColladaLoader();
            loader.load(
              url,
              (dae) => {
                cleanup();
                done(dae?.scene ?? new THREE.Group());
              },
      undefined,
              (e) => {
                cleanup();
                done(null, e as Error);
              }
            );
          } else {
            cleanup();
            done(null, new Error(`Unsupported mesh format: ${ext}`));
          }
}

/**
 * Load and parse URDF content, then pass the robot to the store.
 * If fileMap is provided, mesh paths are resolved from it (package:// stripped).
 */
export function useURDFLoader() {
  const loadURDF = useRobotStore((s) => s.loadURDF);

  const loadFromString = useCallback(
    (urdfContent: string, options: LoadURDFOptions = {}) => {
      const loader = new URDFLoader();
      const { fileMap, workingPath = '' } = options;
      loader.workingPath = workingPath;
      if (fileMap && fileMap.size > 0) {
        loader.loadMeshCb = (path: string, _manager: THREE.LoadingManager, done) => {
          const normalized = path.replace(/^package:\/[^/]+\//, '').replace(/^\//, '');
          let blob: Blob | undefined = fileMap.get(normalized);
          if (!blob) {
            for (const [key, value] of fileMap) {
              if (key.endsWith(normalized) || normalized.endsWith(key)) {
                blob = value;
                break;
              }
            }
          }
          if (!blob) {
            loadMeshFromBlob(new Blob(), 'stl', (obj, err) => done(obj ?? new THREE.Group(), err));
            return;
          }
          const ext = (path.split('.').pop() || '').toLowerCase();
          loadMeshFromBlob(blob, ext, (obj, err) => done(obj ?? new THREE.Group(), err));
        };
      }
      try {
        loader.workingPath = workingPath;
        const robot = loader.parse(urdfContent);
        loadURDF(robot);
        return robot;
      } catch (e) {
        throw e;
      }
    },
    [loadURDF]
  );

  return { loadFromString };
}
