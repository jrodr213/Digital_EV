# Components, configurations and imports

Components are editable JSON documents persisted in SQLite. The API schema at `/docs` defines base fields: `id`, `name`, `category`, `manufacturer`, `model`, `mass_kg`, optional `price`, `notes`, `datasheet`, `hypothetical`, `specs`, `units`, and `custom_parameters`. Unknown top-level fields are rejected to catch typos. Unknown specification/custom-parameter keys are retained. A custom category is any nonempty category name; it does not automatically gain simulation physics.

`backend/components/catalog.py` and `/api/catalog` list supported fields, units and required calculation fields. Core categories are battery, motor, inverter, drivetrain, chassis and tires. Other categories cover suspension, brakes, steering, cooling, auxiliary electronics, sensors, embedded controllers and user-defined parts. A category represents one complete assembly. Multiple motors/pack modules should be represented by a reviewed aggregate assembly; this adapter requires exactly one of each core category.

## JSON import

Upload an array of component objects. `data/components/demo.json` is a complete editable example. Each numeric calculation field must also declare its canonical unit in `units`.

```json
[
  {
    "name": "Reviewed wheel assembly",
    "category": "tires",
    "manufacturer": "Enter actual supplier",
    "model": "Enter actual model",
    "mass_kg": 40,
    "price": null,
    "hypothetical": true,
    "notes": "Illustrative values only",
    "datasheet": "",
    "specs": {"rolling_resistance": 0.012, "friction_coefficient": 0.8, "wheel_inertia_kgm2": 0.5, "num_wheels": 4},
    "units": {"rolling_resistance": "dimensionless", "friction_coefficient": "dimensionless", "wheel_inertia_kgm2": "kg m2", "num_wheels": "count"},
    "custom_parameters": {}
  }
]
```

Imports validate every document before writing; malformed data results in no changes. Supplied IDs update existing parts, omitted IDs create new parts. Duplicate IDs in one import are rejected. Limit: 2 MB, 1000 components. Import does not mean that a manufacturer specification is verified: the team must review the values and source references.

## CSV component import

The CSV header uses the same base fields. `specs`, `units` and `custom_parameters` cells contain JSON; use normal CSV quoting to escape quotation marks. `hypothetical` is `true`/`false`, numeric mass is kg, blank optional price becomes null. Example:

```csv
name,category,manufacturer,model,mass_kg,price,notes,datasheet,hypothetical,specs,units,custom_parameters
Demo sensor,sensors,Hypothetical,Example,0.2,,Not manufacturer data,,true,"{""voltage_v"":5}","{""voltage_v"":""V""}",{}
```

The application performs no automatic unit conversion on imported specifications: explicitly convert to canonical units first. For example, wheel diameter must be meters with unit `m`, not a value in inches with a relabeled unit. There is no PDF extraction or invented datasheet completion.

## Driving cycles

Standard UDDS, HWFET and US06 come from FASTSim resources. Upload a custom CSV with exact columns `time_s,speed_mps,grade`; sample in `data/drive_cycles/custom-example.csv`. Grade is rise/run, so 5% is `0.05`. Time starts at zero, increases strictly, and all arrays have the same length. Limits: 10,000 samples, four hours, speeds 0–150 m/s, grades -0.5–0.5. All values must be finite. The JSON cycle endpoint accepts the same three arrays and a name.

## Saved designs and results

A design contains component IDs, passenger/cargo payload in kg and auxiliary load in W. The builder computes each selected component mass once. Use complete assembly masses and avoid duplicating wheels inside both chassis and tire mass.

Library edits affect future simulations. Every result retains a vehicle snapshot, full component documents, assembly calculations, overrides, run conditions, engine version, mapped FASTSim configuration, time-series data and assumptions. Comparison runs do not edit library parts. Export a report to keep the complete calculation context; CSV holds the numerical trace only.

SQLite contains the authoritative local history. The `data/components` and `data/vehicles` JSON seed files are read only for a new empty database; changing those files does not overwrite saved work. Set `EV_DB` to a different file for isolated projects. Regenerate the hypothetical JSON deliberately with `python -m scripts.make_demo` if desired.
