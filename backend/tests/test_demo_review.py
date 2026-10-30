from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from backend.database.store import Store
from backend.schemas.entities import RunRequest
from backend.simulation.analytical import estimates
from backend.simulation.demo import prepare_demo
from backend.simulation.demo_review import build_demo_review, with_demo_review
from backend.simulation.fastsim_adapter import FastSimEngine
from scripts.load_team_project import load


@pytest.fixture
def saved_demo(tmp_path):
    store = Store(tmp_path / 'review.sqlite')
    load(store)
    vehicle = store.get('vehicles', 'team-ev-belt')
    vehicle, assembly = prepare_demo(vehicle, [store.get('components', key) for key in vehicle['component_ids']])
    result = FastSimEngine().run(assembly, RunRequest(vehicle_id=vehicle['id'], demo_mode=True))
    result.update(id='saved-demo', name='Saved direct-drive demo', created_at='2026-10-30T12:00:00+00:00',
                  vehicle_snapshot=vehicle, demo_assumptions=assembly['demo_assumptions'])
    return store, store.put('results', result)


def test_review_explains_quantified_shortfalls_and_preserves_direct_drive(saved_demo):
    _, result = saved_demo
    original = deepcopy(result)
    review = build_demo_review(result)
    findings = {item['id']: item for item in review['findings']}
    assert review['shortfall_count'] == 2
    assert review['assumption_count'] == 69
    assert findings['launch']['status'] == findings['power']['status'] == 'shortfall'
    assert '19.1 N versus 30.4 N' in findings['launch']['evidence']
    assert '5.01 N m' in findings['launch']['evidence']
    assert '2.78 N m per motor' in findings['launch']['improvement']
    assert '0.509 kW' in findings['power']['evidence']
    assert '37.9 A' in findings['power']['impact']
    assert 'continuous or charge capability' in findings['power']['impact']
    assert findings['range']['status'] == 'uncertain'
    assert 'conditional' in findings['range']['impact']
    assert findings['trace']['status'] == 'observed'
    assert 'cannot start on level ground' in review['overview']
    assert 'No gears, shared drive axle, belts or chains are added' in review['layout_note']
    assert result == original


def test_sufficient_torque_does_not_keep_an_old_launch_failure(saved_demo):
    _, result = saved_demo
    result['assembly']['specs']['motor']['rated_torque_nm'] = 20
    result['assembly']['specs']['drivetrain']['max_torque_nm'] = 25
    result['assembly']['wheel_torque_nm'] = 18
    result['analytical'] = estimates(result['assembly'])
    review = build_demo_review(result)
    launch = next(item for item in review['findings'] if item['id'] == 'launch')
    assert result['analytical']['can_start']
    assert launch['status'] == 'observed'
    assert review['shortfall_count'] == 1
    assert 'enough wheel force' in review['overview']
    assert 'cannot start' not in review['overview']
    assert 'launch shortfall' not in next(item for item in review['findings'] if item['id'] == 'range')['impact'].lower()


def test_trace_misses_use_elapsed_time_and_the_actual_requested_trace(saved_demo):
    _, result = saved_demo
    result['samples'] = [
        {'time_s': 0, 'target_mph': 0, 'speed_mph': 0},
        {'time_s': 1, 'target_mph': 2, 'speed_mph': 2},
        {'time_s': 4, 'target_mph': 8, 'speed_mph': 6},
        {'time_s': 10, 'target_mph': 4, 'speed_mph': 4},
    ]
    review = build_demo_review(result)
    trace = next(item for item in review['findings'] if item['id'] == 'trace')
    assert trace['status'] == 'shortfall'
    assert '3.0 s (30.0%)' in trace['evidence']
    assert 'up to 8.0 mph' in trace['evidence']
    assert 'difference is 2.0 mph' in trace['evidence']


def test_traction_shortfall_is_not_mistaken_for_a_motor_torque_shortfall(saved_demo):
    _, result = saved_demo
    result['assembly']['specs']['tires']['friction_coefficient'] = .005
    result['analytical'] = estimates(result['assembly'])
    review = build_demo_review(result)
    launch = next(item for item in review['findings'] if item['id'] == 'launch')
    assert launch['title'] == 'Traction shortfall in the assumed configuration'
    assert 'Tire grip caps force' in launch['evidence']
    assert 'More motor torque alone does not remove a tire-grip limit' in launch['improvement']
    assert 'tire-grip shortfall' in review['headline']


def test_hill_shortfalls_are_reported_only_for_a_hill_test(saved_demo):
    _, result = saved_demo
    assert not result['analytical']['hill_can_maintain']
    assert 'hill' not in {item['id'] for item in build_demo_review(result)['findings']}
    result['request']['test'] = 'hill'
    result['analytical'] = estimates(result['assembly'], grade=.05, target_mph=30)
    hill = next(item for item in build_demo_review(result)['findings'] if item['id'] == 'hill')
    assert hill['status'] == 'shortfall'
    assert '5.0% grade and 30.0 mph' in hill['evidence']
    assert '2.606 kW' in hill['evidence']


def test_existing_demo_gets_review_from_snapshot_without_rewriting_history(saved_demo, monkeypatch):
    import backend.api.main as main
    store, result = saved_demo
    monkeypatch.setattr(main, 'store', store)
    expected = build_demo_review(result)
    motor = store.get('components', 'team-motor-aliexpress-36v500-pair')
    motor['specs']['rated_power_kw'] = 7
    store.put('components', motor)
    with TestClient(main.app) as client:
        loaded = client.get('/api/results/saved-demo')
        assert loaded.status_code == 200
        assert loaded.json()['demo_review'] == expected
        report = client.get('/api/results/saved-demo/report').text
        assert '## Demo shortfalls & room for improvement' in report
        assert '### Suggested order of work' in report
        assert '19.1 N versus 30.4 N' in report
        assert '2.78 N m per motor' in report
    assert store.get('results', result['id']) == result
    assert 'demo_review' not in result


def test_new_demo_persists_review_and_standard_results_are_not_enriched(saved_demo, monkeypatch):
    import backend.api.main as main
    store, result = saved_demo
    monkeypatch.setattr(main, 'store', store)
    with TestClient(main.app) as client:
        response = client.post('/api/runs', json={'vehicle_id': 'team-ev-belt', 'demo_mode': True})
        assert response.status_code == 200, response.text
        new = response.json()
        assert new['demo_review'] == store.get('results', new['id'])['demo_review']
        assert len(new['demo_review']['findings']) == 6
    result['request']['demo_mode'] = False
    assert build_demo_review(result) is None
    assert with_demo_review(result) == result
    assert 'demo_review' not in with_demo_review(result)
