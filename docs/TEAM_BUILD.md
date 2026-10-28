# Team vehicle: provisional parts assembly

Built from the supplied **Budgeting options .docx**, **Parts List - Group 3 10_22_26.docx**, and **Group4_Parts_List.xlsx**. These are project proposals and planning estimates, not verified manufacturer datasheets. Document statements about purchases and group communication are contextual notes, not authorization to purchase or send messages.

The current local SQLite workspace contains **33 document-sourced candidate/placeholder components**, **eight linked sensor products**, and **three saved vehicle drafts**. Each team draft now contains 23 installed component/assembly records, including the eight sensor types in place of the generic sensor placeholder. Existing demo components, designs and results are preserved. The default selection is **TEAM / Single motor + rear belt drive / draft**, following the budget document's stated preference. This provisional choice does not finalize your design.

## Proposed assembly

| System | Provisional selection / evidence | Unresolved |
| --- | --- | --- |
| Traction | One eBay item 256877952903; Group 3 lists 48 V and 2000 W | Motor identity, continuous/peak duty ratings, torque, RPM, efficiency, mass, controller inclusion |
| Drivetrain | Belt drive to rear wheels, no differential specified in preferred concept | Ratio, axle geometry, efficiency, wheel size, torque ratings and mechanical feasibility |
| Steering | AliExpress item 3256806630223349, approximately $47 in budget | Exact variant, electrical/torque ratings, feedback and mechanical linkage |
| Cooling | eBay item 336510135781, 12 V in Group 3, approximately $25 budget | Installed fan count versus two-fan package, current, airflow, dimensions and mass |
| Embedded | ESP32 DevKitC WROOM-32 three-pack; two boards intended onboard, one spare | Installed two-board mass, electrical load and control implementation |
| Camera | Wi-Fi camera TBD; ESP32-CAM is only a fallback | Final model and specifications; not silently selected as ESP32-CAM |
| Signal interfaces | Five-pack logic-level shifters | Actual model, how many fitted and sensor interfaces |
| Stop input | Latching red E-stop button | Contact ratings, power-isolation wiring and system behavior |
| Battery/BMS | Explicit missing-system placeholder | All electrical, energy, mass and operating-limit data |
| Chassis, wheels, tires, suspension, brakes | Explicit missing-system placeholders | Mechanical design and all applicable engineering properties |
| Sensors | Eight products linked by the user; see placement estimates below | Brackets, clearances, wiring, calibration, electrical demand and installed masses |
| Auxiliary supply | Explicit missing-system placeholder | Actual components, electrical demand and installed mass |

No 48 V battery has been invented to match the motor listing. No motor's listed wattage or speed has been promoted to a continuous/peak/max rating without supporting data. No hypothetical demo-car mass, geometry, pack or efficiency is used by these vehicle configurations.

All installed masses, passenger/cargo payload and total auxiliary load are **unknown**. The application stores these as null, displays unavailable metrics, and blocks simulation. The 3D viewer uses explicitly schematic sizes/positions; outlined regions identify pending systems. It does not establish packaging feasibility or mechanical design. Part inspector buttons expose actual document claims, references and pending status.

Hover over a 3D component to highlight it and see its role, documented values and missing-data status. Hover cards also work on wheels and hubs, and stay within the viewer. Click a part for its complete notes and references; dragging and scrolling retain orbit/zoom behavior. Pending battery and chassis regions remain labeled as unknown. Verify this interaction with `node scripts/hover-smoke.mjs` from `frontend/` while the local server is running.

## Sensor placement estimates

All eight user-linked products are saved in the library and attached to all three team concepts. The proposed quantities below total **12 mounts**. These are estimates, not user-specified quantities or a verified mechanical installation. The existing car faces the negative X direction, with its driven rear axle at positive X. Bumper locations follow the schematic chassis dimensions; wheel encoders follow the rear track and wheel radius.

