import json

from fastapi.testclient import TestClient

import backend.api.main as main
from backend.database.store import ROOT, Store
from scripts.load_direct_drive import DRIVE_ID, REMOVED_IDS
from scripts.load_team_project import load as load_team


def old_team_store(tmp_path):
    store = Store(tmp_path / 'old-team.sqlite')
    load_team(store)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['component_ids'].remove(DRIVE_ID)
    vehicle['component_ids'] += ['team-drive-chain-420', 'team-chain-420-pair']
    vehicle['custom_parameters'].pop('direct_drive_version')
    vehicle['custom_parameters']['architecture']['drive_type'] = 'chain'
    vehicle['payload_kg'] = 65
    vehicle['notes'] = 'Keep the team measurements.'
    store.put('vehicles', vehicle)
    store.delete('components', DRIVE_ID)
    store.put('results', {'id': 'saved-run', 'name': 'Existing simulation snapshot'})
    return store


def records(store):
    return {(kind, item['id']): item
            for kind in ['vehicles', 'components', 'results']
            for item in store.list(kind)}


def test_startup_upgrades_old_team_drive_once_and_preserves_saved_work(tmp_path, monkeypatch):
    store = old_team_store(tmp_path)
    monkeypatch.setattr(main, 'store', store)
    before = records(store)
    with TestClient(main.app) as client:
        vehicle = next(v for v in client.get('/api/vehicles').json() if v['id'] == 'team-ev-belt')
        assert vehicle['custom_parameters']['architecture']['drive_type'] == 'direct'
        assert vehicle['custom_parameters']['direct_drive_version'] == 1
        assert not REMOVED_IDS.intersection(vehicle['component_ids'])
        assert DRIVE_ID in vehicle['component_ids']
        assert vehicle['payload_kg'] == 65
        assert vehicle['notes'].startswith('Keep the team measurements.')
        preview = client.post('/api/runs/preview', json={'vehicle_id': vehicle['id'], 'demo_mode': True})
        assert preview.status_code == 200
        assert not preview.json()['errors']
        assert preview.json()['specs']['drivetrain']['gear_ratio'] == 1

    after = records(store)
    assert [key for key in before if before[key] != after[key]] == [('vehicles', 'team-ev-belt')]
    assert set(after) - set(before) == {('components', DRIVE_ID)}

    vehicle['component_ids'].remove('team-motor-mount-plates')
    vehicle['notes'] = 'New measurements after migration.'
    store.put('vehicles', vehicle)
    customized = records(store)
    with TestClient(main.app):
        pass
    assert records(store) == customized


def test_startup_leaves_other_projects_and_their_choices_untouched(tmp_path, monkeypatch):
    store = old_team_store(tmp_path)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['custom_parameters']['document_project'] = 'another-project'
    store.put('vehicles', vehicle)
    monkeypatch.setattr(main, 'store', store)
    before = records(store)
    with TestClient(main.app):
        pass
    assert records(store) == before


def test_startup_does_not_add_team_data_to_a_demo_workspace(tmp_path, monkeypatch):
    store = Store(tmp_path / 'demo.sqlite')
    # Existing independent workspaces are not replaced by the repository car.
    for part in json.loads((ROOT / 'data/components/demo.json').read_text()):
        store.put('components', part)
    store.put('vehicles', json.loads((ROOT / 'data/vehicles/demo.json').read_text()))
    monkeypatch.setattr(main, 'store', store)
    with TestClient(main.app) as client:
        assert client.get('/api/health').status_code == 200
    assert len(store.list('vehicles')) == 1
    assert not any(part['id'] == DRIVE_ID for part in store.list('components'))

def test_startup_brings_an_original_team_database_through_all_updates(tmp_path, monkeypatch):
    store = Store(tmp_path / 'original-team.sqlite')
    for kind, source in [('components', 'data/components/team-parts.json'),
                         ('vehicles', 'data/vehicles/team-drafts.json')]:
        for record in json.loads((ROOT / source).read_text(encoding='utf-8')):
            store.put(kind, record)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle['payload_kg'] = 70
    vehicle['notes'] = 'Keep measured bracket locations.'
    store.put('vehicles', vehicle)
    monkeypatch.setattr(main, 'store', store)
    with TestClient(main.app):
        pass
    updated = store.get('vehicles', vehicle['id'])
    meta = updated['custom_parameters']
    assert meta['sensor_layout_version'] == 1
    assert meta['motor_selection_version'] == 3
    assert meta['architecture_update_version'] == 2
    assert meta['battery_selection_version'] == 1
    assert meta['drive_hardware_version'] == meta['direct_drive_version'] == 1
    assert meta['architecture']['drive_type'] == 'direct'
    assert updated['payload_kg'] == 70
    assert updated['notes'].startswith('Keep measured bracket locations.')
