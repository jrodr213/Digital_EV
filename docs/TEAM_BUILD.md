# Team vehicle: provisional parts assembly

Built from the supplied **Budgeting options .docx**, **Parts List - Group 3 10_22_26.docx**, and **Group4_Parts_List.xlsx**. These are project proposals and planning estimates, not verified manufacturer datasheets. Document statements about purchases and group communication are contextual notes, not authorization to purchase or send messages.

The current local SQLite workspace contains **62 team component/material records** and **three saved team drafts**. The default is **TEAM / Two 36 V 500 W motors + rear chain drive / draft**, reflecting the user's latest architecture update on October 30, 2026. It contains 29 installed component/assembly records, including all eight sensor types and the THR-90 pedal; the other concepts retain 23 records each. Chassis stock references are purchase-planning records, separate from the installed chassis assembly. Existing demo components, other concepts and results are preserved.

## Proposed assembly

| System | Provisional selection / evidence | Unresolved |
| --- | --- | --- |
| Traction | Two brushless motors, AliExpress item 3256809008940329; user selects 36 V and 500 W per motor | Continuous/peak duty ratings, torque, RPM, efficiency, installed pair mass, dimensions and controller arrangement |
| Drivetrain | Two #420 chain paths, 60T rear sprockets, no differential; new hardware below | Motor-sprocket bore/tooth variant, exact ratio, alignment, axle layout, efficiency, wheel size and load ratings |
| Steering | Ackermann geometry and steer-by-wire; earlier AliExpress actuator remains provisional with historical ~$47 allowance | Linkage dimensions, angles, actuator limits, electrical ratings, feedback and control implementation |
| Throttle | One THR-90 Hall-effect foot pedal through the ESP32/custom circuit | Electrical input conditioning, calibration, return/stop behavior, wiring and installed mass |
| Cooling | eBay item 336510135781, 12 V in Group 3, approximately $25 budget | Installed fan count versus two-fan package, current, airflow, dimensions and mass |
| Embedded | ESP32 DevKitC WROOM-32 three-pack; two boards intended onboard, one spare | Installed two-board mass, electrical load and control implementation |
| Camera | Wi-Fi camera TBD; ESP32-CAM is only a fallback | Final model and specifications; not silently selected as ESP32-CAM |
| Signal interfaces | Five-pack logic-level shifters | Actual model, how many fitted and sensor interfaces |
| Stop input | Latching red E-stop button | Contact ratings, power-isolation wiring and system behavior |
| Battery/BMS | One UUGPOWER-branded pack, eBay 318129902320; listed 36 V, 15 Ah, 540 Wh and 40 A maximum BMS discharge | Continuous/charge limits, voltage limits, regen support, installed assembly mass and conflicting dimensions |
| Chassis | Team-fabricated frame using both linked PVC pipe and steel tubing; user-described soldering plan | Material-specific joints, roles, quantities, steel section/grade, cut plan, load limits, geometry and installed mass |
| Motor drive | ESP32 boards plus team-built motor-drive power circuitry; no commercial controller selected | Circuit schematic/BOM, commutation, power/protection components, ratings, thermal design and validation |
| Wheels, tires, suspension, brakes | Explicit missing-system placeholders | Mechanical design and all applicable engineering properties |
| Sensors | Eight products linked by the user; see placement estimates below | Brackets, clearances, wiring, calibration, electrical demand and installed masses |
| Auxiliary supply | Explicit missing-system placeholder | Actual components, electrical demand and installed mass |

The selected 36 V battery is recorded from the user-linked listing; missing cell-level inputs and operating limits are not inferred. No motor's listed wattage or speed has been promoted to a continuous/peak/max rating without supporting data. No hypothetical demo-car mass, geometry, pack or efficiency is used by these vehicle configurations.

All installed masses, passenger/cargo payload and total auxiliary load are **unknown**. The application stores these as null, displays unavailable metrics, and blocks simulation. The 3D viewer uses explicitly schematic sizes/positions; outlined regions identify pending systems. It does not establish packaging feasibility or mechanical design. Part inspector buttons expose actual document claims, references and pending status.

## Finished concept and assembly explorer

The Home Dashboard and 3D Vehicle Viewer now start with a finished-looking single-seat electric concept, with body panels, cockpit, wheels, lighting and trim. These shapes illustrate one possible exterior; they do not add parts, dimensions or engineering ratings to the saved build. The actual pipe frame and hardware are revealed inside the assembly views.

