import type {Part} from '../types';
import {fmt} from '../api';

const roles:Record<string,string>={
 battery:'Stores electrical energy for the vehicle powertrain.',
 motor:'Converts electrical power into mechanical torque to drive the wheels.',
 inverter:'Controls the electrical power delivered to the traction motor.',
 drivetrain:'Transfers motor torque to the driven wheels.',
 motor_mounts:'Mounts the traction motors to the fabricated frame; bolt pattern and attachment need verification.',
 drive_chain:'Transfers torque along the proposed chain paths; installed lengths and alignment remain unresolved.',
 rear_sprockets:'Receives chain torque at the rear axle; bore, keyway and axle fit must match.',
 motor_sprockets:'Drives the chain from the motor shaft; the exact shaft and tooth variant remains unselected.',
 chain_protection:'Groups the proposed chain guards, tensioners and mounting hardware; quantities and fit need confirmation.',
 chassis:'Supports the vehicle components and defines the basic vehicle structure.',
 tires:'Connect the vehicle to the road and transmit traction and braking forces.',
 suspension:'Connects the wheels to the chassis and accommodates wheel movement.',
 steering:'Actuates the proposed steering mechanism.',
 throttle_control:'Sends the requested electronic throttle command; hardware and control behavior remain unspecified.',
 cooling:'Provides airflow or heat removal for vehicle electronics or powertrain components.',
 embedded_controllers:'Runs the onboard control and communication logic.',
 vision:'Provides camera images for the planned perception system.',
 sensors:'Measures vehicle or environmental conditions for the control system.',
 safety_controls:'Provides the operator stop input; the complete stop circuit still requires a defined design.',
 signal_interface:'Interfaces electrical signals between the controller and connected devices.',
 auxiliary:'Supplies or consumes electrical power outside the traction motor circuit.',
 brakes:'Provides the proposed vehicle braking function.',
};

export function describePart(part:Part){
 const facts:{label:string;value:string}[]=[];
 const sensor=!!part.custom_parameters.sensor_type;
 if(sensor){
  facts.push({label:'Estimated mounts',value:part.custom_parameters.sensor_mounts?.map((m:any)=>m.label).join(' · ')??'Not supplied'});
  facts.push({label:'Proposed quantity',value:String(part.custom_parameters.installed_quantity??'Not supplied')});
 }
 if(part.manufacturer)facts.push({label:'Manufacturer',value:part.manufacturer});
 if(part.model)facts.push({label:'Model',value:part.model});
 const specs=Object.entries(part.specs).filter(([key,value])=>
  value!=null&&value!==''&&!key.includes('map')&&
  (typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)||Array.isArray(value)&&value.every(v=>typeof v==='number'&&Number.isFinite(v)))
 );
 for(const [key,value] of specs){
  if(facts.length>=4)break;
  const label=key.replace(/_/g,' ').replace(/\b(kw|rpm|ah|v|w|a|nm|mps)\b/g,'').trim().replace(/\s+/g,' ');
  const rendered=Array.isArray(value)?value.map(v=>fmt(v,3)).join(' – '):typeof value==='number'?fmt(value,3):typeof value==='boolean'?(value?'Yes':'No'):value;
  facts.push({label:label[0].toUpperCase()+label.slice(1),value:rendered+(part.units[key]&&!['text','boolean','fraction','dimensionless'].includes(part.units[key])?' '+part.units[key]:'')});
 }
 facts.push({label:'Installed mass',value:part.mass_kg==null?'Not supplied':fmt(part.mass_kg)+' kg'});
 const pending=!!part.custom_parameters.placeholder;
 const status=pending?'Specifications pending':sensor?'Selected product · estimated mounting':part.hypothetical?'Hypothetical demonstration part':part.custom_parameters.document_project?'Document claims · unverified':'User-supplied specifications';
 return {role:part.custom_parameters.sensor_summary??(part.category==='drivetrain'&&part.specs.drive_type==='direct'?'Each motor connects directly to one rear wheel at 1:1, without reduction gears or a shared drive axle.':roles[part.category])??'A component included in the selected vehicle assembly.',facts,status,pending};
}
