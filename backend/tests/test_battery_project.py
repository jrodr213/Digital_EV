from backend.database.store import Store
from backend.validation.assembly import assemble
from scripts.load_battery_project import BATTERY_ID, load
from scripts.load_team_project import load as load_team


def test_selected_battery_claims_do_not_become_missing_engineering_ratings(tmp_path):
    store = Store(tmp_path / 'battery.sqlite')
    assert load_team(store) == {'components': 62, 'vehicles': 3}
    vehicle = store.get('vehicles', 'team-ev-belt')
    parts = [store.get('components', key) for key in vehicle['component_ids']]
    assert [p['id'] for p in parts if p['category'] == 'battery'] == [BATTERY_ID]
    assert BATTERY_ID in vehicle['custom_parameters']['procurement_component_ids']
    battery = store.get('components', BATTERY_ID)
    assert battery['custom_parameters']['installed_quantity'] == 1
    assert battery['specs']['listed_nominal_voltage_v'] == 36
    assert battery['specs']['listed_capacity_ah'] == 15
    assert battery['specs']['listed_energy_wh'] == 540
    assert battery['specs']['listed_bms_max_discharge_a'] == 40
    assert battery['mass_kg'] is None
    assert not {'continuous_a', 'bms_continuous_a', 'charge_limit_a', 'series', 'parallel', 'usable_fraction'} & battery['specs'].keys()
    assert {claim['height_mm'] for claim in battery['custom_parameters']['dimension_claims']} == {89, 122}
    assert vehicle['custom_parameters']['architecture']['motor_count'] == 2
    assert vehicle['custom_parameters']['architecture']['regenerative_braking'] is None
    for key in ['team-ev-differential', 'team-ev-dual-direct']:
        assert 'team-battery' in store.get('vehicles', key)['component_ids']
    assembly = assemble(vehicle, parts)
    assert assembly['errors'] and assembly['mass_kg'] is None
    assert 'usable_energy_kwh' not in assembly


def test_battery_update_preserves_other_records_and_subsequent_edits(tmp_path):
    store = Store(tmp_path / 'edits.sqlite')
    load_team(store)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['component_ids'] = ['team-battery' if key == BATTERY_ID else key for key in vehicle['component_ids']]
    vehicle['custom_parameters']['battery_selection_version'] = 0
    vehicle['notes'] = 'Keep mounting review'
    store.put('vehicles', vehicle)
    with store.connect() as con:
        before = {(k, i): b for k, i, b in con.execute('SELECT kind,id,body FROM records')}
    assert load(store) == {'components': 0, 'vehicles_updated': 1}
    with store.connect() as con:
        after = {(k, i): b for k, i, b in con.execute('SELECT kind,id,body FROM records')}
    assert [key for key in before if before[key] != after[key]] == [('vehicles', 'team-ev-belt')]
    updated = store.get('vehicles', vehicle['id'])
    assert updated['notes'] == vehicle['notes']
    updated['component_ids'].remove(BATTERY_ID)
    store.put('vehicles', updated)
    battery = store.get('components', BATTERY_ID)
    battery['notes'] = 'Team measured the bracket'
    store.put('components', battery)
    assert load_team(store) == {'components': 0, 'vehicles': 0}
    assert store.get('vehicles', updated['id']) == updated
    assert store.get('components', BATTERY_ID) == battery
