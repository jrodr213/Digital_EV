import * as THREE from 'three';
import type {Part} from '../types';

const sensorKinds=['infrared','ultrasonic','gps','temperature','force','rotary','hall','wheel_encoder'] as const;
export type SensorKind=typeof sensorKinds[number];
const sites=['front_left','front_right','front_center','rear_center','upper_deck','battery_surface','motor_surface','bumper_contact','steering_pivot','rear_axle','rear_left_hub','rear_right_hub'] as const;
export type MountSite=typeof sites[number];
export type SensorMount={site:MountSite;label:string};
export type SensorEntry={part:Part;kind:SensorKind;number:number;name:string;mounts:SensorMount[]};
export type VehicleDimensions={length:number;width:number;wb:number;track:number;r:number};

export function sensorEntries(parts:Part[]):SensorEntry[]{
 return parts.flatMap(part=>{
  const cp=part.custom_parameters,kind=cp.sensor_type as SensorKind;
  if(part.category!=='sensors'||!sensorKinds.includes(kind)||!Array.isArray(cp.sensor_mounts))return [];
  const mounts=cp.sensor_mounts.filter((m:any):m is SensorMount=>m&&sites.includes(m.site)&&typeof m.label==='string');
  if(!mounts.length)return [];
  return [{part,kind,number:sensorKinds.indexOf(kind)+1,name:cp.sensor_short_name??part.name,mounts}];
 });
}

// The existing car faces -X; its driven rear axle is at +wheelbase/2.
// Mounts follow the schematic dimensions; they are not mechanical coordinates.
export function mountPosition(site:MountSite,{length,width,wb,track,r}:VehicleDimensions):[number,number,number]{
 switch(site){
  case 'front_left':return [-length/2-.04,.63,width*.4];
  case 'front_right':return [-length/2-.04,.63,-width*.4];
  case 'front_center':return [-length/2-.05,.67,0];
  case 'rear_center':return [length/2+.05,.67,0];
  case 'upper_deck':return [0,1.18,0];
  case 'battery_surface':return [-.12,.79,width*.27];
  case 'motor_surface':return [wb/2-.2,.89,.12];
  case 'bumper_contact':return [-length/2-.08,.43,0];
  case 'steering_pivot':return [-wb/2,.82,0];
  case 'rear_axle':return [wb/2,.51,-track*.28];
  case 'rear_left_hub':return [wb/2,r+.02,track/2-.12];
  case 'rear_right_hub':return [wb/2,r+.02,-track/2+.12];
 }
}

export function sensorColor(kind:SensorKind){
 return {infrared:0xf69a68,ultrasonic:0x79c8ff,gps:0xf3d66d,temperature:0xf07d94,force:0xb7e47d,rotary:0xc7a0f5,hall:0x78d4b3,wheel_encoder:0x8eacff}[kind];
}

export function createSensorObject(kind:SensorKind,site:MountSite){
 const group=new THREE.Group(),color=sensorColor(kind);
 const mat=(c:number)=>new THREE.MeshStandardMaterial({color:c,metalness:.35,roughness:.4});
 function cube(size:[number,number,number],pos:[number,number,number],c:number){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),mat(c));mesh.position.set(...pos);group.add(mesh);return mesh}
 function cylinder(radius:number,height:number,pos:[number,number,number],c:number,axis:'x'|'y'='y'){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,20),mat(c));
  if(axis==='x')mesh.rotation.z=Math.PI/2;
  mesh.position.set(...pos);group.add(mesh);return mesh;
 }
 // Small hardware is enlarged for visibility. Locator pins give the actual
 // estimated mounting sites; final board dimensions and brackets need review.
 if(kind==='infrared'){
  cube([.06,.065,.15],[0,0,0],0x252d35);
  for(const z of [-.045,.045])cylinder(.023,.025,[-.04,0,z],color,'x');
 }else if(kind==='ultrasonic'){
  cube([.02,.075,.19],[0,0,0],color);
  for(const z of [-.055,.055]){cylinder(.035,.055,[-.035,0,z],0xbfcbd0,'x');cylinder(.026,.003,[-.065,0,z],0x303c47,'x')}
 }else if(kind==='gps'){
  cube([.12,.018,.15],[0,0,0],color);cube([.075,.035,.075],[0,.026,0],0xe6e2cc);
  // Illustrative nonmetallic upper-deck stand, not a supplied component.
  cube([.014,.35,.014],[0,-.18,0],0x59717b);
 }else if(kind==='temperature'){
  cylinder(.018,.12,[0,0,0],0xd2dee3,'x');cube([.07,.012,.025],[.09,0,0],color);
 }else if(kind==='force'){
  cylinder(.055,.012,[0,0,0],color,'x');cube([.01,.04,.028],[.01,-.07,0],0x51606b);
 }else if(kind==='rotary'){
  cube([.1,.018,.1],[0,0,0],color);cube([.024,.015,.024],[0,.017,0],0x242e36);cylinder(.023,.02,[0,.05,0],0xd8e2e9);
 }else if(kind==='hall'){
  cube([.1,.02,.075],[0,0,0],color);cube([.018,.045,.015],[.035,.03,0],0x27323c);cylinder(.02,.02,[.055,.055,0],0xd8e2e9);
 }else{
  cube([.07,.045,.02],[0,.055,0],color);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.06,.014,8,24),mat(0xbcc9d3));group.add(ring);
 }
 if(site==='rear_center')group.rotation.y=Math.PI;
 if(site==='front_left')group.rotation.y=Math.PI/12;
 if(site==='front_right')group.rotation.y=-Math.PI/12;
 return group;
}
