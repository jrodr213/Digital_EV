"""Generate explicitly hypothetical editable sample assemblies (never manufacturer data)."""
import json
from pathlib import Path
from backend.components.catalog import FIELDS

ROOT=Path(__file__).resolve().parents[1]
parts={
 'battery':(160,dict(chemistry='Hypothetical Li-ion',cell_manufacturer='Demonstration only',cell_model='No real model',capacity_ah=5.,cell_voltage_v=3.6,cell_max_voltage_v=4.2,series=96,parallel=12,usable_fraction=.8,continuous_a=250.,peak_a=400.,charge_limit_a=200.,resistance_ohm=.05,charge_efficiency=.97,discharge_efficiency=.97,bms_min_v=250.,bms_max_v=410.,bms_continuous_a=250.,min_soc=.1,max_soc=.9,min_temp_c=0.,max_temp_c=45.)),
 'motor':(38,dict(motor_type='PMSM',rated_power_kw=45.,peak_power_kw=70.,rated_torque_nm=100.,peak_torque_nm=160.,max_rpm=8000.,efficiency=.93,cooling='Liquid; not modeled')),
 'inverter':(8,dict(min_voltage_v=250.,max_voltage_v=450.,continuous_a=250.,peak_a=400.,max_power_kw=80.,efficiency=.97,regen=True)),
 'drivetrain':(24,dict(gear_ratio=7.,drive_type='gearbox',efficiency=.95,wheel_diameter_m=.56,driven_wheels='RWD',differential='Open schematic',max_torque_nm=180.,max_input_rpm=9000.)),
 'chassis':(320,dict(length_m=3.2,width_m=1.5,height_m=1.1,wheelbase_m=2.1,track_m=1.25,cg_height_m=.45,drag_coefficient=.38,frontal_area_m2=1.6,drive_axle_weight_fraction=.55)),
 'tires':(40,dict(rolling_resistance=.012,friction_coefficient=.8,wheel_inertia_kgm2=.5,num_wheels=4)),
 'suspension':(25,{}),'brakes':(15,{}),'steering':(8,{}),'cooling':(10,{}),'auxiliary':(5,{}),'sensors':(1,{}),'embedded_controllers':(1,{}),
}
components=[dict(id='demo-'+k,name='DEMO / '+k.title(),category=k,manufacturer='Hypothetical student design',model='Illustration only',mass_kg=mass,price=None,notes='HYPOTHETICAL. Replace with reviewed datasheet values before engineering decisions.',datasheet='',hypothetical=True,specs=specs,units={key:FIELDS[k][key] for key in specs},custom_parameters={}) for k,(mass,specs) in parts.items()]
for folder in ['components','vehicles','drive_cycles','simulation_results']:
    (ROOT/'data'/folder).mkdir(parents=True,exist_ok=True)
(ROOT/'data/components/demo.json').write_text(json.dumps(components,indent=2))
(ROOT/'data/vehicles/demo.json').write_text(json.dumps(dict(id='demo-student-ev',name='DEMO / Student EV',component_ids=[c['id'] for c in components],payload_kg=75.,auxiliary_w=300.,notes='Hypothetical demonstration; all assembly masses include parts only. Payload is added once.'),indent=2))
(ROOT/'data/drive_cycles/custom-example.csv').write_text('time_s,speed_mps,grade\n0,0,0\n1,1,0\n2,2,0\n3,3,0.02\n4,2,0.02\n5,0,0\n')

if __name__=='__main__': print('Wrote hypothetical demo configurations.')
