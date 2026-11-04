from copy import deepcopy

import pytest

from backend.database.project_sync import repository_snapshot, sync_repository_defaults
from backend.database.store import Store
from backend.simulation.demo import prepare_demo
from backend.validation.assembly import assemble
from scripts.load_team_project import load


OPTION_IDS = ['team-drive-option-belt-comet30', 'team-drive-option-chain-sprocket']
CAR_IDS = ['team-ev-single-motor', 'team-ev-belt']


@pytest.mark.parametrize('car_id,drive_type', list(zip(CAR_IDS, ['chain', 'direct'])))
def test_conditional_parts_do_not_enter_installed_physics_or_purchase_budget(tmp_path, car_id, drive_type):
    store = Store(tmp_path / 'options.sqlite')
    load(store)
    car = store.get('vehicles', car_id)
    meta = car['custom_parameters']
    assert meta['conditional_component_ids'] == OPTION_IDS
    assert not set(OPTION_IDS).intersection(car['component_ids'])
    assert not set(OPTION_IDS).intersection(meta['procurement_component_ids'])
    parts = [store.get('components', key) for key in car['component_ids']]
    assert next(p for p in parts if p['category'] == 'drivetrain')['specs']['drive_type'] == drive_type
    errors = assemble(car, parts)['errors']
    assert not any('Conditional /' in error for error in errors)
    _, demo = prepare_demo(car, parts)
    assert not demo['errors']
    assert not set(OPTION_IDS).intersection(p['id'] for p in demo['components'])
    assert not set(OPTION_IDS).intersection(a['component_id'] for a in demo['demo_assumptions'])
    belt, chain = [store.get('components', key) for key in OPTION_IDS]
    assert belt['price'] == 14.14 and belt['custom_parameters']['package_units'] == 2
    assert chain['price'] == 29.21
    for option in [belt, chain]:
        assert option['mass_kg'] is None
        assert option['custom_parameters']['installed_quantity'] is None
        assert option['custom_parameters']['procurement_quantity'] is None
        assert 'gear_ratio' not in option['specs']


def test_existing_cars_receive_options_without_changing_assemblies_budgets_or_history(tmp_path):
    store = Store(tmp_path / 'upgrade.sqlite')
    latest = repository_snapshot()
    previous = deepcopy(latest)
    for key in OPTION_IDS:
        previous['components'].pop(key)
    for car_id in CAR_IDS:
        meta = previous['vehicles'][car_id]['custom_parameters']
        for key in ['conditional_component_ids', 'conditional_component_notes', 'conditional_parts_note']:
            meta.pop(key)
    for kind, records in previous.items():
        for record in records.values():
            store.put(kind, record)
    sync_repository_defaults(store, 'before-conditional-options', previous)
    for car_id in CAR_IDS:
        car = store.get('vehicles', car_id)
        car['payload_kg'] = 72
        car['notes'] = 'Retain our local measurements'
        store.put('vehicles', car)
    before = store.list('vehicles')
    store.put('results', {'id': 'saved-run', 'vehicle_snapshot': deepcopy(before[0])})
    history = store.list('results')
    sync_repository_defaults(store, 'with-conditional-options', latest)
    for car in before:
        updated = store.get('vehicles', car['id'])
        if car['id'] in CAR_IDS:
            assert updated['custom_parameters']['conditional_component_ids'] == OPTION_IDS
            for key in ['conditional_component_ids', 'conditional_component_notes', 'conditional_parts_note']:
                updated['custom_parameters'].pop(key)
        assert updated == car
    assert store.list('results') == history
    assert all(store.get('components', key) for key in OPTION_IDS)


def test_option_updates_keep_local_additions_and_deliberate_removals(tmp_path):
    store = Store(tmp_path / 'local-options.sqlite')
    load(store)
    baseline = repository_snapshot()
    sync_repository_defaults(store, 'first', baseline)
    car = store.get('vehicles', CAR_IDS[0])
    local = deepcopy(store.get('components', OPTION_IDS[1]))
    local['id'] = 'our-reviewed-chain-kit'
    store.put('components', local)
    car['custom_parameters']['conditional_component_ids'] = [OPTION_IDS[1], local['id']]
    store.put('vehicles', car)
    latest = deepcopy(baseline)
    new_option = deepcopy(local)
    new_option['id'] = 'team-next-drive-option'
    latest['components'][new_option['id']] = new_option
    latest['vehicles'][car['id']]['custom_parameters']['conditional_component_ids'].append(new_option['id'])
    sync_repository_defaults(store, 'new-option', latest)
    assert store.get('vehicles', car['id'])['custom_parameters']['conditional_component_ids'] == [
        OPTION_IDS[1], local['id'], new_option['id']]
