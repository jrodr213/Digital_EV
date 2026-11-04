# EV / Twin interface redesign

Implemented in the existing React/TypeScript application on November 3, 2026. FastAPI endpoints, SQLite records, the Three.js scene and FASTSim calculations are retained. No dependencies were added.

## Workflows

- The garage opens first with a car dropdown and a single Open car action, and keeps the chosen car active across the overview, builder, viewer and simulation lab. Both the original two-motor car and the new single-motor chain/axle configuration remain available.
- Navigation groups design, simulation and saved work. The smaller-screen drawer supports keyboard focus, Escape, background isolation and reduced motion.
- The overview combines the interactive vehicle with configuration facts, model readiness and recorded runs. Listing claims, missing inputs and conditional demo estimates are distinguished from validated inputs.
- Configuration uses Vehicle, Powertrain, Chassis & wheels, Controls & sensors and Other systems sections. Drafts survive navigation within the session and stay separate for each design. Component specifications open directly from their selected assembly.
- The component registry includes filtering, pagination, a labeled editor, custom categories/JSON, imports, source references and confirmed deletion.
- The 3D workspace retains assembly exploration, exploded views, component inspection and recorded wheel motion. Isometric, front, side and top presets, reset and fit operate on the actual camera. Orbiting changes the preset indicator to Custom.
- Simulation separates test parameters, readiness, status and previous outputs. Required numeric inputs are validated, reset restores defaults, failures restore controls, and successful runs open recorded results. Navigation is disabled during a run so it cannot silently unmount the active request.
- Analytics separates Performance, Electrical and Engineering review. Charts use recorded samples, consistent units, unified tooltips, zoom/export and responsive sizing. Missing values remain unavailable. Replay remains available as an expandable section; comparison retains synchronized multi-run playback and real backend experiments.

## Shared interface and source files

| Files under `frontend/src/` | Responsibility |
| --- | --- |
| `styles.css`, `components/ui.tsx` | Color/spacing/type tokens, controls, focus states, responsive grids, tables, dialogs, loading and feedback |
| `App.tsx` | Grouped navigation, shared selection, mobile drawer, page loading and workflow wiring |
| `pages/CarSelector.tsx`, `pages/carSelector.css`, `vehicleFacts.ts` | Garage dropdown and common derivation of saved vehicle facts |
| `pages/Overview.tsx`, `pages/History.tsx`, `pages/Projects.tsx` | Overview, shared simulation history and saved projects |
| `vehicle-builder/Builder.tsx`, `pages/Library.tsx` | Grouped configuration, retained drafts and component editor |
| `simulator/Lab.tsx` | Parameters, validation, imports, simulation state and recorded-output entry points |
| `pages/Results.tsx`, `pages/Comparison.tsx`, `dashboard/Chart.tsx` | Results, engineering review, experiments and charts |
| `visualization/VehicleViewer.tsx`, `visualization/vehicleScene.ts`, `visualization/vehicleExplorer.css` | Interactive viewer, real camera presets, lighting, inspection and responsive layout |
| `visualization/DriveReplay.tsx`, `visualization/drivePlayback.css` | Replay presentation using existing recorded motion |

Reusable components include `Field`, `Metric`, `Panel`, `StatusPill`, `Alert`, `Busy`, `Skeleton`, `Blank`, `Messages`, `Modal` and `History`. Native dialogs handle focus trapping and Escape; fields associate labels and help text with their controls. Existing Lucide icons, Plotly and Three.js are reused.

Pages and visualization modules load on demand. Plotly is not requested for the garage or overview. The production entry chunk is approximately 267 kB (83 kB gzip); the existing Three.js viewer and Plotly remain larger lazy chunks. Selected component lists and chart series are memoized to avoid unnecessary scene reconstruction or chart updates.

## Validation

| Check | Result |
| --- | --- |
| Full backend test suite | 92 passed |
| Frontend unit tests | 18 passed across 4 files |
| TypeScript project check | Passed |
| Production Vite build | Passed |
| Lint | No lint script or configuration exists in this repository |
| `workstation-smoke.mjs` | Passed: all eight pages, drafts/new design, component and vehicle saves, imports, validation/reset, failed run/recovery, actual FASTSim request, exports, replay, camera controls and comparison |
| Real chart data | Browser assertions compare every speed and SOC value directly with the successful API response |
| Responsive browser checks | Passed at 1440, 1024 and 390 px; no document-level horizontal overflow |
| Existing workflow regression checks | `car-selection-smoke.mjs`, `demo-review-smoke.mjs` and `drive-playback-smoke.mjs` passed |
| Browser runtime errors | None in the above checks |
| Original database preservation | All 81 components, 5 vehicles and 9 saved results match the pre-redesign snapshot; no imported cycles were added to the original database |

Browser saves and simulations ran against a disposable SQLite backup, not the user's working database. The browser script also verifies that all preexisting records in that backup remain unchanged. It requires `EV_QA_ALLOW_WRITES=1` because it creates QA components, vehicles, cycles and simulation results.

To repeat the complete browser check, stop any existing local preview, then create a disposable database and start the application from the repository root:

```powershell
New-Item -ItemType Directory -Path .test-tmp-ui-qa -Force | Out-Null
@'
import sqlite3
source = sqlite3.connect('file:data/ev.sqlite?mode=ro', uri=True)
destination = sqlite3.connect('.test-tmp-ui-qa/ev.sqlite')
source.backup(destination)
destination.close()
source.close()
'@ | .\.venv\Scripts\python.exe -
$env:EV_DB = Join-Path (Get-Location) '.test-tmp-ui-qa/ev.sqlite'
powershell -ExecutionPolicy Bypass -File .\scripts\Start.ps1
```

In another PowerShell terminal:

```powershell
cd frontend
$env:EV_QA_ALLOW_WRITES = '1'
..\.tools\node-v22.16.0-win-x64\node.exe scripts/workstation-smoke.mjs
```

Chrome is used by default; `EV_BROWSER=msedge` selects installed Edge. Stop the QA preview afterward and remove `Env:EV_DB` from the launching shell before starting the normal working database again.

Visual evidence: [overview](screenshots/redesign-overview.png), [configuration](screenshots/redesign-configuration.png), [simulation](screenshots/redesign-simulation.png), [analytics](screenshots/redesign-analytics.png), [3D workspace](screenshots/redesign-3d-workspace.png), [tablet](screenshots/redesign-tablet.png) and [phone](screenshots/redesign-mobile.png). These screenshots include explicitly labeled demo runs in the QA database.

## Remaining limits

- The backend completes simulations as a single request; it does not provide cancellation or live progress. The interface reports that limitation instead of offering a nonfunctional Stop button.
- Unverified hardware ratings and missing masses still prevent standard simulations. Demo runs retain their assumption ledger. Geometry remains an illustrative concept, and the redesign makes no new physical-validity claims.
- Vite reports its existing large-chunk warning for the lazily loaded Plotly and Three.js modules. They remain bundled for offline use.
- Builder drafts are retained for this browser session, not persisted across a page reload until saved.

See [model boundaries](MODELS.md) and [validation evidence](VALIDATION.md) for the underlying simulation limitations. The earlier single-motor dataset and startup synchronization changes are documented in [TEAM_BUILD.md](TEAM_BUILD.md#single-motor-alternative-and-car-selection).