| Viewer label | Product | Proposed quantity | Estimated mounting location |
| --- | --- | --- | --- |
| 1 / Infrared | [Sharp GP2Y0A21YK0F](https://www.adafruit.com/product/164) | 2 | Front bumper corners, aimed forward and slightly outward |
| 2 / Ultrasonic | [RCWL-1601](https://www.adafruit.com/product/4007) | 2 | Front and rear bumper centers, transducers facing outward |
| 3 / GPS | [Adafruit Ultimate GPS](https://www.adafruit.com/product/746) | 1 | Upper deck on an illustrative nonmetallic stand, antenna facing sky |
| 4 / Temperature | [Waterproof DS18B20](https://www.adafruit.com/product/642) | 2 | External battery-enclosure surface and motor housing |
| 5 / Contact force | [Interlink FSR 402](https://buyinterlinkelectronics.com/products/fsr-model-402) | 1 | Under a compliant front bumper contact pad |
| 6 / Steering angle | [Adafruit AS5600](https://www.adafruit.com/product/6357) | 1 | Stationary bracket at the steering output pivot, aligned with its rotating magnet |
| 7 / Axle Hall | [Dagu HC144 Hall module](https://www.robotshop.com/products/speed-measurement-hall-sensor-module) | 1 | Stationary bracket beside the driven rear axle, facing a retained axle magnet |
| 8 / Wheel encoders | [SparkFun DAGU ROB-12629 kit](https://www.sparkfun.com/wheel-encoder-kit.html) | 2 sensors from one kit | Rear inboard hubs: rotating magnets and stationary sensor brackets |

The viewer includes separate sensor shapes, front/rear orientation labels and an accessible placement list below the car. Small sensor models are enlarged for visibility. Hover or click an actual sensor mesh, or use a placement-list button, to inspect the product, estimated locations, quantities, interfaces, limitations and supplied reference. Floating number labels and their leader lines have been removed from the car. The home dashboard also shows the sensor mounts.

The FSR 402 measures local contact force (the listed range is 0.2–20 N); it is not a tire-pressure, vehicle-weight or crash-load sensor. The AS5600 needs the correctly polarized magnet aligned over its chip within the specified gap (up to 3 mm); a multi-turn steering column would need additional turn tracking or gearing. Temperature probes at these sites measure surface temperatures, not cell cores or motor windings. The wheel-encoder kit already contains two Hall sensors and two 8-pole magnets; the separate Hall module is shown as an additional axle-speed pickup. Its exact target gap is not assumed.

Product-page specifications reviewed on October 28, 2026 are stored separately in `data/components/team-sensors.json`, with source URLs and explicit estimate metadata. Installed assembly masses, sensor prices, completed brackets and total auxiliary demand remain unknown. Sensor placement does not supply missing simulation inputs or live telemetry. Original planning budgets remain unchanged and exclude these sensor costs.

The team loader includes the sensor migration automatically on fresh setups. To add just the sensors to an existing local database, run `python -m scripts.load_sensor_project`. The migration preserves existing component edits, design fields and unrelated components; repeat runs also preserve a user's later sensor removals. Before updating this workspace, a SQLite backup was saved as `data/simulation_results/before-sensor-layout.sqlite`.

## Purchase plan, separate from installed hardware

Group 4 lists eight purchase lines totaling **$141**: ESP32 pack $20, camera allowance $15, DualShock 4 $40, microSD 32 GB $10, travel router $30, level-shifter pack $6, breadboard/jumpers $12 and E-stop $8. All are marked not ordered in the workbook.

- DualShock operator controller and prototype breadboard inventory are not included in installed vehicle mass.
- Router placement and microSD/computer placement are unresolved and remain procurement inventory, not assumed onboard hardware.
- The microSD note mentions a Pi operating system; no Raspberry Pi or other compute board is actually listed, so none has been fabricated as a selected part.
- The third ESP32 is a spare. The selected ESP32 component represents the two onboard boards; its price is the whole three-pack purchase allowance. Installed assembly mass must be supplied for those two boards, not the spare.
- Level-shifter package count is five; actual installed quantity is unknown.

| Saved concept | Document-based allowance before Group 4 | Group 4 | Known partial budget |
| --- | --- | --- | --- |
| Single motor + rear belt | ~$100 motor + ~$20 inferred belt allowance + ~$47 steering + ~$25 fan = **~$192** | $141 | **~$333** |
| Single motor + differential | ~$100 motor + ~$47 steering + ~$25 fan = **~$172**, plus unspecified differential materials | $141 | **~$313**, plus differential materials |
| Two motors / direct drive | ~$200 motors + ~$47 steering + ~$25 fan = **~$272**, plus unspecified drive/control materials | $141 | **~$413**, plus unlisted materials/controllers |

These are historical document allowances, **not current prices or total vehicle costs**. Missing battery/BMS, chassis, wheels, tires, braking/suspension, sensors, motor controller, power distribution, wiring and fabrication are excluded. Shipping/tax are not incorporated. Document prices conflict: selected motor is $99 ($94?) in Group 3 versus roughly $100 in the budget; fan is $26.60 for a two-fan listing versus roughly $25/one fan in the budget. Both claims are preserved. Another motor candidate lists $85 shipping, stored only on that alternative.

Alternative traction motors (KUNRAY MY1020 variants, another 48 V/2000 W listing, VEVOR 1800 W and VEVOR 2000 W kits), steering actuators and fan options are saved in the library without treating every alternative as installed simultaneously. The two-motor concept uses a two-unit aggregate record with unknown aggregate continuous ratings. No dynamic torque-sharing or motor-control implementation is claimed.

## Open or reload

The current workspace is already loaded. Start the app:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Start.ps1
```

Open http://127.0.0.1:8000. The team belt-drive draft is selected on Home, Vehicle Builder and Simulation Lab. The 3D viewer includes an assembly table, purchase plan and selectable component information.

To load the bundled draft into a fresh/other local database:

```powershell
.\.venv\Scripts\python.exe -m scripts.load_team_project
```

The loader is idempotent: existing IDs are skipped, preserving edits to loaded components/designs. The sensor migration adds the eight requested sensor references and removes only the generic `team-sensors` placeholder from installed lists, once per design. Editable original document snapshots are `data/components/team-parts.json` and `data/vehicles/team-drafts.json`; the supplementary sensor snapshot is `data/components/team-sensors.json`. `scripts/build_team_dataset.py` documents the original transcription and generates the original JSON files only; it does not overwrite the live database. Original Office files are not copied into the repository. No web data was used to fill missing fields in the original document transcription; the supplemental sensor records identify the reviewed product-page specifications separately.

## Verification

- Backend: **35 tests passed**, including null persistence, partial mass handling, unchanged demo physics, source-budget arithmetic, sensor migration, preservation of edits/removals, loader idempotence and engine-call prevention for all three incomplete drafts.
- Frontend: **7 tests passed**, TypeScript and production build successful.
- Edge browser: default team draft, unknown metrics and blank loads, saving/reopening draft, component inspection, separate purchase inventory, blocked incomplete simulation, separate hypothetical demo simulation, and mobile overflow checks passed.
- Evidence: [team draft](screenshots/team-draft.png), [3D assembly/inspector](screenshots/team-viewer.png), [mobile](screenshots/team-mobile.png).
- Sensor interaction checks: `node scripts/sensor-smoke.mjs` exercises all eight product inspectors/references, sensor mesh hover/click without floating labels, keyboard activation, persistence across reloads, all three concepts and mobile overflow. Evidence: [sensor layout](screenshots/team-sensors.png), [mobile sensor inspector](screenshots/team-sensors-mobile.png).

The hypothetical demo's performance results remain available under its own name; they do not describe the team draft. No range, acceleration or top-speed estimate is generated for this incomplete vehicle.
