"""Add the requested sensor layout without replacing existing project edits.

Only team-document designs are migrated. Existing sensor records and a vehicle's
explicit later removals are preserved when this loader is run again.
"""
import json

from backend.database.store import ROOT, Store
from backend.schemas.entities import Component, Vehicle


def load(store=None):
    store = store or Store()
    sensors = [Component.model_validate(p).model_dump() for p in json.loads(
        (ROOT / 'data/components/team-sensors.json').read_text(encoding='utf-8'))]
    sensor_ids = [p['id'] for p in sensors]
    counts = {'components': 0, 'vehicles_updated': 0}
    # One transaction keeps additions and design references consistent.
    with store.connect() as con:
        existing = {r[0] for r in con.execute("SELECT id FROM records WHERE kind='components'")}
        for sensor in sensors:
            if sensor['id'] not in existing:
                con.execute('INSERT INTO records VALUES(?,?,?)',
                            ('components', sensor['id'], json.dumps(sensor, allow_nan=False)))
                counts['components'] += 1
        vehicles = [json.loads(r[0]) for r in con.execute("SELECT body FROM records WHERE kind='vehicles'")]
        for vehicle in vehicles:
            meta = vehicle.get('custom_parameters', {})
            if meta.get('document_project') != 'team-parts-2026-10-22' or meta.get('sensor_layout_version', 0) >= 1:
                continue
            ids = [key for key in vehicle['component_ids'] if key != 'team-sensors']
            vehicle['component_ids'] = ids + [key for key in sensor_ids if key not in ids]
            meta['sensor_layout_version'] = 1
            meta['sensor_layout_note'] = 'Eight linked product types; mounting locations and quantities are estimated.'
            meta['unresolved_systems'] = [
                'Sensor mounting, wiring, calibration and installed masses' if s == 'Sensors and feedback' else s
                for s in meta.get('unresolved_systems', [])]
            vehicle['custom_parameters'] = meta
            validated = Vehicle.model_validate(vehicle).model_dump()
            con.execute('UPDATE records SET body=? WHERE kind=? AND id=?',
                        (json.dumps(validated, allow_nan=False), 'vehicles', vehicle['id']))
            counts['vehicles_updated'] += 1
    return counts


if __name__ == '__main__':
    print(json.dumps(load()))
