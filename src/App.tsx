import { useState } from 'react';
import { Toolbar } from './components/Toolbar';
import { Viewport } from './components/Viewport';
import { JointSliderPanel } from './components/JointSliderPanel';
import { IKStatusPanel } from './components/IKStatusPanel';
import { FileUploader } from './components/FileUploader';
import { useIKSolver } from './hooks/useIKSolver';

function App() {
  const [uploadOpen, setUploadOpen] = useState(false);
  useIKSolver();

  return (
    <div className="h-screen flex flex-col bg-[#1a1a2e]">
      <Toolbar onUploadClick={() => setUploadOpen(true)} />
      <div className="flex-1 flex min-h-0">
        <JointSliderPanel />
        <Viewport />
        <IKStatusPanel />
      </div>
      <FileUploader visible={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}

export default App;
