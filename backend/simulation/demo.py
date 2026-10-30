"""Explicit, snapshot-only estimates for running incomplete student assemblies."""
from copy import deepcopy
import math

from backend.components.catalog import FIELDS, REQUIRED
from backend.validation.assembly import assemble


DEMO_NOTICE = (
    'DEMO ESTIMATE: missing inputs use assumed values and unverified listing claims. '
    'Results describe this assumed configuration, not measured hardware performance. '
    'Frame strength, joints, steering, braking and motor-drive circuitry are not simulated.'
)

# Installed assembly allowances, not per-item weights or material measurements.
MASS_KG = {
    'chassis': 35., 'battery': 6., 'inverter': 1., 'drivetrain': 8.,
    'tires': 12., 'suspension': 5., 'brakes': 3., 'steering': 4.,
    'cooling': .3, 'auxiliary': 1., 'vision': .1,
    'embedded_controllers': .1, 'signal_interface': .05, 'safety_controls': .2,
    'throttle_control': .5, 'motor_mounts': 2., 'drive_chain': 2.,
    'rear_sprockets': 2., 'motor_sprockets': .3, 'chain_protection': 1.5,
}


def positive(value, fallback):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0 else fallback


def prepare_demo(vehicle, components):
    """Fill only absent values; retain selected IDs, known values and invalid inputs.

    The ledger records every assignment, including use of a seller claim as a
    modeling input. Neither the saved vehicle nor its library parts is changed.
    Ordinary assembly validation still checks the resulting configuration.
    """
    vehicle, components = deepcopy(vehicle), deepcopy(components)
    assumptions = []

    def fill(record, field, value, unit, basis, part=None):
        if record.get(field) is not None:
            return
        record[field] = value
        assumptions.append({
            'component_id': part.get('id') if part else None,
            'component_name': part['name'] if part else vehicle['name'],
            'field': field, 'value': value, 'unit': unit, 'basis': basis,
        })
        if part is not None and record is part['specs']:
            part.setdefault('units', {})[field] = unit

    fill(vehicle, 'payload_kg', 75., 'kg', 'Demo allowance for one passenger.')
    fill(vehicle, 'auxiliary_w', 50., 'W', 'Demo allowance for controls, sensors and cooling.')
    grouped = {}
    for part in components:
        grouped.setdefault(part['category'], []).append(part)
        part.setdefault('specs', {})
        quantity = positive(part.get('custom_parameters', {}).get('installed_quantity'), 1)
        mass = (4. * quantity if part['category'] == 'motor' else
                .05 * quantity if part['category'] == 'sensors' else
                1. if part['category'] == 'drivetrain' and part['specs'].get('drive_type') == 'direct' else
                MASS_KG.get(part['category'], .5))
        fill(part, 'mass_kg', mass, 'kg', 'Estimated total installed assembly mass; quantity is already included.', part)

    def specs(category):
        parts = grouped.get(category, [])
        return parts[0]['specs'] if len(parts) == 1 else {}

    def complete(category, defaults, reasons=None):
        for part in grouped.get(category, []):
            for field in REQUIRED[category]:
                fill(part['specs'], field, defaults[field], FIELDS[category][field],
                     (reasons or {}).get(field, 'Illustrative demo assumption; replace with a measured or reviewed rating.'), part)

    b = specs('battery')
    nominal = positive(b.get('listed_nominal_voltage_v'), 36.)
    cell_v = positive(b.get('cell_voltage_v'), 3.6)
    series = positive(b.get('series'), max(1, round(nominal / cell_v)))
    parallel = positive(b.get('parallel'), 1)
    voltage = cell_v * series
    full = positive(b.get('cell_max_voltage_v'), 4.2) * series
    max_discharge = positive(b.get('listed_bms_max_discharge_a'), 40.)
    continuous = positive(b.get('continuous_a'), min(20., max_discharge))
    min_soc = b.get('min_soc') if isinstance(b.get('min_soc'), (int, float)) else .1
    max_soc = b.get('max_soc') if isinstance(b.get('max_soc'), (int, float)) else .9
    efficiency = b.get('charge_efficiency') if b.get('charge_efficiency') is not None else b.get('discharge_efficiency', .95)
    if efficiency is None:
        efficiency = .95
    complete('battery', {
        'capacity_ah': positive(b.get('listed_capacity_ah'), 15.) / parallel,
        'cell_voltage_v': cell_v, 'cell_max_voltage_v': 4.2,
        'series': series, 'parallel': parallel, 'usable_fraction': max_soc - min_soc,
        'continuous_a': continuous, 'peak_a': max(continuous, max_discharge),
        'charge_limit_a': continuous, 'charge_efficiency': efficiency,
        'discharge_efficiency': efficiency, 'bms_min_v': voltage * .75,
        'bms_max_v': full, 'bms_continuous_a': continuous,
        'min_soc': min_soc, 'max_soc': max_soc,
    }, {
        'capacity_ah': 'Listed pack capacity used as an unverified demo input, or 15 Ah if unspecified; divided by parallel count.',
        'series': 'Equivalent cell count inferred from listed pack voltage (36 V fallback) and assumed cell voltage; actual cell layout is unknown.',
        'charge_limit_a': 'Model-only charge allowance equal to continuous discharge for the symmetric FASTSim adapter; actual charge/regen limit is unknown.',
    })

    m = specs('motor')
    motor_parts = grouped.get('motor', [])
    quantity = positive(motor_parts[0].get('custom_parameters', {}).get('installed_quantity'), 1) if motor_parts else 1
    listed_w = positive(m.get('listed_power_per_motor_w'), positive(m.get('listed_power_w'), 500.))
    power = positive(m.get('rated_power_kw'), listed_w * quantity / 1000)
    rpm = positive(m.get('max_rpm'), positive(m.get('listed_speed_rpm'), 3000.))
    torque = positive(m.get('rated_torque_nm'), power * 1000 * 60 / (2 * math.pi * rpm) * 1.1)
    complete('motor', {
        'rated_power_kw': power, 'peak_power_kw': power,
        'rated_torque_nm': torque, 'peak_torque_nm': torque,
        'max_rpm': rpm, 'efficiency': .8,
    }, {
        'rated_power_kw': 'Listed wattage times installed quantity treated as continuous power for this demo; duty rating is unverified (500 W per motor fallback).',
        'peak_power_kw': 'No peak boost assumed; equals continuous power.',
        'rated_torque_nm': 'Estimated aggregate torque from demo continuous power and RPM, with a 10% allowance.',
    })
    complete('inverter', {
        'min_voltage_v': voltage * .5, 'max_voltage_v': full * 1.1,
        'continuous_a': continuous, 'peak_a': max(continuous, max_discharge),
        'max_power_kw': voltage * continuous / 1000, 'efficiency': .95, 'regen': True,
    }, {'regen': 'Regeneration assumed solely for adapter compatibility. The custom circuitry and battery have no verified regen support.'})
    d = specs('drivetrain')
    complete('drivetrain', {
        'gear_ratio': 1. if d.get('drive_type') == 'direct' else positive(d.get('listed_rear_sprocket_teeth'), 60) / 10,
        'efficiency': .9, 'wheel_diameter_m': .33,
        'max_torque_nm': torque * 1.5, 'max_input_rpm': rpm, 'driven_wheels': 'RWD',
    }, {'gear_ratio': 'Demo reduction assumes a 10-tooth motor sprocket and listed rear teeth (60 fallback); direct drive uses 1:1.'})
    complete('chassis', {
        'wheelbase_m': 1.5, 'cg_height_m': .45, 'drag_coefficient': .8,
        'frontal_area_m2': 1., 'drive_axle_weight_fraction': .6,
    })
    complete('tires', {
        'rolling_resistance': .02, 'friction_coefficient': .7,
        'wheel_inertia_kgm2': .08, 'num_wheels': 4,
    })
    assembly = assemble(vehicle, components)
    assembly['auxiliary_w'] = vehicle['auxiliary_w']
    assembly['warnings'].insert(0, DEMO_NOTICE)
    assembly['demo_assumptions'] = assumptions
    return vehicle, assembly
