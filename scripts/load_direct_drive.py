"""Apply the requested two-wheel direct-drive layout once, preserving later edits."""
import json

from backend.database.store import ROOT, Store
from backend.schemas.entities import Component, Vehicle


DRIVE_ID = 'team-drive-wheel-direct'
REMOVED_IDS = {
    'team-drive-chain-420', 'team-drive-chain-rwd', 'team-drive-belt',
    'team-chain-420-pair', 'team-rear-sprocket-60-pair',
    'team-motor-sprocket-420-pair', 'team-chain-guard-adjustment',
}


def load(store=None):
    store = store or Store()
    drive = Component.model_validate(json.loads(
        (ROOT / 'data/components/team-direct-drive.json').read_text(encoding='utf-8'))[0]).model_dump()
    counts = {'components': 0, 'vehicles_updated': 0}
    with store.connect() as con:
        if not con.execute("SELECT 1 FROM records WHERE kind='components' AND id=?", (DRIVE_ID,)).fetchone():
            con.execute('INSERT INTO records VALUES(?,?,?)', ('components', DRIVE_ID, json.dumps(drive, allow_nan=False)))
            counts['components'] += 1
        row = con.execute("SELECT body FROM records WHERE kind='vehicles' AND id='team-ev-belt'").fetchone()
        if not row:
            return counts
        vehicle = json.loads(row[0])
        meta = vehicle.get('custom_parameters', {})
        if (meta.get('document_project') != 'team-parts-2026-10-22'
                or meta.get('direct_drive_version', 0) >= 1
                or not REMOVED_IDS.intersection(vehicle['component_ids'])):
            return counts
        vehicle['component_ids'] = [key for key in vehicle['component_ids'] if key not in REMOVED_IDS]
        vehicle['component_ids'].append(DRIVE_ID)
        if vehicle['name'] == 'TEAM / Two 36 V 500 W motors + rear chain drive / draft':
            vehicle['name'] = 'TEAM / Two 36 V 500 W motors / direct rear-wheel drive / draft'
        vehicle['notes'] = vehicle['notes'].replace('motors and rear chain drive.', 'motors and direct rear-wheel drive.')
        vehicle['notes'] += (
            '\nCurrent layout: two-wheel direct drive, one motor directly coupled to each rear wheel; '
            'no reduction gears, shared drive axle, belt or chain. Same steel/PVC frame materials.')
        meta['procurement_component_ids'] = list(dict.fromkeys(
            [key for key in meta.get('procurement_component_ids', []) if key not in REMOVED_IDS] + [DRIVE_ID]))
        meta['direct_drive_version'] = 1
        meta['architecture'].update(
            motor_count=2, driven_wheels='RWD', driven_wheel_count=2, drive_type='direct',
            shared_drive_axle=False, reduction_gears=False, belt_drive=False, chain_drive=False,
            wheel_connection='Each motor directly coupled to one rear wheel',
        )
        meta['topology'] = 'Two-wheel direct drive / one 36 V 500 W motor per rear wheel'
        meta['architecture_note'] = (
            'Each rear wheel attaches directly to its own motor; no gears, shared drive axle, '
            'belt, chain or differential. Retains the steel/PVC frame, two mounting plates, '
            'ESP32-controlled custom motor-drive circuitry, Ackermann steer-by-wire and THR-90 pedal. '
            'Wheel coupling, motor-shaft/bearing loads, mounts and control coordination remain unresolved.')
        meta['historical_drive_hardware_note'] = meta.get('drive_hardware_note', '')
        meta['drive_hardware_note'] = (
            'Direct wheel attachment replaces the chain hardware. Existing motor mounting '
            'plates are retained; wheel couplings, support bearings and retention are unselected.')
        meta['budget_note'] = (
            'Chain, sprockets and the guard/tensioner bundle are removed from the current purchase plan. '
            'Retained mounting plates and THR-90 pedal total $49.85 in recorded quotes. '
            'Motors, direct wheel attachment/support hardware, pipe quantities, frame fabrication '
            'and custom circuitry have unresolved costs; this remains a partial planning subtotal.')
        obsolete = {
            'Chain ratio, sprockets and rear axle layout without a differential',
            'Motor-sprocket shaft/tooth selection, chain alignment, gear ratio and rear axle layout',
            'Two-motor chain routing, controller arrangement and torque coordination',
            'Two-motor chain routing, custom-circuit commutation and torque coordination',
        }
        meta['unresolved_systems'] = [s for s in meta.get('unresolved_systems', []) if s not in obsolete] + [
            'Direct wheel-to-motor shaft attachment, retention and independent wheel support/bearing loads',
            'Motor mounts at each rear wheel and two-motor speed/torque coordination',
        ]
        meta['budget_excludes'] = [
            'Direct wheel attachment, support bearings and fabrication'
            if item in ['Drive adaptation/fabrication beyond the quoted hardware', 'Chain, sprockets and tensioning hardware'] else item
            for item in meta.get('budget_excludes', [])]
        vehicle['custom_parameters'] = meta
        validated = Vehicle.model_validate(vehicle).model_dump()
        con.execute('UPDATE records SET body=? WHERE kind=? AND id=?',
                    (json.dumps(validated, allow_nan=False), 'vehicles', vehicle['id']))
        counts['vehicles_updated'] += 1
    return counts


if __name__ == '__main__':
    print(json.dumps(load()))
