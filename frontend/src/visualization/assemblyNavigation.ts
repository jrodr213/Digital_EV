import type {Part} from '../types';

export const assemblyDefinitions = [
 {id:'powertrain',name:'Powertrain',eyebrow:'MAKE IT MOVE',description:'Explore the motors, drive assembly, sprockets and mounting hardware.',color:'#dba970',categories:['motor','drivetrain','motor_mounts','drive_chain','rear_sprockets','motor_sprockets','chain_protection']},
 {id:'battery',name:'Battery & power',eyebrow:'STORED ENERGY',description:'Look inside the battery compartment and review the selected pack.',color:'#56b7a5',categories:['battery']},
 {id:'electronics',name:'Electronics',eyebrow:'THE CONTROL CENTRE',description:'ESP32 boards, your custom motor-drive circuit, interfaces and auxiliary power.',color:'#9a9dd4',categories:['inverter','embedded_controllers','signal_interface','auxiliary','cooling']},
 {id:'frame',name:'Body & frame',eyebrow:'THE FOUNDATION',description:'Go beneath the concept bodywork to inspect the chassis and its material references.',color:'#b4aa92',categories:['chassis','chassis_material']},
 {id:'steering',name:'Steering & pedals',eyebrow:'DRIVER CONNECTION',description:'Ackermann steering, the accelerator pedal and emergency-stop input.',color:'#c59592',categories:['steering','throttle_control','safety_controls']},
 {id:'wheels',name:'Wheels & brakes',eyebrow:'CONTACT WITH THE ROAD',description:'Inspect the wheel, suspension and braking assemblies that still need specifying.',color:'#8fa6b3',categories:['tires','suspension','brakes']},
 {id:'sensors',name:'Sensors & vision',eyebrow:'SENSE THE WORLD',description:'See the eight sensor types, estimated mounting locations and camera provision.',color:'#b6b96c',categories:['sensors','vision']},
] as const;
export type AssemblyId=typeof assemblyDefinitions[number]['id'];
export type AssemblyDefinition=typeof assemblyDefinitions[number];

export function assemblyForPart(part:Part):AssemblyId{
 return assemblyDefinitions.find(a=>(a.categories as readonly string[]).includes(part.category))?.id??'electronics';
}

export function assemblyParts(id:AssemblyId,parts:Part[]){
 return parts.filter(part=>assemblyForPart(part)===id);
}

export function partLabel(part:Part){
 if(part.custom_parameters.reference_only||part.category==='chassis_material')return part.name;
 if(part.category==='chassis'&&part.custom_parameters.frame_style!=='pipe_frame')return 'Chassis';
 if(part.custom_parameters.user_built_motor_drive)return 'Custom motor drive';
 const names:Record<string,string>={motor:'Traction motors',drivetrain:'Chain-drive assembly',motor_mounts:'Motor mounting plates',drive_chain:'Drive chains',rear_sprockets:'Rear axle sprockets',motor_sprockets:'Motor sprockets',chain_protection:'Guards & adjustment',battery:'Battery pack',chassis:'Fabricated pipe frame',tires:'Wheels & tires',suspension:'Suspension',brakes:'Brakes',inverter:'Motor drive',embedded_controllers:'ESP32 boards',signal_interface:'Signal interfaces',auxiliary:'Auxiliary supply',cooling:'Cooling fan',steering:'Steering assembly',throttle_control:'Accelerator pedal',safety_controls:'Emergency stop',vision:'Camera'};
 return part.custom_parameters.sensor_short_name??names[part.category]??part.name;
}

// References stay read-only. Stock and bundle illustrations are never added to
// the installed vehicle or used as new simulation inputs.
export function partChildren(part:Part,library:Part[]):Part[]{
 const meta=part.custom_parameters;
 const ids=[...(Array.isArray(meta.material_component_ids)?meta.material_component_ids:[]),...(Array.isArray(meta.hardware_component_ids)?meta.hardware_component_ids:[])];
 const references=[...new Set(ids)].flatMap(id=>library.filter(p=>p.id===id));
 const bundle=Array.isArray(meta.sub_items)?meta.sub_items.flatMap((item:any,index:number)=>{
  if(!item||typeof item.name!=='string')return [];
  const qty=typeof item.quantity==='number'?item.quantity:null;
  const unit=typeof item.unit_price_usd==='number'?item.unit_price_usd:null;
  return [{id:`${part.id}:item:${index}`,name:item.name,category:part.category,manufacturer:'',model:'',mass_kg:null,price:qty!=null&&unit!=null?qty*unit:null,hypothetical:false,datasheet:item.url??'',notes:`${item.selection_status??'Estimated bundle item; exact fit unverified.'} Quantities and prices are planning estimates from the parent bundle.`,specs:{},units:{},custom_parameters:{...meta,sub_items:undefined,material_component_ids:undefined,hardware_component_ids:undefined,reference_only:true,installed_quantity:qty,part_status:'Bundle reference / estimated',parent_component_id:part.id}} satisfies Part];
 }):[];
 return [...references,...bundle];
}

export function visualParts(parts:Part[],library:Part[]):Part[]{
 const all=new Map<string,Part>();
 function visit(part:Part){
  const id=part.id??part.name;
  if(all.has(id))return;
  all.set(id,part);
  partChildren(part,library).forEach(visit);
 }
 parts.forEach(visit);
 return [...all.values()];
}
