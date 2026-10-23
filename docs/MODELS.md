# Simulation and model contract

## Supported native power-flow model

FASTSim 3.1.0 `Vehicle.from_resource(...).to_dict()` supplies the current serialized BEV schema and initial solver state. The adapter replaces its vehicle mass, chassis road-load properties, wheel properties, traction geometry, auxiliary load, electric-machine power/efficiency, transmission efficiency and battery capacity/efficiency/SOC/power. The bundled Renault model's manufacturer ratings do not silently carry into custom calculations.

The official API calls used are `Vehicle.from_dict`, `set_save_interval(1)`, `Cycle.from_resource`, `Cycle.from_dict`, `SimParams.default().to_dict()`, `SimParams.from_dict`, `SimDrive`, `run`, `to_dataframe`, and `to_dict`. See `backend/simulation/fastsim_adapter.py`. FASTSim is an external dependency; its source is unmodified. `SimulationEngine` is the protocol for additional engines. `analytical.py` is a separate extension, not a FASTSim physics feature.

| Input | Calculation / mapping |
| --- | --- |
| Assembly mass | Sum of each selected part's assembly mass + payload + run's extra payload, once |
| Pack nominal voltage | Series cells × nominal cell voltage |
| Pack nominal energy | Series × parallel × cell V × cell Ah / 1000, kWh |
| Pack usable energy | Nominal energy × explicitly supplied usable fraction |
| Pack full voltage | Series × maximum cell voltage; checked against inverter/BMS limits |
| Battery efficiency | Supplied symmetric one-way charge/discharge efficiency, FASTSim `Constant` |
| Battery output power | Nominal V × min(pack continuous A, BMS continuous A) |
| Native battery power | Min(output power, nominal V × charge limit A); FASTSim uses symmetric limits |
| Mechanical continuous power | Min(motor continuous kW, inverter DC kW × motor × inverter efficiency, max(0, nominal V × min(battery/BMS/inverter continuous A) / 1000 − auxiliary kW) × motor × inverter efficiency) |
| Electric-machine efficiency | Constant motor × inverter efficiency, represented as a flat 1D FASTSim interpolator |
| Battery SOC window | min_soc to min_soc + usable_fraction; must fit inside max_soc |
| Transmission | Supplied scalar efficiency; no gear model in the native adapter |
| Chassis | Explicit drag, frontal area, rolling resistance, wheel inertia/radius/count, CG, friction, axle weight fraction, wheelbase and driven axle |

Continuous and peak currents are **pack-level**, not per-cell. `capacity_ah` is per-cell. Component mass is for the entire assembly; cell counts do not multiply mass again. Additional parts contribute mass and metadata, with auxiliary electrical demand explicitly entered at vehicle level. Prices use a team-selected currency; no currency conversion is performed.

FASTSim's `trace_miss_opts='Allow'` permits power/traction-limited achieved speed. Every run preserves target and achieved traces and flags failure to follow the cycle. A failed engine call returns a visible API error with no saved substitute. Other solver parameters, atmosphere and initial ambient conditions use FASTSim defaults; custom-cycle import supplies time/speed/grade only. No thermal extension is enabled.

## Output provenance

Native time series: achieved speed/distance, battery SOC and electrical/chemical power/energy, motor mechanical power. Consumption is the change in native cumulative chemical energy divided by achieved distance. Regenerated energy integrates negative native terminal electrical power using each step's time interval. Auxiliary consumption is included in native battery flow.

Derived estimates: battery current = terminal electrical power / **nominal** pack voltage; motor RPM = road speed / radius × gear ratio; motor torque = mechanical power / that angular speed; acceleration = derivative of achieved speed. Torque at standstill is reported as zero where division is undefined, not as a validated stall torque. These are kinematic/electrical estimates, not native motor dynamics. Wheel slip is not represented in the RPM calculation.

Projected range = supplied usable kWh × 1000 / achieved cycle Wh/mi. This is extrapolation, not a repeated-until-empty drive or a range guarantee. SOC buffer effects and operating conditions may change subsequent cycles. No estimate is returned if energy/distance is nonpositive. Trace RPM/torque violations make this extrapolation conditional; the UI and report include the flags.

## Analytical extension (unvalidated)

Steady top speed solves wheel power = (rolling + aerodynamic force) × speed and caps speed using min(motor maximum RPM, drivetrain maximum input RPM). Air density is explicitly 1.225 kg/m³. Wheel radius and fixed gear ratio come from the assembly. Grade force uses atan(grade), gravity 9.80665 m/s² and rolling force proportional to normal load.

0–30 and 0–60 estimates integrate constant continuous torque below constant continuous power with 0.01 s steps for up to 120 s. Force is capped by static driven-axle tire friction; there is no dynamic load transfer. Wheel torque also respects drivetrain input torque rating. No rotational inertia correction, tire slip evolution, shifts, traction control, electrical transient or peak-duration model is included. Unreached targets return null and display a dash.

Hill maintenance checks target speed against available wheel power, torque and RPM. The hill FASTSim trace requests target speed from the second sample; startup transient does not prove steady hill capability. Acceleration native trace requests 2 m/s² up to 70 m/s; it is a stress trace and does not define the analytical 0–60 metric. Load runs add payload to the same cycle. Analytical top speed is not a FASTSim steady-speed optimization.

## Unsupported behavior is explicit

- Manufacturer values are never inferred. Missing required fields or incorrect canonical units block simulation. Library entries and incomplete vehicle drafts may still be saved.
- Torque/RPM efficiency maps are retained as metadata but rejected by this adapter when supplied. Only a user-selected scalar efficiency is supported; supplying a map never silently replaces it with a scalar.
- Asymmetric battery charge/discharge efficiencies and regen-disabled builds are currently rejected. FASTSim's richer model could support future adapters; this adapter does not claim that functionality. A low charge rating conservatively limits discharge as well and may underpredict propulsion performance.
- Optional resistance, chemistry, temperature limits, cooling needs, BMS voltage range, and metadata are recorded. BMS range is checked statically; voltage sag, BMS cutoff behavior, temperature dependence, cell balancing and electrochemistry are not simulated. Pack minimum operating voltage is not derived from nominal voltage.
- Torque and RPM are not enforced inside the native scalar motor model. Native achieved traces may be infeasible for the chosen gearing; warnings flag violations. This is a preliminary power/energy model, not a fully torque-constrained student powertrain solver.
- Motor/inverter peaks are checked for compatibility but not used for acceleration because peak durations are unknown. Excess sustained demand can indicate overload risk, but no overheating temperature or time-to-overheat is reported.
- No thermal validation, brake sizing, handling, suspension dynamics, steering response, rollover, fatigue, crashworthiness, structural analysis, charging simulation, fault diagnosis or hardware-in-the-loop is implemented.
- Four-wheel fixed-ratio BEVs with regeneration are the supported adapter scope. Additional custom component categories persist and contribute mass but do not add physics.
- Three.js geometry is schematic. Visual dimension fallbacks, wheel animation and grid motion are display conventions, not simulation inputs. Component positioning and CAD import are not yet implemented; the viewer is isolated so a geometry loader can be added later.

Before using results for procurement, replace hypothetical values with reviewed datasheets, inspect every constraint, verify duty-cycle/peak ratings with manufacturers, and calibrate against measured vehicle data. There is no claim of physical validation for a custom build.
