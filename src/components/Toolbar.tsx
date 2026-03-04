import { useRobotStore } from '../store/useRobotStore';
import { getAncestorJoints } from '../core/URDFParser';

interface ToolbarProps {
  onUploadClick: () => void;
}

const CAMERA_PRESETS = ['Front', 'Side', 'Top', 'Iso'];

export function Toolbar({ onUploadClick }: ToolbarProps) {
  const resetToZero = useRobotStore((s) => s.resetToZero);
  const resetToCenter = useRobotStore((s) => s.resetToCenter);
  const showAxes = useRobotStore((s) => s.showAxes);
  const setShowAxes = useRobotStore((s) => s.setShowAxes);
  const endEffectorLink = useRobotStore((s) => s.endEffectorLink);
  const setEndEffectorLink = useRobotStore((s) => s.setEndEffectorLink);
  const linkNames = useRobotStore((s) => s.linkNames);
  const parentMap = useRobotStore((s) => s.parentMap);
  const setCameraPreset = useRobotStore((s) => s.setCameraPreset);

  const getDOF = (linkName: string) => {
    if (!parentMap) return 0;
    return getAncestorJoints(parentMap, linkName).length;
  };

  return (
    <div className="h-10 bg-[#22223a] border-b border-[#2a2a4a] flex items-center gap-4 px-3 flex-shrink-0">
      <button
        type="button"
        onClick={onUploadClick}
        className="px-3 py-1.5 rounded bg-[#3a3a5a] text-[#e0e0e0] text-sm hover:bg-[#4a4a6a]"
      >
        Upload URDF
      </button>
      <button
        type="button"
        onClick={resetToZero}
        className="px-2 py-1 rounded text-[#e0e0e0] text-sm hover:bg-[#3a3a5a]"
      >
        Reset to Zero
      </button>
      <button
        type="button"
        onClick={resetToCenter}
        className="px-2 py-1 rounded text-[#e0e0e0] text-sm hover:bg-[#3a3a5a]"
      >
        Reset to Center
      </button>
      <label className="flex items-center gap-2 text-[#e0e0e0] text-sm">
        <input
          type="checkbox"
          checked={showAxes}
          onChange={(e) => setShowAxes(e.target.checked)}
          className="rounded"
        />
        Show Axes
      </label>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[#888]">EE:</span>
        <select
          value={endEffectorLink}
          onChange={(e) => setEndEffectorLink(e.target.value)}
          className="bg-[#1a1a2e] border border-[#2a2a4a] rounded px-2 py-1 text-[#e0e0e0] min-w-[140px]"
        >
          {linkNames.length === 0 && <option value="">—</option>}
          {linkNames.map((name) => (
            <option key={name} value={name}>
              {name} ({getDOF(name)} DOF)
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-1 ml-auto">
        {CAMERA_PRESETS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => setCameraPreset(label)}
            className="px-2 py-1 rounded text-[#888] text-xs hover:bg-[#3a3a5a] hover:text-[#e0e0e0]"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
