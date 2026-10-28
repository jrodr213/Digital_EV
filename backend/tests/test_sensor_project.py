import json

from backend.database.store import ROOT, Store
from backend.validation.assembly import assemble
from scripts.load_team_project import load as load_team
from scripts.load_sensor_project import load


def test_sensors_are_installed_on_all_team_concepts_only(tmp_path):
    store = Store(tmp_path / 'sensors.sqlite')
    demo = json.loads((ROOT / 'data/vehicles/demo.json').read_text())
    store.put('vehicles', demo)
    load_team(store)
    sensors = {p['id']: p for p in store.list('components') if p['custom_parameters'].get('sensor_type')}
    assert {p['custom_parameters']['sensor_type'] for p in sensors.values()} == {
        'infrared', 'ultrasonic', 'gps', 'temperature', 'force', 'rotary', 'hall', 'wheel_encoder'}
    assert sum(len(p['custom_parameters']['sensor_mounts']) for p in sensors.values()) == 12
    assert store.get('vehicles', demo['id']) == demo
    for vehicle in store.list('vehicles'):
        if vehicle['id'] == demo['id']:
            continue
        assert set(sensors) <= set(vehicle['component_ids'])
        assert 'team-sensors' not in vehicle['component_ids']
        assert len(vehicle['component_ids']) == len(set(vehicle['component_ids']))
        parts = [store.get('components', key) for key in vehicle['component_ids']]
        assembly = assemble(vehicle, parts)
        assert assembly['mass_kg'] is None and assembly['errors']
        assert 'usable_energy_kwh' not in assembly
    force = sensors['team-sensor-force']
    assert force['specs']['listed_force_range_n'] == [.2, 20]
    assert 'tire pressure' in force['notes']
    assert sensors['team-sensor-wheel_encoder']['custom_parameters']['package_units'] == 2


def test_sensor_reload_preserves_edits_and_intentional_removals(tmp_path):
    store = Store(tmp_path / 'edits.sqlite')
    load_team(store)
    sensor = store.get('components', 'team-sensor-gps')
    sensor['notes'] = 'Team chose a different mounting bracket'
    store.put('components', sensor)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['component_ids'].remove(sensor['id'])
    vehicle['notes'] = 'Team review preserved'
    store.put('vehicles', vehicle)
    assert load(store) == {'components': 0, 'vehicles_updated': 0}
    assert load_team(store) == {'components': 0, 'vehicles': 0}
    assert store.get('components', sensor['id']) == sensor
    assert store.get('vehicles', vehicle['id']) == vehicle


def test_existing_team_design_is_migrated_without_losing_other_fields(tmp_path):
    store = Store(tmp_path / 'existing.sqlite')
    source = json.loads((ROOT / 'data/vehicles/team-drafts.json').read_text(encoding='utf-8'))[0]
    source['notes'] = 'Existing mechanical review'
    source['payload_kg'] = 12
    source['component_ids'].append('custom-added-part')
    store.put('vehicles', source)
    assert load(store) == {'components': 8, 'vehicles_updated': 1}
    migrated = store.get('vehicles', source['id'])
    assert migrated['notes'] == source['notes']
    assert migrated['payload_kg'] == 12
    assert 'custom-added-part' in migrated['component_ids']
    assert migrated['custom_parameters']['procurement_component_ids'] == source['custom_parameters']['procurement_component_ids']
    assert migrated['custom_parameters']['partial_budget_usd'] == source['custom_parameters']['partial_budget_usd']
