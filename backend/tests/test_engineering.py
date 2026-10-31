import copy
import json
import math
import importlib.metadata
import pytest
import fastsim
from fastapi.testclient import TestClient
from backend.database.store import Store, ROOT
from backend.validation.assembly import assemble
from backend.schemas.entities import DriveCycle, RunRequest, Component
from backend.simulation.fastsim_adapter import FastSimEngine, vehicle_from_assembly, RESOURCE
from backend.simulation.analytical import MPS_PER_MPH, METERS_PER_MILE


@pytest.fixture
def data():
    return json.loads((ROOT/'data/vehicles/demo.json').read_text()),json.loads((ROOT/'data/components/demo.json').read_text())


def assembly(data):
    v,p=data; a=assemble(v,p); a['auxiliary_w']=v['auxiliary_w']; return a


def test_mass_counts_payload_once(data):
    a=assembly(data)
    assert a['mass_kg']==sum(p['mass_kg'] for p in data[1])+75
    assert not a['errors']


def test_pack_calculation(data):
    a=assembly(data)
    assert a['nominal_voltage_v']==pytest.approx(96*3.6)
    assert a['nominal_energy_kwh']==pytest.approx(96*3.6*12*5/1000)
    assert a['usable_energy_kwh']==pytest.approx(16.5888)


def test_unit_conversions():
    assert 60*MPS_PER_MPH==pytest.approx(26.8224)
    assert METERS_PER_MILE==1609.344
    assert 3.6e6/3600==1000


def test_voltage_compatibility(data):
    data[1][2]['specs']['max_voltage_v']=350
    assert any('voltage' in s for s in assembly(data)['errors'])


def test_current_limits_power(data):
    normal=assembly(data)['mechanical_power_kw']
    data[1][0]['specs']['continuous_a']=30
    a=assembly(data)
    assert a['mechanical_power_kw']<normal
    assert any('current capability' in s for s in a['warnings'])


@pytest.mark.parametrize('change',[lambda p:p[0]['specs'].pop('series'),lambda p:p[0]['units'].update(cell_voltage_v='kV'),lambda p:p[0]['specs'].update(series=2.5),lambda p:p[0]['specs'].update(usable_fraction=1.1),lambda p:p[2]['specs'].update(regen=False),lambda p:p[1]['specs'].update(efficiency_map={'unreviewed':True})])
def test_invalid_assemblies_rejected(data,change):
    change(data[1]); assert assembly(data)['errors']


@pytest.mark.parametrize('kwargs',[dict(time_s=[0,0],speed_mps=[0,1],grade=[0,0]),dict(time_s=[0,1],speed_mps=[-1,1],grade=[0,0]),dict(time_s=[0,1],speed_mps=[0,1],grade=[0]),dict(time_s=[0,1],speed_mps=[0,float('nan')],grade=[0,0])])
def test_cycle_validation(kwargs):
    with pytest.raises(ValueError): DriveCycle(name='Invalid',**kwargs)


def test_persistence(tmp_path,data):
    s=Store(tmp_path/'test.sqlite'); v,p=data
    s.put('vehicles',v); s.put('components',p[0])
    assert Store(tmp_path/'test.sqlite').get('vehicles',v['id'])==v
    assert s.list('components')[0]==p[0]


def test_official_example():
    assert importlib.metadata.version('fastsim')=='3.1.0'
    # Directly reproduces official running-simulations/simdrive.ipynb, no adapter.
    v=fastsim.Vehicle.from_resource('2012_Ford_Fusion.yaml'); v.set_save_interval(1)
    sd=fastsim.SimDrive(v,fastsim.Cycle.from_resource('udds.csv')); sd.run()
    assert sd.to_dataframe()['veh.history.dist_meters'].iloc[-1]>10000


