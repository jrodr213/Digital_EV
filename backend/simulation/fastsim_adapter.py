"""Adapter verified against FASTSim 3.1.0's serialized BEV schema.

Bundled Zoe provides schema/default solver state, not student component ratings.
All vehicle/energy/power/road-load fields below come from validated assembly input.
"""
import importlib.metadata
from typing import Protocol
import fastsim
import numpy as np
from backend.simulation.analytical import estimates, MPS_PER_MPH, METERS_PER_MILE

RESOURCE = '2022_Renault_Zoe_ZE50_R135.yaml'


class SimulationEngine(Protocol):
    def run(self, assembly: dict, request, cycle=None) -> dict: ...


def vehicle_from_assembly(a):
    if importlib.metadata.version('fastsim') != '3.1.0':
        raise ValueError('This adapter requires tested FASTSim 3.1.0. Run setup.ps1.')
    if a['errors']: raise ValueError('; '.join(a['errors']))
    p=a['specs']; b,m,i,d,ch,t=(p[k] for k in ['battery','motor','inverter','drivetrain','chassis','tires'])
    v=fastsim.Vehicle.from_resource(RESOURCE).to_dict()
    v['name']='Custom component BEV'
    v['mass_kilograms']=a['mass_kg']
    v['pwr_aux_base_watts']=a['auxiliary_w']
    v['chassis'].update(drag_coef=ch['drag_coefficient'],frontal_area_square_meters=ch['frontal_area_m2'],wheel_rr_coef=t['rolling_resistance'],wheel_inertia_kilogram_square_meters=t['wheel_inertia_kgm2'],num_wheels=int(t['num_wheels']),wheel_radius_meters=d['wheel_diameter_m']/2,cg_height_meters=ch['cg_height_m'],wheel_fric_coef=t['friction_coefficient'],drive_type=d['driven_wheels'],drive_axle_weight_frac=ch['drive_axle_weight_fraction'],wheel_base_meters=ch['wheelbase_m'],glider_mass_kilograms=None,cargo_mass_kilograms=0.,mass_kilograms=None)
    v['chassis']['cargo_mass_kilograms']=None
    bev=v['pt_type']['BEV']
    # FASTSim's constant RES uses symmetric charge/discharge power. Cap at both.
    bev['res'].update(energy_capacity_joules=a['nominal_energy_kwh']*3.6e6,pwr_out_max_watts=min(a['battery_power_kw']*1000,a['nominal_voltage_v']*b['charge_limit_a']),min_soc=b['min_soc'],max_soc=b['min_soc']+b['usable_fraction'],eff_interp={'Constant':b['discharge_efficiency']})
    bev['res']['state']['soc']=b['min_soc']+b['usable_fraction']
    efficiency_map=bev['em']['eff_interp_achieved']
    efficiency_map['data']['values']['data']=[m['efficiency']*i['efficiency']]*len(efficiency_map['data']['values']['data'])
    bev['em'].update(pwr_out_max_watts=a['mechanical_power_kw']*1000,eff_interp_achieved=efficiency_map,eff_interp_at_max_input=None)
    bev['transmission']['eff_interp']=d['efficiency']
    veh=fastsim.Vehicle.from_dict(v)
    veh.set_save_interval(1)
    return veh


def make_cycle(request, custom=None):
    if request.test in ['cycle','load']:
        if request.cycle == 'demo-cart':
            # Gentle, explicit cart trace; never relabel a scaled road cycle.
            speed=[min(j / 30, 1., max(0., (90-j) / 30)) * 10 * MPS_PER_MPH for j in range(121)]
            return fastsim.Cycle.from_dict({'time_seconds':list(range(121)),'speed_meters_per_second':speed,'grade':[0.] * 121})
        if custom:
            return fastsim.Cycle.from_dict({'time_seconds':custom['time_s'],'speed_meters_per_second':custom['speed_mps'],'grade':custom['grade']})
        if request.cycle not in ['udds','hwfet','us06']: raise ValueError('Unknown driving cycle.')
        return fastsim.Cycle.from_resource(request.cycle+'.csv')
    n=request.duration_s+1
    speed=[0.]+([request.target_mph*MPS_PER_MPH]*(n-1) if request.test=='hill' else [min(j*2.,70.) for j in range(1,n)])
    return fastsim.Cycle.from_dict({'time_seconds':list(range(n)),'speed_meters_per_second':speed,'grade':[request.grade if request.test=='hill' else 0.]*n})


