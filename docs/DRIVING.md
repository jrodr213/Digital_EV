# Interactive test drive

Run the existing application with `powershell -ExecutionPolicy Bypass -File .\scripts\Start.ps1`, open **http://127.0.0.1:8000**, choose a saved car, then click **Test drive** in the Home Dashboard's vehicle explorer or the **3D Vehicle Viewer**. Review the engineering inputs, use **Apply inputs & reset** after edits, and choose **Start driving**. Escape returns to the previous workspace view. No new project, database, or hosted service is involved.

The selected saved car supplies the parts, including the current two-motor direct-drive layout and the separate single-motor chain-drive alternative. A historical FASTSim playback selection does not replace the current car's driving configuration.

## Controls and environments

| Control | Action |
| --- | --- |
| W / Up | Forward torque |
| S / Down | Reverse torque (also opposes forward motion) |
| A / Left, D / Right | Steer |
| Space | Four-wheel friction brakes |
| C | Driver POV → chase → free camera |
| R | Reset car, distance, energy and starting SOC; pause |
| P | Pause / resume |
| Escape / Exit | Return to previous view |

Touch controls appear on small screens and devices with coarse pointers; hold the accelerator/steering buttons. Releasing or cancelling a touch releases its input. Losing focus or hiding the tab pauses the drive and clears inputs. Free camera uses drag to orbit, right-drag to pan, and scroll/pinch to zoom. Engineering settings include driver eye height and chase distance/height. The driver follows chassis motion and the chase camera casts against world colliders to shorten its view near obstacles.

The paved track has a 250 m marked straight, return straight, curved ends and braking zone. Hill lanes are 5%, 10% (center) and 20%, with crests and descents. Uneven terrain has a continuous collider mesh for bumps, a gravel patch and small block obstacles. Roads, ramps, ground, markers and boundary barriers have fixed Rapier colliders; decorative trees do not. Surface multipliers are pavement 1, grass 0.55 and gravel 0.32. Edit geometry and `SURFACE` in `frontend/src/driving/Environments.tsx` to change the test grounds.

The **Course** selector also offers four additional layouts:

| Course | Driving task |
| --- | --- |
| Club circuit | A continuous paved lap with S-bends and tighter turns on an 8 m road. |
| City streets | Explore intersections and crosswalks, turn around city blocks, and practice in marked parking bays. Buildings, curbs and parked-car obstacles have colliders. |
| Cone slalom | Weave between six numbered, offset pairs of cones, then brake in the finish/turnaround box. Cones have colliders. |
| Gravel rally | Follow a winding 10 m road with gentle elevation changes, paved/gravel transitions, and a finish turnaround. Gravel changes actual tire grip. |

The collapsible **Course guide** shows the route, start location, driving tip and an orange marker driven by the car's actual position. It starts collapsed on mobile. Switching courses resets the vehicle, distance and session energy, and pauses the drive; press **Start / resume** to set off. No parts or vehicle ratings change when choosing a course.

Route definitions are in `frontend/src/driving/courses.ts`; `CourseGuide.tsx` builds its map from the same route data. The club and rally roads use continuous triangle strips shared by the visible mesh and Rapier colliders, with separate physical friction regions. Geometry tests check the closed-loop seam, upward-facing contact triangles, surface partition, route boundaries and gentle rally grades.

## Existing application inspection and data contract

The builder and library store `Vehicle`/`Part` records through the existing FastAPI/SQLite APIs. `Vehicle.component_ids` selects installed assemblies; `payload_kg` includes the driver, passengers and cargo, and `auxiliary_w` is total auxiliary electrical demand. `Part.mass_kg` is the installed **assembly** mass, already inclusive of its quantity. Child material/purchase references are not added again.

`backend/validation/assembly.py` calculates the existing engineering assembly. `backend/simulation/fastsim_adapter.py` runs saved FASTSim 3.1.0 longitudinal tests, while `analytical.py` supplies their unvalidated torque/gearing feasibility estimates. These files and saved simulation schemas are unchanged. Driving uses Ecctrl/Rapier as the single real-time dynamics solver; it never advances a competing FASTSim trajectory. Its battery energy estimate integrates the real-time wheel model's output with explicitly exposed efficiencies, auxiliary demand and stall loss. It does not claim to be FASTSim telemetry or a hardware measurement.

