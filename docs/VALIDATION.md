# Validation evidence

Executed on Windows, Python 3.12, official FASTSim Windows wheel 3.1.0, project-local Node 22.16.0, React production build. This validates implementation behavior, not the accuracy of a real student vehicle.

| Check | Result |
| --- | --- |
| Installed FASTSim version | 3.1.0, asserted in test and adapter |
| Upstream branch inspected | fastsim-3, revision `6a07d4d816c847d500315a4e5759e157853c563b` |
| Official example | Bundled Ford Fusion + UDDS via official `SimDrive`, successful |
| Bundled BEV reference comparison | Renault Zoe native and custom schema mapping agree in cumulative chemical energy and distance to relative tolerance 1e-9 |
| Mass, pack, units, voltage/current compatibility | Passing automated tests |
| Required inputs, unit mismatch, unsupported maps/regen, invalid cycles | Passing rejection tests |
| SQLite persistence | Passing save/load test across new Store instances |
| Full custom BEV UDDS | Successful, target trace followed |
| Reproducibility | Two independent runs produce identical complete sample arrays and summary dictionaries |
| Acceleration, hill, load scenarios | Successful engine runs |
| API integration | Component import validation, run, saved result, CSV, report, experiment ranking and 404 checks pass |
| Engine failure | Deliberate engine failure returns 422 and saves no substitute results |
| Backend suite | **24 passed**, one dependency deprecation warning |
| Frontend unit suite | **4 passed**: unavailable-value presentation, numeric precision, request serialization, engine-error propagation |
| TypeScript + Vite production build | Successful |
| npm dependency audit | 0 reported vulnerabilities after updating Vitest to 5.0.5 |
| Headless Edge integration | All eight pages, component creation/deletion, simulation submission, Plotly rendering, CSV download, Three.js canvas and playback, mobile layout; no browser page errors |
| Running local server | Uvicorn loopback health/API/static page successful |

The reference parity test uses the bundled vehicle's original motor map as an independent test override, since the application adapter intentionally substitutes the user's flat scalar efficiency. Chassis/mass/energy/power/efficiency mappings otherwise pass through the custom adapter. This demonstrates correct mapping, not calibration of hypothetical components.

## Hypothetical demo result

The sample vehicle has a 730 kg loaded mass, a 345.6 V nominal pack, 20.736 kWh nominal energy and 16.5888 kWh usable energy. On a full UDDS run:

- Achieved distance: **7.4505097659 mi**
- Chemical energy consumed: **0.8795074334 kWh**
- Consumption: **118.0466117182 Wh/mi**
- Projected repeating-cycle range: **140.5275404227 mi** (extrapolated, conditional)
- Recovered battery terminal electrical energy: **0.2203697173 kWh**
- Final SOC: **0.8575854826**, from an initial 0.9

Separate analytical estimates are 4.32 s to 30 mph, 9.83 s to 60 mph and a 74.96 mph RPM/gearing speed ceiling. These are **unvalidated quasi-static estimates**, not measured performance or torque-constrained native FASTSim outputs.

Run `python -m scripts.demo` in the project environment to regenerate full CSV and Markdown report files in `data/simulation_results/`. SQLite records retain complete snapshots.

## Re-run

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q --basetemp=.test-tmp
cd frontend
npm test
npm run build
# With Start.ps1 running in another terminal and Edge installed:
node scripts/smoke.mjs
```

On this managed Windows workspace, Node/Vite build tools and Edge required filesystem access outside the restricted shell sandbox; the commands succeeded with that access. Pytest temporary storage is kept inside the workspace. The test dependency emits a Starlette notice about future `httpx2` migration; no test is skipped. Vite warns about the Plotly/Three.js bundle size (~5.65 MB uncompressed, ~1.69 MB gzip); this local version prioritizes bundled offline graphs and visualization over initial download size.

Browser evidence is saved in [dashboard](screenshots/dashboard.png), [results](screenshots/results.png) and [mobile](screenshots/mobile.png) screenshots. The browser smoke test writes real demo runs to the local database and creates then deletes a test sensor; it is intended for a disposable demo workspace.

## Remaining validation boundaries

No real manufacturer dataset, bench test, measured vehicle trace or CAD geometry was supplied. Thermal, handling, braking and structural validation have not been performed. The scalar power-flow approximation can exceed a custom motor's torque/RPM envelope; warnings and separate estimates expose that limitation. Asymmetric battery efficiency, torque/RPM maps, regen-disabled builds and interactive placement/CAD import are not implemented in the supported adapter. See [MODELS.md](MODELS.md).
