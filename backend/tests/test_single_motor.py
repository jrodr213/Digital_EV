from copy import deepcopy

import pytest

from backend.database.migrations import apply_project_updates
from backend.database.project_sync import PROJECT_ID, STATE_KIND, repository_snapshot, sync_repository_defaults
from backend.database.store import Store
from backend.simulation.demo import prepare_demo
from backend.validation.assembly import assemble
from scripts.load_team_project import load


CAR_ID = 'team-ev-single-motor'
REPLACEMENTS = {
    'team-motor-aliexpress-36v500-pair': 'team-motor-my1020-single-36v',
    'team-battery-uugpower-36v15ah': 'team-battery-walmart-36v20ah',
    'team-drive-wheel-direct': 'team-drive-single-chain-differential',
    'team-custom-drive-esp32': 'team-custom-drive-esp32-single',
    'team-motor-mount-plates': 'team-motor-mount-single',
}


def test_single_motor_preserves_shared_systems_and_has_separate_changed_parts(tmp_path):
    store = Store(tmp_path / 'single.sqlite')
    load(store)
    original = store.get('vehicles', 'team-ev-belt')
    car = store.get('vehicles', CAR_ID)
    assert car['component_ids'] == [REPLACEMENTS.get(key, key) for key in original['component_ids']]
    assert car['custom_parameters']['procurement_component_ids'] == [
        REPLACEMENTS.get(key, key) for key in original['custom_parameters']['procurement_component_ids']]
    parts = [store.get('components', key) for key in car['component_ids']]
    by_category = {p['category']: p for p in parts}
    assert by_category['motor']['custom_parameters']['installed_quantity'] == 1
    assert by_category['inverter']['custom_parameters']['controlled_motor_quantity'] == 1
    assert by_category['motor_mounts']['custom_parameters']['installed_quantity'] == 1
    assert by_category['motor_mounts']['price'] == 12.95
    assert by_category['battery']['specs']['listed_capacity_ah'] == 20
    assert by_category['battery']['specs']['listed_energy_wh'] == 720
    assert by_category['drivetrain']['specs']['drive_type'] == 'chain'
    assert 'gear_ratio' not in by_category['drivetrain']['specs']
    assert by_category['drivetrain']['custom_parameters']['driven_wheel_count'] == 2
    assert car['custom_parameters']['architecture']['motor_count'] == 1
    assert original['custom_parameters']['architecture']['motor_count'] == 2
    assert store.get('components', 'team-motor-mount-plates')['custom_parameters']['installed_quantity'] == 2
    assert assemble(car, parts)['errors']  # No fabricated engineering ratings.
    for category in ['motor', 'battery', 'inverter', 'drivetrain']:
        assert by_category[category]['price'] is None
        assert by_category[category]['mass_kg'] is None
    assert 'continuous_a' not in by_category['battery']['specs']
    assert 'charge_limit_a' not in by_category['battery']['specs']


def test_demo_uses_one_motor_and_new_pack_without_persisting_assumptions(tmp_path):
    store = Store(tmp_path / 'demo.sqlite')
    load(store)
    car = store.get('vehicles', CAR_ID)
    parts = [store.get('components', key) for key in car['component_ids']]
    before = deepcopy((car, parts))
    _, assembly = prepare_demo(car, parts)
    assert not assembly['errors']
    assert assembly['specs']['motor']['rated_power_kw'] == 1
    assert assembly['nominal_voltage_v'] == 36
    assert assembly['nominal_energy_kwh'] == pytest.approx(.72)
    assert assembly['specs']['battery']['capacity_ah'] == 20
    assert any(a['field'] == 'gear_ratio' for a in assembly['demo_assumptions'])
    assert (car, parts) == before
    assert store.get('vehicles', CAR_ID) == car


@pytest.mark.parametrize('has_baseline', [False, True])
def test_existing_workspace_gets_new_car_once_without_changing_original_or_history(tmp_path, has_baseline):
    store = Store(tmp_path / 'upgrade.sqlite')
    load(store)
    snapshot = repository_snapshot()
    snapshot['vehicles'].pop(CAR_ID)
    store.delete('vehicles', CAR_ID)
    for key in REPLACEMENTS.values():
        store.delete('components', key)
        snapshot['components'].pop(key)
    if has_baseline:
        sync_repository_defaults(store, 'before-single-motor', snapshot)
    original = store.get('vehicles', 'team-ev-belt')
    original.update(payload_kg=81, notes='Keep my measured build')
    store.put('vehicles', original)
    store.put('results', {'id': 'prior-run', 'vehicle_snapshot': deepcopy(original)})
    history = store.list('results')
    apply_project_updates(store)
    assert store.get('vehicles', CAR_ID)
    assert store.get('vehicles', original['id']) == original
    assert store.list('results') == history
    car = store.get('vehicles', CAR_ID)
    car['payload_kg'] = 68
    store.put('vehicles', car)
    apply_project_updates(store)
    assert store.get('vehicles', CAR_ID) == car
    store.delete('vehicles', CAR_ID)
    state = store.get(STATE_KIND, PROJECT_ID)
    state['revision'] = 'force-next-source-sync'
    store.put(STATE_KIND, state)
    apply_project_updates(store)
    with pytest.raises(KeyError):
        store.get('vehicles', CAR_ID)
    assert store.list('results') == history