The procedural exterior, cockpit and wheel geometry formerly inside `visualization/vehicleScene.ts` is shared in `visualization/vehicleModel.ts`. The explorer retains assembly inspection, sensors, orientation controls and recorded playback. Driving reparents the same four exterior wheel models to Ecctrl suspension pivots and the chassis to its dynamic rigid body. Illustrative geometry is not evidence of structural or packaging readiness.

`driving/driveModel.ts` is the adapter. It accepts finite values in declared canonical units, reports invalid units, exposes missing fields as editable session assumptions, and blocks invalid inputs. It never writes assumptions into the library or design. Saved values are visible under **Saved engineering values** and source parts under **Installed parts**. Source records and listing claims can still be unverified.

| Input | Saved source / mapping |
| --- | --- |
| Motors | `motor.custom_parameters.installed_quantity`; one aggregate motor assembly. Canonical `rated_power_kw` and `rated_torque_nm` are already aggregate and are **not multiplied again**. Per-motor `listed_power_per_motor_w`/`listed_power_w` claims only seed a clearly labeled mechanical-power assumption, defaulting to listed electrical watts × quantity × assumed motor efficiency. |
| Motor limits | `max_rpm` (rpm), `efficiency` (fraction), `listed_voltage_v` or `nominal_voltage_v` (V). Optional `stall_loss_w` (aggregate W). Optional `torque_constant_nm_per_a` (N m/A) with aggregate controller `phase_continuous_a` (A) limits torque. |
| Controller | Aggregate DC `continuous_a`, `max_power_kw`, `efficiency`. DC current constrains electrical power, not motor phase torque at zero speed. |
| Battery | Cell `cell_voltage_v × series` or `listed_nominal_voltage_v`; `capacity_ah × parallel` or `listed_capacity_ah`; continuous battery/BMS current; `discharge_efficiency`; `min_soc`, `max_soc`. A seller's `listed_bms_max_discharge_a` is only an upper ceiling on the separately assumed continuous limit. |
| Reduction | `drivetrain.gear_ratio` is the **total** motor-to-wheel ratio. If absent, canonical rear/front sprocket `tooth_count` provides a ratio; otherwise it remains an assumption. No additional sprocket or final-drive multiplier is applied to an existing total ratio. |
| Driven wheels | `drivetrain.driven_wheels`: RWD, FWD or AWD. Equal per-wheel torque weights. Missing assignment exposes an editable session dropdown, initially RWD; edit the drivetrain source to persist it. |
| Mechanical limits | Drivetrain `efficiency`, `max_torque_nm` (aggregate input limit), `max_input_rpm`; `wheel_diameter_m / 2`, or tire `radius_m`. |
| Dimensions / mass | Chassis `length_m`, `width_m`, `wheelbase_m`, `track_m`, `cg_height_m`; `drive_axle_weight_fraction` maps to front/rear static load share. Installed mass + payload gives the rigid body's exact total mass; a missing dry mass is an editable total including known masses. |
| Tires | `friction_coefficient`, `rolling_resistance`, `wheel_inertia_kgm2` in their existing canonical units. |
| Steering | `max_steer_angle_deg` (deg) or `turning_radius_m` (m), `steer_rate_rad_s` (rad/s). Approximate radius = wheelbase / tan(max angle). |
| Braking | `brakes.max_torque_per_wheel_nm` (N m). Four friction brakes, no regenerative recovery. |
| Suspension | `suspension.travel_m` (m), `spring_k_n_m` (N/m), `damping_c_ns_m` (N s/m). Defaults are labeled quarter-car approximations. |

For fields not listed in the existing component catalog, use the Component Library's specification/JSON editor and declare the corresponding unit in `units`. Saved changes take effect on the next Test drive launch. Within driving mode, **Refresh saved build** pauses and fetches current parts, clears old assumptions, and requires **Apply inputs & reset** before resuming. This prevents changing mass, dimensions or gearing underneath a moving rigid body.

## Ecctrl electric drivetrain mapping

