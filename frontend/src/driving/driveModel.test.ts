import {describe,it,expect} from 'vitest';
import type {Part,Vehicle} from '../types';
import {advanceEnergy,climbingForce,ecctrlCarConfig,electricalPower,resolveDriveConfig,torqueAtRpm,tractionLimit,wheelRpm} from './driveModel';

const part=(category:string,specs:Record<string,unknown>={},units:Record<string,string>={}):Part=>({id:category,name:category,category,specs,units,mass_kg:10,price:null,manufacturer:'',model:'',notes:'',datasheet:'',hypothetical:true,custom_parameters:{}});
export const fixtureVehicle:Vehicle={id:'physics-fixture',name:'Physics validation fixture',component_ids:['motor','battery','inverter','drivetrain','chassis','tires'],payload_kg:75,auxiliary_w:10,notes:''};
export function fixtureParts(motors=2){return [
  {...part('motor',{rated_power_kw:motors, rated_torque_nm:15*motors,max_rpm:3000,efficiency:.85,listed_voltage_v:36},{rated_power_kw:'kW',rated_torque_nm:'N m',max_rpm:'rpm',efficiency:'fraction',listed_voltage_v:'V'}),custom_parameters:{installed_quantity:motors}},
  part('battery',{listed_nominal_voltage_v:36,listed_capacity_ah:15,continuous_a:50,bms_continuous_a:40,discharge_efficiency:.97,min_soc:.1,max_soc:.9},{listed_nominal_voltage_v:'V',listed_capacity_ah:'Ah',continuous_a:'A',bms_continuous_a:'A',discharge_efficiency:'fraction',min_soc:'fraction',max_soc:'fraction'}),
  part('inverter',{continuous_a:30,max_power_kw:1.2,efficiency:.95},{continuous_a:'A',max_power_kw:'kW',efficiency:'fraction'}),
  part('drivetrain',{gear_ratio:1,efficiency:.92,wheel_diameter_m:.56,driven_wheels:'RWD'},{gear_ratio:'ratio',efficiency:'fraction',wheel_diameter_m:'m',driven_wheels:'text'}),
  part('chassis'),part('tires')
];}
const config=()=>resolveDriveConfig(fixtureVehicle,fixtureParts());
describe('EV drivetrain adapter and energy contract',()=>{
  it('uses aggregate canonical ratings once; both per-motor contributions remain present',()=>{
    const two=config(),one=resolveDriveConfig(fixtureVehicle,fixtureParts(1));
    expect(two.errors).toEqual([]);expect(two.motorCount).toBe(2);
    expect(two.p.powerW).toBe(2000);expect(two.p.torqueNm).toBe(30);
    expect(two.shaftTorque).toBe(2*one.shaftTorque);
    const hp=ecctrlCarConfig(two).engineHorsepower;
    expect(hp*7022/two.rpmLimit).toBeCloseTo(30*.92);
  });
  it('keeps listing power conversion explicitly assumed and quantity-aware',()=>{
    const parts=fixtureParts();parts[0].specs={listed_power_per_motor_w:500};parts[0].units={listed_power_per_motor_w:'W'};
    const c=resolveDriveConfig(fixtureVehicle,parts);
    expect(c.p.powerW).toBe(850);expect(c.parameters.find(p=>p.key==='powerW')?.assumed).toBe(true);
  });
  it('higher selected mass reduces acceleration with identical available tractive force',()=>{
    const a=config(),b=resolveDriveConfig({...fixtureVehicle,payload_kg:175},fixtureParts());
    const f=a.shaftTorque*a.p.ratio*a.p.driveEfficiency/a.p.radius;
    expect(f/b.mass).toBeLessThan(f/a.mass);
  });
  it('wheel radius changes rotational speed and tractive force inversely',()=>{
    const c=config();expect(wheelRpm(5,.56)).toBeCloseTo(wheelRpm(5,.28)/2);
    expect(c.shaftTorque/.56).toBeCloseTo(c.shaftTorque/.28/2);
  });
  it('total reduction scales torque once and lowers RPM-limited road speed',()=>{
    const a=config(),parts=fixtureParts();parts[3].specs.gear_ratio=4;
    const b=resolveDriveConfig(fixtureVehicle,parts);
    expect(ecctrlCarConfig(b).gearRatios).toEqual([4]);
    expect(b.shaftTorque*b.p.ratio*b.p.driveEfficiency).toBeCloseTo(4*a.shaftTorque*a.p.driveEfficiency);
    expect(b.rpmLimit/b.p.ratio).toBe(a.rpmLimit/4);
  });
  it('climbing force increases with slope and low-grip traction is smaller',()=>{
    expect(climbingForce(250,.2)).toBeGreaterThan(climbingForce(250,.1));
    expect(climbingForce(250,0)).toBe(0);
    expect(tractionLimit(250,.85*.32)).toBeCloseTo(tractionLimit(250,.85)*.32);
  });
  it('enforces controller, battery, mechanical power and RPM limits',()=>{
    const c=config();
    expect(c.shaftPowerW).toBeLessThanOrEqual((36*30-c.p.auxiliaryW-c.p.stallLossW)*.85*.95);
    for(let rpm=0;rpm<=3000;rpm+=10){
      const torque=torqueAtRpm(c,rpm),mechanical=torque*rpm*Math.PI*2/60;
      expect(mechanical).toBeLessThanOrEqual(c.shaftPowerW+1e-8);
      expect(electricalPower(c,mechanical,torque/c.shaftTorque)).toBeLessThanOrEqual(36*30+1e-8);
    }
    expect(torqueAtRpm(c,3000)).toBe(0);expect(torqueAtRpm(c,4000)).toBe(0);
  });
  it('accounts for stalled copper loss, battery loss, SOC cutoff and no phantom regen',()=>{
    const c=config();expect(electricalPower(c,0,1)).toBeGreaterThan(c.p.auxiliaryW);
    const e=advanceEnergy(c,0,100,3600);
    expect(e.energyWh).toBeCloseTo(100/.97);expect(e.soc).toBeCloseTo(.9-e.energyWh/540);
    expect(advanceEnergy(c,0,1e9,1e9).soc).toBe(.1);
    expect(advanceEnergy(c,10,-100,1).energyWh).toBe(10);
  });
  it('preserves source inputs and keeps all missing engineering values editable',()=>{
    const parts=fixtureParts(),before=JSON.stringify(parts),c=resolveDriveConfig(fixtureVehicle,parts,{grip:.4});
    expect(JSON.stringify(parts)).toBe(before);expect(c.p.grip).toBe(.4);
    expect(c.parameters.filter(p=>p.assumed).every(p=>p.basis.length>10)).toBe(true);
    expect(resolveDriveConfig(fixtureVehicle,parts,{grip:NaN}).errors.length).toBeGreaterThan(0);
  });
  it('honors the saved usable energy fraction and controller voltage range',()=>{
    const parts=fixtureParts();parts[1].specs.usable_fraction=.4;parts[1].units.usable_fraction='fraction';
    const c=resolveDriveConfig(fixtureVehicle,parts);
    expect(c.socFloor).toBe(.5);expect(advanceEnergy(c,0,1e9,1e9).soc).toBe(.5);
    parts[2].specs.min_voltage_v=48;parts[2].units.min_voltage_v='V';
    expect(resolveDriveConfig(fixtureVehicle,parts).errors).toContain('Nominal pack voltage is outside the saved controller voltage range.');
  });
  it('rejects missing assemblies and invalid units instead of silently treating them as specs',()=>{
    const parts=fixtureParts();parts[0].units.rated_torque_nm='lb ft';
    expect(resolveDriveConfig(fixtureVehicle,parts).parameters.find(p=>p.key==='torqueNm')?.assumed).toBe(true);
    expect(resolveDriveConfig(fixtureVehicle,parts.slice(1)).errors).toContain('Select exactly one motor assembly in Vehicle Builder.');
  });
});
