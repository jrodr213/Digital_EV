# Team vehicle: provisional parts assembly

Built from the supplied **Budgeting options .docx**, **Parts List - Group 3 10_22_26.docx**, and **Group4_Parts_List.xlsx**. These are project proposals and planning estimates, not verified manufacturer datasheets. Document statements about purchases and group communication are contextual notes, not authorization to purchase or send messages.

The current local SQLite workspace contains **33 candidate/placeholder components** and **three saved vehicle drafts**. Existing demo components, designs and results are preserved. The default selection is **TEAM / Single motor + rear belt drive / draft**, following the budget document's stated preference. This provisional choice does not finalize your design.

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
| Sensors and auxiliary supply | Explicit missing-system placeholders | Actual components, electrical demand and installed masses |

No 48 V battery has been invented to match the motor listing. No motor's listed wattage or speed has been promoted to a continuous/peak/max rating without supporting data. No hypothetical demo-car mass, geometry, pack or efficiency is used by these vehicle configurations.

All installed masses, passenger/cargo payload and total auxiliary load are **unknown**. The application stores these as null, displays unavailable metrics, and blocks simulation. The 3D viewer uses explicitly schematic sizes/positions; outlined regions identify pending systems. It does not establish packaging feasibility or mechanical design. Part inspector buttons expose actual document claims, references and pending status.

Hover over a 3D component to highlight it and see its role, documented values and missing-data status. Hover cards also work on wheels and hubs, and stay within the viewer. Click a part for its complete notes and references; dragging and scrolling retain orbit/zoom behavior. Pending battery, chassis and sensor regions remain labeled as unknown. Verify this interaction with `node scripts/hover-smoke.mjs` from `frontend/` while the local server is running.

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

The loader is idempotent: existing IDs are skipped, preserving edits to loaded components/designs. Editable source snapshots are `data/components/team-parts.json` and `data/vehicles/team-drafts.json`. `scripts/build_team_dataset.py` documents the transcription and generates those JSON files only; it does not overwrite the live database. Original Office files are not copied into the repository. Vendor/search links are references, not independently verified datasheets. No web data was used to fill missing fields.

## Verification

- Backend: **32 tests passed**, including null persistence, partial mass handling, unchanged demo physics, source-budget arithmetic, loader idempotence and engine-call prevention for all three incomplete drafts.
- Frontend: **4 tests passed**, TypeScript and production build successful.
- Edge browser: default team draft, unknown metrics and blank loads, saving/reopening draft, component inspection, separate purchase inventory, blocked incomplete simulation, separate hypothetical demo simulation, and mobile overflow checks passed.
- Evidence: [team draft](screenshots/team-draft.png), [3D assembly/inspector](screenshots/team-viewer.png), [mobile](screenshots/team-mobile.png).

The hypothetical demo's performance results remain available under its own name; they do not describe the team draft. No range, acceleration or top-speed estimate is generated for this incomplete vehicle.
