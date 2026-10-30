import json
from pathlib import Path
from unittest.mock import Mock
import pytest
from fastapi.testclient import TestClient
from backend.database.store import ROOT, Store
from backend.schemas.entities import Component, Vehicle
from backend.validation.assembly import assemble
from scripts.load_team_project import load


@pytest.fixture
def team():
    parts=json.loads((ROOT/'data/components/team-parts.json').read_text(encoding='utf-8'))
    vehicles=json.loads((ROOT/'data/vehicles/team-drafts.json').read_text(encoding='utf-8'))
    return {p['id']:p for p in parts},vehicles


def test_unknown_values_survive_validation_and_persistence(tmp_path):
    part=Component(name='Actual motor / mass not supplied',category='motor')
    assert part.mass_kg is None
    store=Store(tmp_path/'unknown.sqlite')
    saved=store.put('components',part.model_dump())
    assert store.get('components',saved['id'])['mass_kg'] is None
    vehicle=Vehicle(name='Draft',component_ids=[saved['id']])
    a=assemble(vehicle.model_dump(),[saved])
    assert a['mass_kg'] is None
    assert a['mass_complete'] is False
    assert any('payload' in e for e in a['errors'])
    assert any('Auxiliary' in e for e in a['errors'])


def test_partial_mass_is_not_presented_as_total():
    v={'component_ids':['known','unknown'],'payload_kg':0,'auxiliary_w':0}
    a=assemble(v,[{'id':'known','name':'Known','category':'auxiliary','mass_kg':12},{'id':'unknown','name':'Unknown','category':'sensors','mass_kg':None}])
    assert a['known_component_mass_kg']==12
    assert a['mass_kg'] is None
    assert any('Unknown: missing installed assembly mass' in e for e in a['errors'])


@pytest.mark.parametrize('index',[0,1,2])
def test_team_drafts_do_not_inherit_demo_physics(team,index):
    parts,vehicles=team; v=vehicles[index]
    Component.model_validate(next(iter(parts.values())))
    Vehicle.model_validate(v)
    assert all(id.startswith('team-') for id in v['component_ids'])
    a=assemble(v,[parts[id] for id in v['component_ids']])
    assert a['errors'] and a['mass_kg'] is None
    assert 'usable_energy_kwh' not in a
    assert 'mechanical_power_kw' not in a
    assert not parts['team-battery']['specs']
    assert not parts['team-chassis']['specs']
    assert not parts['team-sensors']['specs']
    motor=parts['team-motor-budget']
    assert motor['specs']['listed_power_w']==2000
    assert 'rated_power_kw' not in motor['specs']
    assert 'peak_power_kw' not in motor['specs']


def test_budgets_preserve_source_allowances_and_inventory(team):
    parts,vehicles=team
    assert len(parts)==33
    electronics=[p for p in parts.values() if p['custom_parameters']['source_references'][0]['document']=='Group4_Parts_List.xlsx']
    assert len(electronics)==8
    assert sum(p['price'] for p in electronics)==141
    assert parts['team-esp32']['custom_parameters']['installed_quantity']==2
    assert parts['team-esp32']['custom_parameters']['package_units']==3
    assert parts['team-motor-dual-assembly']['custom_parameters']['installed_quantity']==2
    assert parts['team-drive-dual-direct']['price'] is None
    for v,total in zip(vehicles,[333,313,413]):
        cp=v['custom_parameters']
        assert cp['partial_budget_usd']==total
        assert sum(parts[id]['price'] or 0 for id in cp['procurement_component_ids'])==total
        assert 'team-dualshock' in cp['procurement_component_ids']
        assert 'team-dualshock' not in v['component_ids']
        assert 'team-breadboard' not in v['component_ids']


def test_loader_is_repeatable_and_does_not_overwrite_team_edits(tmp_path):
    store=Store(tmp_path/'load.sqlite')
    assert load(store)=={'components':63,'vehicles':3}
    motor=store.get('components','team-motor-budget'); motor['notes']='Reviewed by team'
    store.put('components',motor)
    assert load(store)=={'components':0,'vehicles':0}
    assert store.get('components','team-motor-budget')['notes']=='Reviewed by team'


def test_draft_api_saves_but_never_calls_simulator_with_unknowns(tmp_path,monkeypatch):
    import backend.api.main as main
    store=Store(tmp_path/'api.sqlite'); load(store)
    monkeypatch.setattr(main,'store',store)
    engine=Mock(side_effect=AssertionError('No engine call permitted for incomplete inputs'))
    monkeypatch.setattr(main.FastSimEngine,'run',engine)
    with TestClient(main.app) as client:
        v=store.get('vehicles','team-ev-belt')
        response=client.post('/api/vehicles',json=v)
        assert response.status_code==200 and response.json()['payload_kg'] is None
        response=client.post('/api/vehicles/validate',json=v)
        assert response.status_code==200 and response.json()['mass_kg'] is None
        for id in ['team-ev-belt','team-ev-differential','team-ev-dual-direct']:
            response=client.post('/api/runs',json={'vehicle_id':id})
            assert response.status_code==422
        assert not engine.called
        assert not store.list('results')
        csv='name,category,mass_kg,price\nUnknown sensor,sensors,,\n'
        response=client.post('/api/components/import',files={'file':('parts.csv',csv,'text/csv')})
        assert response.status_code==200
        assert response.json()[0]['mass_kg'] is None
