import { useCallback, useState } from 'react';
import JSZip from 'jszip';
import { useURDFLoader } from '../hooks/useURDFLoader';

interface FileUploaderProps {
  onClose: () => void;
  visible: boolean;
}

export function FileUploader({ onClose, visible }: FileUploaderProps) {
  const { loadFromString } = useURDFLoader();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const buildFileMap = useCallback(async (files: File[]): Promise<Map<string, Blob>> => {
    const map = new Map<string, Blob>();
    for (const f of files) {
      if (f.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(f);
        for (const [path, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          const blob = await entry.async('blob');
          const normalized = path.replace(/^[^/]+[/]/, '').replace(/\\/g, '/');
          map.set(normalized, blob);
          const base = path.split('/').pop() || path;
          if (base !== normalized) map.set(base, blob);
        }
      } else {
        const name = (f as File).name;
        const path = (f as File).webkitRelativePath || name;
        const normalized = path.replace(/^[^/]+[/]/, '').replace(/\\/g, '/');
        map.set(normalized, f);
        map.set(name, f);
      }
    }
    return map;
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setError(null);
      setLoading(true);
      const files = Array.from(e.dataTransfer.files);
      const urdfFile = files.find((f) => f.name.endsWith('.urdf') || f.name.endsWith('.xacro'));
      if (!urdfFile) {
        setError('No .urdf or .xacro file found.');
        setLoading(false);
        return;
      }
      try {
        const text = await urdfFile.text();
        const urdfContent = text.replace(/xacro/g, 'robot'); // minimal xacro strip; real xacro needs a parser
        const fileMap = await buildFileMap(files);
        const workingPath = '';
        loadFromString(urdfContent, { fileMap, workingPath });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load URDF');
      } finally {
        setLoading(false);
      }
    },
    [buildFileMap, loadFromString, onClose]
  );

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const fileList = e.target.files;
      if (!fileList?.length) return;
      setLoading(true);
      const files = Array.from(fileList);
      const urdfFile = files.find((f) => f.name.endsWith('.urdf') || f.name.endsWith('.xacro'));
      if (!urdfFile) {
        setError('No .urdf or .xacro file found.');
        setLoading(false);
        return;
      }
      try {
        const text = await urdfFile.text();
        const urdfContent = text.replace(/xacro/g, 'robot');
        const fileMap = await buildFileMap(files);
        loadFromString(urdfContent, { fileMap });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load URDF');
      } finally {
        setLoading(false);
      }
      e.target.value = '';
    },
    [buildFileMap, loadFromString, onClose]
  );

  const handleDemo = useCallback(
    (urdf: string) => {
      setError(null);
      try {
        loadFromString(urdf, {});
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load demo');
      }
    },
    [loadFromString, onClose]
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#22223a] border border-[#2a2a4a] rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[#e0e0e0] font-semibold mb-4">Load URDF</h2>
        <div
          className="border-2 border-dashed border-[#3a3a5a] rounded-lg p-8 text-center text-[#888] mb-4 hover:border-[#00aaff] transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {loading ? (
            <p>Loading…</p>
          ) : (
            <>
              <p className="mb-2">Drop .urdf / .xacro + meshes, or a .zip</p>
              <label className="cursor-pointer text-[#00aaff] hover:underline">
                Browse
                <input
                  type="file"
                  multiple
                  accept=".urdf,.xacro,.zip,.stl,.dae,.obj"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </>
          )}
        </div>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <div className="border-t border-[#2a2a4a] pt-4">
          <p className="text-[#888] text-sm mb-2">Demo robots:</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleDemo(DEMO_3DOF)}
              className="px-3 py-1.5 rounded bg-[#3a3a5a] text-[#e0e0e0] text-sm hover:bg-[#4a4a6a]"
            >
              3-DOF arm
            </button>
            <button
              type="button"
              onClick={() => handleDemo(DEMO_6DOF)}
              className="px-3 py-1.5 rounded bg-[#3a3a5a] text-[#e0e0e0] text-sm hover:bg-[#4a4a6a]"
            >
              6-DOF arm
            </button>
            <button
              type="button"
              onClick={() => handleDemo(DEMO_BRANCHING)}
              className="px-3 py-1.5 rounded bg-[#3a3a5a] text-[#e0e0e0] text-sm hover:bg-[#4a4a6a]"
            >
              Branching 2-arm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const DEMO_3DOF = `<?xml version="1.0"?>
<robot name="arm3">
  <link name="base_link">
    <visual><geometry><cylinder radius="0.05" length="0.1"/></geometry></visual>
  </link>
  <joint name="j1" type="revolute">
    <parent link="base_link"/><child link="link1"/>
    <origin xyz="0 0 0.05" rpy="0 0 0"/>
    <axis xyz="0 0 1"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="link1">
    <visual><geometry><box size="0.02 0.02 0.2"/></geometry></visual>
  </link>
  <joint name="j2" type="revolute">
    <parent link="link1"/><child link="link2"/>
    <origin xyz="0 0 0.1" rpy="0 0 0"/>
    <axis xyz="0 1 0"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="link2">
    <visual><geometry><box size="0.02 0.02 0.2"/></geometry></visual>
  </link>
  <joint name="j3" type="revolute">
    <parent link="link2"/><child link="ee"/>
    <origin xyz="0 0 0.1" rpy="0 0 0"/>
    <axis xyz="0 1 0"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="ee">
    <visual><geometry><sphere radius="0.03"/></geometry></visual>
  </link>
</robot>
`;

