import { useRobotStore } from '../store/useRobotStore';

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}
function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function JointSliderPanel() {
  const jointInfos = useRobotStore((s) => s.jointInfos);
  const primaryJointStates = useRobotStore((s) => s.primaryJointStates);
  const setJointValue = useRobotStore((s) => s.setJointValue);
  const ikAncestorIndices = useRobotStore((s) => s.ikAncestorIndices);

  if (jointInfos.length === 0) {
    return (
      <div className="w-64 bg-[#22223a] border-r border-[#2a2a4a] p-3 text-[#e0e0e0] text-sm">
        <p className="text-[#888]">Load a URDF to see joints.</p>
      </div>
    );
  }

  return (
    <div className="w-64 bg-[#22223a] border-r border-[#2a2a4a] flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-[#2a2a4a] text-[#e0e0e0] font-medium text-sm">
        Joints
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {jointInfos.map((j) => {
          const value = primaryJointStates[j.globalIndex] ?? 0;
          const isRad = j.type === 'revolute' || j.type === 'continuous';
          const { lower, upper } = j.limits;
          const displayValue = isRad ? toDegrees(value) : value;
          const displayMin = isRad ? toDegrees(lower) : lower;
          const displayMax = isRad ? toDegrees(upper) : upper;
          const isIKActive = ikAncestorIndices.includes(j.globalIndex);
          const typeBadge = j.type === 'revolute' ? 'R' : j.type === 'continuous' ? 'C' : j.type === 'prismatic' ? 'P' : '';

          return (
            <div
              key={j.name}
              className={`rounded px-2 py-1.5 ${
                isIKActive ? 'bg-[#2a2a5a] border-l-2 border-[#00aaff]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span
                  className="text-[#e0e0e0] text-xs truncate flex-1"
                  title={j.name}
                >
                  {j.name}
                </span>
                <span className="text-[#6e6e8e] text-[10px]">{typeBadge}</span>
                <button
                  type="button"
                  className="text-[#888] hover:text-[#e0e0e0] text-xs px-1"
                  onClick={() => setJointValue(j.globalIndex, 0)}
                  title="Zero"
                >
                  ⊘
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={displayMin}
                  max={displayMax}
                  step={isRad ? 0.5 : 0.001}
                  value={displayValue}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setJointValue(j.globalIndex, isRad ? toRadians(v) : v);
                  }}
                  className="flex-1 h-1.5 accent-[#00aaff]"
                />
                <input
                  type="number"
                  value={displayValue.toFixed(2)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) setJointValue(j.globalIndex, isRad ? toRadians(v) : v);
                  }}
                  className="w-14 bg-[#1a1a2e] border border-[#2a2a4a] rounded px-1 py-0.5 text-[#e0e0e0] text-xs"
                  step={isRad ? 1 : 0.01}
                />
              </div>
              <div className="text-[10px] text-[#6e6e8e] mt-0.5">
                {isRad ? '°' : 'm'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