class FastSimEngine:
    def run(self, a, request, cycle=None):
        a=dict(a); a['mass_kg']+=request.extra_payload_kg
        veh=vehicle_from_assembly(a); cyc=make_cycle(request,cycle)
        params=fastsim.SimParams.default().to_dict()
        params['trace_miss_opts']='Allow'
        sd=fastsim.SimDrive(veh,cyc,fastsim.SimParams.from_dict(params)); sd.run()
        df=sd.to_dataframe()
        def col(key): return df[key].to_numpy(dtype=float)
        time=col('cyc.time_seconds'); speed=col('veh.history.speed_ach_meters_per_second')
        # Under Allow, FASTSim 3.1.0 can leave cyc_met true after a speed miss.
        cycle_met=bool(np.all(np.abs(speed-col('cyc.speed_meters_per_second')) <= .1))
        battery=col('veh.pt_type.BEV.res.history.pwr_out_electrical_watts')
        chemical=col('veh.pt_type.BEV.res.history.energy_out_chemical_joules')
        motor_w=col('veh.pt_type.BEV.em.history.pwr_mech_prop_out_watts')
        soc=col('veh.pt_type.BEV.res.history.soc')
        distance=float(df['veh.history.dist_meters'].iloc[-1])/METERS_PER_MILE
        energy=float(chemical[-1]-chemical[0])/3.6e6
        wh=energy*1000/distance if distance>0 and energy>0 else None
        d=a['specs']['drivetrain']; m=a['specs']['motor']
        omega=speed/(d['wheel_diameter_m']/2)*d['gear_ratio']
        rpm=omega*60/(2*np.pi)
        torque=np.divide(motor_w,omega,out=np.zeros_like(omega),where=omega>.01)
        dt=np.diff(time,prepend=time[0]); regen=float(np.sum(np.maximum(-battery,0)*dt)/3.6e6)
        warn=list(a['warnings'])
        if not cycle_met: warn.append('FASTSim could not follow the target speed within 0.1 m/s at every step. Inspect achieved speed.')
        if np.max(rpm)>min(m['max_rpm'],d['max_input_rpm']): warn.append('Achieved trace exceeds supplied motor/drivetrain RPM limit; FASTSim does not enforce gearing. Treat range as conditional.')
        if np.max(torque)>min(m['rated_torque_nm'],d['max_torque_nm']): warn.append('Trace torque estimate exceeds continuous motor/drivetrain rating; range is conditional on torque feasibility.')
        current_estimate=battery/a['nominal_voltage_v']
        b=a['specs']['battery']; inv=a['specs']['inverter']
        if np.max(current_estimate)>min(b['continuous_a'],b['bms_continuous_a'],inv['continuous_a'])*1.001:
            warn.append('Nominal-voltage trace current exceeds a battery/BMS/inverter continuous rating. Sustained overload may create overheating risk; temperature is not modeled.')
        if -np.min(current_estimate)>b['charge_limit_a']*1.001:
            warn.append('Estimated regenerative charge current exceeds supplied battery charge limit.')
        warn.append('Trace-miss policy is Allow: FASTSim records achieved speed when requested speed cannot be met. This is flagged, never replaced by target speed.')
        warn.append('Symmetric battery power is conservatively capped by BOTH supplied charge and continuous discharge current. Regeneration recovery uses electrical terminal power.')
        if a['specs']['battery'].get('min_temp_c') is not None: warn.append('Temperature limits are stored only. No battery thermal state is simulated.')
        sample={'time_s':time,'target_mph':col('cyc.speed_meters_per_second')/MPS_PER_MPH,'speed_mph':speed/MPS_PER_MPH,'acceleration_mps2':np.gradient(speed,time),'soc':soc,'battery_kw':battery/1000,'battery_current_a':battery/a['nominal_voltage_v'],'motor_kw':motor_w/1000,'motor_rpm':rpm,'motor_torque_nm':torque}
        rows=[{key:float(values[j]) for key,values in sample.items()} for j in range(len(time))]
        assumptions=['FASTSim 3.1.0 scalar-efficiency longitudinal BEV; continuous ratings only.','Motor efficiency multiplied by inverter efficiency; no torque/RPM map.','Battery begins at supplied usable SOC ceiling. No range extrapolation across different conditions.','Analytical extension assumes air density 1.225 kg/m3; constant torque below constant power; no load transfer.','Motor RPM, torque, current and acceleration are derived estimates, not native component dynamics.','Schematic 3D playback is visualization only; component metadata is not validated physics.']
        mapped=veh.to_dict()
        # FASTSim's unrun state contains a NaN sentinel; persist only configuration.
        mapped.pop('state',None)
        if not all(np.isfinite(v).all() for v in sample.values()):
            raise ValueError('FASTSim returned non-finite time series. No result has been saved.')
        analytical=estimates(a,request.grade,request.target_mph)
        if not analytical['can_start']:
            warn.append('With the supplied or assumed torque, wheel size and mass, wheel force cannot overcome level-road rolling resistance. The analytical model predicts no launch; the scalar FASTSim trace does not enforce this torque limit. Its energy/range results are conditional on resolving the torque shortfall.')
        return {'engine':'FASTSim','engine_version':importlib.metadata.version('fastsim'),'summary':{'distance_miles':distance,'energy_kwh':energy,'wh_per_mile':wh,'range_miles':a['usable_energy_kwh']*1000/wh if wh else None,'regen_kwh':regen,'cycle_met':cycle_met,'final_soc':float(soc[-1])},'analytical':analytical,'warnings':warn,'assumptions':assumptions,'samples':rows,'mapped_vehicle':mapped,'assembly':a,'request':request.model_dump()}