const DEMO_6DOF = `<?xml version="1.0"?>
<robot name="arm6">
  <link name="base_link">
    <visual><geometry><cylinder radius="0.06" length="0.08"/></geometry></visual>
  </link>
  <joint name="j1" type="revolute">
    <parent link="base_link"/><child link="link1"/>
    <origin xyz="0 0 0.04" rpy="0 0 0"/>
    <axis xyz="0 0 1"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="link1">
    <visual><geometry><box size="0.04 0.04 0.12"/></geometry></visual>
  </link>
  <joint name="j2" type="revolute">
    <parent link="link1"/><child link="link2"/>
    <origin xyz="0 0 0.06" rpy="0 0 0"/>
    <axis xyz="0 1 0"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="link2">
    <visual><geometry><box size="0.04 0.04 0.12"/></geometry></visual>
  </link>
  <joint name="j3" type="revolute">
    <parent link="link2"/><child link="link3"/>
    <origin xyz="0 0 0.06" rpy="0 0 0"/>
    <axis xyz="0 1 0"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="link3">
    <visual><geometry><box size="0.04 0.04 0.08"/></geometry></visual>
  </link>
  <joint name="j4" type="revolute">
    <parent link="link3"/><child link="link4"/>
    <origin xyz="0 0 0.04" rpy="0 0 0"/>
    <axis xyz="1 0 0"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="link4">
    <visual><geometry><box size="0.03 0.03 0.06"/></geometry></visual>
  </link>
  <joint name="j5" type="revolute">
    <parent link="link4"/><child link="link5"/>
    <origin xyz="0 0 0.03" rpy="0 0 0"/>
    <axis xyz="0 1 0"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="link5">
    <visual><geometry><box size="0.02 0.02 0.04"/></geometry></visual>
  </link>
  <joint name="j6" type="revolute">
    <parent link="link5"/><child link="ee"/>
    <origin xyz="0 0 0.02" rpy="0 0 0"/>
    <axis xyz="1 0 0"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="ee">
    <visual><geometry><sphere radius="0.02"/></geometry></visual>
  </link>
</robot>
`;

const DEMO_BRANCHING = `<?xml version="1.0"?>
<robot name="two_arm">
  <link name="base_link">
    <visual><geometry><box size="0.2 0.1 0.05"/></geometry></visual>
  </link>
  <joint name="left_j1" type="revolute">
    <parent link="base_link"/><child link="left_link1"/>
    <origin xyz="-0.06 0 0" rpy="0 0 0"/>
    <axis xyz="0 0 1"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="left_link1">
    <visual><geometry><box size="0.02 0.02 0.15"/></geometry></visual>
  </link>
  <joint name="left_j2" type="revolute">
    <parent link="left_link1"/><child link="left_ee"/>
    <origin xyz="0 0 0.075" rpy="0 0 0"/>
    <axis xyz="0 1 0"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="left_ee">
    <visual><geometry><sphere radius="0.02"/></geometry></visual>
  </link>
  <joint name="right_j1" type="revolute">
    <parent link="base_link"/><child link="right_link1"/>
    <origin xyz="0.06 0 0" rpy="0 0 0"/>
    <axis xyz="0 0 1"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="right_link1">
    <visual><geometry><box size="0.02 0.02 0.15"/></geometry></visual>
  </link>
  <joint name="right_j2" type="revolute">
    <parent link="right_link1"/><child link="right_ee"/>
    <origin xyz="0 0 0.075" rpy="0 0 0"/>
    <axis xyz="0 1 0"/><limit lower="-3.14" upper="3.14"/>
  </joint>
  <link name="right_ee">
    <visual><geometry><sphere radius="0.02"/></geometry></visual>
  </link>
</robot>
`;
