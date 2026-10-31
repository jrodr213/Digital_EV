from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import backend.api.main as main
import backend.database.migrations as migrations
from backend.database.project_sync import (
    PROJECT_ID, STATE_KIND, repository_snapshot, sync_repository_defaults,
)
from backend.database.store import Store
from scripts.load_team_project import load


@pytest.fixture
def project(tmp_path):
    store = Store(tmp_path / 'sync.sqlite')
    load(store)
    snapshot = repository_snapshot()
    sync_repository_defaults(store, 'first', snapshot)
    store.put('results', {'id': 'old-run', 'vehicle_snapshot': {'name': 'Original run'}})
    return store, snapshot


def test_next_pull_syncs_changed_defaults_and_new_parts_while_retaining_measurements(project, monkeypatch):
    store, baseline = project
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle.update(payload_kg=65, notes='Our bracket measurements')
    custom = deepcopy(store.get('components', 'team-sensor-gps'))
    custom['id'] = 'our-extra-sensor'
    store.put('components', custom)
    vehicle['component_ids'].append(custom['id'])
    store.put('vehicles', vehicle)
    motor = store.get('components', 'team-motor-aliexpress-36v500-pair')
    motor['mass_kg'] = 3.5
    motor['specs']['measured_shaft_mm'] = 12
    store.put('components', motor)
    history = store.list('results')

    latest = deepcopy(baseline)
    updated = latest['vehicles'][vehicle['id']]
    updated['name'] = 'TEAM / New repository revision'
    updated['component_ids'].remove('team-motor-mount-plates')
    new_part = deepcopy(custom)
    new_part.update(id='team-new-sensor', name='New repository sensor')
    latest['components'][new_part['id']] = new_part
    updated['component_ids'].append(new_part['id'])
    latest['components'][motor['id']]['mass_kg'] = 4.5
    latest['components'][motor['id']]['specs']['listed_power_per_motor_w'] = 600
    monkeypatch.setattr(main, 'store', store)
    monkeypatch.setattr(migrations, 'source_revision', lambda: 'second')
    monkeypatch.setattr(migrations, 'repository_snapshot', lambda: latest)
    with TestClient(main.app) as client:
        assert client.get('/api/health').status_code == 200

    saved = store.get('vehicles', vehicle['id'])
    assert saved['name'] == updated['name']
    assert saved['payload_kg'] == 65 and saved['notes'] == vehicle['notes']
    assert custom['id'] in saved['component_ids'] and new_part['id'] in saved['component_ids']
    assert 'team-motor-mount-plates' not in saved['component_ids']
    assert store.get('components', 'team-motor-mount-plates')  # historical option retained
    motor = store.get('components', motor['id'])
    assert motor['mass_kg'] == 3.5
    assert motor['specs']['listed_power_per_motor_w'] == 600
    assert motor['specs']['measured_shaft_mm'] == 12
    assert store.list('results') == history
    before = store.list('vehicles'), store.list('components')
    with TestClient(main.app):
        pass
    assert (store.list('vehicles'), store.list('components')) == before


def test_local_battery_replacement_is_not_combined_with_a_new_repo_battery(project):
    store, baseline = project
    vehicle = store.get('vehicles', 'team-ev-belt')
    original = 'team-battery-uugpower-36v15ah'
    custom = deepcopy(store.get('components', original))
    custom['id'] = 'our-battery'
    store.put('components', custom)
    vehicle['component_ids'] = [custom['id'] if key == original else key for key in vehicle['component_ids']]
    store.put('vehicles', vehicle)
    latest = deepcopy(baseline)
    latest['components']['team-next-battery'] = {**custom, 'id': 'team-next-battery'}
    latest['vehicles'][vehicle['id']]['component_ids'] = [
        'team-next-battery' if key == original else key for key in baseline['vehicles'][vehicle['id']]['component_ids']]
    sync_repository_defaults(store, 'next-battery', latest)
    ids = store.get('vehicles', vehicle['id'])['component_ids']
    assert custom['id'] in ids
    assert original not in ids and 'team-next-battery' not in ids
    assert store.get('components', 'team-next-battery')  # available for a deliberate switch


def test_intentionally_deleted_components_and_removed_fields_stay_deleted(project):
    store, baseline = project
    key = 'team-motor-mount-plates'
    store.delete('components', key)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['component_ids'].remove(key)
    del vehicle['custom_parameters']['budget_note']
    store.put('vehicles', vehicle)
    latest = deepcopy(baseline)
    latest['components'][key]['mass_kg'] = 4
    latest['vehicles'][vehicle['id']]['custom_parameters']['budget_note'] = 'New repository budget'
    sync_repository_defaults(store, 'deleted-record', latest)
    assert key not in {part['id'] for part in store.list('components')}
    saved = store.get('vehicles', vehicle['id'])
    assert key not in saved['component_ids']
    assert 'budget_note' not in saved['custom_parameters']


def test_invalid_repo_update_rolls_back_records_and_the_sync_baseline(project):
    store, baseline = project
    before = {kind: store.list(kind) for kind in ['components', 'vehicles', 'results', STATE_KIND]}
    latest = deepcopy(baseline)
    latest['components']['team-sensor-gps']['name'] = 'Changed GPS name'
    latest['components']['team-drive-wheel-direct']['mass_kg'] = -1
    with pytest.raises(ValidationError):
        sync_repository_defaults(store, 'invalid', latest)
    assert {kind: store.list(kind) for kind in before} == before
    assert store.get(STATE_KIND, PROJECT_ID)['revision'] == 'first'