Click a panel or wheel on the car, or choose one of seven accessible system buttons: **Powertrain**, **Battery & power**, **Electronics**, **Body & frame**, **Steering & pedals**, **Wheels & brakes**, and **Sensors & vision**. The camera fits the selected assembly, hides the concept bodywork and opens its saved component list. Click a component shape or list button for the part detail. An Exploded toggle separates assembly parts visually; Fit view restores the camera framing.

Frame materials and guard-bundle items have another level of read-only subcomponent exploration. **Back** moves up one level; **Full car** returns directly to the assembled concept. Escape also moves back. Keyboard users can navigate through the same system/component buttons. Changing designs or reloading starts at the full car.

All 29 installed component groups remain discoverable. Product references, recorded quantities, unknown masses, notes, specifications and sensor mounting estimates are retained in the detail panel. Material/bundle references remain separate from installed parts and never enter physics calculations. The explorer does not modify the local database.

Verify with `node scripts/explorer-smoke.mjs` from `frontend/` while localhost is running. The check covers real mesh clicks, all component/source details, nested materials and guard items, Back/breadcrumb/Escape navigation, the exploded toggle, design switching, mobile layout and unchanged saved records. Evidence: [finished car](screenshots/vehicle-finished-concept.png), [powertrain](screenshots/vehicle-powertrain-explorer.png), [mobile](screenshots/vehicle-explorer-mobile.png).

## Current drivetrain and chassis

The latest motor decision supersedes the MY1020 selections: the main draft now contains **two motors from AliExpress item 3256809008940329**, **36 V and 500 W each**. Their listing wattages total **1000 W**, which is not a verified continuous or peak engineering rating. The car retains **rear-wheel chain drive**, **no differential**, **Ackermann steering with steer-by-wire**, and **throttle-by-wire**. The viewer draws two motor blocks. The team selected new chain hardware and an ESP32-controlled custom power circuit, detailed below. Exact shaft fit, ratio, circuit ratings and torque coordination remain unresolved.

