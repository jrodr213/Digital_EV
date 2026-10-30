"""Apply the chassis/chain concept and latest two-motor selection once each."""
import json

from backend.database.store import ROOT, Store
from backend.schemas.entities import Component, Vehicle


MAIN_VEHICLE_ID = 'team-ev-belt'  # Stable ID retained across concept changes.
SINGLE_MOTOR_ID = 'team-motor-my1020-single'
PAIR_MOTOR_ID = 'team-motor-aliexpress-36v500-pair'
MATERIAL_IDS = ['team-material-pvc-10ft', 'team-material-steel-8ft']
REPLACEMENTS = {
    'team-motor-budget': SINGLE_MOTOR_ID,
    'team-motor-my1020-pair': SINGLE_MOTOR_ID,
    'team-drive-belt': 'team-drive-chain-rwd',
    'team-steering-budget': 'team-steering-ackermann-by-wire',
    'team-chassis': 'team-chassis-materials',
}


def load(store=None):
    store = store or Store()
    parts = [Component.model_validate(p).model_dump() for p in json.loads(
        (ROOT / 'data/components/team-architecture.json').read_text(encoding='utf-8'))]
    counts = {'components': 0, 'vehicles_updated': 0}
    with store.connect() as con:
        existing = {r[0] for r in con.execute("SELECT id FROM records WHERE kind='components'")}
        for part in parts:
            if part['id'] not in existing:
                con.execute('INSERT INTO records VALUES(?,?,?)',
                            ('components', part['id'], json.dumps(part, allow_nan=False)))
                counts['components'] += 1
        row = con.execute("SELECT body FROM records WHERE kind='vehicles' AND id=?",
                          (MAIN_VEHICLE_ID,)).fetchone()
        if not row:
            return counts
        vehicle = json.loads(row[0])
        meta = vehicle.get('custom_parameters', {})
        if (meta.get('document_project') != 'team-parts-2026-10-22'
                or meta.get('architecture_update_version', 0) >= 2
                or not {'team-motor-budget', 'team-motor-my1020-pair', SINGLE_MOTOR_ID, PAIR_MOTOR_ID}
                .intersection(vehicle['component_ids'])):
            return counts

        if meta.get('architecture_update_version', 0) >= 1:
            _select_final_pair(vehicle)
            validated = Vehicle.model_validate(vehicle).model_dump()
            con.execute('UPDATE records SET body=? WHERE kind=? AND id=?',
                        (json.dumps(validated, allow_nan=False), 'vehicles', vehicle['id']))
            counts['vehicles_updated'] += 1
            return counts

        def replace(keys):
            return list(dict.fromkeys(REPLACEMENTS.get(key, key) for key in keys))

        vehicle['component_ids'] = replace(vehicle['component_ids'])
        if 'team-throttle-by-wire' not in vehicle['component_ids']:
            vehicle['component_ids'].append('team-throttle-by-wire')
        if vehicle['name'] in {
            'TEAM / Single motor + rear belt drive / draft',
            'TEAM / Two MY1020 motors + rear belt drive / draft',
        }:
            vehicle['name'] = 'TEAM / Single MY1020 + rear chain drive / draft'
        procurement = replace(meta.get('procurement_component_ids', []))
        for key in MATERIAL_IDS + ['team-throttle-by-wire']:
            if key not in procurement:
                procurement.append(key)
        meta['procurement_component_ids'] = procurement
        meta['chassis_material_component_ids'] = MATERIAL_IDS
        meta['architecture_update_version'] = 1
        meta['architecture'] = {
            'motor_count': 1, 'driven_wheels': 'RWD', 'drive_type': 'chain',
            'steering_actuation': 'by-wire', 'steering_geometry': 'Ackermann',
            'throttle_actuation': 'by-wire', 'differential': 'none',
            'regenerative_braking': None,
        }
        meta['motor_selection_version'] = 2
        meta['motor_selection_note'] = (
            'One MY1020 brushless motor, replacing the earlier pair; listed 1000 W '
            'with exact 36 V / 48 V variant, duty ratings and price unconfirmed. '
            'User-supplied checkout code: THANKS27 (unverified).')
        meta['topology'] = 'One MY1020 motor / rear-wheel chain drive / no differential'
        meta['architecture_note'] = (
            'Steer-by-wire with Ackermann steering geometry; throttle-by-wire. '
            'PVC and steel stock are proposed chassis materials. '
            'Hardware, geometry and control implementation remain incomplete.')
        meta['regenerative_braking_note'] = (
            'Undecided. Confirm motor/controller support, battery/BMS charge '
            'acceptance and a back-drivable drivetrain before selecting regen. '
            'Mechanical brakes remain a separate required system.')
        meta['regenerative_braking_reference'] = 'https://media.kellycontroller.com/new/Kelly-AKBS-XUserManualV4.3.pdf'
        meta.setdefault('historical_partial_budget_usd', meta.get('partial_budget_usd'))
        meta['partial_budget_usd'] = None
        meta['budget_note'] = (
            'The superseded belt allowance is removed; chain cost is unknown. '
            'PVC $5.38 per 10 ft and steel $64.79 per 8 ft are user quotes with '
            'unknown stock quantities, excluded from the subtotal. Motor, '
            'fabricated chassis and complete controls costs remain unknown. '
            'Existing steering allowance is historical. No coupon discount assumed.')
        obsolete = {
            'MY1020 voltage variant, duty ratings, installed pair mass and dimensions',
            'Two-motor controller arrangement, belt routing and motor coordination',
        }
        unresolved = [s for s in meta.get('unresolved_systems', []) if s not in obsolete]
        for issue in [
            'MY1020 voltage variant, duty ratings, motor mass and compatible controller',
            'Chassis material roles, stock quantities, joints, load limits and finished geometry',
            'Chain ratio, sprockets and rear axle layout without a differential',
            'Ackermann linkage, steering actuator/feedback and by-wire throttle implementation',
            'Regenerative-braking feasibility and battery/BMS charge limits',
        ]:
            if issue not in unresolved:
                unresolved.append(issue)
        meta['unresolved_systems'] = unresolved
        excludes = meta.setdefault('budget_excludes', [])
        for item in ['Required chassis material quantities and fabrication',
                     'Chain, sprockets and tensioning hardware',
                     'Complete by-wire steering and throttle hardware']:
            if item not in excludes:
                excludes.append(item)
        vehicle['custom_parameters'] = meta
        _select_final_pair(vehicle)
        validated = Vehicle.model_validate(vehicle).model_dump()
        con.execute('UPDATE records SET body=? WHERE kind=? AND id=?',
                    (json.dumps(validated, allow_nan=False), 'vehicles', vehicle['id']))
        counts['vehicles_updated'] += 1
    return counts


