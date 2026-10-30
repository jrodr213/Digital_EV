from backend.database.store import Store
from backend.simulation.analytical import estimates
from backend.simulation.demo import prepare_demo
from scripts.load_direct_drive import DRIVE_ID, REMOVED_IDS, load
from scripts.load_team_project import load as load_team


def test_direct_drive_keeps_selected_motors_and_materials_without_chain_or_axle(tmp_path):
    store = Store(tmp_path / 'direct.sqlite')
    assert load_team(store) == {'components': 63, 'vehicles': 3}
    vehicle = store.get('vehicles', 'team-ev-belt')
    meta = vehicle['custom_parameters']
    assert not REMOVED_IDS.intersection(vehicle['component_ids'])
    assert not REMOVED_IDS.intersection(meta['procurement_component_ids'])
    assert {'team-motor-aliexpress-36v500-pair', 'team-motor-mount-plates',
            'team-chassis-pipe-frame', 'team-custom-drive-esp32', DRIVE_ID} <= set(vehicle['component_ids'])
    assert meta['architecture']['driven_wheel_count'] == meta['architecture']['motor_count'] == 2
    assert meta['architecture']['shared_drive_axle'] is False
    assert meta['architecture']['drive_type'] == 'direct'
    assert meta['chassis_material_component_ids'] == ['team-material-pvc-10ft', 'team-material-steel-8ft']
    drive = store.get('components', DRIVE_ID)
    assert drive['specs']['gear_ratio'] == 1
    assert drive['specs']['driven_wheels'] == 'RWD'
    assert drive['mass_kg'] is None and drive['price'] is None
    assert 'efficiency' not in drive['specs']
    assert all(store.get('components', key) for key in REMOVED_IDS)  # historical options retained


def test_direct_migration_changes_only_main_vehicle_and_preserves_later_edits(tmp_path):
    store = Store(tmp_path / 'preserve.sqlite')
    load_team(store)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['component_ids'].remove(DRIVE_ID)
    vehicle['component_ids'] += ['team-drive-chain-420', 'team-chain-420-pair']
    vehicle['custom_parameters']['direct_drive_version'] = 0
    vehicle['notes'] = 'Keep our measurements'
    vehicle['payload_kg'] = 65
    store.put('vehicles', vehicle)
    before = {(kind, item['id']): item for kind in ['vehicles', 'components', 'results'] for item in store.list(kind)}
    assert load(store) == {'components': 0, 'vehicles_updated': 1}
    after = {(kind, item['id']): item for kind in ['vehicles', 'components', 'results'] for item in store.list(kind)}
    assert [key for key in before if before[key] != after[key]] == [('vehicles', vehicle['id'])]
    updated = store.get('vehicles', vehicle['id'])
    assert updated['notes'].startswith('Keep our measurements') and updated['payload_kg'] == 65
    updated['component_ids'].remove('team-motor-mount-plates')
    updated['custom_parameters']['architecture']['regenerative_braking'] = False
    store.put('vehicles', updated)
    assert load_team(store) == {'components': 0, 'vehicles': 0}
    assert store.get('vehicles', vehicle['id']) == updated


def test_direct_drive_torque_shortfall_is_not_reported_as_positive_top_speed(tmp_path):
    store = Store(tmp_path / 'torque.sqlite')
    load_team(store)
    vehicle = store.get('vehicles', 'team-ev-belt')
    _, assembly = prepare_demo(vehicle, [store.get('components', key) for key in vehicle['component_ids']])
    result = estimates(assembly)
    assert not result['can_start']
    assert result['top_speed_mph'] == 0
    assert result['starting_wheel_force_n'] < result['rolling_force_n']
    assert result['limiting_factor'] == 'continuous torque / traction'
    # A reviewed motor with sufficient torque could move at 1:1; no reduction is added.
    assembly['wheel_torque_nm'] = 30
    result = estimates(assembly)
    assert result['can_start'] and result['top_speed_mph'] > 0
    assert assembly['specs']['drivetrain']['gear_ratio'] == 1
    assert result['top_speed_mph'] <= min(result['power_limit_mph'], result['rpm_limit_mph'], result['torque_limit_mph']) + 1e-9
