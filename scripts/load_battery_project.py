"""Select the requested battery in the main car once, preserving later edits."""
import json

from backend.database.store import ROOT, Store
from backend.schemas.entities import Component, Vehicle


BATTERY_ID = 'team-battery-uugpower-36v15ah'
MAIN_VEHICLE_ID = 'team-ev-belt'


def load(store=None):
    store = store or Store()
    battery = Component.model_validate(json.loads(
        (ROOT / 'data/components/team-battery.json').read_text(encoding='utf-8'))[0]).model_dump()
    counts = {'components': 0, 'vehicles_updated': 0}
    with store.connect() as con:
        if not con.execute("SELECT 1 FROM records WHERE kind='components' AND id=?", (BATTERY_ID,)).fetchone():
            con.execute('INSERT INTO records VALUES(?,?,?)',
                        ('components', BATTERY_ID, json.dumps(battery, allow_nan=False)))
            counts['components'] += 1
        row = con.execute("SELECT body FROM records WHERE kind='vehicles' AND id=?", (MAIN_VEHICLE_ID,)).fetchone()
        if not row:
            return counts
        vehicle = json.loads(row[0])
        meta = vehicle.get('custom_parameters', {})
        if (meta.get('document_project') != 'team-parts-2026-10-22'
                or meta.get('battery_selection_version', 0) >= 1
                or 'team-battery' not in vehicle['component_ids']):
            return counts
        vehicle['component_ids'] = list(dict.fromkeys(
            BATTERY_ID if key == 'team-battery' else key for key in vehicle['component_ids']))
        procurement = list(dict.fromkeys(
            BATTERY_ID if key == 'team-battery' else key
            for key in meta.get('procurement_component_ids', [])))
        if BATTERY_ID not in procurement:
            procurement.append(BATTERY_ID)
        meta['procurement_component_ids'] = procurement
        meta['battery_selection_version'] = 1
        meta['battery_selection_note'] = (
            'One UUGPOWER-branded 36 V / 15 Ah pack, seller-listed as 540 Wh '
            'with a 40 A maximum BMS discharge rating. Continuous/charge limits, '
            'regen support, installed mass and conflicting dimensions remain unresolved.')
        meta['unresolved_systems'] = [
            'Battery/BMS voltage, continuous discharge and charge limits; power distribution and mounting'
            if issue == 'Battery/BMS and power distribution' else issue
            for issue in meta.get('unresolved_systems', [])]
        meta['budget_excludes'] = [
            'Battery mounting, protection and power distribution beyond the listed pack'
            if item == 'Battery and BMS' else item for item in meta.get('budget_excludes', [])]
        meta['budget_note'] = meta.get('budget_note', '') + (
            ' Battery listing price recorded as $185.99; final checkout, shipping '
            'and taxes are unconfirmed. The subtotal remains a partial planning figure.')
        vehicle['custom_parameters'] = meta
        validated = Vehicle.model_validate(vehicle).model_dump()
        con.execute('UPDATE records SET body=? WHERE kind=? AND id=?',
                    (json.dumps(validated, allow_nan=False), 'vehicles', vehicle['id']))
        counts['vehicles_updated'] += 1
    return counts


if __name__ == '__main__':
    print(json.dumps(load()))
