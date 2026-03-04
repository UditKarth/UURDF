# UURDF

A single-page **URDF visualizer** for robot models: load URDF files, inspect the kinematic tree, drive joints with sliders (forward kinematics), and solve inverse kinematics with a DLS (damped least-squares) solver and SVD. Built with React, Three.js, and Vite.

## Features

- **Load URDF** — Upload a `.urdf` (or `.xacro`) plus meshes, or a `.zip` containing them. Built-in demo robots (3-DOF, 6-DOF, branching two-arm) load with one click.
- **Forward kinematics** — Per-joint sliders update the robot pose in real time. Optional joint axes overlay.
- **Inverse kinematics** — Drag the end-effector target (or use the 3D gizmo). DLS IK with SVD runs in the background; a ghost preview shows the solution before you apply or discard it.
- **Run Showcase** — Automated demo: loads a 6-DOF arm (if needed), runs an FK animation, then solves IK to a target and applies the result.
- **Camera** — Presets (Front, Side, Top, Iso) and orbit/pan/zoom in the viewport.

## Tech stack

- **React 19** + **TypeScript** + **Vite**
- **Three.js** + **@react-three/fiber** + **@react-three/drei** for 3D
- **urdf-loader** for parsing URDF
- **Zustand** for state
- **Tailwind CSS** for UI

## Getting started

### Prerequisites

- Node.js 20+ and npm

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Build and preview

```bash
npm run build
npm run preview
```

## Loading a robot

1. **Upload URDF** — Click “Upload URDF” and either drop files (`.urdf`/`.xacro` + meshes, or a `.zip`) or use “Browse”. Mesh paths in the URDF are resolved from the uploaded files (e.g. `package://...` is stripped and matched to the file map).
2. **Demo robots** — In the upload modal, use “3-DOF arm”, “6-DOF arm”, or “Branching 2-arm” to load built-in URDFs.
3. **Run Showcase** — With or without a loaded robot, click “Run Showcase” to run the automated FK + IK demo (it will load the 6-DOF demo if none is loaded).

Use the **EE** dropdown to choose which link is the end-effector for IK. **Reset to Zero** / **Reset to Center** set all joint values to zero or to the middle of their limits.

## Deployment (GitHub Pages)

1. In the repo: **Settings → Pages** → **Build and deployment** → set **Source** to **GitHub Actions**.
2. Push to `main`. The [included workflow](.github/workflows/deploy-pages.yml) builds the app and deploys the `dist` output to GitHub Pages.
3. **Project site** (e.g. `https://<user>.github.io/UURDF/`): the workflow uses `base: './'` by default.  
   **User site** (repo named `username.github.io`): the workflow sets `VITE_BASE=/` automatically.

`vite.config.ts` uses `base: process.env.VITE_BASE ?? './'` so the same repo works for both project and user sites.

## Project structure (high level)

| Area | Description |
|------|-------------|
| `src/core/` | URDF parsing, joint/link helpers, `KinematicsEngine` (FK, Jacobian, DLS IK), `SVDSolver` |
| `src/store/` | Zustand store: robot, joint state, IK target/result, UI flags |
| `src/components/` | Viewport, `RobotModel`, `JointSliderPanel`, `IKStatusPanel`, `IKTargetGizmo`, Toolbar, FileUploader |
| `src/hooks/` | URDF loading, IK solver tick, showcase sequence |
| `src/demo/` | Demo URDF strings (3-DOF, 6-DOF, branching) |

## License

MIT (or your chosen license).
