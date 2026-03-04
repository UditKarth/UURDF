import * as THREE from 'three';
import { useRobotStore } from '../store/useRobotStore';

export function IKStatusPanel() {
  const ikResult = useRobotStore((s) => s.ikResult);
  const ghostJointStates = useRobotStore((s) => s.ghostJointStates);
  const ikTarget = useRobotStore((s) => s.ikTarget);
  const setIKTarget = useRobotStore((s) => s.setIKTarget);
  const applyIKSolution = useRobotStore((s) => s.applyIKSolution);
  const discardIKSolution = useRobotStore((s) => s.discardIKSolution);
  const ikAncestorIndices = useRobotStore((s) => s.ikAncestorIndices);
  const primaryJointStates = useRobotStore((s) => s.primaryJointStates);
  const actuatedJointNames = useRobotStore((s) => s.actuatedJointNames);
  const jointInfos = useRobotStore((s) => s.jointInfos);

  const err = ikResult?.finalError ?? 0;
  const errColor = err < 0.001 ? 'text-green-400' : err < 0.005 ? 'text-yellow-400' : 'text-red-400';
  const canApply = ghostJointStates != null && ikResult?.success === true;

  const ancestorCount = ikAncestorIndices.length;
  const totalCount = actuatedJointNames.length;

  return (
    <div className="w-72 bg-[#22223a] border-l border-[#2a2a4a] flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-[#2a2a4a] text-[#e0e0e0] font-medium text-sm">
        IK
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
        <div>
          <label className="text-[#888] block mb-1">Target (m)</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={ikTarget.x.toFixed(4)}
              onChange={(e) =>
                setIKTarget(new THREE.Vector3(parseFloat(e.target.value) || 0, ikTarget.y, ikTarget.z))
              }
              className="w-16 bg-[#1a1a2e] border border-[#2a2a4a] rounded px-1.5 py-1 text-[#e0e0e0] text-xs"
              step={0.001}
            />
            <input
              type="number"
              value={ikTarget.y.toFixed(4)}
              onChange={(e) =>
                setIKTarget(new THREE.Vector3(ikTarget.x, parseFloat(e.target.value) || 0, ikTarget.z))
              }
              className="w-16 bg-[#1a1a2e] border border-[#2a2a4a] rounded px-1.5 py-1 text-[#e0e0e0] text-xs"
              step={0.001}
            />
            <input
              type="number"
              value={ikTarget.z.toFixed(4)}
              onChange={(e) =>
                setIKTarget(new THREE.Vector3(ikTarget.x, ikTarget.y, parseFloat(e.target.value) || 0))
              }
              className="w-16 bg-[#1a1a2e] border border-[#2a2a4a] rounded px-1.5 py-1 text-[#e0e0e0] text-xs"
              step={0.001}
            />
          </div>
        </div>

        <div>
          <span className="text-[#888]">Status: </span>
          {ikResult == null ? (
            <span className="text-[#888]">—</span>
          ) : ikResult.success ? (
            <span className="text-green-400">Converged ✓</span>
          ) : (
            <span className="text-red-400">Failed ✗</span>
          )}
        </div>

        {ikResult && (
          <>
            <div>
              <span className="text-[#888]">Iterations: </span>
              <span className="text-[#e0e0e0]">
                {ikResult.iterations} / 100
              </span>
            </div>
            <div>
              <span className="text-[#888]">Position error: </span>
              <span className={errColor}>{ikResult.finalError.toFixed(6)} m</span>
            </div>
            <div>
              <span className="text-[#888]">Manipulability: </span>
              <span className="text-[#e0e0e0]">
                {ikResult.manipulability.toExponential(2)}
              </span>
              {ikResult.nearSingularity && (
                <span className="ml-1 text-amber-400" title="Near singularity">
                  ⚠ Near Singularity
                </span>
              )}
            </div>
          </>
        )}

        <div className="text-[#888]">
          IK chain: {ancestorCount} / {totalCount} joints
        </div>

        {ghostJointStates != null && (
          <div>
            <div className="text-[#888] mb-1">Δθ (IK-active joints)</div>
            <ul className="text-xs space-y-0.5 max-h-24 overflow-y-auto">
              {ikAncestorIndices.map((idx) => {
                const name = actuatedJointNames[idx];
                const j = jointInfos.find((x) => x.name === name);
                const delta = j
                  ? (ghostJointStates[idx] ?? 0) - (primaryJointStates[idx] ?? 0)
                  : 0;
                const deg = (delta * 180) / Math.PI;
                return (
                  <li key={name} className="text-[#e0e0e0]">
                    {name}: {deg.toFixed(2)}°
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={applyIKSolution}
            disabled={!canApply}
            className="flex-1 py-1.5 px-2 rounded bg-[#00aaff] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0099dd]"
          >
            Apply Solution
          </button>
          <button
            type="button"
            onClick={discardIKSolution}
            className="flex-1 py-1.5 px-2 rounded bg-[#3a3a5a] text-[#e0e0e0] text-sm hover:bg-[#4a4a6a]"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
