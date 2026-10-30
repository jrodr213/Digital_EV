import json

from backend.database.store import ROOT, Store
from backend.validation.assembly import assemble
from scripts.load_motor_project import PAIR_ID, load
from scripts.load_team_project import load as load_team
from scripts.load_sensor_project import load as load_sensors
from scripts.load_architecture_project import PAIR_MOTOR_ID


def test_pair_replaces_only_main_motor_and_remains_incomplete(tmp_path):
    store = Store(tmp_path / 'motors.sqlite')
    originals = json.loads((ROOT / 'data/vehicles/team-drafts.json').read_text(encoding='utf-8'))
    main = originals[0]
    main['notes'] = 'Keep our mechanical review'
    main['payload_kg'] = 12
    main['component_ids'].append('custom-part')
    for vehicle in originals:
        store.put('vehicles', vehicle)
    assert load(store) == {'components': 3, 'vehicles_updated': 1}
    updated = store.get('vehicles', main['id'])
    assert updated['notes'] == main['notes']
    assert updated['payload_kg'] == 12
    assert 'custom-part' in updated['component_ids']
    assert PAIR_ID in updated['component_ids']
    assert 'team-motor-budget' not in updated['component_ids']
    assert PAIR_ID in updated['custom_parameters']['procurement_component_ids']
    assert 'team-motor-budget' not in updated['custom_parameters']['procurement_component_ids']
    assert updated['custom_parameters']['partial_budget_usd'] is None
    assert updated['custom_parameters']['historical_partial_budget_usd'] == 333
    for alternative in originals[1:]:
        assert store.get('vehicles', alternative['id']) == alternative

    # The historical pair stage stays incomplete when source parts/sensors are added.
    for component in json.loads((ROOT / 'data/components/team-parts.json').read_text(encoding='utf-8')):
        store.put('components', component)
    load_sensors(store)
    updated = store.get('vehicles', main['id'])
    assert 'team-sensor-gps' in updated['component_ids']
    pair = store.get('components', PAIR_ID)
    assert pair['custom_parameters']['installed_quantity'] == 2
    assert pair['custom_parameters']['checkout_code'] == 'THANKS27'
    assert pair['specs']['listed_power_per_motor_w'] == 1000
    assert not {'rated_power_kw', 'peak_power_kw', 'rated_torque_nm', 'efficiency'} & pair['specs'].keys()
    assert pair['mass_kg'] is None and pair['price'] is None
    parts = [p for p in store.list('components') if p['id'] in updated['component_ids']]
    assert sum(p['category'] == 'motor' for p in parts) == 1
    assert {p['id'] for p in parts if p['category'] == 'motor'} == {PAIR_ID}
    assembly = assemble(updated, parts)
    assert assembly['errors'] and assembly['mass_kg'] is None
    assert 'mechanical_power_kw' not in assembly
    brushed = store.get('components', 'team-motor-walmart-1000-brushed')
    assert brushed['specs']['listed_motor_type'] == 'brushed DC'
    assert brushed['id'] not in updated['component_ids']


def test_repeat_load_preserves_pair_edits_and_later_motor_removal(tmp_path):
    store = Store(tmp_path / 'edits.sqlite')
    load_team(store)
    pair = store.get('components', PAIR_ID)
    pair['notes'] = 'Team measured motor mounting'
    store.put('components', pair)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['component_ids'].remove(PAIR_MOTOR_ID)
    vehicle['name'] = 'Our revised chassis'
    store.put('vehicles', vehicle)
    assert load_team(store) == {'components': 0, 'vehicles': 0}
    assert store.get('components', PAIR_ID) == pair
    assert store.get('vehicles', vehicle['id']) == vehicle


def test_initial_migration_respects_a_different_existing_motor(tmp_path):
    store = Store(tmp_path / 'different.sqlite')
    vehicle = json.loads((ROOT / 'data/vehicles/team-drafts.json').read_text(encoding='utf-8'))[0]
    vehicle['name'] = 'Custom design'
    vehicle['component_ids'][0] = 'our-motor'
    store.put('vehicles', vehicle)
    assert load(store) == {'components': 3, 'vehicles_updated': 0}
    assert store.get('vehicles', vehicle['id']) == vehicle
