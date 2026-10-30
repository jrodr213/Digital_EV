"""Record team fabrication choices and the requested drive hardware once."""
import json

from backend.database.store import ROOT, Store
from backend.schemas.entities import Component, Vehicle


HARDWARE_IDS = [
    'team-motor-mount-plates', 'team-chain-420-pair', 'team-rear-sprocket-60-pair',
    'team-motor-sprocket-420-pair', 'team-chain-guard-adjustment',
]
REPLACEMENTS = {
    'team-chassis-materials': 'team-chassis-pipe-frame',
    'team-inverter': 'team-custom-drive-esp32',
    'team-drive-chain-rwd': 'team-drive-chain-420',
    'team-throttle-by-wire': 'team-throttle-thr90',
}


def load(store=None):
    store = store or Store()
    parts = [Component.model_validate(p).model_dump() for p in json.loads(
        (ROOT / 'data/components/team-drive-hardware.json').read_text(encoding='utf-8'))]
    counts = {'components': 0, 'vehicles_updated': 0}
    with store.connect() as con:
        existing = {r[0] for r in con.execute("SELECT id FROM records WHERE kind='components'")}
        for part in parts:
            if part['id'] not in existing:
                con.execute('INSERT INTO records VALUES(?,?,?)',
                            ('components', part['id'], json.dumps(part, allow_nan=False)))
                counts['components'] += 1
        row = con.execute("SELECT body FROM records WHERE kind='vehicles' AND id='team-ev-belt'").fetchone()
        if not row:
            return counts
        vehicle = json.loads(row[0])
        meta = vehicle.get('custom_parameters', {})
        if (meta.get('document_project') != 'team-parts-2026-10-22'
                or meta.get('drive_hardware_version', 0) >= 1):
            return counts

        def replace(keys):
            return list(dict.fromkeys(REPLACEMENTS.get(key, key) for key in keys))

        vehicle['component_ids'] = replace(vehicle['component_ids'])
        vehicle['component_ids'] += [key for key in HARDWARE_IDS if key not in vehicle['component_ids']]
        procurement = replace(meta.get('procurement_component_ids', []))
        for key in HARDWARE_IDS + ['team-custom-drive-esp32', 'team-chassis-pipe-frame']:
            if key not in procurement:
                procurement.append(key)
        meta['procurement_component_ids'] = procurement
        meta['drive_hardware_version'] = 1
        meta['architecture']['chassis_construction'] = 'Team-fabricated steel and PVC pipe frame'
        meta['architecture']['motor_control'] = 'ESP32 plus team-built power circuitry'
        meta['architecture']['throttle_input'] = 'THR-90 Hall-effect foot pedal'
        meta['commercial_bldc_controller_purchase'] = False
        meta['frame_fabrication'] = {
            'materials': ['steel tubing', 'PVC pipe'],
            'joining_method_user_claim': 'soldering',
            'joining_and_load_validation': 'unverified; material-specific joint details needed',
        }
        meta['architecture_note'] = (
            'Team-fabricated steel/PVC pipe chassis; ESP32 with team-built motor-drive '
            'power circuitry. Two #420 chain paths, 60-tooth rear sprockets, '
            'Ackermann steer-by-wire and a THR-90 electronic accelerator pedal. '
            'Frame joints, sprocket fit, exact ratio and circuit implementation remain unresolved.')
        meta['drive_hardware_note'] = (
            'Added two mounting plates, two 4 ft chains, two rear sprockets, two motor '
            'sprockets, the estimated guard/tensioner/bolt bundle and one THR-90 pedal. '
            'User-quoted additions: approximately $289.73+, including the ~$109+ bundle.')
        meta['budget_is_estimate'] = True
        meta['budget_is_lower_bound'] = True
        meta['partial_budget_usd'] = None
        meta['budget_note'] = (
            'New drive/pedal quote lines total approximately $289.73+, using the user\'s '
            'rounded ~$109+ guard/adjustment allowance. The known planning subtotal '
            'also includes historical allowances and the $185.99 battery snapshot. '
            'Motor cost, required pipe quantities, frame fabrication, custom drive '
            'circuitry, remaining systems, shipping and taxes are unresolved. '
            'Bundle quantities are estimates; this is not the full vehicle cost.')
        updates = {
            'Traction controller ratings and motor duty ratings':
                'Team-built ESP32 motor-drive circuit design, power-stage ratings and testing',
            'Chassis material roles, stock quantities, joints, load limits and finished geometry':
                'Fabricate the selected steel/PVC pipe frame; confirm material roles, quantities, joints and load capacity',
            'Chain ratio, sprockets and rear axle layout without a differential':
                'Motor-sprocket shaft/tooth selection, chain alignment, gear ratio and rear axle layout',
            'Ackermann linkage, steering actuator/feedback and by-wire throttle implementation':
                'Ackermann linkage/actuator and THR-90 signal conditioning, calibration and stop behavior',
            '36 V / 500 W motor duty ratings, pair mass, dimensions and controller compatibility':
                'Motor duty ratings, pair mass/dimensions and matching to the team-built power circuit',
            'Two-motor chain routing, controller arrangement and torque coordination':
                'Two-motor chain routing, custom-circuit commutation and torque coordination',
        }
        meta['unresolved_systems'] = [updates.get(s, s) for s in meta.get('unresolved_systems', [])]
        exclusions = {
            'Traction controller unless separately confirmed included': 'Parts and fabrication for the team-built motor-drive circuitry',
            'Chain, sprockets and tensioning hardware': 'Drive adaptation/fabrication beyond the quoted hardware',
            'Complete by-wire steering and throttle hardware': 'Remaining steering fabrication and throttle interface circuitry',
        }
        meta['budget_excludes'] = [exclusions.get(s, s) for s in meta.get('budget_excludes', [])]
        vehicle['custom_parameters'] = meta
        validated = Vehicle.model_validate(vehicle).model_dump()
        con.execute('UPDATE records SET body=? WHERE kind=? AND id=?',
                    (json.dumps(validated, allow_nan=False), 'vehicles', vehicle['id']))
        counts['vehicles_updated'] += 1
    return counts


if __name__ == '__main__':
    print(json.dumps(load()))
