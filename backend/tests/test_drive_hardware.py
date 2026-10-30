import pytest

from backend.database.store import Store
from backend.validation.assembly import assemble
from scripts.load_drive_hardware import HARDWARE_IDS, REPLACEMENTS, load
from scripts.load_team_project import load as load_team


def test_requested_hardware_and_fabrication_choices_are_recorded_without_fake_ratings(tmp_path):
    store = Store(tmp_path / 'hardware.sqlite')
    assert load_team(store) == {'components': 63, 'vehicles': 3}
    vehicle = store.get('vehicles', 'team-ev-belt')
    meta = vehicle['custom_parameters']
    parts = [store.get('components', key) for key in vehicle['component_ids']]
    assert len(parts) == 25 and len(set(vehicle['component_ids'])) == 25
    assert set(HARDWARE_IDS).intersection(vehicle['component_ids']) == {'team-motor-mount-plates'}
    assert (set(REPLACEMENTS.values()) - {'team-drive-chain-420'}) <= set(vehicle['component_ids'])
    assert not set(REPLACEMENTS).intersection(vehicle['component_ids'])
    assert meta['commercial_bldc_controller_purchase'] is False
    assert meta['frame_fabrication']['materials'] == ['steel tubing', 'PVC pipe']
    assert meta['frame_fabrication']['joining_method_user_claim'] == 'soldering'
    drive = next(p for p in parts if p['category'] == 'inverter')
    assert drive['custom_parameters']['user_built_motor_drive'] is True
    assert drive['specs'] == {} and drive['mass_kg'] is None
    chassis = next(p for p in parts if p['category'] == 'chassis')
    assert chassis['custom_parameters']['frame_style'] == 'pipe_frame'
    assert chassis['specs'] == {} and chassis['mass_kg'] is None
    assert sum(bool(p['custom_parameters'].get('sensor_type')) for p in parts) == 8
    assert next(p for p in parts if p['category'] == 'motor')['custom_parameters']['installed_quantity'] == 2
    chain = store.get('components', 'team-chain-420-pair')
    assert chain['price'] == 35 and chain['custom_parameters']['installed_quantity'] == 2
    assert chain['specs']['listed_stock_length_each_ft'] == 4
    rear = store.get('components', 'team-rear-sprocket-60-pair')
    assert rear['specs']['listed_tooth_count'] == 60 and rear['specs']['listed_bore_in'] == 1
    motor_sprockets = store.get('components', 'team-motor-sprocket-420-pair')
    assert 'listed_tooth_count' not in motor_sprockets['specs']
    drivetrain = next(p for p in parts if p['category'] == 'drivetrain')
    assert drivetrain['specs']['gear_ratio'] == 1 and drivetrain['specs']['drive_type'] == 'direct'
    pedal = next(p for p in parts if p['category'] == 'throttle_control')
    assert pedal['model'] == 'THR-90' and pedal['price'] == 23.95
    bundle = store.get('components', 'team-chain-guard-adjustment')
    assert bundle['price'] == 109
    assert sum(s['quantity'] * s['unit_price_usd'] for s in bundle['custom_parameters']['sub_items']) == pytest.approx(108.96)
    assert meta['budget_is_estimate'] and meta['budget_is_lower_bound']
    additions = HARDWARE_IDS + ['team-throttle-thr90']
    assert sum(store.get('components', key)['price'] for key in additions) == pytest.approx(289.73)
    procurement = [store.get('components', key) for key in meta['procurement_component_ids']]
    assert len(procurement) == len({p['id'] for p in procurement})
    subtotal = sum((p['price'] or 0) * ((p['custom_parameters'].get('purchase_quantity') or 0)
                   if p['custom_parameters'].get('price_scope') == 'per_stock_length' else 1) for p in procurement)
    assert subtotal == pytest.approx(448.84)
    assert assemble(vehicle, parts)['errors']


def test_hardware_migration_preserves_other_records_and_later_edits(tmp_path):
    store = Store(tmp_path / 'preserve.sqlite')
    load_team(store)
    vehicle = store.get('vehicles', 'team-ev-belt')
    reverse = {value: key for key, value in REPLACEMENTS.items()}
    vehicle['component_ids'] = [reverse.get(key, key) for key in vehicle['component_ids'] if key not in HARDWARE_IDS]
    vehicle['notes'] = 'Keep our measurements'
    vehicle['payload_kg'] = 70
    vehicle['custom_parameters']['drive_hardware_version'] = 0
    store.put('vehicles', vehicle)
    with store.connect() as con:
        before = {(k, i): b for k, i, b in con.execute('SELECT kind,id,body FROM records')}
    assert load(store) == {'components': 0, 'vehicles_updated': 1}
    with store.connect() as con:
        after = {(k, i): b for k, i, b in con.execute('SELECT kind,id,body FROM records')}
    assert [key for key in before if before[key] != after[key]] == [('vehicles', 'team-ev-belt')]
    updated = store.get('vehicles', vehicle['id'])
    assert updated['notes'] == vehicle['notes'] and updated['payload_kg'] == 70
    updated['component_ids'].remove('team-motor-mount-plates')
    store.put('vehicles', updated)
    pedal = store.get('components', 'team-throttle-thr90')
    pedal['notes'] = 'Keep measured pedal travel'
    store.put('components', pedal)
    assert load_team(store) == {'components': 0, 'vehicles': 0}
    assert store.get('vehicles', updated['id']) == updated
    assert store.get('components', pedal['id']) == pedal
