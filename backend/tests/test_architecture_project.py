import json

from backend.database.store import ROOT, Store
from backend.validation.assembly import assemble
from scripts.load_architecture_project import MATERIAL_IDS, PAIR_MOTOR_ID, SINGLE_MOTOR_ID, load
from scripts.load_motor_project import load as load_pair
from scripts.load_sensor_project import load as load_sensors
from scripts.load_team_project import load as load_team


def test_latest_concept_replaces_pair_and_preserves_other_records(tmp_path):
    store = Store(tmp_path / 'architecture.sqlite')
    for kind, path in [('components', 'data/components/team-parts.json'),
                       ('vehicles', 'data/vehicles/team-drafts.json')]:
        for record in json.loads((ROOT / path).read_text(encoding='utf-8')):
            store.put(kind, record)
    load_sensors(store)
    load_pair(store)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['name'] = 'Our mechanical review'
    vehicle['notes'] = 'Keep bracket measurements'
    vehicle['payload_kg'] = 12
    vehicle['component_ids'].remove('team-sensor-gps')
    store.put('vehicles', vehicle)
    with store.connect() as con:
        before = {(k, i): b for k, i, b in con.execute('SELECT kind,id,body FROM records')}
    assert load(store) == {'components': 8, 'vehicles_updated': 1}
    with store.connect() as con:
        after = {(k, i): b for k, i, b in con.execute('SELECT kind,id,body FROM records')}
    assert [key for key in before if before[key] != after[key]] == [('vehicles', 'team-ev-belt')]
    updated = store.get('vehicles', vehicle['id'])
    assert updated['name'] == vehicle['name'] and updated['notes'] == vehicle['notes']
    assert updated['payload_kg'] == 12
    assert 'team-sensor-gps' not in updated['component_ids']
    assert 'team-motor-my1020-pair' not in updated['component_ids']
    assert 'team-drive-belt' not in updated['component_ids']
    assert 'team-motor-my1020-pair' not in updated['custom_parameters']['procurement_component_ids']
    assert updated['custom_parameters']['historical_partial_budget_usd'] == 333


def test_fresh_load_has_final_pair_and_explicit_unresolved_regen_and_chassis(tmp_path):
    store = Store(tmp_path / 'fresh.sqlite')
    assert load_team(store) == {'components': 63, 'vehicles': 3}
    vehicle = store.get('vehicles', 'team-ev-belt')
    assert vehicle['name'] == 'TEAM / Two 36 V 500 W motors / direct rear-wheel drive / draft'
    meta = vehicle['custom_parameters']
    assert {
        'motor_count': 2, 'driven_wheels': 'RWD', 'drive_type': 'direct',
        'steering_actuation': 'by-wire', 'steering_geometry': 'Ackermann',
        'throttle_actuation': 'by-wire', 'differential': 'none',
        'regenerative_braking': None,
    }.items() <= meta['architecture'].items()
    parts = [store.get('components', key) for key in vehicle['component_ids']]
    motors = [p for p in parts if p['category'] == 'motor']
    assert [p['id'] for p in motors] == [PAIR_MOTOR_ID]
    assert motors[0]['custom_parameters']['installed_quantity'] == 2
    assert motors[0]['specs']['listed_voltage_v'] == 36
    assert motors[0]['specs']['listed_power_per_motor_w'] == 500
    assert 'checkout_code' not in motors[0]['custom_parameters']
    assert not {'rated_power_kw', 'peak_power_kw', 'efficiency'} & motors[0]['specs'].keys()
    drive = next(p for p in parts if p['category'] == 'drivetrain')
    assert {'drive_type': 'direct', 'driven_wheels': 'RWD', 'differential': 'none'}.items() <= drive['specs'].items()
    assert len({p['id'] for p in parts}) == len(parts)
    assert sum(bool(p['custom_parameters'].get('sensor_type')) for p in parts) == 8
    assert not set(MATERIAL_IDS).intersection(vehicle['component_ids'])
    assert set(MATERIAL_IDS) <= set(meta['procurement_component_ids'])
    assert [store.get('components', key)['price'] for key in MATERIAL_IDS] == [5.38, 64.79]
    assert all(store.get('components', key)['custom_parameters']['purchase_quantity'] is None for key in MATERIAL_IDS)
    chassis = next(p for p in parts if p['category'] == 'chassis')
    assert chassis['specs'] == {} and chassis['mass_kg'] is None
    assert chassis['custom_parameters']['material_component_ids'] == MATERIAL_IDS
    inverter = next(p for p in parts if p['category'] == 'inverter')
    assert 'regen' not in inverter['specs']
    assembly = assemble(vehicle, parts)
    assert assembly['errors'] and assembly['mass_kg'] is None
    assert 'mechanical_power_kw' not in assembly


def test_repeat_load_retains_later_component_and_architecture_edits(tmp_path):
    store = Store(tmp_path / 'edits.sqlite')
    load_team(store)
    motor = store.get('components', PAIR_MOTOR_ID)
    motor['notes'] = 'New measurements'
    store.put('components', motor)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['component_ids'].remove(PAIR_MOTOR_ID)
    vehicle['custom_parameters']['architecture']['regenerative_braking'] = False
    store.put('vehicles', vehicle)
    assert load_team(store) == {'components': 0, 'vehicles': 0}
    assert store.get('components', motor['id']) == motor
    assert store.get('vehicles', vehicle['id']) == vehicle


def test_existing_chain_concept_changes_only_motor_fields(tmp_path):
    store = Store(tmp_path / 'previous-concept.sqlite')
    load_team(store)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['component_ids'] = [SINGLE_MOTOR_ID if key == PAIR_MOTOR_ID else key for key in vehicle['component_ids']]
    meta = vehicle['custom_parameters']
    meta['procurement_component_ids'] = [SINGLE_MOTOR_ID if key == PAIR_MOTOR_ID else key for key in meta['procurement_component_ids']]
    meta['architecture_update_version'] = 1
    meta['architecture']['motor_count'] = 1
    meta['architecture']['regenerative_braking'] = False
    meta['regenerative_braking_note'] = 'Team deferred regen'
    vehicle['name'] = 'Keep our chosen name'
    vehicle['notes'] = 'Keep our chassis review'
    vehicle['component_ids'].remove('team-sensor-gps')
    store.put('vehicles', vehicle)
    assert load(store) == {'components': 0, 'vehicles_updated': 1}
    updated = store.get('vehicles', vehicle['id'])
    assert updated['name'] == vehicle['name'] and updated['notes'] == vehicle['notes']
    assert 'team-sensor-gps' not in updated['component_ids']
    assert SINGLE_MOTOR_ID not in updated['component_ids']
    assert PAIR_MOTOR_ID in updated['component_ids']
    assert updated['custom_parameters']['architecture']['regenerative_braking'] is False
    assert updated['custom_parameters']['regenerative_braking_note'] == 'Team deferred regen'
    assert updated['custom_parameters']['chassis_material_component_ids'] == meta['chassis_material_component_ids']
    for field in ['drive_type', 'differential', 'steering_geometry', 'steering_actuation', 'throttle_actuation']:
        assert updated['custom_parameters']['architecture'][field] == meta['architecture'][field]
