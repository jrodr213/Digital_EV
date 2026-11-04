import type {Part} from './types';

const number=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;
export function vehicleFacts(parts:Part[]){
 const motor=parts.find(p=>p.category==='motor'),battery=parts.find(p=>p.category==='battery'),drive=parts.find(p=>p.category==='drivetrain');
 const motorCount=number(motor?.custom_parameters.installed_quantity)??(motor?1:0);
 const rated=number(motor?.specs.rated_power_kw),listed=number(motor?.specs.listed_power_per_motor_w)??number(motor?.specs.listed_power_w);
 const motorPowerW=rated!=null?rated*1000:listed!=null?listed*motorCount:null;
 const cellVoltage=number(battery?.specs.cell_voltage_v),series=number(battery?.specs.series),cellCapacity=number(battery?.specs.capacity_ah),parallel=number(battery?.specs.parallel);
 const voltage=cellVoltage!=null&&series!=null?cellVoltage*series:number(battery?.specs.listed_nominal_voltage_v);
 const capacity=cellCapacity!=null&&parallel!=null?cellCapacity*parallel:number(battery?.specs.listed_capacity_ah);
 const energyWh=voltage!=null&&capacity!=null?voltage*capacity:number(battery?.specs.listed_energy_wh);
 const driveLabel=drive?.custom_parameters.integrated_chain_hardware?'Chain · rear differential':drive?.specs.drive_type==='direct'?'Direct wheel drive':drive?.specs.drive_type==='chain'?'Chain drive':drive?.specs.drive_type==='belt'?'Belt drive':drive?.specs.gear_ratio!=null?'Geared drive':'Layout pending';
 return {motor,battery,drive,motorCount,motorPowerW,listedMotor: rated==null,voltage,capacity,energyWh,listedBattery:cellVoltage==null||cellCapacity==null,driveLabel};
}