def _select_final_pair(vehicle):
    """Replace traction only; retain the user's chassis, steering and regen decisions."""
    old_ids = {'team-motor-budget', 'team-motor-my1020-pair', SINGLE_MOTOR_ID}
    meta = vehicle['custom_parameters']
    for keys in [vehicle['component_ids'], meta.get('procurement_component_ids', [])]:
        keys[:] = list(dict.fromkeys(PAIR_MOTOR_ID if key in old_ids else key for key in keys))
    if vehicle['name'] == 'TEAM / Single MY1020 + rear chain drive / draft':
        vehicle['name'] = 'TEAM / Two 36 V 500 W motors + rear chain drive / draft'
    original_notes = (
        'Provisional assembly from the three supplied documents. The belt variant '
        'follows the budget preference, not a finalized design decision. '
        'No purchase or hardware validation is implied.')
    if vehicle['notes'] == original_notes:
        vehicle['notes'] = (
            'Provisional team assembly with two user-selected 36 V, 500 W brushless '
            'motors and rear chain drive. Chassis materials and by-wire controls '
            'are proposed; engineering inputs and hardware validation remain incomplete.')
    meta['architecture']['motor_count'] = 2
    meta['architecture_update_version'] = 2
    meta['motor_selection_version'] = 3
    meta['motor_selection_note'] = (
        'Two brushless motors from AliExpress item 3256809008940329, with the '
        '36 V / 500 W variant selected by the user for each motor. '
        'The old MY1020 setup is replaced. Combined listing wattage is 1000 W; '
        'continuous/peak ratings, installed pair mass, controller arrangement '
        'and price remain unverified. No checkout code is confirmed for this product.')
    meta['topology'] = 'Two 36 V 500 W brushless motors / rear-wheel chain drive / no differential'
    obsolete = {
        'MY1020 voltage variant, duty ratings, motor mass and compatible controller',
        'MY1020 voltage variant, duty ratings, installed pair mass and dimensions',
        'Two-motor controller arrangement, belt routing and motor coordination',
    }
    unresolved = [s for s in meta.get('unresolved_systems', []) if s not in obsolete]
    for issue in [
        '36 V / 500 W motor duty ratings, pair mass, dimensions and controller compatibility',
        'Two-motor chain routing, controller arrangement and torque coordination',
    ]:
        if issue not in unresolved:
            unresolved.append(issue)
    meta['unresolved_systems'] = unresolved


if __name__ == '__main__':
    print(json.dumps(load()))
