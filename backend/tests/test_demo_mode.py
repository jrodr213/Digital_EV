from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from backend.database.store import Store
from backend.schemas.entities import RunRequest
from backend.simulation.demo import prepare_demo
from backend.simulation.fastsim_adapter import FastSimEngine
from scripts.load_team_project import load


@pytest.fixture
def team(tmp_path):
    store = Store(tmp_path / 'demo.sqlite')
    load(store)
    vehicle = store.get('vehicles', 'team-ev-belt')
    parts = [store.get('components', key) for key in vehicle['component_ids']]
    return store, vehicle, parts


def test_demo_preserves_current_materials_and_uses_listing_claims_explicitly(team):
    _, vehicle, parts = team
    original = deepcopy((vehicle, parts))
    demo_vehicle, assembly = prepare_demo(vehicle, parts)
    assert (vehicle, parts) == original
    assert demo_vehicle['component_ids'] == vehicle['component_ids']
    assert [p['id'] for p in assembly['components']] == vehicle['component_ids']
    assert not assembly['errors']
    assert assembly['nominal_voltage_v'] == 36
    assert assembly['nominal_energy_kwh'] == .54
    assert assembly['specs']['motor']['rated_power_kw'] == 1  # 2 x listed 500 W
    assert assembly['mass_kg'] == pytest.approx(sum(p['mass_kg'] for p in assembly['components']) + 75)
    assert assembly['specs']['drivetrain']['gear_ratio'] == 1  # direct wheel connection
    assert not any(i['field'] == 'gear_ratio' for i in assembly['demo_assumptions'])
    ledger = assembly['demo_assumptions']
    assert any(i['field'] == 'regen' and 'no verified regen support' in i['basis'] for i in ledger)
    assert any(i['field'] == 'rated_power_kw' and 'unverified' in i['basis'] for i in ledger)
    assert any('DEMO ESTIMATE' in warning for warning in assembly['warnings'])


def test_known_values_and_explicit_zero_are_preserved(team):
    _, vehicle, parts = team
    vehicle.update(payload_kg=0, auxiliary_w=0)
    motor = next(p for p in parts if p['category'] == 'motor')
    motor['mass_kg'] = 7
    motor['specs']['efficiency'] = .85
    motor['units']['efficiency'] = 'fraction'
    demo_vehicle, assembly = prepare_demo(vehicle, parts)
    assert demo_vehicle['payload_kg'] == demo_vehicle['auxiliary_w'] == 0
    assert assembly['specs']['motor']['efficiency'] == .85
    assert next(p for p in assembly['components'] if p['id'] == motor['id'])['mass_kg'] == 7
    assert not any(i['field'] in ['payload_kg', 'auxiliary_w'] for i in assembly['demo_assumptions'])
    assert not any(i['component_id'] == motor['id'] and i['field'] in ['efficiency', 'mass_kg'] for i in assembly['demo_assumptions'])


@pytest.mark.parametrize('change', ['regen', 'units', 'missing_category'])
def test_demo_still_rejects_conflicting_or_unsupported_inputs(team, change):
    _, vehicle, parts = team
    if change == 'regen':
        next(p for p in parts if p['category'] == 'inverter')['specs']['regen'] = False
    elif change == 'units':
        motor = next(p for p in parts if p['category'] == 'motor')
        motor['specs']['rated_power_kw'] = 1
        motor['units']['rated_power_kw'] = 'W'
    else:
        parts[:] = [p for p in parts if p['category'] != 'tires']
    _, assembly = prepare_demo(vehicle, parts)
    assert assembly['errors']


@pytest.mark.parametrize('vehicle_id', ['team-ev-belt', 'team-ev-differential', 'team-ev-dual-direct'])
@pytest.mark.parametrize('test', ['cycle', 'acceleration', 'hill', 'load'])
def test_current_team_concepts_run_in_demo_mode(team, vehicle_id, test):
    store, _, _ = team
    vehicle = store.get('vehicles', vehicle_id)
    _, assembly = prepare_demo(vehicle, [store.get('components', key) for key in vehicle['component_ids']])
    req = RunRequest(vehicle_id=vehicle_id, demo_mode=True, test=test, extra_payload_kg=20, grade=.05)
    assert req.cycle == 'demo-cart'
    base_mass = assembly['mass_kg']
    result = FastSimEngine().run(assembly, req)
    assert result['samples']
    assert result['summary']['energy_kwh'] > 0
    assert result['assembly']['mass_kg'] == assembly['mass_kg'] + 20
    assert assembly['mass_kg'] == base_mass
    follows_trace = all(abs(s['speed_mph'] - s['target_mph']) * .44704 <= .1 for s in result['samples'])
    assert result['summary']['cycle_met'] == follows_trace
    if test == 'acceleration':
        assert not result['summary']['cycle_met']
        assert max(s['target_mph'] for s in result['samples']) > 100


def test_demo_preview_run_exports_and_opt_out_leave_library_untouched(team, monkeypatch):
    import backend.api.main as main
    store, vehicle, parts = team
    monkeypatch.setattr(main, 'store', store)
    with TestClient(main.app) as client:
        request = {'vehicle_id': vehicle['id'], 'demo_mode': True}
        preview = client.post('/api/runs/preview', json=request)
        assert preview.status_code == 200
        assert not preview.json()['errors']
        assert store.list('results') == []
        assert client.post('/api/runs', json={'vehicle_id': vehicle['id']}).status_code == 422
        response = client.post('/api/runs', json=request)
        assert response.status_code == 200, response.text
        result = response.json()
        assert result['demo_assumptions'] == preview.json()['demo_assumptions']
        assert result['request']['demo_mode'] and result['request']['cycle'] == 'demo-cart'
        assert 'DEMO ESTIMATE' in result['name']
        assert client.get(f"/api/results/{result['id']}").json() == result
        assert client.get('/api/results').json()[0]['request']['demo_mode']
        report = client.get(f"/api/results/{result['id']}/report").text
        assert 'demo_assumptions' in report and 'DEMO ESTIMATE' in report
        assert 'listed_power_per_motor_w' in report
        assert client.get(f"/api/results/{result['id']}/csv").text.startswith('time_s,')
        assert client.post('/api/runs/preview', json={'vehicle_id': vehicle['id']}).json()['errors']
        assert client.post('/api/runs', json={'vehicle_id': vehicle['id']}).status_code == 422
        assert store.get('vehicles', vehicle['id']) == vehicle
        assert [store.get('components', p['id']) for p in parts] == parts


def test_demo_engine_failure_does_not_save_substitute(team, monkeypatch):
    import backend.api.main as main
    store, vehicle, _ = team
    monkeypatch.setattr(main, 'store', store)
    def fail(*args):
        raise RuntimeError('demo engine failure')
    monkeypatch.setattr(main.FastSimEngine, 'run', fail)
    with TestClient(main.app) as client:
        response = client.post('/api/runs', json={'vehicle_id': vehicle['id'], 'demo_mode': True})
        assert response.status_code == 422
        assert 'demo engine failure' in response.text
        assert store.list('results') == []