The exact packages are `ecctrl@2.0.2`, `@react-three/fiber@9.8.2` and `@react-three/rapier@2.2.0`. Ecctrl's published peer floor requires Three.js 0.184.0; React stays on the already installed 19.3.1 release. No forced peer-dependency flags or React major upgrade are used. Ecctrl, Fiber, Zustand and Three.js use MIT; Rapier's React wrapper uses MIT and its engine uses Apache-2.0. Only required dependencies are installed; Drei and Leva are unnecessary.

Upstream references: [Ecctrl vehicle API](https://github.com/pmndrs/ecctrl/blob/main/docs/api-reference.md), [Ecctrl source/license](https://github.com/pmndrs/ecctrl), [React Three Rapier](https://github.com/pmndrs/react-three-rapier).

All distances use meters, mass kg, torque N m, power W, angular velocity rad/s and time seconds; display speed divides m/s by 0.44704 to obtain mph. Gravity is 9.80665 m/s². Ecctrl 2.0.2 updates wheels and impulses in `useFrame`, so a fixed Rapier timestep alone is insufficient: the whole R3F root advances at **60 Hz**. After each Ecctrl update the integration calls Rapier's `step(1/60)` exactly once, then reads telemetry and renders. Auto stepping is disabled. Hidden-tab elapsed time is discarded; stalls over 100 ms are not caught up indefinitely. At insufficient frame rates simulation time slows rather than inventing large steps. Pause disables both controllers and stepping while retaining camera inspection. Reset remounts the wheel solver, clearing hidden angular-velocity state.

Available aggregate shaft torque is the selected continuous torque capped by supplied drivetrain/phase-current limits. Available shaft power is the minimum of the selected mechanical rating and the continuous electrical budget after auxiliary/stall reserve and motor/controller efficiency. A lower pack voltage conservatively scales assumed available power and RPM by pack/motor voltage; this is explicitly labeled an uncalibrated approximation. Wheel torque is shaft torque × total ratio × drivetrain efficiency **once**.

The torque curve is constant torque followed by constant power, with a final 3% RPM taper and zero commanded torque at/above the motor/drivetrain RPM limit. Ecctrl uses `engineMaxTorque = engineHorsepower × 7022 / engineMaxRPM`. Consequently:

```text
engineHorsepower = availableShaftTorque × drivetrainEfficiency × rpmLimit / 7022
engineMaxRPM = rpmLimit
gearRatios = [totalReduction]
finalDriveRatio = 1
engineTorqueCurveData(x) = availableTorqueAtRPM(x × rpmLimit) / availableShaftTorque
```

That `engineHorsepower` is a **torque normalization parameter**, not the EV's physical horsepower. The normalized curve is sampled into Ecctrl's LUT. Both drive motors contribute to aggregate torque; Ecctrl divides it among the configured driven wheels. The public `VehicleInput` supplies direction, brakes and steering. A small isolated bridge uses Ecctrl's documented wheel `setDriveDemand` setter for smooth analog throttle, because 2.0.2's public car throttle is Boolean. It is deliberately version pinned and covered by real browser physics tests. The integration does not set target speeds, chassis position, or ordinary driving velocity.

Ecctrl's rolling term is a coasting-only viscous drag, so it is disabled. The selected Crr contributes approximately Crr × mass × gravity × cos(slope), with aerodynamic drag ½ × 1.225 × CdA × speed², through impulses opposing motion without reversing it. Four spring contacts and an offset center of mass approximate weight transfer. Saved wheel inertia is represented through equivalent cylinder density in Ecctrl; its additional load-dependent effective inertia remains part of the upstream approximation.

Ecctrl averages contacted collider friction and `tireGripFactor`. Driving sets the latter to zero and uses collider friction = 2 × tire coefficient × surface multiplier. Thus gravel really reduces tire force, including steering/braking friction. The chassis has a separate collision collider and inertia tensor; wheel mass is not added twice to total rigid-body mass.

## Telemetry and limits

Speed, position, wheel angular speed/contact, slip and surface normals come from Ecctrl/Rapier. Acceleration is a smoothed speed derivative; distance integrates actual body travel. Road slope uses the contact normal relative to a horizontal vehicle heading, not the chassis's pitch. Motor RPM and aggregate torque are derived through the ratio and drivetrain efficiency. Shaft power is the sum of nonnegative torque × angular velocity; brakes do not create regenerative energy.

Terminal electrical power = shaft power / (motor efficiency × controller efficiency) + full-torque stall loss × torque fraction² + auxiliary load. Stored energy also includes battery discharge loss. SOC starts from the explicitly supplied/assumed starting value and decreases within its usable window; a saved `usable_fraction` can raise the effective lower cutoff further. Motor demand cuts off when less than one full-power physics step remains; auxiliary demand can consume the remainder. Delivered terminal energy is capped at remaining stored energy, so SOC cannot go negative or below the chosen cutoff. No range extrapolation is presented.

This is a usable, **uncalibrated** driving model. It is not an engineering-validated prediction. Ecctrl uses shape-cast spring contacts rather than independently jointed wheel bodies; wheel spin, effective inertia, tire slip curves, contact impulses, parallel front steering and load transfer are approximations. There is no calibrated Ackermann/differential model, tire temperature, motor electrical transient/efficiency map, battery sag/thermal state, damage model, physical BMS, regen, or verified chassis geometry. Unequal dual-motor control and traction-control electronics are not modeled. The current direct-drive car's real torque, dimensions, installed mass, suspension and brakes remain unknown. The editable 15 N m-per-motor default is an illustrative low-speed assumption, not evidence that the listed motor can launch the physical car or carry its wheel loads.

## Validation

With dependencies installed:

```powershell
cd frontend
npm.cmd test
npm.cmd run build
# Existing live preview must be running for these Chrome checks:
node scripts/drive-physics-check.mjs
node scripts/test-drive-smoke.mjs
node scripts/car-selection-smoke.mjs
```

Set `EV_BROWSER=msedge` for Edge or `EV_BASE_URL` for another local preview address. The physics check requires Vite source serving because it loads a browser-only fixture in `frontend/scripts`; that fixture is excluded from the production bundle. It disables drawing to advance the **production** Ecctrl/Rapier solver deterministically, without mocking its dynamics. The UI smoke test uses actual rendering and reads the current saved dual-motor car; it checks unchanged component/design/result snapshots.

Adapter unit tests cover quantity/aggregate ratings, mass, radius, reduction, climbing force, traction, torque/RPM and electrical power caps, stall/battery losses, SOC bounds, input provenance, units and source immutability. The browser physics suite covers stationary level-ground contact, acceleration versus mass, braking, wheel radius, reduction, both motors, low grip, reverse, real hill ascent/rollback and gravel contact. These are consistency/regression checks, not calibration to a physical vehicle.

Initial implementation verification: **29 frontend tests and 101 backend tests passed**; TypeScript and production build passed. All three browser scripts above passed, including steering, held mobile touch acceleration, changed-part refresh, all environments and camera modes, pause/reset/exit, unchanged saved records, and the existing car chooser/Builder/Lab/explorer navigation. The additional-course update raises frontend coverage to **34 passing tests** and checks all seven spawn surfaces, physical curved-road height/grip, city buildings, cones, course switching and route guides in the browser. The backend emitted its existing Starlette/httpx deprecation warning; the build reports large lazy-loaded physics/Plotly chunks. Rendered screenshots are `docs/screenshots/test-drive-{track,mobile,driver}.png` and `test-drive-course-{circuit,city,slalom,rally}.png`. These checks used desktop Chrome and an emulated mobile viewport/touch input; physical mobile hardware has not been tested.

## Changed files

New runtime files: `frontend/src/driving/{TestDrive.tsx,DrivingScene.tsx,Environments.tsx,driveModel.ts,courses.ts,CourseGuide.tsx,driving.css}`. Shared vehicle geometry: `frontend/src/visualization/vehicleModel.ts`. Integration edits: `App.tsx`, `pages/Overview.tsx`, `visualization/{VehicleViewer.tsx,vehicleScene.ts}`, and `frontend/package{,-lock}.json`. Tests: `driving/{driveModel.test.ts,courses.test.ts}`, `frontend/scripts/{drive-physics-fixture.tsx,drive-physics-check.mjs,test-drive-smoke.mjs}`. Documentation: this file and the README launch link.