The selected pair is [AliExpress item 3256809008940329](https://www.aliexpress.us/item/3256809008940329.html), stored as `team-motor-aliexpress-36v500-pair`. The user explicitly selected the 36 V / 500 W variant for both motors. The page remains inaccessible; manufacturer/model, duty ratings, torque, RPM, efficiency, dimensions and aggregate mass are unverified. The selected pair's price is unknown. The previous MY1020 motors are removed from the main car and its purchase plan, with their records retained as historical library options. The earlier **THANKS27** note belongs to the MY1020 product; it is not carried over to the replacement pair. The battery is selected separately from the user-linked eBay listing; no controller is inferred from motor voltage.

| Proposed chassis material | User quote per stock length | Evidence and limits |
| --- | --- | --- |
| [IPEX 1/2-inch Schedule 40 PVC pipe, 10 ft](https://www.homedepot.com/p/319692959) | $5.38 | Home Depot identifies model 30-05010HD as water pipe. The reviewed page displayed $7.56 in its location context; the user's quote is preserved separately. No vehicle frame load rating is established. |
| [Steel tubing, described as 8 ft](https://www.walmart.com/ip/331307431) | $64.79 | User description and quote; page inaccessible. Exact section, wall thickness, grade and structural properties are unverified. |

Both stock products are linked to the proposed chassis and listed in purchase planning. Required quantities, how each material is used, joints, cut plan and completed chassis mass remain unknown. Stock lengths are not used as car dimensions. Unit quotes are excluded from the subtotal until required stock quantities are supplied. The main draft retains **$213** of other historical planning allowances. The old belt allowance is removed, and the original $333 partial budget is historical metadata. Current drive hardware quotes and the updated subtotal are detailed below; complete motor, frame and custom-circuit costs remain unresolved.

**Regenerative braking remains undecided**, matching the question in the user's request. Controller/motor support, battery/BMS charge acceptance and a back-drivable drivetrain must be established. No `regen=true` rating or regen performance is fabricated. General [controller manufacturer guidance](https://media.kellycontroller.com/new/Kelly-AKBS-XUserManualV4.3.pdf) describes voltage-limited regeneration and states that it does not replace mechanical brakes; this is background guidance, not selection of a Kelly controller.

Records are in `data/components/team-architecture.json`. `python -m scripts.load_architecture_project` applies the chassis/chain concept and then the latest motor-pair selection once each to the main draft; the full team loader includes it after the historical motor and sensor stages. Later user edits/removals and other designs are preserved. The stable vehicle ID remains `team-ev-belt` even though the name and actual drivetrain are now chain-based. Local pre-update backups are `data/simulation_results/before-chain-chassis.sqlite` and `data/simulation_results/before-final-36v500-pair.sqlite`.

## Selected battery

The main draft uses one [UUGPOWER-branded battery, eBay item 318129902320](https://www.ebay.com/itm/318129902320). The seller lists **36 V, 15 Ah, 540 Wh**, a **40 A maximum BMS discharge** claim, **4.9 kg** battery weight and a five-pin base. Listing price observed on October 30, 2026 was **$185.99** before unconfirmed shipping/tax; that snapshot contributes $185.99 to the current partial planning subtotal. This is not the full vehicle cost or a checkout quote.

The 40 A figure is not treated as continuous current or charge/regen capability. Installed mass including mounts/wiring remains unknown. Dimensions conflict: 370 x 95 x 122 mm versus 370 x 95 x 89 mm. Cell layout, voltage limits, usable energy and controller compatibility are unresolved; simulation and regen remain unavailable.

The record is `data/components/team-battery.json`. The team loader includes `python -m scripts.load_battery_project`, which selects it once for the main draft and preserves later edits. Other designs retain their battery placeholders. Pre-update backup: `data/simulation_results/before-uugpower-battery.sqlite`.

## Drive hardware and team fabrication

The team confirms **both steel tubing and PVC pipe** for its fabricated chassis. Its stated joining plan is recorded as soldering, without assuming joint strength or an approved load path. PVC needs material-appropriate joining; [IPEX describes PVC solvent cement systems](https://ipexna.com/solutions/plumbing-and-mechanical-solutions/solvent-cements-primers/cements-primers/). This is joining guidance, not approval of a rider-carrying frame. Member roles, steel/PVC interfaces, pipe quantities, joints and load capacity remain unresolved. The viewer's tube members are schematic.

Motor control is **the existing ESP32 boards plus power circuitry the team will build**. The saved plan does not require purchasing commercial BLDC controllers. A separate custom-drive assembly tracks the added power circuitry, its unknown cost/mass and outstanding schematic, ratings, protection and commutation validation. It excludes the ESP32 boards already recorded elsewhere.

| Added line | Quantity | User-quoted line total |
| --- | --- | --- |
| [BMI 12 x 5 in steel motor mount plates](https://www.bmikarts.com/12-x-5-Motor-Mount-Plate_p_1119.html) | 2 | $25.90 |
| [4 ft #420 chains with master links](https://www.gokartsupply.com/chain.htm), catalog 420-4 | 2 | $35.00 |
| [60T rear sprockets, 1 in bore and 1/4 in keyway](https://monsterscooterparts.com/products/40-41-420-chain-60-tooth-sprocket-with-1-bore-1-4-keyway) | 2 | $65.98 |
| [#420 motor sprockets](https://electricscooterparts.com/motor-sprockets-420-chain.html), exact variant pending | 2 | $29.90 |
| Chain guards, spring tensioners and [mounting bolt kits](https://www.gokartsupply.com/enginemount.htm) | Estimated 2 of each | ~$109+ |
| [THR-90 Hall-effect accelerator pedal](https://cart.electricscooterparts.com/standard-foot-pedal-throttle) | 1 | $23.95 |
| **New quoted additions** | | **~$289.73+** |

The guard/adjustment bundle assumes two guards at $35.99 each, two tensioners at $12.99 each and two bolt kits at $5.50 each. Their arithmetic sum is $108.96; the budget retains the user's rounded **~$109+** allowance. Quantities are inferred from the two drive paths and quoted allowance. No exact guard or tensioner SKU is established. The matching guard title/price is referenced in the [Toigo catalog](https://toigoracing.com/collections/eng-213), without asserting mounting compatibility.

The current known planning subtotal is **~$688.72+**, including prior allowances and the battery snapshot. It excludes unknown motor cost, required stock quantities, frame fabrication, custom drive circuitry and remaining systems, shipping and tax. Each two-unit hardware record stores its full line price once; the guard sub-items are not counted again.

Plate slots have not been matched to the motor mounting pattern. The rear sprockets require matching axle bore/keyway hardware. Motor sprocket shaft profiles and tooth counts remain unselected; no gear ratio is fabricated. The supplier's [THR-90 wiring bulletin](https://electricscooterparts.com/manuals/THR-90.html) is saved, but signal levels, ESP32 conditioning and stop behavior still need verification. Chains are purchased stock lengths, not verified installed loop lengths. Physical placement, including plates and guards, remains illustrative.

Records: `data/components/team-drive-hardware.json`. `python -m scripts.load_drive_hardware` applies these selections once to the main draft, preserving other designs and later edits; the full team loader includes it. Pre-update backup: `data/simulation_results/before-drive-hardware.sqlite`.

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

Open Sensors & vision to see the separate sensor shapes and an accessible component list. Small sensor models are enlarged for visibility. Click a sensor mesh or list button to inspect its product, estimated locations, quantities, notes and supplied reference. The full-car view keeps the internal sensor hardware hidden until you open the system.

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

The table preserves the original document concepts. The current main draft instead uses the two selected 36 V / 500 W motors and rear chain drive, with no differential; its updated total cost is unknown, as described above.

These are historical document allowances, **not current prices or total vehicle costs**. Missing battery/BMS, chassis, wheels, tires, braking/suspension, sensors, motor controller, power distribution, wiring and fabrication are excluded. Shipping/tax are not incorporated. Document prices conflict: originally selected motor is $99 ($94?) in Group 3 versus roughly $100 in the budget; fan is $26.60 for a two-fan listing versus roughly $25/one fan in the budget. Both claims are preserved. Another motor candidate lists $85 shipping, stored only on that alternative.

Alternative traction motors (KUNRAY MY1020 variants, another 48 V/2000 W listing, VEVOR 1800 W and VEVOR 2000 W kits), steering actuators and fan options are saved in the library without treating every alternative as installed simultaneously. The two-motor concept uses a two-unit aggregate record with unknown aggregate continuous ratings. No dynamic torque-sharing or motor-control implementation is claimed.

## Open or reload

The current workspace is already loaded. Start the app:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\Start.ps1
```

Open http://127.0.0.1:8000. The dual-36 V / 500 W rear-chain-drive draft is selected on Home, Vehicle Builder and Simulation Lab. The 3D viewer includes an assembly table, purchase plan and selectable component information.

To load the bundled draft into a fresh/other local database:

```powershell
.\.venv\Scripts\python.exe -m scripts.load_team_project
```

The loader is idempotent: existing IDs are skipped, preserving edits to loaded components/designs. The sensor migration adds the eight requested sensor references and removes only the generic `team-sensors` placeholder from installed lists, once per design. The historical motor/architecture stages record the earlier choices and final motor pair; the battery and drive-hardware stages then select the linked pack, team-fabricated pipe frame, custom motor-drive circuit and quoted hardware. Editable original document snapshots are `data/components/team-parts.json` and `data/vehicles/team-drafts.json`; supplementary snapshots are `data/components/team-sensors.json`, `data/components/team-motors.json`, `data/components/team-architecture.json`, `data/components/team-battery.json` and `data/components/team-drive-hardware.json`. `scripts/build_team_dataset.py` documents the original transcription and generates the original JSON files only; it does not overwrite the live database. Original Office files are not copied into the repository. No web data was used to fill missing fields in the original document transcription; supplemental records identify their separate evidence and limitations.

## Verification

- Backend: **46 tests passed**, including null persistence, partial mass handling, unchanged demo physics, source-budget arithmetic, sensor, motor, architecture, battery and drive-hardware migrations, preservation of edits/removals, loader idempotence and engine-call prevention for all three incomplete drafts.
- Frontend: **10 tests passed**, including assembly grouping, read-only material references and bundle drill-down; TypeScript and production build successful.
- Edge browser: default team draft, unknown metrics and blank loads, saving/reopening draft, component inspection, separate purchase inventory, blocked incomplete simulation, separate hypothetical demo simulation, and mobile overflow checks passed.
- Evidence: [team draft](screenshots/team-draft.png), [3D assembly/inspector](screenshots/team-viewer.png), [mobile](screenshots/team-mobile.png).
- Current viewer interaction checks: `node scripts/explorer-smoke.mjs` passes for the full-car default, real mesh picks, seven assemblies, all 29 saved component groups and product links, unknown values, nested references, return navigation, design switching, mobile and unchanged saved data. Earlier sensor screenshots remain historical evidence.

The hypothetical demo's performance results remain available under its own name; they do not describe the team draft. No range, acceleration or top-speed estimate is generated for this incomplete vehicle.