def test_adapter_matches_direct_known_bev(data):
    # Translate the bundled Zoe into our component schema, including its original
    # efficiency map as an independent reference override for numerical parity.
    source=fastsim.Vehicle.from_resource(RESOURCE).to_dict(); bev=source['pt_type']['BEV']; ch=source['chassis']
    a=assembly(data); b,m,i,d,c,t=(a['specs'][k] for k in ['battery','motor','inverter','drivetrain','chassis','tires'])
    a.update(mass_kg=source['mass_kilograms'],auxiliary_w=source['pwr_aux_base_watts'],mechanical_power_kw=bev['em']['pwr_out_max_watts']/1000,nominal_energy_kwh=bev['res']['energy_capacity_joules']/3.6e6,battery_power_kw=bev['res']['pwr_out_max_watts']/1000)
    b.update(min_soc=bev['res']['min_soc'],usable_fraction=bev['res']['max_soc']-bev['res']['min_soc'],charge_limit_a=1e9,discharge_efficiency=bev['res']['eff_interp']['Constant'])
    c.update(drag_coefficient=ch['drag_coef'],frontal_area_m2=ch['frontal_area_square_meters'],cg_height_m=ch['cg_height_meters'],drive_axle_weight_fraction=ch['drive_axle_weight_frac'],wheelbase_m=ch['wheel_base_meters'])
    d.update(efficiency=bev['transmission']['eff_interp'],wheel_diameter_m=ch['wheel_radius_meters']*2,driven_wheels=ch['drive_type'])
    t.update(rolling_resistance=ch['wheel_rr_coef'],friction_coefficient=ch['wheel_fric_coef'],wheel_inertia_kgm2=ch['wheel_inertia_kilogram_square_meters'],num_wheels=ch['num_wheels'])
    mapped=vehicle_from_assembly(a).to_dict(); mapped['pt_type']['BEV']['em']['eff_interp_achieved']=bev['em']['eff_interp_achieved']; mapped['pt_type']['BEV']['em']['eff_interp_at_max_input']=None
    source['pt_type']['BEV']['res']['state']['soc']=bev['res']['max_soc']
    outputs=[]
    for v in [fastsim.Vehicle.from_dict(source),fastsim.Vehicle.from_dict(mapped)]:
        v.set_save_interval(1); sd=fastsim.SimDrive(v,fastsim.Cycle.from_resource('udds.csv')); sd.run(); outputs.append(sd.to_dataframe())
    key='veh.pt_type.BEV.res.history.energy_out_chemical_joules'
    assert outputs[0][key].iloc[-1]==pytest.approx(outputs[1][key].iloc[-1],rel=1e-9)
    assert outputs[0]['veh.history.dist_meters'].iloc[-1]==pytest.approx(outputs[1]['veh.history.dist_meters'].iloc[-1],rel=1e-9)


def test_complete_bev_reproducible(data):
    req=RunRequest(vehicle_id='demo-student-ev'); a=assembly(data)
    r1=FastSimEngine().run(a,req); r2=FastSimEngine().run(a,req)
    assert r1['samples']==r2['samples']
    assert r1['summary']==r2['summary']
    assert r1['summary']['energy_kwh']>0
    assert r1['summary']['distance_miles']>7
    assert r1['summary']['cycle_met']
    assert r1['summary']['final_soc']<.9


@pytest.mark.parametrize('test',['acceleration','hill','load'])
def test_scenarios(data,test):
    r=FastSimEngine().run(assembly(data),RunRequest(vehicle_id='demo-student-ev',test=test,extra_payload_kg=50,grade=.05))
    assert r['samples']
    assert r['assembly']['mass_kg']==assembly(data)['mass_kg']+50


def test_api_workflow(tmp_path,data,monkeypatch):
    import backend.api.main as main
    monkeypatch.setattr(main,'store',Store(tmp_path/'api.sqlite'))
    with TestClient(main.app) as client:
        assert client.get('/api/health').status_code==200
        vehicles = client.get('/api/vehicles').json()
        assert {v['id'] for v in vehicles} == {'demo-student-ev', 'team-ev-belt', 'team-ev-differential', 'team-ev-dual-direct'}
        current = next(v for v in vehicles if v.get('custom_parameters', {}).get('preferred_draft'))
        assert current['custom_parameters']['architecture']['drive_type'] == 'direct'
        bad=client.post('/api/components/import',files={'file':('bad.json',json.dumps([data[1][0],{'name':'bad'}]),'application/json')})
        assert bad.status_code==422
        r=client.post('/api/runs',json={'vehicle_id':'demo-student-ev'})
        assert r.status_code==200,r.text
        id=r.json()['id']
        assert client.get(f'/api/results/{id}/csv').text.startswith('time_s,')
        assert 'FASTSim' in client.get(f'/api/results/{id}/report').text
        assert client.get('/api/results/missing').status_code==404
        r=client.post('/api/experiments',json={'vehicle_ids':['demo-student-ev'],'parameter':'gear_ratio','values':[5,7],'metric':'top_speed_mph'})
        assert r.status_code==200,r.text
        assert len(r.json())==2
        assert r.json()[0]['analytical']['top_speed_mph']>=r.json()[1]['analytical']['top_speed_mph']


def test_no_silent_fallback(tmp_path,data,monkeypatch):
    import backend.api.main as main
    monkeypatch.setattr(main,'store',Store(tmp_path/'fail.sqlite'))
    def fail(*args,**kwargs): raise OSError('engine failure')
    monkeypatch.setattr(main.FastSimEngine,'run',fail)
    with TestClient(main.app) as client:
        response=client.post('/api/runs',json={'vehicle_id':'demo-student-ev'})
        assert response.status_code==422
        assert main.store.list('results')==[]
