# EV / Twin engineering workbench

A local Windows application for assembling a custom student EV from reviewed component specifications and testing it with the official **FASTSim 3.1.0** Python API. React + TypeScript, FastAPI, SQLite, Plotly and Three.js. The original demo dataset uses **hypothetical demonstration parts**, not manufactured products.

The supplied team documents now also have a separate [provisional team build](docs/TEAM_BUILD.md): three saved concepts, document-sourced parts/options, a purchase plan and explicit missing-system placeholders. These records are unverified document claims, not hypothetical manufacturer specifications. The team draft is already loaded in the current workspace; use `python -m scripts.load_team_project` after setup on a fresh checkout. Missing mass, payload and auxiliary demand remain unknown and block simulation. No demo physics is substituted.

The car now opens as a [finished concept with an interactive assembly explorer](docs/TEAM_BUILD.md#finished-concept-and-assembly-explorer). Click a body panel or choose a system to reveal its internal parts, inspect a component, then use Back or the Full car breadcrumb to return. All eight requested sensor types and twelve estimated mounts are inside Sensors & vision. Saved parts, source links and unknown engineering values are preserved; the concept bodywork and seating are illustrative.

The [current main draft](docs/TEAM_BUILD.md#current-drivetrain-and-chassis) uses **two user-selected brushless motors, 36 V and 500 W each**, from AliExpress item 3256809008940329. It retains rear-wheel chain drive, Ackermann steer-by-wire and no differential. Your team will fabricate the chassis from the linked **steel and PVC stock** and build the **ESP32-controlled motor-drive power circuitry**; no commercial BLDC controller purchase is selected. The [added drive hardware and THR-90 accelerator](docs/TEAM_BUILD.md#drive-hardware-and-team-fabrication) includes two mounting plates, two #420 chains, rear/motor sprocket pairs and a guard/adjustment bundle. The Body & frame and Powertrain views reveal schematic pipe members, both motor mounts and two chain paths. Geometry, joints, motor-sprocket fit, circuit ratings and installed masses remain unverified.

The main draft also includes the [user-selected UUGPOWER battery](docs/TEAM_BUILD.md#selected-battery): seller-listed 36 V, 15 Ah (540 Wh), with a 40 A maximum BMS discharge claim. Continuous/charge limits, regen support, installed mass and conflicting package dimensions remain unresolved.

## Run on Windows

Install Python **3.12** and Node.js **22.16 or newer** (with npm), then open PowerShell in this repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Setup.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\Start.ps1
```

Open **http://127.0.0.1:8000**. API documentation: **http://127.0.0.1:8000/docs**. Keep the terminal running; Ctrl+C stops it. The backend serves the built frontend, so only one server is needed. Setup requires internet; after installation and build, the application and bundled standard cycles work locally using system fonts.

The current workspace already has `.venv`, a project-local Node runtime under `.tools`, installed packages and a built frontend. `Start.ps1` is sufficient here. These ignored dependencies are not committed; fresh clones use Setup. No FASTSim source changes are necessary.

### Preview inside VS Code over SSH

Open this folder in your Remote - SSH window. The workspace starts the **EV / Twin: Start preview** task when the folder opens, reuses an existing healthy server, and configures port 8000 to open an editor preview. The integrated browser uses the SSH connection to reach the Windows app; no separate Mac SSH forwarding command is needed. Automatic startup requires a trusted workspace.

To open the app at any time, press **F5** and choose **EV / Twin: View car in VS Code**, or click **http://127.0.0.1:8000** in VS Code. The browser opens beside your code. Select **3D Vehicle Viewer** to inspect the sensor layout. If the folder was already open when these settings were added, run **Tasks: Run Task → EV / Twin: Start preview**, or reload the window once.

These settings use VS Code's [integrated browser and remote proxy](https://code.visualstudio.com/docs/debugtest/integrated-browser) and [automatic tasks](https://code.visualstudio.com/docs/debugtest/tasks).

## Use the workspace

1. **Component Library:** review the demonstration parts, duplicate or create parts, enter actual specifications, canonical units and datasheet references. Unknown fields remain blank. Parts can have arbitrary categories, specifications, notes, prices and custom parameters.
2. **Vehicle Builder:** select assemblies, enter payload and auxiliary load, review calculated mass/energy/power and compatibility messages, then save. Incomplete drafts can be saved; simulation requires valid inputs.
3. **Simulation Lab:** choose a build and UDDS, HWFET, US06 or a custom CSV. Run a drive-cycle, acceleration, hill or load scenario. Engine errors are shown; failed runs do not get fabricated results.
4. **Performance Results:** inspect achieved versus requested speed, SOC, power, derived current/torque/RPM and acceleration. Export the trace as CSV or a Markdown test report with assumptions, component snapshots and mapped FASTSim configuration.
5. **3D Vehicle Viewer:** orbit, zoom and click parts. Select a saved simulation to play its achieved speed and synchronized wheel rotation. This is a schematic visualization.
6. **Vehicle Comparison:** choose saved configurations or sweep payload, gearing, wheel size, cell capacity or peak motor rating; rank supported metrics. Motor and battery swaps use separately saved designs. Sweep changes are hypothetical overrides preserved in each result's component snapshot.
7. **Saved Projects:** inspect, duplicate and delete saved designs; reopen simulation history. Designs reference library components, so edits affect future runs. Past simulations retain their full input snapshots.

The home dashboard displays the active design, calculated metrics, model readiness, a 3D assembly and recent runs. No simulation numbers are prefilled before an engine run.

## Tests and demonstration

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Test.ps1
.\.venv\Scripts\python.exe -m scripts.demo
```

The demo runs an actual BEV UDDS simulation, saves it in SQLite, and writes `data/simulation_results/demo-udds.csv` and `demo-report.md`. See [validation evidence](docs/VALIDATION.md), [model contract](docs/MODELS.md) and [component/import guide](docs/DATA.md).

For frontend development, start the backend with `Start.ps1`, then run `npm run dev` inside `frontend/` (port 5173 proxies `/api` to port 8000). For browser checks with Edge installed and the production server running: `cd frontend; node scripts/smoke.mjs`.

## Source and data layout

```text
backend/
  api/           FastAPI endpoints, exports, experiment orchestration
  models/        Reserved for future simulator-specific typed models
  schemas/       Validated API contracts
  simulation/    FASTSim adapter, engine protocol, analytical extension
  components/    Supported specification fields and canonical units
  validation/    Assembly calculations and compatibility checks
  database/      SQLite JSON record persistence
  tests/         Unit, integration, API and simulator tests
frontend/src/
  components/    Shared UI
  pages/         Library, results, comparison
  vehicle-builder/  Assembly editor
  simulator/     Test configuration
  visualization/ Three.js schematic and playback
  dashboard/     Plotly charts
data/
  components/    Editable hypothetical component JSON
  vehicles/      Editable example design
  drive_cycles/  Custom CSV example
  simulation_results/ Generated CSV and reports (ignored)
docs/            Model limits, imports and test evidence
scripts/         Windows setup/start/test and Python demonstration
```

SQLite lives in `data/ev.sqlite` and is initialized from the demonstration JSON on first startup. Set `EV_DB` to use another database file. Back up the SQLite file while the server is stopped. Simulation outputs are stored in SQLite; exports are generated on demand. There is no cloud sync or user authentication; the server binds to loopback for local use.

## FASTSim provenance

Inspected the upstream [fastsim-3 branch](https://github.com/NatLabRockies/fastsim/tree/fastsim-3), revision `6a07d4d816c847d500315a4e5759e157853c563b`, whose project version is 3.1.0. Installed the official Windows Python wheel `fastsim==3.1.0`. The adapter uses this tested release's real classes and serialized data structures; it does not dynamically track later branch commits. Reference checkout `.vendor/fastsim` is ignored and unmodified. Official [documentation](https://natlabrockies.github.io/fastsim/) and notebooks are the integration reference.

This workbench provides preliminary longitudinal estimates, not certification or hardware validation. Read the explicit supported/unsupported behavior in [MODELS.md](docs/MODELS.md) before making component purchasing decisions. Repository code retains the existing Apache-2.0 license; FASTSim and frontend dependencies retain their respective licenses.
