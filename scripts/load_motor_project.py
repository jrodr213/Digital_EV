"""Install the user's MY1020 pair in the main draft once, preserving later edits."""
import json

from backend.database.store import ROOT, Store
from backend.schemas.entities import Component, Vehicle


PAIR_ID = 'team-motor-my1020-pair'
ORIGINAL_MOTOR_ID = 'team-motor-budget'
MAIN_VEHICLE_ID = 'team-ev-belt'


def load(store=None):
    store = store or Store()
    motors = [Component.model_validate(p).model_dump() for p in json.loads(
        (ROOT / 'data/components/team-motors.json').read_text(encoding='utf-8'))]
    counts = {'components': 0, 'vehicles_updated': 0}
    with store.connect() as con:
        existing = {r[0] for r in con.execute("SELECT id FROM records WHERE kind='components'")}
        for motor in motors:
            if motor['id'] not in existing:
                con.execute('INSERT INTO records VALUES(?,?,?)',
                            ('components', motor['id'], json.dumps(motor, allow_nan=False)))
                counts['components'] += 1
        row = con.execute("SELECT body FROM records WHERE kind='vehicles' AND id=?",
                          (MAIN_VEHICLE_ID,)).fetchone()
        if not row:
            return counts
        vehicle = json.loads(row[0])
        meta = vehicle.get('custom_parameters', {})
        # Do not replace a subsequently chosen motor or repeat the initial selection.
        if (meta.get('document_project') != 'team-parts-2026-10-22'
                or meta.get('motor_selection_version', 0) >= 1
                or ORIGINAL_MOTOR_ID not in vehicle['component_ids']):
            return counts
        vehicle['component_ids'] = list(dict.fromkeys(
            PAIR_ID if key == ORIGINAL_MOTOR_ID else key for key in vehicle['component_ids']))
        if vehicle['name'] == 'TEAM / Single motor + rear belt drive / draft':
            vehicle['name'] = 'TEAM / Two MY1020 motors + rear belt drive / draft'
        meta['procurement_component_ids'] = list(dict.fromkeys(
            PAIR_ID if key == ORIGINAL_MOTOR_ID else key
            for key in meta.get('procurement_component_ids', [])))
        meta['motor_selection_version'] = 1
        meta['motor_selection_note'] = (
            'Two MY1020 brushless motors selected by the user on October 30, 2026; '
            'listed 1000 W each, with 36 V / 48 V variant unconfirmed. '
            'Pair price and controller arrangement are unknown. '
            'User-supplied AliExpress checkout code: THANKS27 (unverified).')
        meta['historical_partial_budget_usd'] = meta.get('partial_budget_usd')
        meta['partial_budget_usd'] = None
        meta['budget_note'] = (
            'The original document budget is historical. The selected pair has no '
            'confirmed price, so the current subtotal excludes both motors. '
            'Existing non-motor planning allowances remain; this is not a complete '
            'vehicle cost. THANKS27 has no assumed discount.')
        meta['topology'] = (
            'Two MY1020 brushless motors with proposed rear belt drive; '
            'belt routing and motor coordination unresolved')
        unresolved = meta.setdefault('unresolved_systems', [])
        for issue in [
            'MY1020 voltage variant, duty ratings, installed pair mass and dimensions',
            'Two-motor controller arrangement, belt routing and motor coordination',
        ]:
            if issue not in unresolved:
                unresolved.append(issue)
        vehicle['custom_parameters'] = meta
        validated = Vehicle.model_validate(vehicle).model_dump()
        con.execute('UPDATE records SET body=? WHERE kind=? AND id=?',
                    (json.dumps(validated, allow_nan=False), 'vehicles', vehicle['id']))
        counts['vehicles_updated'] += 1
    return counts


if __name__ == '__main__':
    print(json.dumps(load()))
